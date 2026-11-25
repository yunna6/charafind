/**
 * official：正式收录，所有人可见
 * pending：用户投稿，等待管理员审核，只有投稿人自己和管理员看得到
 */
export type CharacterStatus = 'official' | 'pending'

export interface Work {
  id: number
  title: string
  title_jp: string | null
  // anime 同时覆盖动画与漫画（合并为「动漫」一类），game 单独一类
  kind: 'anime' | 'game' | string
  year: number | null
  studio: string | null
  summary: string | null
  tags: string[] | null
  accent: string | null
  cover_url: string | null
  cover_data: string | null
  status: CharacterStatus
}

export interface Character {
  id: number
  work_id: number
  name: string
  name_jp: string | null
  role: string | null
  cv: string | null
  birthday: string | null
  quote: string | null
  description: string | null
  tags: string[] | null
  accent: string | null
  avatar_url: string | null
  avatar_data: string | null
  hidden: boolean
  status: CharacterStatus | string
  owner_id: string | null
}

export interface CharacterStats {
  character_id: number
  like_count: number
  favorite_count: number
  /** 可见评论条数，只用于展示「N 条评论」 */
  comment_count: number
  /** 有效评论人数（去重、≥10 字、未被隐藏），热度只按这个算，刷条数无效 */
  commenter_count: number
  heat: number
}

export type CharacterWithStats = Character & {
  stats: CharacterStats
  work?: Work
}

export interface Comment {
  id: number
  owner_id: string
  owner_name: string | null
  target_type: string
  character_id: number | null
  content: string
  /** 回复的父评论 id；顶层评论为 null */
  parent_id: number | null
  /** 历史遗留的下架标记：现在举报处理是直接删除，新数据恒为 false */
  hidden: boolean
  created_at: string
}

/** 被举报的评论，管理员后台用 */
export interface ReportedComment {
  comment_id: number
  content: string
  owner_id: string
  target_type: string
  character_id: number | null
  created_at: string
  report_count: number
  last_reason: string | null
  hidden: boolean
}

/** 主管理员 / 次级管理员 的当前身份 */
export interface AdminState {
  isAdmin: boolean
  /** 主管理员：唯一，能审批管理员、能终审投稿 */
  isSuper: boolean
  adminCount: number
}

/**
 * 当前账号「需要亲自动手」的事，用于导航红点与管理台提示。
 * 只算当前身份真能处理的，别人的活不挂在自己头上。
 */
export interface AdminTodo {
  /** 待我审核/投票的投稿 */
  votes: number
  /** 下级已审完、等主管理员终审的投稿（次级管理员恒为 0） */
  finals: number
  /** 待处理举报 */
  reports: number
  /** 待审批的管理员申请（次级管理员恒为 0） */
  applications: number
  /** 我自己提交、还没出结果的稿件（普通用户也会关心） */
  mineOpen: number
  /** 合计：votes + finals + reports + applications */
  total: number
}

/** 普通用户提交的「成为管理员」申请 */
export interface AdminApplication {
  id: number
  user_id: string
  reason: string
  created_at: string
  display_name: string | null
  avatar_data: string | null
  bio: string | null
  comment_count: number
}

/** 我对自己的申请状态，用于「我的」页 */
export interface MyAdminApplication {
  status: 'pending' | 'approved' | 'rejected'
  reason: string
  created_at: string
  decided_at: string | null
}

/** 管理员名单里的一行 */
export interface AdminMember {
  user_id: string
  role: 'super' | 'moderator'
  created_at: string
  display_name: string | null
  avatar_data: string | null
  note: string | null
}

/** 次级管理员对某条投稿投的一票 */
export interface SubmissionReview {
  character_id: number
  reviewer_id: string
  decision: 'approve' | 'reject'
  note: string | null
  created_at: string
}

export interface SessionUser {
  id: string
  name?: string | null
  email?: string | null
  phone?: string | null
}

/** 站内个人资料：用户可以自定的对外身份，与登录账号 ID 分离 */
export interface UserProfile {
  owner_id: string
  display_name: string
  bio: string | null
  avatar_data: string | null
  updated_at: string | null
}
