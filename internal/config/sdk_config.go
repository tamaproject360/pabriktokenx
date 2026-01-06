// Package config provides configuration management for the CLI Proxy API server.
// It handles loading and parsing YAML configuration files, and provides structured
// access to application settings including server port, authentication directory,
// debug settings, proxy configuration, and API keys.
package config

// SDKConfig represents the application's configuration, loaded from a YAML file.
type SDKConfig struct {
	// ProxyURL is the URL of an optional proxy server to use for outbound requests.
	ProxyURL string `yaml:"proxy-url" json:"proxy-url"`

	// ForceModelPrefix requires explicit model prefixes (e.g., "teamA/gemini-3-pro-preview")
	// to target prefixed credentials. When false, unprefixed model requests may use prefixed
	// credentials as well.
	ForceModelPrefix bool `yaml:"force-model-prefix" json:"force-model-prefix"`

	// RequestLog enables or disables detailed request logging functionality.
	RequestLog bool `yaml:"request-log" json:"request-log"`

	// APIKeys is a list of keys for authenticating clients to this proxy server.
	APIKeys []APIKeyEntry `yaml:"api-keys" json:"api-keys"`

	// Access holds request authentication provider configuration.
	Access AccessConfig `yaml:"auth,omitempty" json:"auth,omitempty"`

	// Streaming configures server-side streaming behavior (keep-alives and safe bootstrap retries).
	Streaming StreamingConfig `yaml:"streaming" json:"streaming"`
}

// APIKeyEntry represents a single API key with optional project name.
type APIKeyEntry struct {
	// Key is the actual API key string.
	Key string `yaml:"key,omitempty" json:"key,omitempty"`
	// ProjectName is an optional label/identifier for the project using this key.
	ProjectName string `yaml:"project-name,omitempty" json:"project-name,omitempty"`
}

// UnmarshalYAML implements custom unmarshaling to support both old format ([]string) and new format ([]APIKeyEntry).
func (e *APIKeyEntry) UnmarshalYAML(unmarshal func(interface{}) error) error {
	var s string
	if err := unmarshal(&s); err == nil {
		e.Key = s
		return nil
	}
	type rawEntry APIKeyEntry
	var raw rawEntry
	if err := unmarshal(&raw); err != nil {
		return err
	}
	*e = APIKeyEntry(raw)
	return nil
}

// MarshalYAML implements custom marshaling.
func (e APIKeyEntry) MarshalYAML() (interface{}, error) {
	if e.ProjectName == "" {
		return e.Key, nil
	}
	return map[string]interface{}{
		"key":          e.Key,
		"project-name": e.ProjectName,
	}, nil
}

// StreamingConfig holds server streaming behavior configuration.
type StreamingConfig struct {
	// KeepAliveSeconds controls how often the server emits SSE heartbeats (": keep-alive\n\n").
	// <= 0 disables keep-alives. Default is 0.
	KeepAliveSeconds int `yaml:"keepalive-seconds,omitempty" json:"keepalive-seconds,omitempty"`

	// BootstrapRetries controls how many times the server may retry a streaming request before any bytes are sent,
	// to allow auth rotation / transient recovery.
	// <= 0 disables bootstrap retries. Default is 0.
	BootstrapRetries int `yaml:"bootstrap-retries,omitempty" json:"bootstrap-retries,omitempty"`
}

// AccessConfig groups request authentication providers.
type AccessConfig struct {
	// Providers lists configured authentication providers.
	Providers []AccessProvider `yaml:"providers,omitempty" json:"providers,omitempty"`
}

// AccessProvider describes a request authentication provider entry.
type AccessProvider struct {
	// Name is the instance identifier for the provider.
	Name string `yaml:"name" json:"name"`

	// Type selects the provider implementation registered via the SDK.
	Type string `yaml:"type" json:"type"`

	// SDK optionally names a third-party SDK module providing this provider.
	SDK string `yaml:"sdk,omitempty" json:"sdk,omitempty"`

	// APIKeys lists inline keys for providers that require them.
	APIKeys []string `yaml:"api-keys,omitempty" json:"api-keys,omitempty"`

	// Config passes provider-specific options to the implementation.
	Config map[string]any `yaml:"config,omitempty" json:"config,omitempty"`
}

const (
	// AccessProviderTypeConfigAPIKey is the built-in provider validating inline API keys.
	AccessProviderTypeConfigAPIKey = "config-api-key"

	// DefaultAccessProviderName is applied when no provider name is supplied.
	DefaultAccessProviderName = "config-inline"
)

// ConfigAPIKeyProvider returns the first inline API key provider if present.
func (c *SDKConfig) ConfigAPIKeyProvider() *AccessProvider {
	if c == nil {
		return nil
	}
	for i := range c.Access.Providers {
		if c.Access.Providers[i].Type == AccessProviderTypeConfigAPIKey {
			if c.Access.Providers[i].Name == "" {
				c.Access.Providers[i].Name = DefaultAccessProviderName
			}
			return &c.Access.Providers[i]
		}
	}
	return nil
}

// MakeInlineAPIKeyProvider constructs an inline API key provider configuration.
// It returns nil when no keys are supplied.
func MakeInlineAPIKeyProvider(keys []APIKeyEntry) *AccessProvider {
	if len(keys) == 0 {
		return nil
	}
	// Extract just the key strings for the provider
	keyStrings := make([]string, 0, len(keys))
	for _, entry := range keys {
		keyStrings = append(keyStrings, entry.Key)
	}
	provider := &AccessProvider{
		Name:    DefaultAccessProviderName,
		Type:    AccessProviderTypeConfigAPIKey,
		APIKeys: keyStrings,
	}
	return provider
}
