package handlers

import (
	"context"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	management "github.com/router-for-me/CLIProxyAPI/v6/internal/api/handlers/management"
	"github.com/router-for-me/CLIProxyAPI/v6/internal/registry"
	coreauth "github.com/router-for-me/CLIProxyAPI/v6/sdk/cliproxy/auth"
)

func TestGetRequestDetails_StrictProviderHintMismatch(t *testing.T) {
	gin.SetMode(gin.TestMode)

	clientID := "test-handler-hint-mismatch"
	reg := registry.GetGlobalRegistry()
	reg.RegisterClient(clientID, "codex", []*registry.ModelInfo{{ID: "gpt-5.4"}})
	t.Cleanup(func() {
		reg.UnregisterClient(clientID)
	})

	ginCtx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ginCtx.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
	ginCtx.Request.Header.Set("X-Provider-Hint", "gemini")
	ctx := context.WithValue(context.Background(), "gin", ginCtx)

	h := &BaseAPIHandler{}
	providers, model, _, errMsg := h.getRequestDetails(ctx, "gpt-5.4")
	if errMsg == nil {
		t.Fatalf("expected error for mismatched provider hint, got providers=%v model=%q", providers, model)
	}
	if errMsg.StatusCode != 400 {
		t.Fatalf("expected status 400, got %d", errMsg.StatusCode)
	}
	if !strings.Contains(strings.ToLower(errMsg.Error.Error()), "selected provider") {
		t.Fatalf("expected selected provider error, got %q", errMsg.Error.Error())
	}
}

func TestGetRequestDetails_ProviderHintMatch(t *testing.T) {
	gin.SetMode(gin.TestMode)

	clientID := "test-handler-hint-match"
	reg := registry.GetGlobalRegistry()
	reg.RegisterClient(clientID, "codex", []*registry.ModelInfo{{ID: "gpt-5.4"}})
	t.Cleanup(func() {
		reg.UnregisterClient(clientID)
	})

	ginCtx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ginCtx.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
	ginCtx.Request.Header.Set("X-Provider-Hint", "codex")
	ctx := context.WithValue(context.Background(), "gin", ginCtx)

	h := &BaseAPIHandler{}
	providers, model, _, errMsg := h.getRequestDetails(ctx, "gpt-5.4")
	if errMsg != nil {
		t.Fatalf("expected no error, got %v", errMsg)
	}
	if model != "gpt-5.4" {
		t.Fatalf("expected model gpt-5.4, got %q", model)
	}
	if len(providers) != 1 || providers[0] != "codex" {
		t.Fatalf("expected providers [codex], got %v", providers)
	}
}

func TestGetRequestDetails_UsesHintWhenRegistryUnknownButAuthExists(t *testing.T) {
	gin.SetMode(gin.TestMode)

	manager := coreauth.NewManager(nil, nil, nil)
	if _, err := manager.Register(context.Background(), &coreauth.Auth{
		ID:       "test-auth-hinted-codex",
		Provider: "codex",
		Status:   coreauth.StatusActive,
		Metadata: map[string]any{"email": "test@example.com"},
	}); err != nil {
		t.Fatalf("register auth: %v", err)
	}

	ginCtx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ginCtx.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
	ginCtx.Request.Header.Set("X-Provider-Hint", "codex")
	ctx := context.WithValue(context.Background(), "gin", ginCtx)

	h := &BaseAPIHandler{AuthManager: manager}
	providers, model, _, errMsg := h.getRequestDetails(ctx, "gpt-5.4-mini")
	if errMsg != nil {
		t.Fatalf("expected no error, got %v", errMsg)
	}
	if model != "gpt-5.4-mini" {
		t.Fatalf("expected model gpt-5.4-mini, got %q", model)
	}
	if len(providers) != 1 || providers[0] != "codex" {
		t.Fatalf("expected providers [codex], got %v", providers)
	}
}

func TestGetRequestDetails_UsesHintWhenRegistryMismatchButAuthExists(t *testing.T) {
	gin.SetMode(gin.TestMode)

	registryClientID := "test-handler-hint-registry-mismatch"
	reg := registry.GetGlobalRegistry()
	reg.RegisterClient(registryClientID, "gemini-cli", []*registry.ModelInfo{{ID: "gpt-5.4-mini"}})
	t.Cleanup(func() {
		reg.UnregisterClient(registryClientID)
	})

	manager := coreauth.NewManager(nil, nil, nil)
	if _, err := manager.Register(context.Background(), &coreauth.Auth{
		ID:       "test-auth-mismatch-codex",
		Provider: "codex",
		Status:   coreauth.StatusActive,
		Metadata: map[string]any{"email": "test@example.com"},
	}); err != nil {
		t.Fatalf("register auth: %v", err)
	}

	ginCtx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ginCtx.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
	ginCtx.Request.Header.Set("X-Provider-Hint", "codex")
	ctx := context.WithValue(context.Background(), "gin", ginCtx)

	h := &BaseAPIHandler{AuthManager: manager}
	providers, _, _, errMsg := h.getRequestDetails(ctx, "gpt-5.4-mini")
	if errMsg != nil {
		t.Fatalf("expected no error, got %v", errMsg)
	}
	if len(providers) != 1 || providers[0] != "codex" {
		t.Fatalf("expected providers [codex], got %v", providers)
	}
}

func TestGetRequestDetails_UsesConfiguredProviderWithoutHint(t *testing.T) {
	gin.SetMode(gin.TestMode)

	settingsPath := t.TempDir() + "/model_settings_test.json"
	settingsJSON := `{
		"models": {
			"codex-a.json:gpt-5.4-mini": {
				"model_id": "gpt-5.4-mini",
				"display_name": "gpt-5.4-mini",
				"provider": "codex",
				"auth_file": "codex-a.json",
				"enabled": true
			}
		}
	}`
	if err := os.WriteFile(settingsPath, []byte(settingsJSON), 0o644); err != nil {
		t.Fatalf("write model settings: %v", err)
	}
	management.SetModelSettingsPath(settingsPath)
	t.Cleanup(func() {
		management.SetModelSettingsPath("")
	})

	manager := coreauth.NewManager(nil, nil, nil)
	if _, err := manager.Register(context.Background(), &coreauth.Auth{
		ID:       "test-auth-configured-codex",
		Provider: "codex",
		Status:   coreauth.StatusActive,
		Metadata: map[string]any{"email": "test@example.com"},
	}); err != nil {
		t.Fatalf("register auth: %v", err)
	}

	ginCtx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ginCtx.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
	ctx := context.WithValue(context.Background(), "gin", ginCtx)

	h := &BaseAPIHandler{AuthManager: manager}
	providers, model, _, errMsg := h.getRequestDetails(ctx, "gpt-5.4-mini")
	if errMsg != nil {
		t.Fatalf("expected no error, got %v", errMsg)
	}
	if model != "gpt-5.4-mini" {
		t.Fatalf("expected model gpt-5.4-mini, got %q", model)
	}
	if len(providers) != 1 || providers[0] != "codex" {
		t.Fatalf("expected providers [codex], got %v", providers)
	}
}
