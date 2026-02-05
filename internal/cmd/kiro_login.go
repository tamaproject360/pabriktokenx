package cmd

import (
	"context"
	"fmt"

	"github.com/router-for-me/CLIProxyAPI/v6/internal/config"
	sdkAuth "github.com/router-for-me/CLIProxyAPI/v6/sdk/auth"
	log "github.com/sirupsen/logrus"
)

// KiroLoginOptions contains options for Kiro login
type KiroLoginOptions struct {
	*LoginOptions
	Provider string // google or github
	Import   bool   // Import from Kiro IDE
}

// DoKiroLogin triggers the OAuth flow for Kiro and saves tokens.
func DoKiroLogin(cfg *config.Config, options *KiroLoginOptions) {
	if options == nil {
		options = &KiroLoginOptions{
			LoginOptions: &LoginOptions{},
			Provider:     "google", // default to google
		}
	}

	if options.LoginOptions == nil {
		options.LoginOptions = &LoginOptions{}
	}

	// Handle import from Kiro IDE
	if options.Import {
		DoKiroImport(cfg, options.LoginOptions)
		return
	}

	promptFn := options.Prompt
	if promptFn == nil {
		promptFn = defaultProjectPrompt()
	}

	manager := newAuthManager()
	authOpts := &sdkAuth.LoginOptions{
		NoBrowser: options.NoBrowser,
		Metadata: map[string]string{
			"provider": options.Provider,
		},
		Prompt: promptFn,
	}

	record, savedPath, err := manager.Login(context.Background(), "kiro", cfg, authOpts)
	if err != nil {
		log.Errorf("Kiro authentication failed: %v", err)
		return
	}

	if savedPath != "" {
		fmt.Printf("Authentication saved to %s\n", savedPath)
	}
	if record != nil && record.Label != "" {
		fmt.Printf("Authenticated as %s\n", record.Label)
	}
	fmt.Println("Kiro authentication successful!")
}

// DoKiroLoginGoogle triggers Google OAuth flow for Kiro.
func DoKiroLoginGoogle(cfg *config.Config, options *LoginOptions) {
	DoKiroLogin(cfg, &KiroLoginOptions{
		LoginOptions: options,
		Provider:     "google",
	})
}

// DoKiroLoginGitHub triggers GitHub OAuth flow for Kiro.
func DoKiroLoginGitHub(cfg *config.Config, options *LoginOptions) {
	DoKiroLogin(cfg, &KiroLoginOptions{
		LoginOptions: options,
		Provider:     "github",
	})
}

// DoKiroImport imports token from Kiro IDE.
func DoKiroImport(cfg *config.Config, options *LoginOptions) {
	if options == nil {
		options = &LoginOptions{}
	}

	kiroAuth := sdkAuth.NewKiroAuthenticator()
	record, err := kiroAuth.ImportFromKiroIDE(context.Background(), cfg)
	if err != nil {
		log.Errorf("Failed to import Kiro IDE token: %v", err)
		return
	}

	// Save the imported auth record
	store := sdkAuth.GetTokenStore()
	if setter, ok := store.(interface{ SetBaseDir(string) }); ok && cfg != nil {
		setter.SetBaseDir(cfg.AuthDir)
	}
	
	savedPath, err := store.Save(context.Background(), record)
	if err != nil {
		log.Errorf("Failed to save imported token: %v", err)
		return
	}

	if savedPath != "" {
		fmt.Printf("Token imported and saved to %s\n", savedPath)
	}
	if record != nil && record.Label != "" {
		fmt.Printf("Imported as %s\n", record.Label)
	}
	fmt.Println("Kiro token import successful!")
}
