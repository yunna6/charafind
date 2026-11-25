import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useApp } from '../store'
import { Avatar } from '../components/Avatar'
import { imageSrc, shade, timeAgo } from '../utils'
import { AVATAR_PRESET, COVER_PRESET, compressImage } from '../media'
import type { CharacterWithStats, Work } from '../types'

type PickTarget = { kind: 'avatar' | 'cover'; id: number }

export function AdminPage() {
  const {
    session,
    authReady,
    setLoginOpen,
    catalog,
    isAdmin,
    isSuper,
    adminCount,
    adminTodo,
    claimAdminRole,
    adminSetHidden,
    adminSetAvatar,
    adminSetCover,
    adminReview,
    pendingCharacters,
    submissionReviews,
    reportedComments,
    adminDismissReports,
    adminDeleteComment,
    profiles,
    toast,
    adminApplications,
    adminMembers,
    adminDecideApplication,
    adminRevoke,
  } = useApp()

  const [workFilter, setWorkFilter] = useState<number | 'all'>('all')
  const [onlyHidden, setOnlyHidden] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [reviewBusy, setReviewBusy] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const targetRef = useRef<PickTarget | null>(null)

  const works = catalog?.works ?? []
  const allChars = catalog?.characters ?? []

  const chars = useMemo(() => {
    let list = allChars
    if (workFilter !== 'all') list = list.filter((c) => c.work_id === workFilter)
    if (onlyHidden) list = list.filter((c) => c.hidden)
    return list
  }, [allChars, workFilter, onlyHidden])

  const hiddenCount = allChars.filter((c) => c.hidden).length

  /** 第一层：还没人投票，或投了但没定论的 */
  const voteQueue = useMemo(
    () => pendingCharacters.filter((c) => c.status === 'pending' || c.status === 'reviewing'),
    [pendingCharacters],
  )
  /** 第二层：次级管理员已经审完，等主管理员拍板 */
  const finalQueue = useMemo(
    () => pendingCharacters.filter((c) => c.status === 'waiting_super'),
    [pendingCharacters],
  )

  const reviewMap = useMemo(() => {
    const map = new Map<number, typeof submissionReviews>()
    for (const r of submissionReviews) {
      const list = map.get(r.character_id) ?? []
      list.push(r)
      map.set(r.character_id, list)
    }
    return map
  }, [submissionReviews])

  function nameOf(uid: string): string {
    const p = profiles.get(uid)
    return p?.display_name || `用户 #${uid}`
  }

  async function handleReview(characterId: number, approve: boolean) {
    if (!approve && !window.confirm('驳回会直接删除这条投稿，确定吗？')) return
    setReviewBusy(characterId)
    try {
      await adminReview(characterId, approve)
    } finally {
      setReviewBusy(null)
    }
  }

  function pick(kind: PickTarget['kind'], id: number) {
    targetRef.current = { kind, id }
    fileRef.current?.click()
  }

  async function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    const target = targetRef.current
    if (!file || !target) return

    const key = `${target.kind}:${target.id}`
    setBusy(key)
    try {
      const preset = target.kind === 'avatar' ? AVATAR_PRESET : COVER_PRESET
      const dataUrl = await compressImage(file, preset)
      if (target.kind === 'avatar') await adminSetAvatar(target.id, dataUrl)
      else await adminSetCover(target.id, dataUrl)
    } catch (err) {
      toast(err instanceof Error ? err.message : '图片处理失败')
    } finally {
      setBusy(null)
    }
  }

  if (!authReady) {
    return (
      <div className="wrap">
        <div className="loading">正在确认身份</div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="wrap">
        <div className="empty" style={{ marginTop: 70 }}>
          <b>管理台需要先登录</b>
          登录后如果你是管理员，这里就能审稿、处理举报和改图。
          <div style={{ marginTop: 16 }}>
            <button type="button" className="btn btn-primary" onClick={() => setLoginOpen(true)}>
              登录
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    const canClaim = adminCount === 0
    return (
      <div className="wrap">
        <div className="empty" style={{ marginTop: 70 }}>
          <b>{canClaim ? '这个站还没有管理员' : '你还不是管理员'}</b>
          {canClaim
            ? '当前账号可以认领唯一的管理权限：之后只有你能审批管理员和终审投稿。'
            : '管理员由主管理员审批产生。去「我的」页提交一份申请，说明你能帮忙做什么。'}
          <div style={{ marginTop: 16 }}>
            {canClaim ? (
              <button type="button" className="btn btn-primary" onClick={() => void claimAdminRole()}>
                认领管理权限
              </button>
            ) : (
              <a className="btn btn-primary" href="#/me">
                去「我的」提交申请
              </a>
            )}
          </div>
        </div>
      </div>
    )
  }

  /** 当前身份能不能动这一条 */
  function voteState(c: CharacterWithStats) {
    const mine = Boolean(c.owner_id && c.owner_id === session?.id)
    if (mine) return 'mine' as const
    if (isSuper) return 'super' as const
    return c.status === 'waiting_super' ? ('waiting' as const) : ('vote' as const)
  }

  const renderSubmission = (c: CharacterWithStats) => {
    const votes = reviewMap.get(c.id) ?? []
    const approve = votes.filter((v) => v.decision === 'approve').length
    const reject = votes.filter((v) => v.decision === 'reject').length
    const state = voteState(c)
    const canAct = state === 'super' || state === 'vote'

    return (
      <div className="review-card" key={c.id}>
        <Avatar name={c.name} accent={c.accent} size={56} src={imageSrc(c.avatar_data, c.avatar_url)} />
        <div className="review-main">
          <div className="admin-row-name">
            {c.name}
            {c.name_jp && <span className="review-jp">{c.name_jp}</span>}
            <span
              className={
                c.status === 'waiting_super'
                  ? 'badge badge-final'
                  : c.status === 'reviewing'
                    ? 'badge badge-review'
                    : 'badge badge-pending'
              }
            >
              {c.status === 'waiting_super'
                ? '待主管理员终审'
                : c.status === 'reviewing'
                  ? '审核中'
                  : '待审核'}
            </span>
          </div>
          <div className="admin-row-sub">
            {c.work?.title ?? '未知作品'}
            {c.role ? ` · ${c.role}` : ''}
            {c.cv ? ` · CV ${c.cv}` : ''}
          </div>
          {c.description && <p className="review-desc">{c.description}</p>}
          <div className="review-tags">
            {(c.tags ?? []).map((t) => (
              <span className="chip chip-static" key={t}>
                {t}
              </span>
            ))}
            <span className="review-by">投稿人 {c.owner_id ? nameOf(c.owner_id) : '未知'}</span>
          </div>
          {(votes.length > 0 || state === 'mine' || state === 'waiting') && (
            <div className="vote-row">
              {votes.length > 0 && (
                <>
                  <span className="vote-pill ok">通过 {approve}</span>
                  <span className="vote-pill no">拒绝 {reject}</span>
                  <span className="vote-who">
                    已投票：{votes.map((v) => nameOf(v.reviewer_id)).join('、')}
                  </span>
                </>
              )}
              {state === 'mine' && (
                <span className="vote-who">这是你自己提交的，需要其他管理员来审</span>
              )}
              {state === 'waiting' && <span className="vote-who">下级审核已完成，等主管理员终审</span>}
            </div>
          )}
        </div>
        <div className="admin-row-actions">
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={!canAct || reviewBusy === c.id}
            onClick={() => void handleReview(c.id, true)}
          >
            {reviewBusy === c.id ? '处理中…' : state === 'super' ? '通过并上架' : '通过'}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-danger"
            disabled={!canAct || reviewBusy === c.id}
            onClick={() => void handleReview(c.id, false)}
          >
            驳回
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="wrap">
      <header className="admin-hero">
        <div>
          <h1 className="detail-title" style={{ fontSize: 30 }}>
            {isSuper ? '管理台 · 主管理员' : '管理台 · 次级管理员'}
          </h1>
          <p className="detail-desc" style={{ marginTop: 8, marginBottom: 0 }}>
            {isSuper
              ? '你负责最后一关：审批管理员、终审投稿。通过即上线，驳回会删除。'
              : '你负责第一关：给投稿投票、处理举报。两票都通过（或只有你一人可审）后自动送主管理员终审。'}
          </p>
        </div>
        <div className="admin-tally">
          <span>
            <b>{works.length}</b> 部作品
          </span>
          <span>
            <b>{allChars.length}</b> 位角色
          </span>
          <span>
            已下架 <b>{hiddenCount}</b>
          </span>
          <span>
            待审 <b>{voteQueue.length}</b>
          </span>
          <span>
            待终审 <b>{finalQueue.length}</b>
          </span>
          <span>
            举报 <b>{reportedComments.length}</b>
          </span>
          {isSuper && (
            <span>
              管理员申请 <b>{adminApplications.length}</b>
            </span>
          )}
        </div>
      </header>

      {adminTodo.total > 0 ? (
        <div className="todo-banner">
          <span className="dot-badge">{adminTodo.total}</span>
          <span>
            件需要你处理：
            {[
              adminTodo.votes > 0 ? `待审投稿 ${adminTodo.votes}` : '',
              adminTodo.finals > 0 ? `待终审 ${adminTodo.finals}` : '',
              adminTodo.reports > 0 ? `举报 ${adminTodo.reports}` : '',
              adminTodo.applications > 0 ? `管理员申请 ${adminTodo.applications}` : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </div>
      ) : (
        <div className="todo-banner is-clear">
          <span className="todo-check" aria-hidden="true">
            ✓
          </span>
          <span>当前没有待处理的事项，队列是空的。</span>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={(e) => void onFileChange(e)}
        style={{ display: 'none' }}
      />

      {isSuper && (
        <>
          <div className="section-head">
            <h2>
              管理员申请
              {adminApplications.length > 0 && (
                <span className="review-count">{adminApplications.length}</span>
              )}
            </h2>
            <span className="hint">通过后对方成为次级管理员：能审稿投票、能处理举报，改图仍只有你能做</span>
          </div>

          {adminApplications.length === 0 ? (
            <div className="empty">
              <b>没有待审批的申请</b>
              普通用户在「我的」页提交申请后，会先落到这里等你判断。
            </div>
          ) : (
            <div className="review-list">
              {adminApplications.map((a) => (
                <div className="review-card" key={a.id}>
                  <Avatar
                    name={a.display_name || a.user_id}
                    size={52}
                    src={a.avatar_data ?? null}
                  />
                  <div className="review-main">
                    <div className="admin-row-name">
                      {a.display_name || `用户 #${a.user_id}`}
                      <span className="badge badge-user">申请中</span>
                    </div>
                    <div className="admin-row-sub">
                      账号 {a.user_id} · 评论 {a.comment_count} 条 · {timeAgo(a.created_at)}提交
                    </div>
                    {a.bio && <p className="review-desc">{a.bio}</p>}
                    <p className="report-quote">{a.reason}</p>
                  </div>
                  <div className="admin-row-actions">
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => void adminDecideApplication(a.id, true)}
                    >
                      通过
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => {
                        if (!window.confirm('拒绝这条申请？对方 24 小时内不能再申请。')) return
                        void adminDecideApplication(a.id, false)
                      }}
                    >
                      拒绝
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="section-head" style={{ marginTop: 40 }}>
            <h2>管理员团队</h2>
            <span className="hint">主管理员只有你一个；次级管理员可以撤销，撤销后立即失去全部权限</span>
          </div>
          <div className="admin-list">
            {adminMembers.map((m) => (
              <div className="admin-row" key={m.user_id}>
                <Avatar name={m.display_name || m.user_id} size={44} src={m.avatar_data ?? null} />
                <div className="admin-row-id">
                  <div className="admin-row-name">
                    {m.display_name || `用户 #${m.user_id}`}
                    <span className={m.role === 'super' ? 'badge badge-super' : 'badge badge-user'}>
                      {m.role === 'super' ? '主管理员' : '次级管理员'}
                    </span>
                  </div>
                  <div className="admin-row-sub">
                    账号 {m.user_id}
                    {m.note ? ` · ${m.note}` : ''}
                  </div>
                </div>
                <div className="admin-row-actions">
                  {m.role === 'moderator' && (
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => {
                        if (!window.confirm(`撤销 ${m.display_name || m.user_id} 的管理员身份？`)) return
                        void adminRevoke(m.user_id)
                      }}
                    >
                      撤销
                    </button>
                  )}
                  {m.role === 'super' && <span className="review-by">不可撤销</span>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="section-head" style={{ marginTop: 40 }}>
        <h2>
          待审核投稿
          {voteQueue.length > 0 && <span className="review-count">{voteQueue.length}</span>}
        </h2>
        <span className="hint">
          {isSuper
            ? '你随时可以一票通过或驳回；次级管理员投的票也显示在这里'
            : '两位次级管理员都通过才会送主管理员终审；两人都拒绝则直接删除'}
        </span>
      </div>

      {voteQueue.length === 0 ? (
        <div className="empty">
          <b>没有待审核的投稿</b>
          用户在其他页面点「补充角色」提交后，会先落到这里。
        </div>
      ) : (
        <div className="review-list">{voteQueue.map(renderSubmission)}</div>
      )}

      <div className="section-head" style={{ marginTop: 40 }}>
        <h2>
          待终审
          {finalQueue.length > 0 && <span className="review-count">{finalQueue.length}</span>}
        </h2>
        <span className="hint">
          {isSuper
            ? '这些是下级管理员已经审完的，等你拍板：通过即上架，驳回会删除'
            : '这些已经送出，主管理员会做最后决定'}
        </span>
      </div>

      {finalQueue.length === 0 ? (
        <div className="empty">
          <b>没有待终审的投稿</b>
          次级管理员审核完成后，稿件会自动流转到这里。
        </div>
      ) : (
        <div className="review-list">{finalQueue.map(renderSubmission)}</div>
      )}

      <div className="section-head" style={{ marginTop: 40 }}>
        <h2>
          评论举报
          {reportedComments.length > 0 && (
            <span className="review-count">{reportedComments.length}</span>
          )}
        </h2>
        <span className="hint">确认违规就直接删除，评论和热度一起消失且不可恢复；误报可以忽略</span>
      </div>

      {reportedComments.length === 0 ? (
        <div className="empty">
          <b>没有待处理的举报</b>
          用户在某条评论上点「举报」后，会先落到这里等你判断。
        </div>
      ) : (
        <div className="review-list">
          {reportedComments.map((r) => {
            const p = r.owner_id ? profiles.get(r.owner_id) : undefined
            const name = p?.display_name || (r.owner_id ? `用户 #${r.owner_id}` : '未知用户')
            return (
              <div className="review-card" key={r.comment_id}>
                <div className="review-main">
                  <div className="admin-row-name">
                    被举报 <span className="report-count">{r.report_count}</span> 次
                  </div>
                  <div className="admin-row-sub">
                    {name} · {r.target_type === 'ranking' ? '排行榜讨论区' : `角色 #${r.character_id}`}
                  </div>
                  <p className="report-quote">{r.content}</p>
                  <div className="review-tags">
                    <span className="review-by">最近理由：{r.last_reason || '未填写'}</span>
                  </div>
                </div>
                <div className="admin-row-actions">
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => {
                      if (
                        !window.confirm('删除这条评论？删除后无法恢复，评论带来的热度也会一起消失。')
                      )
                        return
                      void adminDeleteComment(r.comment_id)
                    }}
                  >
                    删除评论
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => void adminDismissReports(r.comment_id)}
                  >
                    忽略举报
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {isSuper && (
        <>
          <div className="section-head" style={{ marginTop: 40 }}>
            <h2>作品封面</h2>
            <span className="hint">建议竖版海报，人物居中</span>
          </div>

          <div className="admin-work-grid">
            {works.map((work) => (
              <WorkAdminCard
                key={work.id}
                work={work}
                busy={busy === `cover:${work.id}`}
                onPick={() => pick('cover', work.id)}
                onClear={() => void adminSetCover(work.id, null)}
              />
            ))}
          </div>

          <div className="section-head" style={{ marginTop: 40 }}>
            <h2>角色照片与上架状态</h2>
            <span className="hint">下架后公开页面立即消失，可随时恢复</span>
          </div>

          <div
            className="chip-row"
            style={{ justifyContent: 'flex-start', marginTop: 0, marginBottom: 14 }}
          >
            <button
              type="button"
              className={workFilter === 'all' ? 'chip active' : 'chip'}
              onClick={() => setWorkFilter('all')}
            >
              全部作品
            </button>
            {works.map((w) => (
              <button
                type="button"
                key={w.id}
                className={workFilter === w.id ? 'chip active' : 'chip'}
                onClick={() => setWorkFilter(w.id)}
              >
                {w.title}
              </button>
            ))}
            <button
              type="button"
              className={onlyHidden ? 'chip active' : 'chip'}
              onClick={() => setOnlyHidden((v) => !v)}
            >
              只看已下架（{hiddenCount}）
            </button>
          </div>

          {chars.length === 0 ? (
            <div className="empty">
              <b>这个筛选下没有角色</b>
              换一个作品，或者取消「只看已下架」。
            </div>
          ) : (
            <div className="admin-list">
              {chars.map((c) => (
                <div className={c.hidden ? 'admin-row is-hidden' : 'admin-row'} key={c.id}>
                  <Avatar
                    name={c.name}
                    accent={c.accent}
                    size={48}
                    src={imageSrc(c.avatar_data, c.avatar_url)}
                  />
                  <div className="admin-row-id">
                    <div className="admin-row-name">
                      {c.name}
                      {c.hidden && <span className="badge badge-hidden">已下架</span>}
                      {c.status !== 'official' && <span className="badge badge-pending">未上架</span>}
                      {c.status === 'official' && c.owner_id && (
                        <span className="badge badge-user">用户补充</span>
                      )}
                    </div>
                    <div className="admin-row-sub">
                      {c.work?.title ?? '未知作品'}
                      {c.role ? ` · ${c.role}` : ''}
                    </div>
                  </div>
                  <div className="admin-row-actions">
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={busy === `avatar:${c.id}`}
                      onClick={() => pick('avatar', c.id)}
                    >
                      {busy === `avatar:${c.id}` ? '处理中…' : '换照片'}
                    </button>
                    {(c.avatar_data || c.avatar_url) && (
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        onClick={() => void adminSetAvatar(c.id, null)}
                      >
                        移除
                      </button>
                    )}
                    <button
                      type="button"
                      className={c.hidden ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-danger'}
                      onClick={() => void adminSetHidden(c.id, !c.hidden)}
                    >
                      {c.hidden ? '恢复上架' : '下架'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function WorkAdminCard({
  work,
  busy,
  onPick,
  onClear,
}: {
  work: Work
  busy: boolean
  onPick: () => void
  onClear: () => void
}) {
  const cover = imageSrc(work.cover_data, work.cover_url)
  const accent = work.accent || '#c2417a'

  return (
    <div className="admin-work">
      <div
        className="admin-work-cover"
        style={
          cover
            ? undefined
            : { background: `linear-gradient(150deg, ${shade(accent, -4)}, ${shade(accent, -86)})` }
        }
      >
        {cover && <img src={cover} alt="" loading="lazy" decoding="async" />}
        <span>{work.title_jp || work.title}</span>
      </div>
      <div className="admin-work-body">
        <div className="admin-row-name">{work.title}</div>
        <div className="admin-row-sub">{cover ? '已有封面' : '默认渐变封面'}</div>
        <div className="admin-row-actions" style={{ marginTop: 10 }}>
          <button type="button" className="btn btn-sm" disabled={busy} onClick={onPick}>
            {busy ? '处理中…' : cover ? '更换封面' : '上传封面'}
          </button>
          {cover && (
            <button type="button" className="btn btn-sm btn-ghost" onClick={onClear}>
              移除
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
