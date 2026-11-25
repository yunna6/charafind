import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useApp } from '../store'
import { compressImage, AVATAR_PRESET } from '../media'
import { errorMessage } from '../cloud'
import { Avatar } from './Avatar'

const NAME_MIN = 2
const NAME_MAX = 20
const BIO_MAX = 120

/** 只允许常规可见字符，避免名字里混进换行、全角空格、emoji 组合把排版撑坏 */
const NAME_PATTERN = /^[\p{L}\p{N}_\-.· ]+$/u

function validateName(raw: string): string {
  const name = raw.trim()
  if (name.length < NAME_MIN) return `用户 ID 至少 ${NAME_MIN} 个字`
  if (name.length > NAME_MAX) return `用户 ID 最多 ${NAME_MAX} 个字`
  if (!NAME_PATTERN.test(name)) return '只能用中文、字母、数字、下划线、连字符和间隔号'
  if (name.includes('  ')) return '不要连续两个空格'
  return ''
}

export function ProfileEditDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { session, myProfile, saveMyProfile } = useApp()
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarData, setAvatarData] = useState<string | null>(null)
  const [imgBusy, setImgBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // 每次打开都用当前资料填充，取消过的修改不会残留
  useEffect(() => {
    if (!open) return
    setName(myProfile?.display_name ?? session?.name ?? '')
    setBio(myProfile?.bio ?? '')
    setAvatarData(myProfile?.avatar_data ?? null)
    setErr('')
    setImgBusy(false)
    setSaving(false)
  }, [open, myProfile, session])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !session) return null

  async function pickImage(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImgBusy(true)
    setErr('')
    try {
      setAvatarData(await compressImage(file, AVATAR_PRESET))
    } catch (error) {
      setErr(errorMessage(error))
    } finally {
      setImgBusy(false)
    }
  }

  async function submit() {
    const clean = name.trim()
    const nameError = validateName(clean)
    if (nameError) {
      setErr(nameError)
      return
    }
    setErr('')
    setSaving(true)
    const ok = await saveMyProfile({
      display_name: clean,
      bio: bio.trim() ? bio.trim() : null,
      avatar_data: avatarData,
    })
    setSaving(false)
    if (ok) onClose()
  }

  // 预览只看本地状态：点了「移除」就该立刻变回渐变字，不能回退读旧头像
  const preview = avatarData
  const currentName = myProfile?.display_name ?? session.name ?? ''

  return (
    <div className="dialog-backdrop" onClick={onClose} role="presentation">
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-edit-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="profile-edit-title">编辑个人资料</h3>
        <p className="dialog-sub">
          {currentName ? `当前显示为「${currentName}」` : '还没设置过资料'}
          ，改完会立刻显示在评论和排行榜里。
        </p>

        <div className="field">
          <label>头像</label>
          <div className="profile-avatar-row">
            <Avatar name={name || session.id} size={64} src={preview} />
            <div className="profile-avatar-actions">
              <button
                type="button"
                className="btn btn-sm"
                disabled={imgBusy}
                onClick={() => fileRef.current?.click()}
              >
                {imgBusy ? '处理中…' : avatarData ? '更换头像' : '上传头像'}
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
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => void pickImage(e)}
              />
            </div>
          </div>
          <p className="field-hint">方图最好，浏览器会先压到 240px 再存，不会拖慢页面。</p>
        </div>

        <div className="field">
          <label htmlFor="profile-name">用户 ID</label>
          <input
            id="profile-name"
            className="input"
            value={name}
            maxLength={NAME_MAX + 6}
            placeholder="例如：绫"
            onChange={(e) => {
              setName(e.target.value)
              setErr('')
            }}
          />
          <p className="field-hint">
            {NAME_MIN}–{NAME_MAX} 字，全站唯一，会出现在你发的每条评论上。这段是你对外展示的名字，登录账号本身不受影响。
          </p>
        </div>

        <div className="field">
          <label htmlFor="profile-bio">个性签名</label>
          <textarea
            id="profile-bio"
            className="input profile-bio"
            value={bio}
            maxLength={BIO_MAX}
            rows={3}
            placeholder="一句话介绍自己，比如「只补冷门角色」"
            onChange={(e) => {
              setBio(e.target.value)
              setErr('')
            }}
          />
          <p className="field-hint">
            <span className={bio.length > BIO_MAX - 10 ? 'profile-count warn' : 'profile-count'}>
              {bio.length} / {BIO_MAX}
            </span>
            ，不写也行。
          </p>
        </div>

        {err && <p className="form-error">{err}</p>}

        <div className="dialog-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
            取消
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void submit()} disabled={saving || imgBusy}>
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
