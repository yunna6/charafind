import { useMemo, useState } from 'react'
import { useApp } from '../store'
import { Avatar } from '../components/Avatar'
import { CharacterCard } from '../components/CharacterCard'
import { ProfileEditDialog } from '../components/ProfileEditDialog'
import { imageSrc } from '../utils'
import { FULL_SITE_URL, IS_DEMO } from '../cloud'

type Tab = 'favorites' | 'likes' | 'mine'

export function MePage() {
  const {
    session,
    authReady,
    setLoginOpen,
    likes,
    favorites,
    signOut,
    publicCharacters,
    mySubmissions,
    isAdmin,
    isSuper,
    adminTodo,
    adminCount,
    claimAdminRole,
    withdrawMine,
    myProfile,
    myDisplayName,
    myAdminApplication,
    applyAdminRole,
  } = useApp()
  const [tab, setTab] = useState<Tab>('favorites')
  const [editOpen, setEditOpen] = useState(false)
  const [applyOpen, setApplyOpen] = useState(false)
  const [applyReason, setApplyReason] = useState('')
  const [applying, setApplying] = useState(false)

  const characters = publicCharacters

  const lists = useMemo(
    () => ({
      favorites: characters.filter((c) => favorites.has(c.id)),
      likes: characters.filter((c) => likes.has(c.id)),
      mine: characters.filter((c) => c.owner_id && c.owner_id === session?.id),
    }),
    [characters, favorites, likes, session],
  )

  const mineTotal = lists.mine.length + mySubmissions.length

  // 管理入口上只写"要你动手的"，不把自己的稿件进度混进来
  const todoBrief = [
    adminTodo.votes > 0 ? `待审投稿 ${adminTodo.votes}` : '',
    adminTodo.finals > 0 ? `待终审 ${adminTodo.finals}` : '',
    adminTodo.reports > 0 ? `举报 ${adminTodo.reports}` : '',
    adminTodo.applications > 0 ? `管理员申请 ${adminTodo.applications}` : '',
  ].filter(Boolean).join('、')

  if (!authReady) return <div className="wrap"><div className="loading">正在确认身份</div></div>

  if (!session) {
    // 演示版没有登录能力，直接把出口指向完整版，免得用户点了登录却等不到验证码
    if (IS_DEMO) {
      return (
        <div className="wrap">
          <div className="empty" style={{ marginTop: 70 }}>
            <b>演示版不提供登录</b>
            书架、点赞和评论都记在账号下，请到完整版登录后使用。
            <div style={{ marginTop: 16 }}>
              <a className="btn btn-primary" href={FULL_SITE_URL}>
                前往完整版
              </a>
            </div>
          </div>
        </div>
      )
    }
    return (
      <div className="wrap">
        <div className="empty" style={{ marginTop: 70 }}>
          <b>这里需要先登录</b>
          收藏、点赞和评论都会记在你的账号下，登录后随时可以回来看。
          <div style={{ marginTop: 16 }}>
            <button type="button" className="btn btn-primary" onClick={() => setLoginOpen(true)}>
              登录 / 注册
            </button>
          </div>
        </div>
      </div>
    )
  }

  const current = lists[tab]

  return (
    <div className="wrap">
      <section style={{ paddingTop: 40 }}>
        <div className="hero-eyebrow" style={{ display: 'flex', justifyContent: 'flex-start' }}>
          My Shelf
        </div>
        <h1 style={{ fontSize: 'clamp(24px, 3.6vw, 30px)' }}>我的书架</h1>

        <section className="profile-card">
          <Avatar name={myDisplayName} size={64} src={myProfile?.avatar_data ?? null} />
          <div className="profile-card-main">
            <div className="profile-card-name">
              <span className="profile-card-nick">{myDisplayName}</span>
              <span className="profile-card-uid" title={`登录账号 ID：${session.id}`}>
                账号 …{session.id.slice(-6)}
              </span>
            </div>
            <p className={myProfile?.bio ? 'profile-card-bio' : 'profile-card-bio placeholder'}>
              {myProfile?.bio || '还没写个性签名，点「编辑资料」说一句'}
            </p>
          </div>
          <div className="profile-card-actions">
            <button type="button" className="btn btn-sm btn-primary" onClick={() => setEditOpen(true)}>
              编辑资料
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void signOut()}>
              退出登录
            </button>
          </div>
        </section>

        <div className="stat-strip">
          <div className="stat-item">
            <span className="stat-num">{lists.favorites.length}</span>
            <span className="stat-label">收藏</span>
          </div>
          <div className="stat-item">
            <span className="stat-num">{lists.likes.length}</span>
            <span className="stat-label">点赞</span>
          </div>
          <div className="stat-item">
            <span className="stat-num">{mineTotal}</span>
            <span className="stat-label">我补充的</span>
          </div>
        </div>
      </section>

      <section className={isAdmin && adminTodo.total > 0 ? 'admin-entry has-todo' : 'admin-entry'}>
        <div style={{ minWidth: 0 }}>
          <div className="admin-entry-title">
            {isAdmin
              ? isSuper
                ? '管理台（主管理员）'
                : '管理台（次级管理员）'
              : adminCount === 0
                ? '认领管理权限'
                : myAdminApplication?.status === 'pending'
                  ? '管理员申请审核中'
                  : '申请成为管理员'}
            {isAdmin && adminTodo.total > 0 && (
              <span className="dot-badge" title={todoBrief}>
                {adminTodo.total}
              </span>
            )}
          </div>
          <p className="admin-entry-desc">
            {isAdmin
              ? adminTodo.total > 0
                ? `有 ${adminTodo.total} 件等你处理：${todoBrief}。`
                : isSuper
                  ? '审批管理员申请、终审投稿、换图和下架，全部由你拍板。当前没有待处理事项。'
                  : '审核投稿（需要另一位管理员共同确认）和处理评论举报，改图与下架仍归主管理员。当前没有待处理事项。'
              : adminCount === 0
                ? '这个站还没有管理员。认领之后，你就是唯一的最高权限账号。'
                : myAdminApplication?.status === 'pending'
                  ? '已经提交给主管理员，通过后你会成为次级管理员，负责审核投稿与处理举报。'
                  : myAdminApplication?.status === 'rejected'
                    ? '上次申请没有通过。可以补一段更具体的理由再申请一次。'
                    : '普通用户也能申请。通过后成为次级管理员，负责审核投稿与处理举报。'}
          </p>
        </div>
        {isAdmin ? (
          <a className="btn btn-primary btn-sm" href="#/admin">
            {adminTodo.total > 0 ? `去处理 ${adminTodo.total} 件` : '进入管理台'}
          </a>
        ) : adminCount === 0 ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => void claimAdminRole()}>
            认领
          </button>
        ) : myAdminApplication?.status === 'pending' ? (
          <span className="badge badge-pending">等待主管理员</span>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setApplyOpen((v) => !v)}
          >
            {applyOpen ? '收起' : myAdminApplication?.status === 'rejected' ? '重新申请' : '申请'}
          </button>
        )}
      </section>

      {applyOpen && !isAdmin && (
        <section className="admin-apply">
          <textarea
            className="comment-input"
            rows={3}
            maxLength={300}
            placeholder="说说你为什么想当管理员：常在线的时间、想帮忙做什么（例如审核投稿、处理举报）…"
            value={applyReason}
            onChange={(e) => setApplyReason(e.target.value)}
            aria-label="申请理由"
          />
          <div className="admin-apply-foot">
            <span className="comment-tip">{applyReason.trim().length}/300 · 至少 8 个字</span>
            <div className="admin-apply-actions">
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => {
                  setApplyOpen(false)
                  setApplyReason('')
                }}
              >
                取消
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                disabled={applying}
                onClick={() => {
                  void (async () => {
                    setApplying(true)
                    const ok = await applyAdminRole(applyReason)
                    setApplying(false)
                    if (ok) {
                      setApplyOpen(false)
                      setApplyReason('')
                    }
                  })()
                }}
              >
                {applying ? '提交中…' : '提交申请'}
              </button>
            </div>
          </div>
        </section>
      )}

      <div className="tabs" role="tablist" aria-label="我的内容">
        <button type="button" role="tab" aria-selected={tab === 'favorites'} className={tab === 'favorites' ? 'tab active' : 'tab'} onClick={() => setTab('favorites')}>
          我的收藏 ({lists.favorites.length})
        </button>
        <button type="button" role="tab" aria-selected={tab === 'likes'} className={tab === 'likes' ? 'tab active' : 'tab'} onClick={() => setTab('likes')}>
          我的点赞 ({lists.likes.length})
        </button>
        <button type="button" role="tab" aria-selected={tab === 'mine'} className={tab === 'mine' ? 'tab active' : 'tab'} onClick={() => setTab('mine')}>
          我补充的角色 ({mineTotal})
        </button>
      </div>

      {tab === 'mine' && mySubmissions.length > 0 && (
        <section className="pending-note">
          <div className="pending-note-head">
            <b>{mySubmissions.length} 条投稿正在等管理员审核</b>
            <span>通过后才会出现在公开图鉴里，通过之前你可以随时撤回。</span>
          </div>
          <div className="pending-rows">
            {mySubmissions.map((c) => (
              <div className="pending-row" key={c.id}>
                <Avatar
                  name={c.name}
                  accent={c.accent}
                  size={40}
                  src={imageSrc(c.avatar_data, c.avatar_url)}
                />
                <div className="pending-row-main">
                  <div className="admin-row-name">
                    {c.name}
                    <span className="badge badge-pending">
                      {c.status === 'waiting_super'
                        ? '待主管理员终审'
                        : c.status === 'reviewing'
                          ? '管理员审核中'
                          : '排队待审'}
                    </span>
                  </div>
                  <div className="admin-row-sub">
                    {c.work?.title ?? '未知作品'}
                    {c.avatar_data || c.avatar_url ? ' · 已附照片' : ' · 未附照片'}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => void withdrawMine(c.id, c.work_id)}
                >
                  撤回
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {current.length === 0 ? (
        <div className="empty">
          <b>
            {tab === 'favorites'
              ? '还没有收藏'
              : tab === 'likes'
                ? '还没有点赞'
                : mineTotal > 0
                  ? '补充的角色都在审核中'
                  : '还没有补充过角色'}
          </b>
          {tab === 'favorites'
            ? '在角色页点一下收藏，TA 就会出现在这里。'
            : tab === 'likes'
              ? '看到喜欢的角色，点个赞吧。'
              : mineTotal > 0
                ? '管理员通过之后，它们会出现在这个列表里。'
                : '想为图鉴添一笔？在首页点「补充角色」。'}
          <div style={{ marginTop: 14 }}>
            <a className="btn btn-sm" href="#/">
              去逛逛
            </a>
          </div>
        </div>
      ) : (
        <div className="char-grid">
          {current.map((c) => (
            <CharacterCard key={c.id} character={c} />
          ))}
        </div>
      )}

      <ProfileEditDialog open={editOpen} onClose={() => setEditOpen(false)} />
    </div>
  )
}
