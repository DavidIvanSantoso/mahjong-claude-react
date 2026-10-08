import { chiOptions, isWinningHand, matchingTiles } from './rules'
import { createWall, isFlower, kindIndex, sameKind, shuffle, sortTiles, type Tile } from './tiles'

export interface Meld {
  type: 'pong' | 'chi' | 'kong'
  tiles: Tile[]
  /** Kong dari empat ubin di tangan sendiri (bukan dari buangan). */
  concealed?: boolean
}

export interface Player {
  name: string
  hand: Tile[]
  melds: Meld[]
  /** Ubin bunga yang disisihkan; tidak ikut dihitung dalam 14 ubin. */
  flowers: Tile[]
  discards: Tile[]
}

export type Claim =
  | { player: number; type: 'win' }
  | { player: number; type: 'pong'; canKong: boolean }
  | { player: number; type: 'chi'; options: [Tile, Tile][] }

export interface KongOption {
  tile: Tile
  /** concealed: 4 kembar di tangan. added: menambah ubin ke-4 ke pong yang sudah dibuka. */
  kind: 'concealed' | 'added'
}

/**
 * setup   : memilih jumlah pemain
 * handoff : tangan disembunyikan, menunggu pemain berikutnya memegang perangkat
 * turn    : pemain `current` memegang 3n+2 ubin dan harus membuang (atau menang/kong)
 * claim   : pemain lain ditawari ubin buangan terakhir, satu per satu sesuai prioritas
 * over    : ada pemenang, atau seri karena dinding habis
 */
export type Phase = 'setup' | 'handoff' | 'turn' | 'claim' | 'over'

export interface GameState {
  phase: Phase
  players: Player[]
  wall: Tile[]
  current: number
  /** Ubin yang baru diambil dari dinding pada giliran ini. */
  drawnId: number | null
  /** Jumlah bunga yang didapat pada pengambilan terakhir. */
  flowersDrawn: number
  lastDiscard: { tile: Tile; from: number } | null
  claims: Claim[]
  claimRevealed: boolean
  winner: number | null
  winType: 'self' | 'discard' | null
}

export type Action =
  | { type: 'start'; names: string[] }
  | { type: 'reveal' }
  | { type: 'discard'; tileId: number }
  | { type: 'kong'; tileId: number }
  | { type: 'declareWin' }
  | { type: 'claim'; chiIndex?: number; kong?: boolean }
  | { type: 'pass' }
  | { type: 'reset' }

export const initialState: GameState = {
  phase: 'setup',
  players: [],
  wall: [],
  current: 0,
  drawnId: null,
  flowersDrawn: 0,
  lastDiscard: null,
  claims: [],
  claimRevealed: false,
  winner: null,
  winType: null,
}

const HAND_SIZE = 13

/**
 * Mengambil satu ubin dari dinding. Bunga langsung disisihkan dan diganti ubin baru.
 * `wall` dimutasi; `drawn` null berarti dinding habis.
 */
function drawTile(player: Player, wall: Tile[]): { player: Player; drawn: Tile | null; flowers: number } {
  const flowers = [...player.flowers]
  let drawn = wall.pop() ?? null
  while (drawn && isFlower(drawn)) {
    flowers.push(drawn)
    drawn = wall.pop() ?? null
  }
  return {
    player: {
      ...player,
      flowers,
      hand: drawn ? sortTiles([...player.hand, drawn]) : player.hand,
    },
    drawn,
    flowers: flowers.length - player.flowers.length,
  }
}

function replaceDealtFlowers(player: Player, wall: Tile[]): Player {
  const dealt = player.hand.filter(isFlower)
  let result: Player = {
    ...player,
    hand: player.hand.filter((tile) => !isFlower(tile)),
    flowers: dealt,
  }
  dealt.forEach(() => {
    result = drawTile(result, wall).player
  })
  return { ...result, hand: sortTiles(result.hand) }
}

function startGame(names: string[]): GameState {
  const wall = shuffle(createWall())
  const players = names
    .map((name) => ({
      name,
      hand: wall.splice(0, HAND_SIZE),
      melds: [],
      flowers: [],
      discards: [],
    }))
    .map((player) => replaceDealtFlowers(player, wall))
  return { ...initialState, phase: 'handoff', players, wall }
}

function updatePlayer(players: Player[], index: number, patch: Partial<Player>): Player[] {
  return players.map((player, i) => (i === index ? { ...player, ...patch } : player))
}

/** Pemain `index` mengambil ubin lalu menjalani gilirannya; seri kalau dinding habis. */
function drawAndStartTurn(state: GameState, index: number): GameState {
  const wall = [...state.wall]
  const result = drawTile(state.players[index], wall)
  const next: GameState = {
    ...state,
    wall,
    players: updatePlayer(state.players, index, result.player),
    current: index,
    claims: [],
    claimRevealed: false,
    drawnId: result.drawn?.id ?? null,
    flowersDrawn: result.flowers,
  }
  return { ...next, phase: result.drawn ? 'turn' : 'over' }
}

/** Giliran pindah ke pemain setelah pembuang; seri kalau dinding sudah habis. */
function advanceTurn(state: GameState, from: number): GameState {
  const base = { ...state, claims: [], claimRevealed: false, drawnId: null }
  if (state.wall.length === 0) return { ...base, phase: 'over' }
  return { ...base, phase: 'handoff', current: (from + 1) % state.players.length }
}

/** Prioritas klaim: menang > pong/kong > chi. Chi hanya untuk pemain tepat setelah pembuang. */
function findClaims(players: Player[], discard: Tile, from: number, wallLeft: number): Claim[] {
  const count = players.length
  const others = Array.from({ length: count - 1 }, (_, i) => (from + 1 + i) % count)

  const wins: Claim[] = others
    .filter((p) => isWinningHand([...players[p].hand, discard], players[p].melds.length))
    .map((p) => ({ player: p, type: 'win' }))

  const pongs: Claim[] = others
    .map((p) => ({ player: p, matches: matchingTiles(players[p].hand, discard).length }))
    .filter(({ matches }) => matches >= 2)
    // Kong butuh ubin pengganti, jadi tidak ditawarkan kalau dinding sudah habis.
    .map(({ player, matches }) => ({ player, type: 'pong', canKong: matches === 3 && wallLeft > 0 }))

  const next = others[0]
  const options = chiOptions(players[next].hand, discard)
  const chis: Claim[] = options.length > 0 ? [{ player: next, type: 'chi', options }] : []

  return [...wins, ...pongs, ...chis]
}

function discardTile(state: GameState, tileId: number): GameState {
  const player = state.players[state.current]
  const tile = player.hand.find((t) => t.id === tileId)
  if (!tile) return state

  const players = updatePlayer(state.players, state.current, {
    hand: player.hand.filter((t) => t.id !== tileId),
    discards: [...player.discards, tile],
  })
  const next: GameState = {
    ...state,
    players,
    drawnId: null,
    lastDiscard: { tile, from: state.current },
  }

  const claims = findClaims(players, tile, state.current, state.wall.length)
  if (claims.length === 0) return advanceTurn(next, state.current)
  return { ...next, phase: 'claim', claims, claimRevealed: false }
}

function acceptClaim(state: GameState, chiIndex = 0, kong = false): GameState {
  const claim = state.claims[0]
  const discard = state.lastDiscard
  if (!claim || !discard) return state

  const claimant = state.players[claim.player]
  const discarder = state.players[discard.from]
  // Ubin yang diklaim pindah dari tumpukan buangan ke tangan/set pengklaim.
  let players = updatePlayer(state.players, discard.from, {
    discards: discarder.discards.filter((t) => t.id !== discard.tile.id),
  })

  if (claim.type === 'win') {
    players = updatePlayer(players, claim.player, {
      hand: sortTiles([...claimant.hand, discard.tile]),
    })
    return {
      ...state,
      players,
      phase: 'over',
      claims: [],
      drawnId: discard.tile.id,
      winner: claim.player,
      winType: 'discard',
    }
  }

  const asKong = claim.type === 'pong' && claim.canKong && kong
  const used =
    claim.type === 'pong'
      ? matchingTiles(claimant.hand, discard.tile).slice(0, asKong ? 3 : 2)
      : claim.options[chiIndex]
  if (!used) return state

  const usedIds = new Set(used.map((t) => t.id))
  const meld: Meld = {
    type: asKong ? 'kong' : claim.type,
    tiles: sortTiles([...used, discard.tile]),
  }
  players = updatePlayer(players, claim.player, {
    hand: claimant.hand.filter((t) => !usedIds.has(t.id)),
    melds: [...claimant.melds, meld],
  })
  const next: GameState = { ...state, players, lastDiscard: null }

  if (asKong) return drawAndStartTurn(next, claim.player)
  // Pong/chi tidak mengambil dari dinding; pengklaim langsung membuang satu ubin.
  return {
    ...next,
    phase: 'turn',
    current: claim.player,
    claims: [],
    claimRevealed: false,
    drawnId: null,
    flowersDrawn: 0,
  }
}

export function canDeclareWin(state: GameState): boolean {
  if (state.phase !== 'turn') return false
  const player = state.players[state.current]
  return isWinningHand(player.hand, player.melds.length)
}

/** Kong yang bisa dinyatakan pemain pada gilirannya sendiri. */
export function kongOptions(state: GameState): KongOption[] {
  // Kong butuh ubin pengganti dari dinding.
  if (state.phase !== 'turn' || state.wall.length === 0) return []
  const player = state.players[state.current]

  const options: KongOption[] = []
  const seen = new Set<number>()
  for (const tile of player.hand) {
    const kind = kindIndex(tile)
    if (seen.has(kind)) continue
    seen.add(kind)

    if (matchingTiles(player.hand, tile).length === 4) {
      options.push({ tile, kind: 'concealed' })
    } else if (player.melds.some((m) => m.type === 'pong' && sameKind(m.tiles[0], tile))) {
      options.push({ tile, kind: 'added' })
    }
  }
  return options
}

function declareKong(state: GameState, tileId: number): GameState {
  const option = kongOptions(state).find((o) => o.tile.id === tileId)
  if (!option) return state
  const player = state.players[state.current]

  const patch: Partial<Player> =
    option.kind === 'concealed'
      ? {
          hand: player.hand.filter((t) => !sameKind(t, option.tile)),
          melds: [
            ...player.melds,
            { type: 'kong', tiles: matchingTiles(player.hand, option.tile), concealed: true },
          ],
        }
      : {
          hand: player.hand.filter((t) => t.id !== option.tile.id),
          melds: player.melds.map((m) =>
            m.type === 'pong' && sameKind(m.tiles[0], option.tile)
              ? { type: 'kong', tiles: [...m.tiles, option.tile] }
              : m,
          ),
        }

  const players = updatePlayer(state.players, state.current, patch)
  return drawAndStartTurn({ ...state, players }, state.current)
}

export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'start':
      return startGame(action.names)

    case 'reset':
      return initialState

    case 'reveal':
      if (state.phase === 'claim') return { ...state, claimRevealed: true }
      return state.phase === 'handoff' ? drawAndStartTurn(state, state.current) : state

    case 'discard':
      return state.phase === 'turn' ? discardTile(state, action.tileId) : state

    case 'kong':
      return declareKong(state, action.tileId)

    case 'declareWin':
      if (!canDeclareWin(state)) return state
      return { ...state, phase: 'over', winner: state.current, winType: 'self' }

    case 'claim':
      return state.phase === 'claim' ? acceptClaim(state, action.chiIndex, action.kong) : state

    case 'pass': {
      if (state.phase !== 'claim' || !state.lastDiscard) return state
      const claims = state.claims.slice(1)
      if (claims.length === 0) return advanceTurn(state, state.lastDiscard.from)
      // Kalau klaim berikutnya milik pemain yang sama, tangannya tidak perlu disembunyikan lagi.
      const samePlayer = claims[0].player === state.claims[0].player
      return { ...state, claims, claimRevealed: samePlayer && state.claimRevealed }
    }
  }
}
