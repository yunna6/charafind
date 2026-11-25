import { useState } from 'react'
import { KIND_LABEL, imageSrc, shade } from '../utils'
import type { Work } from '../types'

export function WorkCard({ work, count }: { work: Work; count: number }) {
  const accent = work.accent || '#c2417a'
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const cover = imageSrc(work.cover_data, work.cover_url)
  const showCover = Boolean(cover) && failedSrc !== cover

  return (
    <a className="work-card" href={`#/work/${work.id}`}>
      <div
        className={showCover ? 'work-cover has-image' : 'work-cover'}
        style={
          showCover
            ? undefined
            : { background: `linear-gradient(135deg, ${shade(accent, -6)}, ${shade(accent, -84)})` }
        }
      >
        {showCover && (
          <img
            className="work-cover-img"
            src={cover as string}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setFailedSrc(cover ?? null)}
          />
        )}
        <span className="work-cover-jp">{work.title_jp || work.title}</span>
      </div>
      <div className="work-body">
        <div className="work-title">{work.title}</div>
        <div className="work-meta">
          <span className={`badge ${work.kind === 'game' ? 'badge-game' : 'badge-anime'}`}>
            {KIND_LABEL[work.kind] ?? work.kind}
          </span>
          {work.year && <span>{work.year}</span>}
          {work.studio && (
            <>
              <span className="dot" />
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: 120,
                }}
              >
                {work.studio}
              </span>
            </>
          )}
        </div>
        {work.summary && <p className="work-summary">{work.summary}</p>}
        <div className="work-count">
          <b>{count}</b> 位角色
        </div>
      </div>
    </a>
  )
}
