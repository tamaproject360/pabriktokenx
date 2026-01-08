package management

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"sync"

	"github.com/gin-gonic/gin"
)

// ModelSetting represents the configuration for a single model
type ModelSetting struct {
	ModelID     string `json:"model_id"`
	DisplayName string `json:"display_name,omitempty"`
	Provider    string `json:"provider"`
	AuthFile    string `json:"auth_file"`
	Enabled     bool   `json:"enabled"`
}

// ModelSettingsConfig represents the full model settings configuration
type ModelSettingsConfig struct {
	Models map[string]ModelSetting `json:"models"` // key is "authFile:modelId"
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
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			// Return empty config if file doesn't exist
			return &ModelSettingsConfig{
				Models: make(map[string]ModelSetting),
			}, nil
		}
		return nil, err
	}

	var config ModelSettingsConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, err
	}

	if config.Models == nil {
		config.Models = make(map[string]ModelSetting)
	}

	return &config, nil
}

func saveModelSettings(config *ModelSettingsConfig) error {
	modelSettingsMu.Lock()
	defer modelSettingsMu.Unlock()

	path := getModelSettingsPath()
	data, err := json.MarshalIndent(config, "", "  ")
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
		enabled[key] = setting.Enabled
	}

	return enabled
}
