# 06 — Uji aplikasi dari ujung ke ujung (penguji "aplikasi")

Tanggal: 20 Nov 2026. Penguji independen; tidak ada berkas repo yang diubah. Berkas kerja: `$S/aplikasi/`
(`$S` = `/tmp/claude-0/-home-user-banjir3d/09719d2b-52ec-5b7a-a866-d3c54f1ea192/scratchpad`).
Cara uji: aplikasi web dibangun sendiri (`vite build` ke `$S/aplikasi/dist` + metadata dari `scripts/copy-data.mjs`),
dijalankan di Chromium (Playwright), simulasi CPU lewat panel Simulasi seperti yang dilakukan peneliti, lalu KPI, Kesimpulan,
CSV, GeoTIFF dan JSON diunduh dan dihitung ulang. Skrip: `$S/aplikasi/run.cjs`, `tif.cjs`, `cmp.cjs`, `where.cjs`, `viz.py`, `region_crop.py`.

## 1. Ringkasan (5 baris)
1. Aplikasi dan skrip validasi (Node `run_event.ts`) memberi hasil BERBEDA untuk kotak dan setelan yang sama: 1,08 vs 0,67 km², terdalam 1,72 vs 0,91 m.
2. "Titik terdalam" di Kesimpulan bisa berupa artefak di tepi kotak tempat sungai hulu masuk (Kampung Melayu: 1,7 m di 2 baris sel paling selatan).
3. Di Depok (luar DKI) lembah Ciliwung digambar sebagai pita 300–420 m lebar, 3–7 m dalam: persis keluhan pemilik no. 1.
4. GeoTIFF ekspor memasukkan air di dalam alur sungai sebagai "kedalaman banjir" (8–9 m), padahal KPI/peta tidak: angka ekspor tidak sama dengan KPI.
5. Validasi yang dikutip di Kesimpulan ("sedikit lebih baik dari acak pada 2020") bertentangan dengan `data/skill.json` (verdict `not_better`), dan halaman Validasi masih memuat kartu lama tanpa tanda "lama".

## 2. Lari simulasi yang dilakukan (semua CPU, satu per satu)

| Lari | Kotak (W,S,E,N) | Hujan | Sel | Waktu | KPI luas | KPI terdalam | Bangunan / penduduk | GeoTIFF: luas >0,15 m / maks |
|---|---|---|---|---|---|---|---|---|
| Tengah, Kampung Melayu–Bukit Duri | 106.850,-6.240,106.877,-6.213 | 1 Jan 2020 (IMERG, 48 j) | 30 m | 88 s | 1,1 km² | 1,72 m (Kec. Jatinegara) | 6.106 / 24.048 | 1,60 km² / 8,59 m |
| Utara, Penjaringan–Pluit | 106.775,-6.135,106.802,-6.108 | 1 Jan 2020 | 30 m | 94 s | 0,7 km² | 1,22 m (Kec. Penjaringan) | 1.306 / 8.477 | 1,51 km² / 9,07 m |
| Barat, Cengkareng | 106.715,-6.160,106.742,-6.133 | 1 Jan 2020 | 30 m | 42 s | 2,2 km² | 1,38 m (Kec. Cengkareng) | 6.598 / 37.180 | 2,63 km² / 2,19 m |
| Luar DKI, Depok (Beji/Pancoran Mas) | 106.810,-6.410,106.837,-6.383 | 1 Jan 2020 | 30 m | 79 s | 1,0 km² | 7,22 m (Kec. Beji) | 2.712 / 11.070 | 1,36 km² / 8,13 m |
| Timur, Cakung | 106.935,-6.195,106.962,-6.168 | rancangan 150 mm/3 j, 8 j | 30 m | 15 s | 2,4 km² | 0,90 m (Kec. Cakung) | 3.185 / 21.442 | 2,63 km² / 9,08 m |
| Timur, Cakung | sama | sama | 90 m | 1 s | 2,3 km² | 0,74 m | 2.852 / 19.347 | 2,81 km² / 8,58 m |
| Node `run_event.ts` (pembanding) | kotak Tengah | 1 Jan 2020, `--k 1 --drain 0 --pumps off` | 30 m | 48 s | 0,666 km² (di luar alur) | 0,91 m (di luar alur) | – | – |

Semua kotak 3,0 × 3,0 km (bukan 3–5 km: batas waktu 5 menit per perintah; kotak 4,4 km × 48 jam ≈ 3 menit CPU).
Data per lari: `$S/aplikasi/runs/<lari>/{info.json,max.png,concl.png,export.tif,export.csv,export.json,tif_osm.png}`.
Galat neraca air di semua lari ≤ 5e-14 (baik). Konsol: hanya galat "Wrong magic number for PMTiles" (lapisan pmtiles memang tidak ada di mesin uji; wajar).

## 3. Temuan

| ID | Tingkat | Apa yang salah | Bukti | Perbaikan yang benar |
|---|---|---|---|---|
| A-01 | KRITIS | Aplikasi ≠ jalur validasi. Kotak, hujan, setelan sama (30 m, IMERG 2020, drain 0, pompa mati, AMC II, penurunan tanah): aplikasi 1,08 km² tergenang di luar alur dan terdalam 1,72 m; Node `run_event.ts` (jalur yang dipakai untuk semua skor validasi) 0,666 km² dan 0,91 m. Selisih rata-rata kedalaman maks per sel 0,13 m, selisih terbesar 6,7 m (di alur). Total air hampir sama (hujan 1,50 vs 1,498 juta m³, hulu 37,0 vs 37,03 juta m³), jadi bedanya di cara air dimasukkan/dijalankan, bukan di jumlahnya. Aplikasi lebih basah di hampir semua pita baris (baris 0–39: 361 vs 154 sel basah). Akibatnya: skor validasi tidak berlaku untuk angka yang dilihat peneliti di aplikasi. | `node $S/aplikasi/cmp.cjs …/centre_ev30/tif.f32 $S/aplikasi/node_centre` → `appWetNoCh_km2 1.08, nodeWetNoCh_km2 0.666, landMaxApp 1.72, landMaxNode 0.91`; `where.cjs` per pita baris. Dugaan penyebab (belum dibuktikan): (a) aplikasi menyebar debit hulu ke beberapa sel (`web/src/sim/panel.ts:670-671` `inflowSpread`), Node ke 1 sel (`verification/observed/run_event.ts:72`); (b) pewaktuan hujan beda: Node memakai hujan per jam yang digeser "jam yang berakhir di T" (`run_event.ts:40-41,76`), aplikasi `zoneMm` dari `data/events/2020-01-01_imerg.json` lewat worker. | Satu fungsi bersama "siapkan lari" untuk aplikasi dan Node; uji regresi otomatis: kotak yang sama harus memberi hmax identik (≤1 cm) di aplikasi (worker CPU) dan `run_event.ts`. Sampai itu ada, jangan menempelkan skor validasi ke hasil aplikasi. |
| A-02 | KRITIS | "Titik terdalam di luar sungai 1,7 m di Kec. Jatinegara" pada lari Kampung Melayu adalah artefak tepi kotak: sel (51,99), (52,100), (50,99) = 2 baris paling selatan dari 101, tempat Ciliwung masuk dari hulu. Node di sel yang sama: 0,08–0,35 m. KPI "Terdalam 1,72 m" dan Kesimpulan memakai angka ini. | `where.cjs`: `(51,99) app 1.72 node 0.23; (52,100) app 1.70 node 0.08`; gambar `img/app-kampungmelayu-2020-30m-max.png` (kolam biru tua di tepi bawah kotak). | Kecualikan sel di sekitar titik masuk debit hulu dan pita tepi kotak (mis. 5 sel) dari "terdalam" dan dari luas, atau beri peringatan; masukkan debit hulu hanya ke sel alur. |
| A-03 | KRITIS | Keluhan pemilik no. 1 terbukti di Depok: lembah Ciliwung digambar sebagai pita 300–420 m lebar dengan kedalaman 2,7–4,9 m (potongan baris 60), terdalam 7,22 m "di luar sungai" (Kec. Beji), 0,5 km² lebih dari 1 m, 2.712 bangunan "tergenang". 9,6 % sel >1 m berada >150 m dari air OSM mana pun (terdalam 3,64 m). Lari resmi 90 m seluruh wilayah di jendela yang sama: 0,49 km², maks darat 3,44 m — jadi angka berubah 2× tergantung kotak/resolusi. | `img/app-depok-2020-30m-max.png`, `img/app-depok-geotiff-vs-osm.png` (merah = OSM), `viz.py` → `gt1.0 far150m_share 0.096, far_max_depth 3.64`; `region_crop.py`. Dugaan: di luar DKI tidak ada ukuran saluran DSDA, alur OSM ditoreh sempit, lembah curam FABDEM berhutan tidak cukup dalam, debit hulu puncak 465 m³/s. | Cek kedalaman alur Ciliwung/Pesanggrahan di luar DKI terhadap data pos duga air (Depok, Katulampa) dan citra; tandai hasil di luar DKI sebagai "belum divalidasi" di peta dan Kesimpulan; uji "tanpa hujan, hanya debit hulu normal" di Depok: lembah tidak boleh meluap. |
| A-04 | TINGGI | GeoTIFF kedalaman memasukkan air di dalam alur sungai (tebing ke bawah) sebagai kedalaman banjir. Peta dan KPI menyembunyikannya, ekspor tidak. Di QGIS peneliti melihat sungai sebagai garis "banjir" 8–9 m dan luas >0,15 m 1,4–2,2× KPI. Ini penjelasan kuat untuk keluhan no. 1 bila tim memakai ekspor. | Tabel di atas: maks GeoTIFF 8,59 / 9,07 / 8,13 / 9,08 m vs KPI 1,72 / 1,22 / 7,22 / 0,90 m; luas 1,60 vs 1,1; 1,51 vs 0,7 km². Kode: `web/src/sim/export.ts:75-78` hanya menyaring `g.mask` (aktif, bukan laut, bukan bangunan), tidak `channel`; bandingkan `web/src/sim/panel.ts:590` (`count` = 0 di alur) dan `web/src/sim/flood-layer.ts:4`. | Ekspor dua pita: "kedalaman di atas tebing (banjir)" yang sama dengan peta/KPI, dan "kedalaman air di alur" terpisah (atau alur = nodata); tulis ambang 0,15 m dan aturan alur di metadata TIFF dan JSON. |
| A-05 | TINGGI | Kesimpulan menulis "letak genangan model … sedikit lebih baik [dari acak] pada 2020", memakai 44 % vs 37 %. `data/skill.json` sendiri menyebut pembanding 37 % "old, unfair" dan memberi 2020 `verdict: not_better` (pembanding adil `randomNear` 0,429, `pNear` 0,456); 2025 `too_few`. Halaman Validasi menampilkan pembanding lama yang sama. | `$S/aplikasi/runs/*/info.json` → `conclSum[5]`; `data/skill.json` event 2020-01-01 (`hit 0.435, random 0.366, randomNear 0.429, verdict not_better`); `$S/aplikasi/page-validation.txt` baris 91. | Kesimpulan dan Validasi pakai `randomNear`/`randomDomain` dan `verdict`; tulis terus terang: 2020 tidak lebih baik dari acak, 2021 lebih baik, 2025 terlalu sedikit laporan. |
| A-06 | TINGGI | Halaman Validasi mencampur angka lama dan baru tanpa tanda. Kartu "Kedalaman" masih menulis median model di titik laporan 0,38/0,38/0,43 m, luas 2020 143 km² dan 80 % laporan kena (×1), sementara kartu baru menulis 0,09/0,05/0,06 m, 62 km², 44 %. HANDOFF.md:35 juga masih "~80 % … 143 vs 156 km²". Peneliti bisa mengutip angka yang salah. | `$S/aplikasi/page-validation.txt` baris 97 vs 132–145; `HANDOFF.md:35`. Gambar: `$S/aplikasi/page-validation.png`. | Tandai setiap kartu dengan versi paket/tanggal; kartu yang sudah tidak berlaku dipindah ke "Riwayat" atau dihapus; satu sumber angka (skill.json) untuk semua teks. |
| A-07 | TINGGI | Hasil kotak 30 m di aplikasi jauh berbeda dari lari resmi 90 m seluruh wilayah di jendela yang sama, padahal Kesimpulan setiap kotak menempelkan skor validasi lari resmi itu. Tengah 1,1 vs 0,30 km²; Depok 1,0 vs 0,49; Barat 2,2 vs 2,97; Utara 0,7 vs 0,75. Terdalam di darat: 1,72 vs 0,48; 1,22 vs 2,51; 1,38 vs 1,34; 7,22 vs 3,44 m. | `python3 $S/aplikasi/region_crop.py $S` (hmax/mask resmi `$S/val/2020-01-01_imerg_k3_d0_poff_*`). Bagian yang berasal dari A-01 belum dipisahkan dari efek tepi kotak/resolusi. | Validasi juga mode kotak 30 m (yang dipakai peneliti), atau tulis di Kesimpulan: "skor diuji pada seluruh wilayah 90 m, bukan pada kotak ini"; peringatan bila kotak memotong sungai besar. |
| A-08 | SEDANG | Dua "hujan rata-rata" berbeda di panel yang sama tanpa keterangan daerahnya: sebelum lari "Hujan rata-rata 112 mm / 48 jam" (seluruh wilayah), sesudah lari 163 mm (Tengah), 123 (Utara), 122 (Barat), 151 mm (Depok). | `info.json` → `pre.rainsum` vs `stats`. | Tulis "rata-rata seluruh wilayah" dan "rata-rata kotak ini". |
| A-09 | SEDANG | Ekspor JSON (provenance) tidak memuat angka ringkasan yang tampil di KPI/Kesimpulan (luas pernah tergenang, terdalam dan lokasinya); hanya seri luas sesaat dan paparan. Angka KPI tidak bisa diperiksa ulang dari JSON. Bangunan/penduduk di JSON dan CSV cocok dengan KPI (mis. CSV 4.299+1.686+121+0 = 6.106; 17.450+6.014+540+45 = 24.049 ≈ 24.048). | `export.json` kunci: `exposure, flooded_km2_series, totals_m3 …`, tidak ada `envelope`/`max_depth`. | Tambah `summary: {flooded_km2_max_envelope, max_depth_m, max_depth_lonlat, excluded: channels/sea/buildings, threshold_m}`. |
| A-10 | SEDANG (dugaan) | Kolam/situ masih tergambar sebagai genangan 1–2 m (Depok, poligon OSM di sisi barat kotak, ±0,14 km² basah di jendela itu), padahal Validasi menulis "kolam/situ bukan banjir" sejak 17 Nov. Belum dipastikan apakah sel ini ikut dihitung di KPI (GeoTIFF tidak membedakan). Kesimpulan sendiri menulis "bisa juga kolam atau situ". | `img/app-depok-geotiff-vs-osm.png` (poligon merah kiri berisi biru), `img/app-depok-2020-30m-max.png`. | Masker situ/kolam (OSM `pond/lake/reservoir`) keluar dari luas, terdalam dan paparan; ekspor sebagai kelas terpisah. |
| A-11 | RENDAH | Pembagian kelas di Kesimpulan menulis "0,0 km² lebih dari 1 m" padahal terdalam 1,22 m (Utara); "Ke laut -0,0" di neraca air. Pembulatan menyembunyikan angka. | `north_ev30/info.json`. | Tulis "<0,05 km²" dan buang tanda minus pada nol. |
| A-12 | RENDAH | Kotak 3 km × 48 jam butuh 42–94 s CPU (target ±60 s); kotak 4,4 km ±3 menit. | Tabel lari. | Beri perkiraan waktu sebelum lari. |

Konsistensi yang DIPERIKSA dan COCOK: KPI luas = luas di legenda (1,08/0,68/2,24/0,95/2,43 km²) = Kesimpulan (dibulatkan); KPI bangunan/penduduk = Kesimpulan = CSV = JSON; 30 m vs 90 m di kotak yang sama (Cakung, hujan rancangan): luas 2,4 vs 2,3 km², terdalam 0,90 vs 0,74 m, bangunan 3.185 vs 2.852 (−10 %) — wajar.

Genangan dalam (>0,5 m, dari GeoTIFF) vs sungai OSM (`viz.py`): di Tengah 99,6 % dan Utara 100 % sel >0,5 m berada ≤150 m dari air OSM (genangan dalam mengikuti sungai/kanal yang memang ada). Di Barat 22 % sel 0,5–1 m berada >150 m dari air OSM (cekungan rendah Cengkareng, wajar), di Depok lihat A-03.

## 4. Pertanyaan untuk agen utama
Ya/tidak:
1. Apakah aplikasi (worker CPU) dan `run_event.ts` seharusnya memberi hmax yang sama untuk kotak dan setelan yang sama? Jika ya, mana yang benar untuk kotak Tengah (1,08 atau 0,67 km²)?
2. Apakah `inflowSpread` (panel.ts:670) sengaja menyebar debit hulu ke sel tebing/daratan di tepi kotak?
3. Apakah GeoTIFF memang dimaksudkan memuat air di dalam alur sebagai kedalaman? Apakah tim pemilik memakai GeoTIFF untuk peta mereka?
4. Apakah sel situ/kolam OSM sudah dikeluarkan dari `count` (luas/terdalam/paparan) di paket e16?
5. Apakah ada pengecekan kedalaman alur Ciliwung di luar DKI (Depok) terhadap data pos duga air?
Terbuka:
6. Mengapa Kesimpulan memakai pembanding acak 37 % yang skill.json sendiri sebut "tidak adil"?
7. Bagaimana skor validasi (dibuat 90 m seluruh wilayah) boleh dipakai untuk kotak 30 m bila hasilnya berbeda 2–3,7×?
8. Apa aturan untuk "titik terdalam" bila ia berada di sel masuknya debit hulu atau di tepi kotak?

## 5. Apa yang sudah benar
- Aplikasi berjalan tanpa galat konsol selain lapisan pmtiles yang memang tidak ada; semua lari selesai; neraca air ≤ 5e-14.
- Peta di aplikasi menyembunyikan air di dalam alur (hanya air di atas tebing yang digambar) dan KPI/Kesimpulan mengecualikan alur, laut, bangunan (`panel.ts:590`).
- KPI, legenda, Kesimpulan, CSV dan paparan JSON saling cocok untuk luas, bangunan dan penduduk.
- 30 m dan 90 m pada kotak yang sama memberi hasil yang konsisten (selisih luas ±4 %).
- Angka utama halaman Validasi (44/33/35 % vs 37/19/36 %, 62/20/55 km²) sama dengan `data/skill.json`; ekspor mencatat skenario, paket data, sumber hujan dan lisensi dengan lengkap.

Gambar: `verification/review-2026-11-18/img/app-kampungmelayu-2020-30m-max.png`, `app-kampungmelayu-geotiff-vs-osm.png`,
`app-depok-2020-30m-max.png`, `app-depok-geotiff-vs-osm.png`, `app-cengkareng-2020-30m-max.png`
(gambar `*-geotiff-vs-osm`: kedalaman dari GeoTIFF ekspor, kelas biru seperti legenda aplikasi, garis merah = `water_osm.geojson`; latar hitam karena peta dasar tidak bisa diunduh di mesin uji).
