import { beats, buildDeck, cardLabel, comboLabel, evaluate, HAND_SIZE, shuffle, sortByRank, type Card, type Combo } from './cards'

export interface Player {
  name: string
  hand: Card[]
  /** Sudah lewat di putaran ini; ikut lagi setelah semua lewat dan meja dibersihkan. */
  passed: boolean
}

export interface Play {
  by: number
  combo: Combo
}

export interface CapsaState {
  players: Player[]
  current: number
  /** Kartu-kartu yang dikeluarkan di putaran ini, paling baru di akhir. Kosong = meja bersih. */
  trick: Play[]
  /** Pemain yang terakhir mengeluarkan kartu; kalau semua lawan lewat, ia bebas memulai lagi. */
  leader: number
  /**
   * Giliran pertama ronde pertama: kartu terkecil yang dibagikan (3♦ kalau berempat) wajib ikut
   * dikeluarkan. null kalau aturan itu tidak berlaku (lagi).
   */
  mustInclude: number | null
  phase: 'play' | 'over'
  winner: number | null
  /** Bertambah tiap aksi. */
  step: number
  log: string[]
}

export type Action = { type: 'play'; cardIds: number[] } | { type: 'pass' } | { type: 'timeout' }

const LOG_SIZE = 6

function log(s: CapsaState, text: string) {
  s.log = [...s.log, text].slice(-LOG_SIZE)
}

export function tableCombo(s: { trick: Play[] }): Combo | null {
  return s.trick.length ? s.trick[s.trick.length - 1].combo : null
}

/**
 * Mulai ronde: 13 kartu per pemain (sisa kartu tidak dipakai kalau pemainnya kurang dari 4).
 * `starter` null berarti ronde pertama: pemegang kartu terkecil jalan duluan dan wajib mengeluarkannya.
 * Ronde berikutnya dimulai pemenang ronde sebelumnya, bebas mengeluarkan apa saja.
 */
export function startRound(names: string[], starter: number | null): CapsaState {
  const deck = shuffle(buildDeck())
  const players = names.map((name, i) => ({
    name,
    hand: sortByRank(deck.slice(i * HAND_SIZE, (i + 1) * HAND_SIZE)),
    passed: false,
  }))
  const lowest = Math.min(...players.flatMap((player) => player.hand.map((card) => card.id)))
  const first = starter ?? players.findIndex((player) => player.hand.some((card) => card.id === lowest))
  const s: CapsaState = {
    players,
    current: first,
    trick: [],
    leader: first,
    mustInclude: starter === null ? lowest : null,
    phase: 'play',
    winner: null,
    step: 0,
    log: [],
  }
  if (starter === null) {
    log(s, `${names[first]} memegang ${cardLabel(players[first].hand[0])} dan jalan duluan.`)
  } else log(s, `${names[first]} menang ronde sebelumnya dan jalan duluan.`)
  return s
}

/** Pemain berikutnya yang belum lewat; kalau semua lawan sudah lewat, meja dibersihkan untuk `leader`. */
function advance(s: CapsaState) {
  const n = s.players.length
  let seat = s.current
  for (let k = 0; k < n; k++) {
    seat = (seat + 1) % n
    if (seat === s.leader) {
      s.trick = []
      s.players.forEach((player) => (player.passed = false))
      s.current = s.leader
      log(s, `Semua lewat. ${s.players[s.leader].name} bebas mengeluarkan kartu.`)
      return
    }
    if (!s.players[seat].passed) {
      s.current = seat
      return
    }
  }
}

/** Kenapa kartu-kartu ini tidak boleh dikeluarkan sekarang, atau null kalau boleh. */
export function playProblem(
  s: { trick: Play[]; mustInclude: number | null },
  cards: Card[],
): string | null {
  const combo = evaluate(cards)
  if (!combo) return 'Bukan kombinasi yang sah.'
  if (s.mustInclude !== null && !cards.some((card) => card.id === s.mustInclude)) {
    return 'Giliran pertama wajib mengeluarkan kartu terkecil.'
  }
  const table = tableCombo(s)
  if (!table) return null
  if (combo.cards.length !== table.cards.length) return `Harus ${table.cards.length} kartu, sama dengan di meja.`
  if (!beats(combo, table)) return `Belum bisa mengalahkan ${comboLabel(table)}.`
  return null
}

function play(s: CapsaState, cardIds: number[]): boolean {
  const player = s.players[s.current]
  if (!Array.isArray(cardIds) || cardIds.length === 0 || new Set(cardIds).size !== cardIds.length) return false
  const cards = cardIds.map((id) => player.hand.find((card) => card.id === id))
  if (cards.some((card) => !card)) return false
  if (playProblem(s, cards as Card[])) return false

  const combo = evaluate(cards as Card[])!
  const played = new Set(cardIds)
  player.hand = player.hand.filter((card) => !played.has(card.id))
  s.trick.push({ by: s.current, combo })
  s.leader = s.current
  s.mustInclude = null
  log(s, `${player.name} mengeluarkan ${comboLabel(combo)}${combo.cards.length > 1 ? ` (${combo.cards.map(cardLabel).join(' ')})` : ''}.`)

  if (player.hand.length === 0) {
    s.phase = 'over'
    s.winner = s.current
    log(s, `${player.name} menghabiskan kartunya!`)
    return true
  }
  advance(s)
  return true
}

function pass(s: CapsaState): boolean {
  // Meja bersih: pemain yang memimpin wajib mengeluarkan kartu.
  if (!tableCombo(s)) return false
  s.players[s.current].passed = true
  log(s, `${s.players[s.current].name} lewat.`)
  advance(s)
  return true
}

/** Pemain terputus terlalu lama: lewat, atau kalau sedang memimpin, keluarkan kartu terkecil. */
function timeout(s: CapsaState) {
  log(s, `${s.players[s.current].name} terputus; gilirannya dijalankan otomatis.`)
  if (tableCombo(s)) {
    pass(s)
    return
  }
  const lowest = sortByRank(s.players[s.current].hand)[0]
  play(s, [s.mustInclude ?? lowest.id])
}

export function reducer(state: CapsaState, action: Action): CapsaState {
  if (state.phase === 'over') return state
  const s = structuredClone(state)
  switch (action.type) {
    case 'play':
      if (!play(s, action.cardIds)) return state
      break
    case 'pass':
      if (!pass(s)) return state
      break
    case 'timeout':
      timeout(s)
      break
    default:
      return state
  }
  s.step++
  return s
}

/** Perubahan skor ronde ini: tiap yang kalah kehilangan poin sebanyak sisa kartunya, pemenang mendapat semuanya. */
export function roundDeltas(s: CapsaState): number[] {
  if (s.winner === null) return s.players.map(() => 0)
  const losses = s.players.map((player) => player.hand.length)
  const total = losses.reduce((sum, n) => sum + n, 0)
  return s.players.map((_, i) => (i === s.winner ? total : -losses[i]))
}
