# 🚨 PERUBAHAN PENTING - OAuth Credentials

## ⚠️ Breaking Change Notice

**Versi ini mengharuskan semua OAuth credentials (Client ID dan Client Secret) dikonfigurasi melalui environment variables.**

Hardcoded credentials telah **sepenuhnya dihapus** dari kode sumber untuk keamanan maksimal.

## 🔧 Cara Memperbaiki

### Langkah 1: Revoke Credentials Lama

Karena credentials lama sudah ter-expose di GitHub, **segera revoke** credentials tersebut:

1. Buka [Google Cloud Console](https://console.cloud.google.com/)
2. Pilih project Anda
3. Pergi ke **APIs & Services > Credentials**
4. Hapus atau revoke OAuth 2.0 Client IDs berikut:
   - `681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j` (Gemini)
   - `1071006060591-tmhssin2h21lcre235vtolojh4g403ep` (Antigravity)

### Langkah 2: Buat Credentials Baru

1. Di Google Cloud Console, klik **Create Credentials > OAuth client ID**
2. Pilih application type: **Desktop app** atau **Web application**
3. Untuk **Web application**, tambahkan Authorized redirect URIs:
   ```
   http://localhost:8085/oauth2callback
   http://localhost:19121/oauth2callback
   ```
4. Klik **Create**
5. **Salin Client ID dan Client Secret** yang baru

### Langkah 3: Konfigurasi Environment Variables

Buat atau edit file `.env`:

```bash
# Windows
copy .env.example .env
notepad .env

# Linux/Mac
cp .env.example .env
nano .env
```

Tambahkan credentials baru:

```bash
# Gemini OAuth - WAJIB
GEMINI_OAUTH_CLIENT_ID=your-new-client-id.apps.googleusercontent.com
GEMINI_OAUTH_CLIENT_SECRET=GOCSPX-your-new-secret-here

# Antigravity OAuth - WAJIB
ANTIGRAVITY_OAUTH_CLIENT_ID=your-new-client-id.apps.googleusercontent.com
ANTIGRAVITY_OAUTH_CLIENT_SECRET=GOCSPX-your-new-secret-here
```

### Langkah 4: Verifikasi Konfigurasi

```bash
# Windows PowerShell
Get-Content .env

# Linux/Mac
cat .env
```

Pastikan semua 4 environment variables terisi:
- ✅ GEMINI_OAUTH_CLIENT_ID
- ✅ GEMINI_OAUTH_CLIENT_SECRET
- ✅ ANTIGRAVITY_OAUTH_CLIENT_ID
- ✅ ANTIGRAVITY_OAUTH_CLIENT_SECRET

### Langkah 5: Jalankan Aplikasi

```bash
# Windows
start-all.bat

# Linux/Mac
./start-all.sh
```

## 🔍 Troubleshooting

### Error: "OAuth client ID not configured"

**Penyebab:** Environment variable `GEMINI_OAUTH_CLIENT_ID` atau `ANTIGRAVITY_OAUTH_CLIENT_ID` tidak disetel atau kosong.

**Solusi:**
1. Pastikan file `.env` ada di root directory
2. Periksa isi file `.env` sudah benar
3. Restart aplikasi setelah mengubah `.env`

### Error: "invalid_client"

**Penyebab:** Client ID atau Client Secret salah.

**Solusi:**
1. Verifikasi credentials di Google Cloud Console
2. Pastikan tidak ada spasi atau karakter tersembunyi saat copy-paste
3. Generate credentials baru jika masih error

### Aplikasi Tidak Bisa Start

**Penyebab:** Missing environment variables.

**Solusi:**
```bash
# Periksa apakah .env ter-load
# Windows PowerShell
$env:GEMINI_OAUTH_CLIENT_ID
$env:GEMINI_OAUTH_CLIENT_SECRET

# Linux/Mac
echo $GEMINI_OAUTH_CLIENT_ID
echo $GEMINI_OAUTH_CLIENT_SECRET
```

Jika kosong, pastikan aplikasi Anda membaca file `.env` dengan benar.

## 📋 Checklist Migrasi

- [ ] Revoke credentials lama di Google Cloud Console
- [ ] Buat OAuth credentials baru
- [ ] Buat file `.env` dari `.env.example`
- [ ] Isi semua 4 environment variables yang required
- [ ] Verifikasi file `.env` ada di `.gitignore`
- [ ] Test aplikasi bisa start dengan credentials baru
- [ ] Hapus backup credentials lama (jika ada)

## 🔒 Keamanan

**JANGAN PERNAH:**
- ❌ Commit file `.env` ke Git
- ❌ Share credentials di chat/email
- ❌ Hardcode credentials di kode
- ❌ Gunakan credentials production di development

**SELALU:**
- ✅ Gunakan environment variables
- ✅ Rotasi credentials secara berkala
- ✅ Gunakan credentials terpisah untuk dev/prod
- ✅ Monitor penggunaan credentials

## 📚 Dokumentasi Lengkap

- **Setup Guide**: [ENV-SETUP.md](ENV-SETUP.md)
- **Security Guide**: [SECURITY.md](SECURITY.md)
- **Main README**: [README.md](README.md)

## 💬 Bantuan

Jika masih mengalami masalah:
1. Baca dokumentasi lengkap di atas
2. Check existing [GitHub Issues](https://github.com/tamaproject360/pabriktokenx/issues)
3. Buat issue baru dengan detail error (TANPA credentials!)

---

**Perubahan ini dibuat untuk keamanan aplikasi Anda. Terima kasih atas pengertiannya! 🙏**
