import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useApp } from '../store'
import { CharacterCard } from '../components/CharacterCard'
import { KIND_LABEL, cnNumber, imageSrc, shade } from '../utils'
import { COVER_PRESET, compressImage } from '../media'

/** 作品海报：有图用图，无图或加载失败退回渐变字形 */
function Poster({ cover, accent, title }: { cover: string | null; accent: string; title: string }) {
  const [failed, setFailed] = useState(false)
  const show = Boolean(cover) && !failed
  return (
    <div
      className="work-poster"
      style={
        show ? undefined : { background: `linear-gradient(150deg, ${shade(accent, -4)}, ${shade(accent, -88)})` }
      }
      aria-hidden="true"
    >
      {show && (
        <img
          className="work-poster-img"
          src={cover as string}
          alt=""
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
      <span className="work-poster-jp">{title}</span>
    </div>
  )
}

export function WorkPage({ id }: { id: number }) {
  const { catalog, loading, setContributeOpen, isAdmin, adminSetCover, toast } =
    useApp()
  const [roleFilter, setRoleFilter] = useState('全部')
  const [busyCover, setBusyCover] = useState(false)
  const coverRef = useRef<HTMLInputElement>(null)

  const work = catalog?.works.find((w) => w.id === id)
  const chars = useMemo(
    () =>
      (catalog?.characters ?? []).filter(
        (c) => c.work_id === id && c.status === 'official' && !c.hidden,
      ),
    [catalog, id],
  )

  const roles = useMemo(() => {
    const set = new Set<string>()
    for (const c of chars) if (c.role) set.add(c.role)
    return ['全部', ...Array.from(set)]
  }, [chars])

  const visible = roleFilter === '全部' ? chars : chars.filter((c) => c.role === roleFilter)

  if (loading) return <div className="wrap"><div className="loading">正在翻页</div></div>

  if (!work) {
    return (
      <div className="wrap">
        <div className="empty" style={{ marginTop: 60 }}>
          <b>没有这部作品</b>
          它可能已被移除，或者链接不对。
          <div style={{ marginTop: 14 }}>
            <a className="btn btn-sm" href="#/">
              回到首页
            </a>
          </div>
        </div>
      </div>
    )
  }

  const accent = work.accent || '#c2417a'
  const totalHeat = chars.reduce((s, c) => s + c.stats.heat, 0)
  const avgHeat = chars.length ? Math.round(totalHeat / chars.length) : 0

  async function onCoverFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !work) return
    setBusyCover(true)
    try {
      const dataUrl = await compressImage(file, COVER_PRESET)
      await adminSetCover(work.id, dataUrl)
    } catch (err) {
      toast(err instanceof Error ? err.message : '图片处理失败')
    } finally {
      setBusyCover(false)
    }
  }

  return (
    <div className="wrap">
      <div style={{ paddingTop: 22 }}>
        <a href="#/" className="btn btn-ghost btn-sm" style={{ paddingLeft: 0 }}>
          ← 全部作品
        </a>
      </div>

      <header className="detail-hero">
        <div className="hero-poster">
          <Poster
            cover={imageSrc(work.cover_data, work.cover_url)}
            accent={accent}
            title={work.title_jp || work.title}
          />
          {isAdmin && (
            <>
              <button
                type="button"
                className="poster-edit"
                disabled={busyCover}
                onClick={() => coverRef.current?.click()}
              >
                {busyCover ? '处理中…' : '换封面'}
              </button>
              <input
                ref={coverRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => void onCoverFile(e)}
              />
            </>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 260 }}>
          <h1 className="detail-title">
            {work.title}{' '}
            <span className={`badge ${work.kind === 'game' ? 'badge-game' : 'badge-anime'}`} style={{ verticalAlign: 'middle' }}>
              {KIND_LABEL[work.kind] ?? work.kind}
            </span>
          </h1>
          {work.title_jp && <div className="detail-jp">{work.title_jp}</div>}

          <div className="meta-grid">
            {work.year && (
              <span>
                <b>{work.year}</b> 年
              </span>
            )}
            {work.studio && (
              <span>
                制作 <b>{work.studio}</b>
              </span>
            )}
            <span>
              <b>{chars.length}</b> 位角色
            </span>
            <span>
              平均热度 <b>{cnNumber(avgHeat)}</b>
            </span>
          </div>

          {work.summary && <p className="detail-desc">{work.summary}</p>}

          {work.tags && work.tags.length > 0 && (
            <div className="tag-row" style={{ marginTop: 14 }}>
              {work.tags.map((t) => (
                <span className="tag" key={t}>
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
      </header>

      {work.status === 'pending' && (
        <div className="notice-bar">
          <b>这部作品还在审核中</b>
          <span>它来自用户投稿，只有你和管理员看得到。管理员通过后才会出现在公开目录里。</span>
        </div>
      )}

      <div className="section-head">
        <h2>角色表</h2>
        <span className="hint">按热度排序</span>
      </div>

      {roles.length > 1 && (
        <div className="chip-row" style={{ justifyContent: 'flex-start', marginTop: 0, marginBottom: 18 }}>
          {roles.map((r) => (
            <button
              type="button"
              key={r}
              className={roleFilter === r ? 'chip active' : 'chip'}
              onClick={() => setRoleFilter(r)}
            >
              {r}
            </button>
          ))}
        </div>
      )}

      {chars.length === 0 ? (
        <div className="empty">
          <b>这部作品还没有角色</b>
          成为第一个把它填满的人。
          <div style={{ marginTop: 14 }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setContributeOpen(true)}>
              补充角色
            </button>
          </div>
        </div>
      ) : (
        <div className="char-grid">
          {visible.map((c) => (
            <CharacterCard key={c.id} character={c} />
          ))}
        </div>
      )}
    </div>
  )
}
