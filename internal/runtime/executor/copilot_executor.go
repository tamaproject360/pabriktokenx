// Package executor provides runtime execution capabilities for various AI service providers.
// This file implements the GitHub Copilot executor for chat completions and model fetching.
package executor

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/router-for-me/CLIProxyAPI/v6/internal/auth/copilot"
	"github.com/router-for-me/CLIProxyAPI/v6/internal/config"
	"github.com/router-for-me/CLIProxyAPI/v6/internal/registry"
	cliproxyauth "github.com/router-for-me/CLIProxyAPI/v6/sdk/cliproxy/auth"
	cliproxyexecutor "github.com/router-for-me/CLIProxyAPI/v6/sdk/cliproxy/executor"
	log "github.com/sirupsen/logrus"
)

// GitHubCopilotExecutor handles requests to GitHub Copilot API.
type GitHubCopilotExecutor struct {
	cfg *config.Config
}

// NewGitHubCopilotExecutor creates a new GitHub Copilot executor instance.
func NewGitHubCopilotExecutor(cfg *config.Config) *GitHubCopilotExecutor {
	return &GitHubCopilotExecutor{cfg: cfg}
}

// Identifier returns the executor identifier.
func (e *GitHubCopilotExecutor) Identifier() string { return "github-copilot" }

// PrepareRequest prepares the HTTP request for execution (no-op for Copilot).
func (e *GitHubCopilotExecutor) PrepareRequest(_ *http.Request, _ *cliproxyauth.Auth) error {
	return nil
}

// Execute performs a non-streaming request to GitHub Copilot API.
func (e *GitHubCopilotExecutor) Execute(ctx context.Context, auth *cliproxyauth.Auth, req cliproxyexecutor.Request, opts cliproxyexecutor.Options) (resp cliproxyexecutor.Response, err error) {
	log.Infof("copilot executor: Execute called for model=%s", req.Model)
	
	// Get GitHub token and Copilot API token
	githubToken := getGitHubToken(auth)
	if githubToken == "" {
		return resp, fmt.Errorf("missing github token")
	}

	copilotAuth := copilot.NewCopilotAuth(e.cfg)
	apiToken, err := copilotAuth.GetCopilotAPIToken(ctx, githubToken)
	if err != nil {
		return resp, fmt.Errorf("failed to get copilot API token: %w", err)
	}

	// Build request to Copilot API
	apiURL := copilot.GetAPIEndpoint() + "/chat/completions"
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, bytes.NewReader(req.Payload))
	if err != nil {
		return resp, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Authorization", "Bearer "+apiToken.Token)
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")
	httpReq.Header.Set("User-Agent", "GithubCopilot/1.0")
	httpReq.Header.Set("Editor-Version", "vscode/1.100.0")
	httpReq.Header.Set("Editor-Plugin-Version", "copilot/1.300.0")
	httpReq.Header.Set("Openai-Organization", "github-copilot")
	httpReq.Header.Set("Openai-Intent", "conversation-panel")
	httpReq.Header.Set("Copilot-Integration-Id", "vscode-chat")

	httpClient := newProxyAwareHTTPClient(ctx, e.cfg, auth, 0)
	httpResp, err := httpClient.Do(httpReq)
	if err != nil {
		return resp, fmt.Errorf("request failed: %w", err)
	}
	defer httpResp.Body.Close()

	bodyBytes, err := io.ReadAll(httpResp.Body)
	if err != nil {
		return resp, fmt.Errorf("failed to read response: %w", err)
	}

	if httpResp.StatusCode < 200 || httpResp.StatusCode >= 300 {
		return resp, statusErr{code: httpResp.StatusCode, msg: string(bodyBytes)}
	}

	// Return response with Payload field (not StatusCode/Body)
	return cliproxyexecutor.Response{Payload: bodyBytes}, nil
}

// ExecuteStream performs a streaming request to GitHub Copilot API.
func (e *GitHubCopilotExecutor) ExecuteStream(ctx context.Context, auth *cliproxyauth.Auth, req cliproxyexecutor.Request, opts cliproxyexecutor.Options) (stream <-chan cliproxyexecutor.StreamChunk, err error) {
	log.Infof("copilot executor: ExecuteStream called for model=%s", req.Model)
	
	// Get GitHub token and Copilot API token
	githubToken := getGitHubToken(auth)
	if githubToken == "" {
		return nil, fmt.Errorf("missing github token")
	}

	copilotAuth := copilot.NewCopilotAuth(e.cfg)
	apiToken, err := copilotAuth.GetCopilotAPIToken(ctx, githubToken)
	if err != nil {
		return nil, fmt.Errorf("failed to get copilot API token: %w", err)
	}

	// Ensure stream=true in payload
	var payload map[string]interface{}
	if err := json.Unmarshal(req.Payload, &payload); err != nil {
		return nil, fmt.Errorf("failed to parse payload: %w", err)
	}
	payload["stream"] = true
	modifiedPayload, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload: %w", err)
	}

	// Build request to Copilot API
	apiURL := copilot.GetAPIEndpoint() + "/chat/completions"
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, bytes.NewReader(modifiedPayload))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Authorization", "Bearer "+apiToken.Token)
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "text/event-stream")
	httpReq.Header.Set("User-Agent", "GithubCopilot/1.0")
	httpReq.Header.Set("Editor-Version", "vscode/1.100.0")
	httpReq.Header.Set("Editor-Plugin-Version", "copilot/1.300.0")
	httpReq.Header.Set("Openai-Organization", "github-copilot")
	httpReq.Header.Set("Openai-Intent", "conversation-panel")
	httpReq.Header.Set("Copilot-Integration-Id", "vscode-chat")

	httpClient := newProxyAwareHTTPClient(ctx, e.cfg, auth, 0)
	httpResp, err := httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}

	if httpResp.StatusCode < 200 || httpResp.StatusCode >= 300 {
		bodyBytes, _ := io.ReadAll(httpResp.Body)
		httpResp.Body.Close()
		return nil, statusErr{code: httpResp.StatusCode, msg: string(bodyBytes)}
	}

	// Create stream channel
	ch := make(chan cliproxyexecutor.StreamChunk)
	go func() {
		defer close(ch)
		defer httpResp.Body.Close()
		
		// Use bufio.Scanner to read SSE stream line by line
		scanner := bufio.NewScanner(httpResp.Body)
		scanner.Buffer(nil, 52_428_800) // 50MB buffer
		
		for scanner.Scan() {
			line := scanner.Bytes()
			if len(line) == 0 {
				continue
			}
			
			// SSE format: "data: {...}"
			if bytes.HasPrefix(line, []byte("data: ")) {
				payload := bytes.TrimPrefix(line, []byte("data: "))
				if bytes.Equal(payload, []byte("[DONE]")) {
					return
				}
				// Send as StreamChunk with Payload field (not Data)
				ch <- cliproxyexecutor.StreamChunk{Payload: bytes.Clone(payload)}
			}
		}
		
		if err := scanner.Err(); err != nil {
			// Send error as StreamChunk with Err field (not Error)
			ch <- cliproxyexecutor.StreamChunk{Err: err}
		}
	}()

	return ch, nil
}

// Refresh refreshes the authentication (not implemented for Copilot).
func (e *GitHubCopilotExecutor) Refresh(ctx context.Context, auth *cliproxyauth.Auth) (*cliproxyauth.Auth, error) {
	return auth, nil
}

// CountTokens counts tokens (not implemented for Copilot).
func (e *GitHubCopilotExecutor) CountTokens(ctx context.Context, auth *cliproxyauth.Auth, req cliproxyexecutor.Request, opts cliproxyexecutor.Options) (cliproxyexecutor.Response, error) {
	return cliproxyexecutor.Response{}, fmt.Errorf("token counting not supported for GitHub Copilot")
}

// getGitHubToken extracts GitHub access token from auth metadata
func getGitHubToken(auth *cliproxyauth.Auth) string {
	if auth == nil || auth.Metadata == nil {
		return ""
	}
	if token, ok := auth.Metadata["github_token"].(string); ok {
		return token
	}
	if token, ok := auth.Metadata["access_token"].(string); ok {
		return token
	}
	return ""
}

// FetchCopilotModels retrieves available models from GitHub Copilot API using the supplied auth.
func FetchCopilotModels(ctx context.Context, auth *cliproxyauth.Auth, cfg *config.Config) []*registry.ModelInfo {
	log.Infof("copilot executor: FetchCopilotModels called for auth: %+v", auth)
	
	if auth == nil {
		log.Warn("copilot executor: auth is nil, cannot fetch models")
		return nil
	}

	log.Infof("copilot executor: auth provider=%s, id=%s, label=%s", auth.Provider, auth.ID, auth.Label)
	log.Infof("copilot executor: auth metadata keys=%+v", getMetadataKeys(auth.Metadata))

	// Get GitHub access token from auth metadata
	githubToken := ""
	if auth.Metadata != nil {
		if token, ok := auth.Metadata["github_token"].(string); ok {
			githubToken = token
			log.Infof("copilot executor: found github_token in metadata (length=%d)", len(githubToken))
		} else if token, ok := auth.Metadata["access_token"].(string); ok {
			githubToken = token
			log.Infof("copilot executor: using access_token as fallback (length=%d)", len(githubToken))
		}
	}

	if githubToken == "" {
		log.Warnf("copilot executor: github_token not found in auth metadata, available keys: %+v", getMetadataKeys(auth.Metadata))
		return nil
	}

	// Initialize Copilot auth service
	copilotAuth := copilot.NewCopilotAuth(cfg)

	// Fetch available models from Copilot API
	modelsData, err := copilotAuth.FetchAvailableModels(ctx, githubToken)
	if err != nil {
		log.Errorf("copilot executor: failed to fetch models: %v", err)
		return nil
	}

	if len(modelsData) == 0 {
		log.Warn("copilot executor: no models returned from API")
		return nil
	}

	// Convert to ModelInfo format
	now := time.Now().Unix()
	models := make([]*registry.ModelInfo, 0, len(modelsData))
	
	for _, modelData := range modelsData {
		// Extract model ID
		modelID, ok := modelData["id"].(string)
		if !ok {
			continue
		}

		// Extract model name (may be same as ID)
		modelName := modelID
		if name, ok := modelData["name"].(string); ok && name != "" {
			modelName = name
		}

		// Extract display name
		displayName := modelName
		if display, ok := modelData["display_name"].(string); ok && display != "" {
			displayName = display
		}

		// Extract description
		description := ""
		if desc, ok := modelData["description"].(string); ok {
			description = desc
		}

		// Extract version
		version := ""
		if ver, ok := modelData["version"].(string); ok {
			version = ver
		}

		modelInfo := &registry.ModelInfo{
			ID:          modelID,
			Name:        modelName,
			Description: description,
			DisplayName: displayName,
			Version:     version,
			Object:      "model",
			Created:     now,
			OwnedBy:     "github-copilot",
			Type:        "github-copilot",
		}

		models = append(models, modelInfo)
	}

	log.Infof("copilot executor: successfully fetched %d models from GitHub Copilot API", len(models))
	for i, m := range models {
		log.Infof("copilot executor: model[%d]: id=%s, name=%s, display=%s", i, m.ID, m.Name, m.DisplayName)
	}
	return models
}

// getMetadataKeys returns the keys from metadata map for debugging
func getMetadataKeys(metadata map[string]any) []string {
	if metadata == nil {
		return []string{}
	}
	keys := make([]string, 0, len(metadata))
	for k := range metadata {
		keys = append(keys, k)
	}
	return keys
}
