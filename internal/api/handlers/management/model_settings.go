package management

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/router-for-me/CLIProxyAPI/v6/internal/config"
	runtimeexecutor "github.com/router-for-me/CLIProxyAPI/v6/internal/runtime/executor"
	coreauth "github.com/router-for-me/CLIProxyAPI/v6/sdk/cliproxy/auth"
	cliproxyexecutor "github.com/router-for-me/CLIProxyAPI/v6/sdk/cliproxy/executor"
	sdktranslator "github.com/router-for-me/CLIProxyAPI/v6/sdk/translator"
	log "github.com/sirupsen/logrus"
)

const (
	defaultModelTestTimeout   = 25 * time.Second
	maxModelTestPreviewLength = 900
)

// ModelSetting represents the configuration for a single model
type ModelSetting struct {
	ModelID     string `json:"model_id"`
	DisplayName string `json:"display_name,omitempty"`
	Provider    string `json:"provider"`
	AuthFile    string `json:"auth_file"`
	Enabled     bool   `json:"enabled"`
	Removed     bool   `json:"removed,omitempty"`
}

// ModelSettingsConfig represents the full model settings configuration (old format - for backward compatibility)
type ModelSettingsConfig struct {
	Models map[string]ModelSetting `json:"models"` // key is "authFile:modelId"
}

// ProviderModelConfig represents model configuration within a provider
type ProviderModelConfig struct {
	DisplayName string `json:"display_name"`
	Enabled     bool   `json:"enabled"`
	Removed     bool   `json:"removed,omitempty"`
}

// ProviderConfig represents a provider with its auth files and models
type ProviderConfig struct {
	AuthFiles []string                        `json:"auth_files"`
	Models    map[string]ProviderModelConfig  `json:"models"` // key is modelId
}

// NewModelSettingsConfig represents the new provider-based configuration
type NewModelSettingsConfig struct {
	Providers map[string]ProviderConfig `json:",inline"` // provider name as key
}

var (
	modelSettingsMu   sync.RWMutex
	modelSettingsPath string
)

func getModelSettingsPath() string {
	if modelSettingsPath != "" {
		return modelSettingsPath
	}
	// Default to current directory
	return filepath.Join(".", "model_settings.json")
}

// SetModelSettingsPath allows configuring where model settings are stored
func SetModelSettingsPath(path string) {
	modelSettingsMu.Lock()
	defer modelSettingsMu.Unlock()
	modelSettingsPath = path
}

func loadModelSettings() (*ModelSettingsConfig, error) {
	modelSettingsMu.RLock()
	defer modelSettingsMu.RUnlock()

	path := getModelSettingsPath()
	log.WithField("path", path).Info("[model_settings] loading settings from path")
	
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			log.Info("[model_settings] file does not exist, returning empty config")
			// Return empty config if file doesn't exist
			return &ModelSettingsConfig{
				Models: make(map[string]ModelSetting),
			}, nil
		}
		log.WithField("error", err.Error()).Error("[model_settings] error reading file")
		return nil, err
	}

	log.WithField("size", len(data)).Info("[model_settings] file loaded, parsing JSON")
	log.WithField("raw_preview", string(data[:200])).Debug("[model_settings] JSON preview")

	// Try to parse as new format first
	var newConfig map[string]ProviderConfig
	unmarshalErr := json.Unmarshal(data, &newConfig)
	if unmarshalErr == nil {
		// Check if it's new format by checking for auth_files and models keys
		isNewFormat := false
		for _, providerConfig := range newConfig {
			if providerConfig.AuthFiles != nil && providerConfig.Models != nil {
				isNewFormat = true
				break
			}
		}

		if isNewFormat {
			log.WithField("providers", len(newConfig)).Info("[model_settings] detected new format")
			// Convert new format to old format for backward compatibility
			oldConfig := &ModelSettingsConfig{
				Models: make(map[string]ModelSetting),
			}

			for providerName, providerConfig := range newConfig {
				log.WithFields(log.Fields{
					"provider": providerName,
					"auth_files": len(providerConfig.AuthFiles),
					"models": len(providerConfig.Models),
				}).Debug("[model_settings] processing provider")
				
				for _, authFile := range providerConfig.AuthFiles {
					for modelID, modelConfig := range providerConfig.Models {
						key := authFile + ":" + modelID
						oldConfig.Models[key] = ModelSetting{
							ModelID:     modelID,
							DisplayName: modelConfig.DisplayName,
							Provider:    providerName,
							AuthFile:    authFile,
							Enabled:     modelConfig.Enabled,
							Removed:     modelConfig.Removed,
						}
					}
				}
			}

			log.WithField("total_models", len(oldConfig.Models)).Info("[model_settings] conversion complete")
			return oldConfig, nil
		}
	} else {
		log.Warnf("[model_settings] failed to parse new format: %v, trying old format", unmarshalErr)
	}

	// Fall back to old format
	var config ModelSettingsConfig
	if err := json.Unmarshal(data, &config); err != nil {
		log.Errorf("[model_settings] failed to parse old format too: %v", err)
		return nil, err
	}

	log.Info("[model_settings] parsed as old format")

	if config.Models == nil {
		config.Models = make(map[string]ModelSetting)
	}

	return &config, nil
}

func saveModelSettings(config *ModelSettingsConfig) error {
	modelSettingsMu.Lock()
	defer modelSettingsMu.Unlock()

	// Convert old format to new format (per provider)
	newConfig := make(map[string]ProviderConfig)

	for _, setting := range config.Models {
		provider := setting.Provider
		if provider == "" {
			provider = "unknown"
		}

		// Initialize provider if doesn't exist
		if _, exists := newConfig[provider]; !exists {
			newConfig[provider] = ProviderConfig{
				AuthFiles: []string{},
				Models:    make(map[string]ProviderModelConfig),
			}
		}

		providerConfig := newConfig[provider]

		// Add auth file if not already in list
		authFileExists := false
		for _, af := range providerConfig.AuthFiles {
			if af == setting.AuthFile {
				authFileExists = true
				break
			}
		}
		if !authFileExists {
			providerConfig.AuthFiles = append(providerConfig.AuthFiles, setting.AuthFile)
		}

		// Add or update model
		providerConfig.Models[setting.ModelID] = ProviderModelConfig{
			DisplayName: setting.DisplayName,
			Enabled:     setting.Enabled,
			Removed:     setting.Removed,
		}

		newConfig[provider] = providerConfig
	}

	path := getModelSettingsPath()
	data, err := json.MarshalIndent(newConfig, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(path, data, 0644)
}

// GetModelSettings returns all model settings
func (h *Handler) GetModelSettings(c *gin.Context) {
	config, err := loadModelSettings()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to load model settings: " + err.Error(),
		})
		return
	}

	// Convert map to array for frontend convenience
	models := make([]ModelSetting, 0, len(config.Models))
	for _, model := range config.Models {
		models = append(models, model)
	}

	c.JSON(http.StatusOK, gin.H{
		"models": models,
	})
}

// UpdateModelSettings updates the settings for a single model
func (h *Handler) UpdateModelSettings(c *gin.Context) {
	var req struct {
		ModelID     string `json:"model_id"`
		DisplayName string `json:"display_name,omitempty"`
		Provider    string `json:"provider"`
		AuthFile    string `json:"auth_file"`
		Enabled     bool   `json:"enabled"`
		Removed     bool   `json:"removed,omitempty"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body: " + err.Error(),
		})
		return
	}

	if req.ModelID == "" || req.AuthFile == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "model_id and auth_file are required",
		})
		return
	}

	config, err := loadModelSettings()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to load model settings: " + err.Error(),
		})
		return
	}

	// Create unique key for the model
	key := req.AuthFile + ":" + req.ModelID

	config.Models[key] = ModelSetting{
		ModelID:     req.ModelID,
		DisplayName: req.DisplayName,
		Provider:    req.Provider,
		AuthFile:    req.AuthFile,
		Enabled:     req.Enabled,
		Removed:     req.Removed,
	}

	if err := saveModelSettings(config); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to save model settings: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "model settings updated",
		"model":   config.Models[key],
	})
}

// BulkUpdateModelSettings updates multiple model settings at once
func (h *Handler) BulkUpdateModelSettings(c *gin.Context) {
	var req struct {
		Models []ModelSetting `json:"models"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body: " + err.Error(),
		})
		return
	}

	config, err := loadModelSettings()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to load model settings: " + err.Error(),
		})
		return
	}

	for _, model := range req.Models {
		if model.ModelID == "" || model.AuthFile == "" {
			continue
		}
		key := model.AuthFile + ":" + model.ModelID
		config.Models[key] = model
	}

	if err := saveModelSettings(config); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to save model settings: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "model settings updated",
		"count":   len(req.Models),
	})
}

// IsModelEnabled checks if a specific model is enabled
// Returns true if not configured (default enabled)
func IsModelEnabled(authFile, modelID string) bool {
	config, err := loadModelSettings()
	if err != nil {
		return true // Default to enabled on error
	}

	key := authFile + ":" + modelID
	if setting, exists := config.Models[key]; exists {
		if setting.Removed {
			return false
		}
		return setting.Enabled
	}

	return true // Default to enabled if not configured
}

// GetEnabledModels returns a list of enabled model IDs for filtering
func GetEnabledModels() map[string]bool {
	config, err := loadModelSettings()
	if err != nil {
		return nil
	}

	enabled := make(map[string]bool)
	for key, setting := range config.Models {
		if setting.Removed {
			enabled[key] = false
			continue
		}
		enabled[key] = setting.Enabled
	}

	return enabled
}

func authFileCandidateKeys(authFile, modelID string) []string {
	authFile = strings.TrimSpace(authFile)
	modelID = strings.TrimSpace(modelID)
	if authFile == "" || modelID == "" {
		return nil
	}

	candidates := []string{authFile + ":" + modelID}
	base := filepath.Base(authFile)
	if base != "" && base != authFile {
		candidates = append(candidates, base+":"+modelID)
	}
	return candidates
}

// IsModelRemoved checks if a model has been hidden from Model Settings for a specific auth file.
func IsModelRemoved(authFile, modelID string) bool {
	config, err := loadModelSettings()
	if err != nil {
		return false
	}

	for _, key := range authFileCandidateKeys(authFile, modelID) {
		if setting, exists := config.Models[key]; exists {
			return setting.Removed
		}
	}
	return false
}

func normalizeModelID(modelID string) string {
	normalized := strings.ToLower(strings.TrimSpace(modelID))
	normalized = strings.TrimPrefix(normalized, "models/")
	return normalized
}

// IsModelGloballyRemoved checks whether a model has been removed in any auth file configuration.
func IsModelGloballyRemoved(modelID string) bool {
	config, err := loadModelSettings()
	if err != nil {
		return false
	}

	needle := normalizeModelID(modelID)
	if needle == "" {
		return false
	}

	hasRemoved := false
	for _, setting := range config.Models {
		if normalizeModelID(setting.ModelID) != needle {
			continue
		}
		if !setting.Removed {
			// At least one active entry means this model should still be available globally.
			return false
		}
		hasRemoved = true
	}

	return hasRemoved
}

// GetConfiguredModelsForAuthFiles returns manually configured models for one or more auth files.
func GetConfiguredModelsForAuthFiles(authFiles ...string) []ModelSetting {
	config, err := loadModelSettings()
	if err != nil {
		return nil
	}

	authSet := make(map[string]struct{}, len(authFiles)*2)
	for _, authFile := range authFiles {
		trimmed := strings.TrimSpace(authFile)
		if trimmed == "" {
			continue
		}
		authSet[trimmed] = struct{}{}
		base := filepath.Base(trimmed)
		if base != "" {
			authSet[base] = struct{}{}
		}
	}

	result := make([]ModelSetting, 0)
	for _, model := range config.Models {
		if model.Removed {
			continue
		}
		if _, ok := authSet[model.AuthFile]; !ok {
			continue
		}
		result = append(result, model)
	}

	return result
}

func normalizeProvider(provider string) string {
	return strings.ToLower(strings.TrimSpace(provider))
}

func firstNonEmptyValue(values ...string) string {
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func (h *Handler) resolveProviderForScope(config *ModelSettingsConfig, provider string, authFile string, modelID string) string {
	resolved := normalizeProvider(provider)
	if resolved != "" {
		return resolved
	}

	authFile = strings.TrimSpace(authFile)
	if authFile != "" {
		if auth := h.findAuthByFile(authFile); auth != nil {
			if inferred := normalizeProvider(auth.Provider); inferred != "" {
				return inferred
			}
		}
	}

	if config != nil {
		for _, key := range authFileCandidateKeys(authFile, modelID) {
			if setting, exists := config.Models[key]; exists {
				if inferred := normalizeProvider(setting.Provider); inferred != "" {
					return inferred
				}
			}
		}
	}

	return ""
}

func (h *Handler) collectScopedAuthFiles(config *ModelSettingsConfig, provider string, preferredAuthFile string) []string {
	provider = normalizeProvider(provider)
	seen := make(map[string]struct{})
	authFiles := make([]string, 0)

	push := func(name string) {
		trimmed := strings.TrimSpace(name)
		if trimmed == "" {
			return
		}
		if _, exists := seen[trimmed]; exists {
			return
		}
		seen[trimmed] = struct{}{}
		authFiles = append(authFiles, trimmed)
	}

	if h != nil && h.authManager != nil {
		for _, auth := range h.authManager.List() {
			if auth == nil {
				continue
			}
			if provider != "" && normalizeProvider(auth.Provider) != provider {
				continue
			}
			push(firstNonEmptyValue(auth.FileName, auth.ID))
		}
	}

	if config != nil {
		for _, setting := range config.Models {
			if provider != "" && normalizeProvider(setting.Provider) != provider {
				continue
			}
			push(setting.AuthFile)
		}
	}

	push(preferredAuthFile)
	return authFiles
}

// AddModelSetting adds a model entry so it can be managed from Model Settings.
func (h *Handler) AddModelSetting(c *gin.Context) {
	var req struct {
		ModelID     string `json:"model_id"`
		DisplayName string `json:"display_name,omitempty"`
		Provider    string `json:"provider,omitempty"`
		AuthFile    string `json:"auth_file,omitempty"`
		Enabled     *bool  `json:"enabled,omitempty"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body: " + err.Error()})
		return
	}

	req.ModelID = strings.TrimSpace(req.ModelID)
	req.AuthFile = strings.TrimSpace(req.AuthFile)
	req.Provider = normalizeProvider(req.Provider)
	req.DisplayName = strings.TrimSpace(req.DisplayName)
	if req.ModelID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "model_id is required"})
		return
	}

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	config, err := loadModelSettings()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load model settings: " + err.Error()})
		return
	}

	if req.Provider == "" {
		req.Provider = h.resolveProviderForScope(config, req.Provider, req.AuthFile, req.ModelID)
	}
	if req.Provider == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "provider is required when auth_file cannot infer provider"})
		return
	}

	targetAuthFiles := h.collectScopedAuthFiles(config, req.Provider, req.AuthFile)
	if len(targetAuthFiles) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no auth files found for provider scope"})
		return
	}

	displayName := req.DisplayName
	if displayName == "" {
		displayName = req.ModelID
	}

	var firstKey string
	affected := 0
	for _, authFile := range targetAuthFiles {
		key := authFile + ":" + req.ModelID
		config.Models[key] = ModelSetting{
			ModelID:     req.ModelID,
			DisplayName: displayName,
			Provider:    req.Provider,
			AuthFile:    authFile,
			Enabled:     enabled,
			Removed:     false,
		}
		if firstKey == "" {
			firstKey = key
		}
		affected++
	}

	if err := saveModelSettings(config); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save model settings: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "model added for provider scope",
		"model":    config.Models[firstKey],
		"affected": affected,
	})
}

// RemoveModelSetting hides a model from Model Settings and Playground selection for the specified auth file.
func (h *Handler) RemoveModelSetting(c *gin.Context) {
	var req struct {
		ModelID  string `json:"model_id"`
		Provider string `json:"provider,omitempty"`
		AuthFile string `json:"auth_file"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body: " + err.Error()})
		return
	}

	req.ModelID = strings.TrimSpace(req.ModelID)
	req.AuthFile = strings.TrimSpace(req.AuthFile)
	req.Provider = strings.TrimSpace(req.Provider)
	if req.ModelID == "" || req.AuthFile == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "model_id and auth_file are required"})
		return
	}

	config, err := loadModelSettings()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load model settings: " + err.Error()})
		return
	}

	normalizedModel := normalizeModelID(req.ModelID)
	normalizedProvider := strings.ToLower(strings.TrimSpace(req.Provider))

	applyRemoved := func(key string, setting ModelSetting) {
		setting.ModelID = strings.TrimSpace(setting.ModelID)
		if setting.ModelID == "" {
			setting.ModelID = req.ModelID
		}
		setting.AuthFile = strings.TrimSpace(setting.AuthFile)
		if setting.AuthFile == "" {
			setting.AuthFile = req.AuthFile
		}
		if strings.TrimSpace(setting.Provider) == "" {
			setting.Provider = req.Provider
		}
		if strings.TrimSpace(setting.DisplayName) == "" {
			setting.DisplayName = setting.ModelID
		}
		setting.Enabled = false
		setting.Removed = true
		config.Models[key] = setting
	}

	applied := 0
	for key, setting := range config.Models {
		if normalizeModelID(setting.ModelID) != normalizedModel {
			continue
		}
		if normalizedProvider != "" {
			settingProvider := strings.ToLower(strings.TrimSpace(setting.Provider))
			if settingProvider != "" && settingProvider != normalizedProvider {
				continue
			}
		}
		applyRemoved(key, setting)
		applied++
	}

	if h != nil && h.authManager != nil {
		for _, auth := range h.authManager.List() {
			if auth == nil {
				continue
			}
			authProvider := strings.ToLower(strings.TrimSpace(auth.Provider))
			if normalizedProvider != "" && authProvider != normalizedProvider {
				continue
			}
			authName := strings.TrimSpace(auth.FileName)
			if authName == "" {
				authName = strings.TrimSpace(auth.ID)
			}
			if authName == "" {
				continue
			}
			key := authName + ":" + req.ModelID
			applyRemoved(key, config.Models[key])
			applied++
		}
	}

	if applied == 0 {
		key := req.AuthFile + ":" + req.ModelID
		applyRemoved(key, config.Models[key])
	}

	if err := saveModelSettings(config); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save model settings: " + err.Error()})
		return
	}

	key := req.AuthFile + ":" + req.ModelID
	current := config.Models[key]
	c.JSON(http.StatusOK, gin.H{"message": "model removed", "model": current, "affected": applied})
}

// RestoreModelSetting restores a previously removed model for the specified auth file.
func (h *Handler) RestoreModelSetting(c *gin.Context) {
	var req struct {
		ModelID     string `json:"model_id"`
		DisplayName string `json:"display_name,omitempty"`
		Provider    string `json:"provider,omitempty"`
		AuthFile    string `json:"auth_file"`
		Enabled     *bool  `json:"enabled,omitempty"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body: " + err.Error()})
		return
	}

	req.ModelID = strings.TrimSpace(req.ModelID)
	req.DisplayName = strings.TrimSpace(req.DisplayName)
	req.Provider = strings.TrimSpace(req.Provider)
	req.AuthFile = strings.TrimSpace(req.AuthFile)
	if req.ModelID == "" || req.AuthFile == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "model_id and auth_file are required"})
		return
	}

	config, err := loadModelSettings()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load model settings: " + err.Error()})
		return
	}

	key := req.AuthFile + ":" + req.ModelID
	current, exists := config.Models[key]
	if !exists {
		current = ModelSetting{
			ModelID:  req.ModelID,
			AuthFile: req.AuthFile,
			Enabled:  true,
		}
	}

	current.ModelID = req.ModelID
	current.AuthFile = req.AuthFile
	if req.DisplayName != "" {
		current.DisplayName = req.DisplayName
	}
	if current.DisplayName == "" {
		current.DisplayName = req.ModelID
	}
	if req.Provider != "" {
		current.Provider = req.Provider
	}
	if current.Provider == "" {
		current.Provider = "unknown"
	}
	if req.Enabled != nil {
		current.Enabled = *req.Enabled
	}
	current.Removed = false

	config.Models[key] = current

	if err := saveModelSettings(config); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save model settings: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "model restored", "model": current})
}

// EditModelSetting edits model metadata (including model ID/auth file) and keeps list state consistent.
func (h *Handler) EditModelSetting(c *gin.Context) {
	var req struct {
		OldModelID  string `json:"old_model_id"`
		OldAuthFile string `json:"old_auth_file"`
		ModelID     string `json:"model_id"`
		DisplayName string `json:"display_name,omitempty"`
		Provider    string `json:"provider,omitempty"`
		AuthFile    string `json:"auth_file,omitempty"`
		Enabled     *bool  `json:"enabled,omitempty"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body: " + err.Error()})
		return
	}

	req.OldModelID = strings.TrimSpace(req.OldModelID)
	req.OldAuthFile = strings.TrimSpace(req.OldAuthFile)
	req.ModelID = strings.TrimSpace(req.ModelID)
	req.DisplayName = strings.TrimSpace(req.DisplayName)
	req.Provider = normalizeProvider(req.Provider)
	req.AuthFile = strings.TrimSpace(req.AuthFile)

	if req.OldModelID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "old_model_id is required"})
		return
	}
	if req.ModelID == "" {
		req.ModelID = req.OldModelID
	}

	config, err := loadModelSettings()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load model settings: " + err.Error()})
		return
	}

	if req.Provider == "" {
		oldKey := req.OldAuthFile + ":" + req.OldModelID
		if current, exists := config.Models[oldKey]; exists {
			req.Provider = normalizeProvider(current.Provider)
		}
	}
	if req.Provider == "" {
		req.Provider = h.resolveProviderForScope(config, req.Provider, req.OldAuthFile, req.OldModelID)
	}
	if req.Provider == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "provider is required when old scope cannot infer provider"})
		return
	}

	preferredAuth := firstNonEmptyValue(req.AuthFile, req.OldAuthFile)
	targetAuthFiles := h.collectScopedAuthFiles(config, req.Provider, preferredAuth)
	if len(targetAuthFiles) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no auth files found for provider scope"})
		return
	}

	affected := 0
	var sample ModelSetting
	for _, authFile := range targetAuthFiles {
		oldKey := authFile + ":" + req.OldModelID
		current, exists := config.Models[oldKey]
		if !exists {
			current = ModelSetting{
				ModelID:  req.OldModelID,
				AuthFile: authFile,
				Enabled:  true,
			}
		}

		updated := current
		updated.ModelID = req.ModelID
		updated.AuthFile = authFile
		if req.DisplayName != "" {
			updated.DisplayName = req.DisplayName
		}
		if updated.DisplayName == "" {
			updated.DisplayName = req.ModelID
		}
		updated.Provider = req.Provider
		if req.Enabled != nil {
			updated.Enabled = *req.Enabled
		}
		updated.Removed = false

		newKey := updated.AuthFile + ":" + updated.ModelID
		config.Models[newKey] = updated
		sample = updated
		affected++

		if oldKey != newKey {
			tombstone := current
			tombstone.ModelID = req.OldModelID
			tombstone.AuthFile = authFile
			if tombstone.DisplayName == "" {
				tombstone.DisplayName = req.OldModelID
			}
			tombstone.Provider = req.Provider
			tombstone.Enabled = false
			tombstone.Removed = true
			config.Models[oldKey] = tombstone
		}
	}

	if err := saveModelSettings(config); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save model settings: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "model edited for provider scope",
		"model":    sample,
		"affected": affected,
	})
}

type modelTestResult struct {
	Success         bool   `json:"success"`
	Provider        string `json:"provider"`
	ModelID         string `json:"model_id"`
	AuthFile        string `json:"auth_file"`
	AuthIndex       string `json:"auth_index,omitempty"`
	StatusCode      int    `json:"status_code,omitempty"`
	Message         string `json:"message"`
	ResponsePreview string `json:"response_preview,omitempty"`
	DurationMS      int64  `json:"duration_ms"`
}

// TestModelSetting runs a minimal live check so operators can verify a model responds.
func (h *Handler) TestModelSetting(c *gin.Context) {
	var req struct {
		ModelID  string `json:"model_id"`
		Provider string `json:"provider,omitempty"`
		AuthFile string `json:"auth_file"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body: " + err.Error()})
		return
	}

	req.ModelID = strings.TrimSpace(req.ModelID)
	req.Provider = strings.TrimSpace(req.Provider)
	req.AuthFile = strings.TrimSpace(req.AuthFile)
	if req.ModelID == "" || req.AuthFile == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "model_id and auth_file are required"})
		return
	}

	auth := h.findAuthByFile(req.AuthFile)
	if auth == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "auth file not found in active credentials"})
		return
	}
	auth.EnsureIndex()

	provider := resolveModelTestProvider(req.Provider, auth.Provider, req.ModelID)
	if provider == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "provider not supported for live testing",
			"hint":  "currently supported: gemini, codex, openai",
		})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), defaultModelTestTimeout)
	defer cancel()

	result := h.runModelLiveTest(ctx, auth, provider, req.ModelID)
	result.AuthFile = req.AuthFile
	result.AuthIndex = auth.Index

	c.JSON(http.StatusOK, result)
}

func (h *Handler) runModelLiveTest(ctx context.Context, auth *coreauth.Auth, provider string, modelID string) modelTestResult {
	result := modelTestResult{
		Success:  false,
		Provider: provider,
		ModelID:  modelID,
		Message:  "test not executed",
	}

	start := time.Now()
	defer func() {
		result.DurationMS = time.Since(start).Milliseconds()
	}()

	exec := newModelTestExecutor(provider, h.cfg)
	if exec == nil {
		result.Message = "unsupported provider"
		return result
	}

	payload := buildModelTestPayload(modelID)
	req := cliproxyexecutor.Request{
		Model:   strings.TrimSpace(modelID),
		Payload: payload,
		Format:  sdktranslator.FromString("openai"),
	}
	opts := cliproxyexecutor.Options{
		Stream:         false,
		SourceFormat:   sdktranslator.FromString("openai"),
		OriginalRequest: bytes.Clone(payload),
	}

	resp, err := exec.Execute(ctx, auth, req, opts)
	if err != nil {
		result.Success = false
		result.Message = err.Error()
		result.ResponsePreview = trimModelTestPreview(err.Error(), maxModelTestPreviewLength)
		if statusErr, ok := err.(cliproxyexecutor.StatusError); ok {
			result.StatusCode = statusErr.StatusCode()
		}
		if parsed := extractModelTestErrorMessage(result.ResponsePreview); parsed != "" {
			result.Message = parsed
		}
		return result
	}

	result.Success = true
	result.Message = "model responded successfully"
	result.ResponsePreview = trimModelTestPreview(string(resp.Payload), maxModelTestPreviewLength)
	result.StatusCode = http.StatusOK
	return result
}

type modelTestExecutor interface {
	Execute(context.Context, *coreauth.Auth, cliproxyexecutor.Request, cliproxyexecutor.Options) (cliproxyexecutor.Response, error)
}

func newModelTestExecutor(provider string, cfg *config.Config) modelTestExecutor {
	switch strings.ToLower(strings.TrimSpace(provider)) {
	case "gemini":
		return runtimeexecutor.NewGeminiExecutor(cfg)
	case "codex":
		return runtimeexecutor.NewCodexExecutor(cfg)
	case "openai":
		return runtimeexecutor.NewOpenAICompatExecutor("openai", cfg)
	}
	return nil
}

func buildModelTestPayload(modelID string) []byte {
	payload := map[string]any{
		"model": strings.TrimSpace(modelID),
		"messages": []map[string]string{
			{
				"role":    "user",
				"content": "Reply with exactly: OK",
			},
		},
		"max_tokens":  8,
		"temperature": 0,
		"stream":      false,
	}

	encoded, err := json.Marshal(payload)
	if err != nil {
		return []byte(`{"model":"` + strings.TrimSpace(modelID) + `","messages":[{"role":"user","content":"Reply with exactly: OK"}],"max_tokens":8,"temperature":0,"stream":false}`)
	}
	return encoded
}

func (h *Handler) findAuthByFile(authFile string) *coreauth.Auth {
	authFile = strings.TrimSpace(authFile)
	if authFile == "" || h == nil || h.authManager == nil {
		return nil
	}

	auths := h.authManager.List()
	baseName := filepath.Base(authFile)
	for _, auth := range auths {
		if auth == nil {
			continue
		}
		if auth.FileName == authFile || auth.ID == authFile {
			return auth
		}
		if baseName != "" && (auth.FileName == baseName || auth.ID == baseName) {
			return auth
		}
	}

	return nil
}

func resolveModelTestProvider(requestedProvider string, authProvider string, modelID string) string {
	providers := []string{
		strings.ToLower(strings.TrimSpace(requestedProvider)),
		strings.ToLower(strings.TrimSpace(authProvider)),
	}
	for _, provider := range providers {
		switch {
		case strings.Contains(provider, "gemini"):
			return "gemini"
		case strings.Contains(provider, "codex"):
			return "codex"
		case strings.Contains(provider, "openai"):
			return "openai"
		}
	}

	modelID = strings.ToLower(strings.TrimSpace(modelID))
	switch {
	case strings.HasPrefix(modelID, "gemini"):
		return "gemini"
	case strings.HasPrefix(modelID, "gpt"), strings.HasPrefix(modelID, "o1"), strings.HasPrefix(modelID, "o3"), strings.HasPrefix(modelID, "o4"):
		if strings.Contains(strings.ToLower(strings.TrimSpace(authProvider)), "codex") {
			return "codex"
		}
		return "openai"
	}

	return ""
}

func trimModelTestPreview(raw string, maxLen int) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}
	if maxLen <= 0 || len(trimmed) <= maxLen {
		return trimmed
	}
	return trimmed[:maxLen] + "..."
}

func extractModelTestErrorMessage(preview string) string {
	if strings.TrimSpace(preview) == "" {
		return ""
	}

	var payload map[string]any
	if err := json.Unmarshal([]byte(preview), &payload); err != nil {
		return ""
	}

	if msg := extractNestedString(payload, "error", "message"); msg != "" {
		return msg
	}
	if msg := extractNestedString(payload, "error_description"); msg != "" {
		return msg
	}
	if msg := extractNestedString(payload, "message"); msg != "" {
		return msg
	}
	return ""
}

func extractNestedString(payload map[string]any, keys ...string) string {
	if len(keys) == 0 || payload == nil {
		return ""
	}

	var current any = payload
	for _, key := range keys {
		obj, ok := current.(map[string]any)
		if !ok {
			return ""
		}
		current = obj[key]
	}

	if value, ok := current.(string); ok {
		return strings.TrimSpace(value)
	}
	return ""
}
