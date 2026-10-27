# Dokumentasi Mahjong

Game mahjong 2D untuk 2–4 pemain, dibuat dengan React dan TypeScript. Bisa dimainkan bergantian di satu perangkat, atau online lewat room (PeerJS) dengan tiap pemain di perangkatnya sendiri.

Situs yang sama juga memuat game kartu **UNO** (online, 2–6 pemain; [bagian 11](#11-game-uno)) **Capsa** (online, 2–4 pemain; [bagian 12](#12-game-capsa)), dan **KA-BOOM!** (online, 2–6 pemain; [bagian 13](#13-game-ka-boom)). Navbar di pojok kiri atas homescreen dipakai untuk berpindah game.

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
    GameNav.tsx            Navbar pemilih game (Mahjong / UNO / Capsa / KA-BOOM!) di homescreen
  net/                     Mode online
    online.ts              Bentuk pesan, kode room, penyaringan state per pemain
    rooms.ts               Kelas HostRoom dan GuestRoom, plus hook React-nya
  uno/                     Game UNO (lihat bagian 11)
  capsa/                   Game Capsa (lihat bagian 12)
  bomkata/                 Game KA-BOOM! (lihat bagian 13)
public/words/id/           Kamus kata KA-BOOM! (JSON)
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

1. Setiap ronde, sebuah kategori diundi (animasi mesin slot), misalnya Hewan atau Buah. Sekitar 40% ronde mendapat tantangan tambahan (lihat *Tantangan* di bawah), misalnya "Buah berakhiran A".
2. Bom di tengah mulai berdetak dengan durasi acak tersembunyi (12–30 detik). Panah di bom menunjuk pemain yang memegangnya.
3. Pemegang bom mengetik kata dari kategori itu. Kata benar memindahkan bom ke pemain hidup berikutnya searah jarum jam. Kata salah atau sudah dipakai di ronde itu ditolak, dan bom tetap di tangannya.
4. Waktu bom tidak pernah ditampilkan sebagai angka. Makin dekat ledakan, kedipan dan bunyi detaknya makin cepat (tingkat `heat` 0–3: sisa >12, ≤12, ≤6, ≤2,5 detik).
5. Saat meledak, pemegang bom kehilangan 1 nyawa. Kategori baru diundi, dan ronde berikutnya dimulai dari pemain hidup sesudahnya.
6. Pemain terakhir yang masih punya nyawa menang. Jumlah kemenangan dicatat selama room dibuka.

Pemain lain bisa melihat huruf yang sedang diketik pemegang bom secara langsung.

### Undian kategori (`src/bomkata/rounds.ts`)

Supaya kategori tidak sering berulang, host memakai **kantong acak** (*shuffle bag*):

- Semua kategori dikocok ke dalam kantong, lalu diambil satu per ronde sampai habis. Baru setelah itu kantong diisi dan dikocok lagi. Jadi dalam satu siklus (59 ronde) tiap kategori keluar tepat sekali.
- Kategori yang muncul dalam `RECENT_WINDOW` (10) ronde terakhir dilewati dulu, juga saat kantong baru diisi ulang. Jarak minimal sebuah kategori muncul lagi adalah 11 ronde.
- Kategori boleh punya `group` (mis. `hewan` untuk Hewan, Ikan, Burung, Serangga). Dua kategori segrup tidak diundi berturut-turut, supaya Ikan tidak langsung muncul setelah Hewan.
- Urutan prioritasnya ada di `drawFromBag`: bukan yang baru muncul dan beda grup → bukan yang baru muncul → beda grup → apa saja selain kategori sebelumnya.

### Tantangan

Dengan peluang `TWIST_CHANCE` (40%), kategori ronde itu diberi syarat tambahan yang dipilih acak dari `twistOptions`:

- **berawalan "X"**, mis. "Hewan berawalan K"
- **berakhiran "X"**, mis. "Buah berakhiran A"
- **minimal N huruf** (N = 6–10, spasi tidak dihitung)

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
- Kamus berisi 59 kategori (4.908 kata), dikelompokkan per grup:
  - **hewan:** Hewan, Ikan, Burung, Serangga & Hewan Kecil.
  - **makanan:** Buah, Sayuran, Makanan Khas Indonesia, Makanan Internasional, Kue & Jajanan, Minuman, Bumbu & Rempah, Bahan Makanan.
  - **geografi:** Negara, Ibu Kota Negara, Kota di Indonesia, Provinsi di Indonesia, Pulau di Indonesia, Gunung di Indonesia, Sungai & Danau di Indonesia.
  - **benda:** Benda di Rumah, Bagian Rumah, Elektronik & Gadget, Alat Sekolah, Alat Kantor, Perkakas & Alat Pertukangan, Bahan Bangunan, Kosmetik & Perawatan Diri.
  - **kegiatan:** Olahraga, Peralatan Olahraga, Hobi, Kegiatan Sehari-hari.
  - **kendaraan:** Kendaraan, Bagian Kendaraan. **tubuh:** Anggota Tubuh, Penyakit & Gejala. **sifat:** Perasaan & Emosi, Sifat & Karakter. **pakaian:** Pakaian & Aksesori, Jenis Kain. **budaya:** Tarian Daerah, Suku Bangsa Indonesia, Bahasa.
  - **Tanpa grup:** Alam & Cuaca, Alat Musik, Anggota Keluarga, Bentuk & Bangun, Bunga & Tanaman, Hantu & Makhluk Mitos, Logam & Batu Mulia, Luar Angkasa, Mata Pelajaran, Mata Uang, Nama Hari & Bulan, Pekerjaan, Permainan Tradisional, Senjata, Tempat & Bangunan, Tokoh Wayang, Warna.
  - Sebagian kategori sengaja beririsan (mis. Hewan dengan Ikan dan Burung), karena tiap ronde hanya memakai satu kategori. Kategori yang beririsan sebaiknya diberi `group` yang sama.
- **Penulisan kata:** huruf kecil. Frasa memakai spasi ("kuda nil"); kata ulang memakai tanda hubung ("kupu-kupu"). Ejaan lain yang umum boleh ditambahkan sebagai kata terpisah (mis. "cabai" dan "cabe", "kaos" dan "kaus").

**Menambah atau mengubah kategori:**

1. Buat atau ubah `public/words/id/<id>.json` dengan format di atas; `id` harus sama dengan nama filenya.
2. Jalankan `npm run words`. Skrip `scripts/words.mjs` memeriksa semua file (JSON valid, `id` cocok, `group` berformat benar, kata huruf kecil tanpa tanda baca, tidak ada kata ganda; kategori di bawah 30 kata diberi peringatan) lalu menulis ulang `index.json` beserta jumlah katanya. Tidak ada kode yang perlu diubah.
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
