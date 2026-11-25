import { useRef, useState, type ChangeEvent } from 'react'
import { useApp } from '../store'
import { Avatar } from '../components/Avatar'
import { CharacterCard, HeartIcon, StarIcon } from '../components/CharacterCard'
import { CharacterEditDialog } from '../components/CharacterEditDialog'
import { CommentSection } from '../components/CommentSection'
import { cnNumber, imageSrc, KIND_LABEL } from '../utils'
import { AVATAR_PRESET, compressImage } from '../media'
import { navigate } from '../router'

export function CharacterPage({ id }: { id: number }) {
  const {
    catalog,
    loading,
    likes,
    favorites,
    toggleLike,
    toggleFavorite,
    publicCharacters,
    isAdmin,
    adminSetAvatar,
    adminSetHidden,
    toast,
  } = useApp()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busyAvatar, setBusyAvatar] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  if (loading) return <div className="wrap"><div className="loading">正在找这个人</div></div>

  const character = catalog?.characters.find((c) => c.id === id)

  if (!character) {
    return (
      <div className="wrap">
        <div className="empty" style={{ marginTop: 60 }}>
          <b>没有找到这位角色</b>
          数据库里暂时没有这个人。
          <div style={{ marginTop: 14 }}>
            <a className="btn btn-sm" href="#/">
              回到首页
            </a>
          </div>
        </div>
      </div>
    )
  }

  const work = character.work
  const liked = likes.has(character.id)
  const faved = favorites.has(character.id)
  const isPending = character.status !== 'official'
  const siblings = publicCharacters.filter(
    (c) => c.work_id === character.work_id && c.id !== character.id,
  )

  async function onAvatarFile(event: ChangeEvent<HTMLInputElement>) {
    const target = character
    if (!target) return
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusyAvatar(true)
    try {
      const dataUrl = await compressImage(file, AVATAR_PRESET)
      await adminSetAvatar(target.id, dataUrl)
    } catch (err) {
      toast(err instanceof Error ? err.message : '图片处理失败')
    } finally {
      setBusyAvatar(false)
    }
  }

  async function handleToggleHidden() {
    const target = character
    if (!target) return
    const next = !target.hidden
    await adminSetHidden(target.id, next)
    if (next) navigate(`/work/${target.work_id}`)
  }

  return (
    <div className="wrap">
      <div style={{ paddingTop: 22 }}>
        <a href={work ? `#/work/${work.id}` : '#/'} className="btn btn-ghost btn-sm" style={{ paddingLeft: 0 }}>
          ← {work ? `《${work.title}》角色表` : '回到首页'}
        </a>
      </div>

      {character.hidden && (
        <div className="notice-bar">
          这个角色已被下架，公开列表和排行榜都不会显示，只有管理员能看到这一页。
        </div>
      )}

      {isPending && (
        <div className="notice-bar">
          <b>
            {character.status === 'waiting_super'
              ? '这位角色在等主管理员终审'
              : '这位角色正在审核中'}
          </b>
          <span>
            目前只有投稿人和管理员能看到这一页；管理员走完审核（主管理员放行）后才会公开。
          </span>
        </div>
      )}

      <header className="detail-hero">
        <div className="hero-avatar">
          <Avatar
            name={character.name}
            accent={character.accent}
            size={124}
            large
            src={imageSrc(character.avatar_data, character.avatar_url)}
          />
          {isAdmin && (
            <>
              <button
                type="button"
                className="avatar-edit"
                disabled={busyAvatar}
                onClick={() => fileRef.current?.click()}
              >
                {busyAvatar ? '处理中…' : '换照片'}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => void onAvatarFile(e)}
              />
            </>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 260 }}>
          <h1 className="detail-title" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {character.name}
            {character.role && <span className="badge">{character.role}</span>}
            {character.status !== 'official' ? (
              <span className={character.status === 'waiting_super' ? 'badge badge-final' : 'badge badge-pending'}>
                {character.status === 'waiting_super'
                  ? '待主管理员终审'
                  : character.status === 'reviewing'
                    ? '管理员审核中'
                    : '待审核'}
              </span>
            ) : (
              character.owner_id && <span className="badge badge-user">用户补充</span>
            )}
          </h1>
          {character.name_jp && <div className="detail-jp">{character.name_jp}</div>}

          <div className="meta-grid">
            <span>
              出自{' '}
              <a href={work ? `#/work/${work.id}` : '#/'} style={{ color: 'var(--accent)', fontWeight: 500 }}>
                《{work?.title ?? '未知作品'}》
              </a>
            </span>
            {work?.kind && (
              <span className={`badge ${work.kind === 'game' ? 'badge-game' : 'badge-anime'}`}>
                {KIND_LABEL[work.kind] ?? work.kind}
              </span>
            )}
            {character.cv && (
              <span>
                声优 <b>{character.cv}</b>
              </span>
            )}
            {character.birthday && (
              <span>
                生日 <b>{character.birthday}</b>
              </span>
            )}
          </div>

          {character.quote && <blockquote className="detail-quote">「{character.quote}」</blockquote>}
          {character.description && <p className="detail-desc">{character.description}</p>}

          {character.tags && character.tags.length > 0 && (
            <div className="tag-row" style={{ marginTop: 14 }}>
              {character.tags.map((t) => (
                <span className="tag" key={t}>
                  #{t}
                </span>
              ))}
            </div>
          )}

          <div className="stat-strip">
            <div className="stat-item">
              <span className="stat-num">{cnNumber(character.stats.heat)}</span>
              <span className="stat-label">热度</span>
            </div>
            <div className="stat-item">
              <span className="stat-num">{cnNumber(character.stats.like_count)}</span>
              <span className="stat-label">点赞</span>
            </div>
            <div className="stat-item">
              <span className="stat-num">{cnNumber(character.stats.favorite_count)}</span>
              <span className="stat-label">收藏</span>
            </div>
            <div className="stat-item">
              <span className="stat-num">{cnNumber(character.stats.comment_count)}</span>
              <span className="stat-label">评论</span>
            </div>
          </div>

          <div className="action-row">
            <button
              type="button"
              className={liked ? 'btn btn-like on' : 'btn btn-like'}
              onClick={() => void toggleLike(character.id)}
              aria-pressed={liked}
              disabled={isPending}
              title={isPending ? '审核通过后才能点赞' : undefined}
            >
              <HeartIcon filled={liked} size={15} />
              {liked ? '已点赞' : '点赞'}
            </button>
            <button
              type="button"
              className={faved ? 'btn btn-fav on' : 'btn btn-fav'}
              onClick={() => void toggleFavorite(character.id)}
              aria-pressed={faved}
              disabled={isPending}
              title={isPending ? '审核通过后才能收藏' : undefined}
            >
              <StarIcon filled={faved} size={15} />
              {faved ? '已收藏' : '收藏'}
            </button>
            <a className="btn" href="#/rank">
              看看排到第几
            </a>
            {isAdmin && (
              <button type="button" className="btn btn-ghost" onClick={() => setEditOpen(true)}>
                编辑资料
              </button>
            )}
            {isAdmin && (
              <button
                type="button"
                className={character.hidden ? 'btn btn-primary' : 'btn btn-danger'}
                onClick={() => void handleToggleHidden()}
              >
                {character.hidden ? '恢复上架' : '下架此角色'}
              </button>
            )}
          </div>
        </div>
      </header>

      {!isPending && <CommentSection targetType="character" characterId={character.id} heading="大家怎么说" />}

      {siblings.length > 0 && (
        <>
          <div className="section-head">
            <h2>同一部作品的其他人</h2>
            <a className="more" href={work ? `#/work/${work.id}` : '#/'}>
              查看全部 →
            </a>
          </div>
          <div className="char-grid">
            {siblings.slice(0, 4).map((c) => (
              <CharacterCard key={c.id} character={c} />
            ))}
          </div>
        </>
      )}

      {isAdmin && editOpen && (
        <CharacterEditDialog character={character} onClose={() => setEditOpen(false)} />
      )}
    </div>
  )
}
