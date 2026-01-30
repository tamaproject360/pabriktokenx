package antigravity

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"

	"github.com/router-for-me/CLIProxyAPI/v6/internal/config"
	"github.com/router-for-me/CLIProxyAPI/v6/internal/util"
	log "github.com/sirupsen/logrus"
)

// AntigravityAuth handles OAuth2 authentication for Antigravity
type AntigravityAuth struct {
	cfg        *config.Config
	httpClient *http.Client
}

// NewAntigravityAuth creates a new AntigravityAuth instance
func NewAntigravityAuth(cfg *config.Config, httpClient *http.Client) *AntigravityAuth {
	if httpClient == nil && cfg != nil {
		httpClient = util.SetProxy(&cfg.SDKConfig, &http.Client{})
	}
	return &AntigravityAuth{
		cfg:        cfg,
		httpClient: httpClient,
	}
}

// GetClientCredentials returns the OAuth client credentials with environment variable fallback
func GetClientCredentials() (clientID, clientSecret string) {
	clientID = os.Getenv("ANTIGRAVITY_OAUTH_CLIENT_ID")
	if clientID == "" {
		clientID = DefaultClientID
	}
	
	clientSecret = os.Getenv("ANTIGRAVITY_OAUTH_CLIENT_SECRET")
	if clientSecret == "" {
		clientSecret = DefaultClientSecret
	}
	
	return clientID, clientSecret
}

// BuildAuthURL constructs the OAuth authorization URL
func (a *AntigravityAuth) BuildAuthURL(state, redirectURI string) string {
	clientID, _ := GetClientCredentials()
	
	params := url.Values{}
	params.Set("access_type", "offline")
	params.Set("client_id", clientID)
	params.Set("prompt", "consent")
	params.Set("redirect_uri", redirectURI)
	params.Set("response_type", "code")
	params.Set("scope", strings.Join(Scopes, " "))
	params.Set("state", state)
	
	return AuthEndpoint + "?" + params.Encode()
}

// TokenResponse represents the OAuth token response
type TokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int64  `json:"expires_in"`
	TokenType    string `json:"token_type"`
}

// ExchangeCodeForTokens exchanges an authorization code for access and refresh tokens
func (a *AntigravityAuth) ExchangeCodeForTokens(ctx context.Context, code, redirectURI string) (*TokenResponse, error) {
	clientID, clientSecret := GetClientCredentials()
	
	form := url.Values{}
	form.Set("code", code)
	form.Set("client_id", clientID)
	form.Set("client_secret", clientSecret)
	form.Set("redirect_uri", redirectURI)
	form.Set("grant_type", "authorization_code")

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, TokenEndpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, fmt.Errorf("failed to build token request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute token request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("token exchange failed with status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var tokenResp TokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return nil, fmt.Errorf("failed to parse token response: %w", err)
	}

	return &tokenResp, nil
}

// FetchUserInfo retrieves user information using the access token
func (a *AntigravityAuth) FetchUserInfo(ctx context.Context, accessToken string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, UserInfoEndpoint, nil)
	if err != nil {
		return "", fmt.Errorf("failed to build user info request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to execute user info request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("user info request failed with status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var infoPayload struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&infoPayload); err != nil {
		return "", fmt.Errorf("failed to parse user info response: %w", err)
	}

	return strings.TrimSpace(infoPayload.Email), nil
}

// FetchProjectID retrieves the GCP project ID for the authenticated user
func (a *AntigravityAuth) FetchProjectID(ctx context.Context, accessToken string) (string, error) {
	endpoint := fmt.Sprintf("%s/%s/loadCodeAssist", APIEndpoint, APIVersion)
	
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader("{}"))
	if err != nil {
		return "", fmt.Errorf("failed to build project ID request: %w", err)
	}
	
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", APIUserAgent)
	req.Header.Set("X-Goog-Api-Client", APIClient)
	req.Header.Set("X-Goog-Request-Metadata", ClientMetadata)

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to execute project ID request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		bodyBytes, _ := io.ReadAll(resp.Body)
		log.Debugf("project ID request failed with status %d: %s", resp.StatusCode, string(bodyBytes))
		return "", fmt.Errorf("project ID request failed with status %d", resp.StatusCode)
	}

	var result struct {
		ProjectID string `json:"projectId"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("failed to parse project ID response: %w", err)
	}

	return strings.TrimSpace(result.ProjectID), nil
}
