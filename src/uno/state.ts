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
 * - `classic`: aturan dasar UNO internasional.
 * - `crazy`: ditambah aturan 7-0. Angka 0 memutar semua tangan searah arah permainan,
 *   angka 7 menukar tangan dengan pemain pilihan.
 * - `indonesian`: +2/+4 bisa dibalas dan hukumannya menumpuk; beberapa kartu bernilai sama
 *   (angka atau simbol) boleh dikeluarkan sekaligus; yang tidak punya kartu cocok mengambil terus
 *   sampai dapat lalu wajib mengeluarkannya. Tantangan Wild Draw Four tidak dipakai.
 */
export type UnoMode = 'classic' | 'crazy' | 'indonesian'

export const MODE_NAMES: Record<UnoMode, string> = {
  classic: 'Klasik',
  crazy: 'Crazy Rules',
  indonesian: 'Indonesian Rules',
}

/**
 * - `turn`: pemain `current` memainkan kartu atau mengambil satu kartu.
 * - `drawn`: kartu yang baru diambil bisa dimainkan; pemain memainkannya atau menyimpannya
 *   (Indonesian Rules: wajib dimainkan).
 * - `color`: kartu pembuka adalah Wild, pemain pertama memilih warnanya.
 * - `challenge`: pemain `current` baru dikenai Wild Draw Four dan boleh menantangnya.
 * - `stack` (Indonesian Rules): pemain `current` membalas +2/+4 atau mengambil `pendingDraw` kartu.
 */
export type Phase = 'turn' | 'drawn' | 'color' | 'challenge' | 'stack' | 'over'

export interface Player {
  name: string
  hand: Card[]
  /** Sudah bilang "UNO!" sebelum mengeluarkan kartu yang menyisakan satu kartu. */
  declared: boolean
}

export interface UnoState {
  mode: UnoMode
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
  /** Fase `stack`: jumlah kartu hukuman +2/+4 yang menumpuk. */
  pendingDraw: number
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
  /**
   * `cardId`: kartu yang dikeluarkan (jadi kartu teratas). `under`: kartu bernilai sama yang ikut
   * dikeluarkan di bawahnya (Indonesian Rules). `target`: lawan untuk tukar tangan (angka 7, Crazy Rules).
   */
  | { type: 'play'; cardId: number; color?: Color; under?: number[]; target?: number }
  /** Ambil 1 kartu, atau di fase `stack` ambil semua kartu hukuman. */
  | { type: 'draw' }
  | { type: 'pass' }
  | { type: 'chooseColor'; color: Color }
  | { type: 'challenge' }
  | { type: 'accept' }
  /** Waktu habis atau pemain terputus: ambil kartu, terima hukuman, atau pilih warna terbanyak. */
  | { type: 'timeout' }
  /** `seat` diisi host dari koneksi pengirimnya, bukan dipercaya dari isi pesan. */
  | { type: 'uno'; seat: number }
  | { type: 'catch'; seat: number; target: number }

const LOG_SIZE = 6
/** Batas kartu sekaligus dalam satu aksi; satu nilai paling banyak ada 8 kartu di dek. */
const MAX_MULTI = 8

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

/** Fase `stack`: +2 bisa dibalas +2 atau +4, sedangkan +4 hanya bisa dibalas +4. */
export function canStack(card: Card, top: Card): boolean {
  return card.value === 'wild4' || (card.value === 'draw2' && top.value === 'draw2')
}

/**
 * Urutan keluarnya kartu dalam satu aksi; kartu terakhir di `cards` adalah pilihan pemain untuk
 * kartu teratas. Lebih dari satu kartu (Indonesian Rules): semuanya bernilai sama (angka atau simbol,
 * +2 tidak bisa dicampur +4), dan kartu paling bawah harus cocok dengan buangan.
 * - Fase `stack`: semuanya harus bisa membalas tumpukan.
 * - Fase `drawn`: kartu yang baru diambil harus ikut dikeluarkan.
 * null kalau tidak ada urutan yang sah.
 */
export function playOrder(
  cards: Card[],
  pileTop: Card,
  color: Color,
  phase: Phase = 'turn',
  drawnId: number | null = null,
): Card[] | null {
  const chosen = cards[cards.length - 1]
  if (!chosen || cards.some((card) => card.value !== chosen.value)) return null
  if (phase === 'stack') return cards.every((card) => canStack(card, pileTop)) ? cards : null
  if (phase === 'drawn' && !cards.some((card) => card.id === drawnId)) return null
  const under = cards.slice(0, -1)
  if (under.length === 0) return canPlay(chosen, pileTop, color) ? cards : null
  const first = under.find((card) => canPlay(card, pileTop, color))
  return first ? [first, ...under.filter((card) => card !== first), chosen] : null
}

/** Indonesian Rules: pemain yang masih punya kartu cocok tidak boleh mengambil kartu. */
export function hasPlayable(hand: Card[], pileTop: Card, color: Color): boolean {
  return hand.some((card) => canPlay(card, pileTop, color))
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
export function startRound(names: string[], dealer: number, mode: UnoMode = 'classic'): UnoState {
  let deck = shuffle(buildDeck())
  const s: UnoState = {
    mode,
    players: names.map((name) => ({ name, hand: [], declared: false })),
    drawPile: [],
    discard: [],
    current: dealer,
    direction: 1,
    color: 'red',
    phase: 'turn',
    drawnId: null,
    challenge: null,
    pendingDraw: 0,
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

  // Angka 0 dan 7 di kartu pembuka tidak menjalankan aturan Crazy.
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
    case 'draw2':
      if (mode === 'indonesian') {
        // Pemain pertama boleh langsung membalasnya.
        s.phase = 'stack'
        s.pendingDraw = 2
        s.current = first
        log(s, `${names[first]} harus membalas +2 atau mengambil 2 kartu.`)
      } else {
        const drawn = drawCards(s, first, 2)
        log(s, `${names[first]} mengambil ${cardsText(drawn)} dan dilewati.`)
        s.current = nextSeat(s, first)
      }
      break
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

/** Setelah tangan berpindah pemilik, status UNO lama tidak berlaku lagi. */
function resetUno(s: UnoState) {
  s.vulnerable = null
  s.players.forEach((player) => (player.declared = false))
}

/** Crazy Rules, angka 0: tiap tangan pindah ke pemain berikutnya searah arah permainan. */
function rotateHands(s: UnoState) {
  const hands = s.players.map((player) => player.hand)
  hands.forEach((hand, i) => (s.players[nextSeat(s, i)].hand = hand))
  resetUno(s)
  log(s, `Semua pemain mengoper kartunya ${s.direction === 1 ? 'searah' : 'berlawanan arah'} jarum jam.`)
}

/** Crazy Rules, angka 7: tukar tangan dengan pemain pilihan. */
function swapHands(s: UnoState, seat: number, target: number) {
  const a = s.players[seat]
  const b = s.players[target]
  ;[a.hand, b.hand] = [b.hand, a.hand]
  resetUno(s)
  log(s, `${a.name} menukar kartunya dengan ${b.name}.`)
}

interface PlayInput {
  cardId: number
  color?: Color
  under?: number[]
  target?: number
}

function play(s: UnoState, { cardId, color: chosen, under = [], target }: PlayInput): boolean {
  const seat = s.current
  const player = s.players[seat]
  const card = player.hand.find((c) => c.id === cardId)
  if (!card || !Array.isArray(under) || under.length > MAX_MULTI) return false
  const pileTop = topCard(s)

  if (under.length > 0 && s.mode !== 'indonesian') return false
  const extra = under.map((id) => player.hand.find((c) => c.id === id))
  if (extra.some((c) => !c || c.id === card.id) || new Set(under).size !== under.length) return false
  const order = playOrder([...(extra as Card[]), card], pileTop, s.color, s.phase, s.drawnId)
  if (!order) return false
  if (card.color === null && !(chosen && COLORS.includes(chosen))) return false

  const remaining = player.hand.length - order.length
  const swaps = s.mode === 'crazy' && remaining > 0
  // Angka 7 di Crazy Rules wajib memilih lawan, kecuali kartu itu kartu terakhirnya.
  const swapTarget = swaps && card.value === 7 ? target : undefined
  if (swaps && card.value === 7) {
    if (typeof swapTarget !== 'number' || swapTarget === seat || !s.players[swapTarget]) return false
  }

  // Wild Draw Four "curang" kalau pemainnya masih punya kartu dengan warna yang berlaku.
  const previousColor = s.color
  const guilty = card.value === 'wild4' && player.hand.some((c) => c.id !== card.id && c.color === previousColor)
  const played = new Set(order.map((c) => c.id))
  player.hand = player.hand.filter((c) => !played.has(c.id))
  s.discard.push(...order)
  s.color = card.color ?? chosen!
  s.drawnId = null
  const count = order.length
  if (count > 1) {
    const picked = card.color ? '' : ` dan memilih ${COLOR_NAMES[s.color]}`
    log(s, `${player.name} mengeluarkan ${count} kartu sekaligus: ${order.map(cardName).join(', ')}${picked}.`)
  } else {
    log(
      s,
      card.color
        ? `${player.name} mengeluarkan ${cardName(card)}.`
        : `${player.name} mengeluarkan ${cardName(card)} dan memilih ${COLOR_NAMES[s.color]}.`,
    )
  }

  if (player.hand.length === 1 && !player.declared) s.vulnerable = seat
  player.declared = false

  const victim = nextSeat(s, seat)
  // Beberapa +2/+4 sekaligus: hukumannya dikalikan jumlah kartunya.
  const penalty = (card.value === 'draw2' ? 2 : card.value === 'wild4' ? 4 : 0) * count
  if (player.hand.length === 0) {
    // Kartu terakhir Draw Two / Wild Draw Four tetap berlaku; kartunya ikut dihitung sebagai poin.
    if (penalty) {
      const drawn = drawCards(s, victim, s.pendingDraw + penalty)
      log(s, `${s.players[victim].name} mengambil ${cardsText(drawn)}.`)
    }
    s.pendingDraw = 0
    s.phase = 'over'
    s.winner = seat
    s.vulnerable = null
    log(s, `${player.name} menghabiskan kartunya!`)
    return true
  }

  s.phase = 'turn'
  if (s.mode === 'indonesian' && penalty) {
    s.pendingDraw += penalty
    s.phase = 'stack'
    s.current = victim
    log(s, `${s.players[victim].name} harus membalas atau mengambil ${cardsText(s.pendingDraw)}.`)
    return true
  }

  switch (card.value) {
    case 'skip':
      skip(s, seat, count)
      break
    case 'reverse':
      // Tiap Reverse membalik arah sekali; dua Reverse kembali ke arah semula.
      if (count % 2 === 1) s.direction = s.direction === 1 ? -1 : 1
      log(
        s,
        count === 1
          ? 'Arah permainan berbalik.'
          : count % 2 === 1
            ? `Arah permainan berbalik ${count} kali, jadi berlawanan dengan sebelumnya.`
            : `Arah permainan berbalik ${count} kali, jadi kembali seperti semula.`,
      )
      // Berdua, tiap Reverse sama dengan Skip.
      if (s.players.length === 2) skip(s, seat, count)
      else s.current = nextSeat(s, seat)
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
      if (swaps && card.value === 0) rotateHands(s)
      if (swapTarget !== undefined) swapHands(s, seat, swapTarget)
      s.current = victim
  }
  return true
}

/** `count` pemain berikutnya dilewati, lalu giliran jatuh ke pemain sesudahnya. */
function skip(s: UnoState, seat: number, count: number) {
  const skipped = [...new Set(Array.from({ length: count }, (_, i) => nextSeat(s, seat, i + 1)))]
  log(s, `${skipped.map((i) => s.players[i].name).join(', ')} dilewati.`)
  s.current = nextSeat(s, seat, count + 1)
}

/** Indonesian Rules: mengambil terus sampai dapat kartu yang cocok, yang lalu wajib dikeluarkan. */
function drawUntilPlayable(s: UnoState) {
  const player = s.players[s.current]
  let count = 0
  while (drawCards(s, s.current, 1) > 0) {
    count++
    const card = player.hand[player.hand.length - 1]
    if (canPlay(card, topCard(s), s.color)) {
      log(s, `${player.name} mengambil ${cardsText(count)} sampai dapat kartu yang cocok.`)
      s.phase = 'drawn'
      s.drawnId = card.id
      return
    }
  }
  // Semua kartu sedang dipegang pemain, jadi tidak ada lagi yang bisa diambil.
  log(s, `${player.name} mengambil ${cardsText(count)}, tapi tidak ada yang cocok; gilirannya dilewati.`)
  s.current = nextSeat(s, s.current)
}

function draw(s: UnoState) {
  if (s.mode === 'indonesian') return drawUntilPlayable(s)
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

/** Fase `stack`: tidak membalas, jadi mengambil semua kartu hukuman dan dilewati. */
function takeStack(s: UnoState) {
  const drawn = drawCards(s, s.current, s.pendingDraw)
  log(s, `${s.players[s.current].name} mengambil ${cardsText(drawn)} dan dilewati.`)
  s.pendingDraw = 0
  s.phase = 'turn'
  s.current = nextSeat(s, s.current)
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

/** Indonesian Rules: kartu yang baru diambil wajib dikeluarkan, jadi saat waktu habis dikeluarkan otomatis. */
function playDrawn(s: UnoState) {
  if (s.drawnId === null) return
  play(s, { cardId: s.drawnId, color: favoriteColor(s.players[s.current].hand) })
}

function timeout(s: UnoState) {
  log(s, `Waktu ${s.players[s.current].name} habis.`)
  if (s.mode === 'indonesian' && (s.phase === 'turn' || s.phase === 'drawn')) {
    if (s.phase === 'turn') drawUntilPlayable(s)
    playDrawn(s)
    return
  }
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
    case 'stack':
      takeStack(s)
      break
  }
}

/**
 * Bilang UNO sebelum mengeluarkan kartu yang menyisakan satu kartu (bisa lebih dari satu kartu
 * sekaligus di Indonesian Rules), atau segera menyusulkannya kalau lupa, sebelum ditangkap.
 */
function callUno(s: UnoState, seat: number): boolean {
  const player = s.players[seat]
  if (!player) return false
  if (s.vulnerable === seat) {
    s.vulnerable = null
    log(s, `${player.name}: "UNO!"`)
    return true
  }
  if (player.hand.length < 2 || player.declared) return false
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
      if (s.phase !== 'turn' && s.phase !== 'drawn' && s.phase !== 'stack') return state
      if (!play(s, action)) return state
      break
    case 'draw':
      if (s.phase === 'stack') takeStack(s)
      else if (s.phase !== 'turn') return state
      else if (s.mode === 'indonesian' && hasPlayable(s.players[s.current].hand, topCard(s), s.color)) return state
      else draw(s)
      break
    case 'pass':
      if (s.phase !== 'drawn' || s.mode === 'indonesian') return state
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
