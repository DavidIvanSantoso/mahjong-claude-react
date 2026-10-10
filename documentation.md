# Dokumentasi Mahjong

Game mahjong 2D untuk 2–4 pemain, dibuat dengan React dan TypeScript. Bisa dimainkan bergantian di satu perangkat, atau online lewat room (PeerJS) dengan tiap pemain di perangkatnya sendiri.

- Situs: https://davidivansantoso.github.io/mahjong-claude-react/
- Repo: https://github.com/DavidIvanSantoso/mahjong-claude-react

## Daftar isi

1. [Menjalankan projek](#1-menjalankan-projek)
2. [Teknologi](#2-teknologi)
3. [Struktur folder](#3-struktur-folder)
4. [Aturan permainan yang dipakai](#4-aturan-permainan-yang-dipakai)
5. [Logika permainan](#5-logika-permainan)
6. [Tampilan](#6-tampilan)
7. [Mode online dengan PeerJS](#7-mode-online-dengan-peerjs)
8. [Deploy ke GitHub Pages](#8-deploy-ke-github-pages)
9. [Batasan yang diketahui](#9-batasan-yang-diketahui)
10. [Lisensi dan aset](#10-lisensi-dan-aset)

---

## 1. Menjalankan projek

Butuh Node.js 22 atau lebih baru.

```
npm install
npm run dev
```

Buka alamat yang muncul di terminal (biasanya `http://localhost:5173`).

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Server pengembangan dengan hot reload |
| `npm run build` | Cek tipe TypeScript lalu build ke folder `dist/` |
| `npm run preview` | Menyajikan hasil build secara lokal |

Untuk mencoba mode online di satu komputer, buka dua tab atau lebih: satu membuat room, yang lain bergabung dengan kodenya. Mode online butuh koneksi internet walaupun dijalankan lokal, karena pemain dipertemukan lewat server PeerJS.

## 2. Teknologi

| Bagian | Yang dipakai |
|---|---|
| UI | React 19 + TypeScript |
| Build | Vite 7 |
| Koneksi antarpemain | PeerJS 1.5 (WebRTC) |
| Hosting | GitHub Pages, deploy lewat GitHub Actions |
| Animasi homescreen | GSAP 3 |
| Gaya | Satu file CSS biasa (`src/index.css`), tanpa library UI |

Palet warna: `#F6E2E9` (merah muda), `#FEFAF3` (krem), `#B8CFB3` (hijau muda), `#84A282` (hijau). Warna teks dan simbol ubin adalah turunan yang lebih gelap dari palet itu supaya terbaca.

## 3. Struktur folder

```
src/
  main.tsx                 Titik masuk React
  App.tsx                  Memilih layar: menu, game lokal, host, atau tamu
  index.css                Semua gaya
  game/                    Logika permainan, tanpa React dan tanpa jaringan
    tiles.ts               Jenis ubin, membuat dan mengocok dinding, nama ubin
    rules.ts               Cek menang, pong/kong, pilihan chi
    state.ts               State permainan dan reducer (alur giliran)
    timer.ts               Batas waktu per aksi: nilai bawaan dan aksi otomatis saat waktu habis
  components/
    HomeScreen.tsx         Layar pembuka: menu Local / Online / Tutorial dan ubin animasi
    TileField.tsx          Tumpukan ubin animasi (GSAP) yang dipakai homescreen dan menu Online
    SetupScreen.tsx        Pengaturan sebelum main: LocalSetup dan OnlineSetup
    TutorialScreen.tsx     Penjelasan aturan dengan contoh ubin
    ResultDialog.tsx       Modal hasil akhir: pemenang dan tangan menangnya
    GameTable.tsx          Meja, putaran meja, panel pesan dan tombol aksi
    Seat.tsx               Satu kursi: tangan, set terbuka, bunga, buangan
    TileView.tsx           Gambar satu ubin (muka atau telungkup)
    OnlineGame.tsx         Lobi room dan pembungkus meja untuk mode online
  net/                     Mode online
    online.ts              Bentuk pesan, kode room, penyaringan state per pemain
    rooms.ts               Kelas HostRoom dan GuestRoom, plus hook React-nya
.github/workflows/deploy.yml   Build dan deploy otomatis ke GitHub Pages
vite.config.ts             Konfigurasi Vite (base path relatif)
```

Pemisahan yang penting: folder `game/` tidak tahu apa pun soal tampilan atau jaringan. Mode lokal dan mode online memakai reducer yang sama persis.

## 4. Aturan permainan yang dipakai

**Ubin.** 144 ubin: 3 suit bernomor 1–9 (Karakter, Bulat, Bambu), 4 angin, 3 naga, masing-masing 4 salinan (136 ubin), ditambah 8 ubin bunga (4 bunga + 4 musim, masing-masing satu).

**Menang.** 4 set + 1 pair, total 14 ubin. Set adalah:

- **Pong**: 3 ubin kembar.
- **Chi**: 3 ubin berurutan dalam suit yang sama. Tidak berlaku untuk angin dan naga, dan tidak boleh melewati batas (8-9-1 tidak sah).
- **Kong**: 4 ubin kembar, dihitung sebagai satu set.

**Giliran.** Tiap pemain mulai dengan 13 ubin. Pada gilirannya pemain mengambil 1 ubin dari dinding, lalu membuang 1 ubin. Pemain bisa menyatakan menang kalau 14 ubinnya memenuhi syarat.

**Klaim buangan.** Setelah ubin dibuang, pemain lain bisa mengklaimnya. Urutan prioritas:

1. **Menang** — siapa saja, mulai dari pemain terdekat setelah pembuang.
2. **Pong atau Kong** — siapa saja yang punya 2 (pong) atau 3 (kong) ubin kembar.
3. **Chi** — hanya pemain tepat setelah pembuang.

Pemain yang mengklaim pong atau chi langsung membuang tanpa mengambil dari dinding, dan giliran berlanjut dari dia.

**Kong.** Ada tiga cara:

- **Tertutup**: 4 ubin kembar di tangan, dinyatakan pada giliran sendiri.
- **Tambahan**: menambah ubin ke-4 ke pong yang sudah terbuka, pada giliran sendiri.
- **Dari buangan**: punya 3 kembar, lalu pemain lain membuang yang ke-4.

Setelah kong, pemain mengambil satu ubin pengganti dari dinding. Kong tidak ditawarkan kalau dinding sudah habis.

**Bunga.** Ubin bunga tidak pernah ada di tangan. Begitu didapat (saat pembagian awal atau saat mengambil), bunga disisihkan dan otomatis diganti ubin baru dari dinding. Bunga belum bernilai apa pun karena belum ada sistem skor.

**Batas waktu.** Pembuat ruangan (Local maupun Online) menentukan waktu per aksi, 5–300 detik. Kalau kolomnya dikosongkan, dipakai 15 detik. Kalau waktu habis saat giliran, ubin yang terakhir didapat otomatis dibuang; setelah pong/chi tidak ada ubin ambilan, jadi yang dibuang ubin paling kanan di tangan. Kalau waktu habis saat ditawari klaim, tawarannya dianggap dilewati.

**Time attack (opsional).** Pembuat ruangan bisa memilih mode Time attack. Di mode ini, selama ada pemain yang tinggal butuh 1 ubin untuk menang, batas waktu **semua** pemain dipercepat jadi setengahnya (dibulatkan ke atas, paling cepat 5 detik; misalnya 15 → 8 detik). Begitu tidak ada lagi yang hampir menang, waktunya kembali normal. Pemain hanya diberi tahu bahwa time attack sedang berlangsung, bukan siapa penyebabnya.

**Seri.** Kalau dinding habis tanpa pemenang, permainan berakhir seri.

**Yang tidak ada:** sistem skor, angin putaran/angin kursi, "merampas kong", dan penyesuaian jumlah ubin untuk 2–3 pemain (semua 144 ubin tetap dipakai).

## 5. Logika permainan

### Ubin (`game/tiles.ts`)

Tiap ubin adalah objek `{ id, suit, rank }`. `id` unik per ubin fisik (0–143). `kindIndex(tile)` mengubah ubin menjadi angka jenis 0–33 (bunga mulai dari 34), yang dipakai untuk mengurutkan tangan dan menghitung jumlah per jenis.

### Cek menang (`game/rules.ts`)

`isWinningHand(concealed, meldCount)`:

1. Jumlah ubin di tangan harus tepat `14 − 3 × meldCount`. Kong tetap dihitung 3 karena ubin keempatnya sudah diganti ubin tambahan.
2. Hitung jumlah ubin per jenis (array 34 angka).
3. Coba setiap jenis yang jumlahnya ≥ 2 sebagai pair. Untuk tiap percobaan, cek secara rekursif apakah sisa ubin bisa dibagi habis menjadi pong dan chi: ambil jenis terkecil yang masih ada, coba sebagai pong, lalu sebagai awal chi.

`isWaitingHand(concealed, meldCount)` memeriksa apakah tangan tinggal butuh 1 ubin: tiap jenis ubin (34 jenis) dicoba ditambahkan, lalu dicek dengan cara yang sama. Untuk pemain yang sedang memegang ubin ambilan (satu ubin lebih banyak), cukup ada satu buangan yang menyisakan tangan seperti itu. Dipakai oleh mode time attack.

Fungsi lain: `matchingTiles` (ubin di tangan yang kembar dengan ubin tertentu) dan `chiOptions` (semua pasangan di tangan yang membentuk urutan dengan ubin buangan).

### State dan reducer (`game/state.ts`)

Seluruh permainan disimpan dalam satu objek `GameState` dan diubah hanya lewat `reducer(state, action)`. Reducer ini murni: tidak menyentuh tampilan atau jaringan.

**Fase permainan:**

| Fase | Arti |
|---|---|
| `handoff` | Tangan disembunyikan; menunggu pemain berikutnya memegang perangkat |
| `turn` | Pemain `current` sudah mengambil ubin dan harus membuang, kong, atau menang |
| `claim` | Pemain lain ditawari ubin buangan terakhir, satu per satu sesuai prioritas |
| `over` | Ada pemenang, atau seri |

**Alur satu giliran:**

```
handoff --reveal--> turn --discard--> ada yang bisa klaim?
                                         |-- tidak --> handoff (pemain berikutnya)
                                         '-- ya ----> claim
claim --claim (pong/chi)--> turn (pengklaim langsung membuang)
claim --claim (kong)------> turn (pengklaim mengambil ubin pengganti)
claim --claim (menang)----> over
claim --pass--> klaim berikutnya, atau handoff kalau semua melewatkan
turn  --kong--> turn (ambil ubin pengganti)
turn  --declareWin--> over
dinding habis --> over (seri)
```

**Aksi:**

| Aksi | Kapan | Efek |
|---|---|---|
| `start` | Kapan saja | Kocok, bagi 13 ubin per pemain, ganti bunga |
| `reveal` | `handoff` atau `claim` | Ambil ubin dan mulai giliran, atau buka tangan pengklaim |
| `skip` | `handoff` | Mode online: lewati giliran pemain yang terputus, tanpa mengambil ubin |
| `discard` | `turn` | Buang satu ubin, lalu cari klaim |
| `kong` | `turn` | Kong tertutup atau tambahan, lalu ambil ubin pengganti |
| `declareWin` | `turn` | Menang dari ubin ambilan sendiri |
| `claim` | `claim` | Terima klaim pertama dalam antrean |
| `pass` | `claim` | Lewati klaim pertama dalam antrean |

Aksi yang tidak sah untuk keadaan saat itu (misalnya membuang ubin yang tidak ada di tangan) tidak mengubah state.

**Mengambil ubin** selalu lewat satu fungsi (`drawTile`): kalau yang terambil bunga, bunga disisihkan dan diambil lagi sampai dapat ubin biasa atau dinding habis.

### Batas waktu aksi (`game/timer.ts`)

Batas waktu sengaja tidak disimpan di `GameState`, supaya reducer tetap murni (tanpa jam). Yang ada di `timer.ts`:

| Fungsi | Peran |
|---|---|
| `parseTurnSeconds(input)` | Isi kolom di menu menjadi detik: kosong/tidak sah → 15, sisanya dijepit ke 5–300 |
| `isTimed(state)` | Waktu hanya berjalan di fase `turn`, dan di fase `claim` setelah tangan pengklaim dibuka. Layar "berikan perangkat" tidak dihitung |
| `timeoutAction(state)` | Aksi otomatis saat waktu habis: `discard` ubin ambilan (atau ubin paling kanan), atau `pass` untuk klaim |
| `isRush(state)` | Ada pemain yang tangannya menunggu 1 ubin (`isWaitingHand`) |
| `rushSeconds(turnSeconds)` | Batas waktu selama time attack: setengahnya, paling cepat 5 detik |
| `turnLimit(state, turnSeconds, timeAttack)` | Batas waktu untuk aksi yang sedang ditunggu, dan apakah itu batas yang dipercepat |

Yang menjalankan jamnya adalah pemilik state: di mode lokal komponen `LocalGame` di `App.tsx` (sebuah `useEffect` dengan `setTimeout`), di mode online `HostRoom`. Setiap kali state berganti ke keadaan baru yang menunggu keputusan pemain (termasuk setelah kong, atau pindah ke tawaran klaim berikutnya), waktu dihitung ulang dari penuh.

## 6. Tampilan

### Homescreen

Layar pertama saat situs dibuka. Di kiri ada judul dan tiga menu:

- **Local** — pengaturan main di satu perangkat (jumlah pemain wajib dipilih, nama opsional).
- **Online** — buat room atau gabung dengan kode.
- **Tutorial** — penjelasan aturan lengkap dengan contoh ubin.

Di kanan ada pita ubin putih yang diputar 45°. Animasinya memakai GSAP:

- Saat halaman dibuka, ubin jatuh masuk satu per satu dan menu bergeser masuk dari kiri.
- Saat kursor menyentuh ubin, ubin itu terangkat dan berbalik (flip) memperlihatkan muka ubin acak; saat kursor pergi, ubin berbalik lagi.
- Di layar sentuh, ubin yang diketuk berbalik lalu menutup sendiri setelah 1,2 detik.
- Tanpa disentuh pun, setiap 1,2–2,4 detik satu ubin acak yang terlihat di layar berbalik sebentar (1,8 detik) supaya tampilan terasa hidup. Paling banyak 2 ubin terbuka sekaligus, termasuk yang sedang disentuh pengguna.
- Di layar selebar 720 px atau kurang, ubin tidak diputar: ubin tegak memenuhi seluruh layar sebagai latar, dan menu berada di kartu krem di tengah. Ubin di luar kartu tetap bisa diketuk. Tiga baris di belakang kartu menu dikosongkan supaya area menu terlihat bersih.
- Semua animasi dibungkus `gsap.context` supaya dibersihkan saat pindah layar, dan dimatikan untuk pengguna yang mengaktifkan "kurangi gerakan".

Link undangan room (`?room=KODE`) melewati homescreen dan langsung membuka menu Online.

Di pojok kanan bawah (di HP: kartu kecil di tengah bawah) ada kredit "Created by David Ivan", dan di bawah tulisan itu tautan sosial berbentuk ubin kecil berikon, yang membuka profil di tab baru. Daftarnya ada di konstanta `SOCIALS` di `HomeScreen.tsx`; entri dengan `url` kosong tidak ditampilkan. Ikonnya adalah path SVG dari Bootstrap Icons yang disalin ke `socialIcons.ts`, tanpa menambah dependensi.

Semua perilaku ubin di atas (jatuh masuk, flip saat hover/ketuk, flip acak, paling banyak 2 terbuka) ada di komponen `TileField`, yang hanya mengatur logika dan animasinya. Posisi, ukuran, dan putaran tumpukan diatur dari CSS halaman yang memakainya.

### Menu Local dan Online

Keduanya memakai tata letak yang sama (`SplitScreen` di `SetupScreen.tsx`). Layar dibagi dua: form di kiri (3/4 lebar layar) dan kolom ubin tegak berlatar merah muda di kanan (1/4), memakai `TileField` yang sama dengan homescreen. Judul dan tombolnya bergaya sama dengan homescreen, dan isi form bergeser masuk dari kiri saat dibuka. Di desktop, jarak dan ukuran elemen form mengikuti tinggi layar dan nama pemain Local disusun dua kolom, supaya form selalu muat satu layar tanpa scroll. Di layar 720 px atau lebih kecil, kolom ubin disembunyikan dan form memenuhi layar.

Kedua menu punya kolom **Waktu per giliran (detik)**. Kolom ini boleh dikosongkan (dipakai 15 detik); angka di luar 5–300 dirapikan begitu kolom ditinggalkan. Di mode online hanya pembuat room yang mengisinya, dan nilainya ditampilkan ke semua pemain di lobi.

Di bawahnya ada pilihan **Mode permainan**: Normal atau Time attack (`ModeField`). Tombol bulat "?" di sebelahnya membuka kotak penjelasan beda kedua mode, dengan angka detik yang mengikuti isi kolom waktu. Kotak itu melayang di atas tombol (tidak menambah tinggi form) dan menutup lewat Esc, ketukan di luar, atau tombol "?" lagi. Di desktop yang pendek (tinggi ≤ 760 px), keterangan kecil di bawah kolom waktu dan judul "Mode permainan" disembunyikan supaya form tetap muat satu layar.

### Meja

Meja berbentuk persegi. Tiap pemain menempati satu sisi; buangan tiap pemain tersusun di depannya, mengelilingi kotak tengah yang menampilkan nama pemain dan sisa ubin di dinding. Di antara tangan dan buangan ada set terbuka dan bunga.

- 2 pemain duduk berhadapan (bawah dan atas); 3 pemain di bawah, kanan, dan atas; 4 pemain di keempat sisi.
- Lebar area buangan menyesuaikan jumlah pemain (15, 8, atau 6 kolom), karena makin sedikit pemain makin banyak buangan per orang.
- Di kotak tengah, nama tiap pemain menghadap kursinya. Untuk 2 pemain kotaknya pendek, jadi nama ditaruh di pojok (milik sendiri kiri bawah, lawan kanan atas) agar tidak menabrak angka sisa ubin. Nama yang terlalu panjang dipotong dengan "…".
- Tangan pemain lain tampil sebagai ubin telungkup berwarna merah muda.
- Kong tertutup ditampilkan dengan dua ubin luarnya telungkup.

**Cara menggambarnya.** Tiap kursi adalah satu lapisan seukuran meja yang diputar kelipatan 90°, dan isinya selalu ditata seolah-olah kursi bawah. Dengan begitu satu tata letak dipakai untuk keempat sisi.

**Ukuran.** Semua ukuran di meja diturunkan dari satu variabel CSS `--S` (panjang sisi meja), yang dihitung dari ukuran layar. Meja otomatis mengecil di layar kecil.

**Ubin** digambar seluruhnya dengan CSS dan karakter teks; tidak ada file gambar. Isi muka ubin dibungkus `.tile__content`, terpisah dari bentuk ubinnya, supaya muka bisa diputar sendiri. Ini dipakai di mode online agar buangan pemain di samping dan seberang tetap terbaca tegak: untuk kursi samping, kotak isinya ditukar lebar-tingginya lalu diputar 90°.

### Putaran meja (mode satu perangkat)

Pemain yang sedang memegang perangkat selalu berada di sisi bawah. Saat giliran pindah, seluruh meja berputar sampai pemain berikutnya ada di bawah. Sudut putar terus bertambah (tidak kembali ke 0), supaya meja selalu berputar lewat jalur terpendek. Angka sisa dinding di tengah diputar balik agar tetap tegak.

Animasi dimatikan untuk pengguna yang mengaktifkan "kurangi gerakan" di sistemnya.

### Panel aksi

Panel di bawah meja tidak ikut berputar. Isinya pesan untuk pemain dan tombol sesuai keadaan: Buang, Kong, Mahjong, Pong, Chi, Lewati. Memilih ubin di tangan lalu mengetuknya lagi langsung membuangnya.

Selama waktu aksi berjalan, di bagian atas panel ada hitung mundur (`TurnTimer` di `GameTable.tsx`): batang yang menyusut dan sisa detik. Pada 5 detik terakhir warnanya berubah merah. Di mode online semua pemain melihat hitung mundur pemain yang sedang ditunggu. Selama time attack berlangsung, di sebelah batangnya muncul lencana "Time attack".

### Layar lebar

Di layar selebar 1200 px atau lebih dengan rasio minimal 3:2, tata letaknya menjadi tiga kolom: panel **Buangan terakhir** (atas) dan tombol Tutorial (bawah) di kiri, meja di tengah, serta panel aksi (atas) dan kartu judul/kode room/tombol keluar (bawah) di kanan. Meja memakai hampir seluruh tinggi layar (sampai 1100 px), sehingga semua ubin ikut membesar. Panel kiri menampilkan ubin yang terakhir dibuang dalam ukuran besar, beserta namanya, siapa yang membuang, dan penjelasan singkat jenis ubinnya. Di layar yang lebih sempit panel kiri disembunyikan dan panel aksi kembali ke bawah meja.

### Tutorial di tengah permainan

Di meja (lokal maupun online) ada tombol untuk membuka tutorial dalam modal, tanpa meninggalkan permainan. Di desktop lebar tombolnya ada di pojok kiri bawah dengan tulisan "Tutorial"; di layar lain berupa tombol bulat melayang "?" di pojok kanan bawah. Modal menutup lewat tombol Tutup, tombol Esc, atau klik di luar kartu. Isinya sama dengan layar Tutorial di menu utama (`TutorialContent` di `TutorialScreen.tsx`).

### Modal hasil akhir

Begitu permainan berakhir, muncul modal (`ResultDialog.tsx`) yang menampilkan siapa pemenangnya, dari mana ubin penentunya (ambilan sendiri atau buangan pemain lain), dan susunan tangan menangnya: ubin di tangan dengan ubin penentu diberi tanda, set terbuka beserta jenisnya, dan bunga. Di mode online pemenang melihat judul "Kamu menang!". Untuk permainan seri, modal hanya memberi tahu bahwa dinding habis.

Tombolnya: **Main lagi** (di mode online hanya untuk host), **Lihat meja** untuk menutup modal dan melihat semua tangan di meja, dan tombol keluar. Setelah ditutup, modal bisa dibuka lagi lewat tombol **Lihat hasil** di panel aksi.

### Satu komponen untuk dua mode

`GameTable` dipakai oleh mode lokal dan online. Perbedaannya ditentukan oleh properti `viewer`:

| | Lokal (`viewer` kosong) | Online (`viewer` = kursi sendiri) |
|---|---|---|
| Siapa di sisi bawah | Pemain yang memegang perangkat | Selalu diri sendiri |
| Meja berputar | Ya | Tidak |
| Muka ubin buangan pemain lain | Mengikuti arah kursi masing-masing | Selalu tegak menghadap diri sendiri |
| Tangan yang terlihat | Hanya saat giliran sudah dibuka | Tangan sendiri, selalu |
| Layar "berikan perangkat" | Ada | Tidak ada |

## 7. Mode online dengan PeerJS

### Gambaran umum

PeerJS adalah library di atas WebRTC yang menghubungkan dua browser secara langsung. Tidak ada server permainan milik sendiri. Yang dipakai dari luar hanya server perantara publik milik PeerJS, untuk mempertemukan dua browser di awal; setelah tersambung, data permainan mengalir langsung antarbrowser.

Browser pembuat room menjadi **host** dan memegang state permainan yang asli. Pemain lain (**tamu**) hanya mengirim aksi dan menerima hasilnya.

```
  Tamu A  --aksi-->             --state untuk A-->  Tamu A
                     HOST
  Tamu B  --aksi-->  (reducer)  --state untuk B-->  Tamu B
```

### Membuat dan masuk room

1. Host memilih jumlah pemain (2–4) dan membuat room. Aplikasi membuat kode acak 5 karakter (tanpa huruf/angka yang mirip seperti O/0 dan I/1).
2. Host mendaftar ke server PeerJS dengan ID `mahjong-claude-room-<KODE>`.
3. Tamu memasukkan kode, atau membuka link undangan `…/?room=KODE`. Browser tamu menyambung ke ID tersebut dan mengirim pesan `join`.
4. Host menaruh tamu di kursi berikutnya. Tamu ditolak kalau room sudah penuh atau permainan sudah dimulai.
5. Setelah semua kursi terisi, host menekan "Mulai permainan".

### Pesan yang dikirim (`net/online.ts`)

Tamu ke host:

| Pesan | Isi |
|---|---|
| `join` | Nama dan token pemain |
| `action` | Satu aksi permainan (buang, kong, klaim, lewati, menang) |

Host ke tamu:

| Pesan | Isi |
|---|---|
| `sync` | Daftar pemain dan batas waktu room, nomor kursi tamu, state permainan untuk tamu itu, sisa waktu aksi yang sedang ditunggu (`timeLeft`, ms), dan apakah waktunya sedang dipercepat (`rush`) |
| `rejected` | Alasan penolakan (room penuh atau permainan sudah dimulai) |

Setiap kali ada perubahan, host mengirim `sync` baru ke semua tamu. Tamu tidak menghitung apa pun sendiri; ia hanya menampilkan `sync` terakhir.

### Batas waktu di mode online

Jam yang menentukan ada di host. Setelah tiap perubahan state, `HostRoom.armTimer` memasang `setTimeout` sepanjang batas waktu room; kalau pemain belum bertindak saat waktunya habis, host menjalankan `timeoutAction` lalu mengirim `sync` baru. Aksi pemain yang datang lebih dulu otomatis membatalkan jam itu karena state-nya sudah berganti.

Yang dikirim ke tamu adalah **sisa waktu** (`timeLeft`), bukan jam habisnya, karena jam tiap perangkat bisa berbeda. Tamu menambahkannya ke jamnya sendiri hanya untuk menggambar hitung mundur; hitung mundur di layar tamu bisa terlambat sedikit sebesar jeda jaringan, tetapi keputusan tetap di host.

Time attack juga dihitung di host (`turnLimit`), karena hanya host yang memegang semua tangan. Tamu hanya menerima tanda `rush`; isi tangan pemain lain tetap tidak dikirim. Tanda itu memang memberi tahu semua pemain bahwa ada yang hampir menang — itulah inti modenya.

### Yang dilakukan host untuk tiap aksi

1. **Memeriksa hak** (`isAllowed`): aksi giliran hanya diterima dari pemain yang sedang giliran; klaim dan lewati hanya dari pemain yang sedang ditawari. Aksi lain diabaikan.
2. **Menjalankan reducer** yang sama dengan mode lokal.
3. **Menjalankan langkah yang tidak butuh keputusan pemain** (`HostRoom.advance`): fase `handoff` dan klaim yang belum dibuka langsung dilanjutkan, karena tiap pemain punya layar sendiri. Di sini juga giliran pemain yang terputus dilewati (lihat "Putus dan sambung ulang").
4. **Mengirim state yang sudah disaring** ke tiap pemain.

### Menyembunyikan tangan lawan (`viewFor`)

Sebelum dikirim, state disaring untuk tiap kursi:

- Tangan pemain lain diganti ubin kosong (jumlahnya tetap, isinya tidak ada).
- Dinding diganti ubin kosong.
- Info ubin yang baru diambil hanya dikirim ke pemain yang mengambil.
- Isi klaim hanya dikirim ke pemain yang ditawari; pemain lain hanya tahu bahwa permainan sedang menunggu.

Jadi isi tangan lawan memang tidak pernah sampai ke perangkat tamu. Setelah permainan selesai, semua tangan dibuka.

**Pengecualian: host.** State asli ada di memori browser host. Tampilan host juga disaring sehingga ia tidak melihat tangan lawan saat bermain biasa, tetapi host yang sengaja membongkar lewat DevTools bisa membacanya. Ini dianggap wajar untuk permainan antar teman. Menutup celah ini sepenuhnya butuh server netral.

### Putus dan sambung ulang

- Tiap tamu punya token acak yang disimpan di `sessionStorage` per kode room. Kalau tamu refresh atau terputus lalu masuk lagi dengan kode yang sama dari tab yang sama, host mengenali tokennya dan mengembalikannya ke kursi semula dengan tangan yang sama.
- Selama permainan, kursi pemain yang terputus ditahan. Namanya tampil redup dan dicoret di tengah meja, dan semua pemain melihat peringatan "… keluar dari permainan" di panel aksi.
- Host menunggu 15 detik (cukup untuk refresh halaman). Kalau pemain itu belum kembali, aksinya digantikan otomatis:
  - gilirannya **dilewati** tanpa mengambil ubin dari dinding;
  - tawaran klaim untuknya dilewatkan;
  - kalau ia terputus setelah mengambil ubin, ubin ambilannya dibuang.
- Batas waktu aksi tetap berjalan untuk pemain yang terputus di tengah giliran, jadi ubinnya bisa terbuang lebih cepat dari 15 detik kalau batas waktu room lebih pendek.
- Setelah masa tunggu itu lewat, giliran-giliran berikutnya langsung dilewati tanpa jeda sampai ia tersambung kembali. Begitu kembali, ia bermain lagi seperti biasa dengan tangan yang sama.
- Kalau yang tersambung tinggal satu orang, tidak ada yang dilewati: permainan menunggu sampai ada pemain yang kembali.
- Di lobi (sebelum mulai), kursi pemain yang terputus langsung dilepas.
- Kalau host menutup atau me-refresh tab, room hilang dan tamu melihat pesan "Koneksi ke host terputus".

### Kode (`net/rooms.ts`)

| Bagian | Peran |
|---|---|
| `HostRoom` | Menerima koneksi, mengatur kursi, memvalidasi dan menjalankan aksi, menyebarkan state |
| `GuestRoom` | Menyambung ke host, mengirim aksi, menyimpan `sync` terakhir |
| `useHostRoom`, `useGuestRoom` | Hook React yang membungkus kedua kelas itu dan mengembalikan bentuk `Room` yang sama |

`OnlineGame.tsx` memakai `Room` itu untuk menampilkan lobi, pesan error, atau meja permainan.

## 8. Deploy ke GitHub Pages

GitHub Pages hanya menyajikan file statis, dan itu cukup: aplikasi ini tidak punya server sendiri.

**Pengaturan sekali saja:** di repo, **Settings → Pages → Build and deployment → Source**, pilih **GitHub Actions**. Jangan pilih "Deploy from a branch" dengan branch `main`: itu menyajikan kode sumber mentah, dan halamannya akan kosong.

**Setelah itu otomatis.** Setiap `git push` ke `main` menjalankan `.github/workflows/deploy.yml`, yang memasang dependensi (`npm ci`), menjalankan `npm run build`, lalu menerbitkan folder `dist/`.

`vite.config.ts` memakai `base: './'` (path relatif), sehingga hasil build berjalan di `https://<user>.github.io/<nama-repo>/` tanpa perlu menulis nama repo di konfigurasi.

**Mematikan situs:** **Settings → Pages → Unpublish site**. Mengubah repo menjadi privat juga mematikan situs di akun GitHub gratis.

## 9. Batasan yang diketahui

- **Room bergantung pada host.** Room hilang kalau tab host ditutup atau di-refresh.
- **Host secara teknis bisa mengintip** lewat DevTools (lihat bagian 7).
- **Tidak semua jaringan bisa tersambung.** Koneksi langsung antarbrowser bisa gagal di sebagian jaringan kantor, kampus, atau operator seluler.
- **Bergantung pada server PeerJS publik** untuk mempertemukan pemain. Kalau server itu sedang bermasalah, room tidak bisa dibuat atau dimasuki.
- **Tidak ada batas waktu giliran.** Pemain yang terputus dilewati otomatis, tetapi pemain yang masih tersambung dan diam saja tetap ditunggu.
- **Ubin pemain yang keluar ikut terkunci.** Tangan dan set terbukanya tetap di kursinya, jadi ubin itu tidak bisa didapat pemain lain.
- **Layar ponsel sempit.** Ubin di tangan menjadi kecil karena 14 ubin harus muat di satu sisi meja. Paling nyaman di tablet atau laptop.
- **Belum ada** sistem skor, "merampas kong", dan tes otomatis di dalam repo.

## 10. Lisensi dan aset

- Tidak ada file gambar, font, atau suara. Ubin digambar dengan CSS dan karakter teks; font memakai bawaan perangkat.
- Ikon LinkedIn, GitHub, dan Instagram di homescreen berasal dari Bootstrap Icons (MIT). Lisensi itu mencakup gambar ikonnya; logonya sendiri tetap merek dagang masing-masing perusahaan dan di sini hanya dipakai sebagai tautan ke profil pembuat, tanpa diubah bentuknya.
- Library yang ikut dalam hasil build: React dan React DOM (MIT), PeerJS (MIT), beserta turunannya (MIT, ISC, BSD-3-Clause).
- GSAP memakai lisensi "Standard No Charge" dari GreenSock (https://gsap.com/standard-license): gratis, termasuk untuk dipublikasikan, tetapi bukan lisensi open-source. Larangan utamanya adalah memakai GSAP di produk yang bersaing dengan Webflow, yang tidak berlaku untuk game ini.
- Alat build: Vite (MIT), TypeScript (Apache-2.0).
- Mahjong adalah permainan tradisional; aturan dan namanya tidak dimiliki pihak mana pun.
