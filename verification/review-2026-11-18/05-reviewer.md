# Tinjauan 05: Reviewer Jurnal Skeptis (peran `reviewer`), 20 Nov 2026

Penguji independen. Tidak ada berkas repo yang diubah. Skrip dan hasil antara: `$S/reviewer/` (`perkota.py`, `perkota.txt`, `boxcmp.py`, run kotak `k1/ k2/ k3/`), `$S` = `/tmp/claude-0/-home-user-banjir3d/09719d2b-52ec-5b7a-a866-d3c54f1ea192/scratchpad`.
Statistik kalibrasi/validasi (in-sample, pembanding acak tidak adil, interval, angka basi) **sudah dibahas di `03-validasi.md`**. Di sini hanya dirujuk, tidak diulang.

## 1. Ringkasan (5 baris)
1. Wilayah model bukan Jabodetabek. Wilayahnya DKI + 10 km (2.129 km²). Kota Bogor tidak masuk sama sekali. Kab. Bogor, Kab. Bekasi dan Kab. Tangerang hanya masuk di potongan pinggirnya. Padahal **75 % genangan model 2020 (186 dari 248 km²) ada di luar DKI**, dan tidak satu pun km² di sana diuji luasnya.
2. Enam janji penting BLUEPRINT belum ada: model riset SFINCS ("Research Run"), peta peluang dari ensemble, validasi Sentinel-1, uji kepekaan Manning/DEM/tutupan lahan, Reproduce + DOI Zenodo, dan tata letak cetak 300 dpi. Dua di antaranya ditampilkan aplikasi seolah ada: halaman Data menyebut "Sentinel-1 untuk menguji hasil", dan README menyebut "Jabodetabek".
3. Satu-satunya mesin sekarang mesin browser. Cap ADR 0006 "EXPLORATORY, not for quantitative conclusions" sudah hilang, padahal pembanding SFINCS dan uji benchmark EA belum pernah diulang pada mesin v2.
4. Hasil bergantung pada ukuran sel. Pada satu kotak 4,4 km dengan 15 laporan yang sama, "laporan kena ±270 m" bernilai 13 % (60 m), 33 % (90 m) dan 100 % (30 m). Angka resmi dihitung pada 90 m, sedangkan pengguna melihat 30 m.
5. Riwayat kesalahan: sedikitnya 9 kesalahan ditemukan **sesudah** hasilnya ditunjukkan (tabel bagian 5). Semua angka sebelum 18 Nov 2026 (paket ≤ e15) harus dibuang. Kalimat "lebih baik dari acak di 2 dari 3 banjir" juga harus ditarik.

## 2. Temuan

| ID | Tingkat | Apa yang salah | Bukti | Perbaikan yang benar |
|---|---|---|---|---|
| R-01 | KRITIS | **Wilayah (keluhan pemilik #8).** Kotak model 106,595–107,064 BT, 5,998–6,462 LS (`data/regions.json`). Batas selatan 6,462 LS berada di utara Kota Bogor (sekitar 6,6 LS), jadi Kota Bogor tidak ada. Luas di dalam grid per wilayah (dari `exposure_jakarta.json` units): Kota Bekasi 200, Depok 199, Kota Tangerang 153, Tangsel 146, Kab. Bekasi 178, Kab. Tangerang 133, Kab. Bogor 126 km². Dugaan (luas resmi dari ingatan, belum dicek online): Kab. Bogor sekitar 2.700–3.000 km², jadi yang masuk kurang dari 5 %. Kab. Bekasi dan Kab. Tangerang sekitar 1.000–1.300 km², jadi yang masuk 10–15 %. Jabodetabek sekitar 6.500–7.000 km², jadi domain kira-kira sepertiganya. MUST-3 berbunyi "aku butuh jabodetabek". ADR 0005 mempersempitnya (koreksi pemilik 24 Okt), tetapi README baris 8 masih menulis "all data layers for Jabodetabek". | `data/regions.json`; `docs/adr/0005-region-jakarta-buffer.md` baris 4–10; `README.md:8` | Beri tahu pemilik dengan jelas apa yang tidak tercakup. Tulis domain di setiap ekspor dan Kesimpulan ("DKI + 10 km; Kota Bogor dan sebagian besar kabupaten tidak tercakup"). Perbaiki README. Rencanakan paket wilayah Jabodetabek (BACKLOG baris 32 sudah punya langkahnya). |
| R-02 | KRITIS | **Genangan di luar DKI tidak diuji, padahal itu bagian terbesar.** Hasil resmi 90 m (paket e16), lahan tergenang >0,15 m per kota: 2020 Kab. Bekasi 69,3 km² (**50 % lahannya**), Kota Tangerang 29,5, Kota Bekasi 28,1, Kab. Tangerang 21,3, Depok 15,1, Tangsel 12,7, Kab. Bogor 10,3. Kelima kota DKI hanya 61,5 dari 248 km². Pola 2025 sama: Kab. Bekasi 64,7 km² (47 %). Ukuran luas yang dipakai (`dkiKm2`) hanya DKI. Data DSDA (saluran, pompa, saluran mikro, RT genangan) dan penurunan tanah hanya ada di DKI (subsidence `coverage_share` 0,209). Jadi model di Bodetabek adalah model yang lebih miskin data. Kab. Bekasi (pesisir utara, median kedalaman 0,44 m, p90 0,99 m, 2–8 km dari tepi timur) belum dicek terhadap data apa pun. HANDOFF juga mencatat "D8 on GLO-90 may misroute in flat east (Bekasi/Cikarang)". | `$S/reviewer/perkota.txt` (hmax 90 m × raster kecamatan, header pack dibaca seperti `readPackFile`); `engine_jakarta.json` subsidence/drains | Laporkan luas genangan per kota dan pisahkan "DKI (data lengkap)" dari "penyangga (data minim)". Beri label "belum diuji" di luar DKI. Uji tepi timur (Kab. Bekasi) dengan peta (inaRISK/BNPB atau laporan) sebelum dipakai. |
| R-03 | KRITIS | **Model riset SFINCS ("Research Run") tidak ada**, padahal BLUEPRINT baris 5 berbunyi "Angka untuk paper diambil dari Research Run". Tidak ada workflow SFINCS di `.github/workflows/` (ci, demnas, engine-pack, exposure-pack, map-layers, observed, pages, region-pack, retile, terrain-probe, validate) dan tidak ada tombol "Request Research Run". Pembanding SFINCS hanya pada mesin v1 (`validation.json` kartu `sfincs`: "v2 akan diuji ulang"). Uji EA belum dilakukan (HANDOFF Known gaps). Cap "EXPLORATORY…" (ADR 0006 baris 26) diganti dengan "Hasil model, bukan peta banjir resmi." (`i18n.ts:91`). | berkas tersebut; ROADMAP baris 8 "in progress" | Kembalikan cap yang jujur ("hasil eksplorasi, mesin belum dibandingkan dengan SFINCS v2/EA") sampai pembanding ulang selesai. Jalankan ulang SFINCS pada mesin v2 untuk satu kotak dan satu banjir nyata. Putuskan bersama pemilik apakah Research Run dibatalkan (perlu ADR) atau tetap dijanjikan. |
| R-04 | TINGGI | **Ketergantungan pada ukuran sel tidak pernah diuji terhadap laporan.** Saya menjalankan sendiri satu kotak 106,83–106,87 BT / 6,21–6,25 LS (Kampung Melayu), banjir 2020, IMERG, pompa mati, drain 0. Hasil: luas tergenang 1,91 km² (90 m), 1,01 km² (60 m), 2,18 km² (30 m). Untuk 15 laporan yang sama, kena ±270 m: 33 %, 13 %, 100 %. Kena di sel yang sama: 7 %, 0 %, 7 %. Median kedalaman di laporan 0,01 m pada semua ukuran. Tidak monoton: 60 m paling kering. Semua skor di `skill.json` dihitung pada 90 m (k 3), sedangkan kotak di aplikasi dihitung pada 30 m dan Kesimpulan mengutip skor 90 m itu. | `$S/reviewer/boxcmp.py`, ringkasan `$S/reviewer/k{1,2,3}/summary.json` (massError ≤ 4e-15). Catatan: satu kotak, 15 laporan, uji kecil. | Skor ulang di 30 m minimal untuk 3–4 kotak berlaporan banyak. Ubah jendela "±270 m" menjadi jarak tetap yang sama untuk setiap ukuran sel, lalu laporkan hasilnya per ukuran. Kesimpulan jangan mengutip skor 90 m untuk run 30 m tanpa catatan. |
| R-05 | TINGGI | **Provenance tidak memenuhi MUST-10.** ID = `B3D-` + waktu sampai menit (`panel.ts:383`, `slice(0,13)`), jadi dua ekspor dalam menit yang sama mendapat ID sama, dan ID tidak bisa dimuat ulang (tidak ada tombol Reproduce). Provenance JSON tidak memuat commit aplikasi (`VITE_GIT_SHA` hanya dipakai di pesan galat, `main.ts:51`) dan tidak memuat sha256 paket itu sendiri (hanya `inputs_sha256`). GeoTIFF kedalaman tidak membawa metadata provenance: hanya tag 256–339, 33550, 33922, 34735, 42113 (`export.ts:24-30`). Jadi berkas TIF yang dikirim terpisah tidak bisa dilacak. Gambar PNG tidak mencetak ID. Bundel ZIP dengan METHODS.md, REFERENCES.bib/.ris, LICENSE belum ada. Situs selalu memuat paket terbaru (`release.json` = e16), jadi angka seminggu lalu tidak bisa diulang di situs. | baris tersebut; ROADMAP Fase 3 "—" | ID unik (waktu + hash skenario + commit). Tulis ID, commit, rilis paket dan sha256 ke tag GDAL_METADATA/ImageDescription TIF dan ke kaki gambar PNG. Sediakan pilihan "jalankan dengan rilis paket X". |
| R-06 | TINGGI | **Hasil berbeda per perangkat untuk skenario yang sama.** `chooseCompute` memilih grid hitung berdasarkan kecepatan perangkat yang tersimpan di localStorage. Tanpa WebGPU seluruh wilayah dipaksa 90 m, dengan GPU 30/60 m (HANDOFF "What works"). Ditambah GPU float32 dan CPU float64. R-04 menunjukkan 60 m vs 90 m bisa berbeda 2× luasnya. Dua anggota tim dengan laptop berbeda bisa mendapat angka berbeda dari klik yang sama. | HANDOFF entri 19 (ADR 0016); `panel.ts` provenance `device`, `cell_m` | Untuk "mode riset", kunci ukuran sel dan perangkat hitung, catat di provenance, dan beri peringatan jika berbeda dari ukuran resmi 90 m. |
| R-07 | TINGGI | **Klaim di aplikasi yang tidak didukung.** (a) Halaman Data: `sentinel-1-flood` "use: validation", "Genangan teramati dari radar satelit, untuk menguji hasil simulasi" (`data/catalog-use.json:23`). Tidak ada kode Sentinel-1 banjir di `pipeline/`, `verification/` maupun workflow. (b) Methods §8 baris 73, kartu `observed-corrected` (`validation.json:121`), penjelasan HTML baris 197 dan berkas AI baris 93/227 masih berkata "lebih baik dari acak di 2 dari 3 banjir". `skill.json` (commit 1588e78 hari ini) sudah memberi putusan 2020 = `not_better`, 2025 = `too_few`. (c) `conclusion.ts:205-207` masih memakai `x.random` (acak di dalam DKI) dan ambang 10/3 poin, bukan `verdict`. Dengan `skill.json` sekarang, Kesimpulan akan menulis "jelas lebih baik dari acak pada 2021, sedikit lebih baik pada 2020", bertentangan dengan `verdict`. (d) HANDOFF "What works" masih menulis "~80 % of citizen reports hit … 143 vs 156 km²". | baris tersebut | Ubah `sentinel-1-flood` menjadi "planned". Satu sumber kebenaran: `conclusion.ts` membaca `verdict` dan interval. Teks Methods/kartu/AI/penjelasan dibangkitkan dari `skill.json`. Hapus baris basi di HANDOFF. |
| R-08 | TINGGI | **Uji kepekaan dari BLUEPRINT §7 belum ada.** Yang dijanjikan: Manning ±30 %, kehilangan drainase, sumber DEM (DEMNAS vs FABDEM), sumber tutupan lahan (IO vs WorldCover). Yang ada: hujan ×1,5/×2 (paket lama), AMC, pompa, saluran mikro, sapuan drain 1–40 mm/jam (paket lama, aturan lama: 03 V-02). Tidak ada Manning, DEM atau tutupan lahan (grep `ensemble/probabil/nScale` kosong). Padahal galat vertikal FABDEM sekitar 1 m (Methods §8, Hawker 2022) lebih besar dari kedalaman banjir 0,3–0,7 m. Ini kepekaan nomor satu dan belum diukur. | grep di `web/src`, `pipeline`, `verification`; BACKLOG baris 34, 36 | Paling sedikit: Manning 0,7× / 1,3×, CN terbangun 98 → 92, gangguan DEM ±0,5 m (acak berkorelasi ruang, 10 anggota). Ketiganya pada 3 banjir di 90 m. Laporkan rentangnya. |
| R-09 | TINGGI | **Sungai tanpa kedalaman dasar dan hujan IMERG adalah dua kesalahan input yang diakui tetapi belum diukur dampaknya.** Kali Baru hanya 0,33 m dari dasar ke tepi (HANDOFF). Methods §3: "No depth is added below the recorded water surface". IMERG di sel Halim 166 mm vs alat ukur 377 mm (Methods §9). Penjelasan HTML menyebut keduanya "penyebab yang bisa ditunjuk", tetapi belum ada uji terpisah (03 V-11). | Methods §3/§9; HANDOFF Known gaps | Uji satu kotak dengan hujan alat ukur dan satu dengan kedalaman sungai dari hydraulic geometry. Sebelum itu sebut keduanya "dugaan". |
| R-10 | SEDANG | **Atribusi "17 % genangan dekat sungai" dan "hulu menambah seperenam" dari paket lama** (248 vs 300 km², sebelum perbaikan air pura-pura) masih tampil di Methods §8 baris 75 dan berkas AI baris 33. Paket e16 sendiri sudah 248 km² **dengan** aliran hulu, jadi angka lama tidak lagi berlaku. | `methods.md:75`; `banjir3d-konteks-ai.md:33`; `$S/val/2020-01-01_..._summary.json` | Ulangi run tanpa hulu pada e16, atau hapus paragrafnya. |
| R-11 | SEDANG | **Tata letak peta (MUST-6/11, BLUEPRINT §8) tidak lengkap.** Tidak ada PDF, tidak ada grid koordinat/graticule, tidak ada peta inset, tidak ada QR/ID. PNG berukuran piksel layar (`export.ts:135`, `dpr`), bukan 300 dpi pada ukuran cetak. Yang sudah ada: judul, legenda, skala, panah utara, sumber, CRS. | `export.ts:130-170` | Tambahkan ekspor PDF/PNG 300 dpi A4/A3 dengan graticule, inset dan ID. |
| R-12 | SEDANG | **Tidak ada CITATION.cff dan DOI Zenodo** (`ls CITATION.cff`: tidak ada; README tanpa DOI; BACKLOG baris 15). Peneliti tidak punya cara resmi mengutip versi aplikasi. | — | Tag rilis aplikasi (mis. `app-v0.9`), CITATION.cff, arsip Zenodo. |
| R-13 | RENDAH | Reproduksibilitas run validasi **cukup baik** dan ini patut dicatat: seed bootstrap tetap (`compare.py:89`, seed 7), Node 22, `vite-node@6.0.0`, Python 3.13, `requirements.txt` dipin, rilis paket e1–e16 dan validasi v1–v32 masih ada di GitHub (dicek lewat REST API). Yang kurang: satu skrip "ulangi angka paper" dengan checksum hasil yang diharapkan. | `.github/workflows/validate.yml:127-188` | Tambahkan `verification/reproduce.sh` + sha256 hmax yang diharapkan per event. |

### Janji BLUEPRINT yang tidak ditepati atau ditepati dengan cara lain

| Janji (bagian BLUEPRINT) | Status sekarang | Bukti | Apakah aplikasi jujur memberi tahu? |
|---|---|---|---|
| MUST-3 Jabodetabek | DKI + 10 km (ADR 0005, keputusan pemilik) | R-01 | **Tidak sepenuhnya**: README menulis Jabodetabek. Kesimpulan tidak menyebut daerah yang tidak tercakup. |
| §4.2 SFINCS Research Run (angka paper) | Tidak dibangun | R-03 | **Tidak**: cap eksploratif dihapus, ROADMAP masih "in progress". |
| §4.2 Ensemble N=10 → peta peluang + pita ketidakpastian | Tidak ada kode | grep kosong | Diam. Tidak ada kalimat bahwa hasil adalah satu run tanpa pita. |
| §4.1 Uji EA (Néelz & Pender 2013) + SFINCS sebelum dipakai | EA belum, SFINCS hanya v1 | HANDOFF Known gaps | Sebagian (kartu SFINCS menyebut v1). |
| §5/§7 Validasi Sentinel-1 SAR / Copernicus EMS | Tidak ada | R-07a | **Tidak**: halaman Data menyiratkan sudah dipakai. |
| §5 Debit sungai dari pos ukur (Katulampa, Depok) | Tidak ada; hulu = hidrograf NRCS buatan | `catalog-use.json:27` "planned" | Ya (Data: "belum ada data terbuka"). |
| §5 DEMNAS 8 m sebagai medan utama | FABDEM 30 m; DEMNAS hanya lapisan peta | Methods §3 | Ya, dengan alasan (DEMNAS menyimpan ~60 % tinggi bangunan). |
| §7 Kepekaan Manning ±30 %, drainase, DEM, tutupan lahan | Hanya hujan/AMC/pompa/saluran mikro | R-08 | Tidak disebut sebagai kekurangan. |
| §7 CSI/Hit/False Alarm | CSI/FAR per RW dihitung di `skill.json` tetapi bukan angka utama. Methods §9 masih "false alarms could not be counted" | 03 V-06/V-08 | Tidak (teks basi). |
| §6 Provenance lengkap, ID dicetak di peta, Reproduce, ZIP METHODS/BIB/RIS | Sebagian: JSON terpisah, ID waktu, tanpa commit, tanpa ZIP | R-05 | Diam. |
| §6 CITATION.cff + DOI Zenodo per rilis | Tidak ada | R-12 | Diam. |
| §8 PDF, 300 dpi, graticule, inset, QR | Tidak ada | R-11 | Diam. |
| §9 8 m DEMNAS "sharp detail" | Sel 10/5/2/1 m hanya **gambar** dari hitungan 30 m | ADR 0018; Kesimpulan `drawOnly` | Ya, dijelaskan di Kesimpulan. |
| Fase 5 peta peluang untuk prakiraan hujan langsung | Tidak ada | ROADMAP baris 11 "—" | Ya di ROADMAP, tidak di aplikasi. |

## 3. Pertanyaan untuk agen utama

### (a) TEGAS: jawab ya/tidak + angka
1. Apakah Kota Bogor (0 km² di domain) dan lebih dari 85 % Kab. Bogor/Kab. Bekasi/Kab. Tangerang bisa dipelajari dengan versi sekarang? Kalau tidak, apakah pemilik sudah diberi tahu dengan kalimat sejelas itu?
2. Apakah ada satu ukuran luas yang menguji 186 km² genangan model 2020 di luar DKI? Berapa laporan PetaBencana yang jatuh di Kab. Bekasi, tempat model menggenangi 50 % lahannya?
3. Apakah run kedalaman tanpa hujan dan tanpa hulu (uji air pura-pura) pernah dibuat untuk tepi timur Kab. Bekasi? Berapa km² hasilnya?
4. Apakah skor laporan pernah dihitung pada 30 m untuk wilayah selain kotak uji saya? Uji saya: 13/33/100 % untuk 60/90/30 m.
5. Apakah mesin v2 sudah dibandingkan dengan SFINCS (bukan v1)? Berapa RMSE-nya?
6. Apakah uji EA (Néelz & Pender 2013) sudah dijalankan? Uji nomor berapa?
7. Apakah ada run tiga banjir dengan Manning ±30 %? Berapa perubahan luas DKI dan hit rate?
8. Apakah ada run tiga banjir dengan medan DEMNAS (atau FABDEM ± gangguan 0,5–1 m)? Berapa perubahan luas DKI?
9. Berapa km sungai OSM saja yang tinggi dasar-ke-tepinya kurang dari 1 m di paket e16?
10. Apakah salah satu banjir pernah dijalankan dengan hujan alat ukur (Halim 377 mm/hari)? Berapa skornya?
11. Apakah ID provenance unik untuk dua ekspor dalam menit yang sama? (Menurut `panel.ts:383` tidak.)
12. Apakah GeoTIFF kedalaman membawa ID provenance, commit aplikasi dan rilis paket di metadatanya? (Menurut `export.ts:24-30` tidak.)
13. Apakah provenance JSON mencatat commit aplikasi? Berapa nilainya pada build sekarang?
14. Apakah dua perangkat (HP tanpa WebGPU vs laptop GPU) memberi luas genangan yang sama untuk skenario "Banjir nyata 2020 seluruh wilayah"? Berapa selisihnya?
15. Apakah data Sentinel-1 banjir dipakai di kode mana pun? Kalau tidak, apakah `catalog-use.json` akan diubah hari ini?
16. Apakah `conclusion.ts` akan membaca `verdict` dari `skill.json` sehingga 2020 tertulis "tidak lebih baik dari acak"?
17. Apakah ada CITATION.cff, tag rilis aplikasi dan DOI Zenodo? Nomor berapa?
18. Apakah seorang peneliti luar bisa mendapatkan hmax 2020 yang sama persis (sha256) dengan satu perintah dari commit 1588e78 + e16 + o10? Berapa sha256 yang diharapkan?
19. Apakah keputusan "pompa mati, saluran mikro mati" pernah diuji ulang pada paket e16 (tanpa air pura-pura)? (Saya hanya menemukan skor e13/e14.)

### (b) TERBUKA: tentang pilihan dan alasannya
20. Mengapa DKI + 10 km dan bukan Jabodetabek? Berapa sel, waktu run dan ukuran paket bila domain diperluas ke Jabodetabek pada 60/90 m? Siapa yang memutuskan bahwa 10 km cukup?
21. Bagaimana hasil di wilayah penyangga (tanpa saluran DSDA, pompa, penurunan tanah) bisa dibandingkan dengan hasil DKI dalam satu peta tanpa menyesatkan?
22. Tanpa Research Run, apa status mesin browser untuk angka paper? Apakah cap "eksploratif" (ADR 0006) harus kembali?
23. Galat vertikal FABDEM sekitar 1 m, kedalaman banjir 0,3–0,7 m. Bagaimana tim akan menyatakan bahwa letak genangan di tingkat jalan/RT berada di bawah daya pisah data?
24. Mengapa ambang luas 0,15 m dan ambang kena 0,10 m berbeda, dan seberapa peka hasil terhadap keduanya? (Lihat juga 03 V-07.)
25. Aliran hulu Cisadane (~1.100 km²) memakai satu hidrograf satuan NRCS tanpa penelusuran sungai dan tanpa pos ukur. Bagaimana debit puncak ketiga banjir dicek terhadap tinggi muka air Katulampa/Depok/Manggarai yang tercatat?
26. Bagaimana laporan di luar DKI (28–65 %, 03 V-04) seharusnya dibobot, padahal di sana data saluran tidak ada?
27. Apa yang boleh dikutip peneliti: rilis paket mana, commit mana, gambar apa, dan kalimat keterbatasan apa yang wajib menyertainya?
28. Apa rencana kedalaman sungai (hydraulic geometry atau penampang dari pemilik) dan bagaimana ketidakpastiannya ditampilkan?
29. Bila skor tiga banjir tetap tidak lebih baik dari acak/HAND setelah hujan alat ukur, apakah tim siap menulis bahwa model ini adalah alat skenario, bukan alat prediksi lokasi?
30. Siapa yang memeriksa ulang teks Methods/kartu/AI setiap kali angka berubah? (Sudah 4 kali ada teks yang tertinggal: 03 V-08, R-07, R-10.)

## 4. Penilaian: apa yang aman dibawa ke rapat riset

**Aman, dengan kalimat keterbatasan:**
- Bukti bahwa kode menghitung dengan benar (bukan bukti cocok dengan kenyataan): neraca massa 10⁻¹⁴–10⁻¹⁵ (`summary.json` e16), GPU = CPU (selisih 0,003 m), gelombang analitik Hunter 2005 dalam 3 %.
- **Perbandingan antar-skenario dengan set-up yang sama**, sebagai arah dan bukan besaran mutlak. Contoh: muka laut naik vs tidak, hulu nyala vs mati, dan penurunan tanah 2013 → 2025. Dihitung pada 90 m, seluruh wilayah, paket e16. Selalu sebut "satu run, tanpa pita ketidakpastian".
- Pola kasar per kota/koridor sungai **di DKI**, dengan kalimat "pada banjir 2021 letak genangan lebih baik dari acak (33 vs 24–26 %, interval 26–41 %); pada 2020 tidak; pada 2025 laporan terlalu sedikit".
- Temuan negatif itu sendiri layak dilaporkan: dengan medan terbuka 30 m dan hujan satelit 0,1°, model 2D tidak mampu menempatkan genangan tingkat lingkungan. Kedalaman di titik laporan 5–9 cm vs 55–70 cm dilaporkan warga (`skill.json`).
- Lapisan data sebagai deskripsi (saluran DSDA, sebaran laporan, peta tanah, laju penurunan tanah) dengan sitasi.

**Tidak aman (jangan dikutip sebagai angka):**
- Kedalaman mutlak di peta dan di titik mana pun. Bias −0,5 m.
- Luas genangan mutlak (DKI 2020: 62 km² vs 156 km² dilaporkan) dan semua jumlah bangunan/penduduk terdampak.
- Peta 10/5/2/1 m sebagai "detail". Itu gambar halus dari hitungan 30 m.
- Semua hasil di luar DKI, terutama Kab. Bekasi (50 % lahan tergenang, belum diuji) dan pinggir domain.
- "Kalibrasi drain 0 mm/jam", "hit rate", "validasi" sebagai bukti ketepatan (03 V-01, V-02).
- Besarnya efek pompa dan saluran mikro (kompensasi kesalahan hujan, 03 V-03).
- Atribusi "17 % dekat sungai" dan "hulu = seperenam luas" (R-10).
- Hujan rencana sebagai kala ulang. Belum ada analisis frekuensi (HANDOFF Next steps 1).
- **Semua angka dan gambar yang dibuat sebelum 18 Nov 2026** (lihat bagian 5).

**Wajib ditulis sebagai keterbatasan di setiap paper/slide:** domain DKI + 10 km (bukan Jabodetabek). Medan FABDEM 30 m dengan galat sekitar 1 m. Sungai OSM tanpa kedalaman dasar. Hujan IMERG 0,1° (Halim 166 vs 377 mm). Hulu = hidrograf NRCS tanpa pos ukur. Saluran tersier tidak ada, saluran kota tidak dimodelkan sebagai jaringan, pompa mati. Satu run deterministik tanpa ensemble. Uji hanya pada 3 banjir yang juga dipakai menyetel (in-sample). Skor dihitung pada 90 m. Hasil di luar DKI belum diuji. Mesin belum dibandingkan ulang dengan SFINCS/EA.

## 5. Riwayat kesalahan yang ditemukan sesudah hasil ditunjukkan

| Ditemukan | Kesalahan | Berlaku untuk | Angka terbit yang berubah (lama → baru) | Buang? |
|---|---|---|---|---|
| 30 Okt (entri 12) | Hujan ERA5 jauh terlalu kecil (66 mm vs 377 mm Halim) | Validasi pertama v1 | Kena 54 %, kedalaman 0,12 m → diganti IMERG | Buang skor ERA5 |
| 30 Okt (ADR 0009) | Run tanah sementara terlalu basah | Run seluruh wilayah awal | 777 km² → tidak dipakai | Buang |
| 10 Nov (entri 21, ADR 0017) | Sel sungai memakai n tutupan lahan (terbangun 0,15), sungai 4× terlalu kasar. Run sel halus menghitung bangunan dua kali | Semua run sebelum 10 Nov | Seluruh wilayah 300/136/274 → 290/140/273 km². Kotak uji 30 m 0,41 → 0,065 km², 10 m 0,25 → 0,08–0,10 km² | Buang peta sel halus dan kotak kecil sebelum 10 Nov |
| 10 Nov (entri 22, ADR 0018) | Sel halus 10 m (porositas) menggambar sungai bertangga dan terlalu dalam | Run sel halus 8–10 Nov | Terdalam 4,46 → 0,80 m. Bangunan 6.444 → 2.186. Penduduk 26.191 → 9.328 (sekitar 3× lebih tinggi) | Buang semua angka keterpaparan sel halus |
| 13 Nov (entri 23, ADR 0019) | **Hit rate digelembungkan**: air sungai ikut dihitung | Semua skor 30 Okt–13 Nov | 80/78/81 % (v2–v5) dan 72/78/81 % (v3, e6) → 50/47/41 % (jendela, daratan). Kalibrasi drain 0 dibuat dengan aturan lama | Buang semua "≈80 % laporan kena" |
| 13 Nov (entri 23) | **Hujan rencana membuang hujan**: total R24 dipotong ke D jam (150 mm/6 jam → 94,5 mm) | Semua hujan rencana D ≠ 24 jam sebelum 13 Nov | Hujan masuk (R24·(D/24)^⅓): 1 jam −65 %, 3 jam −50 %, 6 jam −37 %, 12 jam −21 % (hitungan saya dari rumus Methods §6) | Buang semua run hujan rencana < 24 jam sebelum 13 Nov |
| 13 Nov (entri 25) | Dobel hitung penyerap saluran seragam + saluran mikro. Teks Methods tanah 83/17 % (salah) → 98/2 % | Run dengan saluran mikro nyala 13 Nov. Teks Methods | Hanya run uji saluran mikro | Cek ulang kalau dipakai |
| 17–18 Nov (entri 26, ADR 0021) | **Air pura-pura**: saluran DSDA penuh sejak awal (14,6 km² banjir tanpa hujan). Situ/kolam dihitung banjir. Hujan rencana hulu tanpa reduksi luas (Cisadane 8.660 m³/s) | Paket e6–e14 (1–17 Nov), semua mode | Kena 50/47/41 → 44/33/35 %. Luas DKI 2020 83 (sebelumnya 87, 143) → 62 km². Kedalaman di laporan 0,10/0,10/0,07 → 0,09/0,05/0,06 m. AUC RW 0,62 → 0,59/0,58/0,42. Skor pompa, saluran mikro dan atribusi 248/300 km² semua dari paket bermasalah | Buang semua angka paket ≤ e15 |
| 20 Nov (commit 1588e78, laporan 03) | Pembanding acak tidak adil (hanya daratan DKI) | Semua putusan "lebih baik dari acak" | 2020 "lebih baik" → `not_better` (p 0,46). 2025 → `too_few`. Teks Methods/kartu/Kesimpulan belum ikut diubah (R-07) | Tarik kalimat "2 dari 3 banjir" |

Aturan praktis untuk tim pemilik: **semua angka, peta, dan tabel keterpaparan yang dibuat sebelum 18 Nov 2026 dianggap tidak berlaku.** Dari yang sesudahnya, hanya pakai yang tercantum di bagian 4 "aman", dan putusan "lebih baik dari acak" hanya untuk 2021.

## 6. Apa yang sudah benar
- Kejujuran dan kontrol negatif: uji tanpa hujan (14,6 → 0,1 km²) dan skor acak yang adil (commit 1588e78) adalah praktik ilmiah yang benar.
- Run validasi bisa diulang: versi dipin, seed tetap, rilis e1–e16 dan v1–v32 tersimpan, provenance mencatat `inputs_sha256` paket.
- Neraca massa sangat ketat (≤ 1e-14) pada semua run saya dan run resmi.
- Methods sudah mengakui galat medan sekitar 1 m, sungai tanpa kedalaman, IMERG terlalu rata, dan equifinality. Alasan memilih FABDEM, bukan DEMNAS, juga terdokumentasi.
- Ekspor GeoTIFF memakai CRS yang benar (EPSG:32748, nodata −9999). PNG punya judul, legenda, skala, panah utara dan sumber.
- Kotak riset kecil berjalan cepat (4,4 km di 90 m: 5 detik; di 30 m: 131 detik di CPU). Uji kepekaan yang diusulkan bisa dikerjakan murah.
