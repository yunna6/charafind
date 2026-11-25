import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { addComment, deleteComment, fetchComments } from '../api'
import { errorMessage } from '../cloud'
import { useApp } from '../store'
import { timeAgo } from '../utils'
import type { Comment } from '../types'
import { Avatar } from './Avatar'

interface Props {
  targetType: 'character' | 'ranking'
  characterId?: number
  heading?: string
}

type ReplyTarget = { id: number; label: string }

/**
 * 评论署名直接用登录用户 ID，不再用昵称/邮箱——
 * 昵称可能为空（旧数据就会退回「匿名旅人」），而 owner_id 一定有且唯一对应到人。
 */
function uidOf(id?: string | null): string {
  const v = (id ?? '').trim()
  if (!v || v.toLowerCase() === 'anon') return ''
  return v
}

/** 提交前的本地检查：太短、纯符号表情、重复单字都属于垃圾内容，不必浪费一次请求 */
function junkReason(text: string): string | null {
  const body = text.trim()
  if (body.length < 2) return '至少写两个字吧'
  const core = body.replace(/[\s\u3000]/g, '').replace(/[\p{P}\p{S}]/gu, '')
  if (core.length < 2) return '只写符号或表情，别人读不懂你的意思'
  if (/^(.)\1{2,}$/u.test(core)) return '同一个字重复刷屏不算评论'
  return null
}

const REPORT_REASONS = ['广告 / 引流', '辱骂或人身攻击', '剧透没预警', '和角色完全无关']

export function CommentSection({ targetType, characterId, heading = '评论' }: Props) {
  const { session, requireAuth, toast, profiles, myProfile, reportComment } = useApp()
  const [items, setItems] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [posting, setPosting] = useState(false)
  const [formErr, setFormErr] = useState('')
  const [reportingId, setReportingId] = useState<number | null>(null)
  const [reportBusy, setReportBusy] = useState<number | null>(null)
  const [reported, setReported] = useState<Set<number>>(new Set())
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null)
  const meUid = uidOf(session?.id)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchComments({ targetType, characterId })
      setItems(data)
      setLoadErr(null)
    } catch (err) {
      setLoadErr(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [targetType, characterId])

  useEffect(() => {
    void load()
  }, [load])

  /** 署名信息：自己建了资料就用昵称，否则退回「用户 #账号ID」 */
  const whoOf = useCallback(
    (c: Comment) => {
      const uid = uidOf(c.owner_id)
      const profile = uid ? profiles.get(uid) : undefined
      const nick = profile?.display_name ?? ''
      return { uid, profile, nick, label: nick || (uid ? `用户 #${uid}` : '游客') }
    },
    [profiles],
  )

  /**
   * 楼中楼只做两层视觉：任何深度的回复都挂到它所在线程的顶层评论下面。
   * 这样即便有人回复回复，也不会把评论区缩进成梯田。
   */
  const tree = useMemo(() => {
    const byId = new Map(items.map((c) => [c.id, c]))
    const roots: Comment[] = []
    const children = new Map<number, Comment[]>()

    for (const c of items) {
      if (!c.parent_id || !byId.has(c.parent_id)) {
        roots.push(c)
        continue
      }
      let cursor = byId.get(c.parent_id)!
      let guard = 0
      while (cursor.parent_id && byId.has(cursor.parent_id) && guard++ < 8) {
        cursor = byId.get(cursor.parent_id)!
      }
      const list = children.get(cursor.id) ?? []
      list.push(c)
      children.set(cursor.id, list)
    }

    // items 按时间倒序，回复反过来才是对话顺序
    for (const [key, list] of children) children.set(key, list.slice().reverse())
    return { roots, children }
  }, [items])

  const replyTotal = items.length - tree.roots.length

  async function submit() {
    if (!requireAuth()) return
    const content = text.trim()
    if (!content) {
      setFormErr('说点什么再发吧')
      return
    }
    if (content.length > 500) {
      setFormErr('评论最多 500 字')
      return
    }
    const junk = junkReason(content)
    if (junk) {
      setFormErr(junk)
      return
    }
    setFormErr('')
    setPosting(true)
    try {
      const created = await addComment({
        targetType,
        characterId: characterId ?? null,
        content,
        userName: meUid || null,
      })
      setItems((prev) => [created, ...prev])
      setText('')
      toast('评论已发布')
    } catch (err) {
      setFormErr(errorMessage(err))
    } finally {
      setPosting(false)
    }
  }

  /** 回复提交：返回给回复框的报错文案，null 表示成功 */
  async function submitReply(parent: Comment, raw: string): Promise<string | null> {
    if (!requireAuth()) return '需要登录后才能回复'
    const content = raw.trim()
    if (!content) return '说点什么再发吧'
    if (content.length > 500) return '回复最多 500 字'
    const junk = junkReason(content)
    if (junk) return junk
    setPosting(true)
    try {
      const created = await addComment({
        targetType,
        characterId: characterId ?? null,
        content,
        userName: meUid || null,
        parentId: parent.id,
      })
      setItems((prev) => [created, ...prev])
      setReplyTo(null)
      toast('回复已发布')
      return null
    } catch (err) {
      return errorMessage(err)
    } finally {
      setPosting(false)
    }
  }

  /** 删一条评论要连同它的回复一起消失（数据库那边也是 ON DELETE CASCADE） */
  async function remove(id: number) {
    if (!window.confirm('确定删除这条评论吗？它下面的回复也会一起消失。')) return
    try {
      const ok = await deleteComment(id)
      if (ok) {
        const doomed = new Set<number>([id])
        let grew = true
        while (grew) {
          grew = false
          for (const c of items) {
            if (c.parent_id && doomed.has(c.parent_id) && !doomed.has(c.id)) {
              doomed.add(c.id)
              grew = true
            }
          }
        }
        setItems((prev) => prev.filter((c) => !doomed.has(c.id)))
        if (replyTo && doomed.has(replyTo.id)) setReplyTo(null)
        toast('评论已删除')
      } else {
        toast('这条评论不属于你，无法删除')
      }
    } catch (err) {
      toast(errorMessage(err))
    }
  }

  async function submitReport(commentId: number, reason: string) {
    setReportBusy(commentId)
    const ok = await reportComment(commentId, reason)
    setReportBusy(null)
    if (ok) {
      setReported((prev) => new Set(prev).add(commentId))
      setReportingId(null)
    }
  }

  function renderComment(c: Comment, depth: 0 | 1) {
    const who = whoOf(c)
    const parent = c.parent_id ? items.find((x) => x.id === c.parent_id) : undefined
    const parentLabel = parent ? whoOf(parent).label : ''
    const replies = depth === 0 ? (tree.children.get(c.id) ?? []) : []

    return (
      <article className={depth ? 'comment-item comment-item-sub' : 'comment-item'} key={c.id}>
        <Avatar
          name={who.nick || who.label}
          size={depth ? 26 : 32}
          src={who.profile?.avatar_data ?? null}
        />
        <div className="comment-body">
          <div className="comment-head">
            <span
              className={who.nick ? 'comment-author' : 'comment-author comment-uid'}
              title={who.uid ? `账号 ID：${who.uid}` : '没有登记账号的访客'}
            >
              {who.label}
            </span>
            <span className="comment-time">{timeAgo(c.created_at)}</span>
            {c.hidden && <span className="badge badge-hidden">已下架</span>}
            {session && (
              <button
                type="button"
                className="comment-del comment-reply"
                onClick={() => {
                  if (!requireAuth()) return
                  setReportingId(null)
                  setReplyTo(replyTo?.id === c.id ? null : { id: c.id, label: who.label })
                }}
                aria-label={`回复 ${who.label}`}
              >
                回复
              </button>
            )}
            {session && c.owner_id === session.id ? (
              <button
                type="button"
                className="comment-del"
                onClick={() => void remove(c.id)}
                aria-label="删除这条评论"
              >
                删除
              </button>
            ) : session && reported.has(c.id) ? (
              <span className="comment-flag">已举报</span>
            ) : session ? (
              <button
                type="button"
                className="comment-del comment-report"
                onClick={() => {
                  setReplyTo(null)
                  setReportingId(reportingId === c.id ? null : c.id)
                }}
                aria-label="举报这条评论"
              >
                举报
              </button>
            ) : null}
          </div>
          <p className="comment-text">
            {depth > 0 && parentLabel && <span className="comment-at">回复 @{parentLabel}</span>}
            {c.content}
          </p>

          {replyTo?.id === c.id && (
            <ReplyBox
              key={c.id}
              label={who.label}
              busy={posting}
              onSubmit={(value) => submitReply(c, value)}
              onCancel={() => setReplyTo(null)}
            />
          )}

          {reportingId === c.id && (
            <div className="report-box">
              <span className="report-box-tip">这条评论哪里有问题？</span>
              <div className="report-reasons">
                {REPORT_REASONS.map((r) => (
                  <button
                    type="button"
                    key={r}
                    className="chip"
                    disabled={reportBusy === c.id}
                    onClick={() => void submitReport(c.id, r)}
                  >
                    {r}
                  </button>
                ))}
                <button type="button" className="comment-del" onClick={() => setReportingId(null)}>
                  取消
                </button>
              </div>
            </div>
          )}

          {replies.length > 0 && (
            <div className="comment-replies">
              {replies.map((child) => renderComment(child, 1))}
            </div>
          )}
        </div>
      </article>
    )
  }

  return (
    <section className="comments" aria-labelledby="comment-heading">
      <div className="section-head" style={{ marginTop: 40 }}>
        <h2 id="comment-heading">{heading}</h2>
        <span className="hint">
          {items.length} 条{replyTotal > 0 ? ` · 含 ${replyTotal} 条回复` : ''}
        </span>
      </div>

      <div className="comment-form">
        <textarea
          className="comment-input"
          placeholder={session ? '说说你对这个角色的看法…' : '登录后即可发表评论'}
          value={text}
          maxLength={500}
          onChange={(e) => {
            setText(e.target.value)
            setFormErr('')
          }}
          onFocus={() => {
            if (!session) requireAuth()
          }}
          aria-label="评论内容"
        />
        <div className="comment-form-foot">
          <span className="comment-tip">
            {session && meUid
              ? myProfile?.display_name
                ? `以「${myProfile.display_name}」的身份发表`
                : `以用户 #${meUid} 的身份发表（可在「我的」里设置昵称）`
              : session
                ? '当前账号信息异常，请重新登录后再评论'
                : '需要登录后才能评论'}
          </span>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => void submit()}
            disabled={posting}
          >
            {posting ? '发送中…' : '发布'}
          </button>
        </div>
        {formErr && <p className="form-error">{formErr}</p>}
      </div>

      {loading ? (
        <div className="loading">加载评论</div>
      ) : loadErr ? (
        <div className="empty" style={{ marginTop: 16 }}>
          <b>评论加载失败</b>
          {loadErr}
          <div style={{ marginTop: 12 }}>
            <button type="button" className="btn btn-sm" onClick={() => void load()}>
              重试
            </button>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="empty" style={{ marginTop: 16 }}>
          <b>还没有人开口</b>
          第一条评论的位置留给你。
        </div>
      ) : (
        <div className="comment-list">{tree.roots.map((c) => renderComment(c, 0))}</div>
      )}
    </section>
  )
}

/** 就地展开的回复框：不弹窗，挂在被回复的那条评论下面 */
function ReplyBox({
  label,
  busy,
  onSubmit,
  onCancel,
}: {
  label: string
  busy: boolean
  onSubmit: (value: string) => Promise<string | null>
  onCancel: () => void
}) {
  const [value, setValue] = useState('')
  const [err, setErr] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  return (
    <div className="reply-box">
      <textarea
        ref={ref}
        className="comment-input reply-input"
        rows={2}
        maxLength={500}
        placeholder={`回复 ${label}…`}
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          setErr('')
        }}
        aria-label={`回复 ${label}`}
      />
      <div className="reply-foot">
        {err ? (
          <span className="form-error">{err}</span>
        ) : (
          <span className="comment-tip">{label} · 回复会出现在这条评论下面</span>
        )}
        <div className="reply-actions">
          <button type="button" className="btn btn-sm btn-ghost" onClick={onCancel}>
            取消
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={busy}
            onClick={() => {
              void (async () => {
                const msg = await onSubmit(value)
                if (msg) setErr(msg)
                else setValue('')
              })()
            }}
          >
            {busy ? '发送中…' : '回复'}
          </button>
        </div>
      </div>
    </div>
  )
}
