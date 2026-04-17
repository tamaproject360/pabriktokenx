package management

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"
	log "github.com/sirupsen/logrus"
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

	for _, setting := range config.Models {
		if !setting.Removed {
			continue
		}
		if normalizeModelID(setting.ModelID) == needle {
			return true
		}
	}

	return false
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

// AddModelSetting adds a model entry so it can be managed from Model Settings.
func (h *Handler) AddModelSetting(c *gin.Context) {
	var req struct {
		ModelID     string `json:"model_id"`
		DisplayName string `json:"display_name,omitempty"`
		Provider    string `json:"provider"`
		AuthFile    string `json:"auth_file"`
		Enabled     *bool  `json:"enabled,omitempty"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body: " + err.Error()})
		return
	}

	req.ModelID = strings.TrimSpace(req.ModelID)
	req.AuthFile = strings.TrimSpace(req.AuthFile)
	req.Provider = strings.TrimSpace(req.Provider)
	req.DisplayName = strings.TrimSpace(req.DisplayName)
	if req.ModelID == "" || req.AuthFile == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "model_id and auth_file are required"})
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

	key := req.AuthFile + ":" + req.ModelID
	config.Models[key] = ModelSetting{
		ModelID:     req.ModelID,
		DisplayName: req.DisplayName,
		Provider:    req.Provider,
		AuthFile:    req.AuthFile,
		Enabled:     enabled,
		Removed:     false,
	}

	if err := saveModelSettings(config); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save model settings: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "model added", "model": config.Models[key]})
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

	key := req.AuthFile + ":" + req.ModelID
	current := config.Models[key]
	current.ModelID = req.ModelID
	current.AuthFile = req.AuthFile
	if current.Provider == "" {
		current.Provider = req.Provider
	}
	if current.DisplayName == "" {
		current.DisplayName = req.ModelID
	}
	current.Enabled = false
	current.Removed = true
	config.Models[key] = current

	if err := saveModelSettings(config); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save model settings: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "model removed", "model": current})
}
