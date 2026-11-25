import { useMemo, useState } from 'react'
import { useApp } from '../store'
import { PosterRail } from '../components/PosterRail'
import { HeroCarousel } from '../components/HeroCarousel'
import { WorkCard } from '../components/WorkCard'
import { Avatar } from '../components/Avatar'
import { cnNumber, imageSrc, KIND_LABEL } from '../utils'
import type { CharacterWithStats } from '../types'

function matches(c: CharacterWithStats, q: string): boolean {
  const hay = [
    c.name,
    c.name_jp,
    c.cv,
    c.role,
    c.description,
    c.work?.title,
    c.work?.title_jp,
    c.work?.studio,
    ...(c.tags ?? []),
    ...(c.work?.tags ?? []),
  ]
  return hay.some((v) => (v ?? '').toLowerCase().includes(q))
}

type WorkKind = 'all' | 'anime' | 'game'

const KIND_TABS: { key: WorkKind; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'anime', label: '动漫' },
  { key: 'game', label: '游戏' },
]

/** 库里只有 anime / game 两类，历史脏值一律当动漫处理，避免出现「第三类」空壳 */
function kindOf(work: { kind: string }): 'anime' | 'game' {
  return work.kind === 'game' ? 'game' : 'anime'
}

export function HomePage() {
  const { loading, loadError, reload, setContributeOpen, publicCharacters, publicWorks } = useApp()
  const [query, setQuery] = useState('')
  const [workKind, setWorkKind] = useState<WorkKind>('all')

  const characters = publicCharacters
  const works = publicWorks

  const charCountByWork = useMemo(() => {
    const map = new Map<number, number>()
    for (const c of characters) map.set(c.work_id, (map.get(c.work_id) ?? 0) + 1)
    return map
  }, [characters])

  const hotTags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of characters) {
      for (const t of c.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([t]) => t)
  }, [characters])

  const q = query.trim().toLowerCase()
  const results = useMemo(
    () => (q ? characters.filter((c) => matches(c, q)) : []),
    [characters, q],
  )
  const matchedWorks = useMemo(() => {
    if (!q) return []
    return works.filter((w) =>
      [w.title, w.title_jp, w.studio, ...(w.tags ?? [])].some((v) =>
        (v ?? '').toLowerCase().includes(q),
      ),
    )
  }, [works, q])

  const totalHeat = characters.reduce((sum, c) => sum + c.stats.heat, 0)

  // 「此刻最热」要真的是最热：按热度排，同热度再看点赞、收藏，最后按 id 稳定顺序
  const hotCharacters = useMemo(
    () =>
      [...characters].sort(
        (a, b) =>
          b.stats.heat - a.stats.heat ||
          b.stats.like_count - a.stats.like_count ||
          b.stats.favorite_count - a.stats.favorite_count ||
          a.id - b.id,
      ),
    [characters],
  )

  // 作品目录的分类：全部 / 动漫 / 游戏，按 kind 现算，不做第二套分类表
  const worksByKind = useMemo(
    () => ({
      all: works,
      anime: works.filter((w) => kindOf(w) === 'anime'),
      game: works.filter((w) => kindOf(w) === 'game'),
    }),
    [works],
  )
  const visibleWorks = worksByKind[workKind]
  const visibleCharCount = useMemo(
    () => visibleWorks.reduce((n, w) => n + (charCountByWork.get(w.id) ?? 0), 0),
    [visibleWorks, charCountByWork],
  )
  const visibleHeat = useMemo(() => {
    if (workKind === 'all') return totalHeat
    const ids = new Set(visibleWorks.map((w) => w.id))
    return characters.reduce((s, c) => (ids.has(c.work_id) ? s + c.stats.heat : s), 0)
  }, [workKind, visibleWorks, characters, totalHeat])

  if (loading) {
    return (
      <div className="wrap">
        <section className="hero">
          <div className="hero-eyebrow">Character Index</div>
          <h1>
            这个角色，<em>出自哪部作品？</em>
          </h1>
        </section>
        <div className="poster-rail">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              className="skeleton"
              key={i}
              style={{ flex: '0 0 200px', aspectRatio: '2 / 3', height: 'auto' }}
            />
          ))}
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="wrap">
        <div className="empty" style={{ marginTop: 80 }}>
          <b>图鉴没能翻开</b>
          {loadError}
          <div style={{ marginTop: 14 }}>
            <button type="button" className="btn btn-primary" onClick={() => void reload()}>
              重新加载
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="wrap">
      {/* 搜索时就别让轮播分散注意力，直接收起来 */}
      {!q && <HeroCarousel works={works} countByWork={charCountByWork} />}

      <section className="hero">
        <div className="hero-eyebrow">Character Index</div>
        <h1>
          这个角色，<em>出自哪部作品？</em>
        </h1>
        <p>
          搜角色名、日文名、声优或标签，一眼看清 TA 属于哪部动漫或游戏。也可以反过来，按作品翻完整角色表。
        </p>

        <div className="search-shell">
          <div className="search-box">
            <SearchIcon />
            <input
              className="search-input"
              type="search"
              placeholder="试试「芙莉莲」「五条悟」「花江夏树」…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="搜索角色"
            />
            {query && (
              <button
                type="button"
                className="search-clear"
                onClick={() => setQuery('')}
                aria-label="清空搜索"
              >
                ×
              </button>
            )}
          </div>
          <div className="chip-row">
            {hotTags.map((t) => (
              <button
                type="button"
                key={t}
                className={query === t ? 'chip active' : 'chip'}
                onClick={() => setQuery(query === t ? '' : t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </section>

      {q ? (
        <>
          <div className="section-head">
            <h2>搜索结果</h2>
            <span className="hint">
              {results.length} 位角色
              {matchedWorks.length > 0 ? ` · ${matchedWorks.length} 部作品` : ''}
            </span>
          </div>

          {matchedWorks.length > 0 && (
            <div style={{ marginBottom: 26 }}>
              <div className="tag-row" style={{ marginBottom: 10 }}>
                <span className="badge">匹配作品</span>
              </div>
              <div className="work-grid">
                {matchedWorks.map((w) => (
                  <WorkCard key={w.id} work={w} count={charCountByWork.get(w.id) ?? 0} />
                ))}
              </div>
            </div>
          )}

          {results.length === 0 ? (
            <div className="empty">
              <b>没有找到「{query}」</b>
              换个写法试试，或者直接补一位进来。
              <div style={{ marginTop: 14 }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setContributeOpen(true)}
                >
                  补充这个角色
                </button>
              </div>
            </div>
          ) : (
            <div className="result-list">
              {results.map((c) => (
                <a className="result-row" href={`#/character/${c.id}`} key={c.id}>
                  <Avatar name={c.name} accent={c.accent} size={40} src={imageSrc(c.avatar_data, c.avatar_url)} />
                  <div className="result-main">
                    <div className="result-name">
                      {c.name}
                      {c.name_jp ? (
                        <span style={{ color: 'var(--muted)', fontSize: 12.5, marginLeft: 7 }}>
                          {c.name_jp}
                        </span>
                      ) : null}
                    </div>
                    <div className="result-from">
                      出自 <b>{c.work?.title ?? '未知作品'}</b>
                      <span className={`badge ${c.work?.kind === 'game' ? 'badge-game' : 'badge-anime'}`} style={{ marginLeft: 8 }}>
                        {KIND_LABEL[c.work?.kind ?? 'anime'] ?? '作品'}
                      </span>
                      {c.role ? <span style={{ marginLeft: 8 }}>· {c.role}</span> : null}
                      {c.cv ? <span style={{ marginLeft: 8 }}>· CV {c.cv}</span> : null}
                    </div>
                  </div>
                  <span className="heat" style={{ flexShrink: 0 }}>
                    热度 <b>{cnNumber(c.stats.heat)}</b>
                  </span>
                  <ChevronRight />
                </a>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <section className="poster-wall">
            <div className="poster-wall-head">
              {/* 热度全为 0 时没有「最热」可言，标题别硬撑 */}
              <h2>{totalHeat > 0 ? '此刻最热' : '角色速览'}</h2>
              <a className="more" href="#/rank">
                完整排行榜 →
              </a>
            </div>
            <PosterRail characters={hotCharacters.slice(0, 8)} showRank={totalHeat > 0} />
          </section>

          <div className="section-head">
            <h2>作品目录</h2>
            <span className="hint">
              {visibleWorks.length} 部作品 · {visibleCharCount} 位角色
              {visibleHeat > 0 ? ` · 总热度 ${cnNumber(visibleHeat)}` : ''}
            </span>
          </div>

          <div className="kind-filter" role="tablist" aria-label="作品分类">
            {KIND_TABS.map((t) => (
              <button
                type="button"
                key={t.key}
                role="tab"
                aria-selected={workKind === t.key}
                className={workKind === t.key ? 'chip active' : 'chip'}
                onClick={() => setWorkKind(t.key)}
              >
                {t.label}
                <span className="chip-n">{worksByKind[t.key].length}</span>
              </button>
            ))}
          </div>

          {visibleWorks.length === 0 ? (
            <div className="empty">
              <b>还没有{workKind === 'game' ? '游戏' : '动漫'}作品</b>
              现在收录的作品都属于另一类。补一部进来，管理员审核通过后就会出现在这里。
              <div style={{ marginTop: 14 }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setContributeOpen(true)}
                >
                  补充作品
                </button>
              </div>
            </div>
          ) : (
            <div className="work-grid">
              {visibleWorks.map((w) => (
                <WorkCard key={w.id} work={w} count={charCountByWork.get(w.id) ?? 0} />
              ))}
            </div>
          )}

          <div className="section-head">
            <h2>图鉴还在长</h2>
            <span className="hint">新番、新游的角色随时可以补进来</span>
          </div>
          <div className="empty" style={{ textAlign: 'left', padding: '22px 24px' }}>
            <b>没找到想找的角色？</b>
            登录后可以补充角色或整部新作品，补充内容会标记来源，管理员审核通过后进入目录。
            <div style={{ marginTop: 14, display: 'flex', gap: 9, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setContributeOpen(true)}
              >
                补充角色
              </button>
              <a className="btn btn-sm" href="#/rank">
                看看排行榜
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg className="result-arrow" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}
