/**
 * 抓取线上公开数据，生成 GitHub Pages 演示版用的只读快照。
 *
 * 为什么不在浏览器里抓：云服务按 Origin 放行，localhost 与本站域名在白名单内，
 * 所以本地直接发请求就能拿到公开数据（RLS 只返回 official 状态的公开行）。
 *
 * 用法：npm run snapshot
 * 产物：public/demo/snapshot.json（构建演示版时随静态资源一起发布）
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ENDPOINT = 'https://charafind.app.workbuddy.host'
const PUBLISHABLE_KEY = 'wbpk_r4DIZmf8vHy5gJIJohDBNJ_AN8kLurvElVLzE6JgrfjV51fGQvSgUJ9'
const REST = `${ENDPOINT}/.cloud/database/rest`

/** 每次带 Origin: localhost —— 服务端按这个头做白名单校验 */
const HEADERS = {
  Origin: 'http://127.0.0.1',
  'x-wb-webapp-access-key': PUBLISHABLE_KEY,
}

const TABLES = ['works', 'characters', 'profiles', 'comments']

async function getJson(url, init = {}) {
  // 数据面偶发 502，重试几次比失败更省事
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const res = await fetch(url, { ...init, headers: { ...HEADERS, ...init.headers } })
    const text = await res.text()
    if (res.ok) {
      try {
        return JSON.parse(text)
      } catch {
        /* 落到重试 */
      }
    }
    if (attempt === 4) throw new Error(`${url} 请求失败：HTTP ${res.status} ${text.slice(0, 120)}`)
    await new Promise((r) => setTimeout(r, 600 * attempt))
  }
  return null
}

async function main() {
  const snapshot = { generated_at: new Date().toISOString() }

  for (const table of TABLES) {
    snapshot[table] = await getJson(`${REST}/${table}?select=*`)
    console.log(`${table}: ${snapshot[table].length} 行`)
  }

  // 热度来自聚合函数而不是表，单独取
  snapshot.stats = await getJson(`${REST}/rpc/character_stats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })
  console.log(`stats: ${snapshot.stats.length} 行`)

  const out = resolve(dirname(fileURLToPath(import.meta.url)), '../public/demo/snapshot.json')
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, JSON.stringify(snapshot))
  console.log(`写入 ${out}（${(JSON.stringify(snapshot).length / 1024).toFixed(0)} KB）`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
