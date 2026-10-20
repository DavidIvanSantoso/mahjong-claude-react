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
   * Giliran pertama tiap ronde: kartu terkecil yang dibagikan (3♦ kalau berempat) wajib ikut
   * dikeluarkan. null setelah kartu itu keluar.
   */
  mustInclude: number | null
  /** Kombo 5 kartu sudah pernah keluar di ronde ini; sejak itu tris tidak boleh dikeluarkan lagi. */
  fiveCardPlayed: boolean
  /**
   * Walik sedang berlaku: urutan angka dan bunga terbalik (3 terbesar, 2 terkecil, ♦ terbesar,
   * ♠ terkecil) sampai ronde selesai. Dipicu pemain yang mengeluarkan four of a kind dan memilih walik.
   */
  reversed: boolean
  phase: 'play' | 'over'
  winner: number | null
  /** Bertambah tiap aksi. */
  step: number
  log: string[]
}

export type Action =
  /** `walik`: hanya untuk four of a kind; membalik urutan kartu setelah kartu ini keluar. */
  | { type: 'play'; cardIds: number[]; walik?: boolean }
  | { type: 'pass' }
  | { type: 'timeout' }

const LOG_SIZE = 6

function log(s: CapsaState, text: string) {
  s.log = [...s.log, text].slice(-LOG_SIZE)
}

export function tableCombo(s: { trick: Play[] }): Combo | null {
  return s.trick.length ? s.trick[s.trick.length - 1].combo : null
}

/**
 * Mulai ronde: 13 kartu per pemain (sisa kartu tidak dipakai kalau pemainnya kurang dari 4).
 * Di setiap ronde, pemegang 3♦ jalan duluan dan wajib mengeluarkannya. Kalau pemainnya kurang
 * dari 4 dan 3♦ tidak terbagi, pemegang kartu terkecil yang menggantikannya.
 */
export function startRound(names: string[]): CapsaState {
  const deck = shuffle(buildDeck())
  const players = names.map((name, i) => ({
    name,
    hand: sortByRank(deck.slice(i * HAND_SIZE, (i + 1) * HAND_SIZE)),
    passed: false,
  }))
  const lowest = Math.min(...players.flatMap((player) => player.hand.map((card) => card.id)))
  const first = players.findIndex((player) => player.hand.some((card) => card.id === lowest))
  const s: CapsaState = {
    players,
    current: first,
    trick: [],
    leader: first,
    mustInclude: lowest,
    fiveCardPlayed: false,
    reversed: false,
    phase: 'play',
    winner: null,
    step: 0,
    log: [],
  }
  log(s, `${names[first]} memegang ${cardLabel(players[first].hand[0])} dan jalan duluan.`)
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
  s: { trick: Play[]; mustInclude: number | null; fiveCardPlayed: boolean; reversed: boolean },
  cards: Card[],
): string | null {
  const combo = evaluate(cards, s.reversed)
  if (!combo) return 'Bukan kombinasi yang sah.'
  if (combo.kind === 'triple' && s.fiveCardPlayed) {
    return 'Tris tidak boleh dikeluarkan lagi setelah kombo 5 kartu keluar di ronde ini.'
  }
  if (s.mustInclude !== null && !cards.some((card) => card.id === s.mustInclude)) {
    return 'Giliran pertama wajib mengeluarkan kartu terkecil.'
  }
  const played = tableCombo(s)
  if (!played) return null
  // Kartu di meja dinilai ulang dengan urutan yang berlaku sekarang (bisa sudah walik).
  const table = evaluate(played.cards, s.reversed)!
  if (combo.cards.length !== table.cards.length) return `Harus ${table.cards.length} kartu, sama dengan di meja.`
  if (!beats(combo, table)) return `Belum bisa mengalahkan ${comboLabel(table)}.`
  return null
}

function play(s: CapsaState, cardIds: number[], walik = false): boolean {
  const player = s.players[s.current]
  if (!Array.isArray(cardIds) || cardIds.length === 0 || new Set(cardIds).size !== cardIds.length) return false
  const cards = cardIds.map((id) => player.hand.find((card) => card.id === id))
  if (cards.some((card) => !card)) return false
  if (playProblem(s, cards as Card[])) return false

  const combo = evaluate(cards as Card[], s.reversed)!
  if (walik && combo.kind !== 'fourkind') return false
  const played = new Set(cardIds)
  player.hand = player.hand.filter((card) => !played.has(card.id))
  s.trick.push({ by: s.current, combo })
  s.leader = s.current
  s.mustInclude = null
  if (combo.cards.length === 5 && !s.fiveCardPlayed) {
    s.fiveCardPlayed = true
    log(s, 'Kombo 5 kartu sudah keluar: tris terkunci sampai ronde selesai.')
  }
  log(s, `${player.name} mengeluarkan ${comboLabel(combo)}${combo.cards.length > 1 ? ` (${combo.cards.map(cardLabel).join(' ')})` : ''}.`)
  if (walik) {
    s.reversed = !s.reversed
    log(
      s,
      s.reversed
        ? `${player.name} melakukan WALIK! Sekarang 3 terbesar dan 2 terkecil; ♦ terbesar dan ♠ terkecil.`
        : `${player.name} melakukan walik lagi: urutan kartu kembali normal.`,
    )
  }

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
  const lowest = sortByRank(s.players[s.current].hand, s.reversed)[0]
  play(s, [s.mustInclude ?? lowest.id])
}

export function reducer(state: CapsaState, action: Action): CapsaState {
  if (state.phase === 'over') return state
  const s = structuredClone(state)
  switch (action.type) {
    case 'play':
      if (!play(s, action.cardIds, action.walik === true)) return state
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
