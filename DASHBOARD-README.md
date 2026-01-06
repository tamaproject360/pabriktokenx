# CLI Proxy API - Dashboard Setup

Frontend Dashboard untuk CLI Proxy API Management menggunakan Vite + React + Tailwind CSS.

## 🚀 Quick Start

### Menjalankan Semua Service
```bash
start-all.bat
```
Akan membuka 2 terminal:
- **Backend**: http://localhost:9999
- **Frontend**: http://localhost:8686

### Menjalankan Service Terpisah

**Backend saja:**
```bash
start-backend.bat
```

**Frontend saja:**
```bash
start-frontend.bat
```

**Restart Backend:**
```bash
restart-backend.bat
```

**Stop Backend:**
```bash
stop-backend.bat
```

## 🔑 Management Key

**Key:** `admin123`

Masukkan key ini di halaman login dashboard (http://localhost:8686)

## 📦 Port Configuration

- **Backend API**: Port 9999
- **Frontend Dashboard**: Port 8686

## 🛠️ Stack

- **Frontend**: Vite 7.3.0 + React 18 + TypeScript
- **Styling**: Tailwind CSS 4.x
- **Routing**: React Router DOM v7
- **State**: React Query (TanStack Query)
- **Icons**: Lucide React
- **HTTP Client**: Axios

## 📁 Frontend Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── layout/          # Sidebar, Header, Layout
│   │   └── ui/              # Reusable UI components
│   ├── contexts/            # Auth context
│   ├── lib/                 # API client
│   ├── pages/               # Dashboard pages
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Usage.tsx
│   │   ├── AuthFiles.tsx
│   │   ├── APIKeys.tsx
│   │   ├── OAuth.tsx
│   │   ├── Logs.tsx
│   │   ├── Config.tsx
│   │   └── Routing.tsx
│   └── App.tsx
└── vite.config.ts
```

## 🔧 Konfigurasi

### Backend Port (config.yaml)
```yaml
port: 9999
remote-management:
  allow-remote: true
  secret-key: "$2a$10$..." # bcrypt hash dari "admin123"
```

### Frontend Port (vite.config.ts)
```typescript
server: {
  port: 8686,
  proxy: {
    '/v0': {
      target: 'http://localhost:9999',
      changeOrigin: true,
    },
  },
}
```

## 📝 Notes

- Backend menggunakan `go run` (tidak perlu build)
- Secret key otomatis di-hash dengan bcrypt saat pertama kali digunakan
- Frontend menggunakan Vite proxy untuk menghindari CORS
- Semua .bat scripts menggunakan `cmd /k` agar terminal tetap terbuka

## ✅ Verifikasi

Buka browser:
1. Frontend: http://localhost:8686
2. Login dengan key: `admin123`
3. Dashboard akan menampilkan statistik server

Backend API:
- http://localhost:9999/v0/management/config (butuh X-Secret-Key header)
