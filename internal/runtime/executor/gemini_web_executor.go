package executor

import (
	"bufio"
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/router-for-me/CLIProxyAPI/v6/internal/config"
	cliproxyauth "github.com/router-for-me/CLIProxyAPI/v6/sdk/cliproxy/auth"
	cliproxyexecutor "github.com/router-for-me/CLIProxyAPI/v6/sdk/cliproxy/executor"
	log "github.com/sirupsen/logrus"
	"github.com/tidwall/gjson"
)

const (
	geminiWebEndpoint = "https://generativelanguage.googleapis.com/v1beta"
)

// GeminiWebExecutor handles Gemini API calls using cookie-based authentication
type GeminiWebExecutor struct {
	cfg *config.Config
}

// NewGeminiWebExecutor creates a new Gemini Web executor
func NewGeminiWebExecutor(cfg *config.Config) *GeminiWebExecutor {
	return &GeminiWebExecutor{cfg: cfg}
}

// Identifier returns the executor identifier
func (e *GeminiWebExecutor) Identifier() string {
	return "gemini-web"
}

// PrepareRequest is a no-op for Gemini Web executor
func (e *GeminiWebExecutor) PrepareRequest(_ *http.Request, _ *cliproxyauth.Auth) error {
	return nil
}

// Execute handles non-streaming requests
func (e *GeminiWebExecutor) Execute(ctx context.Context, auth *cliproxyauth.Auth, req cliproxyexecutor.Request, opts cliproxyexecutor.Options) (resp cliproxyexecutor.Response, err error) {
	if auth == nil || auth.Metadata == nil {
		return resp, fmt.Errorf("gemini-web executor: missing authentication")
	}

	cookie, ok := auth.Metadata["cookie"].(string)
	if !ok || cookie == "" {
		return resp, fmt.Errorf("gemini-web executor: missing cookie in metadata")
	}

	// Build URL
	modelName := req.Model
	if !strings.HasPrefix(modelName, "models/") {
		modelName = "models/" + modelName
	}

	action := "generateContent"
	if req.Metadata != nil {
		if a, ok := req.Metadata["action"].(string); ok && a != "" {
			action = a
		}
	}

	url := fmt.Sprintf("%s/%s:%s", geminiWebEndpoint, modelName, action)

	// Create HTTP request
	httpReq, errNewReq := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(req.Payload))
	if errNewReq != nil {
		return resp, errNewReq
	}

	// Set headers
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Cookie", cookie)
	httpReq.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	// Execute request
	httpClient := &http.Client{}
	httpResp, errDo := httpClient.Do(httpReq)
	if errDo != nil {
		return resp, fmt.Errorf("gemini-web executor: request failed: %w", errDo)
	}
	defer httpResp.Body.Close()

	// Read response
	bodyBytes, errRead := io.ReadAll(httpResp.Body)
	if errRead != nil {
		return resp, fmt.Errorf("gemini-web executor: failed to read response: %w", errRead)
	}

	if httpResp.StatusCode >= 400 {
		errorMsg := gjson.GetBytes(bodyBytes, "error.message").String()
		if errorMsg == "" {
			errorMsg = string(bodyBytes)
		}
		return resp, fmt.Errorf("gemini-web executor: API error (status %d): %s", httpResp.StatusCode, errorMsg)
	}

	resp.Payload = bodyBytes

	return resp, nil
}

// ExecuteStream handles streaming requests
func (e *GeminiWebExecutor) ExecuteStream(ctx context.Context, auth *cliproxyauth.Auth, req cliproxyexecutor.Request, opts cliproxyexecutor.Options) (<-chan cliproxyexecutor.StreamChunk, error) {
	if auth == nil || auth.Metadata == nil {
		return nil, fmt.Errorf("gemini-web executor: missing authentication")
	}

	cookie, ok := auth.Metadata["cookie"].(string)
	if !ok || cookie == "" {
		return nil, fmt.Errorf("gemini-web executor: missing cookie in metadata")
	}

	// Build URL
	modelName := req.Model
	if !strings.HasPrefix(modelName, "models/") {
		modelName = "models/" + modelName
	}

	url := fmt.Sprintf("%s/%s:streamGenerateContent", geminiWebEndpoint, modelName)

	// Create HTTP request
	httpReq, errNewReq := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(req.Payload))
	if errNewReq != nil {
		return nil, errNewReq
	}

	// Set headers
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Cookie", cookie)
	httpReq.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	// Execute request
	httpClient := &http.Client{}
	httpResp, errDo := httpClient.Do(httpReq)
	if errDo != nil {
		return nil, fmt.Errorf("gemini-web executor: request failed: %w", errDo)
	}

	if httpResp.StatusCode >= 400 {
		bodyBytes, _ := io.ReadAll(httpResp.Body)
		httpResp.Body.Close()
		errorMsg := gjson.GetBytes(bodyBytes, "error.message").String()
		if errorMsg == "" {
			errorMsg = string(bodyBytes)
		}
		return nil, fmt.Errorf("gemini-web executor: API error (status %d): %s", httpResp.StatusCode, errorMsg)
	}

	// Create streaming channel
	streamChan := make(chan cliproxyexecutor.StreamChunk, 10)

	go func() {
		defer close(streamChan)
		defer httpResp.Body.Close()

		scanner := bufio.NewScanner(httpResp.Body)
		scanner.Buffer(make([]byte, 4096), streamScannerBuffer)

		for scanner.Scan() {
			line := scanner.Bytes()
			if len(line) == 0 {
				continue
			}

			// Parse SSE format: "data: {...}"
			if bytes.HasPrefix(line, []byte("data: ")) {
				chunk := bytes.TrimPrefix(line, []byte("data: "))
				streamChan <- cliproxyexecutor.StreamChunk{Payload: chunk}
			}
		}

		if err := scanner.Err(); err != nil {
			log.Errorf("gemini-web executor: stream error: %v", err)
			streamChan <- cliproxyexecutor.StreamChunk{Err: err}
		}
	}()

	return streamChan, nil
}

// CountTokens handles token counting
func (e *GeminiWebExecutor) CountTokens(ctx context.Context, auth *cliproxyauth.Auth, req cliproxyexecutor.Request, opts cliproxyexecutor.Options) (cliproxyexecutor.Response, error) {
	// Add action to metadata
	if req.Metadata == nil {
		req.Metadata = make(map[string]any)
	}
	req.Metadata["action"] = "countTokens"
	return e.Execute(ctx, auth, req, opts)
}

// Refresh attempts to refresh provider credentials (no-op for cookie-based auth)
func (e *GeminiWebExecutor) Refresh(_ context.Context, auth *cliproxyauth.Auth) (*cliproxyauth.Auth, error) {
	return auth, nil
}
