import { useEffect, useId, useMemo, useRef, useState, type RefObject } from 'react'

/**
 * Latar beranda ASBUN: papan penyelidikan ala film detektif. Peta kota tipis bergaris emas, barang bukti
 * yang ditempel (foto tersangka, catatan, kliping koran, sidik jari), lalu satu per satu titik di peta
 * ditandai paku merah dan disambung benang merah sampai ke foto tersangka yang dilingkari. Kaca pembesar
 * mengikuti titik terbaru. Setiap putaran titik petanya berganti.
 *
 * Murni hiasan (aria-hidden). Animasi garis/paku memakai CSS (asbun.css); posisi kaca pembesar ditulis
 * langsung ke DOM tiap frame.
 */

/** Jeda antar langkah benang (ms), lama tahan setelah tersangka dilingkari, dan lama memudar. */
const STEP_MS = 1500
const HOLD_MS = 3200
const FADE_MS = 900
const LENS_RADIUS = 64
const LENS_ZOOM = 1.7

const CLUES = ['22.15 · terlihat di sini', 'Alibi?', 'Saksi terakhir', 'Kata: ???', 'Jejak kaki', 'Sinyal hilang', 'Pertemuan rahasia', 'Bohong?']
const DISTRICTS = ['PELABUHAN', 'STASIUN KOTA', 'PASAR LAMA', 'DISTRIK 7', 'TAMAN KOTA', 'GUDANG TUA', 'JL. MERDEKA', 'KAMPUNG ARAB']

type Kind = 'suspect' | 'note' | 'news' | 'print' | 'witness'
const SIZE: Record<Kind, [number, number]> = { suspect: [112, 138], note: [134, 112], news: [158, 126], print: [106, 126], witness: [104, 128] }
/** Urutan penempatan: tersangka selalu ada; yang lain kalau masih ada tempat. */
const KINDS: Kind[] = ['suspect', 'note', 'news', 'print', 'witness']

interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

interface Point {
  x: number
  y: number
}

interface Item extends Point {
  kind: Kind
  rot: number
  scale: number
  /** Titik paku (ujung atas barang, sudah diputar). */
  pin: Point
  box: Box
}

interface MapData {
  streets: string[]
  roads: string[]
  river: string
  blocks: { x: number; y: number; w: number; h: number }[]
  labels: { x: number; y: number; text: string; rot: number }[]
  angle: number
  compass: Point | null
}

interface Stop extends Point {
  /** Paku di peta (bukan barang bukti) beserta catatannya. */
  clue?: string
}

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), a | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32
  }
}

const inside = (p: Point, b: Box, pad = 0) => p.x > b.left - pad && p.x < b.right + pad && p.y > b.top - pad && p.y < b.bottom + pad
const overlaps = (a: Box, b: Box) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top

/** Peta kota: kisi jalan miring dengan beberapa jalan buntu, jalan besar melengkung, sungai, blok, nama distrik. */
function makeMap(w: number, h: number, covers: Box[], rand: () => number): MapData {
  const angle = -0.1 - rand() * 0.08
  const ux = Math.cos(angle)
  const uy = Math.sin(angle)
  const cx = w / 2
  const cy = h / 2
  const reach = Math.hypot(w, h) / 2 + 40
  const streets: string[] = []
  const line = (spacing: number, along: [number, number], across: [number, number]) => {
    for (let k = -Math.ceil(reach / spacing); k <= Math.ceil(reach / spacing); k++) {
      const ox = cx + across[0] * k * spacing
      const oy = cy + across[1] * k * spacing
      // Dipotong-potong: sebagian ruas dihilangkan supaya terlihat seperti peta kota, bukan kisi.
      let s = -reach
      while (s < reach) {
        const len = 80 + rand() * 220
        if (rand() > 0.22) {
          const e = Math.min(reach, s + len)
          streets.push(`M${(ox + along[0] * s).toFixed(1)} ${(oy + along[1] * s).toFixed(1)}L${(ox + along[0] * e).toFixed(1)} ${(oy + along[1] * e).toFixed(1)}`)
        }
        s += len + (rand() < 0.3 ? 30 + rand() * 60 : 0)
      }
    }
  }
  line(96, [ux, uy], [-uy, ux])
  line(128, [-uy, ux], [ux, uy])
  const roads = Array.from({ length: 3 }, (_, i) => {
    const y0 = h * (0.15 + i * 0.33) + (rand() - 0.5) * 80
    const y1 = h * (0.2 + i * 0.3) + (rand() - 0.5) * 120
    return `M-40 ${y0.toFixed(0)}C${(w * 0.3).toFixed(0)} ${(y0 + (rand() - 0.5) * 240).toFixed(0)} ${(w * 0.7).toFixed(0)} ${(y1 + (rand() - 0.5) * 240).toFixed(0)} ${w + 40} ${y1.toFixed(0)}`
  })
  const rx = w * (0.15 + rand() * 0.2)
  const river = `M${rx.toFixed(0)} -40C${(rx + 160).toFixed(0)} ${(h * 0.3).toFixed(0)} ${(rx - 120).toFixed(0)} ${(h * 0.6).toFixed(0)} ${(rx + w * 0.25).toFixed(0)} ${h + 40}`
  const blocks = Array.from({ length: Math.round((w * h) / 90000) }, () => ({ x: rand() * w, y: rand() * h, w: 30 + rand() * 50, h: 22 + rand() * 40 }))
  const free = (p: Point) => !covers.some((box) => inside(p, box, 40))
  const labels: MapData['labels'] = []
  for (let tries = 0; tries < 60 && labels.length < 6; tries++) {
    const p = { x: 60 + rand() * (w - 120), y: 100 + rand() * (h - 160) }
    if (!free(p) || labels.some((l) => Math.hypot(l.x - p.x, l.y - p.y) < 220)) continue
    labels.push({ ...p, text: DISTRICTS[labels.length % DISTRICTS.length], rot: (angle * 180) / Math.PI })
  }
  const corners = [
    { x: 70, y: h - 70 },
    { x: w - 70, y: h * 0.5 },
    { x: 70, y: h * 0.5 },
    { x: w - 70, y: 140 },
  ]
  return { streets, roads, river, blocks, labels, angle, compass: corners.find(free) ?? null }
}

/** Barang bukti di kiri/kanan kartu; di layar sempit sebagian tertutup kartu (tidak apa, hanya hiasan). */
function placeItems(w: number, h: number, card: Box, others: Box[], rand: () => number): Item[] {
  const left = card.left
  const right = w - card.right
  const scale = Math.max(0.62, Math.min(1, Math.min(left, right) / 200))
  const anchors: Point[] = [
    { x: left / 2, y: h * 0.32 },
    { x: card.right + right / 2, y: h * 0.26 },
    { x: card.right + right / 2, y: h * 0.58 },
    { x: left / 2, y: h * 0.7 },
    { x: card.right + right / 2, y: h * 0.86 },
  ]
  const items: Item[] = []
  let anchor = 0
  for (const kind of KINDS) {
    while (anchor < anchors.length) {
      const at = anchors[anchor++]
      const [iw, ih] = SIZE[kind]
      const box = { left: at.x - (iw * scale) / 2, top: at.y - (ih * scale) / 2, right: at.x + (iw * scale) / 2, bottom: at.y + (ih * scale) / 2 }
      if (others.some((other) => overlaps(box, { left: other.left - 12, top: other.top - 12, right: other.right + 12, bottom: other.bottom + 12 }))) continue
      if (box.top < 0 || box.bottom > h) continue
      const rot = ((rand() - 0.5) * 14 * Math.PI) / 180
      const dy = -(ih / 2 - 9) * scale
      items.push({ kind, x: at.x, y: at.y, rot, scale, box, pin: { x: at.x - dy * Math.sin(rot), y: at.y + dy * Math.cos(rot) } })
      break
    }
  }
  return items
}

/** Titik-titik peta untuk satu putaran: di tempat kosong, berjauhan satu sama lain. */
function pickStops(w: number, h: number, covers: Box[], items: Item[], rand: () => number): Stop[] {
  const stops: Stop[] = []
  const clues = [...CLUES].sort(() => rand() - 0.5)
  for (let tries = 0; tries < 300 && stops.length < 3; tries++) {
    const p = { x: 50 + rand() * (w - 100), y: 90 + rand() * (h - 140) }
    if (covers.some((box) => inside(p, box, 40))) continue
    if (items.some((item) => inside(p, item.box, 60))) continue
    if (stops.some((s) => Math.hypot(s.x - p.x, s.y - p.y) < (tries < 200 ? 220 : 140))) continue
    stops.push({ ...p, clue: clues[stops.length] })
  }
  return stops
}

/** Rute benang: barang bukti → titik peta → … → foto tersangka (selalu terakhir). */
function makeRoute(items: Item[], stops: Stop[]): Stop[] {
  const suspect = items.find((item) => item.kind === 'suspect')
  const others = items.filter((item) => item !== suspect).map((item) => item.pin)
  const route: Stop[] = []
  if (others[0]) route.push(others[0])
  if (stops[0]) route.push(stops[0])
  if (others[1]) route.push(others[1])
  route.push(...stops.slice(1))
  if (others[2]) route.push(others[2])
  if (suspect) route.push(suspect.pin)
  return route
}

/** Benang merah sedikit melengkung ke bawah (seperti ditarik gravitasi). */
function stringPath(a: Point, b: Point): string {
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2 + Math.min(40, Math.hypot(b.x - a.x, b.y - a.y) * 0.08)
  return `M${a.x.toFixed(1)} ${a.y.toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`
}

function Pin({ at, delay = 0 }: { at: Point; delay?: number }) {
  return (
    <g transform={`translate(${at.x.toFixed(1)} ${at.y.toFixed(1)})`}>
      <g className="as-board__pin" style={{ animationDelay: `${delay}ms` }}>
        <ellipse cx="3" cy="6" rx="6" ry="3" className="as-board__pin-shadow" />
        <circle r="6.5" className="as-board__pin-head" />
        <circle cx="-2" cy="-2.2" r="2" className="as-board__pin-shine" />
      </g>
    </g>
  )
}

function Evidence({ item, index }: { item: Item; index: number }) {
  const [w, h] = SIZE[item.kind]
  const x = -w / 2
  const y = -h / 2
  let body
  switch (item.kind) {
    case 'suspect':
    case 'witness': {
      const photo = w - 16
      body = (
        <>
          <rect x={x} y={y} width={w} height={h} className="as-board__paper" />
          <rect x={x + 8} y={y + 8} width={photo} height={photo} className="as-board__photo" />
          {/* Siluet kepala dan bahu */}
          <circle cx={0} cy={y + 8 + photo * 0.4} r={photo * 0.17} className="as-board__silhouette" />
          <path d={`M${-photo * 0.36} ${y + 8 + photo}Q${-photo * 0.34} ${y + 8 + photo * 0.6} 0 ${y + 8 + photo * 0.6}Q${photo * 0.34} ${y + 8 + photo * 0.6} ${photo * 0.36} ${y + 8 + photo}Z`} className="as-board__silhouette" />
          <text x={0} y={y + 8 + photo * 0.5} className="as-board__question">
            ?
          </text>
          <text x={0} y={y + h - 9} className="as-board__script">
            {item.kind === 'suspect' ? 'Tersangka' : 'Saksi?'}
          </text>
        </>
      )
      break
    }
    case 'note':
      body = (
        <>
          <rect x={x} y={y} width={w} height={h} className="as-board__note" />
          {[0, 1, 2, 3].map((i) => (
            <line key={i} x1={x + 10} x2={x + w - 10} y1={y + 38 + i * 18} y2={y + 38 + i * 18} className="as-board__rule" />
          ))}
          <text x={x + 12} y={y + 32} className="as-board__hand">
            Siapa yang
          </text>
          <text x={x + 12} y={y + 50} className="as-board__hand">
            tidak tahu
          </text>
          <text x={x + 12} y={y + 68} className="as-board__hand">
            katanya?
          </text>
          <path d={`M${x + 14} ${y + 84}q30 -8 70 0`} className="as-board__underline" />
        </>
      )
      break
    case 'news':
      body = (
        <>
          <path d={`M${x} ${y}h${w}l-4 ${h * 0.3}l4 ${h * 0.3}l-3 ${h * 0.4}H${x + 3}l-3 ${-h * 0.5}z`} className="as-board__news" />
          <text x={x + 10} y={y + 22} className="as-board__headline">
            KATA RAHASIA
          </text>
          <text x={x + 10} y={y + 40} className="as-board__headline">
            BOCOR?
          </text>
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x={x + 10} y={y + 52 + i * 12} width={w - 26 - (i % 2) * 22} height={4} className="as-board__type" />
          ))}
        </>
      )
      break
    case 'print':
      body = (
        <>
          <rect x={x} y={y} width={w} height={h} className="as-board__paper" />
          <g transform={`translate(0 ${y + h * 0.42})`}>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <ellipse key={i} rx={8 + i * 5} ry={11 + i * 6} className="as-board__whorl" strokeDasharray={i % 2 ? '14 4' : '22 3'} />
            ))}
          </g>
          <text x={0} y={y + h - 10} className="as-board__label">
            BUKTI #07
          </text>
        </>
      )
      break
  }
  return (
    <g transform={`translate(${item.x.toFixed(1)} ${item.y.toFixed(1)}) rotate(${((item.rot * 180) / Math.PI).toFixed(2)}) scale(${item.scale.toFixed(3)})`}>
      <g className="as-board__item" style={{ animationDelay: `${300 + index * 220}ms` }}>
        <g className="as-board__item-shadow">{body}</g>
      </g>
    </g>
  )
}

export function AsbunBoard({ cardRef }: { cardRef: RefObject<HTMLElement | null> }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const lensRef = useRef<SVGGElement>(null)
  const zoomRef = useRef<SVGGElement>(null)
  const id = useId().replace(/:/g, '')
  const [frame, setFrame] = useState<{ w: number; h: number; covers: Box[]; seed: number } | null>(null)
  const [round, setRound] = useState(0)
  const [step, setStep] = useState(0)
  const [fading, setFading] = useState(false)
  const reduced = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  // Ukuran papan dan posisi elemen yang menutupinya (kartu, navbar, tombol musik, kredit).
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let last = ''
    const measure = () => {
      const own = svg.getBoundingClientRect()
      if (own.width < 1 || own.height < 1) return
      const parent = svg.parentElement
      const others = parent ? [...parent.querySelectorAll<HTMLElement>(':scope > :is(.game-nav, .home__tools, .home__credit)')] : []
      const covers = [cardRef.current, ...others].flatMap((element) => {
        const box = element?.getBoundingClientRect()
        return box ? [{ left: box.left - own.left, top: box.top - own.top, right: box.right - own.left, bottom: box.bottom - own.top }] : []
      })
      const key = `${Math.round(own.width)}x${Math.round(own.height)}`
      if (key === last) return
      last = key
      setFrame({ w: own.width, h: own.height, covers, seed: Math.floor(Math.random() * 2 ** 31) })
      setRound(0)
      setStep(0)
      setFading(false)
    }
    measure()
    const observer = new ResizeObserver(() => {
      clearTimeout(timer)
      timer = setTimeout(measure, 200)
    })
    observer.observe(svg)
    return () => {
      clearTimeout(timer)
      observer.disconnect()
    }
  }, [cardRef])

  const board = useMemo(() => {
    if (!frame) return null
    const rand = rng(frame.seed)
    const card = frame.covers[0] ?? { left: frame.w / 2 - 280, top: frame.h / 2 - 260, right: frame.w / 2 + 280, bottom: frame.h / 2 + 260 }
    const map = makeMap(frame.w, frame.h, frame.covers, rand)
    const items = placeItems(frame.w, frame.h, card, frame.covers.slice(1), rand)
    return { map, items }
  }, [frame])

  const route = useMemo(() => {
    if (!frame || !board) return { stops: [] as Stop[], path: [] as Stop[] }
    const stops = pickStops(frame.w, frame.h, frame.covers, board.items, rng(frame.seed + round * 7919))
    return { stops, path: makeRoute(board.items, stops) }
  }, [frame, board, round])

  // Urutan putaran: tiap STEP_MS satu benang lagi; setelah tersangka dilingkari, tahan, pudar, lalu ganti titik.
  useEffect(() => {
    if (!route.path.length) return
    if (reduced) {
      setStep(route.path.length - 1)
      return
    }
    if (step < route.path.length - 1) {
      const timer = setTimeout(() => setStep((s) => s + 1), step === 0 ? 1600 : STEP_MS)
      return () => clearTimeout(timer)
    }
    const fade = setTimeout(() => setFading(true), HOLD_MS)
    const next = setTimeout(() => {
      setFading(false)
      setStep(0)
      setRound((r) => r + 1)
    }, HOLD_MS + FADE_MS)
    return () => {
      clearTimeout(fade)
      clearTimeout(next)
    }
  }, [route, step, reduced])

  // Kaca pembesar: meluncur halus ke titik peta terakhir yang ditandai, sambil sedikit bergoyang.
  const lensTarget = useRef<Point | null>(null)
  const reachedStops = route.path.slice(0, step + 1).filter((stop) => stop.clue)
  lensTarget.current = reachedStops[reachedStops.length - 1] ?? route.stops[0] ?? null
  useEffect(() => {
    if (!frame || reduced) return
    let raf = 0
    let last = 0
    const pos = { x: frame.w * 0.2, y: frame.h * 0.75 }
    const loop = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0
      last = now
      const target = lensTarget.current
      if (target) {
        const k = 1 - Math.exp(-dt * 2.2)
        // Kaca berhenti sedikit di samping paku supaya pakunya tetap terlihat.
        pos.x += (target.x + 34 - pos.x) * k
        pos.y += (target.y + 26 - pos.y) * k
      }
      const x = pos.x + Math.sin(now / 900) * 6
      const y = pos.y + Math.cos(now / 1100) * 5
      lensRef.current?.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`)
      zoomRef.current?.setAttribute('transform', `scale(${LENS_ZOOM}) translate(${(-x).toFixed(1)} ${(-y).toFixed(1)})`)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [frame, reduced])

  const mapId = `as-map-${id}`
  const clipId = `as-lens-${id}`
  const suspect = board?.items.find((item) => item.kind === 'suspect')

  return (
    <svg ref={svgRef} className="as-board" aria-hidden="true" width="100%" height="100%" viewBox={frame ? `0 0 ${frame.w} ${frame.h}` : undefined}>
      {frame && board && (
        <>
          <defs>
            <clipPath id={clipId}>
              <circle r={LENS_RADIUS} />
            </clipPath>
          </defs>
          <g id={mapId} className="as-board__map">
            <path d={board.map.river} className="as-board__river" pathLength={1} />
            {board.map.blocks.map((block, i) => (
              <rect key={i} x={block.x} y={block.y} width={block.w} height={block.h} transform={`rotate(${((board.map.angle * 180) / Math.PI).toFixed(2)} ${block.x} ${block.y})`} className="as-board__block" />
            ))}
            {board.map.streets.map((d, i) => (
              <path key={i} d={d} className="as-board__street" pathLength={1} style={{ animationDelay: `${(i % 24) * 60}ms` }} />
            ))}
            {board.map.roads.map((d, i) => (
              <path key={i} d={d} className="as-board__road" pathLength={1} style={{ animationDelay: `${400 + i * 300}ms` }} />
            ))}
            {board.map.labels.map((label, i) => (
              <text key={i} x={label.x} y={label.y} transform={`rotate(${label.rot.toFixed(2)} ${label.x} ${label.y})`} className="as-board__district">
                {label.text}
              </text>
            ))}
            {board.map.compass && (
              <g transform={`translate(${board.map.compass.x} ${board.map.compass.y})`} className="as-board__compass">
                <circle r="26" />
                <path d="M0 -34L6 0L0 34L-6 0Z" />
                <text y="-40">U</text>
              </g>
            )}
          </g>

          {!reduced && (
            <g ref={lensRef} className="as-board__lens">
              <g clipPath={`url(#${clipId})`}>
                <circle r={LENS_RADIUS} className="as-board__lens-bg" />
                <g ref={zoomRef}>
                  <use href={`#${mapId}`} />
                </g>
              </g>
              <circle r={LENS_RADIUS} className="as-board__lens-glass" />
              <path d={`M${LENS_RADIUS * 0.72} ${LENS_RADIUS * 0.72}L${LENS_RADIUS * 1.45} ${LENS_RADIUS * 1.45}`} className="as-board__lens-handle" />
              <path d={`M${-LENS_RADIUS * 0.6} ${-LENS_RADIUS * 0.2}A${LENS_RADIUS * 0.65} ${LENS_RADIUS * 0.65} 0 0 1 ${-LENS_RADIUS * 0.15} ${-LENS_RADIUS * 0.62}`} className="as-board__lens-shine" />
            </g>
          )}

          {board.items.map((item, i) => (
            <Evidence key={item.kind} item={item} index={i} />
          ))}
          {board.items.map((item, i) => (
            <Pin key={item.kind} at={item.pin} delay={500 + i * 220} />
          ))}

          <g key={round} className={`as-board__round ${fading ? 'is-fading' : ''}`}>
            {route.path.slice(1, step + 1).map((stop, i) => (
              <path key={i} d={stringPath(route.path[i], stop)} className="as-board__string" pathLength={1} />
            ))}
            {route.path.slice(0, step + 1).map((stop, i) =>
              stop.clue ? (
                <g key={i}>
                  <circle cx={stop.x} cy={stop.y} r="10" className="as-board__ping" />
                  <Pin at={stop} delay={500} />
                  <text x={stop.x > frame.w - 220 ? stop.x - 14 : stop.x + 14} y={stop.y - 12} textAnchor={stop.x > frame.w - 220 ? 'end' : 'start'} className="as-board__clue">
                    {stop.clue}
                  </text>
                </g>
              ) : null,
            )}
            {suspect && step === route.path.length - 1 && (
              <ellipse
                cx={suspect.x}
                cy={suspect.y}
                rx={SIZE.suspect[0] * suspect.scale * 0.72}
                ry={SIZE.suspect[1] * suspect.scale * 0.66}
                transform={`rotate(-8 ${suspect.x} ${suspect.y})`}
                className="as-board__circle"
                pathLength={1}
              />
            )}
          </g>
        </>
      )}
    </svg>
  )
}
