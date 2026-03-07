# Engagement Profile
## pabriktokenx Security Assessment

| Field | Value |
|---|---|
| **Assessment Date** | 2026-03-07 |
| **Assessment Mode** | PRODUCTION_SAFE |
| **Framework** | Perseus v1 (Antigravity) |
| **Assessment Type** | Passive Static Analysis |

## Application Profile

| Attribute | Value |
|---|---|
| **Application Name** | pabriktokenx |
| **Application Type** | AI API Proxy Server |
| **Primary Function** | Proxies requests to Gemini, Claude, GitHub Copilot, Codex, Antigravity, iFlow, Qwen, Kiro |
| **Deployment Model** | Docker (docker-compose, 2 containers) |
| **Internet Exposure** | Yes (nginx on :80/:443, backend also exposed on :9999) |

## Technology Stack

| Layer | Technology |
|---|---|
| Backend | Go 1.24, Gin v1.10.1 |
| Frontend | React 19, TypeScript, Vite, TailwindCSS v4 |
| Database | PostgreSQL (pgx driver) |
| Object Storage | MinIO |
| WebSocket | gorilla/websocket |
| Reverse Proxy | nginx (alpine, unpinned) |
| Auth Store | File-based JSON (local filesystem) |

## Entry Points Identified

| Endpoint Pattern | Auth Required | Protocol |
|---|---|---|
| `/v1/*` | Proxy key header | HTTP/HTTPS |
| `/v1/ws` | None (origin check disabled) | WebSocket |
| `/management/*` | bcrypt management key | HTTP/HTTPS |
| Direct backend `:9999` | Same as above (bypasses nginx) | HTTP |

## Finding Summary

| Severity | Count |
|---|---|
| Critical | 2 |
| High | 10 |
| Medium | 8 |
| Low / Informational | 5 |
| **Total** | **25** |

## Immediate Risk

**P0 action required:** A live GitHub Copilot OAuth token (`ghu_BLMvwya1EsQyk95O72QEuDqPyCK66H4dBcHh`) is committed and tracked in git (`debug-output.log`). This token must be revoked and the file purged from git history before any other work proceeds.

## Full Report

See `deliverables/SECURITY_REPORT.md` for the complete findings, evidence, and remediation guidance.
