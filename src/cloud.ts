import { createWorkBuddyCloud } from '@tencent-ai/workbuddy-cloud-sdk'
import { createDemoCloud } from './demo'

/**
 * 云端环境公开配置。
 * 这三个值来自云服务环境创建时返回的 publicConfig，可以出现在前端代码中；
 * publishableKey 只标识「哪个应用」，权限由服务端按 Origin 校验。
 */
export const publicConfig = {
  endpoint: 'https://charafind.app.workbuddy.host',
  oauthRelayBaseUrl: 'https://www.workbuddy.cn/v2/as/genie-baas/oauth',
  publishableKey: 'wbpk_r4DIZmf8vHy5gJIJohDBNJ_AN8kLurvElVLzE6JgrfjV51fGQvSgUJ9',
}

/**
 * 两种运行形态：
 * - 完整版（默认）：连真实云服务，可登录、点赞、评论、投稿、审核。
 * - 演示版（VITE_DEMO=1）：GitHub Pages 静态托管用，读打包好的只读快照。
 *   云服务按 Origin 放行，Pages 域名不在白名单内，直连会被 403 拒掉，
 *   所以静态托管必须走演示数据层，否则页面能开但数据全空。
 */
export const IS_DEMO = import.meta.env.VITE_DEMO === '1'

/** 完整版线上地址，演示版页面里用它做「去完整版」出口 */
export const FULL_SITE_URL = 'https://charafind.app.workbuddy.host/?sharecode=QJ7XR3VUWS'

type Cloud = ReturnType<typeof createWorkBuddyCloud>

export const cloud: Cloud = IS_DEMO
  ? (createDemoCloud() as unknown as Cloud)
  : createWorkBuddyCloud({
      endpoint: publicConfig.endpoint,
      oauthRelayBaseUrl: publicConfig.oauthRelayBaseUrl,
      publishableKey: publicConfig.publishableKey,
    })

/** 把 { data, error } 包成 throw，调用点更清爽 */
export function unwrap<T>(res: { data: T; error: unknown }): T {
  if (res.error) throw res.error
  return res.data
}

/** 数据库把「For more information, please refer to ...」拼在 message 后面，展示前切掉 */
function tidy(text: string): string {
  return text.split(' For more information')[0].trim() || '请求失败，请稍后重试'
}

export function errorMessage(err: unknown): string {
  if (!err) return '未知错误'
  if (typeof err === 'string') return tidy(err)
  const e = err as { message?: string; kind?: string; code?: string }
  if (e.message) return tidy(e.message)
  if (e.kind) return e.kind
  return '请求失败，请稍后重试'
}
