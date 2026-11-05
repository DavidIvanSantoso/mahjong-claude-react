import { ROLE_NAMES, type PresetId, type Role } from './roles'
import { clueProblem, GUESS_MAX, sameWord, type RoundWords } from './words'

/**
 * Alur satu permainan ASBUN (lobi ditangani net.ts, saat `game === null`):
 *
 * - `reveal`: tiap pemain membuka berkas perannya secara pribadi lalu menekan "Mengerti".
 * - `clue`: pemain aktif bergiliran memberi satu petunjuk (`order`, `turn`).
 * - `discussion`: semua berdiskusi (di luar aplikasi); countdown dari host.
 * - `voting`: semua pemain aktif memilih satu tersangka secara rahasia dan bersamaan.
 * - `elimination`: hasil voting; yang tereliminasi hanya dibuka perannya. Seri = tidak ada yang keluar.
 * - `guess`: Si Asbun yang tereliminasi mendapat satu tebakan kata Warga.
 * - `over`: ada pemenang; semua peran dan kedua kata dibuka.
 */
export type Phase = 'reveal' | 'clue' | 'discussion' | 'voting' | 'elimination' | 'guess' | 'over'

export interface Settings {
  preset: PresetId
  /** Id kategori pasangan kata, atau 'semua'. */
  category: string
  /** 'easy' | 'medium' | 'hard', atau 'semua'. */
  difficulty: string
  clueSeconds: number
  discussionSeconds: number
  votingSeconds: number
}

export interface Player {
  name: string
  /** PRIVAT: hanya dikirim ke pemiliknya, ke semua setelah ia tereliminasi, atau saat permainan selesai. */
  role: Role
  alive: boolean
  /** Ronde saat ia tereliminasi; null selama masih aktif. */
  out: number | null
  /** Sudah membuka berkas perannya di fase `reveal`. */
  acknowledged: boolean
}

export interface Clue {
  round: number
  by: number
  /** null: waktu habis tanpa petunjuk. */
  text: string | null
}

/** Pilihan "skip vote": tidak menuduh siapa pun di voting ini. */
export const SKIP_VOTE = -1

/** Hasil satu voting. Hanya jumlah suara yang dibuka, bukan siapa memilih siapa. */
export interface VoteResult {
  round: number
  tally: number[]
  /** Jumlah suara "skip". */
  skips: number
  /** Jumlah semua suara yang masuk, termasuk skip. */
  ballots: number
  /** null: skip menang, seri, atau tidak ada suara; tidak ada yang keluar. */
  eliminated: number | null
}

export interface Guess {
  round: number
  by: number
  /** null: waktu habis tanpa tebakan. */
  text: string | null
  correct: boolean
}

export type Side = 'warga' | 'penyusup' | 'asbun'

/** Emoji yang bisa dikirim saat diskusi; terlihat semua pemain. */
export const REACTIONS = ['🤔', '👀', '🤨', '🤫', '😏', '😂', '😱', '👍', '👎', '🙏'] as const
export type Reaction = (typeof REACTIONS)[number]

export interface ReactionEvent {
  /** Naik tiap reaksi, supaya animasinya diputar ulang untuk reaksi baru. */
  seq: number
  by: number
  emoji: Reaction
}

/** Jumlah reaksi terakhir yang disimpan (dan dikirim) per ronde. */
const REACTION_KEEP = 24

export interface Winner {
  side: Side
  seats: number[]
  /**
   * - `guess`: Si Asbun menebak kata Warga dengan benar.
   * - `parity`: jumlah Penyusup aktif menyamai atau melebihi pemain aktif lain.
   * - `cleared`: semua Penyusup dan Si Asbun sudah keluar.
   * - `survived`: Penyusup habis dan Si Asbun bertahan sampai tinggal berdua.
   */
  reason: 'guess' | 'parity' | 'cleared' | 'survived'
}

export interface AsbunState {
  settings: Settings
  /** PRIVAT: kata Warga dan Penyusup permainan ini. */
  words: RoundWords
  players: Player[]
  phase: Phase
  /** Siklus petunjuk–diskusi–voting ke berapa (mulai 1 di fase `clue` pertama). */
  round: number
  /** Pemain yang membuka putaran petunjuk ronde ini; ronde berikutnya mulai dari pemain aktif sesudahnya. */
  starter: number
  order: number[]
  turn: number
  clues: Clue[]
  /** PRIVAT sampai voting ditutup: pilihan tiap kursi di voting ini (null = belum memilih, SKIP_VOTE = skip). */
  ballots: (number | null)[]
  results: VoteResult[]
  /** Pemain yang baru tereliminasi (fase `elimination`/`guess`). */
  eliminated: number | null
  guesses: Guess[]
  winner: Winner | null
  /** Reaksi emoji saat diskusi ronde ini, paling baru di akhir. */
  reactions: ReactionEvent[]
  /** PRIVAT: pesan penolakan untuk satu pemain (mis. petunjuknya sama dengan katanya sendiri). */
  notice: { seat: number; text: string; seq: number } | null
  log: string[]
}

/** Aksi dari pemain; host menambahkan `by`. `round` dan `phase` dipakai untuk menolak pesan basi. */
export type PlayerAction =
  | { type: 'ack'; round: number; phase: Phase }
  | { type: 'clue'; round: number; phase: Phase; text: string }
  | { type: 'vote'; round: number; phase: Phase; target: number }
  | { type: 'guess'; round: number; phase: Phase; text: string }
  | { type: 'react'; round: number; phase: Phase; emoji: string }

export type Action =
  | (PlayerAction & { by: number })
  // Hanya dijalankan host:
  | { type: 'beginClues' }
  | { type: 'clueTimeout' }
  | { type: 'startVoting' }
  | { type: 'closeVoting' }
  | { type: 'guessTimeout' }
  | { type: 'proceed' }

const LOG_SIZE = 10

function log(s: AsbunState, text: string) {
  s.log = [...s.log, text].slice(-LOG_SIZE)
}

/**
 * Permainan baru. `roles` dari assignRoles, `words` dari selectPair, `starter` pemain pertama yang
 * memberi petunjuk (host memilih yang bukan Si Asbun, supaya Si Asbun tidak harus menebak duluan).
 */
export function newGame(names: string[], roles: Role[], words: RoundWords, settings: Settings, starter: number): AsbunState {
  return {
    settings,
    words,
    players: names.map((name, i) => ({ name, role: roles[i], alive: true, out: null, acknowledged: false })),
    phase: 'reveal',
    round: 0,
    starter,
    order: [],
    turn: 0,
    clues: [],
    ballots: names.map(() => null),
    results: [],
    eliminated: null,
    guesses: [],
    winner: null,
    reactions: [],
    notice: null,
    log: ['Berkas kasus dibagikan. Buka berkasmu secara pribadi.'],
  }
}

export function activeSeats(s: { players: { alive: boolean }[] }): number[] {
  return s.players.map((player, i) => (player.alive ? i : -1)).filter((i) => i >= 0)
}

/** Kata milik peran itu; Si Asbun tidak punya kata. */
export function wordFor(role: Role, words: RoundWords): string | null {
  return role === 'warga' ? words.warga : role === 'penyusup' ? words.penyusup : null
}

/**
 * Cek pemenang setelah eliminasi (tebakan benar Si Asbun dicek terpisah, lebih dulu):
 * 1. Penyusup aktif ≥ pemain aktif lain (Warga + Si Asbun) → Penyusup menang.
 * 2. Penyusup habis dan Si Asbun habis → Warga menang.
 * 3. Penyusup habis dan tinggal dua pemain, salah satunya Si Asbun → Si Asbun menang (bertahan).
 * Selain itu permainan berlanjut.
 */
export function checkVictory(players: Pick<Player, 'role' | 'alive'>[]): Winner | null {
  const seatsOf = (pick: (p: Pick<Player, 'role' | 'alive'>) => boolean) =>
    players.map((p, i) => (pick(p) ? i : -1)).filter((i) => i >= 0)
  const spies = seatsOf((p) => p.alive && p.role === 'penyusup').length
  const asbun = seatsOf((p) => p.alive && p.role === 'asbun')
  const others = seatsOf((p) => p.alive && p.role !== 'penyusup').length
  if (spies > 0 && spies >= others) return { side: 'penyusup', seats: seatsOf((p) => p.role === 'penyusup'), reason: 'parity' }
  if (spies === 0 && asbun.length === 0) return { side: 'warga', seats: seatsOf((p) => p.role === 'warga'), reason: 'cleared' }
  if (spies === 0 && others <= 2) return { side: 'asbun', seats: asbun, reason: 'survived' }
  return null
}

function nextActive(s: AsbunState, from: number): number {
  const n = s.players.length
  for (let k = 1; k <= n; k++) {
    const seat = (from + k) % n
    if (s.players[seat].alive) return seat
  }
  return from
}

/** Ronde baru: urutan petunjuk berputar dari `starter`, hanya pemain aktif. */
function beginClues(s: AsbunState) {
  if (s.round > 0) s.starter = nextActive(s, s.starter)
  if (!s.players[s.starter].alive) s.starter = nextActive(s, s.starter)
  const n = s.players.length
  s.round++
  s.order = Array.from({ length: n }, (_, k) => (s.starter + k) % n).filter((seat) => s.players[seat].alive)
  s.turn = 0
  s.phase = 'clue'
  s.eliminated = null
  s.ballots = s.players.map(() => null)
  s.reactions = []
  log(s, `Ronde ${s.round}: putaran petunjuk dimulai dari ${s.players[s.order[0]].name}.`)
}

function addClue(s: AsbunState, text: string | null) {
  const by = s.order[s.turn]
  s.clues.push({ round: s.round, by, text })
  // Pesan penolakan sebelumnya tidak relevan lagi setelah giliran berganti.
  s.notice = null
  s.turn++
  if (s.turn >= s.order.length) {
    s.phase = 'discussion'
    log(s, 'Semua petunjuk masuk. Waktunya berdiskusi.')
  }
}

/**
 * Menutup voting. "Skip" dihitung seperti satu pilihan tersendiri: pemain baru dieliminasi kalau
 * suaranya terbanyak, tidak seri dengan pemain lain, dan lebih banyak dari suara skip.
 * Skip terbanyak, seri (termasuk seri dengan skip), atau tidak ada suara = tidak ada yang keluar.
 */
function closeVoting(s: AsbunState) {
  const tally = s.players.map(() => 0)
  let ballots = 0
  let skips = 0
  for (const target of s.ballots) {
    if (target === null) continue
    if (target === SKIP_VOTE) skips++
    else tally[target]++
    ballots++
  }
  const top = Math.max(...tally)
  const leaders = tally.flatMap((count, seat) => (count === top ? [seat] : []))
  const eliminated = top > 0 && top > skips && leaders.length === 1 ? leaders[0] : null
  s.results.push({ round: s.round, tally, skips, ballots, eliminated })
  s.eliminated = eliminated
  s.phase = 'elimination'
  if (eliminated === null) {
    log(
      s,
      skips > top
        ? 'Mayoritas memilih skip. Tidak ada yang dieliminasi.'
        : top > 0
          ? 'Suara seri. Tidak ada yang dieliminasi.'
          : 'Tidak ada suara. Tidak ada yang dieliminasi.',
    )
  } else {
    const player = s.players[eliminated]
    player.alive = false
    player.out = s.round
    log(s, `${player.name} dieliminasi. Perannya: ${ROLE_NAMES[player.role]}.`)
  }
}

/** Setelah hasil eliminasi/tebakan ditampilkan: cek pemenang, lalu ronde baru kalau belum ada. */
function proceed(s: AsbunState) {
  const winner = checkVictory(s.players)
  if (winner) return finish(s, winner)
  beginClues(s)
}

function finish(s: AsbunState, winner: Winner) {
  s.winner = winner
  s.phase = 'over'
  const text: Record<Winner['reason'], string> = {
    guess: 'Si Asbun menebak kata Warga dengan tepat dan menang!',
    parity: 'Penyusup berhasil menguasai kota. Penyusup menang!',
    cleared: 'Semua Penyusup dan Si Asbun tertangkap. Warga menang!',
    survived: 'Si Asbun bertahan sampai akhir. Si Asbun menang!',
  }
  log(s, text[winner.reason])
}

function resolveGuess(s: AsbunState, by: number, text: string | null) {
  const correct = text !== null && sameWord(text, s.words.warga)
  s.guesses.push({ round: s.round, by, text, correct })
  if (correct) {
    finish(s, { side: 'asbun', seats: [by], reason: 'guess' })
    return
  }
  log(s, text === null ? `${s.players[by].name} tidak sempat menebak.` : `Tebakan ${s.players[by].name} salah.`)
}

function notice(s: AsbunState, seat: number, text: string) {
  s.notice = { seat, text, seq: (s.notice?.seq ?? 0) + 1 }
}

export function reducer(state: AsbunState, action: Action): AsbunState {
  const s = structuredClone(state)
  if ('by' in action) {
    // Aksi pemain: hanya untuk fase dan ronde yang sedang berjalan, dari pemain yang masih aktif
    // (kecuali tebakan Si Asbun yang baru tereliminasi).
    const player = s.players[action.by]
    if (!player || action.round !== s.round || action.phase !== s.phase) return state
    if (!player.alive && action.type !== 'guess') return state
  }
  switch (action.type) {
    case 'ack': {
      const player = s.players[action.by]
      if (s.phase !== 'reveal' || player.acknowledged) return state
      player.acknowledged = true
      return s
    }
    case 'beginClues':
      if (s.phase !== 'reveal') return state
      beginClues(s)
      return s
    case 'clue': {
      if (s.phase !== 'clue' || s.order[s.turn] !== action.by || typeof action.text !== 'string') return state
      const own = wordFor(s.players[action.by].role, s.words)
      const problem = clueProblem(action.text, own)
      if (problem) {
        notice(
          s,
          action.by,
          problem === 'word'
            ? 'Petunjuk tidak boleh berisi kata rahasiamu sendiri.'
            : problem === 'long'
              ? 'Petunjuk terlalu panjang.'
              : 'Petunjuk masih kosong.',
        )
        return s
      }
      addClue(s, action.text.trim())
      return s
    }
    case 'clueTimeout':
      if (s.phase !== 'clue') return state
      log(s, `${s.players[s.order[s.turn]].name} kehabisan waktu tanpa memberi petunjuk.`)
      addClue(s, null)
      return s
    case 'react': {
      // Hanya pemain aktif saat diskusi (pemain yang sudah keluar tidak boleh memberi kode).
      if (s.phase !== 'discussion' || !REACTIONS.includes(action.emoji as Reaction)) return state
      const seq = (s.reactions[s.reactions.length - 1]?.seq ?? 0) + 1
      s.reactions = [...s.reactions, { seq, by: action.by, emoji: action.emoji as Reaction }].slice(-REACTION_KEEP)
      return s
    }
    case 'startVoting':
      if (s.phase !== 'discussion') return state
      s.phase = 'voting'
      s.ballots = s.players.map(() => null)
      log(s, 'Voting dibuka. Pilih tersangka secara rahasia.')
      return s
    case 'vote': {
      const target = action.target
      if (s.phase !== 'voting' || s.ballots[action.by] !== null) return state
      if (target !== SKIP_VOTE && (!Number.isInteger(target) || target === action.by || !s.players[target]?.alive)) return state
      s.ballots[action.by] = target
      return s
    }
    case 'closeVoting':
      if (s.phase !== 'voting') return state
      closeVoting(s)
      return s
    case 'guess': {
      if (s.phase !== 'guess' || s.eliminated !== action.by || s.guesses.some((g) => g.by === action.by && g.round === s.round)) return state
      if (typeof action.text !== 'string' || !action.text.trim()) return state
      resolveGuess(s, action.by, action.text.trim().slice(0, GUESS_MAX))
      return s
    }
    case 'guessTimeout':
      if (s.phase !== 'guess' || s.eliminated === null || s.guesses.some((g) => g.by === s.eliminated && g.round === s.round)) return state
      resolveGuess(s, s.eliminated, null)
      return s
    case 'proceed':
      if (s.phase === 'elimination') {
        const out = s.eliminated
        if (out !== null && s.players[out].role === 'asbun') {
          s.phase = 'guess'
          log(s, `${s.players[out].name} adalah Si Asbun! Ia mendapat satu kesempatan menebak kata Warga.`)
          return s
        }
        proceed(s)
        return s
      }
      // Tebakan salah (atau waktu habis) sudah ditampilkan; lanjut.
      if (s.phase === 'guess' && s.guesses.some((g) => g.by === s.eliminated && g.round === s.round)) {
        proceed(s)
        return s
      }
      return state
    default:
      return state
  }
}

/** Sudah ada tebakan dari Si Asbun yang sedang di fase `guess`. */
export function guessResolved<G extends Guess>(s: Pick<AsbunState, 'phase' | 'eliminated' | 'round'> & { guesses: G[] }): G | null {
  if (s.phase !== 'guess' && s.phase !== 'over') return null
  return s.guesses.find((g) => g.by === s.eliminated && g.round === s.round) ?? null
}

export interface PlayerView extends Omit<Player, 'role'> {
  /** Peran: milik sendiri, pemain yang sudah tereliminasi, atau semua setelah permainan selesai. */
  role: Role | null
}

export interface AsbunView extends Omit<AsbunState, 'words' | 'players' | 'ballots' | 'notice' | 'guesses'> {
  players: PlayerView[]
  /**
   * Tebakan Si Asbun. Teks tebakan yang salah disembunyikan (`hidden`) dari pemain lain sampai
   * permainan selesai, karena tebakan itu bisa saja kata Penyusup.
   */
  guesses: (Guess & { hidden?: boolean })[]
  me: { role: Role; word: string | null }
  /** Siapa yang sudah memasukkan suara (bukan pilihannya). */
  voted: boolean[]
  myVote: number | null
  /** Kedua kata, hanya setelah permainan selesai. */
  words: RoundWords | null
  /** Id kategori pasangan kata permainan ini; terbuka untuk semua pemain supaya petunjuk lebih terarah. */
  category: string
  notice: { text: string; seq: number } | null
}

/**
 * State yang dikirim ke kursi `seat`: hanya peran dan kata miliknya sendiri (kategorinya terbuka
 * untuk semua). Peran pemain lain baru terlihat setelah mereka tereliminasi, kata baru terlihat
 * setelah permainan selesai, dan pilihan voting tidak pernah dikirim (hanya jumlah suaranya
 * setelah voting ditutup).
 */
export function viewFor(s: AsbunState, seat: number): AsbunView {
  const over = s.phase === 'over'
  const { words: _words, players, ballots, notice: privateNotice, guesses, ...shared } = s
  const role = players[seat].role
  return {
    ...shared,
    players: players.map((player, i) => ({
      ...player,
      role: i === seat || over || !player.alive ? player.role : null,
    })),
    guesses: guesses.map((guess) =>
      over || guess.correct || guess.by === seat || guess.text === null ? guess : { ...guess, text: null, hidden: true },
    ),
    me: { role, word: wordFor(role, s.words) },
    voted: ballots.map((target) => target !== null),
    myVote: ballots[seat] ?? null,
    words: over ? s.words : null,
    category: s.words.category,
    notice: privateNotice && privateNotice.seat === seat ? { text: privateNotice.text, seq: privateNotice.seq } : null,
  }
}
