# Changelog

## [Unreleased]

### Fixed
- **Docker Port Consistency**: Frontend and backend container ports are now consistent for server deployment
  - Production compose now publishes frontend on `8686` (was `3000`) and backend on `9999`
  - Development compose now publishes Vite frontend on `8686` and backend on `9999`
  - Development frontend build context aligned with `Dockerfile.frontend` to avoid image/build mismatch
  - Added `config.docker.yaml` and wired compose to use it, preventing host-specific config issues during Linux server deploy

- **Model Live Test Button**: Added per-model live connectivity check from Model Settings
  - New **Test Model** action validates model request path against the selected auth file/account
  - Added endpoint `POST /v0/management/model-settings/test` for runtime model health checks
  - Supports live tests for Gemini, Codex, and OpenAI-compatible models with status/error preview

- **Model Test Parity**: Model Settings test now uses the same runtime executor path as Playground
  - Prevents false failures where alias-mapped models (e.g. GPT 5.x variants) worked in Playground but failed in Test button
  - Test now respects provider model mapping and request translation used by normal inference flow

- **Model Remove Consistency**: Removing a model now hides it immediately and consistently without backend restart
  - Remove action now marks matching model entries across same provider auth files to prevent duplicate reappearance
  - Global removed-state now treats a model as removed only when no active entry remains
  - Model listing endpoint now respects global removed-state for immediate UI consistency
  - Frontend applies optimistic hide so removed model disappears instantly while backend updates

- **Provider Scope Model Settings**: Add/Edit model now works across all auth files under the same provider
  - Add Model no longer tied to a single auth file; provider scope is applied automatically
  - Edit Model propagates changes (model id/display/provider/enabled) across provider auth files
  - Auth file field in Add/Edit is now optional and treated as scope hint, not hard binding

- **Playground Provider Routing**: Model requests now honor selected provider category
  - Playground sends `X-Provider-Hint` header based on selected provider in model dropdown
  - Backend narrows routing candidates to the hinted provider when the model exists in multiple providers
  - Prevents false failures where a Codex model was accidentally routed via non-Codex chat endpoint

- **Playground Provider Hint Enforcement**: Provider hint mismatches now fail fast with explicit errors
  - Backend no longer silently falls back to unrelated providers when `X-Provider-Hint` does not match model provider mapping
  - Returns clearer `400` error when model is not available in selected provider

- **Auth Selection Fallback for Manual Models**: Runtime now falls back to provider-level auth candidates when registry model support is stale
  - Prevents false `auth_not_found` for provider-scoped/manual model entries that are not yet reflected in registry support metadata
  - Upstream provider remains final source of truth for actual model compatibility

- **Playground Hint Routing for Manual Models**: Request routing now uses selected provider hint when registry mapping is stale/missing
  - If model-to-provider registry metadata is missing but hinted provider has active auth, backend routes to hinted provider instead of failing early
  - Keeps strict mismatch error only when hinted provider has no available auth

- **Playground Conversation Provider Sync**: Restored conversations now preserve provider type with model
  - Prevents stale provider hints after loading previous chats or switching models across provider categories
  - Conversation updates now persist both selected model and selected provider type

- **Gemini CLI OAuth Refresh Fix**: Gemini CLI token refresh now sends client credentials correctly
  - Gemini CLI executor now resolves `client_id` / `client_secret` from stored auth metadata token fields
  - Falls back to built-in Gemini OAuth client defaults when env values are absent
  - Fixes runtime error `oauth2: invalid_request Could not determine client ID from request` in Playground/API

- **Gemini CLI Model Test Parity**: Model Settings test now routes `gemini-cli` via Gemini CLI executor
  - Prevents false negatives where Gemini CLI auth was tested with generic Gemini executor
  - Live test provider resolver now preserves `gemini-cli` instead of collapsing it to `gemini`

- **Cherry Studio Model Fetch Compatibility**: `/v1/models` now exposes configured and fallback Codex models
  - OpenAI models endpoint now merges active models from `model_settings.json` into the API model list
  - Added hardcoded fallback entries for `gpt-5.4` and `gpt-5.4-mini` when not yet present in runtime registry
  - Prevents missing model list entries in external clients (e.g. Cherry Studio) while Playground can already run them

- **Cherry Studio Chat Routing for Manual Models**: Chat requests now resolve provider from model settings when registry mapping is missing
  - Request resolver falls back to provider data in `model_settings.json` for enabled, non-removed models
  - Fixes `unknown provider for model gpt-5.4-mini` for clients that do not send `X-Provider-Hint`

- **Model Settings UI Cleanup**: Removed stray literal `\n` text shown near model toggles on model cards

- **Model Lifecycle Controls**: Added add/remove/restore/edit model controls in Model Settings
  - New **Add Model** modal allows adding model ID/display name per auth file
  - New **Remove** action hides model from Model Settings and Playground list for selected auth file
  - New **Hidden Models** panel allows restoring removed models
  - New **Edit Model** flow allows correcting model ID/name/provider/auth file without editing config files manually
  - Management API now exposes `/model-settings/add`, `/model-settings/remove`, `/model-settings/restore`, and `/model-settings/edit`
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