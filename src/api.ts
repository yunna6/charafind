import { cloud } from './cloud'
import type {
  AdminApplication,
  AdminMember,
  AdminState,
  Character,
  CharacterStats,
  CharacterWithStats,
  Comment,
  MyAdminApplication,
  ReportedComment,
  SubmissionReview,
  UserProfile,
  Work,
} from './types'

const EMPTY_STATS: CharacterStats = {
  character_id: 0,
  like_count: 0,
  favorite_count: 0,
  comment_count: 0,
  commenter_count: 0,
  heat: 0,
}

export interface Catalog {
  works: Work[]
  characters: CharacterWithStats[]
}

/** 一次性把作品、角色、聚合热度全部取回（数据量小，前端本地检索更快） */
export async function fetchCatalog(): Promise<Catalog> {
  const [workRes, charRes, statRes] = await Promise.all([
    cloud.database
      .from('works')
      .select('id,title,title_jp,kind,year,studio,summary,tags,accent,cover_url,cover_data,status')
      .order('year', { ascending: false }),
    cloud.database
      .from('characters')
      .select(
        'id,work_id,name,name_jp,role,cv,birthday,quote,description,tags,accent,avatar_url,avatar_data,hidden,status,owner_id',
      )
      .order('id', { ascending: true }),
    cloud.database.rpc('character_stats'),
  ])

  if (workRes.error) throw workRes.error
  if (charRes.error) throw charRes.error

  const works = (workRes.data ?? []) as Work[]
  const workById = new Map<number, Work>(works.map((w) => [w.id, w]))

  // 统计函数失败时不让整个页面挂掉：热度只由互动产生，退化为 0
  const statRows = (statRes?.error ? [] : (statRes?.data ?? [])) as CharacterStats[]
  const statById = new Map<number, CharacterStats>()
  for (const s of statRows) statById.set(Number(s.character_id), s)

  const characters = ((charRes.data ?? []) as Character[]).map((c) => ({
    ...c,
    work: workById.get(c.work_id),
    stats: statById.get(c.id) ?? { ...EMPTY_STATS, character_id: c.id },
  }))

  // 热度并列时按点赞、收藏、评论、id 依次排，避免榜单顺序随机抖动
  characters.sort(
    (a, b) =>
      b.stats.heat - a.stats.heat ||
      b.stats.like_count - a.stats.like_count ||
      b.stats.favorite_count - a.stats.favorite_count ||
      b.stats.commenter_count - a.stats.commenter_count ||
      a.id - b.id,
  )
  return { works, characters }
}

/** 当前用户点过赞 / 收藏过的角色（RLS 只返回自己的行） */
export async function fetchMyMarks(): Promise<{ likes: number[]; favorites: number[] }> {
  const [likeRes, favRes] = await Promise.all([
    cloud.database.from('likes').select('character_id'),
    cloud.database.from('favorites').select('character_id'),
  ])
  if (likeRes.error) throw likeRes.error
  if (favRes.error) throw favRes.error
  return {
    likes: (likeRes.data ?? []).map((r: { character_id: number }) => Number(r.character_id)),
    favorites: (favRes.data ?? []).map((r: { character_id: number }) => Number(r.character_id)),
  }
}

/* ------------------------------ 个人资料 ------------------------------ */

const PROFILE_FIELDS = 'owner_id,display_name,bio,avatar_data,updated_at'

/** 全站资料一人一行、量很小，一次取回，评论与排行榜署名直接查表 */
export async function fetchProfiles(): Promise<UserProfile[]> {
  const { data, error } = await cloud.database.from('profiles').select(PROFILE_FIELDS)
  if (error) throw error
  return (data ?? []) as UserProfile[]
}

export interface ProfilePatch {
  display_name: string
  bio: string | null
  avatar_data: string | null
}

/**
 * 取出 PostgreSQL 的 5 位 SQLSTATE。
 * 云 SDK 会把错误码包成 `DATABASE_23505` 这种形式，直接和 '23505' 比较永远不相等，
 * 所以这里统一剥壳，避免把「重复操作」误判成失败。
 */
function sqlStateOf(err: unknown): string {
  const e = err as { code?: string; message?: string; details?: string } | null
  const fromCode = /(\d{5})/.exec(e?.code ?? '')
  if (fromCode) return fromCode[1]
  const fromText = /(\d{5})/.exec(`${e?.message ?? ''} ${e?.details ?? ''}`)
  return fromText ? fromText[1] : ''
}

/** 把写库错误翻成人话，登录失效时别让用户看到 row-level security 这种词 */
function writeError(err: unknown, fallback: string): Error {
  const state = sqlStateOf(err)
  if (state === '42501') return new Error('登录状态已失效，请重新登录后再试')
  if (err instanceof Error) return err
  return new Error(fallback)
}

/** 名字被占用时数据库抛 23505，这里转成能直接显示给用户的说法 */
function profileError(err: unknown): Error {
  const state = sqlStateOf(err)
  const text = `${(err as { message?: string } | null)?.message ?? ''}`
  if (state === '23505' || text.includes('profiles_display_name_key')) {
    return new Error('这个用户 ID 已经被别人用了，换一个吧')
  }
  if (state === '23514') {
    return new Error('资料格式不符合要求：用户 ID 2–20 字，签名最多 120 字')
  }
  if (state === '42501') {
    return new Error('登录状态已失效，请重新登录后再保存')
  }
  return err instanceof Error ? err : new Error('资料保存失败，请重试')
}

/** 保存我的资料：没有记录就插入，已有就更新（RLS 保证只能动自己那一行） */
export async function saveProfile(ownerId: string, patch: ProfilePatch): Promise<UserProfile> {
  const row = { ...patch, owner_id: ownerId, updated_at: new Date().toISOString() }

  const { data: existing, error: findError } = await cloud.database
    .from('profiles')
    .select('owner_id')
    .eq('owner_id', ownerId)
    .limit(1)
  if (findError) throw profileError(findError)

  if (Array.isArray(existing) && existing.length > 0) {
    const { data, error } = await cloud.database
      .from('profiles')
      .update(row)
      .eq('owner_id', ownerId)
      .select(PROFILE_FIELDS)
    if (error) throw profileError(error)
    const saved = (Array.isArray(data) ? data[0] : data) as UserProfile | undefined
    if (!saved) throw new Error('资料没有保存成功，请重新登录后再试')
    return saved
  }

  const { data, error } = await cloud.database
    .from('profiles')
    .insert(row)
    .select(PROFILE_FIELDS)
  if (error) throw profileError(error)
  const saved = (Array.isArray(data) ? data[0] : data) as UserProfile | undefined
  if (!saved) throw new Error('资料没有保存成功，请重新登录后再试')
  return saved
}

type MarkTable = 'likes' | 'favorites'
/**
 * 点赞 / 收藏的写入。
 * 两个动作都做成幂等的：已经点过再点、本来没点再取消，都不该报错——
 * 用户看到的应该是「状态已经是这样了」，而不是一条数据库异常。
 */
export async function setMark(table: MarkTable, characterId: number, on: boolean): Promise<void> {
  if (on) {
    const { error } = await cloud.database.from(table).insert({ character_id: characterId })
    // 23505 说明这条记录已经存在（重复点击、多标签页、状态没同步），当作已点赞
    if (error && sqlStateOf(error) !== '23505') throw writeError(error, '操作失败，请重试')
    return
  }
  const { error } = await cloud.database
    .from(table)
    .delete()
    .eq('character_id', characterId)
    .select()
  // 本来就没有这条记录时删除返回 0 行，同样算取消成功
  if (error) throw writeError(error, '操作失败，请重试')
}

export async function fetchComments(params: {
  targetType: 'character' | 'ranking'
  characterId?: number
}): Promise<Comment[]> {
  let query = cloud.database
    .from('comments')
    .select('id,owner_id,owner_name,target_type,character_id,content,parent_id,hidden,created_at')
    .eq('target_type', params.targetType)
    .order('created_at', { ascending: false })
    .limit(200)

  if (params.targetType === 'character') {
    query = query.eq('character_id', params.characterId ?? -1)
  } else {
    query = query.is('character_id', null)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Comment[]
}

export async function addComment(params: {
  targetType: 'character' | 'ranking'
  characterId?: number | null
  content: string
  userName?: string | null
  /** 回复某条评论时传入它的 id，楼中楼（两层）*/
  parentId?: number | null
}): Promise<Comment> {
  const { data, error } = await cloud.database
    .from('comments')
    .insert({
      target_type: params.targetType,
      character_id: params.characterId ?? null,
      content: params.content,
      owner_name: params.userName ?? null,
      parent_id: params.parentId ?? null,
    })
    .select()

  if (error) throw error
  const created = (data ?? [])[0] as Comment | undefined
  if (!created) throw new Error('评论没有保存成功，请重试')
  return created
}

export async function deleteComment(id: number): Promise<boolean> {
  const { data, error } = await cloud.database.from('comments').delete().eq('id', id).select()
  if (error) throw error
  return Array.isArray(data) && data.length > 0
}

/**
 * SDK 的 Database 类型是平台内置 schema，自己新建的 RPC 不在类型里，
 * 所以只在这一处放宽签名；调用点仍然拿得到 { data, error }。
 */
const callRpc = cloud.database.rpc as unknown as (
  fn: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: unknown }>

/** 举报一条评论：同一个人对同一条只能举报一次，重复举报在数据库里被吞掉 */
export async function reportComment(commentId: number, reason?: string): Promise<void> {
  const { error } = await callRpc('report_comment', {
    p_comment_id: commentId,
    p_reason: reason ?? null,
  })
  if (error) throw error
}

/** 管理员：被举报的评论队列（数据库函数内部校验 is_admin） */
export async function fetchReportedComments(): Promise<ReportedComment[]> {
  const { data, error } = await callRpc('reported_comments', {})
  if (error) throw error
  return (data ?? []) as ReportedComment[]
}

/** 管理员：判定举报为误报，清空这条评论的举报记录（评论本身保留） */
export async function dismissCommentReports(commentId: number): Promise<void> {
  const { error } = await callRpc('dismiss_comment_reports', { p_id: commentId })
  if (error) throw error
}

/** 管理员：彻底删除一条评论 */
export async function adminDeleteComment(commentId: number): Promise<void> {
  const { error } = await callRpc('admin_delete_comment', { p_id: commentId })
  if (error) throw error
}

export async function contributeCharacter(input: {
  workId: number
  name: string
  nameJp?: string
  role?: string
  cv?: string
  description?: string
  tags?: string[]
  quote?: string
  avatarData?: string | null
}): Promise<Character> {
  const { data, error } = await cloud.database
    .from('characters')
    .insert({
      work_id: input.workId,
      name: input.name,
      name_jp: input.nameJp || null,
      role: input.role || '配角',
      cv: input.cv || null,
      description: input.description || null,
      quote: input.quote || null,
      tags: input.tags ?? [],
      avatar_data: input.avatarData ?? null,
      // 投稿一律进入待审队列，RLS 会强制这个值，前端写什么都越不过去
      status: 'pending',
      hidden: false,
    })
    .select()

  if (error) throw error
  const created = (data ?? [])[0] as Character | undefined
  if (!created) throw new Error('补充失败，请重试')
  return created
}

export async function contributeWork(input: {
  title: string
  kind: string
  year?: number | null
  summary?: string
  accent?: string
}): Promise<Work> {
  const { data, error } = await cloud.database
    .from('works')
    .insert({
      title: input.title,
      kind: input.kind,
      year: input.year ?? null,
      summary: input.summary || null,
      accent: input.accent || '#c2417a',
      status: 'pending',
    })
    .select()

  if (error) throw error
  const created = (data ?? [])[0] as Work | undefined
  if (!created) throw new Error('作品创建失败，请重试')
  return created
}

/* ------------------------------ 管理员 ------------------------------ */

/** 当前登录者的管理员身份（是否管理员 / 是否主管理员 / 站内管理员总数） */
export async function fetchAdminState(): Promise<AdminState> {
  const { data, error } = await cloud.database.rpc('admin_state')
  if (error) throw error
  const row = (Array.isArray(data) ? data[0] : data) as
    | { is_admin?: boolean; is_super?: boolean; admin_count?: number }
    | undefined
  return {
    isAdmin: Boolean(row?.is_admin),
    isSuper: Boolean(row?.is_super),
    adminCount: Number(row?.admin_count ?? 0),
  }
}

/** 首个登录用户认领管理员（服务端保证只有表为空时才生效） */
export async function claimAdmin(): Promise<boolean> {
  const { data, error } = await cloud.database.rpc('claim_admin')
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  return Boolean(row)
}

/** 下架 / 恢复角色，仅管理员可通过 RLS */
export async function setCharacterHidden(id: number, hidden: boolean): Promise<void> {
  const { data, error } = await cloud.database
    .from('characters')
    .update({ hidden })
    .eq('id', id)
    .select('id')
  if (error) throw error
  if (!Array.isArray(data) || data.length === 0) throw new Error('没有权限修改这个角色')
}

/** 更换角色照片（传 null 表示清空，回到渐变字形） */
export async function setCharacterImage(id: number, dataUrl: string | null): Promise<void> {
  const { data, error } = await cloud.database
    .from('characters')
    .update({ avatar_data: dataUrl })
    .eq('id', id)
    .select('id')
  if (error) throw error
  if (!Array.isArray(data) || data.length === 0) throw new Error('没有权限修改这个角色')
}

/** 管理员可直接修改的角色文字字段（英文名对应数据库列） */
export interface CharacterTextPatch {
  name?: string
  name_jp?: string | null
  role?: string | null
  cv?: string | null
  birthday?: string | null
  quote?: string | null
  description?: string | null
  tags?: string[] | null
}

/** 修改角色文字资料，仅管理员可通过 RLS（characters_admin_all） */
export async function updateCharacterText(id: number, patch: CharacterTextPatch): Promise<void> {
  const { data, error } = await cloud.database
    .from('characters')
    .update(patch)
    .eq('id', id)
    .select('id')
  if (error) throw error
  if (!Array.isArray(data) || data.length === 0) throw new Error('没有权限修改这个角色')
}

/** 更换作品封面（传 null 表示清空） */
export async function setWorkImage(id: number, dataUrl: string | null): Promise<void> {
  const { data, error } = await cloud.database
    .from('works')
    .update({ cover_data: dataUrl })
    .eq('id', id)
    .select('id')
  if (error) throw error
  if (!Array.isArray(data) || data.length === 0) throw new Error('没有权限修改这部作品')
}

/** 作品下若已没有角色、且本身是投稿产物，就顺手清掉，避免留下空壳作品 */
async function cleanupOrphanWork(workId: number): Promise<void> {
  const { data } = await cloud.database
    .from('characters')
    .select('id')
    .eq('work_id', workId)
    .limit(1)
  if (Array.isArray(data) && data.length > 0) return
  await cloud.database.from('works').delete().eq('id', workId).eq('status', 'pending')
}

/** 审核结果：official=已上架，waiting_super=等待主管理员终审，reviewing=还差一票，rejected=已驳回删除 */
export type ReviewOutcome = 'official' | 'waiting_super' | 'reviewing' | 'rejected'

/**
 * 审核投稿。规则全部在数据库函数里，前端只负责传结果：
 * 主管理员一票定生死；次级管理员只记票，两票都通过（或投票人已投满）才进终审，两票都拒绝直接删。
 */
export async function reviewSubmission(
  characterId: number,
  approve: boolean,
  note?: string,
): Promise<ReviewOutcome> {
  const { data, error } = await callRpc('review_submission', {
    p_id: characterId,
    p_approve: approve,
    p_note: note ?? null,
  })
  if (error) throw error
  return String(data) as ReviewOutcome
}

/** 所有待审投稿的投票记录（只有管理员能读到，RLS 里判定） */
export async function fetchSubmissionReviews(): Promise<SubmissionReview[]> {
  const { data, error } = await cloud.database
    .from('character_reviews')
    .select('character_id,reviewer_id,decision,note,created_at')
  if (error) throw error
  return (data ?? []) as SubmissionReview[]
}

/** 投稿人在审核前撤回自己的投稿 */
export async function withdrawSubmission(params: {
  characterId: number
  workId: number
}): Promise<void> {
  const { data, error } = await cloud.database
    .from('characters')
    .delete()
    .eq('id', params.characterId)
    .select('id')
  if (error) throw error
  if (!Array.isArray(data) || data.length === 0) throw new Error('这份投稿已经处理过了')
  await cleanupOrphanWork(params.workId)
}

/* ---------------------- 管理员申请与团队（仅主管理员） ---------------------- */

/** 普通用户提交申请：理由 8–300 字，被拒后 24 小时内不能重申（数据库里判定） */
export async function applyAdmin(reason: string): Promise<void> {
  const { error } = await callRpc('apply_admin', { p_reason: reason })
  if (error) throw error
}

/** 我自己最近一条申请，没有则返回 null */
export async function fetchMyAdminApplication(): Promise<MyAdminApplication | null> {
  const { data, error } = await callRpc('my_admin_application', {})
  if (error) throw error
  const row = (Array.isArray(data) ? data[0] : data) as MyAdminApplication | undefined
  return row ?? null
}

/** 主管理员：待审批的申请队列 */
export async function fetchAdminApplications(): Promise<AdminApplication[]> {
  const { data, error } = await callRpc('pending_admin_applications', {})
  if (error) throw error
  return (data ?? []) as AdminApplication[]
}

/** 主管理员：批准 / 拒绝一条申请。批准后对方立刻成为次级管理员 */
export async function reviewAdminApplication(id: number, approve: boolean): Promise<void> {
  const { error } = await callRpc('review_admin_application', {
    p_id: id,
    p_approve: approve,
  })
  if (error) throw error
}

/** 主管理员：现有管理员名单 */
export async function fetchAdminMembers(): Promise<AdminMember[]> {
  const { data, error } = await callRpc('admin_members', {})
  if (error) throw error
  return (data ?? []) as AdminMember[]
}

/** 主管理员：撤销某个次级管理员 */
export async function revokeAdmin(userId: string): Promise<void> {
  const { error } = await callRpc('revoke_admin', { p_user_id: userId })
  if (error) throw error
}
