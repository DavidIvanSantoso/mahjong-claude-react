// Pemeriksa kamus KA-BOOM! (public/words/<bahasa>/).
//
//   npm run words          periksa semua kategori lalu tulis ulang index.json
//   npm run words -- --check   hanya periksa (dipakai saat build); gagal kalau index.json belum diperbarui
//
// Tiap file kategori: { "id": "<nama file tanpa .json>", "name": "Nama Tampilan", "group": "opsional", "words": ["kata", ...] }
// "group": kategori yang mirip (mis. hewan, ikan, burung) diberi grup sama supaya tidak muncul berturut-turut.
// "disabled": true menyembunyikan kategori dari permainan (tidak masuk index.json), isinya tetap diperiksa.
// Kata ditulis huruf kecil, hanya huruf/angka dengan spasi atau tanda hubung di antaranya.
// Kata yang sama setelah tanda hubung dianggap spasi ("kuda-nil" = "kuda nil") dihitung ganda.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const LANGUAGE = 'id'
const DIR = join('public', 'words', LANGUAGE)
const MIN_WORDS = 30
const WORD = /^[a-z0-9]+(?:[ -][a-z0-9]+)*$/
const check = process.argv.includes('--check')

const errors = []
const warnings = []
const categories = []
const disabled = []

for (const file of readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== 'index.json').sort()) {
  const id = file.replace(/\.json$/, '')
  let data
  try {
    data = JSON.parse(readFileSync(join(DIR, file), 'utf8'))
  } catch (error) {
    errors.push(`${file}: JSON tidak valid (${error.message})`)
    continue
  }
  if (data.id !== id) errors.push(`${file}: "id" harus "${id}" (sama dengan nama file)`)
  if (typeof data.name !== 'string' || !data.name.trim()) errors.push(`${file}: "name" kosong`)
  if (!Array.isArray(data.words)) {
    errors.push(`${file}: "words" harus berupa daftar`)
    continue
  }
  const seen = new Map()
  for (const word of data.words) {
    if (typeof word !== 'string' || !WORD.test(word)) {
      errors.push(`${file}: kata tidak valid ${JSON.stringify(word)} (huruf kecil, tanpa tanda baca, tanpa spasi ganda)`)
      continue
    }
    const key = word.replace(/-/g, ' ')
    if (seen.has(key)) errors.push(`${file}: "${word}" ganda dengan "${seen.get(key)}"`)
    else seen.set(key, word)
  }
  if (data.group !== undefined && (typeof data.group !== 'string' || !/^[a-z0-9-]+$/.test(data.group))) {
    errors.push(`${file}: "group" harus huruf kecil tanpa spasi, mis. "hewan"`)
  }
  if (data.disabled !== undefined && typeof data.disabled !== 'boolean') errors.push(`${file}: "disabled" harus true atau false`)
  if (data.words.length < MIN_WORDS) warnings.push(`${file}: hanya ${data.words.length} kata (disarankan minimal ${MIN_WORDS})`)
  if (data.disabled) {
    disabled.push(id)
    continue
  }
  categories.push({ id, name: data.name, ...(data.group ? { group: data.group } : {}), file, count: data.words.length })
}

categories.sort((a, b) => a.name.localeCompare(b.name, 'id'))
const index = `${JSON.stringify({ language: LANGUAGE, categories }, null, 2)}\n`
const indexPath = join(DIR, 'index.json')
let current = ''
try {
  current = readFileSync(indexPath, 'utf8')
} catch {
  // Belum ada index.json.
}

warnings.forEach((w) => console.warn(`peringatan: ${w}`))
if (errors.length) {
  errors.forEach((e) => console.error(`galat: ${e}`))
  console.error(`\n${errors.length} galat ditemukan di kamus ${DIR}.`)
  process.exit(1)
}

if (current !== index) {
  if (check) {
    console.error(`index.json belum sesuai dengan isi ${DIR}. Jalankan "npm run words" lalu commit hasilnya.`)
    process.exit(1)
  }
  writeFileSync(indexPath, index)
  console.log('index.json diperbarui.')
}
const total = categories.reduce((sum, c) => sum + c.count, 0)
console.log(`Kamus ${LANGUAGE}: ${categories.length} kategori, ${total} kata.`)
if (disabled.length) console.log(`Dinonaktifkan (${disabled.length}): ${disabled.join(', ')}`)
