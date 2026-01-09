# Docker Deployment Guide

Panduan lengkap untuk deploy aplikasi PabrikTokenX menggunakan Docker.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- Minimum 2GB RAM
- Minimum 10GB disk space

## Quick Start

### 1. Production Deployment

```bash
# Clone repository (jika belum)
git clone <repository-url>
cd pabriktokenx

# Pastikan config.yaml sudah dikonfigurasi
cp config.example.yaml config.yaml
# Edit config.yaml sesuai kebutuhan

# Build dan jalankan
docker-compose up -d

# Cek status
docker-compose ps

# Lihat logs
docker-compose logs -f
```

Aplikasi akan berjalan di:
- Backend API: http://localhost:9999
- Frontend: http://localhost:3000

### 2. Development Mode

```bash
# Jalankan dalam mode development dengan hot-reload
docker-compose -f docker-compose.dev.yml up

# Frontend akan berjalan di port 5173 (Vite dev server)
```

## Konfigurasi

### Environment Variables

Anda dapat mengatur environment variables di file `docker-compose.yml` atau membuat file `.env`:

```env
# .env file (optional)
BACKEND_PORT=9999
FRONTEND_PORT=3000
TZ=Asia/Jakarta
```

### Volume Persistence

Data penting disimpan di volumes berikut:
- `./auths` - Kredensial autentikasi
- `./logs` - Log aplikasi
- `./assets` - File assets
- `./config.yaml` - Konfigurasi aplikasi

## Docker Commands

### Build

```bash
# Build semua services
docker-compose build

# Build service tertentu
docker-compose build backend
docker-compose build frontend

# Build tanpa cache
docker-compose build --no-cache
```

### Run

```bash
# Start services
docker-compose up -d

# Start service tertentu
docker-compose up -d backend

# Start dengan logs
docker-compose up
```

### Stop

```bash
# Stop semua services
docker-compose down

# Stop dan hapus volumes
docker-compose down -v

# Stop service tertentu
docker-compose stop backend
```

### Logs

```bash
# Lihat semua logs
docker-compose logs

# Follow logs real-time
docker-compose logs -f

# Logs service tertentu
docker-compose logs -f backend
docker-compose logs -f frontend

# Lihat 100 baris terakhir
docker-compose logs --tail=100
```

### Restart

```bash
# Restart semua services
docker-compose restart

# Restart service tertentu
docker-compose restart backend
```

### Exec (masuk ke container)

```bash
# Masuk ke backend container
docker-compose exec backend sh

# Masuk ke frontend container
docker-compose exec frontend sh

# Jalankan command di container
docker-compose exec backend ./server --version
```

## Production Deployment

### Dengan Reverse Proxy (Nginx/Traefik)

Jika menggunakan reverse proxy di host:

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  backend:
    # ... config sama ...
    ports:
      - "127.0.0.1:9999:9999"  # Hanya expose ke localhost
    
  frontend:
    # ... config sama ...
    ports:
      - "127.0.0.1:3000:80"  # Hanya expose ke localhost
```

Kemudian konfigurasi Nginx di host:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /v1/ {
        proxy_pass http://localhost:9999;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Dengan SSL/HTTPS

Gunakan Let's Encrypt atau sertifikat lain di host reverse proxy Anda.

## Update Aplikasi

```bash
# Pull update terbaru
git pull

# Rebuild dan restart
docker-compose down
docker-compose build
docker-compose up -d

# Atau gunakan
docker-compose up -d --build
```

## Troubleshooting

### Container tidak start

```bash
# Cek logs
docker-compose logs backend

# Cek status
docker-compose ps

# Rebuild
docker-compose build --no-cache backend
docker-compose up -d
```

### Port sudah digunakan

Edit `docker-compose.yml` dan ubah port mapping:

```yaml
ports:
  - "8888:9999"  # Gunakan port 8888 di host
```

### Volume permission issues

```bash
# Set ownership (Linux/Mac)
sudo chown -R 1000:1000 ./auths ./logs ./assets

# Atau jalankan container sebagai user tertentu
docker-compose exec -u root backend chown -R 1000:1000 /app/auths
```

### Memory issues

Tambahkan memory limits di `docker-compose.yml`:

```yaml
services:
  backend:
    # ... config lain ...
    deploy:
      resources:
        limits:
          memory: 1G
        reservations:
          memory: 512M
```

## Monitoring

### Health Checks

```bash
# Cek health status
docker-compose ps

# Manual health check
curl http://localhost:9999/v1/models
```

### Resource Usage

```bash
# Lihat resource usage
docker stats

# Lihat hanya untuk pabriktokenx
docker stats pabriktokenx-backend pabriktokenx-frontend
```

## Backup & Restore

### Backup

```bash
# Backup volumes
docker run --rm \
  -v pabriktokenx_auths-data:/data/auths \
  -v pabriktokenx_logs-data:/data/logs \
  -v $(pwd):/backup \
  alpine tar czf /backup/pabriktokenx-backup-$(date +%Y%m%d).tar.gz -C /data .

# Atau backup directory langsung
tar czf pabriktokenx-backup-$(date +%Y%m%d).tar.gz auths logs config.yaml
```

### Restore

```bash
# Extract backup
tar xzf pabriktokenx-backup-YYYYMMDD.tar.gz

# Restart services
docker-compose restart
```

## Clean Up

```bash
# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Clean everything
docker system prune -a --volumes
```

## Security Best Practices

1. **Jangan commit config.yaml** dengan kredensial ke repository
2. **Gunakan secrets** untuk production:
   ```yaml
   services:
     backend:
       secrets:
         - api_key
   secrets:
     api_key:
       file: ./secrets/api_key.txt
   ```
3. **Update regularly** - Rebuild images untuk security patches
4. **Limit resources** - Gunakan resource limits
5. **Network isolation** - Gunakan custom networks
6. **Read-only volumes** untuk config files:
   ```yaml
   volumes:
     - ./config.yaml:/app/config.yaml:ro
   ```

## Advanced Configuration

### Multi-stage Production Build

Dockerfile sudah menggunakan multi-stage build untuk ukuran image yang lebih kecil.

### Custom Network

```bash
# Buat network sendiri
docker network create pabriktokenx-net

# Update docker-compose.yml untuk menggunakan network external
```

### Health Checks

Health checks sudah dikonfigurasi di docker-compose.yml. Container akan restart otomatis jika health check gagal.

## Support

Jika ada masalah, cek:
1. Logs: `docker-compose logs -f`
2. Container status: `docker-compose ps`
3. Resources: `docker stats`
4. Network: `docker network inspect pabriktokenx-network`
