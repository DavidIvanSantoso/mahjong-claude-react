# Dokumentasi Mahjong

Game mahjong 2D untuk 2–4 pemain, dibuat dengan React dan TypeScript. Bisa dimainkan bergantian di satu perangkat, atau online lewat room (PeerJS) dengan tiap pemain di perangkatnya sendiri.

Situs yang sama juga memuat game kartu **UNO** (online, 2–6 pemain; [bagian 11](#11-game-uno)) **Capsa** (online, 2–4 pemain; [bagian 12](#12-game-capsa)), **KA-BOOM!** (online, 2–6 pemain; [bagian 13](#13-game-ka-boom)), **Armada Royale** (online, 2–6 pemain; [bagian 14](#14-game-armada-royale)), **ASBUN** (online, 4–10 pemain; [bagian 15](#15-game-asbun)), game mengetik **PALUNG** (1 pemain; [bagian 16](#16-game-palung)), dan balapan labirin **LABIRIN** (online, 2–8 pemain; [bagian 17](#17-game-labirin)). Navbar di pojok kiri atas homescreen dipakai untuk berpindah game.

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
11. [Game UNO](#11-game-uno)
12. [Game Capsa](#12-game-capsa)
13. [Game KA-BOOM!](#13-game-ka-boom)
14. [Game Armada Royale](#14-game-armada-royale)
15. [Game ASBUN](#15-game-asbun)
16. [Game PALUNG](#16-game-palung)
17. [Game LABIRIN](#17-game-labirin)

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
  App.tsx                  Memilih game (navbar) lalu layar: menu, game lokal, host, atau tamu
  index.css                Semua gaya mahjong dan navbar game
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
    GameNav.tsx            Navbar pemilih game (Mahjong / UNO / Capsa / KA-BOOM! / Armada / ASBUN / PALUNG) di homescreen
  net/                     Mode online
    online.ts              Bentuk pesan, kode room, penyaringan state per pemain
    rooms.ts               Kelas HostRoom dan GuestRoom, plus hook React-nya
  uno/                     Game UNO (lihat bagian 11)
  capsa/                   Game Capsa (lihat bagian 12)
  bomkata/                 Game KA-BOOM! (lihat bagian 13)
  armada/                  Game Armada Royale (lihat bagian 14)
  asbun/                   Game ASBUN (lihat bagian 15)
  palung/                  Game PALUNG (lihat bagian 16)
  labirin/                 Game LABIRIN (lihat bagian 17)
public/words/id/           Kamus kata KA-BOOM! (JSON)
public/asbun/              Kamus pasangan kata ASBUN (JSON)
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

### Server STUN dan TURN (`net/ice.ts`)

Semua room (mahjong, UNO, Capsa) memakai pengaturan ICE yang sama dari `src/net/ice.ts`.

- **STUN** (Google, Cloudflare, Metered) membantu dua perangkat menemukan alamat publiknya lalu tersambung langsung. Ini cukup untuk sebagian besar WiFi rumah.
- **TURN** menjadi perantara kalau koneksi langsung dihalangi jaringan, misalnya data seluler dengan CGNAT, atau WiFi kantor/kampus. TURN bawaan PeerJS (`eu-0`/`us-0.turn.peerjs.com`) dan kredensial publik Open Relay sudah tidak berfungsi, jadi TURN harus diisi sendiri.
- Tamu yang belum tersambung ke host dalam 20 detik (`CONNECT_TIMEOUT_MS`) mendapat pesan bahwa jaringannya menghalangi koneksi, bukan menunggu tanpa akhir.

**Memasang TURN sendiri:**

1. Buat akun di layanan TURN yang menyediakan kredensial tetap, misalnya Metered atau ExpressTURN (keduanya punya paket gratis), lalu salin URL server, username, dan credential-nya.
2. Di GitHub: **Settings → Secrets and variables → Actions → New repository secret**, buat tiga secret:
   - `VITE_TURN_URLS`: URL server, beberapa URL dipisah koma, mis. `turn:a.relay.metered.ca:80,turn:a.relay.metered.ca:443,turns:a.relay.metered.ca:443?transport=tcp`
   - `VITE_TURN_USERNAME`
   - `VITE_TURN_CREDENTIAL`
3. Jalankan ulang workflow deploy (tab Actions → Deploy ke GitHub Pages → Run workflow).
4. Untuk mencoba di komputer sendiri, tulis ketiga nilai itu di file `.env.local` di akar projek (sudah diabaikan git), lalu jalankan ulang `npm run dev`.

Kredensial TURN ikut terbawa ke kode di browser (wajar untuk situs statis), jadi pakai kredensial khusus untuk situs ini dan batasi kuotanya di dasbor layanannya.

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
- **Tanpa TURN, sebagian jaringan tidak bisa tersambung** (data seluler/CGNAT, WiFi kantor atau kampus). Lihat "Server STUN dan TURN" di bagian 7 untuk memasang TURN sendiri.
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
- UNO adalah merek dagang Mattel. Game UNO di sini adalah projek penggemar non-komersial; kartunya digambar dengan CSS, tanpa aset gambar resmi.
- Armada Royale memakai konsep tembak-tembakan kapal di papan berpetak, permainan kertas-pensil lama yang aturannya tidak dimiliki siapa pun. Nama "Battleship" (merek dagang Hasbro) tidak dipakai. Semua gambarnya pixel art yang digambar di kode (`src/armada/Pixel.tsx`), efek suaranya dibuat dengan Web Audio, dan fontnya (Press Start 2P, VT323; dimuat dari Google Fonts, sama dengan KA-BOOM!) berlisensi SIL Open Font License.
- ASBUN terinspirasi dari permainan Under Cover (Yanstar Studio OU); kreditnya ditampilkan di tepi kiri layar desktop dan di beranda ASBUN pada layar sempit (`INSPIRED_BY` di `AsbunApp.tsx`). ASBUN memakai mekanik permainan pesta tebak kata dengan peran rahasia (genre *social deduction*). Nama peran, teks, dan kamus pasangan katanya ditulis sendiri untuk projek ini. Fontnya (Cormorant Garamond, DM Sans, Allura; dimuat dari Google Fonts) berlisensi SIL Open Font License. Ikon dan favicon digambar di kode (`src/asbun/Icons.tsx`, `src/assets/asbun-favicon.svg`).
- LABIRIN adalah balapan labirin biasa (genre umum). Labirin, gambar, dan efek suaranya dibuat di kode (`src/labirin/maze.ts`, `render.ts`, `sfx.ts`); fontnya (Rubik, Rubik Mono One; dari Google Fonts) berlisensi SIL Open Font License.
- PALUNG memakai mekanik genre game mengetik (ketik kata pada musuh yang mendekat). Nama, karakter, gambar, dan teksnya dibuat sendiri; tidak meniru game tertentu. Semua gambar digambar dengan Canvas di kode (`src/palung/render.ts`), efek suaranya dibuat dengan Web Audio, dan fontnya (Bungee, JetBrains Mono; dimuat dari Google Fonts) berlisensi SIL Open Font License.

## 11. Game UNO

### Ringkasan

- Online saja, 2–6 pemain, tiap pemain di perangkatnya sendiri. Host membuat room (kapasitas tetap 6) dan bisa memulai begitu ada minimal 2 pemain.
- Tiga mode, dipilih host saat membuat room: **Klasik**, **Crazy Rules**, dan **Indonesian Rules** (lihat [Mode permainan](#mode-permainan)).
- Aturan dasar UNO internasional: dek 108 kartu, 7 kartu per pemain, Skip / Reverse / Draw Two / Wild / Wild Draw Four, tantangan Wild Draw Four, hukuman lupa bilang UNO, dan skor sampai 500 poin.
- Tampilan hanya Bahasa Indonesia (tidak ada pilihan bahasa) dan tidak memakai tombol tema. Musik latar dan efek suara sama dengan mahjong.

### Struktur folder

```
src/uno/
  cards.ts         Warna, dek 108 kartu, aturan kartu yang boleh dikeluarkan, poin, nama kartu
  state.ts         State ronde dan reducer: giliran, efek kartu aksi, tantangan, UNO/tangkap, waktu habis
  net.ts           HostRoom/GuestRoom UNO (PeerJS), penyaringan state per kursi (`viewFor`), hook React
  UnoApp.tsx       Layar-layar UNO, lobi room, dan pemasangan palet
  UnoHome.tsx      Homescreen UNO dengan kipas kartu animasi (GSAP)
  UnoSetup.tsx     Menu online: gabung dengan kode atau buat room
  UnoTable.tsx     Meja: lawan, tumpukan ambil/buangan, panel aksi, tangan, riwayat, skor
  UnoCard.tsx      Gambar kartu (muka dan punggung) dengan CSS
  UnoDialogs.tsx   Pemilih warna, hasil ronde, dan cara main
  sfx.ts           Efek suara kartu keluar/diambil
  uno.css          Semua gaya UNO, termasuk palet
```

UNO dimuat terpisah (`React.lazy` di `App.tsx`), jadi pemain mahjong tidak ikut mengunduh kodenya.

### Aturan yang dipakai

| Kartu | Efek | Poin |
|---|---|---|
| Angka 0–9 | — | sesuai angka |
| Skip | Pemain berikutnya dilewati | 20 |
| Reverse | Arah berbalik; berdua sama dengan Skip | 20 |
| Draw Two | Pemain berikutnya mengambil 2 dan dilewati | 20 |
| Wild | Pilih warna | 50 |
| Wild Draw Four | Pilih warna; pemain berikutnya mengambil 4 dan dilewati, kecuali menantang | 50 |

- **Giliran:** keluarkan kartu dengan warna yang berlaku atau angka/simbol yang sama dengan kartu teratas, atau kartu Wild. Boleh juga mengambil 1 kartu; kalau kartu itu cocok, boleh langsung dikeluarkan (fase `drawn`), kalau tidak giliran pindah.
- **Kartu pembuka:** Wild Draw Four dikembalikan ke tumpukan lalu dikocok ulang. Skip melewati pemain pertama, Reverse membuat pembagi jalan duluan, Draw Two membuat pemain pertama mengambil 2, Wild membuat pemain pertama memilih warna (fase `color`).
- **Tantangan Wild Draw Four (fase `challenge`):** host mencatat apakah pengeluar kartu masih punya kartu dengan warna yang berlaku sebelumnya. Tantangan benar: pengeluar mengambil 4 dan penantang tetap mendapat gilirannya. Tantangan salah: penantang mengambil 6 dan dilewati.
- **UNO:** tekan UNO! saat tinggal 2 kartu, sebelum mengeluarkan kartu kedua terakhir. Yang lupa (`vulnerable`) masih bisa menyusulkan UNO sampai pemain berikutnya beraksi; lawan yang lebih dulu menekan Tangkap membuatnya mengambil 2 kartu.
- **Akhir ronde:** pemain yang menghabiskan kartunya mendapat jumlah poin kartu sisa semua lawan. Kalau kartu terakhirnya Draw Two/Wild Draw Four, pemain berikutnya tetap mengambil kartunya dulu. Skor 500 menjadi juara; permainan berikutnya dimulai dari nol. Pembagi pertama diacak, lalu bergeser ke kiri tiap ronde.
- **Tumpukan ambil habis:** buangan (kecuali kartu teratas) dikocok jadi tumpukan baru. Stacking Draw Two/Draw Four tidak dipakai.

### Mode permainan

Mode disimpan di `UnoState.mode` dan dikirim ke tamu lewat `UnoLobby.mode` dan `UnoView.mode`.

- **Klasik (`classic`)**: aturan di atas.
- **Crazy Rules (`crazy`)**: aturan klasik, ditambah aturan 7-0.
  - Angka **0**: semua tangan pindah ke pemain berikutnya searah arah permainan saat itu (`rotateHands`).
  - Angka **7**: pemain memilih lawan untuk bertukar tangan (`swapHands`). Aksi `play` membawa `target`; tanpa target yang sah, aksinya ditolak.
  - Kalau 0/7 adalah kartu terakhir, pemain langsung menang tanpa bertukar. Kartu pembuka 0/7 tidak menjalankan aturan ini.
  - Setelah tangan berpindah, status UNO semua pemain direset.
- **Indonesian Rules (`indonesian`)**:
  - **Tumpukan +2/+4 (fase `stack`)**: setelah +2/+4, pemain berikutnya boleh membalas. +2 dibalas +2 atau +4, sedangkan +4 hanya dibalas +4 (`canStack`). Jumlahnya menumpuk di `pendingDraw`. Pemain yang tidak membalas (aksi `draw`, atau waktu habis) mengambil semuanya lalu dilewati. Kartu pembuka +2 juga langsung masuk fase ini.
  - **Keluar sekaligus**: beberapa kartu bernilai sama, baik angka maupun kartu aksi (warna boleh beda; +2 tidak bisa dicampur +4), dikeluarkan dalam satu aksi. `play.cardId` adalah kartu teratas pilihan pemain dan `play.under` kartu lainnya. `playOrder` memastikan kartu paling bawah cocok dengan buangan; di fase `stack` semuanya harus bisa membalas, dan di fase `drawn` kartu yang baru diambil harus ikut. Di layar, kartu dipilih satu per satu dan kartu terakhir yang dipilih jadi kartu teratas.
  - **Efek berlipat** sesuai jumlah kartu k: Reverse membalik arah k kali (genap = kembali ke arah semula), Skip melewati k pemain (`skip`), +2 menambah 2k, +4 menambah 4k. Warna Wild/+4 dipilih sekali. Berdua, tiap Reverse dihitung sebagai Skip.
  - **Ambil sampai dapat** (`drawUntilPlayable`): aksi `draw` hanya sah kalau tidak ada kartu yang cocok. Pemain mengambil terus sampai dapat kartu yang cocok, lalu wajib mengeluarkannya (fase `drawn` tanpa `pass`). Saat waktu habis, kartu diambil sampai dapat lalu dikeluarkan otomatis.
  - Tombol UNO! juga muncul kalau pilihan kartu akan menyisakan satu kartu.
  - Tantangan Wild Draw Four tidak dipakai.

### Perbedaan mode online dengan mahjong

- ID PeerJS memakai awalan `uno-claude-room-`, jadi kode room UNO tidak bertabrakan dengan room mahjong. Link undangan berbentuk `?game=uno&room=KODE`; App langsung membuka menu online UNO.
- Batas waktu per aksi diatur host (bawaan 20 detik). Saat habis, aksi `timeout` dijalankan: ambil 1 kartu (tanpa mengeluarkannya), menerima Wild Draw Four, atau memilih warna terbanyak di tangan. Batas waktu dihitung ulang hanya saat giliran berganti (`UnoState.step`), tidak saat ada yang bilang UNO.
- Pemain yang terputus lebih dari 15 detik dijalankan otomatis dengan aksi `timeout`, seperti di mahjong.
- `viewFor` hanya mengirim jumlah kartu lawan; isi tangan semua pemain baru dibuka setelah ronde selesai. Status curang tidaknya Wild Draw Four tidak pernah dikirim ke tamu.
- Kursi pelaku aksi UNO dan Tangkap diambil host dari koneksi pengirim, bukan dari isi pesan.

### Palet

Dipasang lewat `data-game='uno'` di `<html>` selama layar UNO terbuka, dan menimpa tema serta palet pilihan mahjong (`uno.css` diimpor setelah `index.css`). Warna website: Charcoal `#343434`, Deep Teal `#055E68`, Sage `#62A388`, Mist `#B9D2D2`. Warna kartu mengikuti warna asli UNO: merah `#D72600`, kuning `#ECD407`, hijau `#379711`, biru `#0956BF`.

## 12. Game Capsa

### Ringkasan

- Capsa Banting (Big Two) online, 2–4 pemain, tiap pemain di perangkatnya sendiri. Host membuat room (kapasitas 4) dan bisa memulai begitu ada minimal 2 pemain.
- 52 kartu tanpa Joker, 13 kartu per pemain; kalau pemainnya kurang dari 4, sisa kartu tidak dipakai.
- Tampilan hanya Bahasa Indonesia, tanpa tombol tema. Musik latar dan efek suara sama dengan game lain.

### Struktur folder

```
src/capsa/
  cards.ts         Kartu (ID = kekuatan), urutan angka/bunga, penilaian kombinasi (`evaluate`) dan perbandingannya (`beats`)
  state.ts         State ronde dan reducer: keluarkan kartu, lewat, waktu habis, skor ronde
  net.ts           HostRoom/GuestRoom Capsa (PeerJS), penyaringan state per kursi (`viewFor`), hook React
  CapsaApp.tsx     Layar-layar Capsa, lobi room, dan pemasangan palet/ikon tab
  CapsaHome.tsx    Homescreen dengan kipas kartu animasi (GSAP)
  CapsaSetup.tsx   Menu online: gabung dengan kode atau buat room
  CapsaTable.tsx   Meja: lawan, kartu di meja (bisa disorot), panel aksi, tangan, riwayat, skor
  CapsaHand.tsx    Tangan sendiri: pilih kartu dan seret untuk mengubah urutan
  CapsaCard.tsx    Gambar kartu remi dan punggungnya; bunga digambar SVG
  CapsaDialogs.tsx Panduan cara main dan hasil ronde
  sfx.ts           Efek suara kartu dikeluarkan/dibagikan
  capsa.css        Semua gaya Capsa, termasuk palet
```

### Aturan yang dipakai

- **Urutan angka:** 3 < 4 < … < 10 < J < Q < K < A < 2. **Urutan bunga:** ♦ Wajik < ♣ Keriting < ♥ Hati < ♠ Sekop. ID kartu adalah `(angka - 3) * 4 + urutan bunga`, jadi 3♦ = 0 dan 2♠ = 51; membandingkan kartu tunggal cukup membandingkan ID.
- **Kombinasi:** single, pair, tris, dan 5 kartu (straight < flush < full house < four of a kind + 1 < straight flush). Kombinasi hanya bisa dilawan dengan jumlah kartu yang sama. Untuk 5 kartu, jenis yang lebih tinggi selalu menang; jenis yang sama dibandingkan lewat `Combo.key`.
  - Single: ID. Pair: kartu tertinggi (angka lalu bunga). Tris, full house, four of a kind: angka tris/empat kartunya.
  - Straight dan straight flush: angka tertinggi menurut urutan biasa (A boleh 1 atau 14, tidak boleh J-Q-K-A-2), lalu bunga kartu tertingginya. Flush: kartu-kartunya dari yang tertinggi.
- **Giliran:** setiap ronde dimulai pemegang 3♦, dan 3♦ wajib ikut keluar di giliran pertama (`mustInclude`). Kalau pemainnya kurang dari 4 dan 3♦ tidak terbagi, pemegang kartu terkecil yang memulai.
- **Walik:** pemain yang mengeluarkan four of a kind boleh memilih walik (`play.walik`). Sesudahnya urutan angka dan bunga terbalik (3 terbesar, 2 terkecil, ♦ terbesar, ♠ terkecil) sampai ronde selesai (`reversed`). Kekuatan kartu dihitung lewat `strength(card, reversed)`, dan kartu di meja dinilai ulang dengan urutan yang berlaku. Four of a kind-nya sendiri dinilai dengan urutan sebelum walik; walik kedua mengembalikan urutan normal. Urutan jenis kombo 5 kartu tidak ikut terbalik; straight saat walik dinilai dari kartu terendahnya.
- **Tris terkunci:** begitu kombo 5 kartu pernah keluar di sebuah ronde (`fiveCardPlayed`), tris tidak boleh dikeluarkan lagi sampai ronde selesai, walaupun meja sudah bersih. Single, pair, dan kombo 5 kartu tetap boleh; di meja tampil penanda "Tris terkunci".
- **Lewat:** pemain yang lewat tidak ikut lagi sampai meja dibersihkan. Kalau giliran berputar kembali ke pemain terakhir yang mengeluarkan kartu (`leader`), meja dibersihkan dan ia bebas memulai kombinasi apa saja.
- **Skor:** ronde selesai saat ada yang menghabiskan kartu. Tiap pemain lain kehilangan poin sebanyak sisa kartunya, pemenang mendapat jumlahnya (`roundDeltas`). Skor terkumpul selama room dibuka.
- **Tanpa batas waktu giliran.** Hanya pemain yang terputus lebih dari 15 detik yang dijalankan otomatis: lewat, atau kalau sedang memimpin, kartu terkecil (atau kartu wajib) dikeluarkan.

### Tampilan

- **Kartu di meja:** sampai 3 kombinasi terakhir di putaran itu ditampilkan; yang lama diperkecil dan diredupkan. Disorot (atau diketuk di layar sentuh), kombinasi membesar, kartunya terbuka lebar, dan tooltip menampilkan nama kombinasi, kartunya, dan siapa yang mengeluarkan.
- **Tangan:** klik untuk memilih beberapa kartu; preview di panel aksi menampilkan jenis kombinasi dan apakah bisa dikeluarkan (`playProblem`). Tekan lalu seret untuk memindahkan kartu ke posisi lain (garis emas menandai tempat jatuhnya). Memakai pointer events, jadi berlaku untuk mouse maupun layar sentuh. Urutan tangan hanya disimpan di perangkat itu; tombol Urut angka / Urut bunga menyusun ulang sekaligus.
- **Palet** (`data-game='capsa'`): Background `#0D0D0F`, Surface `#18181B`, Gold `#D4AF37`, Bright Gold `#F5D76E`, Text `#F4F4F5`, Muted `#A1A1AA`, Red `#B91C1C` (bunga merah).
- **Panduan** (tombol "?" di meja dan "Cara Main" di homescreen): cara main, cara memilih/menyusun kartu, urutan angka, urutan bunga, dan semua jenis kombinasi dengan contoh kartunya.

### Online

Sama dengan UNO: ID PeerJS berawalan `capsa-claude-room-`, link undangan `?game=capsa&room=KODE`, dan pemain yang terputus lebih dari 15 detik dijalankan otomatis. Bedanya, Capsa tidak memakai batas waktu giliran. `viewFor` hanya mengirim jumlah kartu lawan; semua tangan baru dibuka setelah ronde selesai.

## 13. Game KA-BOOM!

Nama internalnya tetap `bomkata` (folder `src/bomkata/`, link undangan `?game=bomkata`, awalan ID room), supaya link lama tetap jalan.

### Ringkasan

Gabungan adu kata dan *hot potato*. Online, 2–6 pemain duduk di meja bundar, masing-masing punya 2 nyawa.

1. Setiap ronde, sebuah kategori diundi (animasi mesin slot), misalnya Hewan atau Buah. Kalau host menyalakan **Next Level**, sekitar 40% ronde mendapat tantangan tambahan (lihat *Tantangan (Next Level)* di bawah), misalnya "Buah berakhiran A".
2. Bom di tengah mulai berdetak dengan durasi acak tersembunyi (12–30 detik). Panah di bom menunjuk pemain yang memegangnya.
3. Pemegang bom mengetik kata dari kategori itu. Kata benar memindahkan bom ke pemain hidup berikutnya searah jarum jam. Kata salah atau sudah dipakai di ronde itu ditolak, dan bom tetap di tangannya.
4. Waktu bom tidak pernah ditampilkan sebagai angka. Makin dekat ledakan, kedipan dan bunyi detaknya makin cepat (tingkat `heat` 0–3: sisa >12, ≤12, ≤6, ≤2,5 detik).
5. Saat meledak, pemegang bom kehilangan 1 nyawa. Kategori baru diundi, dan ronde berikutnya dimulai dari pemain hidup sesudahnya.
6. Pemain terakhir yang masih punya nyawa menang. Jumlah kemenangan dicatat selama room dibuka.

Pemain lain bisa melihat huruf yang sedang diketik pemegang bom secara langsung.

### Undian kategori (`src/bomkata/rounds.ts`)

Supaya kategori tidak sering berulang, host memakai **kantong acak** (*shuffle bag*):

- Semua kategori dikocok ke dalam kantong, lalu diambil satu per ronde sampai habis. Baru setelah itu kantong diisi dan dikocok lagi. Jadi dalam satu siklus (135 ronde) tiap kategori keluar tepat sekali.
- Kategori yang muncul dalam `RECENT_WINDOW` (10) ronde terakhir dilewati dulu, juga saat kantong baru diisi ulang. Jarak minimal sebuah kategori muncul lagi adalah 11 ronde.
- Kategori boleh punya `group` (mis. `hewan` untuk Hewan, Ikan, Burung, Serangga). Dua kategori segrup tidak diundi berturut-turut, supaya Ikan tidak langsung muncul setelah Hewan.
- Urutan prioritasnya ada di `drawFromBag`: bukan yang baru muncul dan beda grup → bukan yang baru muncul → beda grup → apa saja selain kategori sebelumnya.

### Tantangan (Next Level)

Tantangan **mati secara bawaan**. Saat membuat room, host bisa menyalakan menu **NEXT LEVEL** dan memilih jenis tantangan yang dipakai (`TWIST_KINDS` di `rounds.ts`, dikirim ke tamu lewat `lobby.twists` dan ditampilkan di lobi):

- **Awalan huruf** (`start`): **berawalan "X"**, mis. "Hewan berawalan K"
- **Akhiran huruf** (`end`): **berakhiran "X"**, mis. "Buah berakhiran A"
- **Minimal huruf** (`length`): **minimal N huruf** (N = 6–10, spasi tidak dihitung)

Kalau minimal satu jenis dinyalakan, setiap ronde punya peluang `TWIST_CHANCE` (40%) mendapat syarat tambahan yang dipilih acak dari `twistOptions(answers, jenisYangDinyalakan)`.

Tantangan hanya dipakai kalau kamus masih menyisakan minimal 8 jawaban sah. Syarat "minimal N huruf" juga dilewati kalau lebih dari 70% jawaban sudah sepanjang itu, karena tidak terasa seperti tantangan. Host langsung menyaring daftar jawaban, jadi kata yang tidak memenuhi syarat ditolak seperti kata salah. Tantangan tampil sebagai lencana oranye di bawah nama kategori, dan ikut tercatat di riwayat ("Ronde 2: Buah berakhiran A").

### Kamus kata (`public/words/<bahasa>/`)

GitHub Pages tidak punya database, jadi kamus berupa file JSON statis. Untuk sekarang hanya Bahasa Indonesia (`public/words/id/`).

- `index.json` berisi daftar kategori:
  ```json
  { "language": "id", "categories": [ { "id": "hewan", "name": "Hewan", "group": "hewan", "file": "hewan.json", "count": 106 } ] }
  ```
- Satu file per kategori, supaya kamus yang besar tidak perlu diunduh sekaligus. `group` boleh dikosongkan:
  ```json
  { "id": "hewan", "name": "Hewan", "group": "hewan", "words": ["kucing", "kuda nil", "lumba-lumba"] }
  ```
- Hanya **host** yang mengunduh kamus dan memeriksa jawaban (`src/bomkata/words.ts`). Daftar jawaban tidak pernah dikirim ke tamu (`viewFor` membuang `answers`).
- Jawaban dibandingkan setelah dinormalisasi (`normalizeWord`): huruf kecil, tanpa tanda baca, tanda hubung dianggap spasi. Jadi "Kuda-Nil", "kuda nil", dan "KUDA  NIL" sama.
- Kamus berisi 135 kategori aktif (18.206 kata), dikelompokkan per grup:
  - **merek:** Merek Fashion, Merek Kecantikan, Merek Makanan & Minuman, Merek Elektronik & Teknologi, Aplikasi & Media Sosial, Maskapai Penerbangan, Toko & Ritel, Bank & Dompet Digital.
  - **hiburan:** Karakter Kartun & Animasi, Karakter Film, Superhero & Penjahat Super, Judul Film, Dunia Harry Potter, Dunia Doraemon, Film Disney & Pixar, Film DreamWorks, Film Animasi Lainnya, Judul Drama Korea, Serial Kartun TV, Artis & Selebritas Indonesia, Aktor & Aktris Dunia.
  - **game:** Video Game, Pokemon, Hero Mobile Legends, Karakter Video Game, Istilah Gaming. **anime:** Karakter Anime & Manga, Dunia Naruto, Dunia One Piece.
  - **kata:** Bahasa Gaul, Singkatan & Akronim, Kata Ulang. **inggris:** Hewan dalam Bahasa Inggris, Makanan dalam Bahasa Inggris, Benda dalam Bahasa Inggris, Pekerjaan dalam Bahasa Inggris, Kata Kerja dalam Bahasa Inggris. **sains:** Unsur Kimia, Satuan Ukuran, Jurusan Kuliah. **tumbuhan:** Bunga & Tanaman, Pohon & Kayu.
  - **musik:** Alat Musik, Genre Musik, Penyanyi & Band Indonesia, Penyanyi & Band Dunia, Judul Lagu Barat & K-Pop. **mitos:** Hantu & Makhluk Mitos, Dewa & Mitologi.
  - **hewan:** Hewan, Ikan, Burung, Serangga & Hewan Kecil, Dinosaurus & Hewan Purba, Ras Anjing & Kucing, Hewan Laut, Bagian Tubuh Hewan.
  - **makanan:** Buah, Sayuran, Makanan Khas Indonesia, Makanan Internasional, Kue & Jajanan, Minuman, Bumbu & Rempah, Bahan Makanan, Aneka Sambal, Aneka Nasi & Mi, Aneka Soto, Sate & Bakso, Tanaman Pertanian & Perkebunan, Jajanan SD & Jajanan Jadul, Makanan Jepang, Makanan Korea, Roti, Kue & Dessert.
  - **geografi:** Negara, Ibu Kota Negara, Kota di Indonesia, Pulau di Indonesia, Sungai & Danau di Indonesia, Landmark Dunia, Kota Terkenal Dunia.
  - **benda:** Benda di Rumah, Bagian Rumah, Elektronik & Gadget, Alat Sekolah, Alat Kantor, Perkakas & Alat Pertukangan, Bahan Bangunan, Kosmetik & Perawatan Diri, Alat Dapur, Komputer & Internet, Barang di Kamar & Kamar Mandi.
  - **kegiatan:** Olahraga, Peralatan Olahraga, Hobi, Kegiatan Sehari-hari, Permainan Papan & Kartu, Klub Sepak Bola, Pemain Sepak Bola, Mainan, Kata Kerja, Bela Diri, Istilah Sepak Bola, Perlengkapan Camping & Mendaki.
  - **kendaraan:** Kendaraan, Bagian Kendaraan, Merek Kendaraan, Model Mobil & Motor. **tubuh:** Anggota Tubuh, Penyakit & Gejala, Obat & Alat Kesehatan. **sifat:** Perasaan & Emosi, Sifat & Karakter, Rasa & Tekstur, Panggilan & Sapaan. **pakaian:** Pakaian & Aksesori, Jenis Kain. **budaya:** Bahasa, Hari Raya & Perayaan.
  - **Tanpa grup:** Alam & Cuaca, Anggota Keluarga, Bentuk & Bangun, Bunyi & Onomatope, Logam & Batu Mulia, Luar Angkasa, Mata Pelajaran, Mata Uang, Nama Hari & Bulan, Pekerjaan, Permainan Tradisional, Senjata, Tempat & Bangunan, Warna, Zodiak & Shio, Tokoh Terkenal Dunia, Angka & Bilangan.
  - **Dinonaktifkan sementara** (terlalu sulit, `"disabled": true`): Kata Sifat dalam Bahasa Inggris, Pahlawan Nasional, Rumah Adat, Kerajaan Nusantara, Presiden & Pemimpin Negara.
  - Sebagian kategori sengaja beririsan (mis. Hewan dengan Ikan dan Burung), karena tiap ronde hanya memakai satu kategori. Kategori yang beririsan sebaiknya diberi `group` yang sama.
- **Penulisan kata:** huruf kecil. Frasa memakai spasi ("kuda nil"); kata ulang memakai tanda hubung ("kupu-kupu"). Ejaan lain yang umum boleh ditambahkan sebagai kata terpisah (mis. "cabai" dan "cabe", "kaos" dan "kaus").

**Menambah atau mengubah kategori:**

1. Buat atau ubah `public/words/id/<id>.json` dengan format di atas; `id` harus sama dengan nama filenya.
2. Jalankan `npm run words`. Skrip `scripts/words.mjs` memeriksa semua file (JSON valid, `id` cocok, `group` berformat benar, kata huruf kecil tanpa tanda baca, tidak ada kata ganda; kategori di bawah 30 kata diberi peringatan) lalu menulis ulang `index.json` beserta jumlah katanya. Tidak ada kode yang perlu diubah. Kategori dengan `"disabled": true` tetap diperiksa tapi tidak dimasukkan ke `index.json`, jadi tidak muncul di permainan; hapus baris itu untuk mengaktifkannya lagi.
3. Commit file kategori dan `index.json`. Saat build (`npm run build`, termasuk deploy GitHub Actions), skrip yang sama dijalankan dengan `--check` dan build gagal kalau kamus rusak atau `index.json` belum diperbarui.

Kalau ada kata benar yang ditolak saat bermain, tambahkan kata itu ke file kategorinya lalu jalankan `npm run words`.

### Struktur folder

```
src/bomkata/
  words.ts            Memuat index dan kategori dari public/words, normalisasi jawaban
  state.ts            State dan reducer: ronde, ketik, kirim kata, tingkat panas, ledakan, nyawa
  rounds.ts           Kantong acak kategori dan pilihan tantangan (murni, tanpa PeerJS)
  net.ts              HostRoom/GuestRoom (PeerJS); host juga mengatur undian, sumbu bom, dan jeda ronde
  BomKataApp.tsx      Layar-layar, lobi, menu online, tema 8-bit (font, ikon tab)
  BomKataHome.tsx     Homescreen dengan bom pixel dan huruf melayang
  BomKataTable.tsx    Meja bundar, bom dan panah, undian kategori, konsol ketikan, kotak ketik
  BomKataDialogs.tsx  Panduan dan hasil permainan
  Pixel.tsx           Pixel art SVG: bom, ledakan, panah, hati, wajah pemain
  sfx.ts              Efek suara chiptune lewat Web Audio (detak, benar, salah, ledakan, menang)
  bomkata.css         Semua gaya KA-BOOM!, termasuk palet
```

### Tampilan

- **Palet** (`data-game='bomkata'`): Deep Arena `#172B55`, Pixel Blue `#294A7A`, Power-up `#F5C451`, Explosion `#F47735`, Danger `#EF4B55`, Safe/Ready `#62C96B`.
- **Font pixel:** Press Start 2P untuk judul dan tombol, VT323 untuk teks. Keduanya dimuat dari Google Fonts saat layar KA-BOOM! dibuka.
- **Pixel art:** semua gambar (bom, ledakan, panah, hati, wajah) digambar dari kotak SVG di `Pixel.tsx`, jadi tetap tajam di semua ukuran. Tidak ada file gambar.
- **Efek suara:** dibuat langsung dengan Web Audio, jadi tidak ada file suara. Bisa dimatikan lewat tombol ♪ di meja; pilihannya disimpan di perangkat itu.
- **Ukuran meja:** ukuran bom dan panah mengikuti lebar meja lewat *container query units* (`cqw`).

### Online

Sama dengan game lain: ID PeerJS berawalan `bomkata-claude-room-`, dan link undangannya `?game=bomkata&room=KODE`. Bedanya, semua pewaktu dijalankan host: undian kategori (`READY_MS`), sumbu bom (`FUSE_MIN_MS`–`FUSE_MAX_MS`), tingkat panas (`HEAT_AT`), dan jeda setelah ledakan (`BOOM_MS`). Pemain yang terputus tetap duduk; kalau bom ada di tangannya, bom meledak seperti biasa.

## 14. Game Armada Royale

Nama internalnya `armada` (folder `src/armada/`, link undangan `?game=armada&room=KODE`, awalan ID room `armada-claude-room-`).

### Ringkasan

Tembak-tembakan kapal dengan format *battle royale*: online, 2–6 pemain, masing-masing punya papan dan armada sendiri. Pemain terakhir yang masih punya kapal menang.

1. **Penempatan.**
   - Setiap pemain menyusun armadanya dengan seret-dan-lepas (lihat *Penempatan kapal*), lalu menekan SIAP.
   - Batas waktunya `PLACEMENT_SECONDS` (90 detik). Saat habis, armada yang belum siap disusun acak oleh host.
2. **Ronde.** Urutan pemain yang masih hidup diacak di awal tiap ronde (`planTurn`). Tiap pemain mendapat satu giliran.
3. **Target diundi otomatis** (`pickTarget` di `grid.ts`).
   - Calon target adalah lawan yang masih hidup, masing-masing berbobot 1.
   - Target terakhir penyerang itu berbobot `REPEAT_WEIGHT` (0,5).
4. **Menembak.**
   - Penyerang memilih satu sel di papan target dalam `TURN_SECONDS` (20 detik). Kalau waktunya habis, host menembak sel acak.
   - Hasilnya (meleset, kena, tenggelam, atau mengenai Ranjau) dicatat **di papan target** dan terlihat semua pemain.
5. **Tenggelam dan gugur.**
   - Kapal tenggelam kalau semua selnya kena. Posisinya lalu terlihat semua pemain.
   - Pemain yang semua kapalnya tenggelam gugur dan menonton sampai selesai.
6. **Akhir permainan.** Layar akhir memuat statistik tiap pemain. Jumlah kemenangan dicatat selama room dibuka.

### Papan dan armada (`src/armada/grid.ts`)

Host memilih ukuran papan saat membuat room. Kepadatan kapal dijaga sekitar 30% papan.

| Preset | Papan | Kapal |
|---|---|---|
| Cepat | 5×5 | Kapal Perang 3, Perusak 2, Patroli 2 |
| Normal (bawaan) | 6×6 | Kapal Induk 4, Kapal Perang 3, Perusak 2, Patroli 2 |
| Panjang | 7×7 | Kapal Induk 4, Kapal Perang 3, Kapal Selam 3, Perusak 2, Patroli 2 |

- Sel disimpan sebagai indeks `row * size + col`. Label "B3" (kolom huruf, baris angka) hanya untuk tampilan.
- Kapal boleh bersentuhan, tapi tidak boleh tumpang tindih atau keluar papan (`fleetCells`).

### Skill (`src/armada/skills.ts`)

**Cara mendapat SP.** Pemain mendapat Skill Point (SP) saat **papannya ditembak**:
- +1 setiap ditembak, termasuk kalau tembakannya mengenai Ranjau;
- +1 lagi kalau tembakannya kena;
- +2 lagi kalau kapalnya tenggelam.

SP awal 0, maksimal 6. Angka-angka ini ada di `SKILL_CONFIG`.

| Skill | SP | Kapan | Efek |
|---|---|---|---|
| Ranjau | 2 | Kapan saja selama hidup, maks. 2 aktif | Dipasang di sel kosong papan sendiri (bukan kapal, belum ditembak). Lawan yang menembak sel itu terkena 3 serangan acak di papannya sendiri dan gilirannya berakhir. Letaknya hanya diketahui pemiliknya |
| Sonar | 2 | Giliran sendiri, 1× per giliran | Jumlah sel kapal yang belum kena di area 3×3 papan target. Hasilnya hanya dikirim ke pemakai |
| Tembakan Ganda | 3 | Giliran sendiri, sebelum menembak | Dua tembakan ke sel berbeda di target yang sama |

Teks dan biaya ada di `SKILLS`, aturan ranjau di `MINE_CONFIG`. Efeknya ada di reducer (`useSkill` dan `fire` di `state.ts`).

**Detail Ranjau** (menggantikan Perisai, yang terlalu kuat dan membuat permainan berlarut):
- Sel ranjau yang terpicu ditandai ledakan di papan pemiliknya (terlihat semua pemain) dan ranjaunya habis.
- 3 serangan balik memilih sel acak yang belum ditembak di papan penyerang, tidak termasuk ranjau penyerang sendiri (tidak ada ledakan berantai). Serangan balik bisa menenggelamkan kapal, bahkan menggugurkan penyerang; kapal yang tenggelam dihitung untuk pemilik ranjau.
- Ledakan ranjau mengakhiri giliran, termasuk sisa Tembakan Ganda.
- Angka acaknya dibuat host (`roll` pada aksi `fire`), bukan tamu.
- SP: pemilik ranjau mendapat +1 seperti biasa karena papannya ditembak; penyerang mendapat SP kena/tenggelam dari serangan balik, tanpa +1 per serangan.
- Sonar tidak mendeteksi ranjau.

### Privasi (`viewFor` di `state.ts`)

Host memegang armada semua pemain, sama seperti host game lain memegang semua kartu. Tamu hanya menerima `viewFor(state, kursinya)`:
- **Untuk semua pemain:** status hidup/gugur, SP, tembakan yang diterima tiap papan, jumlah kapal tersisa, kapal yang sudah tenggelam, dan statistik.
- **Hanya untuk pemiliknya:** armada lengkap dan letak ranjau aktif.
- **Setelah permainan selesai:** armada dan ranjau semua pemain dibuka.
- **Hasil Sonar:** hanya dikirim ke pemakainya.

### Penempatan kapal (`ArmadaPlacement.tsx`)

Seret-dan-lepas dibuat dengan Pointer Events, jadi jalan dengan mouse maupun sentuhan:
- **Pasang:** seret kapal dari dok ke papan. Kapal mengikuti titik yang dipegang, dan ujungnya digeser masuk kalau keluar tepi.
- **Pratinjau:** sel tujuan berwarna hijau kalau muat, merah kalau menabrak kapal lain.
- **Pindah atau lepas:** seret kapal di papan untuk memindahkannya, atau seret keluar papan untuk mengembalikannya ke dok.
- **Putar:** ketuk kapal di papan. Selama menyeret, bisa juga dengan tombol R atau spasi. Tombol PUTAR mengubah arah kapal di dok.
- **ACAK** menyusun armada otomatis, **KOSONGKAN** mengosongkan papan.

### Pewaktu host (`net.ts`)

- `START_MS`: jeda sebelum giliran pertama.
- `TARGET_MS`: animasi undian target.
- `TURN_SECONDS`: batas bidikan. Tembakan kedua dari Tembakan Ganda mendapat waktu baru.
- `RESULT_MS`: lama hasil tembakan ditampilkan; `MINE_RESULT_MS` untuk ledakan ranjau (lebih lama karena ada 3 serangan balik).

Pemain yang terputus tetap duduk dan tetap bisa menjadi target. Saat gilirannya, sel acak ditembak setelah batas waktu habis. Seperti game lain, setelah refresh pemain menekan GABUNG lagi untuk kembali ke kursinya.

### Struktur folder

```
src/armada/
  grid.ts              Preset papan/armada, koordinat, validasi armada, armada acak, undian target
  skills.ts            SKILL_CONFIG (SP) dan daftar skill
  state.ts             State, reducer, planTurn (urutan dan target), viewFor (privasi)
  net.ts               HostRoom/GuestRoom PeerJS, pewaktu, hook React
  ArmadaApp.tsx        Layar-layar, menu online (pilih preset), lobi, tema
  ArmadaHome.tsx       Homescreen
  ArmadaPlacement.tsx  Layar penempatan kapal (seret-dan-lepas)
  ArmadaTable.tsx      Meja: papan besar, status giliran, riwayat
  ArmadaHud.tsx        Kartu pemain, panel skill, SP, undian target
  ArmadaDialogs.tsx    Panduan dan layar akhir (statistik)
  Board.tsx            Komponen papan N×N (besar, sedang, mini)
  Timer.tsx            Bar sisa waktu
  Pixel.tsx            Pixel art SVG: kapal, cipratan, api, ranjau, ledakan, radar, bidikan, bendera, ombak
  sfx.ts               Efek suara chiptune lewat Web Audio
  armada.css           Semua gaya Armada Royale, termasuk palet
```

### Tampilan

- **Palet** (`data-game='armada'`): Charcoal `#171A17`, Military Green `#30352D`, Olive `#55584B`, Muted Green `#8A8B73`, Parchment `#C6B98A`, Hit `#A63D32`, Water `#3F6470`. Token CSS-nya bernama semantik (`--ar-accent`, `--ar-hit`, `--ar-water`, dst.) di awal `armada.css`, jadi palet bisa diganti di satu blok.
- **Font dan gaya pixel:** sama dengan KA-BOOM! (Press Start 2P dan VT323).
- **Pixel art:** semua digambar di `Pixel.tsx`. Kapal dibuat prosedural sesuai panjangnya, lalu diputar untuk kapal tegak.
- **Papan besar:** menampilkan papan target giliran itu. Kartu pemain bisa diketuk untuk melihat papan pemain lain.

## 15. Game ASBUN

*A Game of Deception.* Nama internalnya `asbun` (folder `src/asbun/`, link undangan `?game=asbun&room=KODE`, awalan ID room `asbun-claude-room-`). Dibuat dari brief desain `ASBUN_Game_Design_and_Implementation_Brief.md`, dengan penyesuaian yang dicatat di bawah.

### Ringkasan

Permainan tebak kata dengan peran rahasia untuk 4–10 pemain, online, tiap pemain di perangkatnya sendiri.

- **Warga** mendapat kata Warga.
- **Penyusup** mendapat kata yang mirip tapi berbeda. Ia tahu dirinya Penyusup, tapi tidak tahu kata Warga.
- **Si Asbun** tidak mendapat kata dan harus "asal bunyi" dengan meyakinkan. Brief menyebut peran ini *White Man / Mr. White*.
- **Kategori** pasangan kata (mis. Hewan) diumumkan ke semua pemain sejak berkas dibuka, termasuk Si Asbun, supaya petunjuk lebih terarah. Kategori tampil di berkas pribadi dan di kepala fase.

### Alur (`src/asbun/state.ts`)

1. **Lobi** (`net.ts`, saat `game === null`):
   - Tamu menekan "Saya siap". Host dianggap selalu siap.
   - Host mengatur jumlah pemain maksimal, pembagian peran, kategori, tingkat kesulitan, serta waktu petunjuk, diskusi, dan voting.
   - Host baru bisa mulai kalau ada minimal 4 pemain dan semua tamu siap.
2. **`reveal`**:
   - Tiap pemain membuka berkasnya sendiri, lalu menekan "Saya mengerti".
   - Lanjut setelah semua pemain yang tersambung mengerti, atau setelah 25 detik.
3. **`clue`**:
   - Pemain aktif bergiliran memberi satu petunjuk (maks. 30 karakter).
   - Si Asbun tidak pernah membuka putaran pertama. Ronde berikutnya dimulai dari pemain aktif sesudah pembuka ronde sebelumnya.
   - Petunjuk ditolak kalau berisi kata milik pemain itu sendiri, setelah normalisasi. Petunjuk tidak dicek terhadap kata Warga, karena penolakannya akan membocorkan kata itu ke Penyusup.
   - Kalau waktu habis, petunjuk dicatat kosong.
4. **`discussion`** (bawaan 30 detik):
   - Countdown berjalan, dan host bisa langsung membuka voting.
   - Pemain aktif bisa mengirim reaksi emoji (`REACTIONS` di `state.ts`): 🤔 👀 🤨 🤫 😏 😂 😱 👍 👎 🙏.
   - Reaksi terlihat semua pemain, di umpan reaksi panel diskusi dan sebagai gelembung di samping nama pengirim.
   - Host membatasi satu reaksi per 0,8 detik per pemain (`REACTION_COOLDOWN_MS`) dan menyimpan 24 reaksi terakhir per ronde.
   - Pemain yang sudah tereliminasi hanya bisa melihat, supaya tidak memberi kode.
   - Tidak ada chat teks. Diskusi lebih lanjut lewat suara atau tatap muka.
5. **`voting`**:
   - Rahasia dan bersamaan. Pemain tidak bisa memilih diri sendiri, dan hanya bisa memilih satu kali.
   - Pilihan bisa diganti sampai menekan "Kunci suara".
   - Pemain yang belum bisa menentukan bisa memilih **skip vote** (`SKIP_VOTE`). Skip dihitung seperti satu pilihan tersendiri.
   - Voting ditutup setelah semua pemain aktif yang tersambung memilih, atau waktu habis.
6. **`elimination`**:
   - Pemain dengan suara terbanyak dieliminasi kalau tidak seri dengan pemain lain dan suaranya lebih banyak dari skip. Hanya perannya yang dibuka, bukan katanya.
   - Kalau skip mendapat suara terbanyak, seri (termasuk seri dengan skip), atau tidak ada suara, tidak ada yang keluar dan ronde baru dimulai.
7. **`guess`**:
   - Si Asbun yang tereliminasi mendapat satu tebakan kata Warga dalam 40 detik.
   - Pencocokan memakai `sameWord`: huruf besar/kecil, spasi, tanda hubung, dan diakritik diabaikan. Sinonim tidak diterima.
8. **`over`**: semua peran, kedua kata, dan kronologi dibuka. Host bisa "Main lagi" atau "Kembali ke lobi".

### Aturan menang (`checkVictory`, dicek setelah tiap eliminasi)

1. **Si Asbun** langsung menang sendiri kalau tebakannya tepat. Ini dicek lebih dulu, di `resolveGuess`.
2. **Penyusup** menang kalau jumlah Penyusup aktif ≥ jumlah pemain aktif lain (Warga + Si Asbun).
3. **Warga** menang kalau semua Penyusup dan Si Asbun sudah keluar.
4. **Si Asbun bertahan.** Kalau Penyusup sudah habis dan tinggal dua pemain dengan Si Asbun di antaranya, Si Asbun menang.
   - Aturan ini tambahan dari pemilik projek, karena dalam kasus itu voting selalu seri dan permainan akan macet.

### Pembagian peran (`roles.ts`)

| Pemain | Standar (W/P/A) | Banyak Penyusup (W/P/A) |
|---|---|---|
| 4 | 2/1/1 | 2/1/1 |
| 5 | 3/1/1 | 2/2/1 |
| 6 | 4/1/1 | 3/2/1 |
| 7 | 4/2/1 | 3/3/1 |
| 8 | 5/2/1 | 4/3/1 |
| 9 | 6/2/1 | 5/3/1 |
| 10 | 6/2/2 | 5/3/2 |

`roleSplit` menolak pembagian yang tidak sah. Syaratnya:
- Tiap peran minimal satu.
- Jumlahnya harus sama dengan jumlah pemain.
- Penyusup harus kalah jumlah di awal.

### Kamus pasangan kata (`public/asbun/word-pairs.json`)

- Dimuat host saja.
- Formatnya `{ version, locale, categories, pairs: [{ category, difficulty, warga, penyusup, tags? }] }`, dengan satu pasangan per baris.
- Isinya 157 pasangan bahasa Indonesia dalam 9 kategori (Makanan & Minuman, Hewan, Tempat, Teknologi, Alam, Profesi, Benda, Olahraga, Hiburan) dan 3 tingkat kesulitan. Ini contoh awal, bukan daftar lengkap.
- `selectPair` mencocokkan kategori dan kesulitan. Kalau tidak ada yang cocok, syaratnya dilonggarkan.
- Pasangan yang sudah dipakai di room itu diutamakan tidak keluar lagi.
- Kata mana yang jadi kata Warga diacak, jadi satu pasangan bisa dimainkan dua arah.

### Privasi (`viewFor`)

Host memegang semua peran dan kata. Setiap tamu hanya menerima:
- peran dan kata miliknya sendiri;
- kategori pasangan kata (terbuka untuk semua pemain);
- peran pemain lain setelah pemain itu tereliminasi;
- siapa saja yang sudah memilih, tapi bukan pilihannya;
- jumlah suara setelah voting ditutup;
- kedua kata hanya setelah permainan selesai.

Teks tebakan Si Asbun yang salah juga disembunyikan dari pemain lain sampai permainan selesai, karena tebakan itu bisa saja kata Penyusup. Pesan penolakan petunjuk hanya dikirim ke pemain yang bersangkutan.

### Penyesuaian dari brief

- **Protokol:** brief mengusulkan event bertipe (`SUBMIT_CLUE`, `VOTING_RESULT`, dll.). ASBUN memakai pola yang sama dengan game lain:
  - Tamu mengirim aksi, host memvalidasi lewat reducer, lalu host mengirim snapshot `viewFor` per kursi.
  - Setiap aksi membawa `round` dan `phase`, jadi pesan basi atau salah fase ditolak.
- **Identitas:** pemain dikenali dari nomor kursi, yang tetap selama permainan. Sambung ulang memakai token di `sessionStorage`. Setelah refresh, pemain menekan Gabung lagi dan kembali ke kursi serta perannya.
- **Token warna:** brief memakai `--color-*`. Di sini diberi awalan `--as-*` supaya tidak bertabrakan dengan game lain.
- **Bahasa:** UI dan nama peran berbahasa Indonesia. Tagline "A Game of Deception" tetap.
- **Unit test:** tidak ditambahkan ke repo, sesuai keputusan pemilik projek. Logika diuji dengan simulasi di luar repo (3.000 permainan) dan tes 5 pemain di browser.
- **Chat diskusi:** v1 memakai reaksi emoji, bukan chat teks. Diskusi lebih lanjut lewat suara atau tatap muka.

### Batasan

- **Host tepercaya.** Host secara teknis bisa mengintip semua peran dan kata lewat DevTools, dan bisa curang. Game ini tidak anti-curang. Itu baru mungkin dengan server tepercaya atau protokol kriptografi.
- **Host keluar = room selesai.** Tidak ada perpindahan host. Tamu melihat pesan "Koneksi ke host terputus" dan harus membuat room baru.
- **Pemain yang terputus:**
  - Kursinya ditahan.
  - Saat gilirannya memberi petunjuk atau menebak, ia dilewati setelah 6 detik.
  - Voting tidak menunggu suaranya.
- **Kursi pemain terputus dihapus** saat host menekan "Main lagi" atau "Kembali ke lobi".

### Struktur folder

```
src/asbun/
  roles.ts            Peran, preset pembagian peran, validasi, pembagian acak
  words.ts            Memuat kamus, normalisasi kata, cek petunjuk, pilih pasangan kata
  state.ts            State machine, reducer, checkVictory, viewFor (privasi)
  net.ts              HostRoom/GuestRoom PeerJS, lobi (siap, pengaturan), pewaktu, hook React
  AsbunApp.tsx        Layar-layar, buat/gabung room, tema (font, ikon tab)
  AsbunHome.tsx       Homescreen bergaya berkas kasus
  AsbunLobby.tsx      Ruang tunggu: tersangka, status siap/koneksi, pengaturan host
  AsbunTable.tsx      Halaman permainan: fase, countdown, panel sesuai fase
  AsbunPanels.tsx     Berkas pribadi, daftar tersangka, catatan petunjuk, voting, tebakan
  AsbunResults.tsx    Putusan akhir: pemenang, identitas, kedua kata, kronologi
  AsbunDialogs.tsx    Cara bermain dan konfirmasi keluar
  Icons.tsx           Ikon garis SVG
  asbun.css           Semua gaya ASBUN, termasuk token warna
public/asbun/word-pairs.json
```

## 16. Game PALUNG

Game mengetik untuk 1 pemain, tanpa jaringan. Pemain adalah penyelam yang terus turun dari 0 m. Ikan berdatangan dari kanan membawa kata; ketik katanya sebelum ikan mencapai penyelam. Tujuannya bertahan sedalam mungkin dengan 3 hati.

### Alur

1. **Turun terus.** Kedalaman = waktu bertahan × laju turun (`DESCENT`, 2,4 m/detik, naik pelan sampai 4 m/detik). Laju berhenti selama penjaga zona (Kraken, Megalodon Robot, Belut Listrik, atau Siren) masih hidup dan selama Arus Gua.
2. **Mengunci target.** Huruf pertama yang diketik mengunci ikan **terdekat ke penyelam** yang katanya diawali huruf itu. Ikan bisa dikunci begitu labelnya terlihat, walau badannya baru separuh masuk layar (kecuali Ikan Bayangan). Huruf berikutnya melanjutkan ikan itu. Huruf yang sudah benar berwarna kuning, sisanya putih; target terkunci diberi lingkaran putus-putus.
   - Saat ikan baru muncul, mesin memilih kata yang huruf awalnya **belum dipakai** ikan lain di layar, supaya penguncian jarang ambigu.
   - Salah ketik tidak mengurangi hati, tapi memutus kombo dan menurunkan akurasi.
   - **Backspace** melepas kunci (kemajuan kata itu diulang dari awal).
3. **Terkena.** Ikan atau misil yang mencapai penyelam mengambil hati (Kraken 2 hati), lalu hancur. Setelah terkena ada jeda kebal singkat (`hurtGrace`).
4. **Sonar** (**Enter**): menghancurkan semua ikan dan misil di layar kecuali bos dan bonus. Misil yang dihancurkan Sonar tidak memantul ke bos. Saat melawan Belut Listrik, Sonar justru menampilkan ulang urutan huruf sebentar; saat melawan Siren, Sonar menghapus Nada tanpa melukai Siren. Mulai dengan 1, maksimal 3.
5. **Selesai** saat hati habis. Ringkasan menampilkan kedalaman, waktu bertahan, skor, WPM, akurasi, kombo terbaik, dan jumlah musuh per jenis. Rekor terbaik disimpan di perangkat (`localStorage`, kunci `palung-best`).

### Musuh dan bonus (`ENEMIES` di `config.ts`)

| Jenis | Kata | Kecepatan | Catatan |
|---|---|---|---|
| Teri | 1 huruf | sangat cepat | Hanya muncul dalam **Kawanan Teri** |
| Piranha | 3–4 huruf | cepat | |
| Hiu | 5–7 huruf | sedang | |
| Hiu Martil | 8–12 huruf | lambat | Mulai muncul setelah 40 m |
| Ikan Bayangan | 4–6 huruf | sedang | Mulai 150 m. Ikan dan katanya tampil samar (50%) dan **baru bisa diketik setelah kepalanya melewati garis putus-putus** 330 px dari penyelam (`reveal`). Mengetik huruf awalnya sebelum itu dihitung salah ketik |
| Kraken | frasa 3–5 kata | sangat lambat | Penjaga zona; kata diketik berurutan |
| Megalodon Robot | – | – | Penjaga zona; lihat [Megalodon Robot](#megalodon-robot-megalodon-di-configts) |
| Misil | 4–7 huruf | sedang | Hanya ditembakkan Megalodon; meluncur lurus ke penyelam |
| Belut Listrik | urutan 4–8 huruf | – | Penjaga zona (bos memori); lihat [Belut Listrik](#belut-listrik-eel-di-configts) |
| Siren | – | – | Penjaga zona (kata terbalik + menghindar); lihat [Siren](#siren-siren-di-configts) |
| Nada Siren | 4–6 huruf, diketik dari belakang | lambat | Hanya dilepas Siren |
| Gelembung Oksigen | kata bonus | naik dari dasar | +1 hati; hanya muncul kalau hati berkurang |
| Kerang Mutiara | kata bonus | naik dari dasar | +1 Sonar dan skor bonus |

### Kedalaman dan kesulitan

- **Zona** (`ZONES`): Zona Cahaya (0 m), Zona Senja (100 m), Zona Tengah Malam (300 m), Zona Abisal (600 m), Palung Hadal (1000 m). Warna laut berubah halus antarzona; makin dalam makin gelap, dan hanya sekitar lampu penyelam yang terang. Label kata selalu digambar di atas kegelapan supaya tetap terbaca.
- **Kesulitan** (`difficultyAt`): jeda kemunculan makin pendek, ikan makin cepat, jumlah ikan maksimal di layar bertambah, dan porsi Hiu/Hiu Martil naik. Setelah 1000 m kesulitan tetap naik pelan, supaya tidak ada titik aman untuk bertahan selamanya.
- **Kejadian berkala** (`EVENTS`):
  - Kawanan Teri pertama di 40 m, lalu tiap 100 m; jumlah ikannya bertambah dengan kedalaman (6–18).
  - Penjaga zona muncul di kedalaman `EVENTS.boss.at` (100, 300, 600, 800 m), lalu tiap 500 m setelahnya. Jenisnya bergiliran (`EVENTS.boss.order`): Kraken di 100 m, Megalodon Robot di 300 m, Belut Listrik di 600 m, Siren di 800 m, lalu berulang (Kraken di 1300 m, Megalodon di 1800 m, ...).
  - Gelembung Oksigen tiap 140 m (kalau hati berkurang), Kerang Mutiara tiap 160 m.
  - **Arus Gua** pertama di 200 m, lalu tiap 250 m (lihat [Arus Gua](#arus-gua-cave-di-configts-dan-cavets)). Tidak dimulai saat ada bos atau Kawanan Teri; ditunda sampai keduanya selesai.

Hasil simulasi bot (30 permainan per baris; bot mengetik pada WPM tertentu dengan reaksi 0,3 detik saat berganti target, 0,4 detik per huruf QTE, menghindar di gua dengan memilih ketinggian paling aman di depannya, dan melawan Belut Listrik dengan peluang lupa 1,5% per huruf urutan):

| Bot | Bertahan (median) | Kedalaman (median) | Catatan |
|---|---|---|---|
| 20 WPM, akurasi 90% | ±1 menit | ±100 m (Kraken pertama) | |
| 30 WPM, akurasi 92% | ±2,4 menit | ±254 m | Megalodon jarang tercapai |
| 45 WPM, akurasi 94% | ±4,4 menit | ±454 m | Megalodon dikalahkan ±85%, ±40 detik |
| 60 WPM, akurasi 95% | ±5,4 menit | ±600 m | |
| 80 WPM, akurasi 96% | ±7 menit | ±760 m | |
| 100 WPM, akurasi 97% | ±9 menit | ±960 m | |

Bot tidak bisa meniru kesulitan mengingat (Belut Listrik) maupun kebingungan kontrol terbalik (Siren; bot menghitung cerminannya dengan tepat dan tidak pernah terkena), jadi kedua bos itu lebih mudah bagi bot daripada bagi manusia. Di gua, bot rata-rata tergores ±0,3–0,4 kali; sekitar 2 dari 3 gua dilewati tanpa tergores. Kematian di gua umumnya terjadi pada pemain yang masuk dengan 1 hati.

### Megalodon Robot (`MEGALODON` di `config.ts`)

Bos kedua (300 m), bergiliran dengan Kraken dan Belut Listrik. Selama pertarungan **tidak ada ikan atau bonus yang muncul** dan penyelam berhenti turun.

1. **Peringatan.** Banner "SINYAL LOGAM TERDETEKSI" dan denyut merah di tepi kanan. Kemunculan berhenti; bos baru masuk setelah semua ikan berbahaya yang tersisa habis (minimal `warning` detik).
2. **Bertarung.** Bos berpindah naik-turun, lalu diam beberapa detik (`hold`, makin singkat saat HP-nya turun) sambil menembakkan **misil berkata** dari mulutnya, lurus ke penyelam. Paling banyak 2 misil sekaligus (3 mulai Megalodon kedua). Bos tidak menembak kalau sisa waktu diamnya kurang dari `fireCutoff`, supaya setiap misil masih sempat dipantulkan dan kena.
3. **Memantulkan misil.** Misil yang diketik habis **terbang balik ke titik tembaknya**. Kalau badan bos masih di jalurnya (`hitbox`), HP bos −1; kalau bos sudah pindah, tertulis "MELESET" dan HP tidak berkurang. Saat misil terkunci, jalur pantul dan titik tembaknya ditandai garis kuning putus-putus, jadi pemain bisa melihat apakah bos masih di sana.
4. **QTE gigitan.** Saat HP turun melewati 65% dan 30% (`qteAt`, ditandai di bar HP), bos menunggu misil di layar habis lalu bersiap menggigit. Layar menampilkan huruf besar yang harus ditekan, satu per satu (3 huruf; +1 per Megalodon berikutnya, maks. 6), masing-masing sebelum cincin waktunya habis (1,35 detik, makin singkat untuk Megalodon berikutnya; huruf pertama dapat tambahan 0,6 detik).
   - Semua benar: bos terpental dan pingsan sebentar, HP −2.
   - Salah tombol atau terlambat: bos menerjang dan menggigit, −1 hati (menembus jeda kebal), kombo putus.
5. **Kalah.** HP habis: misil yang tersisa meledak, bos tenggelam sambil meledak, lalu banner "MEGALODON HANCUR!" dan penyelaman berlanjut.

HP awal 10, +3 untuk tiap Megalodon berikutnya; kecepatan pindah dan kecepatan misil juga naik. Skor: +20 per HP yang hilang dan 400 saat kalah (keduanya dikali kombo). Selama QTE, Backspace dan Sonar tidak berlaku. Bar HP bos menggantikan nama zona di HUD.

### Belut Listrik (`EEL` di `config.ts`)

Bos ketiga (600 m), bos **memori**. Seperti Megalodon, selama pertarungan tidak ada ikan atau bonus yang muncul dan penyelam berhenti turun. Bos ini tidak bisa diketik langsung; HP-nya hanya berkurang lewat urutan yang benar.

1. **Peringatan.** Banner "ARUS LISTRIK TERDETEKSI". Bos masuk setelah ikan berbahaya yang tersisa habis.
2. **Tunjukkan.** Panel di bawah HUD menampilkan urutan huruf satu per satu (`reveal` detik per huruf, huruf tidak berulang). Setelah lengkap, seluruh urutan terlihat selama `hold` detik (dengan garis hitung mundur), lalu **disembunyikan**. Ketikan selama fase ini diabaikan (tidak dihitung salah).
3. **Bola listrik.** Bos melepas bola listrik berhuruf sama, ditempatkan di **posisi acak** (berjauhan) di antara penyelam dan bos. Bola bergerak pelan ke penyelam; waktunya `time + timePerLetter × panjang` detik sampai bola terdepan tiba.
4. **Ketik urutannya dari ingatan.** Panel kini berisi `?` dan menandai huruf ke berapa yang harus diketik.
   - Huruf benar: bola itu tersetrum hilang dan hurufnya muncul kuning di panel.
   - Huruf salah: salah ketik, kombo putus, dan semua bola melompat `wrongPush` px lebih dekat. Kemajuan urutan tidak diulang.
   - **Sonar** (Enter): urutan tampil lagi selama `peek` detik.
5. **Hasil serangan.**
   - Urutan lengkap: petir balik menyambar bos, HP −1, skor `pointsPerLetter` × panjang (dikali kombo). Urutan berikutnya **lebih panjang 1 huruf** dan waktu hafalannya lebih singkat.
   - Ada bola yang sampai ke penyelam: semua bola meledak, −1 hati (menembus jeda kebal), panel menunjukkan urutan yang benar, lalu bos mengulang dengan urutan baru yang sama panjang.
6. **Kalah.** HP habis: bos tenggelam, banner "BELUT LISTRIK KALAH!", skor 450 + bonus kedalaman.

HP awal 4 (+1 per Belut Listrik berikutnya). Panjang urutan 4 + jumlah urutan yang sudah berhasil + round (maks. 8); Belut Listrik berikutnya juga lebih cepat (`roundSpeedup`). Huruf yang mirip satu sama lain (i, l, q) tidak dipakai. Gambarnya ada di `eelRender.ts`.

### Siren (`SIREN` di `config.ts`)

Bos keempat (800 m). Dua fase bergantian; selama pertarungan tidak ada ikan atau bonus yang muncul dan penyelam berhenti turun.

1. **Peringatan.** Banner "NYANYIAN DARI KEDALAMAN"; Siren masuk setelah ikan berbahaya yang tersisa habis.
2. **Bernyanyi (ketik terbalik).** Siren melepas **Nada** (not musik) berisi kata, paling banyak `maxNotes` sekaligus. Kata ditampilkan biasa (misalnya `laut`) tapi harus diketik **dari belakang** (`tual`); huruf yang sudah benar menyala kuning dari ujung kanan, dan di atas label ada tanda "◂ ketik dari belakang".
   - Penguncian sama seperti ikan biasa, tetapi memakai huruf **terakhir** kata. Nada baru dipilih supaya huruf terakhirnya tidak sama dengan Nada lain di layar.
   - Nada habis diketik: suaranya memantul ke Siren, HP −1. Nada yang sampai ke penyelam: −1 hati.
   - Di mesin, kata Nada disimpan sudah terbalik (urutan ketik), jadi aturan mengetik biasa tetap dipakai; hanya label yang menampilkannya terbalik (`reversed` di `ENEMIES`).
3. **Jeritan (menghindar dengan kontrol terbalik).** Saat HP turun melewati 2/3 dan 1/3 (`dodgeAt`, ditandai di bar HP), Nada di layar lenyap, Siren menjerit (`charge` detik peringatan), lalu fase menghindar selama `dodge` detik (+1 per Siren berikutnya):
   - Penyelam berenang bebas seperti di Arus Gua, tetapi **kontrolnya terbalik**: ↑ jadi ↓, ← jadi →, begitu juga WASD; sentuhan dicerminkan terhadap penyelam. Layar diberi tepi ungu dan tanda "KONTROL TERBALIK" dengan sisa waktu.
   - Serangan bergantian tiap `patternEvery` detik: **dinding gelombang suara** setinggi layar dengan satu celah (celah berikutnya paling jauh 220 px dari sebelumnya), dan **semburan not** yang diarahkan ke posisi penyelam.
   - Terkena: −1 hati, kebal `grace` detik.
4. **Trisula.** Kalau fase menghindar dilewati **tanpa terkena**, trisula emas muncul jauh dari penyelam. Ambil dalam `powerTime` detik (kontrol masih terbalik): trisula dilempar ke Siren, HP −`powerDamage`. Kalau sempat terkena, atau trisula tidak terambil, tidak ada serangan.
5. Penyelam kembali ke posisinya dan Siren bernyanyi lagi. HP habis: Siren tenggelam, banner "SIREN TERDIAM!", skor 500 + bonus kedalaman.

HP awal 12 (+3 per Siren berikutnya). Siren berikutnya: kata lebih panjang (sampai 8 huruf), Nada lebih cepat, gelombang lebih cepat dengan celah lebih sempit, dan semburan not lebih banyak. Mengetik, Backspace, dan Sonar tidak berlaku selama fase menghindar dan trisula. Gambarnya ada di `sirenRender.ts`.

### Arus Gua (`CAVE` di `config.ts` dan `cave.ts`)

Event tanpa mengetik: penyelam berhenti turun dan berenang **mendatar** melewati terowongan gua yang dibuat acak, sambil digerakkan pemain.

1. **Peringatan.** Banner "ARUS GUA DI DEPAN". Kemunculan berhenti; gua baru dimulai setelah semua ikan berbahaya di layar habis (minimal `warning` detik). Bonus yang masih naik ikut hilang saat gua dimulai.
2. **Di dalam gua.** Layar bergulir ke kiri (`speed`, naik dengan kedalaman). Penyelam bebas bergerak ke 4 arah:
   - Keyboard: **← ↑ → ↓**, atau **W A S D** (WASD hanya berlaku saat penyelam bergerak bebas, yaitu di gua dan saat menghindari Siren; di luar itu huruf tetap dipakai mengetik).
   - Layar sentuh/mouse: tahan dan geser; penyelam berenang menuju titik itu.
   - Mengetik, Backspace, dan Sonar tidak berlaku. Bar HUD menampilkan kemajuan gua, jumlah mutiara, dan berapa kali tergores.
3. **Terowongan** dibuat dari titik kerangka tiap `segment` px: pusat celah bergeser acak (`maxStep`), lebar celah menyempit dari `gapStart` ke `gapEnd` (lebih sempit di kedalaman, minimal `minGap`). Mulut gua di awal dan akhir terbuka lebar. **Dinding padat**: menyentuhnya mengambil 1 hati dan penyelam terdorong keluar.
4. **Penghuni gua** (jaraknya minimal `spacing` titik; lebih rapat mulai gua ke-3, lebih jarang di gua pertama):

| Rintangan | Perilaku |
|---|---|
| Belut Moray | Bersembunyi di lubang dinding, terlihat dari sepasang **mata kuning berkilat**. Saat penyelam ±1 detik lagi sampai, ia mengintip lalu **menerjang keluar** menutup ±sepertiga celah (`moray.reach`), bertahan sebentar, lalu masuk lagi. Hindari dengan berenang ke sisi seberang. |
| Bulu Babi | Diam; menempel di dinding atau melayang di celah. |
| Ubur-ubur Api | Naik-turun di tengah celah. |
| Mutiara emas | +30 skor (dikali kombo). |
| Gelembung oksigen | Satu per gua, di paruh kedua: +1 hati (skor kalau hati penuh). |

5. **Tergores** = −1 hati, lalu kebal `grace` detik (penyelam berkedip) supaya sempat keluar dari bahaya. Tabrakan rintangan sedikit memaafkan (badan penyelam dihitung 80%).
6. **Keluar gua.** Bonus (`bonus` + kedalaman × `bonusPerMeter`); **tanpa tergores: bonus ×2 dan +1 Sonar**. Penyelam kembali ke posisinya lalu lanjut turun.

Gua punya pencahayaan sendiri (gelap kecuali di sekitar lampu penyelam); cahaya hayati latar disembunyikan selama di gua supaya ubur-ubur hiasan tidak dikira rintangan. Gambarnya ada di `caveRender.ts`.

### Suasana latar (`ambience.ts`)

Hiasan saja, tidak memengaruhi permainan, dan ditentukan dari kedalaman + waktu (tanpa state tambahan). Benda-bendanya bergulir ke atas dengan kecepatan berbeda per lapisan (parallax), jadi penyelam terasa turun.

- **Semua zona:** dinding palung dua lapis di kiri dan kanan, salju laut, dan vinyet halus supaya bagian tengah (tempat ikan dan kata) lebih menonjol.
- **Dangkal (± 0–230 m):** permukaan laut di detik-detik awal, jaring cahaya kaustik, sinar matahari, rumput laut yang bergoyang, dan karang warna-warni di dinding. Kawanan ikan kecil melintas di kejauhan.
- **Senja:** paus raksasa melintas pelan (± 120–340 m). Bangkai kapal terlihat di 190 m, 760 m, dan 1450 m.
- **Gelap (mulai ± 180 m, makin kuat ke bawah):** digambar di atas lapisan kegelapan, yaitu plankton berkelip, ubur-ubur bercahaya, kristal di dinding, kawanan ikan lentera, dan kontur tipis dinding palung. Di Zona Abisal ada umpan ikan sungut ganda yang berkedip di kejauhan.
- **Palung Hadal (± 900 m ke bawah):** celah magma menyala di dinding dan semburan gelembung dari ventilasi hidrotermal di dasar.

### Skor, WPM, dan akurasi

- Skor per musuh = (skor dasar + kedalaman × `DEPTH_POINTS`) × pengali kombo. Musuh yang dihancurkan Sonar tidak memakai pengali.
- **Kombo** = kata beruntun tanpa salah ketik dan tanpa terkena: ×2 mulai 10, ×3 mulai 25, ×4 mulai 50 (`COMBO_STEPS`).
- **WPM** = huruf benar ÷ 5 ÷ menit bermain (waktu jeda tidak dihitung).
- **Akurasi** = huruf benar ÷ semua huruf yang diketik.

### Menambah kata dan menyetel game

- **Kata:** tambahkan ke `WORDS` di `src/palung/words.ts`. Mesin otomatis memakai kata itu untuk jenis ikan yang rentang panjangnya cocok. Hanya huruf a–z tanpa spasi; kata lain dan duplikat dibuang (`clean`). Frasa Kraken ada di `BOSS_PHRASES` (kata misil diambil dari `WORDS` sesuai panjangnya), kata bonus di `BONUS_WORDS`, huruf Teri di `LETTERS`.
- **Angka keseimbangan:** semuanya di `src/palung/config.ts` (kecepatan, skor, hati, Sonar, zona, kurva kesulitan, jadwal kejadian, urutan bos, Megalodon, Belut Listrik, Siren, Arus Gua, kombo).
- **Jenis ikan baru:** tambahkan ke `EnemyKind` dan `ENEMIES` (config.ts), beri bobot di `difficultyAt`, lalu gambarnya di `drawEnemy` (render.ts).

### Teknis

- **Game loop:** `requestAnimationFrame` di `PalungGame.tsx` memanggil `update(state, dt)` (dt dibatasi 0,05 detik) lalu `render`. State permainan diubah langsung (bukan disalin) karena berjalan 60× per detik; React hanya dipakai untuk layar di luar kanvas (beranda, jeda, ringkasan).
- **Ukuran:** tinggi dunia tetap 540 satuan; lebarnya mengikuti rasio layar (560–1100), lalu kanvas diperbesar agar pas dan tajam di layar ber-DPI tinggi.
- **Input:** ketikan ditangkap oleh `<input>` tersembunyi yang selalu difokus. Tombol panah/WASD untuk Arus Gua dibaca dari `keydown`/`keyup` input yang sama (`steer`), sentuhan dari pointer event area permainan (`setPointer`); semuanya dilepas saat dijeda. Keyboard fisik diproses di `keydown`; keyboard virtual HP (yang sering mengirim tombol "Unidentified") diproses lewat `input`. Kalau fokus hilang atau tab disembunyikan, game otomatis dijeda. **Esc** menjeda/melanjutkan.
- **Mode pengembangan:** `window.__palung` berisi state permainan untuk dibaca dari konsol atau tes browser; tidak ikut di build produksi.

### Batasan

- Butuh keyboard. Di HP bisa dimainkan dengan keyboard virtual, tapi layarnya sempit dan teks kanvas jadi kecil.
- Kata hanya bahasa Indonesia, tanpa spasi atau tanda baca.
- Belum ada musik khusus PALUNG (pemutar musik situs tetap bisa dipakai) dan belum ada papan skor online.

### Struktur folder

```
src/palung/
  config.ts        Angka keseimbangan: dunia, hati, Sonar, musuh, zona, kesulitan, kejadian, Megalodon, Belut Listrik, Siren, Arus Gua, kombo
  words.ts         Daftar kata, frasa Kraken, kata bonus, huruf Teri
  engine.ts        State dan aturan: kemunculan, penguncian, tabrakan, Megalodon (misil, pantulan, QTE), Belut Listrik (urutan, bola listrik), Siren (kata terbalik, menghindar, trisula), Arus Gua, skor, WPM, akurasi (tanpa DOM)
  render.ts        Menggambar penyelam, ikan, Megalodon dan misil, efek, label kata, HUD, banner, layar QTE (Canvas)
  cave.ts          Arus Gua: pembuatan terowongan acak, rintangan, tabrakan (data murni)
  eelRender.ts     Menggambar Belut Listrik: badan belut, bola listrik berhuruf, petir, panel urutan
  sirenRender.ts   Menggambar Siren: badan, Nada, gelombang dan not serangan, trisula, tanda kontrol terbalik
  caveRender.ts    Menggambar Arus Gua: dinding batu, belut, bulu babi, ubur-ubur, mutiara, cahaya gua
  ambience.ts      Suasana latar per zona (dinding palung, karang, paus, bangkai kapal, cahaya hayati)
  sfx.ts           Efek suara Web Audio
  PalungGame.tsx   Kanvas, game loop, input keyboard, jeda
  PalungApp.tsx    Beranda, panduan, ringkasan, rekor, tema
  palung.css       Semua gaya PALUNG
src/assets/palung-favicon.svg
```

## 17. Game LABIRIN

Balapan labirin online untuk 2–8 pemain, tiap pemain di perangkatnya sendiri. Semua pemain masuk labirin yang sama dari tepi yang berbeda; yang pertama mencapai portal di tengah menang. Ada juga mode **Latihan** sendirian tanpa jaringan, dengan rekor waktu per ukuran labirin (disimpan di `localStorage`, kunci `labirin-best`).

Dibuat dari brief `MAZE_MULTIPLAYER_RACE_CLAUDE_PROMPT.md`, disesuaikan dengan template projek ini:

| Brief | Di projek ini |
|---|---|
| Struktur `src/game/`, `src/multiplayer/`, `components/MainMenu`… | Satu folder `src/labirin/` seperti game lain (`src/game/` sudah dipakai mahjong) |
| `WebRTCManager`, `SignalingManager` baru | Memakai ulang PeerJS + `net/ice.ts` (STUN bawaan, TURN opsional lewat `VITE_TURN_*`) dan pola `HostRoom`/`GuestRoom` game lain |
| Menu Settings | Pengaturan ukuran labirin di lobi (host) |
| Musik berlisensi | Pemutar musik situs yang sudah ada; efek suara Web Audio |
| Nama "MAZE RACE" | LABIRIN |

### Alur

1. **Room.** Host membuat room (kode 5 karakter, juga bisa dibagikan sebagai link `?game=labirin&room=KODE`). Lobi menampilkan 8 slot dengan warna tiap pemain, tanda host, status Siap, dan status koneksi.
2. **Mulai.** Host bisa mulai kalau ada minimal 2 pemain tersambung dan semua tamu sudah menekan **Siap**. Host memilih ukuran labirin: Kecil 13×13, Sedang 17×17, Besar 21×21 sel. Ukuran dinaikkan otomatis kalau pemainnya banyak (`sizeFor`): 5–6 pemain minimal Sedang, 7–8 pemain selalu Besar, supaya rute tiap pemain bisa dibuat sama panjang.
3. **Hitung mundur** 3, 2, 1, GO! (3,5 detik), lalu semua bergerak bersamaan dengan **WASD** atau **tombol panah**.
4. **Balapan.** Labirin gelap: hanya sekitar pemain yang terang, lorong yang sudah dilewati tetap terlihat redup. Pemain lain selalu terlihat (dengan nama), juga di minimap kanan bawah. Portal pintu keluar bercahaya menembus kegelapan, dan panah di tepi layar menunjuk ke arahnya. Pemain tidak saling menghalangi.
5. **Selesai.** Host menentukan pemenang lalu semua layar menampilkan hasil: pemenang (warna dan nama), urutan akhir dengan waktu finis atau sisa jarak (ubin), dan labirin lengkap tanpa kabut. Host memilih **Main lagi** (labirin baru dengan pemain yang masih tersambung) atau **Kembali ke lobi**.

### Labirin (`maze.ts`)

- **Seed.** Host membuat seed acak tiap pertandingan dan hanya mengirim seed, ukuran, jumlah pemain, dan `checksum`. Tiap perangkat membuat labirin sendiri dengan PRNG mulberry32 (hasil sama di semua browser), lalu mencocokkan checksum (FNV-1a atas ubin dan spawn); kalau berbeda, tamu berhenti dengan pesan "Labirin tidak sama".
- **Algoritma.** Recursive backtracker menghasilkan lorong panjang berliku tanpa area terputus (setiap sel terjangkau). Lalu ±14% jalan buntu dibuka ke tetangganya (*braiding*) supaya ada beberapa rute dan pemain tidak sekadar mengekor yang di depan. 3×3 sel di tengah dijadikan alun-alun dengan portal. Prim/Kruskal tidak dipilih karena menghasilkan banyak jalan buntu pendek yang terasa acak untuk balapan.
- **Spawn adil.** Jarak BFS dari portal dihitung ke semua ubin. Sel di cincin terluar dibagi ke sektor sudut sebanyak jumlah pemain (diputar acak; sel di batas sektor dilewati supaya spawn tidak berdekatan). Dicari satu jarak target, lalu di tiap sektor dipilih sel dengan jarak paling dekat ke target itu; rute lebih pendek dari 3 ubin per sel sisi dihindari (tidak ada spawn di dekat portal). Kalau selisih jarak spawn > 6%, labirin dibuat ulang (deterministik, sampai 80 percobaan, diambil yang terbaik; paling lama ±25 ms). Urutan spawn diacak supaya host tidak selalu di sudut yang sama.

Hasil uji 150 seed per kombinasi (selisih rute terpanjang–terpendek):

| Pemain | Kecil | Sedang | Besar |
|---|---|---|---|
| 2–4 | median 0%, maks 6% | median 0%, maks 6% | median 0%, maks 6% |
| 6 | (dinaikkan ke Sedang) | median 3%, maks 11% | median 2%, maks 6% |
| 8 | (dinaikkan ke Besar) | (dinaikkan ke Besar) | median 7,5%, p95 13,5% |

### Gerakan (`sim.ts`)

- Simulasi langkah tetap 60× per detik, fungsi yang sama di host dan tamu. Kecepatan 4,6 ubin/detik; diagonal dinormalkan.
- Kotak tabrakan pemain 0,6×0,6 ubin di lorong selebar 1 ubin. Gerak per sumbu (X lalu Y) dan berhenti tepat di tepi dinding; satu langkah < 0,1 ubin, jadi tidak bisa menembus dinding.
- **Bantuan sudut:** kalau pemain terhalang padahal lorong di depannya terbuka, ia digeser ke tengah lorong supaya tidak tersangkut di ujung dinding.
- Diuji dengan bot yang mengikuti rute BFS di 60 labirin Besar × 8 spawn: selalu sampai, tidak pernah berada di dalam dinding, dan waktunya sesuai jarak rute.

### Jaringan (`net.ts`)

Topologi bintang dengan host berwenang, lewat PeerJS seperti game online lain (server PeerJS hanya mempertemukan; data lewat WebRTC langsung). ID room `labirin-claude-room-KODE`, jadi kode room game lain tidak bisa dipakai di sini.

**Pesan** (semua membawa `v: 1`, versi protokol; versi berbeda ditolak dengan pesan "muat ulang halaman"):

| Arah | Pesan | Isi | Kapan |
|---|---|---|---|
| Tamu → host | `join` | nama, token (kembali ke kursi yang sama setelah refresh) | sekali |
| Tamu → host | `ready` | siap/belum | di lobi |
| Tamu → host | `input` | id pertandingan, nomor langkah pertama, tombol arah per langkah | tiap 50 ms saat balapan |
| Dua arah | `ping` | – | tiap 2 detik kalau tidak ada pesan lain |
| Host → tamu | `sync` | lobi (pemain, warna, siap, tersambung, kemenangan, ukuran) + info pertandingan (seed, ukuran, checksum, daftar pembalap, fase, sisa hitung mundur, hasil) | saat berubah |
| Host → tamu | `state` | posisi semua pembalap (bilangan bulat ×1000), langkah terakhir pembalap penerima yang sudah dijalankan host, siapa yang sudah sampai | 20× per detik saat balapan |
| Host → tamu | `rejected` | `full` / `started` / `version` | saat bergabung |

Labirin tidak pernah dikirim. Satu `state` untuk 8 pemain ±200 byte, jadi host mengirim ±4 KB/detik per tamu.

**Sinkronisasi gerakan:**
- Tamu hanya mengirim tombol arah per langkah simulasi, tidak pernah posisi. Host menjalankan langkah-langkah itu berurutan dengan `sim.ts`. Langkah yang sudah dijalankan diabaikan; langkah yang terlewat (mis. setelah terputus) dianggap diam.
- **Batas waktu nyata:** host tidak menjalankan langkah tamu yang lebih dari 20 langkah (±0,33 detik) di depan jamnya sendiri. Tamu yang mengirim input "dari masa depan" tetap tidak bisa bergerak lebih cepat (diuji: input 5 detik sekaligus hanya menggerakkan ±1,5 ubin dalam 0,6 detik).
- **Prediksi:** tamu menggerakkan dirinya sendiri langsung (tanpa menunggu host). Saat `state` datang, posisinya diganti posisi host lalu input yang belum diakui dijalankan ulang di atasnya; selisih kecil dihaluskan ±100 ms supaya tidak melompat. Diuji: setelah berhenti, posisi menurut tamu dan host sama persis.
- **Interpolasi:** pemain lain digambar ±120 ms di belakang, di antara dua posisi terakhir dari host, supaya halus walau posisi datang 20× per detik.
- **Pembalap host** dijalankan langsung oleh jam host. Simulasi host berjalan di `setInterval` 60×/detik terpisah dari gambar.
- Tab yang sempat tidur tidak boleh "berlari" mengejar: lebih dari 30 langkah tertinggal dianggap diam.

**Pemenang:** hanya host yang menentukan; tidak ada pesan tamu untuk menyatakan menang (diuji: pesan `win`/`result` palsu diabaikan). Waktu finis tiap pemain = jumlah langkahnya sendiri × 1/60 detik, jadi adil walau latensi tiap pemain berbeda. Finis pertama yang diterima host membuka jendela 300 ms untuk finis yang hampir bersamaan, lalu pemenang (waktu finis terkecil) dikunci, pertandingan dibekukan, dan hasil dikirim ke semua.

**Putus koneksi:**
- WebRTC bisa butuh ±30 detik untuk menyadari perangkat lain menutup tab, jadi ada **heartbeat**. Tamu yang tidak terdengar 6 detik ditandai "terputus" (di lobi, HUD, dan hasil); host yang tidak terdengar 8 detik dianggap hilang.
- Tamu terputus saat balapan: pembalapnya diam di tempat, balapan lanjut. Ia bisa masuk lagi (refresh) ke kursi yang sama dan melanjutkan dari posisinya. Pemain yang masih terputus dilepas saat Main lagi atau kembali ke lobi.
- Host keluar: semua tamu melihat "Koneksi ke host terputus" dan tombol kembali ke menu. Tidak ada perpindahan host.
- Pemain baru tidak bisa masuk saat balapan berjalan (`started`); maksimal 8 pemain (`full`).

### Tampilan (`render.ts`, `RaceView.tsx`)

- Labirin digambar sekali ke kanvas cadangan (32 px per ubin); tiap frame hanya bagian yang terlihat disalin. Kamera mengikuti pemain sendiri (±13 ubin tinggi layar).
- Kabut: lapisan per ubin (belum dijelajahi = gelap total, sudah = redup) dengan lubang cahaya bertepi lembut di sekitar pemain. Status jelajah hanya di perangkat itu sendiri.
- Warna 8 pemain (`COLORS`) sama di lobi, HUD, kanvas, minimap, dan hasil.
- Hitung mundur dan pewaktu ditulis langsung ke DOM dari loop gambar (tanpa render ulang React tiap frame).
- Mode pengembangan: `window.__labirin` (labirin dan posisi terakhir) dan `window.__labirinGuest` (room tamu) untuk tes browser; tidak ikut build produksi.

### Pengujian

| # | Skenario | Hasil |
|---|---|---|
| 1–2 | Host membuat room, 2 tamu bergabung | Lolos |
| 3–4 | 8 pemain bergabung; pemain ke-9 ditolak "Room sudah penuh" | Lolos |
| 5–6 | Semua perangkat membuat labirin yang sama (checksum sama di 3 dan 8 perangkat) | Lolos |
| 7 | Mulai bersamaan (GO di tiap perangkat selisih ±15 ms) | Lolos |
| 8–9 | Gerakan sinkron dan halus; posisi tamu = posisi host setelah berhenti | Lolos |
| 10–11 | Tidak menembus dinding/keluar labirin (bot di 480 rute + dorong ke dinding) | Lolos |
| 12–13 | Pemenang pertama sama di semua layar, hasil langsung muncul | Lolos |
| 14 | Tamu menutup tab saat balapan: ditandai terputus, balapan lanjut | Lolos |
| 15 | Host menutup tab: tamu melihat pesan host terputus | Lolos |
| – | Tamu refresh di tengah balapan: kembali ke kursi dan posisinya, lalu bisa bergerak lagi | Lolos |
| 16–17 | Main lagi: labirin baru, pemain terputus dilepas | Lolos |
| 18 | Tamu tidak bisa menyatakan diri menang / mempercepat gerak | Lolos |
| – | Mode Latihan, 60 FPS, rekor tersimpan | Lolos |

Diuji dengan beberapa jendela browser terpisah (Playwright) di satu komputer. Uji antarperangkat fisik dan jaringan seluler belum dilakukan.

### Batasan

- **Kecurangan oleh host:** host yang menjalankan simulasi, jadi host bisa curang (mis. mengubah kodenya). Wajar untuk main bersama teman; tidak ada jaminan anti-curang yang kuat tanpa server.
- **Tab host harus tetap terbuka di depan:** browser memperlambat timer di tab yang tersembunyi, jadi posisi pemain lain tersendat kalau host pindah tab.
- **Jaringan:** sama dengan game online lain: butuh internet untuk server PeerJS, dan jaringan yang memblokir koneksi langsung (data seluler/CGNAT, WiFi kantor) butuh server TURN (`VITE_TURN_*`). Semua pesan lewat kanal *reliable*; di jaringan dengan banyak paket hilang, posisi bisa tersendat sesaat.
- **Pesan rusak dari tamu nakal** (mis. `null`) memunculkan galat di dalam PeerJS di konsol host; permainan tetap berjalan.
- Desktop saja (keyboard); belum ada kontrol sentuh. Belum ada migrasi host.

### Struktur folder

```
src/labirin/
  maze.ts          Labirin dari seed: backtracker + braiding, BFS, spawn adil, checksum (tanpa DOM)
  sim.ts           Gerakan langkah tetap, tabrakan dinding, bantuan sudut, deteksi portal (tanpa DOM)
  net.ts           Room PeerJS host/tamu, protokol, prediksi, interpolasi, heartbeat
  render.ts        Kanvas: labirin, kabut, portal, pemain, minimap
  RaceView.tsx     Layar balapan: keyboard, loop gambar, hitung mundur, HUD
  LabirinApp.tsx   Beranda, Latihan, lobi, hasil, tema
  sfx.ts           Efek suara Web Audio
  labirin.css      Semua gaya LABIRIN
src/assets/labirin-favicon.svg
```
