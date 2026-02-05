package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	kiroauth "github.com/router-for-me/CLIProxyAPI/v6/internal/auth/kiro"
	"github.com/router-for-me/CLIProxyAPI/v6/internal/config"
	coreauth "github.com/router-for-me/CLIProxyAPI/v6/sdk/cliproxy/auth"
)

// extractKiroIdentifier extracts a meaningful identifier for file naming.
func extractKiroIdentifier(accountName, profileArn, clientID string) string {
	// Priority 1: Use account name if provided
	if accountName != "" {
		return kiroauth.SanitizeEmailForFilename(accountName)
	}

	// Priority 2: Use profile ARN ID part
	if profileArn != "" {
		parts := strings.Split(profileArn, "/")
		if len(parts) >= 2 {
			return kiroauth.SanitizeEmailForFilename(parts[len(parts)-1])
		}
	}

	// Priority 3: Use client ID
	if clientID != "" {
		return kiroauth.SanitizeEmailForFilename(clientID)
	}

	// Fallback: timestamp
	return fmt.Sprintf("%d", time.Now().UnixNano()%100000)
}

// KiroAuthenticator implements OAuth authentication for Kiro.
type KiroAuthenticator struct{}

// NewKiroAuthenticator constructs a Kiro authenticator.
func NewKiroAuthenticator() *KiroAuthenticator {
	return &KiroAuthenticator{}
}

// Provider returns the provider key for the authenticator.
func (a *KiroAuthenticator) Provider() string {
	return "kiro"
}

// RefreshLead indicates how soon before expiry a refresh should be attempted.
func (a *KiroAuthenticator) RefreshLead() *time.Duration {
	d := 20 * time.Minute
	return &d
}

// createAuthRecord creates an auth record from token data.
func (a *KiroAuthenticator) createAuthRecord(tokenData *kiroauth.KiroTokenData, source string) (*coreauth.Auth, error) {
	// Parse expires_at
	expiresAt, err := time.Parse(time.RFC3339, tokenData.ExpiresAt)
	if err != nil {
		expiresAt = time.Now().Add(1 * time.Hour)
	}

	// Determine label and identifier based on auth method
	seq := time.Now().UnixNano() % 100000
	var label, idPart string

	if tokenData.AuthMethod == "idc" {
		label = "kiro-idc"
		if tokenData.Email != "" {
			idPart = kiroauth.SanitizeEmailForFilename(tokenData.Email)
		} else {
			idPart = fmt.Sprintf("%05d", seq)
		}
	} else {
		label = fmt.Sprintf("kiro-%s", source)
		idPart = extractKiroIdentifier(tokenData.Email, tokenData.ProfileArn, tokenData.ClientID)
	}

	now := time.Now()
	fileName := fmt.Sprintf("%s-%s.json", label, idPart)

	// Create token storage
	storage := &kiroauth.KiroTokenStorage{
		AccessToken:  tokenData.AccessToken,
		RefreshToken: tokenData.RefreshToken,
		ProfileArn:   tokenData.ProfileArn,
		ExpiresAt:    tokenData.ExpiresAt,
		AuthMethod:   tokenData.AuthMethod,
		Provider:     tokenData.Provider,
		ClientID:     tokenData.ClientID,
		ClientSecret: tokenData.ClientSecret,
		ClientIDHash: tokenData.ClientIDHash,
		Email:        tokenData.Email,
		Region:       tokenData.Region,
		StartURL:     tokenData.StartURL,
		Type:         "kiro",
	}

	metadata := map[string]any{
		"type":          "kiro",
		"access_token":  tokenData.AccessToken,
		"refresh_token": tokenData.RefreshToken,
		"profile_arn":   tokenData.ProfileArn,
		"expires_at":    tokenData.ExpiresAt,
		"auth_method":   tokenData.AuthMethod,
		"provider":      tokenData.Provider,
		"client_id":     tokenData.ClientID,
		"client_secret": tokenData.ClientSecret,
		"email":         tokenData.Email,
	}

	// Add IDC-specific fields if present
	if tokenData.StartURL != "" {
		metadata["start_url"] = tokenData.StartURL
	}
	if tokenData.Region != "" {
		metadata["region"] = tokenData.Region
	}

	attributes := map[string]string{
		"profile_arn": tokenData.ProfileArn,
		"source":      source,
		"email":       tokenData.Email,
	}

	// Add IDC-specific attributes if present
	if tokenData.AuthMethod == "idc" {
		attributes["source"] = "aws-idc"
		if tokenData.StartURL != "" {
			attributes["start_url"] = tokenData.StartURL
		}
		if tokenData.Region != "" {
			attributes["region"] = tokenData.Region
		}
	}

	record := &coreauth.Auth{
		ID:               fileName,
		Provider:         "kiro",
		FileName:         fileName,
		Label:            label,
		Status:           coreauth.StatusActive,
		CreatedAt:        now,
		UpdatedAt:        now,
		Metadata:         metadata,
		Attributes:       attributes,
		Storage:          storage,
		NextRefreshAfter: expiresAt.Add(-20 * time.Minute),
	}

	if tokenData.Email != "" {
		fmt.Printf("\n✓ Kiro authentication completed successfully! (Account: %s)\n", tokenData.Email)
	} else {
		fmt.Println("\n✓ Kiro authentication completed successfully!")
	}

	return record, nil
}

// Login performs OAuth login for Kiro with social providers.
func (a *KiroAuthenticator) Login(ctx context.Context, cfg *config.Config, opts *LoginOptions) (*coreauth.Auth, error) {
	if cfg == nil {
		return nil, fmt.Errorf("kiro auth: configuration is required")
	}

	// Default to Google login
	provider := "google"
	if opts != nil && opts.Metadata != nil {
		if p, ok := opts.Metadata["provider"]; ok {
			provider = strings.ToLower(p)
		}
	}

	socialClient := kiroauth.NewSocialAuthClient(cfg)

	var tokenData *kiroauth.KiroTokenData
	var err error

	switch provider {
	case "google":
		tokenData, err = socialClient.LoginWithGoogle(ctx)
	case "github":
		tokenData, err = socialClient.LoginWithGitHub(ctx)
	default:
		return nil, fmt.Errorf("unsupported provider: %s (supported: google, github)", provider)
	}

	if err != nil {
		return nil, fmt.Errorf("login failed: %w", err)
	}

	return a.createAuthRecord(tokenData, provider)
}

// LoginWithGoogle performs OAuth login for Kiro with Google.
func (a *KiroAuthenticator) LoginWithGoogle(ctx context.Context, cfg *config.Config, opts *LoginOptions) (*coreauth.Auth, error) {
	if cfg == nil {
		return nil, fmt.Errorf("kiro auth: configuration is required")
	}

	socialClient := kiroauth.NewSocialAuthClient(cfg)
	tokenData, err := socialClient.LoginWithGoogle(ctx)
	if err != nil {
		return nil, fmt.Errorf("login failed: %w", err)
	}

	return a.createAuthRecord(tokenData, "google")
}

// LoginWithGitHub performs OAuth login for Kiro with GitHub.
func (a *KiroAuthenticator) LoginWithGitHub(ctx context.Context, cfg *config.Config, opts *LoginOptions) (*coreauth.Auth, error) {
	if cfg == nil {
		return nil, fmt.Errorf("kiro auth: configuration is required")
	}

	socialClient := kiroauth.NewSocialAuthClient(cfg)
	tokenData, err := socialClient.LoginWithGitHub(ctx)
	if err != nil {
		return nil, fmt.Errorf("login failed: %w", err)
	}

	return a.createAuthRecord(tokenData, "github")
}

// ImportFromKiroIDE imports token from Kiro IDE's token file.
func (a *KiroAuthenticator) ImportFromKiroIDE(ctx context.Context, cfg *config.Config) (*coreauth.Auth, error) {
	tokenData, err := kiroauth.LoadKiroIDEToken()
	if err != nil {
		return nil, fmt.Errorf("failed to load Kiro IDE token: %w", err)
	}

	// Parse expires_at
	expiresAt, err := time.Parse(time.RFC3339, tokenData.ExpiresAt)
	if err != nil {
		expiresAt = time.Now().Add(1 * time.Hour)
	}

	// Extract email from JWT if not already set
	if tokenData.Email == "" {
		tokenData.Email = kiroauth.ExtractEmailFromJWT(tokenData.AccessToken)
	}

	// Extract identifier for file naming
	idPart := extractKiroIdentifier(tokenData.Email, tokenData.ProfileArn, tokenData.ClientID)

	// Sanitize provider
	provider := kiroauth.SanitizeEmailForFilename(strings.ToLower(strings.TrimSpace(tokenData.Provider)))
	if provider == "" {
		provider = "imported"
	}

	now := time.Now()
	fileName := fmt.Sprintf("kiro-%s-%s.json", provider, idPart)

	// Create token storage
	storage := &kiroauth.KiroTokenStorage{
		AccessToken:  tokenData.AccessToken,
		RefreshToken: tokenData.RefreshToken,
		ProfileArn:   tokenData.ProfileArn,
		ExpiresAt:    tokenData.ExpiresAt,
		AuthMethod:   tokenData.AuthMethod,
		Provider:     tokenData.Provider,
		ClientID:     tokenData.ClientID,
		ClientSecret: tokenData.ClientSecret,
		ClientIDHash: tokenData.ClientIDHash,
		Email:        tokenData.Email,
		Region:       tokenData.Region,
		StartURL:     tokenData.StartURL,
		Type:         "kiro",
	}

	record := &coreauth.Auth{
		ID:       fileName,
		Provider: "kiro",
		FileName: fileName,
		Label:    fmt.Sprintf("kiro-%s", provider),
		Status:   coreauth.StatusActive,
		CreatedAt: now,
		UpdatedAt: now,
		Metadata: map[string]any{
			"type":            "kiro",
			"access_token":    tokenData.AccessToken,
			"refresh_token":   tokenData.RefreshToken,
			"profile_arn":     tokenData.ProfileArn,
			"expires_at":      tokenData.ExpiresAt,
			"auth_method":     tokenData.AuthMethod,
			"provider":        tokenData.Provider,
			"client_id":       tokenData.ClientID,
			"client_secret":   tokenData.ClientSecret,
			"client_id_hash":  tokenData.ClientIDHash,
			"email":           tokenData.Email,
			"region":          tokenData.Region,
			"start_url":       tokenData.StartURL,
		},
		Attributes: map[string]string{
			"profile_arn": tokenData.ProfileArn,
			"source":      "kiro-ide-import",
			"email":       tokenData.Email,
			"region":      tokenData.Region,
		},
		Storage:          storage,
		NextRefreshAfter: expiresAt.Add(-20 * time.Minute),
	}

	// Display the email if extracted
	if tokenData.Email != "" {
		fmt.Printf("\n✓ Imported Kiro token from IDE (Provider: %s, Account: %s)\n", tokenData.Provider, tokenData.Email)
	} else {
		fmt.Printf("\n✓ Imported Kiro token from IDE (Provider: %s)\n", tokenData.Provider)
	}

	return record, nil
}

// Refresh refreshes an expired Kiro token.
func (a *KiroAuthenticator) Refresh(ctx context.Context, cfg *config.Config, auth *coreauth.Auth) (*coreauth.Auth, error) {
	if auth == nil || auth.Metadata == nil {
		return nil, fmt.Errorf("invalid auth record")
	}

	refreshToken, ok := auth.Metadata["refresh_token"].(string)
	if !ok || refreshToken == "" {
		return nil, fmt.Errorf("refresh token not found")
	}

	socialClient := kiroauth.NewSocialAuthClient(cfg)
	tokenData, err := socialClient.RefreshSocialToken(ctx, refreshToken)
	if err != nil {
		return nil, fmt.Errorf("token refresh failed: %w", err)
	}

	// Parse expires_at
	expiresAt, err := time.Parse(time.RFC3339, tokenData.ExpiresAt)
	if err != nil {
		expiresAt = time.Now().Add(1 * time.Hour)
	}

	// Clone auth to avoid mutating the input parameter
	updated := auth.Clone()
	now := time.Now()

	updated.UpdatedAt = now
	updated.LastRefreshedAt = now
	updated.Metadata["access_token"] = tokenData.AccessToken
	updated.Metadata["refresh_token"] = tokenData.RefreshToken
	updated.Metadata["expires_at"] = tokenData.ExpiresAt
	updated.Metadata["last_refresh"] = now.Format(time.RFC3339)
	updated.NextRefreshAfter = expiresAt.Add(-20 * time.Minute)

	return updated, nil
}

// loadDeviceRegistrationCredentials loads clientId and clientSecret from device registration file.
func loadDeviceRegistrationCredentials(clientIDHash string) (clientID, clientSecret string, err error) {
	if clientIDHash == "" {
		return "", "", fmt.Errorf("clientIdHash is empty")
	}

	// Sanitize clientIdHash to prevent path traversal
	if strings.Contains(clientIDHash, "/") || strings.Contains(clientIDHash, "\\") || strings.Contains(clientIDHash, "..") {
		return "", "", fmt.Errorf("invalid clientIdHash: contains path separator")
	}

	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", "", fmt.Errorf("failed to get home directory: %w", err)
	}

	deviceRegPath := filepath.Join(homeDir, ".aws", "sso", "cache", clientIDHash+".json")
	data, err := os.ReadFile(deviceRegPath)
	if err != nil {
		return "", "", fmt.Errorf("failed to read device registration file: %w", err)
	}

	var deviceReg struct {
		ClientID     string `json:"clientId"`
		ClientSecret string `json:"clientSecret"`
	}

	if err := json.Unmarshal(data, &deviceReg); err != nil {
		return "", "", fmt.Errorf("failed to parse device registration: %w", err)
	}

	if deviceReg.ClientID == "" || deviceReg.ClientSecret == "" {
		return "", "", fmt.Errorf("device registration missing clientId or clientSecret")
	}

	return deviceReg.ClientID, deviceReg.ClientSecret, nil
}
