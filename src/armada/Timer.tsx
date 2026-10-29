import { useEffect, useState, type CSSProperties } from 'react'

/** Sisa detik sampai `deadline` (jam perangkat ini), diperbarui beberapa kali per detik. */
export function useSecondsLeft(deadline: number | null): number | null {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (deadline === null) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [deadline])
  return deadline === null ? null : Math.max(0, Math.ceil((deadline - now) / 1000))
}

/** Bar waktu yang memendek, dengan angka detik; merah saat tinggal sedikit. */
export function TimerBar({ deadline, total }: { deadline: number | null; total: number }) {
  const left = useSecondsLeft(deadline)
  if (left === null) return <div className="ar-timer ar-timer--idle" aria-hidden="true" />
  return (
    <div className={`ar-timer ${left <= 5 ? 'ar-timer--low' : ''}`} role="timer" aria-label={`Sisa waktu ${left} detik`}>
      <span className="ar-timer__bar" style={{ '--left': Math.min(1, left / total) } as CSSProperties} />
      <span className="ar-timer__text">{left}s</span>
    </div>
  )
}
