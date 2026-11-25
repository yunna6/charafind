/**
 * 浏览器端图片压缩。
 * 公开页面要展示的图片直接以内嵌 dataURL 存进数据库，所以必须在客户端先压到很小，
 * 否则一次拉全站数据会把首屏拖垮。
 */

const MAX_BYTES = 420_000 // 约 420KB，超过就继续降质量

export interface CompressOptions {
  /** 长边最大像素 */
  maxSide: number
  /** webp 质量 0–1 */
  quality: number
}

async function drawToDataUrl(
  bitmap: ImageBitmap,
  maxSide: number,
  quality: number,
): Promise<string> {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('浏览器不支持图片压缩，换个浏览器再试')

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, width, height)

  const webp = canvas.toDataURL('image/webp', quality)
  if (webp.startsWith('data:image/webp')) return webp
  return canvas.toDataURL('image/jpeg', quality)
}

export async function compressImage(file: File, options: CompressOptions): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('请选择图片文件（jpg / png / webp）')
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('这张图读不出来，换一张试试')
  }

  try {
    let quality = options.quality
    let dataUrl = await drawToDataUrl(bitmap, options.maxSide, quality)

    // 极端情况下仍偏大，逐步降质量
    while (dataUrl.length > MAX_BYTES && quality > 0.42) {
      quality -= 0.12
      dataUrl = await drawToDataUrl(bitmap, options.maxSide, quality)
    }

    if (dataUrl.length > MAX_BYTES) {
      throw new Error('图片太大了，换一张更小的，或者先裁一下')
    }
    return dataUrl
  } finally {
    bitmap.close?.()
  }
}

/** 角色头像：显示最大 124px，2 倍屏 248px，压到 240 足够 */
export const AVATAR_PRESET: CompressOptions = { maxSide: 240, quality: 0.76 }

/** 作品封面：卡片 108px 高、海报 178px 高，640 已经绰绰有余 */
export const COVER_PRESET: CompressOptions = { maxSide: 640, quality: 0.74 }
