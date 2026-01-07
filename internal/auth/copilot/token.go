// Package copilot provides authentication and token management functionality
// for GitHub Copilot AI services. It handles OAuth2 device flow token storage,
// serialization, and retrieval for maintaining authenticated sessions with the Copilot API.
package copilot

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// CopilotTokenStorage stores OAuth2 token information for GitHub Copilot API authentication.
// It maintains compatibility with the existing auth system while adding Copilot-specific fields
// for managing access tokens and user account information.
type CopilotTokenStorage struct {
	// AccessToken is the OAuth2 access token used for authenticating API requests.
	AccessToken string `json:"access_token"`
	// TokenType is the type of token, typically "bearer".
	TokenType string `json:"token_type"`
	// Scope is the OAuth2 scope granted to the token.
	Scope string `json:"scope"`
	// ExpiresAt is the timestamp when the access token expires (if provided).
	ExpiresAt string `json:"expires_at,omitempty"`
	// Username is the GitHub username associated with this token.
	Username string `json:"username"`
	// Type indicates the authentication provider type, always "github-copilot" for this storage.
	Type string `json:"type"`
}

// CopilotTokenData holds the raw OAuth token response from GitHub.
type CopilotTokenData struct {
	// AccessToken is the OAuth2 access token.
	AccessToken string `json:"access_token"`
	// TokenType is the type of token, typically "bearer".
	TokenType string `json:"token_type"`
	// Scope is the OAuth2 scope granted to the token.
	Scope string `json:"scope"`
}

// CopilotAuthBundle bundles authentication data for storage.
type CopilotAuthBundle struct {
	// TokenData contains the OAuth token information.
	TokenData *CopilotTokenData
	// Username is the GitHub username.
	Username string
}

// DeviceCodeResponse represents GitHub's device code response.
type DeviceCodeResponse struct {
	// DeviceCode is the device verification code.
	DeviceCode string `json:"device_code"`
	// UserCode is the code the user must enter at the verification URI.
	UserCode string `json:"user_code"`
	// VerificationURI is the URL where the user should enter the code.
	VerificationURI string `json:"verification_uri"`
	// ExpiresIn is the number of seconds until the device code expires.
	ExpiresIn int `json:"expires_in"`
	// Interval is the minimum number of seconds to wait between polling requests.
	Interval int `json:"interval"`
}

// SaveTokenToFile serializes the Copilot token storage to a JSON file.
// This method creates the necessary directory structure and writes the token
// data in JSON format to the specified file path for persistent storage.
//
// Parameters:
//   - authFilePath: The full path where the token file should be saved
//
// Returns:
//   - error: An error if the operation fails, nil otherwise
func (ts *CopilotTokenStorage) SaveTokenToFile(authFilePath string) error {
	dir := filepath.Dir(authFilePath)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return fmt.Errorf("failed to ensure auth directory: %w", err)
	}

	data, err := json.MarshalIndent(ts, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal token storage: %w", err)
	}

	if err := os.WriteFile(authFilePath, data, 0o600); err != nil {
		return fmt.Errorf("failed to write token file: %w", err)
	}

	return nil
}

// LoadTokenFromFile loads and deserializes a Copilot token storage from a JSON file.
func LoadTokenFromFile(authFilePath string) (*CopilotTokenStorage, error) {
	data, err := os.ReadFile(authFilePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read token file: %w", err)
	}

	var ts CopilotTokenStorage
	if err := json.Unmarshal(data, &ts); err != nil {
		return nil, fmt.Errorf("failed to unmarshal token storage: %w", err)
	}

	return &ts, nil
}
