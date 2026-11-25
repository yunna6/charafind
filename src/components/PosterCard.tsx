import { useApp } from '../store'
import { Avatar } from './Avatar'
import { cnNumber, imageSrc } from '../utils'
import { StarIcon } from './CharacterCard'
import type { CharacterWithStats } from '../types'

/**
 * 海报卡：竖版 2:3，深色卡面 + 角色主色光晕，名字压在底部。
 * 刻意不铺满图片——库里的角色图是 240×240 方图，拉满会糊，
 * 所以用「小图 + 聚光灯」的构图，让图退到主体位置上，排版承担质感。
 */
export function PosterCard({
  character,
  rank,
}: {
  character: CharacterWithStats
  rank?: number
}) {
  const { favorites, toggleFavorite } = useApp()
  const faved = favorites.has(character.id)
  const accent = character.accent || '#c2417a'
  const workTitle = character.work?.title ?? ''

  return (
    <article
      className="poster"
      style={{ ['--poster-accent' as string]: accent }}
    >
      <span className="poster-halo" aria-hidden="true" />
      <span className="poster-grid" aria-hidden="true" />

      {typeof rank === 'number' && <span className="poster-rank">{String(rank).padStart(2, '0')}</span>}

      <button
        type="button"
        className={faved ? 'poster-fav on' : 'poster-fav'}
        onClick={(e) => {
          e.stopPropagation()
          void toggleFavorite(character.id)
        }}
        aria-pressed={faved}
        aria-label={faved ? `取消收藏 ${character.name}` : `收藏 ${character.name}`}
        title={faved ? '取消收藏' : '收藏'}
      >
        <StarIcon filled={faved} size={13} />
      </button>

      <div className="poster-figure">
        <Avatar
          name={character.name}
          accent={character.accent}
          size={44}
          fluid
          src={imageSrc(character.avatar_data, character.avatar_url)}
        />
      </div>

      <div className="poster-caption">
        {workTitle && <span className="poster-work">{workTitle}</span>}
        <h3 className="poster-name">{character.name}</h3>
        <div className="poster-sub">
          <span>CV {character.cv || '—'}</span>
          <span className="poster-heat">
            <em>热度</em>
            {cnNumber(character.stats.heat)}
          </span>
        </div>
      </div>

      <a
        className="poster-hit"
        href={`#/character/${character.id}`}
        aria-label={`查看 ${character.name} 的详情`}
      />
    </article>
  )
}
