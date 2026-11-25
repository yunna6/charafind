import { useState } from 'react'
import { firstChar, shade } from '../utils'

interface Props {
  name: string | null | undefined
  accent?: string | null
  size?: number
  large?: boolean
  /** 撑满父容器（海报卡等自适应场景用），此时 size 只决定字号 */
  fluid?: boolean
  /** 角色头像地址；为空或加载失败时自动退回渐变字形 */
  src?: string | null
}

export function Avatar({ name, accent, size = 44, large = false, fluid = false, src }: Props) {
  const base = accent || '#c2417a'
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const showImage = Boolean(src) && failedSrc !== src

  return (
    <div
      className={[large ? 'avatar avatar-lg' : 'avatar', showImage ? 'has-image' : ''].join(' ').trim()}
      style={{
        width: fluid ? '100%' : size,
        height: fluid ? '100%' : size,
        fontSize: Math.round((fluid ? size || 44 : size) * 0.42),
        background: `linear-gradient(145deg, ${shade(base, 26)}, ${shade(base, -46)})`,
      }}
      aria-hidden="true"
    >
      {showImage ? (
        <img
          className="avatar-img"
          src={src as string}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailedSrc(src ?? null)}
        />
      ) : (
        <span>{firstChar(name)}</span>
      )}
    </div>
  )
}
