# 🎨 Panduan Image Generation

## Model yang Mendukung Image Generation

Aplikasi ini mendukung image generation melalui model Gemini berikut:
- `gemini-3-pro-image-preview` ⭐ **Recommended**
- `gemini-2.5-flash-image-preview`
- `gemini-2.5-flash-image`
- `gemini-2.0-flash-exp-image-generation`

## Cara Menggunakan

### 1. Pilih Model Image Generation
Pilih salah satu model di atas dari model selector di Playground.

### 2. Tulis Prompt yang Jelas

**❌ SALAH - Prompt yang meminta deskripsi:**
```
buatkan pcx dengan gaya futuristik
```
Model akan menghasilkan **teks deskripsi** karena prompt tidak jelas meminta gambar.

**✅ BENAR - Prompt yang meminta gambar:**
```
Generate an image of a futuristic Honda PCX motorcycle with sleek aerodynamic design, 
glowing LED lights, and metallic blue finish
```

### 3. Tips Prompt untuk Hasil Terbaik

#### Gunakan Bahasa Inggris
```
Generate an image of [subject] with [details]
Create a picture of [subject] in [style]
Draw [subject] with [specific features]
```

#### Sertakan Detail Spesifik
- **Style/Gaya**: futuristic, cyberpunk, minimalist, realistic, cartoon
- **Colors/Warna**: metallic blue, matte black, neon colors
- **Lighting/Pencahayaan**: soft lighting, dramatic shadows, glowing
- **Composition/Komposisi**: close-up, wide shot, from above
- **Mood/Suasana**: energetic, calm, mysterious

#### Contoh Prompt Lengkap
```
Generate a photorealistic image of a futuristic motorcycle with:
- Sleek aerodynamic body design
- Glowing blue LED headlights
- Metallic silver finish
- Hubless wheels
- Holographic dashboard display
- Set against a dark urban background at night
```

## Troubleshooting

### Kenapa Hasilnya Teks, Bukan Gambar?

**Penyebab 1: Prompt Tidak Jelas**
- ❌ "buatkan gambar motor"
- ✅ "Generate an image of a motorcycle"

**Penyebab 2: Model Salah**
- Pastikan menggunakan model dengan kata "image" di namanya
- Cek di model selector: `gemini-3-pro-image-preview`

**Penyebab 3: Bahasa Prompt**
- Gunakan Bahasa Inggris untuk hasil optimal
- Gemini image generation dilatih dengan prompt berbahasa Inggris

### Waktu Generate Lama?

Image generation membutuhkan waktu **10-30 detik**. Ini normal karena:
- Model harus memproses prompt
- Menghasilkan gambar dari awal
- Ukuran gambar yang dihasilkan besar (biasanya 1024x1024 atau lebih)

### Error "Failed to generate image"?

Kemungkinan penyebab:
1. **API Key/Credentials tidak valid**
   - Pastikan Gemini credentials sudah dikonfigurasi
   - Cek di OAuth page atau Auth Files page

2. **Quota habis**
   - Gemini image generation menggunakan quota lebih banyak
   - Cek usage di Usage page

3. **Prompt melanggar policy**
   - Hindari prompt yang violent, explicit, atau illegal
   - Gunakan prompt yang aman dan sesuai guideline

## Contoh Penggunaan

### Kendaraan Futuristik
```
Generate an image of a futuristic hover motorcycle with transparent glass panels,
blue plasma engine trails, and chrome finish, flying over a neon-lit cyberpunk city at night
```

### Karakter
```
Create a portrait of a friendly robot with big expressive eyes, 
metallic silver body, and a warm smile, in a cartoon style with soft lighting
```

### Landscape/Pemandangan
```
Generate a serene landscape image of a floating island with waterfalls cascading into clouds,
vibrant greenery, and a sunset sky with purple and orange hues
```

### Produk/Object
```
Create a product photo of a sleek smartwatch with a holographic display,
titanium frame, and glowing interface, on a minimalist white background with soft shadows
```

## Advanced Features

### Aspect Ratio (Opsional)
Anda bisa mengatur aspect ratio dengan menambahkan parameter:

```javascript
{
  "model": "gemini-3-pro-image-preview",
  "messages": [...],
  "modalities": ["image", "text"],
  "image_config": {
    "aspect_ratio": "16:9"  // Pilihan: 1:1, 16:9, 9:16, 4:3, 3:4
  }
}
```

### Multiple Images
Beberapa model mendukung generate multiple variations. Tambahkan di prompt:
```
Generate 3 variations of a futuristic motorcycle design
```

## FAQ

**Q: Apakah bisa generate gambar orang/wajah?**  
A: Ya, tapi hasilnya mungkin stylized atau cartoon. Hindari meminta deepfake atau gambar orang nyata yang spesifik.

**Q: Berapa maksimal ukuran gambar?**  
A: Biasanya 1024x1024 pixels. Beberapa model mendukung hingga 2048x2048.

**Q: Apakah hasil gambar bisa didownload?**  
A: Ya! Hover mouse ke gambar hasil, akan muncul tombol download di pojok kanan atas.

**Q: Bisa edit gambar yang sudah dibuat?**  
A: Saat ini belum support image editing. Anda perlu generate gambar baru dengan prompt yang dimodifikasi.

**Q: Kenapa hasilnya tidak sesuai harapan?**  
A: Coba:
1. Tambah detail lebih spesifik di prompt
2. Sebutkan style yang diinginkan (realistic, cartoon, etc)
3. Generate ulang dengan prompt yang sedikit berbeda
4. Gunakan referensi visual dalam deskripsi

## Resources

- [Gemini API Documentation](https://ai.google.dev/gemini-api/docs)
- [Prompt Engineering Guide](https://www.promptingguide.ai/)
- [Example Prompts](https://prompthero.com/)
