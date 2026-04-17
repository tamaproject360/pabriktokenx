package executor

import "testing"

func TestResolveGeminiOAuthClientCredentials_UsesDefaults(t *testing.T) {
	oldID := geminiOAuthClientID
	oldSecret := geminiOAuthClientSecret
	geminiOAuthClientID = ""
	geminiOAuthClientSecret = ""
	t.Cleanup(func() {
		geminiOAuthClientID = oldID
		geminiOAuthClientSecret = oldSecret
	})

	id, secret := resolveGeminiOAuthClientCredentials(nil, nil)
	if id != defaultGeminiOAuthClientID {
		t.Fatalf("client id = %q, want %q", id, defaultGeminiOAuthClientID)
	}
	if secret != defaultGeminiOAuthClientSecret {
		t.Fatalf("client secret = %q, want %q", secret, defaultGeminiOAuthClientSecret)
	}
}

func TestResolveGeminiOAuthClientCredentials_MetadataOverridesEnv(t *testing.T) {
	oldID := geminiOAuthClientID
	oldSecret := geminiOAuthClientSecret
	geminiOAuthClientID = "env-client-id"
	geminiOAuthClientSecret = "env-client-secret"
	t.Cleanup(func() {
		geminiOAuthClientID = oldID
		geminiOAuthClientSecret = oldSecret
	})

	metadata := map[string]any{
		"client_id":     "meta-client-id",
		"client_secret": "meta-client-secret",
	}

	id, secret := resolveGeminiOAuthClientCredentials(metadata, nil)
	if id != "meta-client-id" {
		t.Fatalf("client id = %q, want %q", id, "meta-client-id")
	}
	if secret != "meta-client-secret" {
		t.Fatalf("client secret = %q, want %q", secret, "meta-client-secret")
	}
}

func TestResolveGeminiOAuthClientCredentials_TokenMapOverrides(t *testing.T) {
	oldID := geminiOAuthClientID
	oldSecret := geminiOAuthClientSecret
	geminiOAuthClientID = "env-client-id"
	geminiOAuthClientSecret = "env-client-secret"
	t.Cleanup(func() {
		geminiOAuthClientID = oldID
		geminiOAuthClientSecret = oldSecret
	})

	metadata := map[string]any{
		"token": map[string]any{
			"client_id":     "token-client-id",
			"client_secret": "token-client-secret",
		},
	}

	id, secret := resolveGeminiOAuthClientCredentials(metadata, nil)
	if id != "token-client-id" {
		t.Fatalf("client id = %q, want %q", id, "token-client-id")
	}
	if secret != "token-client-secret" {
		t.Fatalf("client secret = %q, want %q", secret, "token-client-secret")
	}
}
