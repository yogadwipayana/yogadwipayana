# Chat AI — Test Prompts

Prompt siap-tempel untuk menguji semua fitur Chat AI. Buka `/dashboard/chat`, lalu jalankan tiap blok sesuai urutan. Catatan: ✅ = perilaku yang diharapkan.

---

## 1. Chat dasar & streaming

```
Jelaskan apa itu Docker dalam 3 kalimat.
```
✅ Jawaban muncul streaming kata-per-kata, lalu muncul 4 saran follow-up.

```
Lanjutkan dengan contoh perintah dasarnya.
```
✅ Mempertahankan konteks percakapan sebelumnya.

---

## 2. Slash commands (built-in)

### /summarize
Kirim beberapa pesan dulu, lalu:
```
/summarize
```
✅ TL;DR 1 kalimat → 3–6 poin → pertanyaan terbuka (meringkas percakapan).

```
/summarize Mitokondria adalah pembangkit tenaga sel. Ia menghasilkan ATP melalui respirasi seluler. Proses ini terjadi di membran dalam mitokondria dan sangat penting bagi metabolisme energi.
```
✅ Meringkas teks yang ditempel, bukan percakapan.

### /diagram (output teks, BUKAN gambar)
```
/diagram alur login user dengan OAuth dan database
```
✅ 1 kalimat caption + satu code block Mermaid/Graphviz. Tidak memanggil image tool.

```
/diagram state machine untuk lampu lalu lintas
```
✅ Diagram stateDiagram-v2 dalam code block.

### /word (menghasilkan .docx)
```
/word laporan satu halaman tentang manfaat kerja remote
```
✅ Memanggil tool `word_generate`, balas dengan link `[Download <judul>.docx](url)`.

```
/word
```
(setelah ada percakapan) ✅ Membuat dokumen dari percakapan sebelumnya.

---

## 3. Custom slash command

Buat dulu di `/dashboard/chat/commands`: trigger `ringkas`, content "Tulis ulang teks user agar lebih ringkas dan profesional." Lalu:
```
/ringkas jadi gini sebenernya aku tuh pengen banget bisa lebih cepet kerjanya tapi ya gitu deh suka kebanyakan mikir
```
✅ Menerapkan instruksi custom (versi ringkas & profesional).

---

## 4. System Prompts

Buat prompt di `/dashboard/chat/system-prompts`: nama "Bajak Laut", content "Selalu jawab dengan gaya bajak laut." Pilih dari dropdown "No prompt", lalu:
```
Apa itu Docker?
```
✅ Persona bajak laut konsisten, bahkan untuk sapaan biasa.

---

## 5. Mode Image

Ganti mode dari "Chat" ke "Image", lalu:
```
seekor rubah merah di hutan bersalju, sinematik
```
✅ Gambar tertanam (`![alt](url)`) + prompt yang dipakai (~60–90 detik).

```
buat lebih hangat, suasana matahari terbenam
```
✅ Memanggil `image_edit` pada gambar sebelumnya.

---

## 6. Image generation (mode Chat biasa)

```
Gambarkan kota cyberpunk neon di malam hari, format lebar.
```
✅ Tool `image_generate` jalan, gambar muncul inline.

Lampirkan sebuah foto via tombol "+", lalu:
```
Jadikan hitam putih dan hapus latar belakangnya.
```
✅ Tool `image_edit` pakai gambar sumber.

---

## 7. Memory

```
Ingat bahwa aku selalu deploy pakai Docker di Tencent Lighthouse.
```
✅ Konfirmasi singkat tersimpan; entri "AI" baru muncul di `/dashboard/chat/memory`.

```
Selalu balas aku dalam Bahasa Indonesia.
```
Lalu buka percakapan BARU dan kirim (dalam Inggris):
```
What is a reverse proxy?
```
✅ Tetap menjawab dalam Bahasa Indonesia (memory menang atas bahasa input).

Uji manual: tambah memory di halaman Memory, matikan toggle-nya, pastikan berhenti memengaruhi jawaban.

---

## 8. Tools — Web search

```
Berapa versi stabil terbaru Node.js sekarang?
```
✅ Memicu `web_search` (force-trigger karena kata "terbaru"), jawaban dengan sumber/link.

```
Ringkas halaman ini: https://nodejs.org/en/blog
```
✅ Memicu `web_fetch`.

---

## 9. Tools — Library docs (Context7)

```
Bagaimana cara setup middleware di Next.js?
```
✅ Memicu Context7 (force-trigger nama library), jawaban berbasis dokumentasi.

```
Tunjukkan cara mendefinisikan relasi schema di Prisma.
```
✅ Jawaban grounded dari docs Prisma.

---

## 10. Tools — Waktu

```
Jam berapa sekarang di Asia/Jakarta?
```
✅ Memicu `get_current_time`.

---

## 11. Tools — ask_user (klarifikasi)

```
Tolong reset BAC saya.
```
✅ Memunculkan SATU pertanyaan klarifikasi dengan opsi yang bisa diklik (akronim ambigu), turn berhenti menunggu jawaban.

```
Bantu aku setup yang itu.
```
✅ Bertanya balik untuk memperjelas.

---

## 12. Tools — VPS (read-only)

```
Ada berapa VPS yang aku punya dan apakah menyala?
```
✅ `vps_list`, langsung jalan tanpa konfirmasi.

```
Tampilkan aturan firewall di server web-ku.
```
✅ `vps_firewall_list` (read-only).

```
List SSH key aku.
```
✅ `vps_ssh_keys_list`.

---

## 13. Tools — VPS (write, butuh konfirmasi)

```
Reboot server prod-api ku.
```
✅ MINTA KONFIRMASI dulu, tidak langsung eksekusi. Lalu balas:
```
Ya, reboot sekarang.
```
✅ Baru menjalankan `vps_action` reboot.

```
Buka port 443 TCP ke 0.0.0.0/0 di server web-ku.
```
✅ Minta konfirmasi sebelum `vps_firewall_add`.

---

## 14. Tools — SSH / Terminal

(Butuh kredensial SSH tersimpan di `/dashboard/vps/terminal`)
```
Jalankan df -h di server prod-ku.
```
✅ `ssh_run` (read-only command jalan tanpa konfirmasi).

```
Buka terminal ke VPS-ku untuk install Docker.
```
✅ `open_terminal`, lalu `terminal_run` mengusulkan perintah yang harus di-Approve manual.

---

## 15. Attachments

Lampirkan gambar via "+", lalu:
```
Apa isi gambar ini?
```
✅ Model membaca gambar (vision).

Lampirkan PDF, lalu:
```
Ringkas PDF ini.
```
✅ Teks PDF diekstrak dan diringkas.

Lampirkan .docx, lalu:
```
Ekstrak action item dari dokumen ini.
```
✅ Teks dokumen diekstrak.

Batas: maks 6 lampiran, 50 MB/file. Tipe: PNG/JPEG/WebP/GIF, PDF, DOCX/XLSX/XLS/PPTX/PPT, CSV/TXT/MD.

---

## 16. Model selector

Buka dropdown model, ganti antar model dan kirim prompt pendek tiap kali:
- GPT-5.5
- Claude Opus 4.8
- Claude Opus 4.7
- Claude Sonnet 4.6

✅ Pilihan tersimpan per-percakapan (cek dengan pindah halaman lalu balik).

---

## 17. Fitur pesan

- **Regenerate** — klik regenerate pada respons terakhir ✅ respons baru.
- **Edit & resend** — edit pesan user lama ✅ membuat branch baru, bisa navigasi antar sibling.
- **Branch navigation** — pindah antar respons sibling tanpa generate ulang.
- **Continue** — jika turn berhenti karena tool budget, klik Continue.

---

## 18. Manajemen percakapan

- **Pin** percakapan ✅ pindah ke grup PINNED.
- **Archive** ✅ pindah ke `/dashboard/chat/archived`.
- **Rename** ✅ judul berubah.
- **Delete** ✅ percakapan hilang.
- **Share publik** ✅ menghasilkan link `/chat/share/<token>` read-only.
- **Export Markdown** ✅ unduh `.md` berisi transkrip + tool log + follow-up.

---

## 19. Gallery

Setelah generate gambar di chat, buka `/dashboard/chat/gallery`:
✅ Gambar muncul dengan tag source "chat". Uji copy-prompt, share-link, dan delete.

---

## 20. Tool toggles per-percakapan

Di selector Tools, matikan kategori lalu uji:
- Matikan **Web** → tanya "versi terbaru X" ✅ jawab dari memori dengan disclaimer, tidak search.
- Matikan **Images & docs (media)** → minta gambar ✅ tidak generate.
- Matikan **VPS** → minta kontrol server ✅ tidak jalan.
- Matikan **Memory** → "ingat bahwa..." ✅ tidak menyimpan.

Catatan: `get_current_time` dan `ask_user` tidak bisa dimatikan.

---

## 21. Usage tracking

Setelah beberapa pesan, buka `/dashboard/chat/usage`:
✅ Jumlah token (prompt/completion/total) dan jumlah tool-call terakumulasi.

---

## Catatan penting

- **Upscale gambar TIDAK ADA** di backend — jangan uji.
- **Masking/inpainting & hapus background** hanya lewat workspace image (`POST /api/images`), bukan dari prompt chat biasa.
- `/word` dipicu dengan menulis ulang turn user (bukan force tool), jadi pastikan perintah ada di AWAL pesan.
