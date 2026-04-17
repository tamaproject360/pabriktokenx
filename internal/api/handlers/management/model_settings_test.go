package management

import "testing"

func TestIsModelGloballyRemoved_RespectsActiveEntry(t *testing.T) {
	oldPath := getModelSettingsPath()
	tmpPath := t.TempDir() + "/model_settings_test.json"
	SetModelSettingsPath(tmpPath)
	t.Cleanup(func() {
		SetModelSettingsPath(oldPath)
	})

	cfg := &ModelSettingsConfig{Models: map[string]ModelSetting{
		"codex-a.json:gpt-5.3-codex": {
			ModelID:  "gpt-5.3-codex",
			Provider: "codex",
			AuthFile: "codex-a.json",
			Enabled:  false,
			Removed:  true,
		},
		"codex-b.json:gpt-5.3-codex": {
			ModelID:  "gpt-5.3-codex",
			Provider: "codex",
			AuthFile: "codex-b.json",
			Enabled:  true,
			Removed:  false,
		},
	}}
	if err := saveModelSettings(cfg); err != nil {
		t.Fatalf("saveModelSettings error: %v", err)
	}

	if IsModelGloballyRemoved("gpt-5.3-codex") {
		t.Fatalf("expected model not globally removed when active entry still exists")
	}

	cfg.Models["codex-b.json:gpt-5.3-codex"] = ModelSetting{
		ModelID:  "gpt-5.3-codex",
		Provider: "codex",
		AuthFile: "codex-b.json",
		Enabled:  false,
		Removed:  true,
	}
	if err := saveModelSettings(cfg); err != nil {
		t.Fatalf("saveModelSettings error: %v", err)
	}

	if !IsModelGloballyRemoved("gpt-5.3-codex") {
		t.Fatalf("expected model globally removed when all entries are removed")
	}
}

func TestResolveModelTestProvider(t *testing.T) {
	tests := []struct {
		name      string
		requested string
		auth      string
		modelID   string
		want      string
	}{
		{
			name:      "gemini from requested provider",
			requested: "gemini-cli",
			auth:      "codex",
			modelID:   "gemini-2.5-pro",
			want:      "gemini-cli",
		},
		{
			name:      "gemini cli from auth provider",
			requested: "",
			auth:      "gemini-cli",
			modelID:   "gemini-2.5-flash",
			want:      "gemini-cli",
		},
		{
			name:      "codex from auth provider",
			requested: "",
			auth:      "codex",
			modelID:   "gpt-5.4",
			want:      "codex",
		},
		{
			name:      "openai inferred from model",
			requested: "",
			auth:      "openai",
			modelID:   "gpt-4o-mini",
			want:      "openai",
		},
		{
			name:      "gemini inferred from model",
			requested: "",
			auth:      "",
			modelID:   "gemini-2.0-flash",
			want:      "gemini",
		},
		{
			name:      "unknown provider returns empty",
			requested: "claude",
			auth:      "anthropic",
			modelID:   "claude-sonnet-4",
			want:      "",
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			got := resolveModelTestProvider(tc.requested, tc.auth, tc.modelID)
			if got != tc.want {
				t.Fatalf("resolveModelTestProvider(%q, %q, %q) = %q, want %q", tc.requested, tc.auth, tc.modelID, got, tc.want)
			}
		})
	}
}

func TestTrimModelTestPreview(t *testing.T) {
	input := "  hello world  "
	got := trimModelTestPreview(input, 5)
	if got != "hello..." {
		t.Fatalf("unexpected trimmed preview: %q", got)
	}

	gotNoTrim := trimModelTestPreview(input, 50)
	if gotNoTrim != "hello world" {
		t.Fatalf("unexpected preview without truncation: %q", gotNoTrim)
	}
}

func TestExtractModelTestErrorMessage(t *testing.T) {
	payload := `{"error":{"message":"model not available"}}`
	got := extractModelTestErrorMessage(payload)
	if got != "model not available" {
		t.Fatalf("unexpected error message: %q", got)
	}

	payload = `{"message":"top level error"}`
	got = extractModelTestErrorMessage(payload)
	if got != "top level error" {
		t.Fatalf("unexpected top-level message: %q", got)
	}
}

func TestCollectScopedAuthFiles_UsesProviderScopeAndPreferred(t *testing.T) {
	h := &Handler{}
	cfg := &ModelSettingsConfig{Models: map[string]ModelSetting{
		"codex-a.json:gpt-5.2": {
			ModelID:  "gpt-5.2",
			Provider: "codex",
			AuthFile: "codex-a.json",
			Enabled:  true,
		},
		"codex-b.json:gpt-5.2": {
			ModelID:  "gpt-5.2",
			Provider: "codex",
			AuthFile: "codex-b.json",
			Enabled:  true,
		},
		"gemini-a.json:gemini-2.5-pro": {
			ModelID:  "gemini-2.5-pro",
			Provider: "gemini",
			AuthFile: "gemini-a.json",
			Enabled:  true,
		},
	}}

	got := h.collectScopedAuthFiles(cfg, "codex", "codex-c.json")
	if len(got) != 3 {
		t.Fatalf("expected 3 auth files in codex scope, got %d (%v)", len(got), got)
	}

	found := map[string]bool{}
	for _, item := range got {
		found[item] = true
	}

	if !found["codex-a.json"] || !found["codex-b.json"] || !found["codex-c.json"] {
		t.Fatalf("unexpected scoped auth files: %v", got)
	}
	if found["gemini-a.json"] {
		t.Fatalf("provider scope leaked unrelated auth file: %v", got)
	}
}

func TestResolveProviderForScope_FromConfig(t *testing.T) {
	h := &Handler{}
	cfg := &ModelSettingsConfig{Models: map[string]ModelSetting{
		"codex-a.json:gpt-5.4": {
			ModelID:  "gpt-5.4",
			Provider: "codex",
			AuthFile: "codex-a.json",
			Enabled:  true,
		},
	}}

	got := h.resolveProviderForScope(cfg, "", "codex-a.json", "gpt-5.4")
	if got != "codex" {
		t.Fatalf("resolveProviderForScope should infer provider from config, got %q", got)
	}
}
