import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { firstChar, imageSrc, KIND_LABEL, shade } from '../utils'
import type { Work } from '../types'

/** 自动换页间隔：太快看不清，太慢像卡住 */
const AUTOPLAY_MS = 5600
/** 每次随机抽这么多部作品，作品再多也不会滑到天荒地老 */
const SLIDE_COUNT = 3

/** Fisher–Yates 洗牌后取前 n 个，保证「随机」是真的等概率，而不是随机起点顺序遍历 */
function pickRandom(works: Work[], n: number): Work[] {
  const pool = [...works]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, n)
}

export function HeroCarousel({
  works,
  countByWork,
}: {
  works: Work[]
  countByWork: Map<number, number>
}) {
  // 只抽一次：刷新/重进页面才换一批，避免点赞后数据重载导致轮播图突然换人
  const pickedIds = useRef<number[]>([])
  const slides = useMemo(() => {
    const byId = new Map(works.map((w) => [w.id, w]))
    const kept = pickedIds.current
      .map((id) => byId.get(id))
      .filter((w): w is Work => Boolean(w))
    // 首次渲染，或抽中的作品被下架删除，就重新抽一批
    if (kept.length > 0 && kept.length === pickedIds.current.length) return kept
    const fresh = pickRandom(works, SLIDE_COUNT)
    pickedIds.current = fresh.map((w) => w.id)
    return fresh
  }, [works])
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const touchStartX = useRef<number | null>(null)

  const count = slides.length

  const go = useCallback(
    (next: number) => {
      if (count === 0) return
      setIndex(((next % count) + count) % count)
    },
    [count],
  )

  // 自动播放：鼠标悬停、键盘聚焦、系统要求减少动效时都停下来
  useEffect(() => {
    if (paused || count < 2) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS)
    return () => window.clearInterval(timer)
  }, [paused, count])

  // 作品被删到只剩几张时，别让 index 越界停在空白上
  useEffect(() => {
    if (count > 0 && index > count - 1) setIndex(count - 1)
  }, [count, index])

  if (count === 0) return null

  return (
    <section
      className="carousel"
      aria-roledescription="carousel"
      aria-label="精选作品轮播"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div
        className="carousel-viewport"
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0]?.clientX ?? null
        }}
        onTouchEnd={(e) => {
          const start = touchStartX.current
          touchStartX.current = null
          if (start === null) return
          const delta = (e.changedTouches[0]?.clientX ?? start) - start
          if (Math.abs(delta) < 42) return
          go(index + (delta < 0 ? 1 : -1))
        }}
      >
        <div className="carousel-track" style={{ transform: `translateX(-${index * 100}%)` }}>
          {slides.map((work, i) => {
            const cover = imageSrc(work.cover_data, work.cover_url)
            const accent = work.accent || '#c2417a'
            const active = i === index
            return (
              <a
                className="carousel-slide"
                href={`#/work/${work.id}`}
                key={work.id}
                aria-hidden={!active}
                tabIndex={active ? 0 : -1}
              >
                <div
                  className="carousel-art"
                  style={
                    cover
                      ? { backgroundImage: `url(${cover})` }
                      : {
                          backgroundImage: `linear-gradient(135deg, ${shade(accent, -10)}, ${shade(
                            accent,
                            -72,
                          )})`,
                        }
                  }
                />
                {!cover && <span className="carousel-initial">{firstChar(work.title)}</span>}
                <div className="carousel-shade" />
                <div className="carousel-copy">
                  <span className="carousel-tag">
                    {KIND_LABEL[work.kind] ?? '作品'}
                    {work.year ? ` · ${work.year}` : ''}
                  </span>
                  <h2 className="carousel-title">{work.title}</h2>
                  <p className="carousel-meta">
                    {work.title_jp ? <span className="carousel-meta-jp">{work.title_jp} · </span> : ''}
                    {countByWork.get(work.id) ?? 0} 位角色
                  </p>
                  {work.summary && <p className="carousel-summary">{work.summary}</p>}
                  <span className="carousel-cta">进入作品 →</span>
                </div>
              </a>
            )
          })}
        </div>

        {count > 1 && (
          <>
            <button
              type="button"
              className="carousel-arrow prev"
              aria-label="上一张"
              onClick={() => go(index - 1)}
            >
              ‹
            </button>
            <button
              type="button"
              className="carousel-arrow next"
              aria-label="下一张"
              onClick={() => go(index + 1)}
            >
              ›
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="carousel-bar">
          <div className="carousel-dots">
            {slides.map((work, i) => (
              <button
                type="button"
                key={work.id}
                className={i === index ? 'carousel-dot active' : 'carousel-dot'}
                aria-label={`第 ${i + 1} 张：${work.title}`}
                aria-current={i === index}
                onClick={() => go(i)}
              />
            ))}
          </div>
          <span className="carousel-count">
            {index + 1} / {count}
          </span>
        </div>
      )}
    </section>
  )
}
