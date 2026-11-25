import { useEffect, useRef, useState } from 'react'
import { cloud, errorMessage } from '../cloud'
import { useApp } from '../store'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function LoginDialog() {
  const { loginOpen, setLoginOpen, toast } = useApp()
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sending, setSending] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')
  const [countdown, setCountdown] = useState(0)

  // 验证挑战放在 handler 之外，重试验证码时不会重新发码
  const pending = useRef<{ email: string; verificationId: string; isExistingUser: boolean } | null>(
    null,
  )

  useEffect(() => {
    if (!loginOpen) {
      setStep('email')
      setCode('')
      setErr('')
      setCountdown(0)
      pending.current = null
    }
  }, [loginOpen])

  useEffect(() => {
    if (countdown <= 0) return
    const t = window.setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => window.clearTimeout(t)
  }, [countdown])

  if (!loginOpen) return null

  async function sendCode() {
    const value = email.trim()
    if (!EMAIL_RE.test(value)) {
      setErr('请输入正确的邮箱地址')
      return
    }
    setErr('')
    setSending(true)
    try {
      const sent = await cloud.auth.sendOtp({ email: value })
      if (sent.error) {
        setErr(errorMessage(sent.error))
        return
      }
      pending.current = {
        email: value,
        verificationId: sent.data.verificationId,
        isExistingUser: sent.data.isExistingUser,
      }
      setStep('code')
      setCountdown(60)
    } catch (e) {
      setErr(errorMessage(e))
    } finally {
      setSending(false)
    }
  }

  async function submitCode() {
    const value = email.trim()
    const token = code.trim()
    if (!token) {
      setErr('请输入验证码')
      return
    }
    const saved = pending.current
    if (!saved || saved.email !== value) {
      setErr('请先为当前邮箱获取验证码')
      return
    }
    setErr('')
    setSubmitting(true)
    try {
      const completed = await cloud.auth.verifyOtp({
        email: saved.email,
        verificationId: saved.verificationId,
        isExistingUser: saved.isExistingUser,
        token,
      })
      if (completed.error) {
        setErr(errorMessage(completed.error))
        return
      }
      pending.current = null
      setLoginOpen(false)
      toast('登录成功，欢迎回来')
    } catch (e) {
      setErr(errorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) setLoginOpen(false)
      }}
    >
      <div className="dialog">
        <h3 id="login-title">登录 / 注册</h3>
        <p className="dialog-sub">用邮箱验证码即可，无需设置密码。登录后才能点赞、收藏和评论。</p>

        {step === 'email' ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void sendCode()
            }}
          >
            <div className="field">
              <label htmlFor="login-email">邮箱</label>
              <input
                id="login-email"
                className="input"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setErr('')
                }}
                autoFocus
              />
            </div>
            {err && <p className="form-error">{err}</p>}
            <div className="dialog-foot">
              <button type="submit" className="btn btn-primary" disabled={sending}>
                {sending ? '发送中…' : '获取验证码'}
              </button>
            </div>
            <p className="form-note">
              首次登录会自动注册账号。验证码会发送到上面的邮箱，10 分钟内有效。
            </p>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void submitCode()
            }}
          >
            <div className="field">
              <label htmlFor="login-code">验证码</label>
              <div className="otp-row">
                <input
                  id="login-code"
                  className="input"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="6 位验证码"
                  maxLength={8}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value)
                    setErr('')
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  className="btn"
                  onClick={() => void sendCode()}
                  disabled={sending || countdown > 0}
                >
                  {countdown > 0 ? `${countdown}s` : sending ? '发送中' : '重新发送'}
                </button>
              </div>
            </div>
            <p className="form-note" style={{ marginTop: 8 }}>
              已发送至 {email}
            </p>
            {err && <p className="form-error">{err}</p>}
            <div className="dialog-foot">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setStep('email')
                  setCode('')
                  setErr('')
                }}
              >
                换个邮箱
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? '验证中…' : '登录'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
