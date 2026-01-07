package management

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/router-for-me/CLIProxyAPI/v6/internal/usage"
)

type usageExportPayload struct {
	Version    int                      `json:"version"`
	ExportedAt time.Time                `json:"exported_at"`
	Usage      usage.StatisticsSnapshot `json:"usage"`
}

type usageImportPayload struct {
	Version int                      `json:"version"`
	Usage   usage.StatisticsSnapshot `json:"usage"`
}

// GetRateLimits returns current rate limit information based on documented tier limits
// and actual usage statistics for calculating percentages
func (h *Handler) GetRateLimits(c *gin.Context) {
	// Get usage statistics for calculating usage percentages
	var snapshot usage.StatisticsSnapshot
	if h != nil && h.usageStats != nil {
		snapshot = h.usageStats.Snapshot()
	}

	// Calculate current hour usage for real-time tracking
	now := time.Now()
	currentHour := now.Hour()
	currentHourKey := formatHour(currentHour)
	
	var currentHourRequests int64
	var currentHourTokens int64
	
	if count, ok := snapshot.RequestsByHour[currentHourKey]; ok {
		currentHourRequests = count
	}
	if tokens, ok := snapshot.TokensByHour[currentHourKey]; ok {
		currentHourTokens = tokens
	}

	// Extrapolate hourly rate (requests/tokens per hour based on current usage)
	minuteOfHour := now.Minute()
	if minuteOfHour > 0 {
		// Extrapolate to full hour
		currentHourRequests = (currentHourRequests * 60) / int64(minuteOfHour)
		currentHourTokens = (currentHourTokens * 60) / int64(minuteOfHour)
	}

	// Calculate weekly usage
	weeklyRequests := snapshot.TotalRequests

	// Documented rate limits from official docs
	rateLimits := map[string]interface{}{
		"openai": map[string]interface{}{
			"provider":            "OpenAI",
			"hourly_limit":        30000,  // Tier 1: 500 RPM = 30k/hour
			"hourly_usage":        currentHourRequests,
			"remaining":           30000 - currentHourRequests,
			"percentage":          float64(currentHourRequests) / 30000.0,
			"reset_time":          now.Add(time.Hour).Truncate(time.Hour),
			"weekly_limit":        8800000, // ~293k requests/day * 30 days
			"weekly_usage":        weeklyRequests,
			"weekly_remaining":    8800000 - weeklyRequests,
			"weekly_percentage":   float64(weeklyRequests) / 8800000.0,
			"tokens_limit":        200000, // 200k TPM for Tier 1
			"tokens_usage":        currentHourTokens,
			"tokens_percentage":   float64(currentHourTokens) / 200000.0,
		},
		"google": map[string]interface{}{
			"provider":        "Google",
			"hourly_limit":    "Unlimited",
			"hourly_usage":    currentHourRequests,
			"remaining":       "Unlimited",
			"percentage":      0.0,
			"reset_time":      nil,
			"note":            "No limit",
		},
	}

	c.JSON(http.StatusOK, gin.H{
		"rate_limits": rateLimits,
		"last_updated": now,
	})
}

func formatHour(hour int) string {
	if hour < 0 {
		hour = 0
	}
	hour = hour % 24
	if hour < 10 {
		return "0" + string(rune('0'+hour))
	}
	return string(rune('0'+(hour/10))) + string(rune('0'+(hour%10)))
}

// GetUsageStatistics returns the in-memory request statistics snapshot.
func (h *Handler) GetUsageStatistics(c *gin.Context) {
	var snapshot usage.StatisticsSnapshot
	if h != nil && h.usageStats != nil {
		snapshot = h.usageStats.Snapshot()
	}
	c.JSON(http.StatusOK, gin.H{
		"usage":           snapshot,
		"failed_requests": snapshot.FailureCount,
	})
}

// ExportUsageStatistics returns a complete usage snapshot for backup/migration.
func (h *Handler) ExportUsageStatistics(c *gin.Context) {
	var snapshot usage.StatisticsSnapshot
	if h != nil && h.usageStats != nil {
		snapshot = h.usageStats.Snapshot()
	}
	c.JSON(http.StatusOK, usageExportPayload{
		Version:    1,
		ExportedAt: time.Now().UTC(),
		Usage:      snapshot,
	})
}

// ImportUsageStatistics merges a previously exported usage snapshot into memory.
func (h *Handler) ImportUsageStatistics(c *gin.Context) {
	if h == nil || h.usageStats == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "usage statistics unavailable"})
		return
	}

	data, err := c.GetRawData()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read request body"})
		return
	}

	var payload usageImportPayload
	if err := json.Unmarshal(data, &payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid json"})
		return
	}
	if payload.Version != 0 && payload.Version != 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported version"})
		return
	}

	result := h.usageStats.MergeSnapshot(payload.Usage)
	snapshot := h.usageStats.Snapshot()
	c.JSON(http.StatusOK, gin.H{
		"added":           result.Added,
		"skipped":         result.Skipped,
		"total_requests":  snapshot.TotalRequests,
		"failed_requests": snapshot.FailureCount,
	})
}
