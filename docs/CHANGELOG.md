# Changelog

## [Unreleased]

### Fixed
- **Status Detection**: Improved auth account status classification across Playground and QuotaPage
  - Rate-limited accounts (429/RESOURCE_EXHAUSTED) no longer incorrectly counted as "active"
  - Added `warning` / `Limited` status for unsupported API model errors (e.g., GitHub Copilot's `gpt-5.1-codex`)
  - Antigravity now correctly shows "4/4 rate limited" instead of "4/4 active"
  - GitHub Copilot shows "Limited" instead of "Error" (account works, specific model isn't accessible)
  - Consistent status detection logic between PlaygroundPage and QuotaPage

- **Antigravity OAuth**: Fixed token refresh failure due to missing OAuth client credentials
  - `antigravity_executor.go` now uses default credentials from `internal/auth/antigravity/constants.go`
  - `sdk/auth/antigravity.go` updated to use default credentials as fallback
  - Root cause: When `ANTIGRAVITY_OAUTH_CLIENT_ID` env var was not set, empty strings were sent to Google OAuth
  
- **Model Settings**: Fixed parsing error caused by corrupted JSON file
  - Added debug logging to `model_settings.go` for better troubleshooting
  - Fixed truncated `"enabled": tru` → `"enabled": true` in `model_settings.json`

### Changed
- Added `.gitignore` pattern for `backend*.log` files