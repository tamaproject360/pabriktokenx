# Changelog

## [Unreleased]

### Fixed
- **Antigravity OAuth**: Fixed token refresh failure due to missing OAuth client credentials
  - `antigravity_executor.go` now uses default credentials from `internal/auth/antigravity/constants.go`
  - `sdk/auth/antigravity.go` updated to use default credentials as fallback
  - Root cause: When `ANTIGRAVITY_OAUTH_CLIENT_ID` env var was not set, empty strings were sent to Google OAuth
  
- **Model Settings**: Fixed parsing error caused by corrupted JSON file
  - Added debug logging to `model_settings.go` for better troubleshooting
  - Fixed truncated `"enabled": tru` → `"enabled": true` in `model_settings.json`

### Changed
- Added `.gitignore` pattern for `backend*.log` files