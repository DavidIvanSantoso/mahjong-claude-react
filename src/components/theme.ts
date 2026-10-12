import { useEffect } from 'react'
import type { Ruleset } from '../game/state'

/**
 * Memasang palet warna sesuai sistem permainan (lihat `:root[data-theme='hk']` di index.css).
 * Saat dilepas, tema sebelumnya dikembalikan: tamu yang masuk ke room dengan sistem lain
 * kembali ke tema pilihannya sendiri begitu keluar.
 */
export function useRulesetTheme(ruleset: Ruleset) {
  useEffect(() => {
    const root = document.documentElement
    const previous = root.dataset.theme
    root.dataset.theme = ruleset
    return () => {
      if (previous === undefined) delete root.dataset.theme
      else root.dataset.theme = previous
    }
  }, [ruleset])
}
