# Changelog

## [Unreleased]

### Fixed
- **Model Settings UI Cleanup**: Removed stray literal `\n` text shown near model toggles on model cards

- **Model Lifecycle Controls**: Added add/remove model controls in Model Settings
  - New **Add Model** modal allows adding model ID/display name per auth file
  - New **Remove** action hides model from Model Settings and Playground list for selected auth file
  - Management API now exposes `/model-settings/add` and `/model-settings/remove`
  - Auth model listing now merges manually added models from settings and excludes removed models
  - `/v1/models` and Gemini model-list endpoints now hide models marked as removed

- **OAuth Callback Reliability**: Callback success page no longer appears when callback persistence fails
  - OAuth callback endpoints now validate state and callback-file persistence before returning success HTML
  - OAuth callback writer now creates the auth directory before writing temporary callback files
  - Prevents false-success Gemini OAuth flows where no auth file is saved

- **Status Detection**: Improved auth account status classification across Playground and QuotaPage
  - Rate-limited accounts (429/RESOURCE_EXHAUSTED) no longer incorrectly counted as "active"
  - GitHub Copilot `unsupported_api` model errors now treated as active (account works, specific test model wasn't compatible)
  - Antigravity correctly shows "4/4 rate limited" instead of "4/4 active"
  - Consistent status detection logic between PlaygroundPage and QuotaPage

- **Model Deduplication**: Redundant models with identical display names are now consolidated
  - GPT-4o date-suffixed variants (2024-05-13, 2024-08-06, 2024-11-20) merged into single "GPT-4o" entry
  - Keeps shorter/canonical model ID when display names match
  - Raptor mini (oswe-vscode-prime/secondary) deduplicated

- **Sidebar Collapse Icon**: Fixed toggle button being clipped by parent overflow
  - Moved collapse/expand buttons inside sidebar instead of absolute-positioned outside
  - Collapse icon now inline in header, expand icon at top of collapsed strip

- **Antigravity OAuth**: Fixed token refresh failure due to missing OAuth client credentials
  - `antigravity_executor.go` now uses default credentials from `internal/auth/antigravity/constants.go`
  - `sdk/auth/antigravity.go` updated to use default credentials as fallback
  - Root cause: When `ANTIGRAVITY_OAUTH_CLIENT_ID` env var was not set, empty strings were sent to Google OAuth
  
- **Model Settings**: Fixed parsing error caused by corrupted JSON file
  - Added debug logging to `model_settings.go` for better troubleshooting
  - Fixed truncated `"enabled": tru` → `"enabled": true` in `model_settings.json`

### Added
- **Collapsible Chat History Sidebar**: Playground sidebar can be collapsed to icon-only strip
  - Expanded: full sidebar with New Chat button and conversation list
  - Collapsed: compact icon strip showing recent conversations with tooltips
  - Smooth 300ms CSS transition between states

- **Provider-Grouped Model Selector**: Playground models grouped by provider category
  - Models deduplicated across accounts of the same provider type
  - Shows account count and aggregate status per category
  - Backend handles round-robin across accounts automatically

- **Typing Animation**: Bouncing-dot typing indicator while AI generates responses
  - "AI is thinking..." label with streaming progress indicator

- **Card/List View Toggle**: QuotaPage supports both card and list view modes
  - Real-time provider status from backend data
  - Unique provider count instead of total account count

### Changed
- Added `.gitignore` pattern for `backend*.log` files
- Updated README with latest features and What's New section