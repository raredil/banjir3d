# Tinjauan 04 — Bahasa dan isi Kesimpulan (peran `bahasa`)

Penguji: penyunting bahasa ilmiah Indonesia. Tanggal: 20 November 2026. Tidak ada file repo yang diubah.
Bahan kerja (semua di `$S/bahasa/`, `$S` = folder scratchpad di BRIEF):
- `gen.ts` → `conclusions.txt`: 5 kasus × 2 bahasa (ID/EN) dari `buildConclusion` (web/src/sim/conclusion.ts). Kasus: banjir 2020, 2021, 2025 (seluruh wilayah, 90 m,
  memakai total air dan peta kedalaman maksimum resmi `$S/val/*`); hujan rencana 150 mm/6 jam di kotak 10 × 10 km dengan saluran mikro aktif, tanpa hulu, tanpa
  paparan; banjir 2020 di kotak 10 × 10 km dengan hulu dan paparan. Catatan jujur: waktu puncak, luas puncak/akhir, jumlah titik hujan, angka paparan
  kasus 2020 dan debit hulu (saya pakai debit sungai terbesar, bukan jumlah) adalah isian contoh. Temuan bahasa tidak bergantung pada angka itu.
- `place.ts` → `places.json`: dua run model kotak 106,80–106,92° BT, 6,16–6,28° LS (banjir 2020, 90 m, pompa mati, saluran 0), dengan hulu **nyala** dan
  **mati**, lalu 25 titik tergenang (titik terdalam per blok 5 × 5) dengan fakta per tempat. Dipakai untuk contoh "Mengapa di sini banjir?".

## 1. Ringkasan (5 baris)
1. Bagian "Ringkasan" sebenarnya sudah ada, tetapi butir "Seberapa bisa dipercaya" panjangnya ±150 kata dengan angka bertumpuk ("44/33/35 %", "9/5/6 cm"); pembaca awam tersesat di sini.
2. 23 dari 142 kalimat unik (16 %) lebih dari 30 kata (terpanjang 64 kata); banyak calque dari bahasa Inggris ("Medan diturunkan", "hujan teramati satelit", "area terseleksi", "persamaan lag").
3. Ada kalimat tetap yang tidak dihitung ("Sungai meluap hanya di tempat airnya melebihi tinggi tebing alurnya…") dan dua kontradiksi (saluran mikro; faktor reduksi luas saat hulu mati).
4. Semua rujukan yang dikutip memang ada di `data/methods/references.json` (generator akan gagal kalau tidak), tetapi beberapa klaim inti di Ringkasan tidak punya angka/sumber di teks.
5. Keluhan #7: generator tidak punya bagian per lokasi sama sekali; penjelasan "lokasi A banjir karena X, Y, Z" dulu dibuat asisten di chat. Data per tempat sebenarnya sudah tersedia; usulan rumus kalimat ada di §2.D.

## 2. Temuan

| ID | Tingkat | Apa yang salah | Bukti | Perbaikan yang benar |
|---|---|---|---|---|
| B-01 | TINGGI | Butir "Seberapa bisa dipercaya" terlalu panjang (±150 kata, 7 kalimat), angka tiga tahun ditumpuk dengan garis miring, urutan tahun berubah ("jelas lebih baik … pada 2021, sedikit … 2020, tidak … 2025") | conclusion.ts:210; `conclusions.txt` semua kasus | Pecah menjadi 3 kalimat pendek per tahun, atau tabel kecil; letakkan peringatan inti ("model lebih kering dari kenyataan") di kalimat pertama |
| B-02 | TINGGI | Tidak ada penjelasan per lokasi. `Facts` hanya memuat `deepest {lon, lat, kec}`; tidak ada alasan mengapa tempat itu tergenang | conclusion.ts:10–21, 123–126; panel.ts:462–509 | Tambahkan bagian "Mengapa di sini banjir?" berbasis fakta per sel (§2.D) |
| B-03 | TINGGI | Kalimat tetap, bukan hasil hitungan: "Sungai meluap hanya di tempat airnya melebihi tinggi tebing alurnya, karena itu tidak semua sungai meluap." Muncul juga di kasus hujan rencana dengan 0 % air hulu | `conclusions.txt`, kasus "design 150mm" butir "Asal air" | Hapus, atau tampilkan hanya bila dihitung: "Air keluar dari alur di {n} ruas sungai; {m} ruas tidak meluap" |
| B-04 | TINGGI | Kontradiksi: paragraf menjelaskan 1.200 ruas saluran mikro "dengan lebar dan kedalaman tercatat", lalu kalimat berikutnya "Di luar itu, saluran tersier dan mikro tidak memiliki data ukuran" | kasus "design 150mm", paragraf 2 Penjelasan ilmiah | "Saluran tersier, dan saluran mikro di luar Jakarta Selatan, tidak punya data ukuran sehingga tidak dihitung satu per satu." |
| B-05 | SEDANG | Kontradiksi saat hulu mati: "di daerah tangkapan hulu hujan titik ini dikalikan faktor reduksi luas … Aliran dari hulu tidak dimasukkan." | kasus "design 150mm", paragraf hujan | Tampilkan kalimat faktor reduksi luas hanya bila `upstream != null` |
| B-06 | SEDANG | Ringkasan untuk awam menampilkan "Titik terdalam di luar sungai 11,1 m". Titik yang sama (6,2294° LS, 106,9296° BT) dan angka yang sama muncul di ketiga banjir: ini kemungkinan lubang/kolam di data tinggi tanah, bukan banjir | `conclusions.txt` kasus 2020/2021/2025 | Di Ringkasan pakai persentil 95 kedalaman ("sebagian besar tidak lebih dari X m"); simpan maksimum hanya di Penjelasan ilmiah |
| B-07 | SEDANG | Format angka/tanggal tidak baku Indonesia: "banjir nyata 2020-01-01" (ISO); "Kesalahan neraca air simulasi 1.0e-14" (titik dan notasi e); "m³/s" dan "m³/detik" bercampur; "dari tahun 2013 ke tahun 2020,0" (tahun desimal); "Muka laut ditetapkan +0,0 m" (acuan tidak jelas); panel menulis "250 mm / 48 h" pada versi Indonesia; spasi ganda "(1959).  Medan" | conclusion.ts (Ringkasan butir 1, paragraf terakhir); panel.ts:387 | "banjir 1 Januari 2020"; "Selisih neraca air: 1 × 10⁻¹⁴ (praktis nol)"; selalu "m³/detik"; "dari 2013 sampai Januari 2020"; "Muka laut: 0 m di atas rata-rata muka laut"; "48 jam" |
| B-08 | SEDANG | Istilah dan calque (lihat tabel kutipan di §2.A) | `conclusions.txt`; i18n.ts `comp.sub.h`, `comp.fixed.t` | Pakai istilah baku hidrologi Indonesia (§2.A) |
| B-09 | SEDANG | Singkatan tanpa penjelasan di teks untuk awam: DEM, FABDEM, SCS, InSAR, GPM IMERG, HEC-RAS, NRCS, AMC, DSDA, RTH, RW | Ringkasan dan Penjelasan ilmiah; i18n.ts `comp.infil`, `sim.auto.drain` | Jelaskan sekali saat pertama muncul, mis. "DEM (model elevasi digital: peta tinggi tanah)" |
| B-10 | SEDANG | 23 dari 142 kalimat > 30 kata; terpanjang 64 kata (saluran mikro), 60 kata (hujan rencana), 52 kata (model aliran) | hitungan skrip atas `conclusions.txt` | Satu kalimat = satu gagasan; kutipan ke belakang kalimat; maksimum ±25 kata |
| B-11 | SEDANG | Klaim penting tanpa angka atau sumber di teks: (a) "hujan satelit lebih rendah dari hujan sebenarnya": satu-satunya angka ada di bantuan `sim.preset.h` (Halim 377 mm vs satelit 166 mm, Lubis dkk. 2022), tidak ada di Kesimpulan; (b) "galat tinggi tanah … sekitar 1 m di kawasan terbangun" tanpa sitasi di Ringkasan (methods.md:73 mengutip hawker2022; nilainya belum saya cek online); (c) alasan pompa dimatikan bersandar pada methods.md:71 (hit 50 → 43 %), padahal angka hit sekarang 44 % dengan paket baru: buktinya sudah usang | conclusion.ts:210; methods.md:71, 73; data/skill.json | Sertakan angka dan sitasi di kalimat itu; ulangi uji pompa dengan paket sekarang atau beri label "uji paket lama" |
| B-12 | SEDANG | "Pompa polder tidak dinyalakan … menyalakannya membuat model makin kering" dan bantuan `sim.pumps.h` ("ini menutup kekurangan hujan") mengakui kompensasi galat, tetapi Kesimpulan tidak menyebutnya sebagai kompensasi. Ini yang dikeluhkan pemilik di poin 3 (bias) | conclusion.ts paragraf pompa; i18n.ts `sim.pumps.h` | Tulis terang: "Pompa dimatikan untuk mengimbangi hujan satelit yang terlalu kecil. Ini penyesuaian, bukan kondisi nyata; hasil dengan pompa menyala: …" |
| B-13 | SEDANG | "Asal air" hanya membandingkan hujan dan air hulu, padahal neraca 2020 juga mencatat 285,8 juta m³ di pos laut (hujan 295,7 juta m³). Pembaca tidak tahu apakah itu air keluar ke laut atau masuk dari laut (dugaan: keluar) | `$S/val/2020-01-01_imerg_k3_d0_poff_summary.json` totals.sea | Satu kalimat neraca: "Dari semua air, x % mengalir ke laut, y % keluar lewat tepi, z % meresap, sisanya masih menggenang" |
| B-14 | RENDAH | Rumus Mononobe dikutip dari Maitsa, Kuntoro dan Septiadi (2021), yang judulnya tentang tren intensitas hujan: ini sumber sekunder | references.json `maitsa2021` | "rumus Mononobe (sebagaimana dipakai Maitsa dkk., 2021)", atau tambah sumber primer (belum dicek online) |
| B-15 | RENDAH | Judul "Kesimpulan otomatis", tetapi isinya laporan metode dan angka; tidak ada kalimat yang benar-benar menyimpulkan ("jadi …") | i18n.ts `concl.title`; struktur keluaran | Kalimat penutup Ringkasan berbentuk kesimpulan dan saran pemakaian (§2.C butir 8) |
| B-16 | RENDAH | Penjelasan HTML memakai "kamu/-mu", aplikasi memakai "Anda"; tabel HTML terbaca sebagai teks panjang tanpa jeda (kalimat 73–93 kata saat dibaca pembaca layar) | docs/penjelasan/cara-kerja-banjir3d.html (kalimat "Kami mengukur langsung …") | Satu sapaan ("Anda"); tabel diberi `<caption>` dan judul kolom |
| B-17 | RENDAH | "banjir" dan "genangan" dipakai bergantian tanpa aturan: KPI "Luas banjir", teks "area tergenang", legenda "Kedalaman banjir (m)" | i18n.ts `kpi.area`, `legend`; conclusion.ts:129 | Aturan: "genangan" = air di daratan > 15 cm (hasil model); "banjir" = kejadian (1 Januari 2020) |

### 2.A Kutipan kalimat dan versi perbaikan (pilihan; semua dari `conclusions.txt` atau i18n.ts)

| Asli | Masalah | Perbaikan |
|---|---|---|
| "Paling luas sekaligus 317,5 km² pada 1 Januari 2020 pukul 18.00 WIB" | diksi janggal | "Genangan paling luas terjadi pada 1 Januari 2020 pukul 18.00 WIB, yaitu 317,5 km²." |
| "Medan diturunkan sesuai laju penurunan tanah InSAR Sentinel-1 2016–2024 (…) dari tahun 2013 ke tahun 2020,0." | calque "terrain"; "dari … ke …"; tahun desimal | "Tinggi tanah disesuaikan dengan penurunan tanah yang diukur satelit radar Sentinel-1 (2016–2024), dari keadaan 2013 sampai Januari 2020." |
| "dengan saluran sungai OpenStreetMap ditoreh ke dalam DEM" | kata jarang; singkatan | "Alur sungai dari OpenStreetMap dibuat lebih rendah di peta tinggi tanah (DEM) agar air bisa mengalir di dalamnya." |
| "Masukan hujan adalah hujan teramati satelit GPM IMERG Final V07 per jam (…) pada 40 titik grid 0,1° untuk periode …; setiap sel model memakai hujan titik terdekat." (43 kata) | calque "rain input / satellite-observed"; terlalu panjang | "Hujan yang dipakai adalah hujan per jam dari satelit GPM IMERG (Huffman dkk., 2023). Data ini berupa 40 kotak berukuran sekitar 11 km. Periode: 31 Desember 2019 pukul 12.00 sampai 3 Januari 2020 pukul 12.00 WIB." |
| "Curah hujan rata-rata area sebesar 143 mm dan titik grid terbasah 229 mm." | "titik grid terbasah" | "Rata-rata curah hujan di wilayah ini 143 mm; kotak dengan hujan terbanyak menerima 229 mm." |
| "Debit dari 12 sungai … dihitung dengan persamaan lag dan hidrograf satuan tak berdimensi NRCS" | istilah Inggris "lag" | "… dihitung dengan rumus waktu tunda (lag) dan hidrograf satuan sintetis NRCS" |
| "Simulasi genangan dilakukan pada area terseleksi berukuran 9,9 × 10,0 km … dengan luas daratan termodelkan 99,0 km²." | "terseleksi", "termodelkan" | "Simulasi mencakup kotak pilihan 9,9 × 10,0 km dengan daratan seluas 99,0 km²." |
| "genangan maksimum lebih dari 0,15 m mengenai sekitar 112.000 bangunan dan 744.000 penduduk" | subjek-predikat tidak logis (genangan "mengenai penduduk") | "Sekitar 112.000 bangunan dan 744.000 penduduk berada di sel yang pernah tergenang lebih dari 15 cm." |
| "Di titik laporan model jauh lebih dangkal (tengah-tengahnya 9/5/6 cm, laporan warga 70/65/55 cm)" | "tengah-tengahnya" untuk median; garis miring | "Di lokasi laporan warga, kedalaman model jauh lebih kecil. Nilai tengah (median) tahun 2020: model 9 cm, laporan 70 cm." (ulang per tahun) |
| "Uji kalibrasi pada banjir 1 Januari 2020 menunjukkan bahwa penyerapan tambahan oleh saluran kota di lahan terbangun (1–40 mm/jam) justru menjauhkan hasil dari laporan warga, sehingga penyerapan tambahan ini ditetapkan 0 mm/jam." (32 kata) | panjang; tanpa angka hasil | "Saluran kota kecil tidak dihitung (0 mm/jam). Pada banjir 2020, setiap nilai 1–40 mm/jam menurunkan kecocokan dengan laporan warga dari {a} % menjadi {b} %." |
| "Kesalahan neraca air simulasi 1.0e-14." | format; awam tidak paham | "Neraca air seimbang: selisih air masuk dan keluar praktis nol (1 × 10⁻¹⁴)." |
| `comp.sub.h`: "Medan digeser dari tahun pengukurannya ke tanggal simulasi." | calque | "Tinggi tanah disesuaikan dari tahun pengukurannya sampai tanggal simulasi." |
| `sim.res.h`: "luas banjir bisa sedikit berbeda (ini wajar pada semua model banjir)" | pernyataan umum tanpa bukti (gaya AI) | "luas genangan berbeda {x} % dibanding 30 m (uji 2020)", atau hapus kurungnya |
| `sim.dur.h`: "air sebanyak itu tersebar berminggu-minggu dan sebagian besar menguap atau mengalir pergi" | klaim tanpa angka | Hapus "sebagian besar", atau beri angka penguapan dengan sumber |

### 2.B Keterlacakan kalimat Kesimpulan

- Angka di Ringkasan dan Penjelasan ilmiah semuanya diambil dari `Facts` (luas, kelas kedalaman, persentase, neraca air, skor dari data/skill.json). Saya cocokkan sendiri:
  2020 hujan 295,7 juta m³ dan air hulu 372,5 juta m³ → 44 % / 56 % (benar); resapan 16,7/295,7 = 6 % (benar); skill 0,435/0,366 → 44 %/37 % (benar).
- Sitasi: 13 kunci di kasus 2020 dan 15 di kasus hujan rencana, semuanya ada di `references.json` (generator memakai `REFS.get(k)!`; keenam kasus berhasil dibuat).
  "Antara" hanya ada di "Sumber data lain" (bukan references.json); kutipan angka 156 km²/390 RW memang tercatat di events.json bersama tautan sumbernya.
- Kalimat **tanpa** jejak hitungan: B-03 (sungai meluap), "sisanya mengalir mengikuti kemiringan tanah ke tempat yang lebih rendah dan ke sungai" (kalimat umum),
  "cocok untuk … melihat kawasan dan koridor sungai yang rawan" (tidak ada angka tentang koridor sungai), B-11 (a)–(c), "jelas lebih baik dari acak" (tanpa uji statistik; 2020 selisih 7 poin dengan n = 260).

### 2.C Usulan "Ringkasan mudah dipahami" (maksimal 8 kalimat pendek; semua isian dihitung)

1. "Simulasi ini menghitung {banjir 1 Januari 2020 | hujan {mm} mm selama {h} jam} di {seluruh Jakarta dan 10 km sekitarnya | kotak {w} × {h} km} selama {jam} jam."
2. Jika ada air hulu: "Air datang dari dua sumber: {r} % dari hujan yang turun di sini dan {u} % dari sungai yang membawa air dari hulu." Jika tidak: "Air hanya berasal dari hujan di area ini."
3. "Sekitar {km²} km², atau {p} % daratan, tergenang lebih dari 15 cm."
4. "Sebagian besar genangan ({s} %) setinggi mata kaki sampai lutut; {d} km² lebih dalam dari 1 m."
5. Jika ada paparan: "Sekitar {pop} orang tinggal di area tergenang; terbanyak di Kecamatan {k1}, {k2} dan {k3}."
6. Baru, dihitung dari peta: "{a} % genangan berada dalam 300 m dari sungai atau saluran; {b} % ada di cekungan jauh dari sungai."
7. Jika banjir nyata: "Model ini lebih kering dari kenyataan: di lokasi laporan warga, kedalaman model sekitar {m} cm, sedangkan warga melaporkan sekitar {o} cm."
8. "Jadi, peta ini cocok untuk membandingkan kawasan dan skenario, tetapi belum bisa memastikan apakah satu rumah tertentu kebanjiran."

Contoh terisi (kotak 2020, run saya): "Air datang dari dua sumber: 30 % dari hujan yang turun di sini dan 70 % dari sungai hulu (27,3 dan 64,4 juta m³)."
"Sekitar 13,3 km² tergenang lebih dari 15 cm." "50 % genangan berada dalam 300 m dari sungai atau saluran." "Tanpa air hulu, 11,0 km² tetap tergenang."

### 2.D Usulan "Mengapa di sini banjir?" (penjelasan per tempat yang dihitung, bukan dikarang)

**Fakta per tempat yang sudah ada di aplikasi** (web/src/engine/pack.ts:12–19, 75–79; panel.ts:63):
tinggi tanah `z` (sudah dikoreksi penurunan tanah); alur sungai/saluran `channel`; bagian terbangun `built`; bilangan kurva `cn` (dari tutupan lahan dan jenis tanah);
laju penurunan tanah `sub` (mm/tahun) dan tahun acuan `subEpoch`; layanan saluran mikro `mdr`; pompa polder `pump`; sel laut `sea`; kedalaman maksimum `max`;
kedalaman per waktu `frames` (waktu tiba dan waktu puncak); titik masuk dan debit sungai hulu `inflows`; hujan per kotak IMERG `event.mm[zone]`; kecamatan dari paket paparan.
**Yang perlu dihitung tambahan (murah):** (1) relief lokal = z − rata-rata z daratan dalam radius 450 m; (2) jarak ke sel alur terdekat dan sel alur itu sendiri (BFS, seperti di `place.ts`);
(3) muka air puncak di alur terdekat (z_alur + h_alur) dibanding z tempat; (4) **bagian dari hulu**: run pembanding "hulu mati" (sudah ada `--upstream off` di run_event.ts:8)
atau pelacak (tracer) air hulu di solver. Tanpa (4), kalimat "karena sungai" tetap tebakan.

**Rumus kalimat (pakai paling banyak 3 faktor terkuat, urut dari nilai terbesar; selalu tutup dengan kalimat ketidakpastian):**
- R0 (selalu): "Di {kecamatan} ({lat}° LS, {lon}° BT), kedalaman tertinggi model {h} m pada {waktu puncak}."
- R1 sungai, jika bagian hulu ≥ 50 % dan jarak ≤ 300 m: "Sebagian besar air di sini ({u} %) berasal dari sungai hulu: tanpa air hulu, kedalamannya hanya {hOff} m. Sungai terdekat berjarak {d} m dan muka airnya naik sampai {zs} m, lebih tinggi dari tanah di sini ({z} m), sehingga air meluap ke daratan."
- R2 cekungan, jika relief ≤ −0,5 m: "Tanah di sini {|relief|} m lebih rendah dari rata-rata sekitarnya (radius 450 m), sehingga air dari sekitar berkumpul di sini."
- R3 hujan setempat, jika bagian hulu < 20 %: "Genangan ini hampir seluruhnya dari hujan setempat ({mm} mm di kotak hujan ini): tanpa air hulu, kedalamannya tetap {hOff} m."
- R4 permukaan kedap, jika built ≥ 0,8: "Hampir seluruh permukaan tertutup bangunan dan jalan (bilangan kurva {cn}), sehingga hampir semua hujan langsung menjadi limpasan." Jika cn ≤ 85: "Lahan di sini terbuka (bilangan kurva {cn}) dan meresapkan sebagian hujan, tetapi tidak cukup."
- R5 penurunan tanah, jika sub × (tahun − subEpoch) ≥ 0,10 m: "Tanah di sini turun sekitar {s} cm sejak {subEpoch} ({sub} mm per tahun), sehingga lebih mudah tergenang."
- R6 saluran: jika mdr: "Saluran mikro di sini dihitung bekerja penuh, tetapi kapasitasnya terlampaui." Jika di polder dan pompa mati: "Pompa polder tidak dihitung pada run ini."
- R7 ketidakpastian (selalu): "Peta tinggi tanah punya galat sekitar 1 m di kawasan terbangun (Hawker dkk., 2022); karena itu" + (jika |relief| < 1 m) "alasan cekungan di atas lemah." / (jika tidak) "urutan jalan mana yang tergenang lebih dulu tidak bisa dipastikan."

**Pemilihan tempat:** kecamatan dengan genangan terluas (3 teratas) dan titik yang diklik pengguna. Jangan pakai titik terdalam mentah (lihat B-06).

**Hasil 25 titik (kotak 2020):** 18 dari 25 titik terdalam per blok punya kedalaman yang **sama** dengan dan tanpa air hulu (genangan dari hujan setempat di cekungan);
6 dari 25 mendapat ≥ 50 % kedalamannya dari hulu (semua berjarak 90 m dari alur); 21 dari 25 berada ≥ 1 m di bawah rata-rata sekitarnya; 22 dari 25 punya bagian terbangun ≥ 0,8.
Faktor "terbangun/CN" hampir sama di semua titik kota, jadi tidak membedakan; faktor pembeda utama adalah relief lokal dan bagian air hulu.

**Tiga contoh terisi** (`places.json`; nama kecamatan sengaja tidak saya isi karena belum saya cocokkan dengan batas wilayah):
1. 6,2466° LS, 106,9202° BT. Kedalaman tertinggi model 1,96 m. "Hampir semua air di sini (99 %) berasal dari sungai hulu: tanpa air hulu, kedalamannya hanya 0,01 m.
   Alur terdekat berjarak 90 m. Muka airnya naik sampai sekitar 16,7 m (dasar 9,87 m + kedalaman 6,83 m), lebih tinggi dari tanah di sini (14,74 m), sehingga air meluap.
   Tanah di sini juga 2,8 m lebih rendah dari sekitarnya." + R7.
2. 6,2515° LS, 106,8909° BT. Kedalaman tertinggi model 1,56 m. "Genangan ini dari hujan setempat: tanpa air hulu, kedalamannya tetap 1,56 m. Tanah di sini 2,3 m lebih rendah
   dari rata-rata sekitarnya, dan alur terdekat berjarak 990 m. Lahannya sebagian besar terbuka (11 % terbangun, bilangan kurva 79), tetapi resapan tidak cukup." + R7.
   (Catatan penguji: cekungan 2,3 m di lahan terbuka bisa saja kolam/galian di DEM. Perlu dicek di peta foto udara.)
3. 6,1839° LS, 106,8113° BT. Kedalaman tertinggi model 1,42 m. "Sekitar 58 % kedalaman di sini berasal dari sungai hulu: tanpa air hulu, kedalamannya 0,59 m. Alur terdekat
   (90 m) dasarnya −4,63 m dan airnya mencapai kedalaman 13,15 m, jauh di atas tanah di sini (3,38 m). Tanah di sini juga 1,6 m lebih rendah dari sekitarnya." + R7.
   (Catatan penguji: kedalaman 13 m di alur ini patut dicek oleh penguji hidraulika; mungkin alur terlalu dalam atau sungai tersumbat. Ini dugaan.)

## 2.E Keluhan #7, dijelaskan dengan sederhana
- Penjelasan "lokasi A banjir karena X, Y, Z" di sesi sebelumnya **dibuat oleh asisten saat chat**. Asisten membuka data model (tinggi tanah, alur sungai, hasil run) dan
  menulis analisisnya langsung. Bukti: `docs/penjelasan/cara-kerja-banjir3d.html` memuat tabel "Dasar ke tepi di model" per sungai (Kali Baru 0,3 m … Banjir Kanal Barat 8,1 m)
  dan tabel per jenis tempat. Analisis seperti itu tidak ada di generator.
- Generator Kesimpulan (`web/src/sim/conclusion.ts`) hanya menerima angka ringkas untuk seluruh area (`Facts`). Ia tidak punya data per tempat dan tidak punya bagian
  "mengapa". Karena itu Kesimpulan tidak pernah memuat penjelasan per lokasi.
- Agar sistematis diperlukan: (1) fungsi baru yang menghitung fakta per tempat (§2.D, ±100 baris, mirip `place.ts`); (2) run pembanding tanpa air hulu atau pelacak air hulu,
  supaya kalimat "karena sungai" punya angka; (3) rumus kalimat dengan syarat seperti R0–R7, plus uji unit seperti `conclusion.test.ts`;
  (4) aturan: kalimat tanpa angka di belakangnya tidak boleh muncul.

## 3. Pertanyaan untuk agen utama
1. Ya/tidak: apakah `totals.sea` (285,8 juta m³ pada 2020) berarti air keluar ke laut? Kalau ya, mengapa tidak masuk butir "Asal air/neraca"?
2. Ya/tidak: apakah titik 11,06 m di 6,2294° LS, 106,9296° BT (sama di tiga banjir) sebuah cekungan/galian di DEM? Kalau ya, apakah boleh dikeluarkan dari Ringkasan?
3. Ya/tidak: apakah uji pompa (methods.md:71) sudah diulang dengan paket e16? Kalau belum, kalimat alasan pompa memakai bukti usang.
4. Ya/tidak: bersediakah aplikasi menjalankan run kedua "tanpa hulu" (atau menambah pelacak air hulu) agar "Mengapa di sini banjir?" punya angka sumber air?
5. Terbuka: siapa pembaca utama Ringkasan, peneliti atau warga/pemda? Sapaan "Anda" atau "kamu"? Ini pilihan gaya, jadi perlu keputusan pemilik.
6. Terbuka: alur dengan kedalaman 12–14 m di kotak 2020 (contoh 3; `chanH` di places.json) apakah wajar? Tolong teruskan ke penguji hidraulika.

## 4. Apa yang sudah benar
- Semua angka di Kesimpulan berasal dari hasil run; perhitungan persentase yang saya cek cocok. Sitasi lengkap dan memakai format Harvard yang konsisten.
- Sudah ada bagian Ringkasan berbahasa sehari-hari dengan padanan tubuh ("mata kaki", "lutut", "pinggang"); ini ide bagus dan sebaiknya dipertahankan.
- Keterbatasan ditulis jujur (model lebih kering, hujan satelit meratakan puncak, penduduk = penduduk tinggal).
- Ringkasan sudah membandingkan dengan titik acak, cara yang tepat untuk menilai kecocokan.
- Bantuan komponen (`comp.*.h`) menjelaskan "Diuji" dan "Skenario" dengan jelas; penjelasan HTML umumnya mudah dibaca.
- Format ribuan dan desimal Indonesia (1.783,3) sudah benar di sebagian besar teks.
