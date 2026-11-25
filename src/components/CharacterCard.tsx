import { useApp } from '../store'
import { Avatar } from './Avatar'
import { cnNumber, imageSrc } from '../utils'
import { navigate } from '../router'
import type { CharacterWithStats } from '../types'

export function CharacterCard({ character }: { character: CharacterWithStats }) {
  const { likes, favorites, toggleLike, toggleFavorite } = useApp()
  const liked = likes.has(character.id)
  const faved = favorites.has(character.id)

  return (
    <article className="char-card">
      <button
        type="button"
        onClick={() => navigate(`/character/${character.id}`)}
        style={{ display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left', padding: 0 }}
        aria-label={`查看 ${character.name} 的详情`}
      >
        <Avatar
          name={character.name}
          accent={character.accent}
          size={46}
          src={imageSrc(character.avatar_data, character.avatar_url)}
        />
        <span className="char-id">
          <span className="char-name">{character.name}</span>
          <span className="char-sub">
            {character.role ?? '角色'}
            {character.cv ? ` · CV ${character.cv}` : ''}
          </span>
        </span>
      </button>

      <div className="char-foot">
        <span className="heat">
          热度 <b>{cnNumber(character.stats.heat)}</b>
        </span>
        <div className="mini-actions">
          <button
            type="button"
            className={liked ? 'mini-btn on-like' : 'mini-btn'}
            onClick={() => void toggleLike(character.id)}
            aria-pressed={liked}
            aria-label={liked ? '取消点赞' : '点赞'}
            title={liked ? '取消点赞' : '点赞'}
          >
            <HeartIcon filled={liked} />
            {cnNumber(character.stats.like_count)}
          </button>
          <button
            type="button"
            className={faved ? 'mini-btn on-fav' : 'mini-btn'}
            onClick={() => void toggleFavorite(character.id)}
            aria-pressed={faved}
            aria-label={faved ? '取消收藏' : '收藏'}
            title={faved ? '取消收藏' : '收藏'}
          >
            <StarIcon filled={faved} />
          </button>
        </div>
      </div>
    </article>
  )
}

export function HeartIcon({ filled = false, size = 13 }: { filled?: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l8.8 8.8 8.8-8.8a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  )
}

export function StarIcon({ filled = false, size = 13 }: { filled?: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2.5l2.9 6.2 6.6.9-4.8 4.7 1.2 6.7L12 17.8 6.1 21l1.2-6.7L2.5 9.6l6.6-.9z" />
    </svg>
  )
}
