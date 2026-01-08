package management

import (
	"context"
	"fmt"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	coreauth "github.com/router-for-me/CLIProxyAPI/v6/sdk/cliproxy/auth"
)

// RequestGeminiCookieToken handles Gemini cookie-based authentication via API
func (h *Handler) RequestGeminiCookieToken(c *gin.Context) {
	ctx := context.Background()

	var payload struct {
		Cookie string `json:"cookie"`
		Email  string `json:"email"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "error": "cookie is required"})
		return
	}

	cookieValue := strings.TrimSpace(payload.Cookie)
	email := strings.TrimSpace(payload.Email)

	if cookieValue == "" {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "error": "cookie is required"})
		return
	}

	if email == "" {
		email = "user"
	}

	// Basic validation - check for common Google cookie fields
	if !strings.Contains(cookieValue, "SID=") && !strings.Contains(cookieValue, "__Secure-1PSID=") {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "error": "invalid cookie format, must contain Google session cookies"})
		return
	}

	// Sanitize email for filename
	fileName := strings.ReplaceAll(email, "@", "-at-")
	fileName = strings.ReplaceAll(fileName, ".", "-")
	timestamp := time.Now().Unix()

	record := &coreauth.Auth{
		ID:       fmt.Sprintf("gemini-web-%s-%d.json", fileName, timestamp),
		Provider: "gemini-web",
		FileName: fmt.Sprintf("gemini-web-%s-%d.json", fileName, timestamp),
		Metadata: map[string]any{
			"email":   email,
			"cookie":  cookieValue,
			"type":    "gemini-web-cookie",
			"created": timestamp,
		},
		Attributes: map[string]string{
			"email": email,
		},
	}

	savedPath, errSave := h.saveTokenRecord(ctx, record)
	if errSave != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "error": "failed to save authentication tokens"})
		return
	}

	fmt.Printf("Gemini Web cookie authentication successful. Token saved to %s\n", savedPath)

	c.JSON(http.StatusOK, gin.H{
		"status":  "ok",
		"message": "Gemini Web cookie authentication successful",
		"email":   email,
		"file":    filepath.Base(savedPath),
	})
}
