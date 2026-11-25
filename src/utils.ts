/** 把 #rrggbb 调暗/调亮，用于生成头像渐变 */
export function shade(hex: string, amount: number): string {
  const safe = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#c2417a'
  const num = parseInt(safe.slice(1), 16)
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amount))
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount))
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

export function hexToRgba(hex: string, alpha: number): string {
  const safe = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#c2417a'
  const num = parseInt(safe.slice(1), 16)
  const r = (num >> 16) & 0xff
  const g = (num >> 8) & 0xff
  const b = num & 0xff
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function cnNumber(n: number): string {
  if (!Number.isFinite(n)) return '0'
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(Math.round(n))
}

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const diff = Date.now() - then
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour} 小时前`
  const day = Math.floor(hour / 24)
  if (day < 30) return `${day} 天前`
  return new Date(iso).toLocaleDateString('zh-CN')
}

export function firstChar(text: string | null | undefined): string {
  const t = (text ?? '').trim()
  if (!t) return '？'
  return Array.from(t)[0]
}

/** 图片取值：数据库内嵌图优先，其次静态文件 / 外链 */
export function imageSrc(data?: string | null, url?: string | null): string | null {
  if (data && data.trim()) return data
  if (url && url.trim()) return url
  return null
}

export const KIND_LABEL: Record<string, string> = {
  // 动画与漫画合并为「动漫」一类，manga 仅作历史数据兜底
  anime: '动漫',
  game: '游戏',
  manga: '动漫',
}
