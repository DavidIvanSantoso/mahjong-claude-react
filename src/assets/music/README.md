# Background music

Taruh file musik latar di folder ini. Semua file di sini otomatis masuk ke pemutar musik
di pojok kiri bawah website; tidak ada kode yang perlu diubah.

- Format yang dikenali: `.mp3`, `.ogg`, `.wav`, `.m4a`, `.aac`, `.flac`, `.webm`.
  Yang paling aman untuk semua browser adalah `.mp3`.
- Kalau ada lebih dari satu file, lagu diputar berurutan menurut nama file lalu kembali ke
  awal. Beri awalan angka (`01-...`, `02-...`) untuk mengatur urutannya.
- Nama file (tanpa ekstensi dan awalan angka) tampil apa adanya sebagai judul lagu di pemutar,
  jadi namai dengan judul aslinya, misalnya `Nama Artis - Judul Lagu.mp3`. Garis bawah (`_`)
  ditampilkan sebagai spasi.
- Selama folder ini belum berisi file musik, pemutar musik tidak ditampilkan.
- Setelah menambah atau menghapus file, muat ulang halaman (atau jalankan ulang `npm run dev`
  kalau lagunya belum muncul).

Pastikan musik yang dipakai boleh digunakan (milik sendiri atau berlisensi bebas), karena
file di folder ini ikut dipublikasikan bersama website.
