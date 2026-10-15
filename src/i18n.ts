import { useSyncExternalStore } from 'react'

/**
 * Bahasa tampilan. Teks ditulis langsung di tempat pemakaiannya dalam dua bahasa,
 * `t('Keluar', 'Leave')`, supaya terjemahannya selalu bersebelahan dengan aslinya.
 *
 * Pilihan bahasa disimpan di luar React. App memanggil `useLang()`, jadi seluruh tampilan
 * dirender ulang saat bahasa berganti, dan fungsi biasa (mis. `tileName`) cukup memanggil `t`.
 */
export type Lang = 'id' | 'en'

export const LANGUAGES: { id: Lang; name: string }[] = [
  { id: 'id', name: 'Bahasa Indonesia' },
  { id: 'en', name: 'English' },
]

const STORAGE_KEY = 'mahjong-lang'

/** Bahasa yang terakhir dipilih di perangkat ini; bawaannya Bahasa Indonesia. */
function savedLang(): Lang {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'id'
  } catch {
    return 'id'
  }
}

let lang = savedLang()
const listeners = new Set<() => void>()
document.documentElement.lang = lang

export function getLang(): Lang {
  return lang
}

export function setLang(next: Lang) {
  lang = next
  document.documentElement.lang = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // localStorage bisa diblokir; pilihannya tetap berlaku selama halaman terbuka.
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang)
}

/** Teks (atau isi JSX) dalam bahasa yang sedang aktif. */
export function t<T>(id: T, en: T): T {
  return lang === 'en' ? en : id
}
