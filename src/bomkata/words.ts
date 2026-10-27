/**
 * Kamus kata KA-BOOM!: file JSON statis di public/words/<bahasa>/, jadi bisa dipakai di GitHub Pages
 * tanpa database. index.json berisi daftar kategori; tiap kategori punya file sendiri supaya kamus
 * yang besar tidak perlu diunduh sekaligus. Hanya host yang mengunduhnya (host yang memeriksa jawaban).
 *
 * Format kategori: { "id": "hewan", "name": "Hewan", "words": ["kucing", "kuda nil", "lumba-lumba"] }
 */
export interface CategoryEntry {
  id: string
  name: string
  /**
   * Kategori yang mirip (mis. Hewan, Ikan, Burung) berbagi grup yang sama, supaya tidak muncul
   * berturut-turut. Kosong berarti kategori itu tidak punya kemiripan dengan yang lain.
   */
  group?: string
  file: string
  count: number
}

export interface Category {
  id: string
  name: string
  words: string[]
}

export const LANGUAGE = 'id'

/** Relatif terhadap halaman (vite `base: './'`), jadi jalan di localhost maupun subfolder GitHub Pages. */
function url(file: string): string {
  return `${import.meta.env.BASE_URL}words/${LANGUAGE}/${file}`
}

export async function loadIndex(): Promise<CategoryEntry[]> {
  const response = await fetch(url('index.json'))
  if (!response.ok) throw new Error(`index.json: ${response.status}`)
  const data = (await response.json()) as { categories: CategoryEntry[] }
  return data.categories.filter((entry) => entry && entry.id && entry.file)
}

const cache = new Map<string, Promise<Category>>()

export function loadCategory(entry: CategoryEntry): Promise<Category> {
  let promise = cache.get(entry.id)
  if (!promise) {
    promise = fetch(url(entry.file)).then(async (response) => {
      if (!response.ok) throw new Error(`${entry.file}: ${response.status}`)
      const data = (await response.json()) as Category
      return { id: entry.id, name: data.name ?? entry.name, words: Array.isArray(data.words) ? data.words : [] }
    })
    // Kalau gagal, jangan disimpan, supaya bisa dicoba lagi.
    promise.catch(() => cache.delete(entry.id))
    cache.set(entry.id, promise)
  }
  return promise
}

/**
 * Bentuk pembanding jawaban: huruf kecil, tanpa aksen dan tanda baca, tanda hubung dianggap spasi,
 * spasi ganda dirapikan. Jadi "Lumba-Lumba", "lumba lumba", dan " LUMBA  LUMBA " dianggap sama.
 */
export function normalizeWord(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[-_]/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
