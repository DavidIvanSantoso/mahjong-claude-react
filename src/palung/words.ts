/**
 * Daftar kata PALUNG. Tambahkan kata baru ke WORDS saja: mesin memilih kata untuk tiap musuh menurut
 * panjangnya (lihat `length` di ENEMIES, config.ts). Hanya huruf a–z tanpa spasi; kata lain diabaikan
 * (lihat `clean`).
 */

/** Huruf untuk ikan Teri (satu huruf). Huruf yang jarang dipakai bahasa Indonesia tidak dimasukkan. */
export const LETTERS = 'abcdefghijklmnoprstuwy'.split('')

export const WORDS: string[] = [
  // Laut dan penyelaman
  'laut', 'ikan', 'hiu', 'pari', 'paus', 'cumi', 'arus', 'gua', 'peta', 'emas', 'koin', 'peti', 'ekor', 'kail', 'jala', 'tali',
  'ubur', 'tuna', 'lele', 'awak', 'zona', 'gigi',
  'ombak', 'pasir', 'karang', 'gurita', 'udang', 'sirip', 'sisik', 'insang', 'umpan', 'pulau', 'teluk', 'selat', 'muara', 'karam',
  'kakap', 'kerapu', 'tongkol', 'bandeng', 'belut', 'sidat', 'pesut', 'dugong', 'penyu', 'anemon', 'kerang', 'jangkar', 'kapal',
  'perahu', 'nelayan', 'jaring', 'pancing', 'selam', 'tabung', 'masker', 'lautan', 'pantai', 'pesisir', 'samudra', 'tanjung',
  'harta', 'kompas', 'badai', 'topan', 'pasang', 'surut', 'gelap', 'dalam', 'dingin', 'cahaya', 'lumpur', 'kawah', 'lorong',
  'rahasia', 'legenda', 'monster', 'raksasa', 'taring', 'rahang', 'mangsa', 'pelaut', 'kapten', 'layar', 'dayung', 'dermaga',
  'tsunami', 'terumbu', 'abisal', 'magma',
  'penyelam', 'menyelam', 'gelembung', 'mercusuar', 'kepiting', 'teripang', 'rajungan', 'cakalang', 'plankton', 'ganggang',
  'vulkanik', 'pemangsa', 'perompak', 'navigasi', 'kedalaman', 'kegelapan', 'bercahaya', 'berkilauan', 'tenggelam', 'terdampar',
  'ekspedisi', 'ekosistem', 'konservasi', 'gelombang', 'pelabuhan', 'petualang', 'petualangan', 'penjelajah', 'misterius',
  'legendaris', 'kepulauan', 'oseanografi', 'samudera', 'nusantara',
  // Sehari-hari
  'api', 'air', 'abu', 'ayam', 'bola', 'buku', 'batu', 'baju', 'jam', 'hari', 'nasi', 'roti', 'susu', 'teh', 'kopi', 'tahu',
  'sate', 'soto', 'kaki', 'mata', 'jari', 'bahu', 'otak', 'doa', 'main', 'lagu', 'drum', 'kota', 'desa', 'awan', 'pagi', 'sore',
  'ungu', 'biru', 'baik', 'lucu', 'kuat', 'cair', 'rusa', 'kuda', 'sapi', 'kera', 'ular', 'beo', 'foto', 'film', 'visi', 'voli',
  'yoyo', 'wol', 'obat', 'opor', 'oleh', 'ide', 'ilmu', 'iris', 'enak', 'elok', 'nada', 'nama', 'dua', 'tiga', 'lima', 'enam',
  'rumah', 'makan', 'minum', 'tidur', 'jalan', 'meja', 'kursi', 'pintu', 'guru', 'murid', 'teman', 'kakak', 'nenek', 'kakek',
  'pasar', 'sawah', 'kebun', 'hutan', 'sungai', 'danau', 'gunung', 'langit', 'hujan', 'angin', 'petir', 'bulan', 'bintang',
  'malam', 'siang', 'waktu', 'tahun', 'merah', 'hijau', 'kuning', 'putih', 'hitam', 'jingga', 'besar', 'kecil', 'panjang',
  'pendek', 'cepat', 'lambat', 'lemah', 'berani', 'takut', 'senang', 'sedih', 'marah', 'pintar', 'rajin', 'malas', 'indah',
  'bersih', 'kotor', 'panas', 'hangat', 'sejuk', 'basah', 'kering', 'gula', 'garam', 'sayur', 'buah', 'apel', 'jeruk', 'mangga',
  'pisang', 'durian', 'nanas', 'kelapa', 'jagung', 'tempe', 'bakso', 'sambal', 'kecap', 'telur', 'daging', 'tangan', 'kepala',
  'hidung', 'mulut', 'telinga', 'rambut', 'lutut', 'perut', 'jantung', 'darah', 'tulang', 'kulit', 'mimpi', 'harapan', 'cinta',
  'rindu', 'janji', 'damai', 'bebas', 'juara', 'menang', 'kalah', 'lompat', 'renang', 'terbang', 'menari', 'papan', 'tombol',
  'huruf', 'kata', 'cerita', 'dongeng', 'puisi', 'musik', 'gitar', 'piano', 'suling', 'gendang', 'wayang', 'batik', 'keris',
  'candi', 'istana', 'benteng', 'menara', 'stasiun', 'bandara', 'mobil', 'motor', 'sepeda', 'kereta', 'pesawat', 'roket',
  'satelit', 'planet', 'galaksi', 'komet', 'meteor', 'bumi', 'dunia', 'negara', 'bendera', 'sejarah', 'budaya', 'bahasa',
  'fajar', 'fakta', 'video', 'vokal', 'warna', 'wajah', 'wangi', 'yakin', 'zaman', 'zebra', 'gajah', 'bebek', 'semut', 'lebah',
  'katak', 'cicak', 'elang', 'gagak', 'harimau', 'singa', 'ombak', 'orang', 'obrol', 'ilham', 'indra', 'emosi', 'nyanyi',
  'matahari', 'semangka', 'keluarga', 'jembatan', 'pahlawan', 'menyanyi', 'berenang', 'membaca', 'menulis', 'belajar', 'bekerja',
  'bermain', 'sekolah', 'jendela', 'pelangi', 'angklung', 'terowongan', 'kehidupan', 'keajaiban', 'keberanian', 'kemenangan',
  'persahabatan', 'perjalanan', 'pertahanan', 'perlindungan', 'penyelamat', 'kesempatan', 'pengetahuan', 'percobaan',
  'permainan', 'pertandingan', 'lingkaran', 'pemandangan', 'perbatasan', 'kebebasan', 'kekuatan', 'kecepatan', 'ketangkasan',
  'konsentrasi', 'ketenangan', 'kesabaran', 'kebahagiaan', 'kerajaan', 'pengembara', 'indonesia', 'universitas', 'komputer',
  'internet', 'aplikasi', 'teknologi', 'informasi', 'ilustrasi', 'imajinasi', 'inspirasi', 'orkestra', 'olahraga', 'organisasi',
  'ekonomi', 'energi', 'astronot', 'arsitek', 'dokter', 'fotografer', 'wartawan', 'yayasan', 'usaha', 'ujian', 'ulangan',
  'undangan', 'upacara', 'gerimis', 'halilintar', 'dinosaurus', 'cenderawasih', 'komodo', 'orangutan', 'rafflesia',
]

/** Frasa penjaga zona (Kraken): kata-katanya diketik berurutan. */
export const BOSS_PHRASES: string[][] = [
  ['penjaga', 'palung', 'bangkit'],
  ['tinta', 'hitam', 'pekat'],
  ['tentakel', 'raksasa', 'mencengkeram'],
  ['jangan', 'turun', 'lebih', 'dalam'],
  ['gelombang', 'pasang', 'datang'],
  ['mata', 'merah', 'menyala', 'di', 'gelap'],
  ['kapal', 'karam', 'tanpa', 'nama'],
  ['harta', 'ini', 'milikku'],
  ['tekanan', 'semakin', 'berat'],
  ['lampu', 'penyelam', 'meredup'],
]

/** Kata untuk Gelembung Oksigen dan Kerang Mutiara. */
export const BONUS_WORDS: Record<'oksigen' | 'mutiara', string[]> = {
  oksigen: ['oksigen', 'udara', 'napas', 'hirup', 'segar', 'lega', 'hidup', 'nyawa', 'pulih'],
  mutiara: ['mutiara', 'permata', 'berlian', 'kilau', 'harta', 'emas', 'safir', 'zamrud', 'rubi'],
}

/** Hanya huruf a–z kecil tanpa spasi; sisanya dibuang dan duplikat dihapus. */
export function clean(words: string[]): string[] {
  return [...new Set(words.map((word) => word.trim().toLowerCase()).filter((word) => /^[a-z]+$/.test(word)))]
}
