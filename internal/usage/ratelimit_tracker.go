package usage

import (
	"net/http"
	"strconv"
	"sync"
	"time"
)

// RateLimitInfo stores rate limit information for a provider
type RateLimitInfo struct {
	Provider              string    `json:"provider"`
	RequestsLimit         int64     `json:"requests_limit"`
	RequestsRemaining     int64     `json:"requests_remaining"`
	RequestsReset         time.Time `json:"requests_reset"`
	TokensLimit           int64     `json:"tokens_limit"`
	TokensRemaining       int64     `json:"tokens_remaining"`
	TokensReset           time.Time `json:"tokens_reset"`
	InputTokensLimit      int64     `json:"input_tokens_limit,omitempty"`
	InputTokensRemaining  int64     `json:"input_tokens_remaining,omitempty"`
	OutputTokensLimit     int64     `json:"output_tokens_limit,omitempty"`
	OutputTokensRemaining int64     `json:"output_tokens_remaining,omitempty"`
	LastUpdated           time.Time `json:"last_updated"`
}

// RateLimitTracker tracks rate limits across providers
type RateLimitTracker struct {
	mu     sync.RWMutex
	limits map[string]*RateLimitInfo
}

var defaultRateLimitTracker = NewRateLimitTracker()

// NewRateLimitTracker creates a new rate limit tracker
func NewRateLimitTracker() *RateLimitTracker {
	return &RateLimitTracker{
		limits: make(map[string]*RateLimitInfo),
	}
}

// GetRateLimitTracker returns the shared rate limit tracker
func GetRateLimitTracker() *RateLimitTracker {
	return defaultRateLimitTracker
}

// TrackOpenAIHeaders extracts and stores OpenAI rate limit headers
func (t *RateLimitTracker) TrackOpenAIHeaders(headers http.Header) {
	info := &RateLimitInfo{
		Provider:    "openai",
		LastUpdated: time.Now(),
	}

	if v := headers.Get("x-ratelimit-limit-requests"); v != "" {
		info.RequestsLimit = parseInt64(v)
	}
	if v := headers.Get("x-ratelimit-remaining-requests"); v != "" {
		info.RequestsRemaining = parseInt64(v)
	}
	if v := headers.Get("x-ratelimit-reset-requests"); v != "" {
		info.RequestsReset = parseTime(v)
	}
	if v := headers.Get("x-ratelimit-limit-tokens"); v != "" {
		info.TokensLimit = parseInt64(v)
	}
	if v := headers.Get("x-ratelimit-remaining-tokens"); v != "" {
		info.TokensRemaining = parseInt64(v)
	}
	if v := headers.Get("x-ratelimit-reset-tokens"); v != "" {
		info.TokensReset = parseTime(v)
	}

	t.mu.Lock()
	t.limits["openai"] = info
	t.mu.Unlock()
}

// TrackAnthropicHeaders extracts and stores Anthropic rate limit headers
func (t *RateLimitTracker) TrackAnthropicHeaders(headers http.Header) {
	info := &RateLimitInfo{
		Provider:    "anthropic",
		LastUpdated: time.Now(),
	}

	// Standard rate limits
	if v := headers.Get("anthropic-ratelimit-requests-limit"); v != "" {
		info.RequestsLimit = parseInt64(v)
	}
	if v := headers.Get("anthropic-ratelimit-requests-remaining"); v != "" {
		info.RequestsRemaining = parseInt64(v)
	}
	if v := headers.Get("anthropic-ratelimit-requests-reset"); v != "" {
		info.RequestsReset = parseTime(v)
	}
	if v := headers.Get("anthropic-ratelimit-tokens-limit"); v != "" {
		info.TokensLimit = parseInt64(v)
	}
	if v := headers.Get("anthropic-ratelimit-tokens-remaining"); v != "" {
		info.TokensRemaining = parseInt64(v)
	}
	if v := headers.Get("anthropic-ratelimit-tokens-reset"); v != "" {
		info.TokensReset = parseTime(v)
	}

	// Priority tier limits
	if v := headers.Get("anthropic-priority-input-tokens-limit"); v != "" {
		info.InputTokensLimit = parseInt64(v)
	}
	if v := headers.Get("anthropic-priority-input-tokens-remaining"); v != "" {
		info.InputTokensRemaining = parseInt64(v)
	}
	if v := headers.Get("anthropic-priority-output-tokens-limit"); v != "" {
		info.OutputTokensLimit = parseInt64(v)
	}
	if v := headers.Get("anthropic-priority-output-tokens-remaining"); v != "" {
		info.OutputTokensRemaining = parseInt64(v)
	}

	t.mu.Lock()
	t.limits["anthropic"] = info
	t.mu.Unlock()
}

// TrackGeminiHeaders extracts and stores Google Gemini rate limit headers
func (t *RateLimitTracker) TrackGeminiHeaders(headers http.Header) {
	info := &RateLimitInfo{
		Provider:    "google",
		LastUpdated: time.Now(),
	}

	// Gemini uses X-Goog-RateLimit headers
	if v := headers.Get("X-Goog-RateLimit-Limit"); v != "" {
		info.RequestsLimit = parseInt64(v)
	}
	if v := headers.Get("X-Goog-RateLimit-Remaining"); v != "" {
		info.RequestsRemaining = parseInt64(v)
	}

	t.mu.Lock()
	t.limits["google"] = info
	t.mu.Unlock()
}

// GetRateLimits returns all tracked rate limits
func (t *RateLimitTracker) GetRateLimits() map[string]*RateLimitInfo {
	t.mu.RLock()
	defer t.mu.RUnlock()

	result := make(map[string]*RateLimitInfo, len(t.limits))
	for k, v := range t.limits {
		if v != nil {
			copy := *v
			result[k] = &copy
		}
	}
	return result
}

// GetProviderLimit returns rate limit info for a specific provider
func (t *RateLimitTracker) GetProviderLimit(provider string) *RateLimitInfo {
	t.mu.RLock()
	defer t.mu.RUnlock()

	if info, ok := t.limits[provider]; ok {
		copy := *info
		return &copy
	}
	return nil
}

func parseInt64(s string) int64 {
	v, _ := strconv.ParseInt(s, 10, 64)
	return v
}

func parseTime(s string) time.Time {
	// Try RFC3339 format first
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t
	}
	// Try Unix timestamp
	if ts, err := strconv.ParseInt(s, 10, 64); err == nil {
		return time.Unix(ts, 0)
	}
	return time.Time{}
}
