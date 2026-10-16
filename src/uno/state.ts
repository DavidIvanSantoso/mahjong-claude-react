import {
  buildDeck,
  canPlay,
  cardName,
  cardPoints,
  COLOR_NAMES,
  COLORS,
  HAND_SIZE,
  shuffle,
  type Card,
  type Color,
} from './cards'

/**
 * - `turn`: pemain `current` memainkan kartu atau mengambil satu kartu.
 * - `drawn`: kartu yang baru diambil bisa dimainkan; pemain memainkannya atau menyimpannya.
 * - `color`: kartu pembuka adalah Wild, pemain pertama memilih warnanya.
 * - `challenge`: pemain `current` baru dikenai Wild Draw Four dan boleh menantangnya.
 */
export type Phase = 'turn' | 'drawn' | 'color' | 'challenge' | 'over'

export interface Player {
  name: string
  hand: Card[]
  /** Sudah bilang "UNO!" saat tinggal dua kartu, sebelum mengeluarkan kartu kedua terakhirnya. */
  declared: boolean
}

export interface UnoState {
  players: Player[]
  drawPile: Card[]
  /** Tumpukan buangan; kartu terakhir adalah kartu teratas. */
  discard: Card[]
  current: number
  /** 1: urutan kursi naik (searah jarum jam), -1: berbalik. */
  direction: 1 | -1
  /** Warna yang berlaku; untuk Wild, warna pilihan pemain yang mengeluarkannya. */
  color: Color
  phase: Phase
  /** Fase `drawn`: kartu yang baru diambil dan boleh langsung dimainkan. */
  drawnId: number | null
  /**
   * Fase `challenge`: siapa yang mengeluarkan Wild Draw Four, warna yang berlaku sebelum kartu itu,
   * dan apakah ia sebenarnya masih punya kartu warna itu.
   */
  challenge: { from: number; color: Color; guilty: boolean } | null
  /** Pemain yang tinggal satu kartu tapi lupa bilang UNO; bisa ditangkap sampai pemain berikutnya beraksi. */
  vulnerable: number | null
  dealer: number
  winner: number | null
  /** Bertambah tiap aksi giliran (bukan UNO/tangkap), supaya batas waktu hanya diulang saat giliran berganti. */
  step: number
  /** Kejadian terakhir di meja, paling baru di akhir. */
  log: string[]
}

export type Action =
  | { type: 'play'; cardId: number; color?: Color }
  | { type: 'draw' }
  | { type: 'pass' }
  | { type: 'chooseColor'; color: Color }
  | { type: 'challenge' }
  | { type: 'accept' }
  /** Waktu habis atau pemain terputus: ambil kartu, terima Wild Draw Four, atau pilih warna terbanyak. */
  | { type: 'timeout' }
  /** `seat` diisi host dari koneksi pengirimnya, bukan dipercaya dari isi pesan. */
  | { type: 'uno'; seat: number }
  | { type: 'catch'; seat: number; target: number }

const LOG_SIZE = 6

function log(s: UnoState, text: string) {
  s.log = [...s.log, text].slice(-LOG_SIZE)
}

function nextSeat(s: UnoState, from: number, steps = 1): number {
  const n = s.players.length
  return (((from + s.direction * steps) % n) + n) % n
}

export function topCard(s: UnoState): Card {
  return s.discard[s.discard.length - 1]
}

/** Tumpukan ambil habis: buangan (kecuali kartu teratas) dikocok jadi tumpukan ambil baru. */
function reshuffle(s: UnoState) {
  if (s.discard.length <= 1) return
  const top = s.discard.pop()!
  s.drawPile = shuffle(s.discard)
  s.discard = [top]
  log(s, 'Tumpukan buangan dikocok jadi tumpukan ambil baru.')
}

/** Mengambil sampai `count` kartu; hasilnya bisa kurang kalau semua kartu sedang dipegang pemain. */
function drawCards(s: UnoState, seat: number, count: number): number {
  const player = s.players[seat]
  let drawn = 0
  for (let i = 0; i < count; i++) {
    if (s.drawPile.length === 0) reshuffle(s)
    const card = s.drawPile.pop()
    if (!card) break
    player.hand.push(card)
    drawn++
  }
  if (drawn > 0) {
    player.declared = false
    if (s.vulnerable === seat) s.vulnerable = null
  }
  return drawn
}

function cardsText(count: number): string {
  return `${count} kartu`
}

/** Mulai ronde baru: kartu dibagikan mulai dari kiri pembagi, lalu kartu pertama dibuka. */
export function startRound(names: string[], dealer: number): UnoState {
  let deck = shuffle(buildDeck())
  const s: UnoState = {
    players: names.map((name) => ({ name, hand: [], declared: false })),
    drawPile: [],
    discard: [],
    current: dealer,
    direction: 1,
    color: 'red',
    phase: 'turn',
    drawnId: null,
    challenge: null,
    vulnerable: null,
    dealer,
    winner: null,
    step: 0,
    log: [],
  }
  const first = nextSeat(s, dealer)
  for (let round = 0; round < HAND_SIZE; round++) {
    for (let i = 0; i < names.length; i++) s.players[nextSeat(s, first, i)].hand.push(deck.pop()!)
  }
  // Wild Draw Four tidak boleh jadi kartu pembuka: dikembalikan ke tumpukan, dikocok, buka lagi.
  let top = deck.pop()!
  while (top.value === 'wild4') {
    deck = shuffle([...deck, top])
    top = deck.pop()!
  }
  s.drawPile = deck
  s.discard = [top]
  if (top.color) s.color = top.color
  log(s, `${names[dealer]} membagikan kartu. Kartu pembuka: ${cardName(top)}.`)

  switch (top.value) {
    case 'skip':
      log(s, `${names[first]} dilewati.`)
      s.current = nextSeat(s, first)
      break
    case 'reverse':
      // Arah berbalik, jadi pembagi kartu yang jalan duluan.
      s.direction = -1
      s.current = dealer
      log(s, `Arah permainan berbalik; ${names[dealer]} jalan duluan.`)
      break
    case 'draw2': {
      const drawn = drawCards(s, first, 2)
      log(s, `${names[first]} mengambil ${cardsText(drawn)} dan dilewati.`)
      s.current = nextSeat(s, first)
      break
    }
    case 'wild':
      s.current = first
      s.phase = 'color'
      log(s, `${names[first]} memilih warna pembuka.`)
      break
    default:
      s.current = first
  }
  return s
}

/** Warna yang paling banyak di tangan, untuk pilihan otomatis saat waktu habis. */
function favoriteColor(hand: Card[]): Color {
  const counts = COLORS.map((color) => hand.filter((card) => card.color === color).length)
  const best = Math.max(...counts)
  return best > 0 ? COLORS[counts.indexOf(best)] : COLORS[Math.floor(Math.random() * COLORS.length)]
}

function play(s: UnoState, cardId: number, chosen: Color | undefined): boolean {
  const seat = s.current
  const player = s.players[seat]
  const card = player.hand.find((c) => c.id === cardId)
  if (!card) return false
  if (s.phase === 'drawn' && card.id !== s.drawnId) return false
  if (!canPlay(card, topCard(s), s.color)) return false
  if (card.color === null && !(chosen && COLORS.includes(chosen))) return false

  // Wild Draw Four "curang" kalau pemainnya masih punya kartu dengan warna yang berlaku.
  const previousColor = s.color
  const guilty = card.value === 'wild4' && player.hand.some((c) => c.id !== card.id && c.color === previousColor)
  player.hand = player.hand.filter((c) => c.id !== card.id)
  s.discard.push(card)
  s.color = card.color ?? chosen!
  s.drawnId = null
  log(
    s,
    card.color
      ? `${player.name} mengeluarkan ${cardName(card)}.`
      : `${player.name} mengeluarkan ${cardName(card)} dan memilih ${COLOR_NAMES[s.color]}.`,
  )

  if (player.hand.length === 1 && !player.declared) s.vulnerable = seat
  player.declared = false

  const victim = nextSeat(s, seat)
  if (player.hand.length === 0) {
    // Kartu terakhir Draw Two / Wild Draw Four tetap berlaku; kartunya ikut dihitung sebagai poin.
    if (card.value === 'draw2' || card.value === 'wild4') {
      const drawn = drawCards(s, victim, card.value === 'draw2' ? 2 : 4)
      log(s, `${s.players[victim].name} mengambil ${cardsText(drawn)}.`)
    }
    s.phase = 'over'
    s.winner = seat
    s.vulnerable = null
    log(s, `${player.name} menghabiskan kartunya!`)
    return true
  }

  s.phase = 'turn'
  switch (card.value) {
    case 'skip':
      log(s, `${s.players[victim].name} dilewati.`)
      s.current = nextSeat(s, seat, 2)
      break
    case 'reverse':
      s.direction = s.direction === 1 ? -1 : 1
      log(s, 'Arah permainan berbalik.')
      // Berdua, Reverse sama dengan Skip: pemain yang sama jalan lagi.
      s.current = s.players.length === 2 ? seat : nextSeat(s, seat)
      break
    case 'draw2': {
      const drawn = drawCards(s, victim, 2)
      log(s, `${s.players[victim].name} mengambil ${cardsText(drawn)} dan dilewati.`)
      s.current = nextSeat(s, seat, 2)
      break
    }
    case 'wild4':
      s.phase = 'challenge'
      s.challenge = { from: seat, color: previousColor, guilty }
      s.current = victim
      break
    default:
      s.current = victim
  }
  return true
}

function draw(s: UnoState) {
  const player = s.players[s.current]
  const drawn = drawCards(s, s.current, 1)
  if (drawn === 0) {
    log(s, `Tidak ada kartu untuk diambil; giliran ${player.name} dilewati.`)
    s.current = nextSeat(s, s.current)
    return
  }
  log(s, `${player.name} mengambil 1 kartu.`)
  const card = player.hand[player.hand.length - 1]
  if (canPlay(card, topCard(s), s.color)) {
    s.phase = 'drawn'
    s.drawnId = card.id
  } else s.current = nextSeat(s, s.current)
}

function pass(s: UnoState) {
  log(s, `${s.players[s.current].name} menyimpan kartunya.`)
  s.phase = 'turn'
  s.drawnId = null
  s.current = nextSeat(s, s.current)
}

function chooseColor(s: UnoState, color: Color) {
  s.color = color
  s.phase = 'turn'
  log(s, `${s.players[s.current].name} memilih ${COLOR_NAMES[color]}.`)
}

function resolveChallenge(s: UnoState, challenged: boolean) {
  const { from, guilty } = s.challenge!
  const victim = s.current
  const offender = s.players[from].name
  const name = s.players[victim].name
  s.challenge = null
  s.phase = 'turn'

  if (!challenged) {
    const drawn = drawCards(s, victim, 4)
    log(s, `${name} mengambil ${cardsText(drawn)} dan dilewati.`)
    s.current = nextSeat(s, victim)
  } else if (guilty) {
    // Tantangan benar: yang mengeluarkan kartu mengambil 4, penantang tetap mendapat gilirannya.
    const drawn = drawCards(s, from, 4)
    log(s, `${name} menantang dan benar! ${offender} masih punya kartu yang cocok, jadi mengambil ${cardsText(drawn)}.`)
  } else {
    const drawn = drawCards(s, victim, 6)
    log(s, `${name} menantang tapi salah, jadi mengambil ${cardsText(drawn)} dan dilewati.`)
    s.current = nextSeat(s, victim)
  }
}

function timeout(s: UnoState) {
  log(s, `Waktu ${s.players[s.current].name} habis.`)
  switch (s.phase) {
    case 'turn':
      draw(s)
      // Kartu yang terambil tidak dikeluarkan otomatis; giliran langsung pindah.
      if (s.drawnId !== null) pass(s)
      break
    case 'drawn':
      pass(s)
      break
    case 'color':
      chooseColor(s, favoriteColor(s.players[s.current].hand))
      break
    case 'challenge':
      resolveChallenge(s, false)
      break
  }
}

/** Pemain yang tinggal dua kartu bilang UNO, atau yang lupa segera menyusulkannya sebelum ditangkap. */
function callUno(s: UnoState, seat: number): boolean {
  const player = s.players[seat]
  if (!player) return false
  if (s.vulnerable === seat) {
    s.vulnerable = null
    log(s, `${player.name}: "UNO!"`)
    return true
  }
  if (player.hand.length !== 2 || player.declared) return false
  player.declared = true
  log(s, `${player.name}: "UNO!"`)
  return true
}

function catchUno(s: UnoState, seat: number, target: number): boolean {
  if (s.vulnerable !== target || seat === target || !s.players[seat]) return false
  const drawn = drawCards(s, target, 2)
  s.vulnerable = null
  log(s, `${s.players[seat].name} menangkap ${s.players[target].name} yang lupa bilang UNO! Hukuman: ${cardsText(drawn)}.`)
  return true
}

/**
 * Semua aksi divalidasi di sini lagi (bukan hanya di host), jadi aksi yang tidak sah
 * mengembalikan state yang sama tanpa perubahan.
 */
export function reducer(state: UnoState, action: Action): UnoState {
  if (state.phase === 'over') return state
  const s = structuredClone(state)

  if (action.type === 'uno') return callUno(s, action.seat) ? s : state
  if (action.type === 'catch') return catchUno(s, action.seat, action.target) ? s : state

  // Kesempatan menangkap pemain yang lupa bilang UNO habis begitu pemain berikutnya beraksi.
  s.vulnerable = null
  switch (action.type) {
    case 'play':
      if ((s.phase !== 'turn' && s.phase !== 'drawn') || !play(s, action.cardId, action.color)) return state
      break
    case 'draw':
      if (s.phase !== 'turn') return state
      draw(s)
      break
    case 'pass':
      if (s.phase !== 'drawn') return state
      pass(s)
      break
    case 'chooseColor':
      if (s.phase !== 'color' || !COLORS.includes(action.color)) return state
      chooseColor(s, action.color)
      break
    case 'challenge':
    case 'accept':
      if (s.phase !== 'challenge') return state
      resolveChallenge(s, action.type === 'challenge')
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

/** Poin untuk pemenang ronde: jumlah nilai kartu yang tersisa di tangan semua lawan. */
export function roundPoints(s: UnoState): number {
  if (s.winner === null) return 0
  return s.players.reduce(
    (sum, player, i) => (i === s.winner ? sum : sum + player.hand.reduce((total, card) => total + cardPoints(card), 0)),
    0,
  )
}
