# Panduan unduh DEMNAS (sekali saja, ±30–60 menit)

Kamu cukup **mengunduh** dan **mengunggah** file. Tidak perlu mengolah apa pun.

## Bagian A — Masuk ke portal
1. Buka **https://tanahair.indonesia.go.id** di Chrome.
2. Klik **Masuk / Login** (pojok kanan atas). Belum punya akun → klik **Daftar**, isi data, lalu cek email untuk aktivasi.
3. Setelah masuk, cari menu **Unduh** (ikon panah ke bawah di sisi kiri) → pilih **DEMNAS**.
4. Jika muncul halaman **syarat/ketentuan penggunaan**, tolong **foto layar (screenshot)** halaman itu dan kirim ke chat. Saya perlu tahu apakah DEMNAS boleh disebarkan ulang.

## Bagian B — Unduh 25 tile
Peta akan menampilkan kotak-kotak bernomor. Perbesar ke Jakarta, lalu klik setiap kotak di daftar ini dan klik **Unduh**.
Nama file biasanya `DEMNAS_<nomor>_v1.0.tif` (kadang berupa `.zip` — tidak apa-apa, unggah apa adanya).

Tip: buka app Banjir3D → **Peta** → nyalakan lapisan **"Grid tile DEMNAS"** untuk melihat posisi tiap nomor di peta.

| Baris (dari selatan ke utara) | Nomor tile (barat → timur) |
|---|---|
| 1 (Bogor selatan, Puncak) | 1109-32 · 1209-11 · 1209-12 · 1209-21 · 1209-22 |
| 2 (Bogor, Cibinong) | 1109-34 · 1209-13 · 1209-14 · 1209-23 · 1209-24 |
| 3 (Depok, Tangerang Selatan, Bekasi selatan) | 1109-62 · 1209-41 · 1209-42 · 1209-51 · 1209-52 |
| 4 (Jakarta, Tangerang, Bekasi) | 1109-64 · 1209-43 · 1209-44 · 1209-53 · 1209-54 |
| 5 (pesisir utara) | 1110-32 · 1210-11 · 1210-12 · 1210-21 · 1210-22 |

Catatan:
- Jika sebuah nomor **tidak ada** di portal (biasanya kotak yang isinya laut), lewati saja.
- Jika portal memakai **nomor 3 digit** (misalnya `1209-441`, `1209-442`, `1209-443`, `1209-444`), itu potongan kecil dari tile di atas. Unduh semua potongan dari setiap nomor di tabel (4 potongan per nomor). Daftar lengkapnya ada di `data/demnas/jabodetabek_tiles.json` (kolom `sub_sheets_25k`) — atau tanya saya di chat.
- Total ukuran kira-kira 1–1,5 GB.

## Bagian C — Unggah ke GitHub (tempat privat)
File DEMNAS **tidak** dipublikasikan. Kita simpan sebagai *draft release* yang hanya bisa dilihat oleh kamu (dan proses otomatis di repo ini).

1. Buka **https://github.com/raredil/banjir3d** dan pastikan kamu sudah login.
2. Di kolom kanan, klik **Releases** → klik tombol **Draft a new release**.
3. Klik **Choose a tag** → ketik `demnas-private` → klik **Create new tag: demnas-private on publish**.
4. Kolom **Release title**: ketik `DEMNAS (privat, jangan dipublikasikan)`.
5. Seret (drag) semua file DEMNAS ke kotak **Attach binaries by dropping them here**. Tunggu sampai semua bar biru selesai.
6. Klik **Save draft**. ⚠️ **Jangan** klik *Publish release*.
7. Tulis di chat: **"DEMNAS sudah diupload"**. Sisanya saya kerjakan (cek file, potong, gabung, catat checksum).

Kalau ada langkah yang tampilannya berbeda, kirim screenshot ke chat dan saya pandu.
