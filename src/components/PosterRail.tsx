import { useCallback, useEffect, useRef, useState } from 'react'
import { PosterCard } from './PosterCard'
import type { CharacterWithStats } from '../types'

/**
 * 横向海报墙。桌面端鼠标滚轮无法横滑，所以补一对箭头，
 * 只在真的能滚动时出现；手机上隐藏，靠手指滑动。
 */
export function PosterRail({
  characters,
  showRank,
}: {
  characters: CharacterWithStats[]
  showRank: boolean
}) {
  const railRef = useRef<HTMLDivElement>(null)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)
  const [overflow, setOverflow] = useState(false)

  const sync = useCallback(() => {
    const el = railRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setOverflow(max > 6)
    setAtStart(el.scrollLeft <= 2)
    setAtEnd(el.scrollLeft >= max - 2)
  }, [])

  useEffect(() => {
    const el = railRef.current
    if (!el) return
    sync()
    el.addEventListener('scroll', sync, { passive: true })
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', sync)
      ro.disconnect()
    }
  }, [sync, characters.length])

  const step = (dir: number) => {
    const el = railRef.current
    if (!el) return
    el.scrollBy({ left: dir * Math.max(240, el.clientWidth * 0.85), behavior: 'smooth' })
  }

  return (
    <div className="poster-rail-wrap">
      <div className="poster-rail" ref={railRef}>
        {characters.map((c, i) => (
          <PosterCard key={c.id} character={c} rank={showRank ? i + 1 : undefined} />
        ))}
      </div>

      {overflow && (
        <>
          <button
            type="button"
            className="rail-nav prev"
            onClick={() => step(-1)}
            disabled={atStart}
            aria-label="往前看"
          >
            <Chevron dir="left" />
          </button>
          <button
            type="button"
            className="rail-nav next"
            onClick={() => step(1)}
            disabled={atEnd}
            aria-label="往后看"
          >
            <Chevron dir="right" />
          </button>
        </>
      )}
    </div>
  )
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
    </svg>
  )
}
