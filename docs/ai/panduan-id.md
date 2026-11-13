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

{{SKILL}}

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
