/**
 * Papan dan armada Armada Royale. Sel disimpan sebagai indeks (`row * size + col`);
 * label seperti "B3" (kolom huruf, baris angka) hanya untuk tampilan.
 */
export type Cell = number
/** Arah kapal: mendatar (h) atau tegak (v). */
export type Dir = 'h' | 'v'

export interface ShipSpec {
  id: string
  name: string
  size: number
}

/** Posisi satu kapal: sel paling kiri/atas (`cell`) dan arahnya. */
export interface Placement {
  id: string
  cell: Cell
  dir: Dir
}

export type PresetId = 'cepat' | 'normal' | 'panjang'

export interface Preset {
  id: PresetId
  name: string
  size: number
  ships: ShipSpec[]
}

const INDUK: ShipSpec = { id: 'induk', name: 'Kapal Induk', size: 4 }
const PERANG: ShipSpec = { id: 'perang', name: 'Kapal Perang', size: 3 }
const SELAM: ShipSpec = { id: 'selam', name: 'Kapal Selam', size: 3 }
const PERUSAK: ShipSpec = { id: 'perusak', name: 'Perusak', size: 2 }
const PATROLI: ShipSpec = { id: 'patroli', name: 'Patroli', size: 2 }

/** Ukuran papan dan armada per pilihan host; kepadatan kapal dijaga sekitar 30% papan. */
export const PRESETS: Record<PresetId, Preset> = {
  cepat: { id: 'cepat', name: 'Cepat 5×5', size: 5, ships: [PERANG, PERUSAK, PATROLI] },
  normal: { id: 'normal', name: 'Normal 6×6', size: 6, ships: [INDUK, PERANG, PERUSAK, PATROLI] },
  panjang: { id: 'panjang', name: 'Panjang 7×7', size: 7, ships: [INDUK, PERANG, SELAM, PERUSAK, PATROLI] },
}

export const DEFAULT_PRESET: PresetId = 'normal'

export function isPresetId(value: unknown): value is PresetId {
  return typeof value === 'string' && value in PRESETS
}

export function cellLabel(cell: Cell, size: number): string {
  return `${String.fromCharCode(65 + (cell % size))}${Math.floor(cell / size) + 1}`
}

/** Sel-sel kapal sepanjang `length` dari `cell` ke arah `dir`, atau null kalau keluar papan. */
export function shipCells(cell: Cell, length: number, dir: Dir, size: number): Cell[] | null {
  if (!Number.isInteger(cell) || cell < 0 || cell >= size * size) return null
  const row = Math.floor(cell / size)
  const col = cell % size
  if (dir === 'h' ? col + length > size : row + length > size) return null
  return Array.from({ length }, (_, i) => (dir === 'h' ? cell + i : cell + i * size))
}

/**
 * Armada sah: tiap kapal preset dipasang tepat sekali, di dalam papan, tidak tumpang tindih.
 * Kapal boleh bersentuhan. Mengembalikan sel tiap kapal (urut preset), atau null kalau tidak sah.
 */
export function fleetCells(fleet: unknown, preset: Preset): Cell[][] | null {
  if (!Array.isArray(fleet) || fleet.length !== preset.ships.length) return null
  const taken = new Set<Cell>()
  const result: Cell[][] = []
  for (const spec of preset.ships) {
    const matches = fleet.filter((p: Placement | null) => p?.id === spec.id)
    if (matches.length !== 1) return null
    const { cell, dir } = matches[0] as Placement
    if (dir !== 'h' && dir !== 'v') return null
    const cells = shipCells(cell, spec.size, dir, preset.size)
    if (!cells || cells.some((c) => taken.has(c))) return null
    cells.forEach((c) => taken.add(c))
    result.push(cells)
  }
  return result
}

/** Susunan armada acak yang sah, kapal terbesar dipasang lebih dulu. */
export function randomFleet(preset: Preset, rand: () => number = Math.random): Placement[] {
  for (;;) {
    const taken = new Set<Cell>()
    const fleet: Placement[] = []
    for (const spec of [...preset.ships].sort((a, b) => b.size - a.size)) {
      for (let attempt = 0; attempt < 100; attempt++) {
        const dir: Dir = rand() < 0.5 ? 'h' : 'v'
        const cell = Math.floor(rand() * preset.size * preset.size)
        const cells = shipCells(cell, spec.size, dir, preset.size)
        if (!cells || cells.some((c) => taken.has(c))) continue
        cells.forEach((c) => taken.add(c))
        fleet.push({ id: spec.id, cell, dir })
        break
      }
    }
    if (fleet.length === preset.ships.length) return fleet
  }
}

/** Sel di area 3×3 berpusat di `center` (terpotong di tepi papan). */
export function areaCells(center: Cell, size: number): Cell[] {
  const row = Math.floor(center / size)
  const col = center % size
  const cells: Cell[] = []
  for (let r = row - 1; r <= row + 1; r++) {
    for (let c = col - 1; c <= col + 1; c++) {
      if (r >= 0 && r < size && c >= 0 && c < size) cells.push(r * size + c)
    }
  }
  return cells
}

/** Bobot target yang sama dengan target terakhir penyerang; lawan lain berbobot 1. */
export const REPEAT_WEIGHT = 0.5

/**
 * Undian target berbobot: lawan yang masih hidup, dengan peluang lebih kecil untuk target
 * terakhir penyerang, supaya tidak terus-menerus menembak orang yang sama.
 */
export function pickTarget(attacker: number, alive: number[], lastTarget: number | null, rand: () => number = Math.random): number {
  const options = alive.filter((seat) => seat !== attacker)
  const weights = options.map((seat) => (seat === lastTarget && options.length > 1 ? REPEAT_WEIGHT : 1))
  let roll = rand() * weights.reduce((sum, w) => sum + w, 0)
  for (let i = 0; i < options.length; i++) {
    roll -= weights[i]
    if (roll < 0) return options[i]
  }
  return options[options.length - 1]
}

export function shuffled<T>(items: T[], rand: () => number = Math.random): T[] {
  const list = [...items]
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  return list
}
