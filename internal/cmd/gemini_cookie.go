package cmd

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/router-for-me/CLIProxyAPI/v6/internal/config"
	log "github.com/sirupsen/logrus"
)

// DoGeminiCookieAuth performs the Gemini cookie-based authentication.
func DoGeminiCookieAuth(cfg *config.Config, options *LoginOptions) {
	if options == nil {
		options = &LoginOptions{}
	}

	promptFn := options.Prompt
	if promptFn == nil {
		reader := bufio.NewReader(os.Stdin)
		promptFn = func(prompt string) (string, error) {
			fmt.Print(prompt)
			value, err := reader.ReadString('\n')
			if err != nil {
				return "", err
			}
			return strings.TrimSpace(value), nil
		}
	}

	// Prompt user for cookie
	cookie, err := promptForGeminiCookie(promptFn)
	if err != nil {
		fmt.Printf("Failed to get cookie: %v\n", err)
		return
	}

	// Prompt for email (optional, for identification)
	email, err := promptFn("Enter your email (for identification, optional): ")
	if err != nil {
		email = "user"
	}
	if email == "" {
		email = "user"
	}

	// Create auth file
	authFilePath := getGeminiCookieAuthFilePath(cfg, email)

	// Create token storage structure
	tokenStorage := map[string]interface{}{
		"type":    "gemini-web-cookie",
		"cookie":  cookie,
		"email":   email,
		"created": time.Now().Unix(),
	}

	// Save to file
	if err := saveGeminiCookieAuth(authFilePath, tokenStorage); err != nil {
		fmt.Printf("Failed to save authentication: %v\n", err)
		return
	}

	fmt.Printf("Authentication successful!\n")
	fmt.Printf("Email: %s\n", email)
	fmt.Printf("Authentication saved to: %s\n", authFilePath)
	fmt.Println("\nYou can now use Gemini models including gemini-2.5-flash-image via cookie authentication.")
}

// promptForGeminiCookie prompts the user to enter their Gemini cookie
func promptForGeminiCookie(promptFn func(string) (string, error)) (string, error) {
	fmt.Println("\nPlease paste your Google Gemini cookies:")
	fmt.Println("(You can get these from your browser's Developer Tools > Application > Cookies)")

	line, err := promptFn("Cookie: ")
	if err != nil {
		return "", fmt.Errorf("failed to read cookie: %w", err)
	}

	cookie := strings.TrimSpace(line)
	if cookie == "" {
		return "", fmt.Errorf("cookie cannot be empty")
	}

	// Basic validation - check for common Google cookie fields
	if !strings.Contains(cookie, "SID=") && !strings.Contains(cookie, "__Secure-1PSID=") {
		log.Warn("Warning: Cookie might be invalid. Make sure it contains Google session cookies.")
	}

	return cookie, nil
}

// getGeminiCookieAuthFilePath returns the auth file path for Gemini cookie auth
func getGeminiCookieAuthFilePath(cfg *config.Config, email string) string {
	sanitized := strings.ReplaceAll(email, "@", "-at-")
	sanitized = strings.ReplaceAll(sanitized, ".", "-")
	return fmt.Sprintf("%s/gemini-web-%s-%d.json", cfg.AuthDir, sanitized, time.Now().Unix())
}

// saveGeminiCookieAuth saves the cookie authentication to file
func saveGeminiCookieAuth(filePath string, data map[string]interface{}) error {
	jsonData, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal auth data: %w", err)
	}

	if err := os.WriteFile(filePath, jsonData, 0600); err != nil {
		return fmt.Errorf("failed to write auth file: %w", err)
	}

	return nil
}
