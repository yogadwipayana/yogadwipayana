# Chat AI — Laporan Hasil Test Final

Tanggal: 2026-06-16
Metode: BrowserAct headed (chrome-live, profil Chrome asli), login aktif.
Server: `localhost:3000` (dev).
Acuan: `docs/PLAN.md`.

Legenda: ✅ lulus · ❌ gagal · ⚠️ catatan/parsial · ⏭️ tidak diuji

---

## Ringkasan

| # | Bagian | Status |
|---|--------|--------|
| 1 | Chat dasar & streaming | ✅ |
| 2 | Slash commands built-in (/summarize, /diagram, /word) | ✅ |
| 3 | Custom slash command (/ringkas) | ✅ |
| 4 | System Prompts (Bajak Laut) | ✅ |
| 5 | Mode Image (generate + edit) | ✅ |
| 6 | Image generation di mode Chat | ❌ |
| 7 | Memory (simpan + bahasa lintas-percakapan + toggle) | ✅ |
| 8 | Web search & web fetch | ✅ |
| 9 | Library docs (Context7) | ✅ |
| 10 | Waktu (get_current_time) | ✅ |
| 11 | ask_user (klarifikasi) | ✅ |
| 12 | VPS read-only | ✅ |
| 13 | VPS write (butuh konfirmasi) | ✅ |
| 14 | SSH / Terminal | ✅ |
| 15 | Attachments | ✅ (image+PDF), ⏭️ DOCX/XLSX/PPTX |
| 16 | Model selector | ✅ |
| 17 | Fitur pesan (regenerate/edit/branch) | ✅ |
| 18 | Manajemen percakapan | ✅ |
| 19 | Gallery | ✅ |
| 20 | Tool toggles per-percakapan | ⚠️ Fitur sudah dihapus |
| 21 | Usage tracking | ✅ |

**1 kegagalan nyata:** image generation di mode Chat (Bagian 6).

---

## Detail

### 1. Chat dasar & streaming — ✅
- "Jelaskan apa itu Docker dalam 3 kalimat" → jawaban 3 kalimat + 4 saran follow-up.
- "Lanjutkan dengan contoh perintah dasarnya" → konteks dipertahankan (lanjut topik Docker dengan perintah dasar).

### 2. Slash commands built-in — ✅
- `/summarize` (percakapan) → TL;DR 1 kalimat → 5 poin → 3 pertanyaan terbuka. Ikut menarik konteks memory (pm2/Tencent).
- `/summarize <teks>` → meringkas teks yang ditempel (mitokondria), bukan percakapan.
- `/diagram alur login OAuth` → caption + sequence diagram Mermaid (bukan image tool).
- `/diagram state machine lampu lalu lintas` → stateDiagram.
- `/word <topik>` → tool `word_generate`, link `.docx` valid (terverifikasi 11.235 byte, MIME docx benar).
- `/word` (tanpa argumen) → membuat dokumen dari percakapan sebelumnya.

### 3. Custom slash command — ✅
- Dibuat command `ringkas` di `/dashboard/chat/commands`.
- `/ringkas <teks kasual>` → ditulis ulang jadi ringkas & profesional.

### 4. System Prompts — ✅
- Dibuat prompt "Bajak Laut", dipilih dari dropdown, lalu "Apa itu Docker?" → persona bajak laut konsisten ("Ahoy!", "matey") meski pertanyaan teknis biasa.

### 5. Mode Image — ✅
- "rubah merah di hutan bersalju, sinematik" → gambar tertanam inline + prompt yang dipakai (~75 dtk). File PNG valid (2,5 MB, terverifikasi).
- "buat lebih hangat, suasana matahari terbenam" → `image_edit` pada gambar sebelumnya (prompt eksplisit "Edit gambar sebelumnya"), file baru.

### 6. Image generation di mode Chat — ❌ GAGAL
- "Gambarkan kota cyberpunk neon di malam hari, format lebar." di mode Chat → **macet di "Running image_generate…" tanpa batas** (ditunggu >11 menit).
- Diuji ulang dengan **GPT-5.5 dan Claude Opus 4.8** → keduanya macet. Jadi **bukan masalah model**.
- **Temuan penting:** gambarnya **benar-benar selesai dibuat & tersimpan** (muncul di Gallery: `1781621534119-...png`). Jadi generator/`runAndPersist` di backend OK — yang gagal adalah **pengiriman hasil ke UI chat lewat SSE stream** (stream tidak pernah menyematkan hasil & tidak menutup).
- Kontras: mode Image memakai backend yang sama dan selesai ~75 dtk. Bug khusus jalur tool-call di mode Chat.
- Saran investigasi: `src/lib/server/chat-stream.ts` (penanganan hasil tool deliverable image_generate di mode chat), bandingkan dengan jalur mode Image.

### 7. Memory — ✅
- "Ingat bahwa aku selalu deploy pakai Docker di Tencent Lighthouse" → `memory_save`, entri baru "AI" muncul di `/dashboard/chat/memory` (jadi 3 aktif).
- Memory "Selalu balas dalam Bahasa Indonesia" aktif → percakapan baru, "What is a reverse proxy?" (Inggris) → **dijawab Bahasa Indonesia** (memory menang atas bahasa input).
- Toggle: memory bahasa dimatikan → pertanyaan Inggris dijawab Inggris. Dinyalakan lagi (state dikembalikan).

### 8. Web search & fetch — ✅
- "Versi stabil terbaru Node.js?" → `web_search` (+`web_fetch`), jawaban dengan sumber/link nodejs.org, data fresh (v24 LTS / v26 Current).
- "Ringkas halaman ini: nodejs.org/en/blog" → `web_fetch` ("Completed 2 steps", 5 sources), transparan saat konten utama tak terbaca penuh.

### 9. Library docs (Context7) — ✅
- "Setup middleware di Next.js?" → `resolve-library-id` + `query-docs`, jawaban grounded (membedakan `proxy.ts` Next 16+ vs `middleware.ts` versi lama, cite docs). Catatan: streaming agak lambat (~30 dtk) tapi berhasil.
- "Relasi schema di Prisma" → "Completed 2 steps", definisi relasi akurat dari docs Prisma.

### 10. Waktu — ✅
- "Jam berapa di Asia/Jakarta?" → `get_current_time`, waktu WIB + tanggal benar (16 Juni 2026).

### 11. ask_user — ✅
- "Tolong reset BAC saya" → SATU pertanyaan klarifikasi dengan opsi yang bisa diklik (Backup Access Code, Bank/Account Code, Building Access Control, Blood Alcohol Content, Lainnya) + input bebas; turn berhenti.
- Klik "Building Access Control" → turn lanjut kontekstual sesuai pilihan.

### 12. VPS read-only — ✅
- "Ada berapa VPS & menyala?" → `vps_list` langsung jalan tanpa konfirmasi (1 VPS: Ubuntu-2, ap-jakarta, RUNNING).
- "Aturan firewall server web-ku" → `vps_firewall_list` (resolve "web-ku" → Ubuntu-2), + catatan keamanan SSH 0.0.0.0/0.
- "List SSH key" → `vps_ssh_keys_list` (MAIN, ed25519).

### 13. VPS write (konfirmasi) — ✅
- "Reboot Ubuntu-2" → **minta konfirmasi dulu** dengan rincian dampak, TIDAK langsung eksekusi. (Eksekusi nyata dilewati atas permintaan user — gate sudah terbukti.)
- "Buka port 8080 TCP ke 0.0.0.0/0" → **minta konfirmasi** + peringatan eksposur publik. Dibatalkan → "tidak mengubah firewall". Tidak ada perubahan nyata.

### 14. SSH / Terminal — ✅
- "Jalankan df -h di Ubuntu-2" → `ssh_run` jalan tanpa konfirmasi, output nyata (disk 73%).
- "Buka terminal untuk cek uname" → `open_terminal` (sesi terminal live + MOTD), `terminal_run` mengusulkan `uname -a` dengan tombol **Run/Deny** (approve manual). Klik Run → perintah jalan, output kernel nyata (Linux 6.8.0-101-generic).

### 15. Attachments — ✅ / ⏭️
- Gambar (`qris.jpg`) → vision membaca isi benar (QRIS, merchant "Dwipa", NMID).
- PDF → teks diekstrak & diringkas akurat (proposal app sembako Android).
- ⏭️ DOCX/XLSX/PPTX tidak diuji (tidak ada file sampel lokal) — pipeline attachment & ekstraksi teks terbukti jalan via image+PDF.
- Catatan teknis: input file disembunyikan (hidden), upload via BrowserAct `upload` setelah dibuat visible.

### 16. Model selector — ✅
- Ganti antar GPT-5.5 / Opus 4.8 / Opus 4.7 / Sonnet 4.6 (4 model tersedia di picker).
- Pilihan **tersimpan per-percakapan** (navigasi keluar lalu balik → tetap Opus 4.8).

### 17. Fitur pesan — ✅
- Regenerate (Retry) → respons baru.
- Edit & resend → membuat branch (indikator "2/2").
- Branch navigation → tombol "Previous branch" pindah ke sibling 1/2 tanpa generate ulang.
- Continue: tidak terpicu (hanya muncul saat turn berhenti karena tool budget) — tidak teruji.

### 18. Manajemen percakapan — ✅
- Pin → grup "Pinned" muncul (menu berubah jadi "Unpin").
- Rename → judul berubah ("PDF Sembako - Renamed Test").
- Archive → pindah ke `/dashboard/chat/archived`.
- Delete → percakapan hilang (count cyberpunk 2→1). Langsung tanpa dialog konfirmasi.
- Share publik → link `/chat/share/<token>` ter-generate, HTTP 200 (read-only).
- Export Markdown → endpoint `/export` HTTP 200, `text/markdown`, isi diawali judul + metadata.

### 19. Gallery — ✅
- `/dashboard/chat/gallery` menampilkan 9 gambar + prompt, sort newest/oldest.
- Gambar hasil chat (termasuk cyberpunk yang macet di UI) muncul di sini.
- Aksi per-kartu: Copy image, Copy share link, Delete image.
- Delete diuji → count 9→8.

### 20. Tool toggles per-percakapan — ⚠️ FITUR DIHAPUS
- Tidak ada lagi selector Tools on/off di UI.
- Dikonfirmasi via migrasi `supabase/migrations/20260616000000_drop_conversation_disabled_tools.sql`: kolom `disabled_tools` di-drop, "all tools are now always enabled".
- Bagian PLAN.md ini sudah usang — perlu dihapus/diperbarui.

### 21. Usage tracking — ✅
- `/dashboard/chat/usage`: Responses 81, Total tokens 1.1M (1.1M in / 21K out), Avg 14K, Tool calls 57.
- Grafik per-hari, token per-model (gpt-5.5 / sonnet-4.6 / opus-4.8), split prompt/completion. Akumulatif (append-only ledger).

---

## Tindak lanjut yang disarankan

1. **Perbaiki Bagian 6 (prioritas):** image_generate di mode Chat macet di UI walau backend sukses. Periksa pengiriman hasil tool deliverable image di `src/lib/server/chat-stream.ts`.
2. **Update PLAN.md:** hapus Bagian 20 (tool toggles) karena fiturnya sudah dihapus.
3. **Opsional:** lengkapi test attachment DOCX/XLSX/PPTX dengan file sampel.
4. **Catatan minor:** regenerate pada respons berbasis PDF kadang gagal baca ulang isi PDF (hasil "tidak bisa membaca") — kemungkinan re-fetch file saat retry; perlu dicek terpisah.
