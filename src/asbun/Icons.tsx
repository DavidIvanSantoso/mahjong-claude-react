/**
 * Ikon garis kecil untuk ASBUN (projek ini tidak memakai library ikon). Semua 24×24, mengikuti
 * `currentColor`, dan disembunyikan dari pembaca layar (teks di sebelahnya yang menjelaskan).
 */
const PATHS = {
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  eyeOff: 'M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  host: 'M4 17h16M5 17l-1-9 5 4 3-6 3 6 5-4-1 9',
  offline: 'M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 12.6a10 10 0 0 1 4-2.4M19 12.6a10 10 0 0 0-2.3-1.7M2 8.8a15 15 0 0 1 4.3-2.6M12 20h.01',
  search: 'M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14Zm5 12 4.5 4.5',
  door: 'M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10',
  ballot: 'M5 4h14v16H5zM9 9l2 2 4-4M9 15h6',
  pen: 'M4 20l4-1 11-11-3-3L5 16l-1 4ZM14 6l3 3',
  clock: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Zm0 4v5l3 2',
  skull: 'M12 3a7 7 0 0 0-4 12.7V19h8v-3.3A7 7 0 0 0 12 3ZM9.5 11h.01M14.5 11h.01M10 19v2M14 19v2',
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      className={`as-icon ${className ?? ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
