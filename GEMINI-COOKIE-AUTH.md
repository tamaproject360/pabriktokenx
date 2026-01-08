# Gemini Cookie Authentication Guide

## Cara menggunakan Gemini dengan Cookies

Sekarang kamu bisa login ke Gemini menggunakan cookies dari browser, sehingga bisa akses model `gemini-2.5-flash-image` dan model lainnya.

### Method 1: Via Command Line

1. **Dapatkan cookies dari browser:**
   - Buka https://gemini.google.com di browser
   - Login dengan akun Google kamu
   - Buka Developer Tools (F12) > Application > Cookies
   - Copy semua cookies (format: `name=value; name2=value2; ...`)

2. **Login via command line:**
   ```bash
   cliproxy.exe --gemini-cookie
   ```

3. **Paste cookies saat diminta:**
   - Masukkan cookie string yang sudah kamu copy
   - Masukkan email (opsional, untuk identifikasi)
   - Auth file akan tersimpan di folder `auths/`

### Method 2: Via Web UI (Management Dashboard)

1. **Buka Management Dashboard**
   ```
   http://localhost:8080/management.html
   ```

2. **Ke halaman OAuth:**
   - Klik menu "OAuth" di sidebar
   - Scroll ke bawah, cari section "Gemini Web (Cookie)"

3. **Input cookies:**
   - Paste cookie string dari browser
   - Masukkan email (opsional)
   - Klik "Login"

4. **Auth berhasil:**
   - Refresh playground
   - Pilih provider "Gemini Web"
   - Model `gemini-2.5-flash-image` akan tersedia

### Format Cookie yang Diperlukan

Cookies harus mengandung Google session cookies, minimal:
- `SID=...`
- `__Secure-1PSID=...`
- `__Secure-3PSID=...`

Contoh format lengkap:
```
SID=g.a000...; __Secure-1PSID=g.a000...; __Secure-3PSID=g.a000...; HSID=...; SSID=...; APISID=...; SAPISID=...
```

### Model yang Tersedia

Setelah login dengan cookies, kamu bisa akses model:
- `gemini-2.5-flash`
- `gemini-2.5-flash-lite`
- `gemini-2.5-flash-image` ✨ (untuk image generation)
- `gemini-2.5-pro`
- `gemini-3-flash-preview`
- `gemini-3-pro-preview`

### Troubleshooting

**Error: "invalid cookie format"**
- Pastikan cookies mengandung `SID=` atau `__Secure-1PSID=`
- Copy ulang cookies dari browser

**Model tidak muncul di playground:**
- Restart backend: `.\restart-backend.bat`
- Refresh browser

**Image generation tidak jalan:**
- Gunakan model `gemini-2.5-flash-image`
- Pastikan prompt dalam bahasa Inggris untuk hasil terbaik

### API Endpoint

Untuk integrasi via API:
```bash
POST http://localhost:8080/api/management/gemini-web-auth-url
Content-Type: application/json

{
  "cookie": "SID=...; __Secure-1PSID=...; ...",
  "email": "user@gmail.com"
}
```

Response:
```json
{
  "status": "ok",
  "message": "Gemini Web cookie authentication successful",
  "email": "user@gmail.com",
  "file": "gemini-web-user-gmail-com-1704672000.json"
}
```

### Keuntungan Cookie Authentication

✅ **Lebih simple** - Tinggal copy-paste cookies, tidak perlu OAuth flow
✅ **Langsung jalan** - Tidak ada setup project ID atau service account
✅ **Support image generation** - Langsung bisa pakai `gemini-2.5-flash-image`
✅ **No expired token** - Cookies Google bertahan lama

### Notes

- Cookies akan expired setelah beberapa waktu, tinggal login ulang dengan cookies baru
- Jangan share cookies ke orang lain - ini sama dengan password
- Cookies tersimpan aman di folder `auths/` dengan permission 0600
