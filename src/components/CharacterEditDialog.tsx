import { useEffect, useState } from 'react'
import { useApp } from '../store'
import type { CharacterWithStats } from '../types'

const ROLES = ['主角', '主要角色', '配角', '反派']

const TAG_SPLIT = /[,，\s]+/

/**
 * 管理员编辑角色文字资料。
 * 只动文本字段，照片和上下架仍走角色页上的独立按钮。
 */
export function CharacterEditDialog({
  character,
  onClose,
}: {
  character: CharacterWithStats
  onClose: () => void
}) {
  const { adminEditText } = useApp()

  const [name, setName] = useState(character.name)
  const [nameJp, setNameJp] = useState(character.name_jp ?? '')
  const [role, setRole] = useState(character.role ?? '配角')
  const [cv, setCv] = useState(character.cv ?? '')
  const [birthday, setBirthday] = useState(character.birthday ?? '')
  const [quote, setQuote] = useState(character.quote ?? '')
  const [description, setDescription] = useState(character.description ?? '')
  const [tags, setTags] = useState((character.tags ?? []).join(', '))

  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function submit() {
    if (!name.trim()) {
      setErr('角色名不能为空')
      return
    }
    setSaving(true)
    setErr('')
    const ok = await adminEditText(character.id, {
      name: name.trim(),
      name_jp: nameJp.trim() || null,
      role: role || null,
      cv: cv.trim() || null,
      birthday: birthday.trim() || null,
      quote: quote.trim() || null,
      description: description.trim() || null,
      tags: tags
        .split(TAG_SPLIT)
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 6),
    })
    setSaving(false)
    if (ok) onClose()
  }

  return (
    <div
      className="dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-character-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="dialog wide">
        <h3 id="edit-character-title">编辑角色资料</h3>
        <p className="dialog-sub">
          仅管理员可见。修改会立即同步到角色页、作品角色表和搜索结果。
        </p>

        <div className="field">
          <label htmlFor="e-name">角色名 *</label>
          <input
            id="e-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：芙莉莲"
          />
        </div>

        <div className="field">
          <label htmlFor="e-namejp">日文名</label>
          <input
            id="e-namejp"
            className="input"
            value={nameJp}
            onChange={(e) => setNameJp(e.target.value)}
            placeholder="例如：フリーレン"
          />
        </div>

        <div className="field">
          <label htmlFor="e-role">角色定位</label>
          <select id="e-role" className="input" value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
            {/* 数据库里可能有自定义定位，保留它免得一保存就被改掉 */}
            {role && !ROLES.includes(role) && <option value={role}>{role}</option>}
          </select>
        </div>

        <div className="field">
          <label htmlFor="e-cv">声优 / CV</label>
          <input
            id="e-cv"
            className="input"
            value={cv}
            onChange={(e) => setCv(e.target.value)}
            placeholder="留空则不显示"
          />
        </div>

        <div className="field">
          <label htmlFor="e-birthday">生日</label>
          <input
            id="e-birthday"
            className="input"
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
            placeholder="例如：1月1日"
          />
        </div>

        <div className="field">
          <label htmlFor="e-quote">台词</label>
          <input
            id="e-quote"
            className="input"
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            placeholder="那句让人记住 TA 的话"
          />
        </div>

        <div className="field">
          <label htmlFor="e-desc">简介</label>
          <textarea
            id="e-desc"
            className="comment-input"
            style={{ minHeight: 84 }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="TA 是谁，在这部作品里做了什么"
          />
        </div>

        <div className="field">
          <label htmlFor="e-tags">标签（逗号分隔，最多 6 个）</label>
          <input
            id="e-tags"
            className="input"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="例如：精灵, 魔法使, 淡然"
          />
        </div>

        {err && <p className="form-error">{err}</p>}

        <div className="dialog-foot">
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void submit()} disabled={saving}>
            {saving ? '保存中…' : '保存修改'}
          </button>
        </div>
      </div>
    </div>
  )
}
