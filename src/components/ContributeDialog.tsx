import { useEffect, useRef, useState } from 'react'
import { contributeCharacter, contributeWork } from '../api'
import { errorMessage } from '../cloud'
import { AVATAR_PRESET, compressImage } from '../media'
import { useApp } from '../store'

const ROLES = ['主角', '主要角色', '配角', '反派']

export function ContributeDialog() {
  const { contributeOpen, setContributeOpen, requireAuth, session, catalog, publicWorks, reload, toast } =
    useApp()

  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [workId, setWorkId] = useState<string>('')
  const [newWorkTitle, setNewWorkTitle] = useState('')
  const [newWorkKind, setNewWorkKind] = useState('anime')
  const [newWorkYear, setNewWorkYear] = useState('')

  const [name, setName] = useState('')
  const [nameJp, setNameJp] = useState('')
  const [role, setRole] = useState('配角')
  const [cv, setCv] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [avatarData, setAvatarData] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [imgBusy, setImgBusy] = useState(false)
  const [err, setErr] = useState('')
  const imgRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!contributeOpen) return
    setErr('')
    setSaving(false)
    const first = publicWorks[0]
    if (first) setWorkId(String(first.id))
    setMode(catalog && publicWorks.length > 0 ? 'existing' : 'new')
  }, [contributeOpen, catalog, publicWorks])

  if (!contributeOpen) return null

  async function onPickImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setImgBusy(true)
    try {
      setAvatarData(await compressImage(file, AVATAR_PRESET))
    } catch (e) {
      setErr(e instanceof Error ? e.message : '图片处理失败')
    } finally {
      setImgBusy(false)
    }
  }

  async function submit() {
    if (!requireAuth()) return
    if (!name.trim()) {
      setErr('请填写角色名')
      return
    }
    if (mode === 'existing' && !workId) {
      setErr('请选择所属作品')
      return
    }
    if (mode === 'new' && !newWorkTitle.trim()) {
      setErr('请填写作品名')
      return
    }

    setSaving(true)
    setErr('')
    try {
      let targetWorkId = Number(workId)
      if (mode === 'new') {
        const work = await contributeWork({
          title: newWorkTitle.trim(),
          kind: newWorkKind,
          year: newWorkYear ? Number(newWorkYear) : null,
        })
        targetWorkId = work.id
      }

      await contributeCharacter({
        workId: targetWorkId,
        name: name.trim(),
        nameJp: nameJp.trim(),
        role,
        cv: cv.trim(),
        description: description.trim(),
        tags: tags
          .split(/[,，\s]+/)
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 5),
        avatarData,
      })

      await reload()
      setContributeOpen(false)
      setName('')
      setNameJp('')
      setCv('')
      setDescription('')
      setTags('')
      setAvatarData(null)
      setNewWorkTitle('')
      setNewWorkYear('')
      toast('已提交，管理员审核通过后就会出现在图鉴里')
    } catch (e) {
      setErr(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contribute-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) setContributeOpen(false)
      }}
    >
      <div className="dialog wide">
        <h3 id="contribute-title">补充角色</h3>
        <p className="dialog-sub">
          {session
            ? '投稿会进入审核队列，管理员通过后才会公开。可以顺手把角色照片一起传上来。'
            : '请先登录，补充的内容会记录到你名下。'}
        </p>

        <div className="field">
          <label>所属作品</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className={mode === 'existing' ? 'chip active' : 'chip'}
              onClick={() => setMode('existing')}
              disabled={!publicWorks.length}
            >
              选择已有作品
            </button>
            <button
              type="button"
              className={mode === 'new' ? 'chip active' : 'chip'}
              onClick={() => setMode('new')}
            >
              新建作品
            </button>
          </div>
        </div>

        {mode === 'existing' ? (
          <div className="field">
            <label htmlFor="c-work">作品</label>
            <select
              id="c-work"
              className="input"
              value={workId}
              onChange={(e) => setWorkId(e.target.value)}
            >
              {publicWorks.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.title}
                  {w.year ? `（${w.year}）` : ''}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <div className="field">
              <label htmlFor="c-newwork">作品名</label>
              <input
                id="c-newwork"
                className="input"
                placeholder="例如：夏日重现"
                value={newWorkTitle}
                onChange={(e) => setNewWorkTitle(e.target.value)}
              />
            </div>
            <div className="field">
              <label>类型与年份</label>
              <div style={{ display: 'flex', gap: 9 }}>
                <select
                  className="input"
                  value={newWorkKind}
                  onChange={(e) => setNewWorkKind(e.target.value)}
                  aria-label="作品类型"
                >
                  <option value="anime">动漫（动画 / 漫画）</option>
                  <option value="game">游戏</option>
                </select>
                <input
                  className="input"
                  inputMode="numeric"
                  placeholder="年份"
                  value={newWorkYear}
                  onChange={(e) => setNewWorkYear(e.target.value)}
                  aria-label="作品年份"
                />
              </div>
            </div>
          </>
        )}

        <div className="field">
          <label htmlFor="c-name">角色名 *</label>
          <input
            id="c-name"
            className="input"
            placeholder="例如：网代慎平"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="c-namejp">日文名</label>
          <input
            id="c-namejp"
            className="input"
            placeholder="可选"
            value={nameJp}
            onChange={(e) => setNameJp(e.target.value)}
          />
        </div>

        <div className="field">
          <label>角色照片</label>
          <div className="contrib-photo">
            <div className="contrib-photo-frame">
              {avatarData ? (
                <img src={avatarData} alt="角色照片预览" />
              ) : (
                <span>{imgBusy ? '压缩中…' : '未选择'}</span>
              )}
            </div>
            <div className="contrib-photo-actions">
              <button
                type="button"
                className="btn btn-sm"
                disabled={imgBusy}
                onClick={() => imgRef.current?.click()}
              >
                {imgBusy ? '处理中…' : avatarData ? '更换照片' : '选择照片'}
              </button>
              {avatarData && (
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => setAvatarData(null)}
                >
                  移除
                </button>
              )}
              <p className="contrib-photo-hint">
                正脸方图最好，浏览器会先压到 240px 再上传。没有照片也可以提交，审核通过后由管理员补。
              </p>
            </div>
          </div>
          <input
            ref={imgRef}
            type="file"
            accept="image/*"
            onChange={(e) => void onPickImage(e)}
            style={{ display: 'none' }}
          />
        </div>

        <div className="field">
          <label htmlFor="c-role">角色定位</label>
          <select id="c-role" className="input" value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="c-cv">声优 / CV</label>
          <input
            id="c-cv"
            className="input"
            placeholder="可选"
            value={cv}
            onChange={(e) => setCv(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="c-desc">一句话简介</label>
          <textarea
            id="c-desc"
            className="comment-input"
            style={{ minHeight: 64 }}
            placeholder="TA 是谁，为什么值得被记住"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="c-tags">标签（逗号分隔，最多 5 个）</label>
          <input
            id="c-tags"
            className="input"
            placeholder="例如：冷静, 推理, 主角"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
        </div>

        {err && <p className="form-error">{err}</p>}

        <div className="dialog-foot">
          <button type="button" className="btn" onClick={() => setContributeOpen(false)}>
            取消
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void submit()} disabled={saving}>
            {saving ? '提交中…' : '提交补充'}
          </button>
        </div>
      </div>
    </div>
  )
}
