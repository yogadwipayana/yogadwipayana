# SMS OTP — Temuan Keamanan

Tinjauan keamanan atas tool SMS OTP dan saldo prabayar yang menjaganya. Setiap
temuan di bawah punya tingkat keparahan, cara eksploitasi konkret yang bisa
dijalankan user sungguhan, dan cara menutupnya. Dua temuan Critical sama-sama
memungkinkan user yang sudah login mencetak saldo tanpa batas, lalu dari situ
mengambil nomor SMS gratis dengan biaya ditanggung operator.

> **Cara temuan ini diverifikasi.** Semua probe memakai *publishable key*
> (`sb_publishable…`) — kunci yang ikut terkirim di bundle browser dan terbaca
> oleh setiap pengunjung lewat DevTools. Apa pun yang bisa dilakukan kunci itu,
> bisa dilakukan user tanpa menyentuh route API kita.
> `NEXT_PUBLIC_SUPABASE_URL` bernilai `https://qdombcgzuhivuvfjivfq.supabase.co`.

**Keterangan status:** 🔴 terbuka · 🟢 sudah ditutup

| # | Keparahan | Temuan | Status |
|---|-----------|--------|--------|
| 1 | Critical | `credit_balance` / `debit_balance` bisa dipanggil langsung oleh user mana pun | 🔴 |
| 2 | Critical | `sms_order` / `sms_message` bisa ditulis pemiliknya (memalsukan refund) | 🔴 |
| 3 | High | Refund hanya jalan saat user membuka halaman (tak ada rekonsiliasi) | 🔴 |
| 4 | High | Resend berbayar bisa menelan charge saat gagal separuh jalan | 🔴 |
| 5 | Medium | `/api/sms/status` tanpa rate limit (membakar kuota provider) | 🔴 |
| 6 | Medium | Tak ada idempotensi pada `sms_message` — dua tab menggelembungkan hitungan kode | 🔴 |
| 7 | Low | Pemeriksaan `MAX_OPEN_ORDERS` tidak atomik | 🔴 |
| 8 | Low | `getBalance` di halaman SMS tak dijaga — satu kegagalan baca membuat halaman 500 | 🔴 |

---

## 1. 🔴 Critical — User yang sudah login bisa mencetak saldo tanpa batas

**Lokasi:** `supabase/migrations/20260721000000_balance.sql` — function
`credit_balance` / `debit_balance` beserta grant-nya.

**Asumsi yang dipercaya keliru.** Migrasi ini menutup tabel dengan rapi: tak ada
policy INSERT atau UPDATE, jadi uang semestinya hanya bergerak lewat dua
security-definer function. Komentarnya sendiri berbunyi *"money only moves
through the security-definer functions below, so a leaked anon key can never
mint credit."* Masalahnya, function itulah percetakannya, dan PostgREST
mengeksposnya ke setiap user sebagai `POST /rest/v1/rpc/<nama>`.

**Kenapa `revoke` tidak menolong.** Migrasi ditutup dengan:

```sql
revoke all on function public.credit_balance(...) from public;
grant execute on function public.credit_balance(...) to authenticated;
```

`revoke … from public` hanya menyentuh pseudo-role `PUBLIC`. Supabase juga
memberi `EXECUTE` ke `anon` dan `authenticated` secara default saat function
dibuat, dan — lebih parah — baris terakhir memberikannya lagi ke
`authenticated` secara eksplisit. Jadi user yang login diperbolehkan
memanggilnya.

**Bukti (publishable key, tanpa sesi = belum login):**

```
POST /rest/v1/rpc/credit_balance
  { "p_amount": 999999, "p_kind": "topup", "p_reference": "PROBE", "p_description": "probe" }
→ 400 { "code": "P0001", "message": "UNAUTHORIZED" }
```

`P0001` ini menentukan. Itu bukan PostgREST menolak panggilan — penolakan izin
akan berbunyi `42501 permission denied for function`. `P0001` adalah
`raise exception 'UNAUTHORIZED'` milik kita sendiri yang menyala **dari dalam
badan function**, artinya panggilannya lolos pemeriksaan grant dan benar-benar
dieksekusi. Satu-satunya yang menghentikannya adalah `auth.uid()` bernilai null
karena probe belum login.

**Eksploitasi (user login sungguhan).** Dengan sesi yang sah, `auth.uid()`
bernilai id mereka dan function berjalan sampai selesai:

```
POST /rest/v1/rpc/credit_balance
  Authorization: Bearer <access token user itu sendiri, langsung dari browser>
  { "p_amount": 100000000, "p_kind": "topup", "p_reference": "<uuid baru mana pun>" }
→ saldo += Rp100.000.000
```

Ulangi dengan `p_reference` baru sesukanya (unique index hanya memblokir
*pemakaian ulang* reference, bukan pembuatan yang baru). Tanpa voucher, tanpa
route API, tanpa rate limit — panggilan PostgREST langsung. Dari situ setiap
nomor SMS praktis gratis, dibayar dari kredit SMSPool operator.

**Perbaikan.** Cabut percetakan itu dari sisi client sepenuhnya.

1. Cabut execute dari role client:

   ```sql
   revoke execute on function public.credit_balance(bigint,text,text,text) from anon, authenticated;
   revoke execute on function public.debit_balance(bigint,text,text,text)  from anon, authenticated;
   ```

2. Function tak bisa lagi membaca `auth.uid()` (bernilai null di bawah service
   role), jadi tambahkan parameter eksplisit `p_user uuid` dan pakai itu
   menggantikan `auth.uid()`. Pertahankan penjagaan internal
   `UNAUTHORIZED`/`INVALID_*`.

3. Panggil hanya dari server lewat `createAdminClient()`
   (`src/utils/supabase/admin.ts`), meneruskan id yang di-resolve dari sesi di
   route — jangan pernah dari body request. `creditBalance` / `debitBalance` di
   `balance-service.ts` menjadi satu-satunya pemanggil.

Setelah diperbaiki, mengulang probe di atas harus mengembalikan **`42501
permission denied for function credit_balance`** — bukti bahwa grant-nya, bukan
sekadar penjagaan di badan function, yang kini menghentikannya.

---

## 2. 🔴 Critical — Pemilik bisa mengarang order dan refund dengan menulis tabel langsung

**Lokasi:** `supabase/migrations/20260720000000_sms_order.sql` dan
`20260720020000_sms_message.sql` — keduanya memakai policy `for all`.

**Celahnya.** `for all` memberi pemilik INSERT, UPDATE, dan DELETE, bukan hanya
SELECT. Anon tetap terblokir (terverifikasi di bawah), tapi user yang *login*
adalah pemilik barisnya sendiri sehingga policy mengizinkannya menulis. Logika
refund di `sms-service.ts` memercayai kolom-kolom pada baris itu — `charge_ref`,
`charged_idr`, `charge_delivered`, `status`, `expires_at` — yang semuanya kini
dikendalikan user.

**Bukti (anon benar terblokir; intinya apa yang diizinkan bagi *pemilik*):**

```
POST /rest/v1/sms_order   (publishable key, tanpa sesi)
  { "user_id": "…", "order_id": "PROBE", … }
→ 401 { "code": "42501", "message": "new row violates row-level security policy for table \"sms_order\"" }
```

Klausa `with check` pada RLS adalah `user_id = auth.uid()`. Bagi user login yang
memasukkan `user_id` *miliknya sendiri*, pemeriksaan itu lolos — persis yang
memblokir anon justru meloloskan pemilik.

**Eksploitasi A — mengarang order yang bisa direfund:**

1. `POST /rest/v1/sms_order` dengan `user_id` sendiri, `order_id` acak,
   `charge_ref` uuid acak, `charged_idr: 5000`, `status: 'pending'`,
   `charge_delivered: false`, dan `expires_at` di masa lalu.
2. Buka dashboard. `refreshOrders` melihat order pending, bertanya ke SMSPool,
   yang tak mengenali `order_id` palsu itu, jadi `isExpired` → status `expired`
   → `settleRefund` mengembalikan `charged_idr`. Saldo bertambah untuk nomor
   yang tak pernah ada.

**Eksploitasi B — membatalkan penyelesaian order asli:**

```
PATCH /rest/v1/sms_order?id=eq.<order completed milik sendiri>
  { "charge_delivered": false }
```

Lalu tekan **Cancel & refund**. Ini langsung membuka kembali bug free-number
resend→cancel yang baru kita tutup — penjagaan server membaca
`charge_delivered`, dan client barusan menyetelnya ke `false`. Order → ambil
kode → balikkan flag → cancel → simpan OTP dan uangnya.

Perbaikan `charge_delivered` kemarin memindahkan keputusan uang ke sebuah kolom
yang ternyata bisa ditulis pemiliknya, dan itulah yang membuat Eksploitasi B
mungkin.

**Perbaikan.** Jadikan tabel ini hanya-baca bagi client dan alirkan setiap
penulisan lewat server.

1. Ganti policy-nya:

   ```sql
   drop policy if exists "sms_order_owner" on public.sms_order;
   create policy "sms_order_owner_read" on public.sms_order
     for select using (user_id = (select auth.uid()));

   drop policy if exists "sms_message_owner" on public.sms_message;
   create policy "sms_message_owner_read" on public.sms_message
     for select using (exists (
       select 1 from public.sms_order o
       where o.id = sms_message.sms_order_id and o.user_id = (select auth.uid())
     ));
   ```

2. Pindahkan setiap insert/update di `sms-service.ts` (`createOrder`,
   `applyPatch`, `recordMessage`, `resendOrder`) ke `createAdminClient()`,
   masing-masing di-scope eksplisit dengan `.eq("user_id", userId)` / id baris
   yang dimiliki — persis kontrak yang sudah tertulis di atas `admin.ts`.
   Pembacaan yang mengisi dashboard boleh tetap di client cookie-scoped supaya
   RLS tetap membatasinya.

Uji ulang setelahnya: `PATCH` di Eksploitasi B harus mengembalikan **`42501`**,
dan `POST` palsu di Eksploitasi A juga harus **`42501`**.

---

## 3. 🟠 High — Refund baru terjadi saat user kembali

**Lokasi:** `settleRefund` hanya dicapai lewat `refreshOrders`
(`sms-service.ts`), yang jalan saat polling dashboard.

**Dampak.** User memesan nomor, SMS tak datang, tab ditutup. Tak ada yang
merekonsiliasi order itu di sisi server, sehingga Rp5.000 miliknya tertahan
sampai ia membuka halaman lagi — yang mungkin tak pernah. Ini uang milik user
sendiri yang tersangkut, bukan uang operator, jadi ini soal
kebenaran/kepercayaan, bukan pencurian — karena itu High, bukan Critical.

**Perbaikan.** Job terjadwal (route cron atau worker) yang berkala memuat order
`pending` yang telah melewati `expires_at` untuk semua user, menjalankan jalur
rekonsiliasi-dan-penyelesaian yang sama, dan merefund di sisi server tanpa perlu
kunjungan. Pakai ulang logika `refreshOrders` agar ada satu jalur penyelesaian,
bukan dua.

---

## 4. 🟠 High — Resend berbayar bisa menelan charge saat gagal separuh jalan

**Lokasi:** `resendOrder` di `sms-service.ts`.

**Celahnya.** `resendOrder` kini memotong Rp5.000 sebelum memanggil provider dan
merefund bila panggilan provider melempar error — bagus. Tapi bila `resendSms`
**berhasil** lalu `applyPatch` berikutnya (menulis `charge_ref` baru ke baris)
gagal, debit sudah terjadi dan tak ada lagi baris yang menunjuk ke `charge_ref`
itu. Tak ada yang bisa menemukannya untuk direfund. Bandingkan dengan
`createOrder` yang merefund saat insert gagal; jalur resend tak punya padanan
untuk patch yang gagal.

**Perbaikan.** Bungkus pekerjaan pasca-charge sehingga kegagalan apa pun setelah
debit memanggil `refundCharge(supabase, chargeRef, price, …)` sebelum melempar
ulang — cerminkan `try/catch` yang sudah menjaga panggilan provider, diperluas
untuk mencakup patch-nya.

---

## 5. 🟡 Medium — `/api/sms/status` tanpa rate limit

**Lokasi:** `src/app/api/sms/status/route.ts`.

**Dampak.** Setiap panggilan menyebar ke tiga endpoint SMSPool (balance, price,
stock). Ini satu-satunya route SMS tanpa `checkRateLimit`, sehingga user yang
menahan tombol — atau sebuah skrip — berlipat ganda langsung ke provider dan
bisa membakar kuota API operator atau memicu throttling di sisi provider.

**Perbaikan.** Tambahkan bucket `ratelimits.smsStatus` (mis. 30/1m) dan jaga
route ini seperti yang lain. Opsional, cache availability beberapa detik di sisi
server, karena stock/price nyaris tak berubah.

---

## 6. 🟡 Medium — Tak ada idempotensi pada `sms_message`

**Lokasi:** `recordMessage` / tabel `sms_message`.

**Dampak.** Dua tab dashboard (atau dua polling yang tumpang tindih) bisa
sama-sama mengamati transisi kode yang sama dan sama-sama `insert` ke
`sms_message`. Tak ada unique constraint, jadi kode yang sama tercatat dua kali
dan hitungan "delivered codes" seumur hidup (`deliveredCodeTotal`) menggelembung.
Tak ada uang bergerak, tapi angka yang dilihat user jadi salah.

**Perbaikan.** Tambahkan `unique (sms_order_id, code)` pada `sms_message` dan
biarkan `recordMessage` menelan pelanggaran unik `23505` sebagai no-op — pola
idempotensi yang sama yang sudah dipakai ledger.

---

## 7. 🔵 Low — `MAX_OPEN_ORDERS` diperiksa lalu ditulis, tidak atomik

**Lokasi:** `createOrder` di `sms-service.ts`.

**Dampak.** Count dan insert adalah dua statement terpisah. Rate limit order
mengizinkan 5/menit sementara cap-nya 3, sehingga request beruntun bisa
menyelipkan order terbuka keempat melewati pemeriksaan. Dampak kecil karena user
tetap membayar setiap nomor.

**Perbaikan.** Terapkan di database — partial unique/exclusion atau count di
dalam trigger — alih-alih read-then-write di kode aplikasi.

---

## 8. 🔵 Low — `getBalance` di halaman SMS tak dijaga

**Lokasi:** `src/app/dashboard/sms/page.tsx` — `await getBalance(...)` terakhir
tidak dibungkus, sedangkan `getAvailability` dan `listOrders` di atasnya sengaja
best-effort.

**Dampak.** Bila pembacaan wallet gagal, seluruh halaman 500, padahal desain di
sekitarnya memilih tetap render dengan data terdegradasi saat gagal.

**Perbaikan.** Bungkus seperti tetangganya dan fallback ke `0` (atau keadaan
"balance unavailable") agar error wallet sesaat tak menjatuhkan tool-nya.

---

## Checklist uji ulang

Jalankan setelah perbaikan diterapkan. Temuan 1 dan 2 yang harus berbalik dari
🔴 ke 🟢 sebelum tool ini dibuka ke siapa pun selain operator.

- [ ] **#1** `POST /rpc/credit_balance` dengan publishable key → `42501`, bukan `P0001`.
- [ ] **#1** `POST /rpc/debit_balance` dengan publishable key → `42501`.
- [ ] **#2** `PATCH /sms_order?id=eq.<baris sendiri>` menyetel `charge_delivered:false` → `42501`.
- [ ] **#2** `POST /sms_order` dengan `user_id` sendiri → `42501`.
- [ ] Alur normal tetap jalan ujung-ke-ujung (order, terima kode, cancel, resend) lewat route API.
- [ ] **#4** Simulasikan `applyPatch` gagal setelah resend berhasil → saldo direfund.
- [ ] **#5** Menghajar `/api/sms/status` mengembalikan `429` setelah bucket habis.
