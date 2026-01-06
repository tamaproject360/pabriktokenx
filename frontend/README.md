# CLI Proxy API - Frontend Dashboard

A modern React-based management dashboard for CLI Proxy API server.

## Tech Stack

- **Vite** - Fast build tool and dev server
- **React 18** - UI library with TypeScript
- **Tailwind CSS** - Utility-first CSS framework
- **React Router** - Client-side routing
- **TanStack Query** - Data fetching and caching
- **Lucide React** - Beautiful icons
- **Axios** - HTTP client

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- CLI Proxy API server running on port 9999

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The development server will start at http://localhost:8686 with API proxy configured to forward requests to http://localhost:9999.

### Build for Production

```bash
npm run build
```

The built files will be in the dist/ folder.

## Features

- **Dashboard** - Overview of server status and usage statistics
- **Usage Statistics** - Detailed token and request tracking per model
- **Auth Files** - Manage OAuth credential files
- **API Keys** - Configure Gemini, Claude, and OpenAI API keys
- **OAuth Login** - Login to providers using OAuth flow
- **Logs** - View and manage server logs
- **Configuration** - Edit server config.yaml
- **Routing** - Configure load balancing strategy and model mappings

## Project Structure

```
frontend/
+-- src/
�   +-- components/
�   �   +-- layout/          # Layout components (Sidebar, Header, etc.)
�   �   +-- ui/              # Reusable UI components
�   +-- contexts/            # React contexts (Auth)
�   +-- lib/                 # API client and utilities
�   +-- pages/               # Page components
�   +-- App.tsx              # Main app with routing
�   +-- main.tsx             # Entry point
�   +-- index.css            # Global styles with Tailwind
+-- index.html
+-- vite.config.ts
+-- package.json
```

## API Endpoints

The frontend communicates with the CLI Proxy API Management endpoints:

- GET/PUT /v0/management/config - Server configuration
- GET/POST /v0/management/usage - Usage statistics
- GET/POST/DELETE /v0/management/auth-files - Auth file management
- GET/PUT /v0/management/api-keys - API key management
- GET /v0/management/*-auth-url - OAuth login URLs
- GET/DELETE /v0/management/logs - Log management
- GET/PUT /v0/management/routing/strategy - Routing configuration
- GET/PUT /v0/management/ampcode/model-mappings - Model mappings

## Authentication

The dashboard requires a management key to access. This can be:

1. Set via MANAGEMENT_PASSWORD environment variable on the server
2. Configured in config.yaml under remote-management.secret-key

The key is stored in localStorage after successful login.

## Development

```bash
# Start with hot reload
npm run dev

# Type check
npm run build

# Lint
npm run lint
```

## License

MIT License - See main project LICENSE file.
