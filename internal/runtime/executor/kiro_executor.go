package executor

import (
	"bufio"
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/router-for-me/CLIProxyAPI/v6/internal/config"
	cliproxyauth "github.com/router-for-me/CLIProxyAPI/v6/sdk/cliproxy/auth"
	cliproxyexecutor "github.com/router-for-me/CLIProxyAPI/v6/sdk/cliproxy/executor"
	log "github.com/sirupsen/logrus"
)

const (
	kiroContentType    = "application/json"
	kiroAcceptStream   = "*/*"
	kiroUserAgent      = "aws-sdk-rust/1.3.9 os/macos lang/rust/1.87.0"
	kiroFullUserAgent  = "aws-sdk-rust/1.3.9 ua/2.1 api/ssooidc/1.88.0 os/macos lang/rust/1.87.0 m/E app/AmazonQ-For-CLI"
	kiroDefaultRegion  = "us-east-1"

	minEventStreamFrameSize = 16
	maxEventStreamMsgSize   = 10 << 20
)

// KiroExecutor handles requests to AWS CodeWhisperer (Kiro) API
type KiroExecutor struct {
	cfg       *config.Config
	refreshMu sync.Mutex
}

// NewKiroExecutor creates a new Kiro executor instance
func NewKiroExecutor(cfg *config.Config) *KiroExecutor {
	return &KiroExecutor{cfg: cfg}
}

// Identifier returns the unique identifier for this executor
func (e *KiroExecutor) Identifier() string { return "kiro" }

// kiroEndpointConfig bundles endpoint URL with Origin and AmzTarget values
type kiroEndpointConfig struct {
	URL       string
	Origin    string
	AmzTarget string
	Name      string
}

// buildKiroEndpointConfigs creates endpoint configurations for the specified region
func buildKiroEndpointConfigs(region string) []kiroEndpointConfig {
	if region == "" {
		region = kiroDefaultRegion
	}

	return []kiroEndpointConfig{
		{
			URL:       fmt.Sprintf("https://q.%s.amazonaws.com/generateAssistantResponse", region),
			Origin:    "AI_EDITOR",
			AmzTarget: "",
			Name:      "AmazonQ",
		},
		{
			URL:       fmt.Sprintf("https://codewhisperer.%s.amazonaws.com/generateAssistantResponse", region),
			Origin:    "AI_EDITOR",
			AmzTarget: "AmazonCodeWhispererStreamingService.GenerateAssistantResponse",
			Name:      "CodeWhisperer",
		},
	}
}

// kiroCredentials extracts access token and profile ARN from auth
func kiroCredentials(auth *cliproxyauth.Auth) (string, string) {
	if auth == nil || auth.Metadata == nil {
		return "", ""
	}

	accessToken, _ := auth.Metadata["access_token"].(string)
	profileArn, _ := auth.Metadata["profile_arn"].(string)

	return accessToken, profileArn
}

// mapModelToKiroModelID maps our model ID to Kiro internal model ID
func mapModelToKiroModelID(modelID string) string {
	modelMap := map[string]string{
		"kiro-auto":                    "CLAUDE_SONNET_4_20250514_V1_0",
		"kiro-claude-opus-4-5":         "CLAUDE_OPUS_4_20250514_V1_0",
		"kiro-claude-sonnet-4-5":       "CLAUDE_3_7_SONNET_20250219_V1_0",
		"kiro-claude-sonnet-4":         "CLAUDE_SONNET_4_20250514_V1_0",
		"kiro-claude-haiku-4-5":        "CLAUDE_3_5_HAIKU_20241022_V1_0",
		"kiro-claude-opus-4-5-agentic": "CLAUDE_OPUS_4_20250514_V1_0",
		"kiro-claude-sonnet-4-5-agentic": "CLAUDE_3_7_SONNET_20250219_V1_0",
		"kiro-claude-sonnet-4-agentic": "CLAUDE_SONNET_4_20250514_V1_0",
		"kiro-claude-haiku-4-5-agentic": "CLAUDE_3_5_HAIKU_20241022_V1_0",
	}
	if kiroModel, ok := modelMap[modelID]; ok {
		return kiroModel
	}
	return "CLAUDE_SONNET_4_20250514_V1_0" // default
}

// translateToKiroFormat converts OpenAI/Claude format to Kiro format
func translateToKiroFormat(payload []byte, modelID string, profileArn string) ([]byte, error) {
	var reqData map[string]interface{}
	if err := json.Unmarshal(payload, &reqData); err != nil {
		return nil, fmt.Errorf("failed to parse request: %w", err)
	}

	messages, _ := reqData["messages"].([]interface{})
	kiroModelID := mapModelToKiroModelID(modelID)
	
	// Initialize history as empty array (NOT nil)
	history := make([]map[string]interface{}, 0)
	var systemPrompt string
	var currentContent string
	
	// Count non-system messages to determine last user message
	var nonSystemMessages []map[string]interface{}
	for _, msg := range messages {
		msgMap, ok := msg.(map[string]interface{})
		if !ok {
			continue
		}
		role, _ := msgMap["role"].(string)
		if role == "system" {
			content, _ := msgMap["content"].(string)
			systemPrompt = content
			continue
		}
		nonSystemMessages = append(nonSystemMessages, msgMap)
	}
	
	// Process messages - last user message goes to currentMessage
	for i, msgMap := range nonSystemMessages {
		role, _ := msgMap["role"].(string)
		content, _ := msgMap["content"].(string)
		
		// Last message should be currentMessage
		if i == len(nonSystemMessages)-1 && role == "user" {
			currentContent = content
			continue
		}
		
		// Build history pairs
		if role == "user" {
			history = append(history, map[string]interface{}{
				"userInputMessage": map[string]interface{}{
					"content": content,
					"modelId": kiroModelID,
					"origin":  "AI_EDITOR",
				},
			})
		} else if role == "assistant" {
			history = append(history, map[string]interface{}{
				"assistantResponseMessage": map[string]interface{}{
					"content": content,
				},
			})
		}
	}

	// Prepend system prompt to current content if exists
	if systemPrompt != "" && currentContent != "" {
		currentContent = systemPrompt + "\n\n" + currentContent
	} else if systemPrompt != "" {
		currentContent = systemPrompt
	}
	
	// Ensure currentContent is not empty
	if currentContent == "" {
		currentContent = "Hello"
	}

	// Build Kiro request payload - CORRECT FORMAT from ki2api
	kiroPayload := map[string]interface{}{
		"profileArn": profileArn,
		"conversationState": map[string]interface{}{
			"chatTriggerType": "MANUAL",
			"conversationId":  uuid.New().String(),
			"currentMessage": map[string]interface{}{
				"userInputMessage": map[string]interface{}{
					"content": currentContent,
					"modelId": kiroModelID,
					"origin":  "AI_EDITOR",
				},
			},
			"history": history,
		},
	}

	return json.Marshal(kiroPayload)
}

// PrepareRequest prepares the HTTP request before execution
func (e *KiroExecutor) PrepareRequest(req *http.Request, auth *cliproxyauth.Auth) error {
	if req == nil {
		return nil
	}

	accessToken, _ := kiroCredentials(auth)
	if strings.TrimSpace(accessToken) == "" {
		return fmt.Errorf("missing access token")
	}

	req.Header.Set("User-Agent", kiroUserAgent)
	req.Header.Set("X-Amz-User-Agent", kiroFullUserAgent)
	req.Header.Set("Amz-Sdk-Request", "attempt=1; max=3")
	req.Header.Set("Amz-Sdk-Invocation-Id", uuid.New().String())
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Content-Type", kiroContentType)
	req.Header.Set("Accept", kiroAcceptStream)

	return nil
}

// HttpRequest executes the HTTP request with Kiro credentials
func (e *KiroExecutor) HttpRequest(ctx context.Context, auth *cliproxyauth.Auth, req *http.Request) (*http.Response, error) {
	if req == nil {
		return nil, fmt.Errorf("kiro executor: request is nil")
	}

	if ctx == nil {
		ctx = req.Context()
	}

	httpReq := req.WithContext(ctx)
	if err := e.PrepareRequest(httpReq, auth); err != nil {
		return nil, err
	}

	httpClient := &http.Client{
		Timeout: 300 * time.Second,
	}

	return httpClient.Do(httpReq)
}

// isTokenExpired checks if the access token is expired
func isTokenExpired(auth *cliproxyauth.Auth) bool {
	if auth == nil || auth.Metadata == nil {
		return true
	}
	expiresAt, ok := auth.Metadata["expires_at"].(string)
	if !ok || expiresAt == "" {
		return false // Assume valid if no expiry info
	}
	expTime, err := time.Parse(time.RFC3339, expiresAt)
	if err != nil {
		return false
	}
	// Add 5 min buffer before expiry
	return time.Now().Add(5 * time.Minute).After(expTime)
}

// Execute sends the request to Kiro API and returns the response
func (e *KiroExecutor) Execute(ctx context.Context, auth *cliproxyauth.Auth, req cliproxyexecutor.Request, opts cliproxyexecutor.Options) (resp cliproxyexecutor.Response, err error) {
	// Auto-refresh if token expired
	if isTokenExpired(auth) {
		log.Infof("kiro: access token expired, attempting refresh...")
		newAuth, err := e.Refresh(ctx, auth)
		if err != nil {
			return resp, fmt.Errorf("kiro: token refresh failed: %w", err)
		}
		auth = newAuth
		log.Infof("kiro: token refreshed successfully")
	}

	accessToken, profileArn := kiroCredentials(auth)
	if accessToken == "" {
		return resp, fmt.Errorf("kiro: access token not found in auth")
	}
	if profileArn == "" {
		return resp, fmt.Errorf("kiro: profile_arn not found in auth")
	}

	// Translate request to Kiro format
	kiroPayload, err := translateToKiroFormat(req.Payload, req.Model, profileArn)
	if err != nil {
		return resp, fmt.Errorf("failed to translate request: %w", err)
	}

	log.Debugf("kiro: translated payload: %s", string(kiroPayload))

	// Get endpoint configs
	endpointConfigs := buildKiroEndpointConfigs(kiroDefaultRegion)

	// Try each endpoint
	var lastErr error
	for _, epConfig := range endpointConfigs {
		log.Debugf("kiro: trying endpoint: %s (%s)", epConfig.Name, epConfig.URL)

		httpReq, err := http.NewRequestWithContext(ctx, "POST", epConfig.URL, bytes.NewReader(kiroPayload))
		if err != nil {
			lastErr = fmt.Errorf("create request failed: %w", err)
			continue
		}

		// Set headers
		httpReq.Header.Set("Content-Type", kiroContentType)
		httpReq.Header.Set("Accept", kiroAcceptStream)
		if epConfig.AmzTarget != "" {
			httpReq.Header.Set("X-Amz-Target", epConfig.AmzTarget)
		}

		if err := e.PrepareRequest(httpReq, auth); err != nil {
			lastErr = err
			continue
		}

		httpClient := &http.Client{
			Timeout: 60 * time.Second,
		}

		httpResp, err := httpClient.Do(httpReq)
		if err != nil {
			lastErr = fmt.Errorf("request failed: %w", err)
			continue
		}

		if httpResp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(httpResp.Body)
			httpResp.Body.Close()
			log.Warnf("kiro: endpoint %s returned HTTP %d: %s", epConfig.Name, httpResp.StatusCode, string(body))
			lastErr = fmt.Errorf("HTTP %d: %s", httpResp.StatusCode, string(body))
			continue
		}

		// Success - read response
		respBody, err := io.ReadAll(httpResp.Body)
		httpResp.Body.Close()
		if err != nil {
			lastErr = fmt.Errorf("read response failed: %w", err)
			continue
		}

		log.Infof("kiro: successfully got response from %s", epConfig.Name)
		return cliproxyexecutor.Response{
			Payload: respBody,
		}, nil
	}

	return resp, fmt.Errorf("all endpoints failed, last error: %w", lastErr)
}

// ExecuteStream sends streaming request to Kiro API
func (e *KiroExecutor) ExecuteStream(ctx context.Context, auth *cliproxyauth.Auth, req cliproxyexecutor.Request, opts cliproxyexecutor.Options) (stream <-chan cliproxyexecutor.StreamChunk, err error) {
	out := make(chan cliproxyexecutor.StreamChunk)
	
	// Auto-refresh if token expired before starting goroutine
	if isTokenExpired(auth) {
		log.Infof("kiro: access token expired, attempting refresh...")
		newAuth, refreshErr := e.Refresh(ctx, auth)
		if refreshErr != nil {
			out <- cliproxyexecutor.StreamChunk{Err: fmt.Errorf("kiro: token refresh failed: %w", refreshErr)}
			close(out)
			return out, nil
		}
		auth = newAuth
		log.Infof("kiro: token refreshed successfully")
	}
	
	go func() {
		defer close(out)

		accessToken, profileArn := kiroCredentials(auth)
		if accessToken == "" {
			out <- cliproxyexecutor.StreamChunk{Err: fmt.Errorf("kiro: access token not found in auth")}
			return
		}
		if profileArn == "" {
			out <- cliproxyexecutor.StreamChunk{Err: fmt.Errorf("kiro: profile_arn not found in auth")}
			return
		}

		// Translate request to Kiro format
		kiroPayload, err := translateToKiroFormat(req.Payload, req.Model, profileArn)
		if err != nil {
			out <- cliproxyexecutor.StreamChunk{Err: fmt.Errorf("failed to translate request: %w", err)}
			return
		}

		log.Debugf("kiro: streaming with translated payload: %s", string(kiroPayload))

		endpointConfigs := buildKiroEndpointConfigs(kiroDefaultRegion)

		var lastErr error
		for _, epConfig := range endpointConfigs {
			log.Debugf("kiro: trying streaming endpoint: %s (%s)", epConfig.Name, epConfig.URL)

			httpReq, err := http.NewRequestWithContext(ctx, "POST", epConfig.URL, bytes.NewReader(kiroPayload))
			if err != nil {
				lastErr = fmt.Errorf("create request failed: %w", err)
				continue
			}

			httpReq.Header.Set("Content-Type", kiroContentType)
			httpReq.Header.Set("Accept", kiroAcceptStream)
			if epConfig.AmzTarget != "" {
				httpReq.Header.Set("X-Amz-Target", epConfig.AmzTarget)
			}

			if err := e.PrepareRequest(httpReq, auth); err != nil {
				lastErr = err
				continue
			}

			httpClient := &http.Client{
				Timeout: 300 * time.Second,
			}

			httpResp, err := httpClient.Do(httpReq)
			if err != nil {
				lastErr = fmt.Errorf("request failed: %w", err)
				continue
			}

			if httpResp.StatusCode != http.StatusOK {
				body, _ := io.ReadAll(httpResp.Body)
				httpResp.Body.Close()
				log.Warnf("kiro: streaming endpoint %s returned HTTP %d: %s", epConfig.Name, httpResp.StatusCode, string(body))
				lastErr = fmt.Errorf("HTTP %d: %s", httpResp.StatusCode, string(body))
				continue
			}

			log.Infof("kiro: streaming from %s", epConfig.Name)

			// Stream response
			reader := bufio.NewReader(httpResp.Body)
			for {
				select {
				case <-ctx.Done():
					httpResp.Body.Close()
					out <- cliproxyexecutor.StreamChunk{Err: ctx.Err()}
					return
				default:
				}

				msg, eventErr := e.readEventStreamMessage(reader)
				if eventErr != nil {
					httpResp.Body.Close()
					out <- cliproxyexecutor.StreamChunk{Err: eventErr}
					return
				}

				if msg == nil {
					httpResp.Body.Close()
					return
				}

				if len(msg.Payload) > 0 {
					// Transform Kiro response to OpenAI SSE format
					transformed := transformKiroToOpenAI(msg.Payload)
					if len(transformed) > 0 {
						out <- cliproxyexecutor.StreamChunk{Payload: transformed}
					}
				}
			}
		}

		if lastErr != nil {
			out <- cliproxyexecutor.StreamChunk{Err: lastErr}
		}
	}()

	return out, nil
}

// transformKiroToOpenAI converts Kiro event stream payload to OpenAI SSE format
func transformKiroToOpenAI(payload []byte) []byte {
	// Parse Kiro response
	var kiroResp map[string]interface{}
	if err := json.Unmarshal(payload, &kiroResp); err != nil {
		log.Debugf("kiro: failed to parse payload: %s", string(payload))
		return nil
	}

	// Extract content from Kiro response
	// Kiro format: {"assistantResponseEvent": {"content": "text"}}
	// or: {"content": "text"}
	var content string
	
	if event, ok := kiroResp["assistantResponseEvent"].(map[string]interface{}); ok {
		if c, ok := event["content"].(string); ok {
			content = c
		}
	} else if c, ok := kiroResp["content"].(string); ok {
		content = c
	}

	if content == "" {
		return nil
	}

	// Build OpenAI SSE chunk format
	openaiChunk := map[string]interface{}{
		"id":      "chatcmpl-kiro-" + uuid.New().String()[:8],
		"object":  "chat.completion.chunk",
		"created": time.Now().Unix(),
		"model":   "kiro",
		"choices": []map[string]interface{}{
			{
				"index": 0,
				"delta": map[string]interface{}{
					"content": content,
				},
				"finish_reason": nil,
			},
		},
	}

	result, _ := json.Marshal(openaiChunk)
	// Return in SSE format: data: {...}\n\n
	return append([]byte("data: "), append(result, []byte("\n\n")...)...)
}

// eventStreamMessage represents a parsed AWS Event Stream message
type eventStreamMessage struct {
	EventType string
	Payload   []byte
}

// EventStreamError represents an error from the event stream
type EventStreamError struct {
	Type    string
	Message string
	Cause   error
}

func (e *EventStreamError) Error() string {
	if e.Cause != nil {
		return fmt.Sprintf("%s: %s (%v)", e.Type, e.Message, e.Cause)
	}
	return fmt.Sprintf("%s: %s", e.Type, e.Message)
}

// readEventStreamMessage reads a single AWS Event Stream message
func (e *KiroExecutor) readEventStreamMessage(reader *bufio.Reader) (*eventStreamMessage, *EventStreamError) {
	prelude := make([]byte, 12)
	_, err := io.ReadFull(reader, prelude)
	if err == io.EOF {
		return nil, nil
	}
	if err != nil {
		return nil, &EventStreamError{
			Type:    "fatal",
			Message: "failed to read prelude",
			Cause:   err,
		}
	}

	totalLength := binary.BigEndian.Uint32(prelude[0:4])
	headersLength := binary.BigEndian.Uint32(prelude[4:8])

	if totalLength < minEventStreamFrameSize {
		return nil, &EventStreamError{
			Type:    "malformed",
			Message: fmt.Sprintf("invalid message length: %d", totalLength),
		}
	}

	if totalLength > maxEventStreamMsgSize {
		return nil, &EventStreamError{
			Type:    "malformed",
			Message: fmt.Sprintf("message too large: %d bytes", totalLength),
		}
	}

	remaining := make([]byte, totalLength-12)
	_, err = io.ReadFull(reader, remaining)
	if err != nil {
		return nil, &EventStreamError{
			Type:    "fatal",
			Message: "failed to read message body",
			Cause:   err,
		}
	}

	var eventType string
	if headersLength > 0 && headersLength <= uint32(len(remaining)) {
		eventType = e.extractEventTypeFromBytes(remaining[:headersLength])
	}

	payloadStart := headersLength
	payloadEnd := uint32(len(remaining)) - 4

	if payloadStart >= payloadEnd {
		return &eventStreamMessage{
			EventType: eventType,
			Payload:   nil,
		}, nil
	}

	payload := remaining[payloadStart:payloadEnd]

	return &eventStreamMessage{
		EventType: eventType,
		Payload:   payload,
	}, nil
}

// extractEventTypeFromBytes extracts event type from header bytes
func (e *KiroExecutor) extractEventTypeFromBytes(headers []byte) string {
	offset := 0
	for offset < len(headers) {
		nameLen := int(headers[offset])
		offset++
		if offset+nameLen > len(headers) {
			break
		}

		name := string(headers[offset : offset+nameLen])
		offset += nameLen
		if offset >= len(headers) {
			break
		}

		valueType := headers[offset]
		offset++

		if valueType == 7 { // String type
			if offset+2 > len(headers) {
				break
			}
			valueLen := int(binary.BigEndian.Uint16(headers[offset : offset+2]))
			offset += 2
			if offset+valueLen > len(headers) {
				break
			}

			value := string(headers[offset : offset+valueLen])
			offset += valueLen

			if name == ":event-type" {
				return value
			}
			continue
		}

		// Skip other value types
		nextOffset, ok := skipEventStreamHeaderValue(headers, offset, valueType)
		if !ok {
			break
		}
		offset = nextOffset
	}

	return ""
}

func skipEventStreamHeaderValue(headers []byte, offset int, valueType byte) (int, bool) {
	switch valueType {
	case 0, 1: // bool
		return offset, true
	case 2: // byte
		if offset+1 > len(headers) {
			return offset, false
		}
		return offset + 1, true
	case 3: // short
		if offset+2 > len(headers) {
			return offset, false
		}
		return offset + 2, true
	case 4: // int
		if offset+4 > len(headers) {
			return offset, false
		}
		return offset + 4, true
	case 5: // long
		if offset+8 > len(headers) {
			return offset, false
		}
		return offset + 8, true
	case 6: // byte array
		if offset+2 > len(headers) {
			return offset, false
		}
		valueLen := int(binary.BigEndian.Uint16(headers[offset : offset+2]))
		offset += 2
		if offset+valueLen > len(headers) {
			return offset, false
		}
		return offset + valueLen, true
	case 8: // timestamp
		if offset+8 > len(headers) {
			return offset, false
		}
		return offset + 8, true
	case 9: // uuid
		if offset+16 > len(headers) {
			return offset, false
		}
		return offset + 16, true
	default:
		return offset, false
	}
}

// CountTokens estimates token count locally
func (e *KiroExecutor) CountTokens(ctx context.Context, auth *cliproxyauth.Auth, req cliproxyexecutor.Request, opts cliproxyexecutor.Options) (cliproxyexecutor.Response, error) {
	estimatedTokens := len(req.Payload) / 4
	if estimatedTokens == 0 && len(req.Payload) > 0 {
		estimatedTokens = 1
	}

	return cliproxyexecutor.Response{
		Payload: []byte(fmt.Sprintf(`{"count":%d}`, estimatedTokens)),
	}, nil
}

// Refresh refreshes the Kiro OAuth token
func (e *KiroExecutor) Refresh(ctx context.Context, auth *cliproxyauth.Auth) (*cliproxyauth.Auth, error) {
	e.refreshMu.Lock()
	defer e.refreshMu.Unlock()

	log.Debugf("kiro executor: refresh called for auth %s", auth.ID)

	if auth == nil {
		return nil, fmt.Errorf("kiro executor: auth is nil")
	}

	var refreshToken string
	if auth.Metadata != nil {
		if rt, ok := auth.Metadata["refresh_token"].(string); ok {
			refreshToken = rt
		}
	}

	if refreshToken == "" {
		return nil, fmt.Errorf("kiro executor: refresh token not found")
	}

	// Call Kiro refresh endpoint
	refreshURL := "https://prod.us-east-1.auth.desktop.kiro.dev/refreshToken"
	reqBody := map[string]string{"refreshToken": refreshToken}
	bodyBytes, _ := json.Marshal(reqBody)

	httpReq, err := http.NewRequestWithContext(ctx, "POST", refreshURL, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("kiro executor: failed to create refresh request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	httpClient := &http.Client{Timeout: 30 * time.Second}
	resp, err := httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("kiro executor: refresh request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("kiro executor: refresh failed (HTTP %d): %s", resp.StatusCode, string(respBody))
	}

	var tokenResp struct {
		AccessToken  string `json:"accessToken"`
		RefreshToken string `json:"refreshToken"`
		ProfileArn   string `json:"profileArn"`
		ExpiresIn    int    `json:"expiresIn"`
	}
	if err := json.Unmarshal(respBody, &tokenResp); err != nil {
		return nil, fmt.Errorf("kiro executor: failed to parse refresh response: %w", err)
	}

	log.Infof("kiro executor: token refreshed successfully for auth %s", auth.ID)

	updated := auth.Clone()
	updated.Metadata["access_token"] = tokenResp.AccessToken
	if tokenResp.RefreshToken != "" {
		updated.Metadata["refresh_token"] = tokenResp.RefreshToken
	}
	if tokenResp.ProfileArn != "" {
		updated.Metadata["profile_arn"] = tokenResp.ProfileArn
	}
	updated.UpdatedAt = time.Now()
	updated.LastRefreshedAt = time.Now()

	return updated, nil
}
