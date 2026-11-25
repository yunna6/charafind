import { useMemo, useState } from 'react'
import { useApp } from '../store'
import { Avatar } from '../components/Avatar'
import { HeartIcon, StarIcon } from '../components/CharacterCard'
import { CommentSection } from '../components/CommentSection'
import { cnNumber, imageSrc } from '../utils'
import type { CharacterWithStats } from '../types'

type Metric = 'heat' | 'like_count' | 'favorite_count' | 'commenter_count'

const TABS: { key: Metric; label: string; unit: string }[] = [
  { key: 'heat', label: '综合热度', unit: '热度' },
  { key: 'like_count', label: '最多点赞', unit: '赞' },
  { key: 'favorite_count', label: '最多收藏', unit: '收藏' },
  { key: 'commenter_count', label: '最多讨论', unit: '人讨论' },
]

function metricOf(c: CharacterWithStats, m: Metric): number {
  if (m === 'heat') return c.stats.heat
  if (m === 'like_count') return c.stats.like_count
  if (m === 'favorite_count') return c.stats.favorite_count
  return c.stats.commenter_count
}

export function RankPage() {
  const { catalog, loading, likes, favorites, toggleLike, toggleFavorite, publicCharacters } = useApp()
  const [metric, setMetric] = useState<Metric>('heat')

  const rows = useMemo(() => {
    const list = [...publicCharacters]
    list.sort((a, b) => metricOf(b, metric) - metricOf(a, metric))
    return list.slice(0, 50)
  }, [publicCharacters, metric])

  const max = rows.length ? Math.max(...rows.map((r) => metricOf(r, metric)), 1) : 1
  const tab = TABS.find((t) => t.key === metric) ?? TABS[0]
  // 全员 0 说明还没有人互动过，此时不该把并列的 0 当成金银铜牌
  const allZero = rows.length > 0 && rows.every((r) => metricOf(r, metric) === 0)

  // 同分并列同名次（标准竞赛排名：1、1、3、4…），名次 = 严格高于自己的人数 + 1
  const ranks = useMemo(() => {
    const out: number[] = []
    rows.forEach((c, i) => {
      const v = metricOf(c, metric)
      out.push(i > 0 && metricOf(rows[i - 1], metric) === v ? out[i - 1] : i + 1)
    })
    return out
  }, [rows, metric])

  // 同名次超过 1 人即为并列，用于补一句「并列」说明
  const rankCount = new Map<number, number>()
  for (const r of ranks) rankCount.set(r, (rankCount.get(r) ?? 0) + 1)

  return (
    <div className="wrap">
      <section style={{ paddingTop: 40 }}>
        <div className="hero-eyebrow" style={{ justifyContent: 'flex-start', display: 'flex' }}>
          Ranking
        </div>
        <h1 style={{ fontSize: 'clamp(26px, 4vw, 34px)' }}>角色热度排行榜</h1>
        <p style={{ color: 'var(--muted)', marginTop: 8, maxWidth: 560 }}>
          热度 = 点赞 ×10 + 收藏 ×25 + 讨论人数 ×5。所有角色一律从 0 起算，没有初始人气。
          讨论人数按人计，一个人发再多条也只算一份；太短或被下架的评论不计分。热度相同即并列同名次。
        </p>
      </section>

      <div className="rank-tabs" role="tablist" aria-label="排行榜维度">
        {TABS.map((t) => (
          <button
            type="button"
            key={t.key}
            role="tab"
            aria-selected={metric === t.key}
            className={metric === t.key ? 'chip active' : 'chip'}
            onClick={() => setMetric(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {allZero && (
        <div className="rank-nudge">
          全场都是 0，全员并列第 1。<b>现在点下去的那一票，直接决定真正的榜首是谁。</b>
        </div>
      )}

      {loading ? (
        <div className="loading">正在统计</div>
      ) : rows.length === 0 ? (
        <div className="empty">
          <b>榜单还是空的</b>
          先补充几位角色，这里就会热闹起来。
        </div>
      ) : (
        <div className="rank-list">
          {rows.map((c, i) => {
            const value = metricOf(c, metric)
            const rank = ranks[i] ?? i + 1
            const tied = (rankCount.get(rank) ?? 0) > 1
            // 0 分就不画进度条，别让一个「保底 2%」的小红点假装有人气
            const pct = value > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0
            const liked = likes.has(c.id)
            const faved = favorites.has(c.id)
            // 奖牌跟着名次走：并列第 1 的两人都戴金，下一个自然是第 3 名拿铜；0 分不配戴牌
            const medal = value > 0 && rank <= 3 ? `top${rank}` : ''
            return (
              <div className={`rank-row ${medal}`} key={c.id}>
                <div className="rank-no" title={tied ? `并列第 ${rank} 名` : `第 ${rank} 名`}>
                  {rank === 1 && value > 0 && <CrownIcon />}
                  {rank}
                </div>
                <Avatar name={c.name} accent={c.accent} size={38} src={imageSrc(c.avatar_data, c.avatar_url)} />
                <div className="rank-main">
                  <a className="rank-name" href={`#/character/${c.id}`}>
                    {c.name}
                    {tied && value > 0 && <span className="badge badge-tie">并列</span>}
                    {c.status === 'user' && <span className="badge badge-user">补充</span>}
                  </a>
                  <a className="rank-sub" href={c.work ? `#/work/${c.work.id}` : '#/'}>
                    《{c.work?.title ?? '未知作品'}》
                    {c.role ? ` · ${c.role}` : ''}
                  </a>
                </div>
                <div className="rank-bar-wrap">
                  <span className="rank-heat">
                    {cnNumber(value)} {tab.unit}
                  </span>
                  <div className="rank-bar">
                    <i style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="mini-actions">
                  <button
                    type="button"
                    className={liked ? 'mini-btn on-like' : 'mini-btn'}
                    onClick={() => void toggleLike(c.id)}
                    aria-pressed={liked}
                    aria-label={liked ? '取消点赞' : '点赞'}
                  >
                    <HeartIcon filled={liked} />
                  </button>
                  <button
                    type="button"
                    className={faved ? 'mini-btn on-fav' : 'mini-btn'}
                    onClick={() => void toggleFavorite(c.id)}
                    aria-pressed={faved}
                    aria-label={faved ? '取消收藏' : '收藏'}
                  >
                    <StarIcon filled={faved} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <CommentSection targetType="ranking" heading="排行榜讨论区" />
    </div>
  )
}

/** 榜首的小皇冠：纯装饰，名次本身已由 title 与数字表达，读屏不必再念一遍 */
function CrownIcon() {
  return (
    <svg className="rank-crown" viewBox="0 0 24 16" aria-hidden="true" focusable="false">
      <path d="M2.3 13.2 3.5 4.4l4.6 4.2L12 2.1l3.9 6.5 4.6-4.2 1.2 8.8z" />
      <rect x="2.3" y="14" width="19.4" height="1.7" rx="0.85" />
    </svg>
  )
}
