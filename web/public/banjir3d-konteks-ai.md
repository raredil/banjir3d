# Banjir3D: file konteks untuk AI

Dibuat dari repositori Banjir3D pada 2026-11-13 (commit lihat git log). Aplikasi: https://raredil.github.io/banjir3d/ · Kode: https://github.com/raredil/banjir3d

Cara pakai: tempelkan seluruh file ini ke percakapan AI, lalu tempelkan teks dari tombol "Salin untuk AI" di kartu Kesimpulan aplikasi, lalu bertanyalah.

## A. Petunjuk untuk AI yang membaca file ini

1. File ini adalah satu-satunya sumber kebenaran tentang aplikasi Banjir3D. Jawab hanya dari isi file ini dan dari hasil simulasi yang ditempelkan pengguna. Kalau jawabannya tidak ada di sini, katakan "tidak tercantum di file konteks Banjir3D", jangan menebak.
2. Pengguna bukan programmer. Jawab dalam bahasa Indonesia sederhana, kalimat pendek, beri contoh sehari-hari. Istilah teknis boleh dipakai sekali lalu dijelaskan.
3. Bedakan selalu tiga hal: (a) apa yang dihitung model, (b) apa yang diamati di dunia nyata (laporan warga, data Pemprov), (c) dugaan. Tandai dugaan dengan kata "kemungkinan".
4. Angka hasil simulasi adalah keluaran model, bukan pengamatan. Model ini diuji dengan banjir nyata (bagian F) dan hasil ujinya punya kelemahan yang harus disebut bila relevan.
5. Bagian B sampai H adalah ringkasan bahasa sederhana. Bagian "Metode ilmiah lengkap" (bahasa Inggris) adalah uraian teknis yang persis sama dengan halaman Metode di aplikasi; pakai itu untuk pertanyaan yang rinci.

## B. Apa itu Banjir3D

Aplikasi peta di peramban (https://raredil.github.io/banjir3d/) yang menghitung ke mana air hujan dan air sungai mengalir dan di mana menggenang, untuk DKI Jakarta ditambah 10 km di sekelilingnya (sekitar 52 × 51 km). Semua hitungan berjalan di komputer pengguna. Semua data berasal dari sumber terbuka dan tercantum di halaman Data.

Pengguna hanya mengatur "gaya dari luar": hujan (jumlah, lama, atau hujan nyata dari satelit), tinggi muka laut, lama simulasi, area, ukuran sel, dan komponen yang dinyalakan. Semua hal lain (tinggi tanah, sungai, resapan, kekasaran, sungai dari hulu) dibaca dari data.

## C. Bagaimana model menentukan banjir (dasar penentuan)

Model ini bukan peta kontur dan bukan "isi cekungan sampai penuh". Ia menghitung gerak air dengan hukum fisika di setiap kotak 30 × 30 m, setiap beberapa detik:

1. **Hujan jatuh** ke setiap kotak.
2. **Sebagian meresap** ke tanah. Banyaknya tergantung tutupan lahan (pohon, rumput, sawah menyerap; atap dan jalan hampir tidak) dan jenis tanah (tanah liat Jakarta lambat menyerap). Metode: SCS Curve Number (USDA). Makin banyak hujan yang sudah turun, makin sedikit yang masih bisa meresap.
3. **Sisanya mengalir** ke kotak tetangga yang permukaan airnya lebih rendah. Kecepatannya ditentukan beda tinggi permukaan air (gravitasi) dan kekasaran permukaan (rumah dan pohon menahan, jalan dan saluran licin). Persamaannya adalah persamaan air dangkal bentuk "local inertial" (Bates dkk. 2010), dipakai juga oleh model riset LISFLOOD-FP dan SFINCS. Jadi model memperhitungkan kontur dan kemiringan, tetapi juga volume air, kecepatan, dan waktu.
4. **Sungai dan saluran** adalah alur yang ditoreh ke tanah. Air sungai mengalir di dalam alur; **sungai hanya meluap di tempat airnya naik melebihi tebing alurnya**. Karena itu tidak semua sungai meluap: tergantung berapa banyak air yang datang, seberapa besar alurnya, dan seberapa rendah tanah di sampingnya.
5. **Air kiriman dari hulu** (Bogor, Puncak, Depok): hujan di daerah tangkapan di luar area dihitung menjadi debit sungai (metode hidrograf satuan NRCS) dan dimasukkan di titik sungai yang memasuki area.
6. **Laut** dijaga pada tinggi yang dipilih. Air yang mencapai tepi area keluar.
7. **Tergenang** = air lebih dalam dari 15 cm di luar alur sungai. Peta menampilkan warna mulai 5 cm.

Hasil uji pada banjir 1 Januari 2020 (seluruh wilayah): hanya sekitar 17 % genangan model berada dalam jarak 90 m dari sungai. Sebagian besar genangan adalah air hujan setempat yang terkumpul di tanah rendah; air sungai dari hulu menambah sekitar seperenam luas, tetapi hampir menggandakan luas yang lebih dalam dari 1 m (dari 15 menjadi 26 km²). Jadi banjir di model bukan hanya "sungai meluber".

## D. Komponen model dan statusnya

| Komponen | Status | Keterangan sederhana |
|---|---|---|
| Medan FABDEM 30 m | selalu | Tinggi tanah tanpa bangunan dan pohon (dari radar satelit Copernicus 2011–2015, bangunan dihapus dengan pembelajaran mesin; Hawker dkk. 2022). |
| Sungai dan kanal OpenStreetMap | selalu | Alur ditoreh ke medan. Lebar dari peta. **Kedalaman dasar sungai tidak ada datanya**: alur hanya sedalam permukaan air yang terekam satelit. Ini membuat kapasitas sungai di model kemungkinan lebih kecil dari kenyataan. |
| Saluran primer dan sekunder Dinas SDA (Jakarta Satu) | selalu | Ditoreh dengan **lebar dan dalam yang tercatat**. |
| Saluran tersier (berkas pemilik) | tidak dipakai | Tidak ada data lebar dan dalam. Hanya tampil di peta. |
| Resapan tanah (RTH, kebun, sawah) | diuji, bisa dimatikan | Dari peta tutupan lahan Esri 2024 dan tanah SoilGrids. sekitar 85 % daratan di area hitung adalah kawasan terbangun (rata-rata Curve Number 97 dari 100), jadi pengaruh RTH kecil di pusat kota tetapi besar di hulu. |
| Kondisi tanah sebelum hujan | diuji "normal", bisa diganti | Kering / normal / basah menurut hujan 5 hari sebelumnya (< 36 mm, 36–53 mm, > 53 mm; Chow dkk. 1988). Ini cara hujan mingguan atau bulanan memengaruhi banjir. |
| Penurunan tanah | diuji, bisa dimatikan | Laju dari satelit radar Sentinel-1 2016–2024 (hingga sekitar 4 cm/tahun), hanya di dalam DKI. |
| Air kiriman dari hulu | diuji, bisa dimatikan | Debit dari daerah tangkapan di luar area. |
| Pompa polder DKI | skenario, bawaan mati | 263 rumah pompa, kapasitas tercatat; kapasitas dibagi rata ke polder. Lihat bagian G. |
| Serapan saluran kecil (mm/jam) | skenario, bawaan 0 | Pengganti got/saluran tersier yang tidak ada ukurannya. Lihat bagian G. |
| Muka laut | pengguna | 0 = rata-rata. Tanggul laut tidak ada di model. |
| Tanggul laut/sungai, pintu air, waduk hulu | belum bisa | Tidak ada data tinggi puncak tanggul atau aturan operasi pintu air. |

## E. Pertanyaan yang sering muncul

**Kenapa di sekitar sungai sering biru tua?** Air di dalam alur sungai sendiri tidak digambar (itu sungai, bukan banjir). Yang tergambar biru di dekat sungai adalah air yang sudah melewati tebing, atau tanah rendah di bantaran yang menampung hujan. Bantaran sungai memang tempat paling rendah, jadi paling dalam. Satu penyebab model bisa melebih-lebihkan luapan di sungai tertentu: kedalaman dasar sungai tidak ada datanya, sehingga alur di model lebih dangkal dari aslinya. Sebaliknya, hasil uji menunjukkan model secara umum terlalu kering (bagian F).

**Apakah banjir hanya mengikuti kontur dan kemiringan?** Tidak. Kontur dan kemiringan menentukan arah, tetapi model juga menghitung berapa banyak air (hujan dikurangi resapan, ditambah kiriman hulu), seberapa cepat mengalir (kekasaran), dan kapan datang. Tanah rendah yang tidak mendapat cukup air tidak tergenang.

**Kenapa hasil 30 m, 60 m dan 90 m bisa berbeda?** Pada 60/90 m tinggi tanah dirata-rata per kotak besar. Cekungan kecil, tebing sungai, dan jalan yang lebih tinggi ikut terhaluskan, jadi air bisa menyebar sedikit lain. Perbedaan seperti ini wajar pada semua model banjir dan disebut "ketergantungan resolusi". 30 m adalah ukuran asli data dan ukuran yang paling dapat dipercaya; 90 m dipakai untuk uji seluruh wilayah karena lebih cepat. Contoh besarnya ada di bagian F.

**Kenapa 10, 5, 2, 1 m hasil angkanya sama dengan 30 m?** Karena tidak ada data tinggi tanah terbuka yang lebih rinci dari 30 m tanpa bangunan. Menghitung di kotak lebih kecil hanya akan memakai tanah hasil interpolasi, sehingga hasilnya terlihat rinci padahal tidak lebih benar (sudah dicoba: hasilnya bergeser ke tempat lain). Jadi air dihitung di 30 m, lalu permukaan airnya digambar halus pada kotak kecil. Angka luas, kedalaman, bangunan, penduduk sama persis; yang berubah hanya kehalusan gambar.

**Kenapa pompa bawaannya mati? Apakah pompa tidak berguna?** Lihat bagian G. Singkatnya: model sudah kekurangan air karena hujan satelit lebih rendah dari hujan sebenarnya. Menyalakan pompa membuang air lagi, jadi hasil makin jauh dari laporan. Ini menutup kesalahan lain, bukan bukti bahwa pompa tidak bekerja.

**Hujan 24 jam, 48 jam, mingguan, bulanan, tahunan?** Model bisa menghitung hujan 1 sampai 72 jam (3 hari), atau pola per jam yang diketik, atau hujan nyata dari satelit. Banjir ditentukan oleh derasnya hujan per jam dan jumlah dalam 1–3 hari. Hujan mingguan, bulanan atau tahunan tidak bisa disimulasikan sebagai satu hujan: jumlah sebesar itu tersebar berminggu-minggu; dibagi rata akan menjadi gerimis yang tidak membanjiri apa pun, padahal kenyataannya ada hari-hari deras di dalamnya. Pengaruh hujan berhari-hari sebelumnya masuk lewat "Kondisi tanah sebelum hujan" (tanah basah menyerap lebih sedikit). Yang berubah di hasil: makin basah tanah, makin banyak air sampai ke sungai, terutama dari hulu yang masih bertanah terbuka.

**Apakah RTH (ruang terbuka hijau) dihitung?** Ya, lewat resapan tanah per kotak 30 m dari peta tutupan lahan 2024. Bisa dimatikan untuk melihat "bagaimana jika semua permukaan di area hitung kedap air" (daerah hulu tidak berubah). Contoh pada kotak 4,4 km di Kampung Melayu (150 mm/6 jam): luas banjir 5,1 km² menjadi 5,2 km² bila resapan dimatikan, dan 5,5 km² bila tanah basah (air hulu bertambah). Taman kecil di bawah 10 m tidak terlihat di peta tutupan lahan.

**Kenapa tidak memakai LiDAR?** Ada data LiDAR DKI Jakarta tahun 2012 yang dipakai beberapa penelitian, tetapi data itu tidak terbuka untuk diunduh publik. Aplikasi ini hanya memakai data terbuka. Bila pemilik aplikasi memperoleh berkas LiDAR resmi (misalnya dari BIG atau Pemprov DKI) dengan izin pakai, jalur pengolahan dapat memakainya sebagai medan; tanah harus digeser dengan laju penurunan tanah sejak 2012.

**Kenapa DEMNAS tidak dipakai sebagai medan?** DEMNAS (BIG, 8 m) masih menyimpan sebagian tinggi bangunan: di kawasan terbangun rata-rata 0,79 m lebih tinggi dari FABDEM, dan sekitar 60 % tinggi bangunan dan pohon masih ada. Air akan tertahan di atas "atap". DEMNAS ditampilkan sebagai pembanding.

**Bisakah daerah lain selain Jakarta?** Belum di aplikasi. Hampir semua data dasarnya global (FABDEM, tutupan lahan Esri, SoilGrids, OpenStreetMap, Copernicus GLO-90, WorldPop, Overture), jadi wilayah lain bisa dibuat dengan menjalankan jalur pengolahan untuk kotak wilayah baru. Data khusus Jakarta (saluran Dinas SDA, pompa, penurunan tanah, laporan PetaBencana) tidak ada di wilayah lain, dan wilayah baru belum diuji dengan banjir nyata sampai ada data laporan banjir di sana.

**Seberapa baru datanya?** Tutupan lahan 2024; bangunan Overture 2026; penduduk WorldPop 2025; sungai OpenStreetMap Oktober 2026; saluran, pompa dan genangan Dinas SDA (Jakarta Satu) diambil November 2026; penurunan tanah 2016–2024; medan FABDEM dari radar 2011–2015 (digeser dengan penurunan tanah); hujan nyata GPM IMERG Final V07.

## F. Uji dengan banjir nyata (validasi)

Model dijalankan pada seluruh wilayah dengan kotak 90 m untuk tiga banjir: 1 Januari 2020, 20 Februari 2021, 4 Maret 2025, memakai hujan satelit per jam GPM IMERG, lalu dibandingkan dengan laporan warga PetaBencana.id dan data Pemprov DKI.

| Banjir | Laporan | Kena (±270 m) | Acak (±270 m) | Kena (kotak sama) | Acak (kotak sama) | Kedalaman laporan (median) | Kedalaman model (median) | Luas tergenang DKI model |
|---|---|---|---|---|---|---|---|---|
| 2020-01-01 | 260 | 50 % | 43 % | 23 % | 19 % | 70 cm | 10 cm | 83 km² (dilaporkan 156 km²) |
| 2021-02-20 | 384 | 47 % | 28 % | 21 % | 11 % | 65 cm | 10 cm | 45 km² |
| 2025-03-04 | 49 | 41 % | 43 % | 14 % | 19 % | 55 cm | 7 cm | 77 km² |

Pengaturan yang diuji: kotak 90 m, hujan GPM IMERG, pompa mati, serapan saluran kecil 0, tanah normal, penurunan tanah sampai tanggal banjir.

Dengan pompa menyala: 2020-01-01: kena 50 % → 43 %, luas DKI 83 → 67 km²; 2021-02-20: kena 47 % → 45 %, luas DKI 45 → 38 km²; 2025-03-04: kena 41 % → 41 %, luas DKI 77 → 64 km².

Dengan tanah basah (AMC III): 2020-01-01: kena 50 % → 51 %, luas DKI 83 → 84 km²; 2021-02-20: kena 47 % → 48 %, luas DKI 45 → 47 km²; 2025-03-04: kena 41 % → 41 %, luas DKI 77 → 80 km².

Cara membaca: "kena" berarti model menggenangi daratan sedalam paling sedikit 10 cm di kotak laporan atau di kotak sekitarnya (sekitar 270 m, karena letak laporan tidak persis). "Acak" adalah skor yang didapat titik-titik yang disebar acak di daratan DKI dengan aturan yang sama; model hanya berguna bila skornya jelas di atas skor acak.

Penting dan jujur: sebelum 13 November 2026 aplikasi menulis "sekitar 80 % laporan kena" (dan 72–77 % setelah perbaikan November). Angka itu memakai aturan yang terlalu longgar: air di dalam alur sungai ikut dihitung, sehingga setiap laporan di dekat sungai otomatis "kena". Aturan itu sudah diganti dengan aturan di atas.

Kesimpulan uji (jujur): letak genangan model jelas lebih baik dari acak pada banjir 2021, sedikit lebih baik pada 2020, dan tidak lebih baik pada 2025 (hanya 49 laporan). Di titik laporan, model jauh lebih dangkal (sekitar 10 cm, laporan 55–70 cm), dan luas banjir DKI 2020 hanya 83 km² dari 156 km² yang dilaporkan. Jadi model ini menggambarkan pola genangan menurut fisika dan data terbuka, cocok untuk membandingkan skenario ("bagaimana jika hujan 200 mm", "bagaimana jika pompa bekerja penuh") dan melihat kawasan serta koridor sungai yang rawan, tetapi BELUM bisa dipakai sebagai ramalan jalan mana atau RW mana yang banjir.

Dua penyebab utama yang diketahui:
1. Hujan satelit dirata-rata per kotak sekitar 11 km, sehingga puncak hujan setempat hilang (stasiun Halim mencatat 377 mm dalam sehari pada 1 Jan 2020, kotak satelitnya hanya 166 mm dalam tiga hari).
2. Galat tinggi tanah terbuka 30 m sekitar 1 m di kawasan terbangun (Hawker dkk. 2022), lebih besar dari kedalaman banjir biasa (30–70 cm). Jalan mana yang banjir duluan ditentukan beda tinggi puluhan sentimeter, yang tidak terlihat oleh data ini. LiDAR atau pengukuran tinggi tanah yang rapat akan sangat membantu.

## G. Pompa, saluran kecil, dan "pengaturan yang diuji"

Pompa polder (665 m³/detik total) dan serapan saluran kecil sudah diuji. Setiap kali dinyalakan, skor uji turun dan luas banjir 2020 makin jauh di bawah luas yang dilaporkan. Ini tidak berarti pompa dan got tidak bekerja. Artinya: model sudah kekurangan air (hujan satelit terlalu rendah), sehingga menambahkan alat pembuang air membuatnya makin kering. Dua kesalahan yang saling menutup ini tidak bisa dipisahkan dengan data yang ada sekarang (istilahnya ekuifinalitas). Karena itu aplikasi memakai pengaturan yang paling cocok dengan pengamatan (pompa mati, serapan 0) sebagai bawaan, dan pompa tersedia sebagai skenario. Bila suatu saat tersedia hujan stasiun per jam yang rapat, pengujian ini harus diulang.

## H. Cara membaca angka hasil

- **Luas banjir**: luas daratan yang pernah lebih dalam dari 15 cm selama simulasi (di luar alur sungai dan laut).
- **Terdalam**: kedalaman terbesar di luar alur sungai; bisa juga kolam atau situ yang tidak tercatat sebagai sungai.
- **Bangunan tergenang**: jumlah jejak bangunan Overture yang titik tengahnya di kotak lebih dalam dari 15 cm.
- **Penduduk terdampak**: penduduk tinggal (WorldPop 2025) di kotak lebih dalam dari 15 cm. Bukan jumlah orang yang ada di lokasi saat banjir.
- **Asal air**: bagian air dari hujan di area dan dari sungai hulu, dari neraca air simulasi.
- **Kesalahan neraca air**: seberapa tepat air dihitung (masuk = keluar + tersimpan). Angka sekitar 10⁻¹⁵ berarti tidak ada air yang hilang atau tercipta karena hitungan.

## I. Peta di aplikasi dan gunanya

| Peta | Guna | Keterangan |
|---|---|---|
| Citra satelit Sentinel-2 | Hanya tampilan | Foto satelit untuk melihat keadaan nyata. Tidak masuk hitungan. |
| Ketinggian permukaan (GLO-30) | Hanya tampilan | Tinggi permukaan termasuk atap dan pohon. Tidak dipakai menghitung, karena air tidak mengalir di atas atap. Pembanding untuk FABDEM. |
| Bayangan relief permukaan (GLO-30) | Hanya tampilan | Bayangan bukit dari data yang sama (tampilan). |
| Ketinggian tanah (FABDEM) | Dipakai menghitung | Tinggi tanah yang dihitung: arah dan kecepatan air mengikuti tinggi rendahnya tanah ini (30 m, bangunan dan pohon sudah dihilangkan). |
| Bayangan relief tanah (FABDEM) | Hanya tampilan | Bayangan bukit dari FABDEM (tampilan). |
| Ketinggian DEMNAS 8 m (BIG) | Tidak dipakai | Tidak dipakai menghitung: DEMNAS masih menyimpan sebagian tinggi bangunan (kawasan terbangun rata-rata +0,79 m lebih tinggi dari FABDEM), sehingga air akan tertahan di atas atap. Dipakai sebagai pembanding. |
| Bayangan relief DEMNAS 8 m | Hanya tampilan | Bayangan bukit DEMNAS (tampilan). |
| Laju penurunan tanah 2016–2024 | Dipakai menghitung | Dipakai: tanah diturunkan sesuai laju ini sampai tanggal simulasi (bisa dimatikan di Komponen model). |
| Tutupan lahan 2024 (Esri/IO) | Dipakai menghitung | Dipakai: menentukan berapa hujan yang meresap (RTH, sawah, bangunan) dan seberapa kasar permukaan menahan aliran. |
| Kelompok tanah (daya serap, SoilGrids) | Dipakai menghitung | Dipakai menghitung: jenis tanah menentukan berapa hujan yang meresap di lahan terbuka (Curve Number). Lahan terbangun dihitung kedap air. |
| Tutupan lahan 2021 (ESA WorldCover) | Hanya tampilan | Peta tutupan lahan lain (2021) sebagai pembanding. Tidak dipakai menghitung. |
| Frekuensi genangan air 1984–2021 | Hanya tampilan | Seberapa sering tempat ini berair menurut satelit 1984–2021. Tidak dipakai menghitung; berguna untuk melihat situ dan tambak. |
| Sungai, kanal, situ (OSM) | Dipakai menghitung | Dipakai: alur sungai dan kanal ditoreh ke medan supaya air bisa mengalir di dalamnya. Lebar dari peta; kedalaman dasar sungai tidak ada datanya. |
| Saluran primer & sekunder (DSDA) | Dipakai menghitung | Dipakai: saluran primer dan sekunder Dinas SDA ditoreh ke medan dengan lebar dan dalam yang tercatat. |
| Saluran tersier / penghubung (DKI, 1:5.000) | Tidak dipakai | Tidak dipakai menghitung: tidak ada data lebar dan dalamnya. Pengaruhnya hanya bisa dicoba lewat "Serapan saluran kecil". |
| Saluran mikro Jakarta Selatan (lebar, dalam) | Skenario | Dipakai menghitung bila "Saluran mikro Jakarta Selatan" dinyalakan: kapasitas tiap saluran (lebar × dalam, rumus Manning) menjadi air yang dibuang per jam dari daratan yang dilayaninya. Ruas tanpa ukuran hanya tampil di peta. |
| Rumah pompa (DSDA) | Skenario | Dipakai bila "Pompa polder DKI" dicentang: kapasitas tiap rumah pompa menguras polder tempatnya. |
| Sistem polder (DSDA) | Skenario | Batas polder: kapasitas pompa dibagi rata ke daratan polder ini (hanya saat pompa dinyalakan). |
| Tanggul laut NCICD (DSDA) | Tidak dipakai | Tidak dipakai menghitung: data tidak memuat tinggi puncak tanggul. |
| Genangan resmi per RT (DSDA) | Untuk menguji | Catatan genangan resmi Dinas SDA per RT: pembanding hasil model pada uji banjir nyata. |
| Laporan warga (PetaBencana) | Untuk menguji | Laporan warga PetaBencana.id: dipakai menguji apakah model menggenangi tempat yang dilaporkan. |
| Curah hujan 1 Januari 2020 | Dipakai menghitung | Dipakai pada mode "Banjir nyata" 1 Jan 2020: hujan satelit per kotak 0,1° (sekitar 11 km). |
| Curah hujan 20 Februari 2021 | Dipakai menghitung | Dipakai pada mode "Banjir nyata" 20 Feb 2021. |
| Curah hujan 4 Maret 2025 | Dipakai menghitung | Dipakai pada mode "Banjir nyata" 4 Mar 2025. |
| Bangunan (Overture, zoom dekat) | Untuk dampak | Dipakai menghitung jumlah bangunan di area tergenang. Tidak memengaruhi aliran air. |
| Penduduk per sel 100 m (2025) | Untuk dampak | Dipakai menghitung jumlah penduduk (tempat tinggal) di area tergenang. |
| Batas kabupaten/kota | Hanya tampilan | Batas kabupaten/kota untuk orientasi. |
| Lembar unduhan DEMNAS | Hanya tampilan | Letak lembar peta DEMNAS (tampilan). |
| Batas wilayah simulasi | Dipakai menghitung | Batas area hitung: DKI Jakarta ditambah 10 km di sekelilingnya. |
| Batas DKI Jakarta | Untuk menguji | Batas DKI: dipakai untuk menghitung luas banjir DKI saat diuji dengan laporan Pemprov. |

## J. Nilai tetap yang dipakai model

- Ambang tergenang 0,15 m; warna peta mulai 0,05 m; laporan dianggap "kena" bila model ≥ 0,10 m di daratan.
- Kekasaran Manning: kawasan terbangun 0,15; alur sungai/saluran 0,035; nilai kelas lain dari tabel HEC-RAS menurut Chow (1959).
- Curve Number kawasan terbangun 98 (kedap air); kelas lain dari tabel TR-55; kelompok tanah 83 % D, 17 % C.
- Serapan saluran kecil bawaan 0 mm/jam; pompa bawaan mati; saluran mikro Jakarta Selatan (data ukuran DSDA) bawaan mati.
- Langkah waktu: faktor Courant 0,7, paling lama 15 detik; aliran hanya lewat sisi kotak yang airnya lebih dari 1 mm.

## K. Metode ilmiah lengkap (sama dengan halaman Metode di aplikasi, bahasa Inggris)

This text describes only what the running system does. Every number the engine uses is either read from a named dataset or fixed by a cited method; the user sets only external forcing (rain, sea level and simulated time).

### 1. Model domain and grid

The model grid is the FABDEM V1-2 bare-earth terrain (Hawker et al., 2022) reprojected to WGS 84 / UTM zone 48S at 30 m, covering mainland DKI Jakarta plus a 10 km buffer (about 52 × 51 km, 2.98 million cells). Cells outside the buffer polygon are inactive, and a run can also use a user-drawn box or blocks of 2 × 2 or 3 × 3 cells (60 m or 90 m) for faster runs.

A drawn box can also be shown on cells of 10, 5, 2 or 1 m. No open bare-earth terrain is finer than 30 m here, so the flow is solved on the same 30 m grid as a 30 m run of the box, the grid checked against recorded floods (section 8), and the fine cells only draw its result: the water surface of the 30 m cells, interpolated bilinearly, minus the land surface interpolated bilinearly to the fine cell. Area, depth, buildings and people affected are therefore identical at 30 m and on every finer cell size; only the drawing and the exported rasters are finer. Until November 2026 building footprints were cut out of the drawn water and a trial option solved the flow among the buildings on the fine cells (building blocks, Schubert and Sanders (2012); building porosity on a dual grid, Sanders, Schubert and Gallegos (2008) and Sanders and Schubert (2019)). The cut-outs made the map look fragmented without changing a number, and the trial flow put the flooding in other places than the 30 m run (critical success index 0.06–0.17 against 30 m, `verification/fine-consistency/`) because below 30 m the ground is only interpolated and the buildings take over from the built-area roughness on which the checks rest, so both were removed from the app (ADR 0019; the code stays for the verification scripts).

Cells of 60 and 90 m average the 30 m terrain over blocks of 2 × 2 and 3 × 3 cells; a block that holds a channel keeps the channel's level. Averaging smooths hollows, river banks and raised roads, so results differ somewhat between 30, 60 and 90 m, as in any grid model; 30 m is the reference, and 90 m is used for the whole-region checks of section 8 because it needs up to about 27 times less computing (nine times fewer cells, three times longer time steps).

### 2. Hydrodynamics

The engine solves the two-dimensional shallow water equations in the local inertial form of Bates, Horritt and Fewtrell (2010), the scheme used by LISFLOOD-FP and, without advection, by SFINCS (Leijnse et al., 2021; van Ormondt et al., 2025). The momentum equation for the unit-width discharge q in each direction is the following.

    ∂q/∂t + g h ∂η/∂x + g n² q |q| / h^(7/3) = 0

Here h is depth, η = z + h the water level, g gravity and n Manning's coefficient; friction is treated semi-implicitly and the face depth is the difference between the higher water level and the higher bed of the two cells, as in Bates, Horritt and Fewtrell (2010). The local inertial form is accurate for the low-Froude flow typical of urban floodplains and loses accuracy near critical flow (de Almeida and Bates, 2013), so face discharge is capped at the critical value h√(gh).

The time step follows the Courant condition Δt = α Δx / √(g h_max) with α = 0.7, the value used by LISFLOOD-FP, and an upper limit of 15 s. Until November 2026 the engine used α = 0.5; on a 4.4 km box at 30 m and on the whole region at 90 m the two give the same maximum depths (root-mean-square difference 1–6 mm, critical success index 0.999 for cells deeper than 0.15 m) and α = 0.7 runs about 30 % faster (`verification/speed/`). Mass is conserved by updating depth from the net face fluxes, and a limiter scales outgoing fluxes so that no cell gives away more water than it holds. A face carries flow only when its depth exceeds 0.001 m, the default threshold of LISFLOOD-FP, so thin runoff sheets still drain.

### 3. Terrain conditioning with mapped rivers

OpenStreetMap river and canal polygons and river, canal and stream centre lines (snapshot of October 2026) are rasterised onto the grid. Each channel cell takes the lowest terrain value within one cell, which is the water surface the DEM recorded, and along each centre line a one-dimensional morphological opening over five cells (150 m) removes humps narrower than that window, such as bridges, culverts and road embankments that a DEM keeps as dams. No depth is added below the recorded water surface, because no open dataset gives channel bathymetry; the channel volume below that surface is taken as already filled by base flow at the start of an event.

Primary and secondary drains of the Dinas Sumber Daya Air of DKI Jakarta (Jakarta Satu geoportal) (Dinas Sumber Daya Air Provinsi DKI Jakarta, 2026a), which record width and depth for each channel, are added as channel cells. Where a depth is given, the bed is lowered to the bank level (the median of the surrounding 3 × 3 terrain) minus the depth scaled by the share of the cell the channel occupies (depth × width / 30 m, width at most 30 m), unless the terrain is already lower. The carved part below the water surface the DEM recorded starts filled with water, as for the OpenStreetMap channels, so the drains add conveyance rather than empty storage.

The same agency maps 263 pump stations with their capacity (m³/s) and 65 polder systems. Each pump serves the polder it stands in, or the nearest polder within 500 m, since stations sit on the polder edge. The summed capacity of a polder is spread evenly over its land cells (not channels or sea) as a sink rate, so a fully wet polder loses exactly its pump capacity and a partly wet one loses less: the pumps are a lower bound. Pumped water leaves the model. The app can switch the pumps off as a scenario.

Micro drains of South Jakarta (Jakarta Selatan) come from a Dinas SDA survey file (Jakarta Satu update 2024, cut 3 November 2026) supplied by the project owner (Dinas Sumber Daya Air Provinsi DKI Jakarta, 2026b): 12,481 street-drain sections, of which 311 marked as removed in 2024 are left out and 8,551 (about 1,900 km) carry a width and depth (median 0.5 × 0.5 m). Each sized section has a full-flow capacity from Manning's equation for a rectangle w × d, with wetted perimeter w + 2d for open and 2(w + d) for covered drains, n from the lining (precast U-ditch 0.013, cast concrete and brick 0.015, cemented rubble masonry 0.025, other or unknown 0.020; Chow (1959)) and the bed slope taken as the slope of the 30 m terrain smoothed over 270 m and kept within 0.1–2 %, because the terrain cannot resolve the fall of one street drain. Sections whose ends lie within 10 m of another section form a network (444 networks). A network empties through its outlets, the sections that touch a channel cell (a river or a carved DSDA drain); its capacity is the sum of its outlet capacities, or its largest section when no section touches a channel. Every land cell within 100 m of a sized section is served by the network of the nearest section, and the network capacity spread over the land it serves is the cell's sink rate: the rational method read backwards, the steady rain the network can carry with all of it reaching the drains (Chow, Maidment and Mays, 1988). The result covers 115 km² at a mean of 38 mm/h (median 29 mm/h, 10–90 % range 6–73 mm/h). Internal bottlenecks, blocked or silted drains, inlets and backwater from a full river are not represented, so the rate is an upper bound of what the drains take, and drained water leaves the model rather than joining the river it empties into. The micro drains are a switch in the app, off by default after the test in section 8; sections without a size and the rest of Jakarta are not represented.

Land subsidence moves the terrain after it was measured. The FABDEM terrain comes from Copernicus DEM radar acquisitions of 2011–2015, taken here as the epoch 2013.0. Subsidence rates come from the Sinking City dataset (Shabrina et al., 2026): annual Sentinel-1 line-of-sight velocities for 2016–2024 from LiCSBAS (Morishita et al., 2020) on LiCSAR interferograms of ascending frame 098A_09673_121312 (Lazecky et al., 2020), kriged to 30 m. Single years are noisy, so each cell takes the mean of the nine annual velocities, divided by the up component of the line-of-sight vector (0.77–0.79 over Jakarta, from the LiCSAR frame metadata) to give vertical motion, assuming horizontal motion is negligible; upward values are set to zero, as the dataset authors do in their maps. Before each run the terrain of every cell is lowered by its rate times the years between 2013.0 and the simulated date (the event date for an observed flood, today for a scenario). The map covers DKI Jakarta only; elsewhere the rate is zero.

DEMNAS, the 8 m national DEM of Badan Informasi Geospasial, is shown on the map but is not the model terrain. Averaged to the 30 m grid, it lies a median 0.79 m above FABDEM in built-up cells, and regressed on the excess of the Copernicus surface model over FABDEM it keeps a slope of 0.62, that is about 60 % of building and tree height; water is filled at a constant level near −3.3 m.

### 4. Land cover, roughness and infiltration

Land cover is the Esri / Impact Observatory 10 m annual map of the newest available year, 2024 at build time. Each 30 m cell receives the area-weighted Manning n of its nine 10 m pixels, using HEC-RAS land-classification values after Chow (1959) (USACE HEC, no date); built-up land uses n = 0.15, an effective roughness that represents buildings removed from the bare-earth DEM, an approach Beretta et al. (2018) found about as accurate as explicit building geometry. Mapped channel cells (section 3) take the open-water value n = 0.035 instead, the upper end of the range for clean natural and excavated channels in Chow (1959): a river is often narrower than the 10 m land-cover pixels, so its own cell would otherwise carry the roughness of the buildings along its banks. Until November 2026 they did, which made every channel about four times too rough; rivers then spilled over their banks on 30 m cells but stayed in them on 10 m cells, so results changed with the cell size (`verification/fine-consistency/`). A coarse cell that holds a channel keeps the channel's level and roughness.

Rain becomes runoff through the NRCS curve number method (USDA NRCS, 1986). For cumulative rain P and retention S = 25400/CN − 254 (mm), direct runoff is Q = (P − 0.2S)² / (P + 0.8S) for P > 0.2S and zero otherwise; each step adds the increase of Q to the cell, so the rest of the rain infiltrates. Curve numbers come from TR-55 tables for each land-cover class and hydrologic soil group, built-up pixels count as impervious (CN 98) and a cell takes the area-weighted value of its pixels, which is the TR-55 composite curve number for mixed cells.

The hydrologic soil group is derived from SoilGrids 2.0 sand and clay contents averaged over 0–100 cm (Poggio et al., 2021), using the texture criteria of the NRCS soil-group chapter (USDA NRCS, 2009) that also underlie the global HYSOGs250m map (Ross et al., 2018). In the Jakarta region the result is 83 % group D and 17 % group C, consistent with the clay-rich soils of the area; the groups on the model grid are shown as the map layer "Kelompok tanah". SoilGrids is a 250 m prediction from soil profiles and covariates, not a field survey, and on built-up pixels the soil group does not matter (CN 98). Antecedent moisture is the average condition (AMC II) of the method, the condition used in all checks of section 8. The app can switch to the dry (AMC I) or wet (AMC III) condition, chosen by the rain of the five days before the storm (growing-season limits of 35.6 and 53.3 mm), with the curve numbers converted as CN(I) = 4.2 CN(II) / (10 − 0.058 CN(II)) and CN(III) = 23 CN(II) / (10 + 0.13 CN(II)) (Chow, Maidment and Mays, 1988); the conversion applies to the model cells and to the upstream catchments, while the catchment lag keeps the AMC II value. This is how rain of earlier days or weeks enters a run: a weekly or monthly total spread evenly over a simulation would be a drizzle that floods nothing and would ignore the storm days inside it. Infiltration can also be switched off (every drop runs off) as a what-if for sealed green space. In the model area 85 % of the land is built-up in the 2024 map and the mean curve number of the land cells is 97, so infiltration matters most in the upstream catchments.

### 5. Inflow from upstream catchments

Flow directions are computed on the Copernicus GLO-90 DEM over 106.35–107.35° E and 5.95–7.00° S, which holds every catchment draining into the region. Mapped rivers and streams of the whole area (Overture Maps base theme, from OpenStreetMap) are lowered by 20 m before routing so that the D8 directions follow the mapped network on flat land, and canals are left out because they cross catchment divides. For every stream cell draining at least 1 km² the engine stores upstream area, area-mean curve number, mean slope and longest flow length.

When a run starts, the engine finds every stream that crosses into the run area and computes its inflow hydrograph from the same rain applied over its catchment. Runoff depth follows the curve number method, the lag time follows the NRCS watershed lag equation (USDA NRCS, 2010) and the discharge follows the NRCS dimensionless unit hydrograph (USDA NRCS, 2007), integrated over 5-minute steps so that the runoff volume is kept exactly. Catchment area that lies inside the run area, or that was already counted at an upstream entry, is removed so that no rain is counted twice.

### 6. Rain and sea level

The design-storm option takes a rain total P and a duration D of 1 to 72 h. Within the storm, the depth of the most intense t hours follows the Mononobe intensity–duration relation used in Indonesian practice (Maitsa, Kuntoro and Septiadi, 2021), P (t/D)^(1/3), and the hourly increments are ordered with the alternating block method (Chow, Maidment and Mays, 1988), so the whole total falls with its peak in the middle; for D = 24 h this is the Mononobe distribution of a 24-hour total. Durations above 24 h extend the relation beyond the day for which it was derived, which is an assumption. Until November 2026 the option took a 24-hour total R24 and kept only the depth of its most intense D hours (94.5 mm of a 150 mm R24 for D = 6 h), which users read as the total. For scale, Halim Perdanakusuma recorded 377 mm on 1 January 2020 (Lubis et al., 2022); users can also type hourly depths. The observed-flood option replays the three floods of section 8 with the hourly GPM IMERG rain of every 0.1° cell (Huffman et al., 2023): each model cell and each upstream catchment takes the rain of its nearest cell centre, as in the validation runs.

Sea cells, defined as water pixels at or below 0.5 m connected to the open sea, are held at the chosen sea level throughout a run. Water reaching any other edge of the run area leaves through a transmissive boundary that passes the discharge arriving at the adjacent face, capped at critical flow.

### 7. Display and export

The map shows depth per pixel by interpolating the water level bilinearly from the surrounding wet cells and subtracting the ground at that pixel, the water-level downscaling used for SFINCS results (Leijnse et al., 2021). The ground used for drawing is the land surface: a river, canal or drain cell takes the mean level of the land around it, and this surface is interpolated bilinearly on every grid. Water inside a channel up to its banks is therefore the river itself and is not drawn as flood, water above the banks is drawn as one smooth sheet, and rivers do not show as a chain of 30 m squares; flood hazard maps usually mask permanent water the same way. This gives smooth water edges that follow the ground without inventing water where all surrounding cells are dry, and colours follow the depth classes 0.05, 0.15, 0.5, 1 and 2 m. Depth exports are GeoTIFF files in EPSG:32748, with the model depth per cell at 30–90 m and the drawn depth per fine cell at 10–1 m, together with a JSON record of all inputs, data versions, inflows and the water balance.

### 8. Verification

The WebGPU solver gives the same maximum depths as the CPU reference on real terrain to within 0.003 m, and both close the water balance to within 10⁻⁷ of the inflow. The scheme reproduces the analytical flood wave of Hunter et al. (2005) within 3 % of the inflow depth and matched SFINCS 2.4.0 on the same grid, rain and roughness with an RMSE of 0.06 m in maximum depth. These tests check the numerics and say nothing about agreement with real floods.

The engine was then run on the whole region at 90 m for three observed floods: 1 January 2020 for calibration, and 20 February 2021 and 4 March 2025 for validation. Rain came from the half-hourly GPM IMERG Final estimates on their 0.1° cells (Huffman et al., 2023), each upstream catchment receiving the rain of its own cell; the set-up is the app default (Jakarta Satu drains carved, terrain shifted by subsidence to the event date, channel roughness 0.035, average antecedent moisture, no pumps, no drain sink).

A citizen flood report from PetaBencana.id counts as hit when the model reaches 0.10 m on land, either in the cell holding the report or in the deepest land cell of the 3 × 3 window around it (about 270 m, since report locations are approximate). River channels and sea cells are excluded: a channel always holds water, and until November 2026 the score included them, so every report beside a river counted as hit. A score only means something next to what chance gives, so each rule is also applied to every land cell of DKI Jakarta: the share that passes is the hit rate of points placed at random. With the window rule the model hit 50 % of 260 reports in 2020, 47 % of 384 in 2021 and 41 % of 49 in 2025, against 43, 28 and 43 % for random points; with the same-cell rule 23, 21 and 14 % against 19, 11 and 19 %. The model is therefore clearly better than chance in 2021, slightly better in 2020 and not better in 2025 (few reports). The old rule that counted channel water gave 72, 75 and 74 % for the same runs (`verification/observed/scores-*-imerg-v6.json`). At the reports the modelled maximum depth on land has a median of 0.10, 0.10 and 0.07 m, where citizens reported 0.70, 0.65 and 0.55 m. In 2020 the model flooded 83 km² of DKI land deeper than 0.15 m, against the 156 km² and 390 RW the city government reported. Place by place, over 2,610 RW polygons of the Sinking City dataset (Shabrina et al., 2026) (an RW counts as observed flooded when it holds a citizen report, and as modelled flooded when at least 10 % of its land is wetter than 0.15 m), the area under the ROC curve is 0.62 in 2020 and 2025 (0.5 = chance).

Switching on the polder pumps (section 3) lowered the window hit rate from 50 to 43 % in 2020 and from 47 to 45 % in 2021, left 2025 at 41 %, and reduced the 2020 flooded area from 83 to 67 km²; wet antecedent soil (AMC III) raised the hit rate slightly (51, 48 and 41 %) and the 2020 area to 84 km². Since the model is already too dry, the app starts with the pumps off and offers them as a scenario. This is an offset of errors, not evidence that pumps do not work (section 9). The South Jakarta micro drains (section 3) were tested the same way (engine pack of 13 November 2026, pumps off), scoring only the reports inside the land they serve against random points in that land: in 2021, the only flood with many reports there (119), the window hit rate fell from 50 to 28 % (random 27 to 10 %) and the model depth at the reports from 0.11 to 0.00 m against a reported median of 0.92 m; in 2020 (21 reports) it fell from 33 to 14 %, and 2025 had 3 reports. The flooded served land shrank to about a third (12.1 to 4.5 km² in 2020). Over all of DKI the hit rate fell from 50, 47 and 41 % to 48, 40 and 39 %. The drains therefore also start off; with full capacity and IMERG rain they remove water the model is already missing. The earlier official Dinas SDA flood records per RT (Dinas Sumber Daya Air Provinsi DKI Jakarta, 2026a) gave the same picture with the old rule (model shallower than recorded); Jakarta Satu could not be reached for the re-scoring.

Taken together, the model reproduces the regional pattern of where water collects better than chance in two of three floods, but it is too dry and too shallow at the places citizens report, and its agreement at the scale of single neighbourhoods is weak. Two known limits explain much of this. The satellite rain averages over 0.1° cells (section 9), and the vertical error of the open 30 m terrain, about 1 m in built-up areas (Hawker et al., 2022), is larger than typical urban flood depths of 0.3–0.7 m, so which street floods first is below what the terrain can resolve. Results should be read at the scale of districts and river corridors and as comparisons between scenarios.

The 2020 flood was also run once without the river inflow from the catchments upstream of the region, so that each flooded cell can be traced to its source. With local rain alone the model flooded 248 km² of land deeper than 0.15 m in the whole region, against 300 km² with the upstream inflow, and every cell flooded by local rain alone was also flooded with the inflow. Upstream river water therefore added 52 km², about one sixth of the flooded area, but nearly doubled the area deeper than 1 m from 15 to 26 km². Only 17 % of the flooded area lay within 90 m of a mapped channel, so most modelled flooding is ponding of local rain in low ground, while river water mainly deepens the floods along the river corridors (verification/observed/attribution-2020-01-01.json).

### 9. Limitations

Tertiary drains, and micro drains outside South Jakarta, carry no size in the records available to the project, sluice gates are not modelled, and the NCICD sea walls are mapped without crest heights. The remaining city drains were represented as a sink on built-up cells, proportional to the built share, and calibrated on the 2020 flood: every capacity from 1 to 40 mm/h lowered the share of reports hit and pushed the flooded area below the reported one, so the app uses none (scored with the earlier rule that counted channel water; the pumps were re-scored with the land-only rule of section 8 and gave the same direction). IMERG averages rain over 0.1° cells: the cell of the Halim gauge received 166 mm over the whole three-day window, while the gauge recorded 377 mm in one day (Lubis et al., 2022), so the missing drains and the smoothed rain can offset each other and one event cannot separate them. Multiplying the IMERG rain by 1.5 and 2 as a sensitivity test brought the median depth at the 2020 reports to 0.62 and 0.80 m, but raised the flooded area in the five cities to 200 and 239 km², above the 156 km² reported; the factor that matched the report depths differed between events (about 2 in 2021, below 1.5 in 2025). The shortfall at report points is therefore not a uniform rain error, and the app keeps the rain as observed. Sea walls are not represented, so above a sea level of about 0.5 m results overstate flooding along the coast. The terrain is shifted by InSAR subsidence rates for 2016–2024 extrapolated at a constant rate back to 2013 and forward to the simulated date, inside DKI Jakarta only; earlier rates were higher in places (Abidin et al., 2011), and subsidence in Tangerang, Bekasi and Depok is not included. Channel cross-sections below the recorded water surface are missing.

In the design-storm and typed options, upstream rain is spatially uniform and equal to the scenario rain, and a lumped unit hydrograph for the largest catchment (the Cisadane, about 1,100 km²) is a simplification of its response. Agreement with observed floods was measured at report points and for the flooded area of one event; the shapes of flooded neighbourhoods (RW) are not openly available, so false alarms could not be counted place by place.

### 10. Exposure

Buildings and people reached by a flood are counted on the 30 m model grid. Each building footprint of Overture Maps (Overture Maps Foundation, 2026) counts once, in the cell holding its centroid. Each WorldPop 2025 count on its 100 m grid (WorldPop, 2025) is split evenly over the 30 m cells whose centres fall in that pixel, which keeps the totals. Kecamatan come from the Overture divisions (OpenStreetMap boundaries); Kota Bekasi and part of Depok have no kecamatan polygons there and are counted per city. A building or person counts as affected when the cell, or the coarser run cell holding it, is deeper than 0.15 m outside river channels, at the time shown or at the maximum. The counts say where people live, not who was present during the flood, and inherit the depth errors of section 8.

## L. Daftar pustaka

- Abidin, H.Z., Andreas, H., Gumilar, I., Fukuda, Y., Pohan, Y.E. and Deguchi, T. (2011) 'Land subsidence of Jakarta (Indonesia) and its relation with urban development', Natural Hazards, 59(3), pp. 1753–1771. Available at: https://doi.org/10.1007/s11069-011-9866-9.
- de Almeida, G.A.M. and Bates, P. (2013) 'Applicability of the local inertial approximation of the shallow water equations to flood modeling', Water Resources Research, 49(8), pp. 4833–4844. Available at: https://doi.org/10.1002/wrcr.20366.
- Bates, P.D., Horritt, M.S. and Fewtrell, T.J. (2010) 'A simple inertial formulation of the shallow water equations for efficient two-dimensional flood inundation modelling', Journal of Hydrology, 387(1–2), pp. 33–45. Available at: https://doi.org/10.1016/j.jhydrol.2010.03.027.
- Beretta, R., Ravazzani, G., Maiorano, C. and Mancini, M. (2018) 'Simulating the influence of buildings on flood inundation in urban areas', Geosciences, 8(2), 77. Available at: https://doi.org/10.3390/geosciences8020077.
- Chow, V.T. (1959) Open-channel hydraulics. New York: McGraw-Hill.
- Chow, V.T., Maidment, D.R. and Mays, L.W. (1988) Applied hydrology. New York: McGraw-Hill.
- Dinas Sumber Daya Air Provinsi DKI Jakarta (2026a) Saluran Drainase, Pompa, Polder, Tanggul dan Genangan [Dataset]. Jakarta Satu geoportal. Available at: https://jakartasatu.jakarta.go.id (Accessed: 2026-11-01).
- Dinas Sumber Daya Air Provinsi DKI Jakarta (2026b) Saluran Mikro Jakarta Selatan (pembaruan Jakarta Satu 2024, potongan 3 November 2026) [Dataset]. Dinas Sumber Daya Air Provinsi DKI Jakarta; file supplied by the project owner. Available at: https://jakartasatu.jakarta.go.id (Accessed: 2026-11-13).
- Hawker, L., Uhe, P., Paulo, L., Sosa, J., Savage, J., Sampson, C. and Neal, J. (2022) 'A 30 m global map of elevation with forests and buildings removed', Environmental Research Letters, 17, 024016. Available at: https://doi.org/10.1088/1748-9326/ac4d4f.
- Huffman, G.J., Stocker, E.F., Bolvin, D.T., Nelkin, E.J. and Tan, J. (2023) GPM IMERG Final Precipitation L3 Half Hourly 0.1 degree x 0.1 degree V07 [Dataset]. Greenbelt, MD: Goddard Earth Sciences Data and Information Services Center (GES DISC). Available at: https://doi.org/10.5067/GPM/IMERG/3B-HH/07.
- Hunter, N.M., Horritt, M.S., Bates, P.D., Wilson, M.D. and Werner, M.G.F. (2005) 'An adaptive time step solution for raster-based storage cell modelling of floodplain inundation', Advances in Water Resources, 28, pp. 975–991. Available at: https://doi.org/10.1016/j.advwatres.2005.03.007.
- Lazecky, M., Spaans, K., Gonzalez, P.J., Maghsoudi, Y., Morishita, Y., Albino, F., Elliott, J., Greenall, N., Hatton, E., Hooper, A., Juncu, D., McDougall, A., Walters, R.J., Watson, C.S., Weiss, J.R. and Wright, T.J. (2020) 'LiCSAR: an automatic InSAR tool for measuring and monitoring tectonic and volcanic activity', Remote Sensing, 12(15), 2430. Available at: https://doi.org/10.3390/rs12152430.
- Leijnse, T., van Ormondt, M., Nederhoff, K. and van Dongeren, A. (2021) 'Modeling compound flooding in coastal systems using a computationally efficient reduced-physics solver: including fluvial, pluvial, tidal, wind- and wave-driven processes', Coastal Engineering, 163, 103796. Available at: https://doi.org/10.1016/j.coastaleng.2020.103796.
- Lubis, S.W., Hagos, S., Hermawan, E., Respati, M.R., Ridho, A., Risyanto, Paski, J.A.I., Muhammad, F.R., Siswanto, Ratri, D.N., Setiawan, S. and Permana, D.S. (2022) 'Record-breaking precipitation in Indonesia's capital of Jakarta in early January 2020 linked to the northerly surge, equatorial waves, and MJO', Geophysical Research Letters, 49(22). Available at: https://doi.org/10.1029/2022GL101513.
- Maitsa, T.R., Kuntoro, A.A. and Septiadi, D. (2021) 'Analisis tren perubahan intensitas hujan (studi kasus: Jakarta dan Bogor)', Jurnal Teknik Sipil, 28(2), pp. 163–172. Available at: https://doi.org/10.5614/jts.2021.28.2.5.
- Morishita, Y., Lazecky, M., Wright, T.J., Weiss, J.R., Elliott, J.R. and Hooper, A. (2020) 'LiCSBAS: an open-source InSAR time series analysis package integrated with the LiCSAR automated Sentinel-1 InSAR processor', Remote Sensing, 12(3), 424. Available at: https://doi.org/10.3390/rs12030424.
- van Ormondt, M., Leijnse, T., de Goede, R., Nederhoff, K. and van Dongeren, A. (2025) 'Subgrid corrections for the linear inertial equations of a compound flood model – a case study using SFINCS 2.1.1 Dollerup release', Geoscientific Model Development, 18, pp. 843–861. Available at: https://doi.org/10.5194/gmd-18-843-2025.
- Overture Maps Foundation (2026) Overture Maps buildings and divisions themes, release 2026-10-21.0 (data © OpenStreetMap contributors, ODbL) [Dataset]. Available at: https://docs.overturemaps.org (Accessed: 30 October 2026).
- Poggio, L., de Sousa, L.M., Batjes, N.H., Heuvelink, G.B.M., Kempen, B., Ribeiro, E. and Rossiter, D. (2021) 'SoilGrids 2.0: producing soil information for the globe with quantified spatial uncertainty', SOIL, 7(1), pp. 217–240. Available at: https://doi.org/10.5194/soil-7-217-2021.
- Ross, C.W., Prihodko, L., Anchang, J., Kumar, S., Ji, W. and Hanan, N.P. (2018) 'HYSOGs250m, global gridded hydrologic soil groups for curve-number-based runoff modeling', Scientific Data, 5, 180091. Available at: https://doi.org/10.1038/sdata.2018.91.
- Sanders, B.F., Schubert, J.E. and Gallegos, H.A. (2008) 'Integral formulation of shallow-water equations with anisotropic porosity for urban flood modeling', Journal of Hydrology, 362, pp. 19–38. Available at: https://doi.org/10.1016/j.jhydrol.2008.08.009.
- Sanders, B.F. and Schubert, J.E. (2019) 'PRIMo: Parallel raster inundation model', Advances in Water Resources, 126, pp. 79–95. Available at: https://doi.org/10.1016/j.advwatres.2019.02.007.
- Schubert, J.E. and Sanders, B.F. (2012) 'Building treatments for urban flood inundation models and implications for predictive skill and modeling efficiency', Advances in Water Resources, 41, pp. 49–64. Available at: https://doi.org/10.1016/j.advwatres.2012.02.012.
- Shabrina, Z., Muharram, F.W., Asa, M., Dhirgantara Putra, D. and Rui, J. (2026) Sinking City: multidimensional datasets for modelling the sinking Jakarta [Dataset]. Zenodo. Available at: https://doi.org/10.5281/zenodo.19456870.
- U.S. Army Corps of Engineers Hydrologic Engineering Center (no date) HEC-RAS 2D user's manual, version 6.6: land classification layers [Online]. Available at: https://www.hec.usace.army.mil/confluence/rasdocs/rmum/6.6/land-classification-layers (Accessed: 29 October 2026).
- USDA Natural Resources Conservation Service (1986) Urban hydrology for small watersheds, Technical Release 55 (TR-55), 2nd edn. Washington, DC: United States Department of Agriculture.
- USDA Natural Resources Conservation Service (2007) National Engineering Handbook, Part 630 Hydrology, Chapter 16: Hydrographs. Washington, DC: United States Department of Agriculture.
- USDA Natural Resources Conservation Service (2009) National Engineering Handbook, Part 630 Hydrology, Chapter 7: Hydrologic soil groups. Washington, DC: United States Department of Agriculture.
- USDA Natural Resources Conservation Service (2010) National Engineering Handbook, Part 630 Hydrology, Chapter 15: Time of concentration. Washington, DC: United States Department of Agriculture.
- WorldPop (2025) Global2 constrained population counts 2015–2030, R2025A v1 [Dataset]. University of Southampton. Available at: https://doi.org/10.5258/SOTON/WP00839.
