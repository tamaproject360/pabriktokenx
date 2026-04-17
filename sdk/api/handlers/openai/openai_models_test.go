package openai

import (
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	management "github.com/router-for-me/CLIProxyAPI/v6/internal/api/handlers/management"
)

func TestOpenAIModels_IncludesHardcodedDefaults(t *testing.T) {
	gin.SetMode(gin.TestMode)

	management.SetModelSettingsPath(t.TempDir() + "/non-existent-model-settings.json")
	t.Cleanup(func() {
		management.SetModelSettingsPath("")
	})

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)

	h := &OpenAIAPIHandler{}
	h.OpenAIModels(ctx)

	if recorder.Code != 200 {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}

	var payload struct {
		Object string `json:"object"`
		Data   []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	ids := make(map[string]struct{}, len(payload.Data))
	for _, item := range payload.Data {
		ids[item.ID] = struct{}{}
	}

	if _, ok := ids["gpt-5.4"]; !ok {
		t.Fatalf("expected gpt-5.4 to be included in /v1/models")
	}
	if _, ok := ids["gpt-5.4-mini"]; !ok {
		t.Fatalf("expected gpt-5.4-mini to be included in /v1/models")
	}
}
