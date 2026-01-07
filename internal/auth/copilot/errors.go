// Package copilot provides authentication and token management for GitHub Copilot API.
// It handles the OAuth2 device flow for secure authentication with the Copilot API.
package copilot

import (
	"errors"
	"fmt"
	"net/http"
)

// OAuthError represents an OAuth-specific error.
type OAuthError struct {
	// Code is the OAuth error code.
	Code string `json:"error"`
	// Description is a human-readable description of the error.
	Description string `json:"error_description,omitempty"`
	// URI is a URI identifying a human-readable web page with information about the error.
	URI string `json:"error_uri,omitempty"`
	// StatusCode is the HTTP status code associated with the error.
	StatusCode int `json:"-"`
}

// Error returns a string representation of the OAuth error.
func (e *OAuthError) Error() string {
	if e.Description != "" {
		return fmt.Sprintf("OAuth error %s: %s", e.Code, e.Description)
	}
	return fmt.Sprintf("OAuth error: %s", e.Code)
}

// NewOAuthError creates a new OAuth error with the specified code, description, and status code.
func NewOAuthError(code, description string, statusCode int) *OAuthError {
	return &OAuthError{
		Code:        code,
		Description: description,
		StatusCode:  statusCode,
	}
}

// Error type constants for authentication errors
const (
	ErrDeviceCodeFailed   = "device_code_failed"
	ErrTokenExchangeFailed = "token_exchange_failed"
	ErrUserInfoFailed     = "user_info_failed"
	ErrPollingTimeout     = "polling_timeout"
)

// Common OAuth errors
var (
	ErrAuthorizationPending = errors.New("authorization_pending")
	ErrSlowDown             = errors.New("slow_down")
	ErrAccessDenied         = errors.New("access_denied")
	ErrExpiredToken         = errors.New("expired_token")
)

// AuthenticationError represents authentication-related errors.
type AuthenticationError struct {
	// Type is the type of authentication error.
	Type string `json:"type"`
	// Message is a human-readable message describing the error.
	Message string `json:"message"`
	// Cause is the underlying cause of the error, if any.
	Cause error `json:"-"`
}

// Error returns a string representation of the authentication error.
func (e *AuthenticationError) Error() string {
	if e.Cause != nil {
		return fmt.Sprintf("%s: %s (caused by: %v)", e.Type, e.Message, e.Cause)
	}
	return fmt.Sprintf("%s: %s", e.Type, e.Message)
}

// Unwrap returns the underlying cause of the error.
func (e *AuthenticationError) Unwrap() error {
	return e.Cause
}

// NewAuthenticationError creates a new authentication error.
func NewAuthenticationError(errType string, cause error) *AuthenticationError {
	msg := "authentication failed"
	if cause != nil {
		msg = cause.Error()
	}
	return &AuthenticationError{
		Type:    errType,
		Message: msg,
		Cause:   cause,
	}
}

// GetUserFriendlyMessage returns a user-friendly error message for common errors.
func GetUserFriendlyMessage(err error) string {
	if err == nil {
		return ""
	}

	switch {
	case errors.Is(err, ErrAuthorizationPending):
		return "Waiting for authorization..."
	case errors.Is(err, ErrAccessDenied):
		return "Access denied. Please ensure you have an active GitHub Copilot subscription."
	case errors.Is(err, ErrExpiredToken):
		return "Token expired. Please try logging in again."
	default:
		return err.Error()
	}
}

// isHTTPSuccess checks if the HTTP status code indicates success.
func isHTTPSuccess(statusCode int) bool {
	return statusCode >= http.StatusOK && statusCode < http.StatusMultipleChoices
}
