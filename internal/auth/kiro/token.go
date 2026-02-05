package kiro

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// KiroTokenStorage implements TokenStorage interface for Kiro authentication.
type KiroTokenStorage struct {
	AccessToken    string `json:"access_token"`
	RefreshToken   string `json:"refresh_token"`
	ProfileArn     string `json:"profile_arn"`
	ExpiresAt      string `json:"expires_at"`
	AuthMethod     string `json:"auth_method"`
	Provider       string `json:"provider"`
	ClientID       string `json:"client_id"`
	ClientSecret   string `json:"client_secret"`
	ClientIDHash   string `json:"client_id_hash"`
	Email          string `json:"email"`
	Region         string `json:"region,omitempty"`
	StartURL       string `json:"start_url,omitempty"`
	Type           string `json:"type"`
}

// SaveTokenToFile serializes the Kiro token storage to a JSON file.
func (ts *KiroTokenStorage) SaveTokenToFile(authFilePath string) error {
	ts.Type = "kiro"

	// Create directory structure if it doesn't exist
	if err := os.MkdirAll(filepath.Dir(authFilePath), 0700); err != nil {
		return fmt.Errorf("failed to create directory: %v", err)
	}

	// Create the token file
	f, err := os.Create(authFilePath)
	if err != nil {
		return fmt.Errorf("failed to create token file: %w", err)
	}
	defer func() {
		_ = f.Close()
	}()

	// Encode and write the token data as JSON
	enc := json.NewEncoder(f)
	enc.SetIndent("", "  ")
	if err = enc.Encode(ts); err != nil {
		return fmt.Errorf("failed to write token to file: %w", err)
	}
	return nil
}
