# Penguji 02 — Hasil banyak titik: "sungai terlihat banjir besar padahal tidak ada sungai"

Data yang diuji: hasil resmi seluruh wilayah pada paket mesin e16, sel 90 m (k3), hujan IMERG, pompa mati, drainase 0, untuk 3 kejadian (1 Jan 2020, 20 Feb 2021, 4 Mar 2025) di `$S/val`. Grid sudah saya cocokkan dengan `buildRun(pack, null, 3)`: 579 x 573 sel, titik asal UTM sama, dan tidak ada satu sel pun yang beda bendera aktif atau kanal. Skrip dan angka mentah ada di `$S/multititik/`. `$S` adalah folder scratchpad sesi. "Air OSM" = garis atau poligon di `web/public/data/jakarta/water_osm.geojson`.

## 1. Ringkasan (5 baris)
1. Keluhan pemilik benar dan penyebabnya bisa dijelaskan. Di selatan (Depok, Jaksel atas) peta penuh garis air bercabang di lembah DEM yang tidak punya sungai di OSM. 90 % sel tergenang > 0,15 m di sana ada di dasar lembah, padahal dasar lembah hanya 23 % dari daratan. Itu aliran limpasan hujan, tetapi digambar seperti banjir.
2. Pada sel 90 m, setiap blok 3x3 yang menyentuh satu saja sel kanal 30 m diturunkan seluruhnya ke dasar sungai. Luas "sungai" membengkak dari 106 km² (30 m) menjadi 241 km² (13,5 % daratan). Air di blok itu tidak pernah dihitung sebagai banjir, bahkan bila meluap.
3. Peta dan angka tidak sama. Pada 2020 peta (cara gambar aplikasi) menunjukkan 300 km² > 0,15 m, sedangkan angka resmi 248 km². Dari selisihnya, 41 km² tergambar di atas blok sungai dan 35 km² di sel darat yang menurut model < 0,15 m.
4. Genangan dalam (> 0,5 m) di darat > 200 m dari air OSM: 46 km² (2020), 15 km² (2021), 39 km² (2025). Yang terbesar (10 km², Bekasi utara) hampir seluruhnya dari air hulu: tanpa air hulu tinggal 2,6 km² dari 26,4 km².
5. Laporan warga paling jarang cocok di darat dekat sungai (17 % pada < 100 m) dan lebih sering di darat > 500 m (37 %). Air sungai tertahan di blok sungai yang lebar, permukiman tepi sungai tetap kering.

## 2. Temuan
| ID | Tingkat | Apa yang salah | Bukti | Perbaikan yang benar |
|---|---|---|---|---|
| MT-01 | KRITIS | **Garis air di lembah tanpa sungai** (inti keluhan #1). Di Selatan (lat < -6,30), 90 % sel darat > 0,15 m ada di dasar lembah (tanah ≥ 0,5 m di bawah rata-rata 450 m sekitarnya) dan 53 % di lereng > 1 %. Ini limpasan hujan yang mengumpul di lembah DEM (tidak ada kanal dipahat karena OSM kosong). Kedalaman maksimum 48 jam-nya digambar sama dengan genangan. Polanya muncul di ketiga kejadian. | `an2.ts`: Selatan `valley_share_of_gt015` 0,90 / 0,93 / 0,90, sedangkan `valley_share_of_land` 0,23. Gambar `img/02-zoom-depok-garis-lembah.png` dan `img/02-hmax2020-sungai-osm.png` (separuh selatan). | (a) Pahat alur kecil dari DEM (akumulasi aliran ≥ ~0,5–1 km²) bila OSM kosong, atau (b) pisahkan "aliran di lembah" dari "genangan" (lama genang, kecepatan). Jelaskan di Kesimpulan bahwa garis biru di lereng adalah aliran, bukan banjir. |
| MT-02 | KRITIS | **Blok sungai 90 m terlalu lebar dan diturunkan ke dasar sungai.** Blok diberi bendera kanal bila ada ≥ 1 sel kanal 30 m, dan tingginya = rata-rata dasar kanal. Rata-rata hanya 4 dari 9 sel di blok itu benar-benar kanal, sehingga 135 km² daratan (7,6 %) ikut turun ke dasar sungai. | `web/src/engine/pack.ts:117-123` (`z[C] = nCh ? zch / nCh : ...`, `channel[C] = +(nCh > 0)`). `analysis.json` bagian `channels`: 29 735 blok = 240,9 km², kanal 30 m = 106,1 km², 3,97 sel kanal per blok. | Kanal sub-grid: lebar alur dan tinggi tanggul disimpan terpisah, bagian darat blok tetap di tinggi darat. Rujukan: Neal, Schumann & Bates 2012, "A subgrid channel model for simulating river hydraulics and floodplain inundation over large and data sparse areas" (belum dicek online). Paling sedikit: bagian darat blok dihitung sebagai darat. |
| MT-03 | TINGGI | **Banjir di blok sungai tidak pernah dihitung, termasuk yang di atas tanggul.** Pada 2020 ada 18 363 blok sungai > 0,15 m (149 km²). Pada 4 249 di antaranya (34 km²) air berada di atas tanah tanggul, jadi itu banjir sungai sungguhan yang hilang dari angka. | `run_event.ts:86`, `compare.py:284`, `panel.ts:590` (`!run.channel[c]`). `analysis.json` `channel_cells`: 2020 = 18 363 / 4 249, 2025 = 17 732 / 3 786. | Hitung luas dari "air di atas tanah darat" (`landGround`) di semua sel, termasuk blok sungai, dengan aturan yang sama seperti peta. |
| MT-04 | TINGGI | **Peta tidak sama dengan angka.** `downscale` merata-ratakan muka air hanya dari tetangga yang basah. Akibatnya air dari blok sungai atau sel basah dibentangkan ke piksel darat yang di model kering. Pada 2020: tergambar 300 km², angka 248 km², dan 35 km² tergambar di sel < 0,15 m. Pada 2021: 133 vs 107 km² (29 km²). | `web/src/sim/flood-layer.ts:166-181` (hanya `dd > 0.01` yang ikut rata-rata). Keluaran `an4.ts`. | Satu aturan untuk peta, ekspor dan angka. Jangan menambah air di sel yang modelnya kering. Hitung luas dari raster yang sama dengan yang digambar. |
| MT-05 | TINGGI | **Genangan Bekasi utara terutama dari air hulu.** Genangan dalam terbesar di darat > 200 m dari air OSM: 10,2 km², rata-rata 0,76 m, maks 1,52 m, di -6,115 / 107,037. Letaknya 2,9 km dari titik masuk hulu 707 m³/s (404 km²). Kotak tanpa air hulu: darat > 0,5 m 2,6 km² vs 26,4 km² di hasil seluruh wilayah; > 0,15 m: 15,8 vs 50,7 km². | `box/cmp.py` (kotak Utara). `inflows` di summary. `img/02-zoom-bekasi-utara.png`. | Periksa lokasi dan debit titik masuk Kali Bekasi/CBL: apakah masuk ke alur yang benar, dan apakah ada tanggul atau pintu air. Di Kesimpulan, pisahkan "banjir dari hujan setempat" dan "banjir dari air hulu". |
| MT-06 | TINGGI | **Kecocokan laporan warga terbalik terhadap jarak ke sungai.** Model ≥ 0,15 m di sel laporan: blok sungai 70 % (112/161), darat < 100 m 17 % (33/198), 100–500 m 14 % (36/257), > 500 m 37 % (23/62). Selain itu 24 % laporan jatuh di blok "sungai", padahal blok sungai hanya 13,5 % daratan. | `analysis.json` `reports_by_distance_class` (3 kejadian, sel langsung, bukan jendela 3x3). | Setelah MT-02/03 diperbaiki, ulangi skor dan laporkan per kelas jarak supaya bias terlihat. |
| MT-07 | SEDANG | **Lembah bersungai yang tidak ada di OSM menjadi genangan dalam.** Depok -6,415 / 106,832: alur GLO-90 25 km², maks 3,53 m, hampir sama di 3 kejadian (1,81 / 1,47 / 1,91). Jakarta Barat -6,214 / 106,718: alur 20 km², OSM terdekat 1,15 km. Darat di alur GLO-90 tanpa OSM ≤ 200 m = 5,6 % daratan tetapi menampung 11 % genangan > 0,15 m. | `analysis.json` `top_far_features` dan `baseline_land_share`. `img/02-alur-glo90-vs-osm.png` (oranye = alur > 200 m dari OSM). | Pahat kanal kecil dari jaringan alur DEM. Periksa timbunan jalan atau gorong-gorong yang membendung (dugaan). |
| MT-08 | SEDANG | **Sungai OSM tanpa bendera kanal, dan kanal tanpa sungai OSM.** 2 450 dari 23 468 blok di garis OSM (10 %) tidak berbendera kanal, sehingga air sungainya dihitung sebagai banjir darat (contoh: titik #17, kedalaman 1,25 m, jarak OSM 0 m, bukan sel sungai). Sebaliknya 4 315 blok kanal (35 km²) tidak dekat air OSM (≤ 60 m): badan air dari tutupan lahan, misalnya tambak. Blok itu dianggap selalu basah dan dikecualikan. | `analysis.json` `channels`. Tabel titik #16, #17, #42. | Daftar kedua kelompok dan periksa di peta dasar. Jelaskan pengecualian tambak di Metode. |
| MT-09 | SEDANG | **Kedalaman hmax di blok sungai diukur dari dasar yang dipahat** (sampai 18,8 m diturunkan). Contoh 6,66 m di -6,160 / 106,838 (z = -5,62). Siapa pun yang membuka file mentah akan membaca "banjir 6,7 m". | Titik #12. `engine_jakarta.json` `channels.max_lowering_m` = 18,83. | Simpan juga kedalaman di atas tanah darat di file keluaran, dan beri catatan di ekspor. |
| MT-10 | RENDAH | 45 sel (0,36 km²) punya kedalaman persis sama di 3 kejadian (> 0,3 m). Semuanya tanah di bawah 0 m dekat pantai, contoh -6,096 / 106,957: z -2,2 m, kedalaman 3,41 m. Ini cekungan yang terisi penuh, tidak tergantung hujan. | `an2.ts` `identical_all3_gt03`. Titik #18 (1,68 m di ketiga kejadian). | Tandai cekungan tertutup di bawah muka laut dan jangan laporkan sebagai banjir kejadian. |

### Pembagian genangan (km², termasuk blok sungai)
Kelas: (a) blok sungai di air OSM; (b) darat bersebelahan blok sungai; (c) darat di alur GLO-90 tanpa air OSM ≤ 200 m; (d) blok "kanal" yang bukan air OSM; (e) lainnya. Pembanding bagian daratan: a+d 13,5 %, b 20,1 %, c 5,6 %, e 60,8 %.

| Kejadian (hujan rata-rata) | Ambang | Total | (a) | (b) | (c) | (d) | (e) | Darat > 200 m dari OSM | > 500 m |
|---|---|---|---|---|---|---|---|---|---|
| 2020 (143 mm) | > 0,15 m | 396,8 | 130,1 | 57,7 | 43,8 | 18,7 | 146,5 | 145,6 | 63,5 |
| 2020 | > 0,5 m | 169,0 | 85,6 | 18,9 | 15,7 | 4,2 | 44,7 | 45,6 | 18,8 |
| 2021 (51 mm) | > 0,15 m | 203,0 | 89,5 | 23,1 | 20,8 | 6,1 | 63,5 | 64,1 | 27,6 |
| 2021 | > 0,5 m | 78,7 | 50,3 | 6,8 | 5,5 | 1,8 | 14,3 | 15,0 | 6,3 |
| 2025 (99 mm) | > 0,15 m | 372,9 | 126,6 | 53,0 | 41,0 | 17,1 | 135,2 | 134,7 | 59,1 |
| 2025 | > 0,5 m | 153,4 | 81,8 | 16,9 | 13,4 | 3,3 | 37,9 | 38,6 | 15,9 |

Separuh air dalam ada di blok sungai (a). Blok ini tidak dihitung, padahal lebarnya 2,3x sungai 30 m (MT-02). Kelas (c) menampung genangan 2x lebih banyak dari luasnya.

### Konsistensi antar kejadian, tepi wilayah, titik masuk
- **Pola antar kejadian sangat mirip.** Korelasi kedalaman di darat: 2020–2025 0,98, 2020–2021 0,89, 2021–2025 0,92. Dari 82 km² darat yang > 0,5 m di salah satu kejadian, 26,6 km² (32 %) > 0,5 m di ketiganya.
- **Kedalaman tetap mengikuti hujan.** Hujan 2021 dibanding 2020: Selatan 53 vs 129 mm, Utara 25 vs 122 mm. Kedalaman median turun ke 0,72x (Selatan) dan 0,55x (Utara), keduanya kira-kira hujan^0,37. Artinya tempat genangan ditentukan bentuk DEM, besarnya oleh hujan. Garis lembah (MT-01) akan muncul di setiap skenario.
- **Cekungan tertutup DEM bukan penyebab utama.** Uji priority-flood: hanya 3–5 % sel > 0,5 m yang kedalamannya ≤ dalam cekungan + 10 cm (2021 Selatan 12 %).
- **Tidak ada penumpukan umum di tepi wilayah.** 5–6 % genangan ada ≤ 1 km dari tepi, sedangkan jalur itu 6,8 % daratan. Pengecualian: fitur -6,099 / 107,052 dan -6,445 / 106,774 menempel di tepi (0,09 km).
- **Dekat titik masuk:** 9,5–13 % genangan ada ≤ 3 km dari 12 titik masuk air hulu.

### Uji kotak 10 x 10 km, kejadian 2020, k3 (km², darat non-sungai; "dekat" = bersebelahan blok sungai)
| Kotak | Varian | Dekat > 0,15 | Jauh > 0,15 | Dekat > 0,5 | Jauh > 0,5 | Blok sungai > 0,5 |
|---|---|---|---|---|---|---|
| Utara/Bekasi 106,98–107,07; -6,16..-6,07 | hulu mati | 3,5 | 12,4 | 0,7 | 1,9 | 1,1 |
| | potongan hasil seluruh wilayah | 9,2 | 41,6 | 5,1 | 21,3 | 6,0 |
| Tengah 106,80–106,92; -6,28..-6,16 (run penguji bahasa) | hulu mati | 2,2 | 8,0 | 0,3 | 1,4 | 9,9 |
| | hulu hidup | 3,5 | 8,5 | 0,9 | 1,6 | 12,3 |
| Selatan/Depok 106,78–106,87; -6,45..-6,36 | hulu mati | 0,9 | 5,4 | 0,4 | 2,8 | 1,9 |
| | hulu hidup | 1,7 | 5,9 | 1,0 | 3,1 | 3,5 |

- **Tengah dan Selatan:** air hulu hanya menambah banjir tepi sungai (+0,6 km² darat dalam). Garis air jauh dari sungai berasal dari hujan setempat.
- **Bekasi utara:** hampir semua genangan dalam datang dari luar kotak. Catatan: pembandingnya potongan hasil seluruh wilayah, bukan run kotak dengan hulu hidup, karena batas 3 run.

### 10 genangan dalam terbesar di darat > 200 m dari air OSM
Ada 652 kelompok, total 47,3 km² (> 0,5 m di salah satu kejadian).

| # | lat, lon | km² | Panjang x lebar (m) | Rata / maks (m) | 2020/21/25 | Di alur GLO-90 | Tanah vs sekitar 1 km (m) | Mekanisme |
|---|---|---|---|---|---|---|---|---|
| 1 | -6,115, 107,037 | 10,17 | 5793 x 2864 | 0,76 / 1,52 | 0,76/0,47/0,74 | 22 % | 1,75 vs 1,80 | Air hulu Kali Bekasi menyebar di dataran pantai (sudah diuji, kotak Utara) |
| 2 | -6,118, 107,014 | 2,85 | 3061 x 1654 | 0,75 / 1,49 | 0,75/0,40/0,71 | 2 % | 1,31 vs 1,29 | Sama dengan #1 |
| 3 | -6,108, 106,992 | 2,34 | 3530 x 1441 | 0,98 / 1,53 | 0,98/0,47/0,87 | 0 % | 0,69 vs 0,91 | Dataran rendah pesisir + air dari luar |
| 4 | -6,129, 106,990 | 1,40 | 2258 x 667 | 1,03 / 1,41 | 1,03/0,48/0,91 | 2 % | 0,67 vs 1,12 | Jalur rendah memanjang, mungkin saluran tak terpetakan (dugaan) |
| 5 | -6,099, 107,052 | 1,01 | 2799 x 518 | 0,72 / 0,92 | 0,72/0,33/0,70 | 38 % | 2,00 vs 2,41 | Di tepi wilayah, 1 km dari titik masuk: efek batas atau titik masuk (dugaan) |
| 6 | -6,100, 106,612 | 0,67 | 1203 x 628 | 0,71 / 0,95 | 0,71/0,26/0,51 | 51 % (7,8 km²) | 4,76 vs 5,56 | Lembah alur kecil tanpa kanal |
| 7 | -6,415, 106,832 | 0,67 | 1971 x 633 | 1,91 / 3,53 | 1,81/1,47/1,91 | 77 % (25,5 km²) | 81,6 vs 87,9 | Lembah alur tanpa kanal, hampir tak tergantung hujan, mungkin terbendung timbunan (dugaan) |
| 8 | -6,214, 106,718 | 0,62 | 1888 x 457 | 0,79 / 1,28 | 0,79/0,25/0,56 | 82 % (20,1 km²) | 10,0 vs 12,8 | Alur DEM, sungai OSM terdekat 1,15 km |
| 9 | -6,164, 106,989 | 0,59 | 1237 x 586 | 0,69 / 0,82 | 0,69/0,10/0,57 | 41 % (11,5 km²) | 1,99 vs 2,66 | Lembah alur tanpa kanal |
| 10 | -6,210, 106,750 | 0,58 | 981 x 574 | 0,76 / 0,97 | 0,76/0,38/0,59 | 0 % | 8,0 vs 10,0 | Cekungan lokal di permukiman padat |

Garis panjang lain:
- -6,445 / 106,774: 2655 x 301 m, maks 2,33 m, 98 % di alur, di tepi selatan.
- -6,319 / 106,941: 2259 x 247 m, maks 1,5 m, OSM terdekat 624 m.

Penjelasan `img/02-dalam-jauh-dari-sungai.png`:
- ungu: darat > 0,5 m dan > 200 m dari OSM (ungu tua: > 1 m)
- biru: dekat OSM; biru muda: blok sungai
- lingkaran hijau: 10 fitur di atas; oranye: titik masuk air hulu

### Air di dalam alur: dihitung atau digambar?
- **Dihitung:** tidak. Semua blok sungai dikecualikan, termasuk yang meluap (MT-03).
- **Digambar:** hanya bagian di atas tanah tanggul. Tetapi aturan gambar membentangkan muka air ke piksel kering (MT-04), dan blok sungai terlalu lebar (MT-02). Karena itu sungai tetap tampak sebagai pita air selebar 90–180 m.

## Tabel 60 titik (5 wilayah x 4 kelas jarak x 3 cara pilih)
- **Wilayah:** Utara lat > -6,13; Barat lon < 106,70; Timur lon > 106,97; Selatan lat < -6,30; sisanya Tengah.
- **Cara pilih:** acak; padat (bangunan > 60 %) atau terbuka (< 20 %); dalam2020 (> 0,5 m pada 2020).
- **Kolom:**
  - Kedalaman = maksimum 48 jam, dalam meter.
  - z = tinggi tanah model; untuk blok sungai ini dasar sungai.
  - Bang. = % luas bangunan.
  - GLO = luas hulu alur GLO-90 di sel, km².
  - Laporan = laporan PetaBencana ≤ 300 m, ditulis jumlah x kedalaman maks per kejadian 2020/2021/2025.

| # | Wilayah | Kelas jarak | Cara | lat, lon | Dalam 2020/21/25 | Sel sungai | Jarak OSM | z | Bang. | GLO | Laporan |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Tengah | darat100-500m | acak | -6.2445, 106.9338 | 0.01 / 0 / 0.01 | - | 150 | 18.2 | 100 | - | - |
| 2 | Tengah | darat100-500m | padat | -6.2407, 106.8565 | 0.01 / 0.01 / 0.01 | - | 320 | 21.6 | 100 | - | - |
| 3 | Tengah | darat100-500m | dalam2020 | -6.2994, 106.8177 | 1.3 / 0.86 / 1.2 | - | 205 | 32.19 | 100 | 1.4 | -/1x134cm/- |
| 4 | Tengah | darat<100m | acak | -6.2399, 106.8533 | 0.02 / 0.01 / 0.01 | - | 42 | 19.96 | 100 | - | - |
| 5 | Tengah | darat<100m | terbuka | -6.1508, 106.9676 | 0.08 / 0.02 / 0.07 | - | 60 | 1.85 | 0 | - | - |
| 6 | Tengah | darat<100m | dalam2020 | -6.2737, 106.7241 | 0.7 / 0.41 / 0.64 | - | 85 | 29.17 | 100 | - | - |
| 7 | Tengah | darat>500m | acak | -6.2533, 106.7346 | 0.03 / 0.02 / 0.03 | - | 750 | 25.47 | 100 | - | - |
| 8 | Tengah | darat>500m | terbuka | -6.1484, 106.9627 | 0.04 / 0.01 / 0.03 | - | 539 | 1.81 | 0 | - | - |
| 9 | Tengah | darat>500m | dalam2020 | -6.2135, 106.7198 | 0.83 / 0.32 / 0.63 | - | 1988 | 9.83 | 98 | 18.5 | -/1x36cm/- |
| 10 | Tengah | sel sungai | acak | -6.2575, 106.9347 | 0.54 / 0.29 / 0.57 | ya | 0 | 17.84 | 100 | - | - |
| 11 | Tengah | sel sungai | padat | -6.2181, 106.7971 | 1.36 / 0.37 / 1.04 | ya | 0 | 9.26 | 100 | 50.8 | - |
| 12 | Tengah | sel sungai | dalam2020 | -6.1602, 106.8376 | 6.66 / 6.15 / 6.51 | ya | 0 | -5.62 | 100 | 5 | 2x63cm/1x0cm/- |
| 13 | Timur | darat100-500m | acak | -6.1692, 107.0441 | 0.02 / 0.01 / 0.02 | - | 162 | 6.84 | 100 | - | - |
| 14 | Timur | darat100-500m | terbuka | -6.2174, 106.9987 | 0.04 / 0.01 / 0.02 | - | 480 | 12.94 | 0 | - | - |
| 15 | Timur | darat100-500m | dalam2020 | -6.3337, 107.0033 | 0.53 / 0.38 / 0.47 | - | 440 | 33.8 | 0 | 3.1 | - |
| 16 | Timur | darat<100m | acak | -6.1548, 106.9806 | 0.01 / 0 / 0.01 | - | 0 | 3.09 | 78 | - | - |
| 17 | Timur | darat<100m | padat | -6.2556, 107.0111 | 1.25 / 0.89 / 1.19 | - | 0 | 18.32 | 98 | - | - |
| 18 | Timur | darat<100m | dalam2020 | -6.1427, 106.9708 | 1.68 / 1.68 / 1.68 | - | 0 | -1.45 | 67 | - | - |
| 19 | Timur | darat>500m | acak | -6.2028, 106.9922 | 0.09 / 0.01 / 0.05 | - | 1395 | 9.42 | 100 | - | - |
| 20 | Timur | darat>500m | padat | -6.394, 106.9864 | 0.03 / 0.01 / 0.03 | - | 622 | 68.34 | 100 | - | - |
| 21 | Timur | darat>500m | dalam2020 | -6.3687, 107.0018 | 0.65 / 0.02 / 0.14 | - | 1401 | 51.53 | 33 | - | - |
| 22 | Timur | sel sungai | acak | -6.202, 106.9767 | 0.02 / 0.01 / 0.02 | ya | 0 | 9.62 | 100 | 1.2 | - |
| 23 | Timur | sel sungai | padat | -6.2669, 107.0331 | 0.01 / 0.01 / 0.01 | ya | 0 | 20.87 | 100 | - | - |
| 24 | Timur | sel sungai | dalam2020 | -6.1586, 107.0449 | 1.13 / 0.55 / 0.93 | ya | 0 | 2.77 | 100 | - | - |
| 25 | Utara | darat100-500m | acak | -6.0579, 107.0014 | 0.01 / 0.01 / 0.02 | - | 320 | 1.45 | 0 | - | - |
| 26 | Utara | darat100-500m | padat | -6.0961, 107.0259 | 0.63 / 0.38 / 0.6 | - | 150 | 1.39 | 79 | - | - |
| 27 | Utara | darat100-500m | dalam2020 | -6.1123, 107.0479 | 0.96 / 0.68 / 0.96 | - | 300 | 1.97 | 100 | - | - |
| 28 | Utara | darat<100m | acak | -6.1284, 106.8708 | 0.02 / 0.01 / 0.02 | - | 0 | 2.19 | 99 | - | - |
| 29 | Utara | darat<100m | padat | -6.1191, 106.9537 | 0.02 / 0.01 / 0.02 | - | 60 | 0.23 | 100 | - | - |
| 30 | Utara | darat<100m | dalam2020 | -6.0994, 107.0016 | 0.55 / 0.12 / 0.45 | - | 85 | 1.14 | 20 | - | - |
| 31 | Utara | darat>500m | acak | -6.083, 107.043 | 0.37 / 0.09 / 0.36 | - | 679 | 1.45 | 0 | - | - |
| 32 | Utara | darat>500m | terbuka | -6.1026, 107.0154 | 0.19 / 0 / 0.16 | - | 690 | 1.78 | 2 | - | - |
| 33 | Utara | darat>500m | dalam2020 | -6.1015, 106.6162 | 0.75 / 0.29 / 0.55 | - | 1443 | 4.72 | 0 | - | - |
| 34 | Utara | sel sungai | acak | -6.0895, 107.0397 | 0.89 / 0.01 / 0.82 | ya | 0 | 1.16 | 16 | 1019.2 | - |
| 35 | Utara | sel sungai | terbuka | -6.0863, 107.0226 | 0.43 / 0.24 / 0.4 | ya | 162 | 1.47 | 0 | - | - |
| 36 | Utara | sel sungai | dalam2020 | -6.0762, 106.6356 | 1.32 / 0.46 / 0.57 | ya | 0 | 1.5 | 95 | 1355 | - |
| 37 | Selatan | darat100-500m | acak | -6.3803, 106.9465 | 0.41 / 0.03 / 0.11 | - | 255 | 64.4 | 0 | 1.1 | - |
| 38 | Selatan | darat100-500m | padat | -6.3943, 106.9075 | 0.01 / 0 / 0.01 | - | 387 | 81.6 | 100 | - | - |
| 39 | Selatan | darat100-500m | dalam2020 | -6.3668, 106.8619 | 0.9 / 0.65 / 0.87 | - | 210 | 65.85 | 100 | - | - |
| 40 | Selatan | darat<100m | acak | -6.4037, 106.7741 | 0.01 / 0.01 / 0.02 | - | 30 | 81.26 | 100 | - | - |
| 41 | Selatan | darat<100m | padat | -6.3514, 106.8398 | 0.03 / 0.01 / 0.02 | - | 30 | 57.45 | 100 | - | - |
| 42 | Selatan | darat<100m | dalam2020 | -6.3654, 106.8106 | 1.38 / 0.91 / 1.26 | - | 0 | 63.82 | 100 | 4.1 | - |
| 43 | Selatan | darat>500m | acak | -6.3674, 106.9302 | 2.04 / 1.04 / 1.98 | - | 1019 | 58.5 | 9 | 1.7 | - |
| 44 | Selatan | darat>500m | terbuka | -6.3829, 106.9067 | 0.01 / 0 / 0.01 | - | 694 | 74.09 | 0 | - | - |
| 45 | Selatan | darat>500m | dalam2020 | -6.3043, 106.8299 | 0.52 / 0.04 / 0.3 | - | 629 | 35.14 | 100 | - | - |
| 46 | Selatan | sel sungai | acak | -6.3364, 106.7121 | 0.06 / 0.07 / 0.07 | ya | 0 | 52.86 | 100 | - | - |
| 47 | Selatan | sel sungai | padat | -6.3943, 106.9018 | 0.85 / 0.58 / 0.96 | ya | 0 | 73.17 | 79 | - | - |
| 48 | Selatan | sel sungai | dalam2020 | -6.3, 106.8746 | 2.48 / 1.31 / 2.35 | ya | 0 | 28.97 | 100 | 29.5 | -/1x0cm/- |
| 49 | Barat | darat100-500m | acak | -6.169, 106.6498 | 0.01 / 0.02 / 0.02 | - | 355 | 11.06 | 100 | - | - |
| 50 | Barat | darat100-500m | padat | -6.1991, 106.658 | 0.01 / 0.01 / 0.02 | - | 362 | 15.88 | 100 | - | - |
| 51 | Barat | darat100-500m | dalam2020 | -6.1601, 106.6099 | 0.73 / 0.48 / 0.72 | - | 157 | 9.51 | 100 | - | - |
| 52 | Barat | darat<100m | acak | -6.2764, 106.6468 | 0 / 0 / 0 | - | 30 | 22.98 | 0 | - | - |
| 53 | Barat | darat<100m | padat | -6.2209, 106.6955 | 0.92 / 0.51 / 1.01 | - | 60 | 14.68 | 100 | - | 3x0cm/1x82cm/- |
| 54 | Barat | darat<100m | dalam2020 | -6.2609, 106.6484 | 0.75 / 0.01 / 0.51 | - | 30 | 14.81 | 0 | - | - |
| 55 | Barat | darat>500m | acak | -6.2089, 106.6409 | 0.03 / 0.02 / 0.02 | - | 721 | 19.08 | 100 | - | - |
| 56 | Barat | darat>500m | terbuka | -6.1325, 106.6017 | 0.42 / 0.28 / 0.36 | - | 582 | 8.41 | 7 | 2.1 | - |
| 57 | Barat | darat>500m | dalam2020 | -6.2105, 106.6369 | 1.04 / 0.52 / 0.85 | - | 1091 | 17.63 | 100 | - | - |
| 58 | Barat | sel sungai | acak | -6.2007, 106.6669 | 0.35 / 0.03 / 0.17 | ya | 0 | 12.29 | 7 | - | - |
| 59 | Barat | sel sungai | terbuka | -6.2437, 106.6825 | 1.7 / 1.15 / 2.03 | ya | 0 | 16.33 | 7 | 103 | - |
| 60 | Barat | sel sungai | dalam2020 | -6.191, 106.6303 | 1.21 / 0.44 / 0.88 | ya | 0 | 11.21 | 11 | - | - |

Catatan tabel:
- **Titik darat acak:** dari 15 titik, hanya 3 yang > 0,15 m pada 2020 (#31, #37, #43). Jadi peta tidak "banjir di mana-mana".
- **Air dalam terkumpul di dua tempat:** blok sungai, dan lembah atau dataran pantai Bekasi.
- **#12:** kedalaman 6,66 m diukur dari dasar sungai (MT-09).
- **#17 dan #42:** air di garis OSM yang tidak berbendera kanal (MT-08).
- **#18:** kedalaman sama di ketiga kejadian (MT-10).

## 3. Pertanyaan untuk agen utama
1. Apakah hasil resmi (validasi, Kesimpulan, angka di aplikasi) memang dihitung pada k3? Bila ya, apakah Anda setuju MT-02 harus diperbaiki sebelum angka dipakai lagi? (ya/tidak)
2. Apakah luas banjir sengaja tidak menghitung air di atas tanggul pada blok sungai? (ya/tidak) Bila tidak sengaja, apakah luas akan dihitung dari raster gambar yang sama?
3. Apakah `downscale` boleh menggambar air di sel yang modelnya kering? Bila tidak, siapa yang memperbaikinya?
4. Apakah titik masuk Kali Bekasi (404 km², 707 m³/s pada 2020) sudah dicek terhadap debit terukur atau laporan? Sumber angkanya apa?
5. Pertanyaan terbuka: bagaimana garis aliran di lembah (MT-01) akan ditampilkan atau dijelaskan kepada pemilik? Apakah dipahat sebagai kanal, disaring dengan lama genang, atau diberi kelas sendiri?
6. Pertanyaan terbuka: apakah skor PetaBencana akan dilaporkan per kelas jarak ke sungai (MT-06), supaya tim pemilik melihat di mana model lemah?

## 4. Apa yang sudah benar
- **Data konsisten.** File hasil, mask dan geometri cocok persis dengan `buildRun`. Galat massa 1e-14.
- **Air di dalam alur tidak digambar.** Gambar memakai `landGround`, hanya air di atas tanggul yang tampil; prinsipnya benar (seperti downscaling SFINCS).
- **Tidak ada penumpukan air umum di tepi wilayah.** Batas transmisif bekerja.
- **Kedalaman merespons hujan secara wajar** (sekitar hujan^0,37, sama di utara dan selatan). Polanya tidak "dipaksa" sama antar kejadian.
- **Pemakaian bendera kanal sudah konsisten.** Skor PetaBencana (`compare.py`) dan luas resmi sama-sama mengecualikan blok sungai. Yang perlu dibetulkan adalah lebar blok itu (MT-02), bukan prinsipnya.
- **Air hulu bukan penyebab garis lembah.** Uji kotak menunjukkan air hulu hanya menambah sedikit di Tengah dan Selatan; garis lembah datang dari hujan setempat.
