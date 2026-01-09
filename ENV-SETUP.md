# Panduan Konfigurasi Environment Variables

## ⚠️ PENTING - Keamanan OAuth

Mulai dari versi ini, semua OAuth credentials **HARUS** dikonfigurasi melalui environment variables untuk keamanan. Hardcoded credentials telah dihapus dari kode sumber.

## 📝 Langkah-langkah Konfigurasi

### 1. Buat File .env

```bash
# Windows
copy .env.example .env

# Linux/Mac
cp .env.example .env
```

### 2. Dapatkan OAuth Credentials

Kunjungi [Google Cloud Console](https://console.cloud.google.com/) dan buat OAuth 2.0 credentials:

1. Buat project baru atau pilih project yang ada
2. Aktifkan API yang diperlukan (Cloud Platform API, etc.)
3. Pergi ke **APIs & Services > Credentials**
4. Klik **Create Credentials > OAuth client ID**
5. Pilih **Desktop app** atau **Web application**
6. Salin **Client ID** dan **Client Secret**

### 3. Konfigurasi Environment Variables

Edit file `.env` dan tambahkan credentials Anda:

```bash
# Gemini OAuth (WAJIB - Client ID dan Secret)
GEMINI_OAUTH_CLIENT_ID=your-client-id.apps.googleusercontent.com
GEMINI_OAUTH_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxx

# Antigravity OAuth (WAJIB - Client ID dan Secret)
ANTIGRAVITY_OAUTH_CLIENT_ID=your-client-id.apps.googleusercontent.com
ANTIGRAVITY_OAUTH_CLIENT_SECRET=GOCSPX-yyyyyyyyyyyyyyyyyyyyyy
```

**⚠️ PENTING:** Mulai dari versi ini, Client ID juga harus dikonfigurasi melalui environment variables untuk keamanan maksimal.

### 4. Verifikasi Konfigurasi

```bash
# Windows PowerShell
$env:GEMINI_OAUTH_CLIENT_SECRET
$env:ANTIGRAVITY_OAUTH_CLIENT_SECRET

# Linux/Mac Bash
echo $GEMINI_OAUTH_CLIENT_SECRET
echo $ANTIGRAVITY_OAUTH_CLIENT_SECRET
```

## 🚀 Menjalankan Aplikasi

### Development (Local)

Aplikasi akan otomatis membaca file `.env` saat startup.

```bash
# Windows
start-all.bat

# Linux/Mac
./start-all.sh
```

### Production (Docker)

Gunakan Docker secrets atau environment variables:

```yaml
# docker-compose.yml
services:
  backend:
    environment:
      - GEMINI_OAUTH_CLIENT_SECRET=${GEMINI_OAUTH_CLIENT_SECRET}
      - ANTIGRAVITY_OAUTH_CLIENT_SECRET=${ANTIGRAVITY_OAUTH_CLIENT_SECRET}
```

Atau buat file `.env` dan gunakan:

```bash
docker-compose --env-file .env up -d
```

### Production (Kubernetes)

Gunakan Secrets:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: oauth-credentials
type: Opaque
stringData:
  gemini-secret: GOCSPX-xxxxxxxxxxxxxxxxxxxxxx
  antigravity-secret: GOCSPX-yyyyyyyyyyyyyyyyyyyyyy
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: pabriktokenx
spec:
  containers:
  - name: backend
    env:
    - name: GEMINI_OAUTH_CLIENT_SECRET
      valueFrom:
        secretKeyRef:
          name: oauth-credentials
          key: gemini-secret
    - name: ANTIGRAVITY_OAUTH_CLIENT_SECRET
      valueFrom:
        secretKeyRef:
          name: oauth-credentials
          key: antigravity-secret
```

## ⚙️ Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_OAUTH_CLIENT_ID` | ✅ Yes | None | Google OAuth Client ID untuk Gemini |
| `GEMINI_OAUTH_CLIENT_SECRET` | ✅ Yes | None | Google OAuth Client Secret untuk Gemini |
| `ANTIGRAVITY_OAUTH_CLIENT_ID` | ✅ Yes | None | Google OAuth Client ID untuk Antigravity |
| `ANTIGRAVITY_OAUTH_CLIENT_SECRET` | ✅ Yes | None | Google OAuth Client Secret untuk Antigravity |

## 🔒 Best Practices Keamanan

1. **Jangan pernah** commit file `.env` ke version control
2. **Selalu** gunakan secrets management di production
3. **Rotasi** credentials secara berkala (recommended: 90 hari)
4. **Gunakan** credentials terpisah untuk development dan production
5. **Batasi** permissions OAuth scope seminimal mungkin
6. **Monitor** penggunaan credentials untuk aktivitas mencurigakan

## 🐛 Troubleshooting

### Error: "OAuth client secret not configured"

**Penyebab:** Environment variable `GEMINI_OAUTH_CLIENT_SECRET` atau `ANTIGRAVITY_OAUTH_CLIENT_SECRET` tidak disetel.

**Solusi:**
```bash
# Periksa file .env sudah ada dan terisi dengan benar
cat .env  # Linux/Mac
type .env  # Windows

# Pastikan environment variables ter-load
echo $GEMINI_OAUTH_CLIENT_SECRET
```

### Error: "Invalid OAuth credentials"

**Penyebab:** Credentials yang dimasukkan salah atau sudah kadaluarsa.

**Solusi:**
1. Verifikasi credentials di Google Cloud Console
2. Generate credentials baru jika perlu
3. Update file `.env` dengan credentials yang benar
4. Restart aplikasi

### OAuth Login Gagal

**Penyebab:** Redirect URI tidak cocok dengan konfigurasi di Google Cloud Console.

**Solusi:**
1. Cek Authorized Redirect URIs di Google Cloud Console
2. Tambahkan `http://localhost:8085/oauth2callback` dan `http://localhost:19121/oauth2callback`
3. Tunggu beberapa menit untuk propagasi perubahan

## 📚 Referensi

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [12-Factor App: Config](https://12factor.net/config)
- [OWASP: Secure Coding Practices](https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/)

## 📞 Dukungan

Jika Anda mengalami masalah:
1. Baca [SECURITY.md](SECURITY.md) untuk security guidelines
2. Periksa [Issues](https://github.com/tamaproject360/pabriktokenx/issues) yang ada
3. Buat issue baru dengan detail masalah (tanpa menyertakan credentials!)
