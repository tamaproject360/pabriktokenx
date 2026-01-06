# PabrikTokenX

> **Enterprise-grade OAuth proxy server for AI coding platforms** - Access Claude, Gemini, OpenAI Codex, and more through a unified API without managing API keys.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Go Version](https://img.shields.io/badge/Go-1.21+-00ADD8?logo=go)](https://go.dev)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

---

## 🚀 Overview

PabrikTokenX is a production-ready proxy server that provides OpenAI/Gemini/Claude compatible API endpoints for CLI-based AI models. It enables seamless integration with AI coding tools by handling OAuth authentication and providing multi-account load balancing.

### ✨ Key Features

- **🔐 OAuth Authentication** - Support for Claude Code, OpenAI Codex, Gemini CLI, Qwen Code, and iFlow
- **🌐 OpenAI-Compatible API** - Drop-in replacement for OpenAI API clients
- **⚖️ Load Balancing** - Round-robin distribution across multiple accounts
- **🎯 Provider Routing** - Smart routing with automatic failover
- **🔄 Multi-Modal Support** - Text, images, and function calling
- **📊 Usage Tracking** - Built-in statistics and monitoring
- **🎨 Management Dashboard** - Web-based UI for configuration
- **🔌 Extensible SDK** - Reusable Go SDK for custom integrations

---

## 📋 Table of Contents

- [Requirements](#-requirements)
- [Quick Start](#-quick-start)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [API Documentation](#-api-documentation)
- [Management Scripts](#-management-scripts)
- [Development](#-development)
- [Contributing](#-contributing)
- [License](#-license)

---

## 💻 Requirements

### System Requirements

- **Operating System**: Windows 10/11, macOS 10.15+, or Linux
- **Memory**: Minimum 512MB RAM (1GB+ recommended)
- **Disk Space**: 100MB free space

### Software Dependencies

| Software | Version | Purpose |
|----------|---------|---------|
| Go | 1.21+ | Backend runtime |
| Node.js | 18+ | Frontend development |
| npm | 9+ | Package management |

---

## 🎯 Quick Start

### Windows Users

1. **Clone the repository:**
   ```bash
   git clone https://github.com/tamaproject360/pabriktokenx.git
   cd pabriktokenx
   ```

2. **Start all services:**
   ```bash
   start-all.bat
   ```

3. **Access the dashboard:**
   - Backend API: http://localhost:9999
   - Frontend Dashboard: http://localhost:8686

### macOS/Linux Users

```bash
# Clone repository
git clone https://github.com/tamaproject360/pabriktokenx.git
cd pabriktokenx

# Setup configuration
cp config.example.yaml config.yaml

# Build backend
go build -o cliproxy ./cmd/server

# Run backend
./cliproxy

# In another terminal, run frontend
cd frontend
npm install
npm run dev
```

---

## 📦 Installation

### From Source

```bash
# Clone repository
git clone https://github.com/tamaproject360/pabriktokenx.git
cd pabriktokenx

# Build backend
go build -o cliproxy.exe ./cmd/server

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### Building Executable

```bash
# Windows
go build -ldflags="-s -w" -o cliproxy.exe ./cmd/server

# macOS/Linux
go build -ldflags="-s -w" -o cliproxy ./cmd/server
```

---

## ⚙️ Configuration

### Initial Setup

> **⚠️ SECURITY WARNING**  
> Never commit `config.yaml` or any files in `auths/` directory to version control.  
> These files contain sensitive credentials. Always use `config.example.yaml` as a template.

1. **Copy example configuration:**
   ```bash
   cp config.example.yaml config.yaml
   ```

2. **Edit configuration:**
   ```yaml
   # Server Settings
   host: ""
   port: 9999
   
   # Management API
   remote-management:
     allow-remote: true
     secret-key: "your-secure-key-here"
   
   # Authentication
   auth-dir: "~/.cli-proxy-api"
   
   # Logging
   debug: false
   logging-to-file: true
   ```

### Environment Variables

```bash
# Override management password (optional)
export MANAGEMENT_PASSWORD=your-secure-password

# Set custom config path
export CONFIG_PATH=/path/to/config.yaml
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `port` | int | 9999 | Server port |
| `debug` | bool | false | Enable debug logging |
| `auth-dir` | string | ~/.cli-proxy-api | Authentication directory |
| `proxy-url` | string | "" | Upstream proxy URL |
| `request-retry` | int | 3 | Request retry count |
| `routing.strategy` | string | round-robin | Load balancing strategy |

---

## 🎮 Usage

### Authentication

#### Gemini CLI Login
```bash
cliproxy.exe --login --project_id your-project-id
```

#### Claude Code Login
```bash
cliproxy.exe --claude-login
```

#### OpenAI Codex Login
```bash
cliproxy.exe --codex-login
```

### API Endpoints

#### Chat Completions (OpenAI-compatible)
```bash
curl http://localhost:9999/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "gemini-2.0-flash-exp",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

#### Claude Messages API
```bash
curl http://localhost:9999/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

#### Gemini API
```bash
curl http://localhost:9999/v1beta/models/gemini-2.0-flash-exp:generateContent \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{"parts": [{"text": "Hello!"}]}]
  }'
```

---

## 📚 API Documentation

### Management API

All management endpoints require authentication:
```
Authorization: Bearer <management-key>
```
or
```
X-Management-Key: <management-key>
```

#### Authentication Files

```bash
# List all authentication files
GET /v0/management/auth-files

# Get specific auth file
GET /v0/management/auth-files/{filename}

# Delete auth file
DELETE /v0/management/auth-files/{filename}
```

#### OAuth Endpoints

```bash
# Start Gemini OAuth flow
GET /v0/management/gemini-cli-auth-url?is_webui=true

# Start Claude OAuth flow
GET /v0/management/anthropic-auth-url?is_webui=true

# Start Codex OAuth flow
GET /v0/management/codex-auth-url?is_webui=true

# OAuth callback
POST /v0/management/oauth-callback
```

#### Configuration

```bash
# Get current config
GET /v0/management/config

# Update config
PUT /v0/management/config

# Get usage statistics
GET /v0/management/usage
```

### Complete API Documentation

For detailed API documentation, visit: [https://help.router-for.me/](https://help.router-for.me/)

---

## 🛠 Management Scripts

### Windows Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `start-all.bat` | Start all services | Double-click or run in CMD |
| `start-backend.bat` | Start backend only | For production deployment |
| `start-frontend.bat` | Start frontend only | For development |
| `restart-backend.bat` | Restart backend | Apply config changes |
| `restart-frontend.bat` | Restart frontend | Reload UI changes |
| `stop-backend.bat` | Stop backend | Graceful shutdown |
| `stop-frontend.bat` | Stop frontend | Stop dev server |
| `stop-all.bat` | Stop all services | Complete shutdown |

### Script Examples

```batch
# Start everything
start-all.bat

# Restart backend after config change
restart-backend.bat

# Stop all services
stop-all.bat
```

---

## 🔧 Development

### Project Structure

```
pabriktokenx/
├── cmd/
│   └── server/          # Main application entry
├── internal/
│   ├── api/            # HTTP handlers
│   ├── auth/           # OAuth implementations
│   ├── config/         # Configuration management
│   └── runtime/        # Execution layer
├── sdk/                # Reusable Go SDK
├── frontend/           # React dashboard
├── examples/           # Usage examples
└── docs/              # Documentation
```

### Building from Source

```bash
# Install dependencies
go mod download

# Run tests
go test ./...

# Build with version info
go build -ldflags="-X main.Version=1.0.0 -X main.Commit=$(git rev-parse HEAD)" ./cmd/server

# Run development server
go run ./cmd/server --debug
```

### Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Type checking
npm run type-check
```

### SDK Usage

```go
package main

import (
    "context"
    "github.com/tamaproject360/pabriktokenx/sdk/cliproxy"
)

func main() {
    // Build proxy service
    service, err := cliproxy.NewBuilder().
        WithConfigPath("config.yaml").
        Build()
    if err != nil {
        panic(err)
    }
    
    // Run service
    service.Run(context.Background())
}
```

---

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

### How to Contribute

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Commit your changes**
   ```bash
   git commit -m 'Add some amazing feature'
   ```
4. **Push to the branch**
   ```bash
   git push origin feature/amazing-feature
   ```
5. **Open a Pull Request**

### Development Guidelines

- Follow Go best practices and conventions
- Write tests for new features
- Update documentation for API changes
- Ensure all tests pass before submitting PR
- Use meaningful commit messages

### Code Style

- Run `gofmt` before committing
- Follow [Effective Go](https://go.dev/doc/effective_go) guidelines
- Keep functions small and focused
- Add comments for exported functions

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Original project: [router-for-me/CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI)
- Built with [Go](https://go.dev), [Gin](https://gin-gonic.com), and [React](https://react.dev)

---

## 📞 Support

- **Documentation**: [https://help.router-for.me/](https://help.router-for.me/)
- **Issues**: [GitHub Issues](https://github.com/tamaproject360/pabriktokenx/issues)
- **Discussions**: [GitHub Discussions](https://github.com/tamaproject360/pabriktokenx/discussions)

---

<div align="center">

**Made with ❤️ by the PabrikTokenX Team**

[⬆ Back to Top](#pabriktokenx)

</div>
