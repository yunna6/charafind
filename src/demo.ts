/**
 * 静态演示版数据层（VITE_DEMO=1 时启用）。
 *
 * 为什么需要它：正式版的数据全部走 WorkBuddy 云服务，而云服务服务端会校验请求的
 * Origin ——只放行本站域名与 localhost。GitHub Pages 的域名不在白名单里，直接打接口
 * 会被 403 `the request origin is not allowed for this client`，页面能开但一条数据都读不出来。
 *
 * 所以 Pages 版本改用「构建时打包好的只读快照」：把公开数据（作品 / 角色 / 统计 /
 * 评论 / 资料）抓成 public/demo/snapshot.json，这一层用一个极小的 PostgREST 风格
 * 查询器把它喂给 api.ts，页面上的检索、筛选、排序、排行榜全部照常工作。
 * 写操作（点赞、评论、投稿、审核）一律返回只读提示，因此不需要伪造任何权限。
 */

type Row = Record<string, unknown>

export interface Snapshot {
  generated_at?: string
  works: Row[]
  characters: Row[]
  profiles: Row[]
  comments: Row[]
  stats: Row[]
}

type Clause = { column: string; op: 'eq' | 'is'; value: unknown }
type TableName = 'works' | 'characters' | 'profiles' | 'comments' | 'likes' | 'favorites' | 'character_reviews'
type CloudResult = { data: unknown; error: { message: string } | null }

const SNAPSHOT_URL = `${import.meta.env.BASE_URL}demo/snapshot.json`

/** 所有写操作统一的回应：用 Error 实例，api.ts 的既有错误处理会把 message 原样显示 */
const READONLY = '这是只读演示版，点赞、评论、投稿请在完整版站点进行'
const readonlyError = () => new Error(READONLY)

let cached: Promise<Snapshot> | null = null

function loadSnapshot(): Promise<Snapshot> {
  if (!cached) {
    cached = fetch(SNAPSHOT_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`演示数据加载失败（HTTP ${res.status}）`)
        return res.json() as Promise<Snapshot>
      })
      .catch((err: unknown) => {
        // 失败不缓存，用户刷新页面还能再试一次
        cached = null
        throw err
      })
  }
  return cached
}

function rowsOf(snap: Snapshot, table: TableName): Row[] {
  switch (table) {
    case 'works':
      return snap.works
    case 'characters':
      return snap.characters
    case 'profiles':
      return snap.profiles
    case 'comments':
      return snap.comments
    default:
      // 点赞 / 收藏 / 审核记录都是登录态私有数据，演示版没有登录，天然为空
      return []
  }
}

/**
 * 只实现 api.ts 真正用到的那部分 PostgREST 语义：
 * `from(t).select().eq().is().order().limit()`，以及 insert / update / delete / rpc。
 * 刻意保持 thenable，所以 `await cloud.database.from('x').select()` 的写法不用改。
 */
class DemoQuery implements PromiseLike<CloudResult> {
  private readonly table: TableName
  private action: 'select' | 'insert' | 'update' | 'delete' = 'select'
  private readonly clauses: Clause[] = []
  private orderBy: { column: string; ascending: boolean } | null = null
  private maxRows: number | null = null

  constructor(table: TableName) {
    this.table = table
  }

  select(_columns?: string): this {
    this.action = 'select'
    return this
  }

  insert(_row: Row | Row[]): this {
    this.action = 'insert'
    return this
  }

  update(_patch: Row): this {
    this.action = 'update'
    return this
  }

  delete(): this {
    this.action = 'delete'
    return this
  }

  eq(column: string, value: unknown): this {
    this.clauses.push({ column, op: 'eq', value })
    return this
  }

  is(column: string, value: unknown): this {
    this.clauses.push({ column, op: 'is', value })
    return this
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.orderBy = { column, ascending: options?.ascending !== false }
    return this
  }

  limit(count: number): this {
    this.maxRows = count
    return this
  }

  private matches(row: Row): boolean {
    return this.clauses.every((clause) => {
      const current = row[clause.column] ?? null
      return clause.op === 'eq' ? current === clause.value : current === (clause.value ?? null)
    })
  }

  private async run(): Promise<CloudResult> {
    if (this.action !== 'select') return { data: null, error: readonlyError() }

    const snapshot = await loadSnapshot()
    let rows = rowsOf(snapshot, this.table).filter((row) => this.matches(row))

    if (this.orderBy) {
      const { column, ascending } = this.orderBy
      rows = [...rows].sort((a, b) => {
        const left = a[column]
        const right = b[column]
        if (left === right) return 0
        if (left == null) return 1
        if (right == null) return -1
        const diff = left > right ? 1 : -1
        return ascending ? diff : -diff
      })
    }

    if (this.maxRows != null) rows = rows.slice(0, this.maxRows)
    return { data: rows, error: null }
  }

  then<TResult1 = CloudResult, TResult2 = never>(
    onfulfilled?: ((value: CloudResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.run().then(onfulfilled, onrejected)
  }
}

/** 只读版的 RPC：聚合统计来自快照，其余（审核、举报、申请）一律拒绝 */
async function demoRpc(fn: string): Promise<CloudResult> {
  if (fn === 'character_stats') {
    const snapshot = await loadSnapshot()
    return { data: snapshot.stats, error: null }
  }
  if (fn === 'admin_state') {
    return { data: [{ is_admin: false, is_super: false, admin_count: 0 }], error: null }
  }
  if (fn === 'my_admin_application') {
    return { data: [], error: null }
  }
  return { data: null, error: readonlyError() }
}

/** 演示版没有登录能力，登录态永远是「未登录」 */
const demoAuth = {
  getSession: async () => ({ data: null, error: null }),
  onAuthStateChange: (_handler: (event: string, session: unknown) => void) => () => {},
  signOut: async () => ({ error: null }),
  sendOtp: async (_params: unknown) => ({ data: null, error: readonlyError() }),
  verifyOtp: async (_params: unknown) => ({ data: null, error: readonlyError() }),
}

export function createDemoCloud() {
  return {
    database: {
      from: (table: string) => new DemoQuery(table as TableName),
      rpc: (fn: string, _args?: Record<string, unknown>) => demoRpc(fn),
    },
    auth: demoAuth,
  }
}
