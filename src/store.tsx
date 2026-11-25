import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { cloud, errorMessage, IS_DEMO } from './cloud'
import {
  adminDeleteComment as adminDeleteCommentApi,
  applyAdmin as applyAdminApi,
  claimAdmin,
  dismissCommentReports as dismissCommentReportsApi,
  fetchAdminApplications,
  fetchAdminMembers,
  fetchAdminState,
  fetchCatalog,
  fetchMyAdminApplication,
  fetchMyMarks,
  fetchProfiles,
  fetchReportedComments,
  fetchSubmissionReviews,
  reportComment as apiReportComment,
  reviewAdminApplication,
  reviewSubmission,
  revokeAdmin as revokeAdminApi,
  saveProfile,
  setCharacterHidden,
  setCharacterImage,
  setMark,
  setWorkImage,
  updateCharacterText,
  withdrawSubmission,
  type Catalog,
  type CharacterTextPatch,
  type ProfilePatch,
  type ReviewOutcome,
} from './api'
import type {
  AdminApplication,
  AdminMember,
  AdminState,
  AdminTodo,
  CharacterWithStats,
  MyAdminApplication,
  ReportedComment,
  SessionUser,
  SubmissionReview,
  UserProfile,
  Work,
} from './types'

type Theme = 'light' | 'dark'

interface AppContextValue {
  catalog: Catalog | null
  loading: boolean
  loadError: string | null
  reload: () => Promise<void>
  session: SessionUser | null
  authReady: boolean
  likes: Set<number>
  favorites: Set<number>
  toggleLike: (characterId: number) => Promise<void>
  toggleFavorite: (characterId: number) => Promise<void>
  requireAuth: () => boolean
  loginOpen: boolean
  setLoginOpen: (open: boolean) => void
  contributeOpen: boolean
  setContributeOpen: (open: boolean) => void
  signOut: () => Promise<void>
  theme: Theme
  toggleTheme: () => void
  toast: (message: string) => void
  /* 个人资料 */
  /** 全站用户资料（owner_id → 资料），评论署名与头像靠它 */
  profiles: Map<string, UserProfile>
  /** 我的资料，未建档为 null */
  myProfile: UserProfile | null
  /** 我的对外名字，未建档时退回账号 ID 尾部，保证任何地方都有名字可显示 */
  myDisplayName: string
  /** 保存昵称 / 头像 / 签名，失败返回 false 并已 toast */
  saveMyProfile: (patch: ProfilePatch) => Promise<boolean>
  /* 管理员 */
  isAdmin: boolean
  /** 主管理员：唯一，能审批管理员与终审投稿 */
  isSuper: boolean
  adminCount: number
  /** 需要当前账号亲自处理的事，用于导航红点与管理台提示 */
  adminTodo: AdminTodo
  publicCharacters: CharacterWithStats[]
  publicWorks: Work[]
  /** 待审投稿（含审核中、待终审）：管理员看得到全部，普通用户只看得到自己提交的 */
  pendingCharacters: CharacterWithStats[]
  mySubmissions: CharacterWithStats[]
  /** 每条待审投稿的次级管理员投票 */
  submissionReviews: SubmissionReview[]
  claimAdminRole: () => Promise<void>
  adminSetHidden: (characterId: number, hidden: boolean) => Promise<void>
  adminSetAvatar: (characterId: number, dataUrl: string | null) => Promise<void>
  adminSetCover: (workId: number, dataUrl: string | null) => Promise<void>
  /** 管理员编辑角色文字资料，返回是否保存成功 */
  adminEditText: (characterId: number, patch: CharacterTextPatch) => Promise<boolean>
  /** 审核投稿：主管理员一步到位，次级管理员只记票 */
  adminReview: (characterId: number, approve: boolean) => Promise<void>
  withdrawMine: (characterId: number, workId: number) => Promise<void>
  /* 管理员申请（普通用户） */
  myAdminApplication: MyAdminApplication | null
  /** 提交申请，返回是否成功 */
  applyAdminRole: (reason: string) => Promise<boolean>
  /* 管理员团队（仅主管理员可见） */
  adminApplications: AdminApplication[]
  adminMembers: AdminMember[]
  adminDecideApplication: (applicationId: number, approve: boolean) => Promise<void>
  adminRevoke: (userId: string) => Promise<void>
  /* 评论治理 */
  /** 被举报的评论队列，只有管理员非空 */
  reportedComments: ReportedComment[]
  /** 举报一条评论。返回 false 表示失败或已经举报过 */
  reportComment: (commentId: number, reason?: string) => Promise<boolean>
  /** 管理员：判定误报，清空这条评论的举报记录 */
  adminDismissReports: (commentId: number) => Promise<void>
  /** 管理员：彻底删除评论 */
  adminDeleteComment: (commentId: number) => Promise<void>
  /** 管理员：重新拉取举报队列 */
  refreshReports: () => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}

function readInitialTheme(): Theme {
  // 支持 ?theme=dark 分享链接，其次读首屏脚本已经写好的 data-theme
  try {
    const qp = new URLSearchParams(window.location.search).get('theme')
    if (qp === 'dark' || qp === 'light') return qp
  } catch {
    /* ignore */
  }
  const attr = document.documentElement.dataset.theme
  return attr === 'dark' ? 'dark' : 'light'
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [session, setSession] = useState<SessionUser | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [likes, setLikes] = useState<Set<number>>(new Set())
  const [favorites, setFavorites] = useState<Set<number>>(new Set())
  const [loginOpen, setLoginOpen] = useState(false)
  const [contributeOpen, setContributeOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(readInitialTheme)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [admin, setAdmin] = useState<AdminState>({
    isAdmin: false,
    isSuper: false,
    adminCount: 0,
  })
  const [myAdminApplication, setMyAdminApplication] = useState<MyAdminApplication | null>(null)
  const [adminApplications, setAdminApplications] = useState<AdminApplication[]>([])
  const [adminMembers, setAdminMembers] = useState<AdminMember[]>([])
  const [submissionReviews, setSubmissionReviews] = useState<SubmissionReview[]>([])
  const toastTimer = useRef<number | null>(null)
  const [profiles, setProfiles] = useState<Map<string, UserProfile>>(new Map())
  const [reportedComments, setReportedComments] = useState<ReportedComment[]>([])

  /** 资料是全站公开的轻量数据，访客也要拉：看评论时要显示别人的昵称和头像 */
  const loadProfiles = useCallback(async () => {
    try {
      const rows = await fetchProfiles()
      setProfiles(new Map(rows.map((p) => [p.owner_id, p])))
    } catch {
      /* 静默：拿不到资料就退回账号 ID，不影响浏览 */
    }
  }, [])

  useEffect(() => {
    void loadProfiles()
  }, [loadProfiles])

  const toast = useCallback((message: string) => {
    setToastMsg(message)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 2600)
  }, [])

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchCatalog()
      setCatalog(data)
      setLoadError(null)
    } catch (err) {
      setLoadError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  // 主题写到 <html data-theme> 并持久化
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('charafind-theme', theme)
    } catch {
      /* 隐私模式下忽略 */
    }
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#121114' : '#f7f4ef')
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  // 恢复会话 + 监听登录态变化
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const res = await cloud.auth.getSession()
        if (!alive) return
        const user = (res?.data as { user?: SessionUser } | null)?.user
        setSession(user ?? null)
      } catch {
        if (alive) setSession(null)
      } finally {
        if (alive) setAuthReady(true)
      }
    })()

    const unsubscribe = cloud.auth.onAuthStateChange?.((_event: string, next: unknown) => {
      if (!alive) return
      const user = (next as { user?: SessionUser } | null)?.user
      setSession(user ?? null)
      setAuthReady(true)
    })

    return () => {
      alive = false
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [])

  // 登录后拉取我的点赞 / 收藏
  useEffect(() => {
    let alive = true
    if (!session) {
      setLikes(new Set())
      setFavorites(new Set())
      return
    }
    void (async () => {
      // 会话刚恢复时 token 可能还没就绪，第一次读可能返回空/失败，
      // 这里重试一次，避免刷新后「已点赞」的图标集体熄灭、用户又去点一次。
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const marks = await fetchMyMarks()
          if (!alive) return
          setLikes(new Set(marks.likes))
          setFavorites(new Set(marks.favorites))
          return
        } catch {
          if (attempt === 0) {
            await new Promise((resolve) => window.setTimeout(resolve, 700))
            if (!alive) return
          }
        }
      }
    })()
    return () => {
      alive = false
    }
  }, [session])

  const requireAuth = useCallback(() => {
    if (session) return true
    // 演示版没有登录能力，弹登录框只会让人白等验证码，直接说明原因
    if (IS_DEMO) {
      toast('只读演示版：点赞、评论请到完整版')
      return false
    }
    setLoginOpen(true)
    return false
  }, [session, toast])

  // 登录态变化后确认管理员身份；未登录直接清零
  useEffect(() => {
    let alive = true
    if (!session) {
      setAdmin({ isAdmin: false, isSuper: false, adminCount: 0 })
      setMyAdminApplication(null)
      setAdminApplications([])
      setAdminMembers([])
      setSubmissionReviews([])
      return
    }
    void (async () => {
      try {
        const [state, myApp] = await Promise.all([fetchAdminState(), fetchMyAdminApplication()])
        if (!alive) return
        setAdmin(state)
        setMyAdminApplication(myApp)
      } catch {
        if (alive) setAdmin({ isAdmin: false, isSuper: false, adminCount: 0 })
      }
    })()
    return () => {
      alive = false
    }
  }, [session])

  /** 投稿票与管理员团队都是管理台私有数据，拉不到就静默（非管理员本来就没权限） */
  const refreshSubmissionReviews = useCallback(async () => {
    try {
      setSubmissionReviews(await fetchSubmissionReviews())
    } catch {
      /* 静默 */
    }
  }, [])

  const refreshAdminTeam = useCallback(async () => {
    try {
      const [apps, members] = await Promise.all([fetchAdminApplications(), fetchAdminMembers()])
      setAdminApplications(apps)
      setAdminMembers(members)
    } catch {
      /* 静默：只有主管理员读得到 */
    }
  }, [])

  const claimAdminRole = useCallback(async () => {
    if (!session) {
      setLoginOpen(true)
      return
    }
    try {
      const ok = await claimAdmin()
      if (!ok) {
        toast('已经有人是管理员了，不能重复认领')
        setAdmin(await fetchAdminState())
        return
      }
      setAdmin(await fetchAdminState())
      await reload()
      toast('管理权限已到手')
    } catch (err) {
      toast(errorMessage(err))
    }
  }, [reload, session, toast])

  /** 普通用户申请成为管理员 */
  const applyAdminRole = useCallback(
    async (reason: string) => {
      try {
        await applyAdminApi(reason)
        setMyAdminApplication(await fetchMyAdminApplication())
        toast('申请已提交，等主管理员处理')
        return true
      } catch (err) {
        toast(errorMessage(err))
        return false
      }
    },
    [toast],
  )

  /** 主管理员：批准 / 拒绝一条管理员申请 */
  const adminDecideApplication = useCallback(
    async (applicationId: number, approve: boolean) => {
      try {
        await reviewAdminApplication(applicationId, approve)
        await Promise.all([refreshAdminTeam(), reload()])
        toast(approve ? '已通过，对方成为次级管理员' : '已拒绝这条申请')
      } catch (err) {
        toast(errorMessage(err))
      }
    },
    [refreshAdminTeam, reload, toast],
  )

  /** 主管理员：撤销一个次级管理员 */
  const adminRevoke = useCallback(
    async (userId: string) => {
      try {
        await revokeAdminApi(userId)
        await refreshAdminTeam()
        toast('已撤销这个管理员')
      } catch (err) {
        toast(errorMessage(err))
      }
    },
    [refreshAdminTeam, toast],
  )

  const adminSetHidden = useCallback(
    async (characterId: number, hidden: boolean) => {
      try {
        await setCharacterHidden(characterId, hidden)
        await reload()
        toast(hidden ? '已下架，公开页面不再显示' : '已恢复上架')
      } catch (err) {
        toast(errorMessage(err))
      }
    },
    [reload, toast],
  )

  const adminSetAvatar = useCallback(
    async (characterId: number, dataUrl: string | null) => {
      try {
        await setCharacterImage(characterId, dataUrl)
        await reload()
        toast(dataUrl ? '照片已更新' : '已恢复默认头像')
      } catch (err) {
        toast(errorMessage(err))
      }
    },
    [reload, toast],
  )

  const adminSetCover = useCallback(
    async (workId: number, dataUrl: string | null) => {
      try {
        await setWorkImage(workId, dataUrl)
        await reload()
        toast(dataUrl ? '封面已更新' : '已恢复默认封面')
      } catch (err) {
        toast(errorMessage(err))
      }
    },
    [reload, toast],
  )

  const adminEditText = useCallback(
    async (characterId: number, patch: CharacterTextPatch) => {
      try {
        await updateCharacterText(characterId, patch)
        await reload()
        toast('资料已更新')
        return true
      } catch (err) {
        toast(errorMessage(err))
        return false
      }
    },
    [reload, toast],
  )

  const adminReview = useCallback(
    async (characterId: number, approve: boolean) => {
      try {
        const outcome = await reviewSubmission(characterId, approve)
        await Promise.all([reload(), refreshSubmissionReviews()])
        const msg: Record<ReviewOutcome, string> = {
          official: '已通过，角色正式上线',
          waiting_super: '已记录，等主管理员终审',
          reviewing: '已记录，还差另一位管理员审核',
          rejected: '已驳回并删除这条投稿',
        }
        toast(msg[outcome] ?? '已处理')
      } catch (err) {
        toast(errorMessage(err))
      }
    },
    [reload, refreshSubmissionReviews, toast],
  )

  const withdrawMine = useCallback(
    async (characterId: number, workId: number) => {
      try {
        await withdrawSubmission({ characterId, workId })
        await reload()
        toast('已撤回投稿')
      } catch (err) {
        toast(errorMessage(err))
      }
    },
    [reload, toast],
  )

  /* ---------- 评论治理 ---------- */

  const refreshReports = useCallback(async () => {
    try {
      setReportedComments(await fetchReportedComments())
    } catch {
      /* 静默：非管理员本来就读不到，不必弹错 */
    }
  }, [])

  // 管理员身份确认后才拉举报队列与审核票；退出管理员身份就清空，别把队列留在内存里
  useEffect(() => {
    if (!admin.isAdmin) {
      setReportedComments([])
      setSubmissionReviews([])
      return
    }
    void refreshReports()
    void refreshSubmissionReviews()
  }, [admin.isAdmin, refreshReports, refreshSubmissionReviews])

  // 申请队列与管理员名单只有主管理员读得到
  useEffect(() => {
    if (!admin.isSuper) {
      setAdminApplications([])
      setAdminMembers([])
      return
    }
    void refreshAdminTeam()
  }, [admin.isSuper, refreshAdminTeam])

  /**
   * 红点得是活的：别人投稿、举报、申请时，正在看页面的人也应尽快看到。
   * 45 秒静默拉一次；切回标签页 / 窗口重新聚焦时立刻补一次。
   * 静默 = 不动 loading，避免整页闪骨架屏。
   */
  useEffect(() => {
    if (!admin.isAdmin) return
    let alive = true

    const tick = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const data = await fetchCatalog()
        if (alive) setCatalog(data)
      } catch {
        /* 静默：网络抖动时保留旧数据，不清空页面 */
      }
      if (!alive) return
      void refreshReports()
      void refreshSubmissionReviews()
      if (admin.isSuper) void refreshAdminTeam()
    }

    const timer = window.setInterval(() => void tick(), 45_000)
    const onWake = () => {
      if (document.visibilityState === 'visible') void tick()
    }
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('focus', onWake)

    return () => {
      alive = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('focus', onWake)
    }
  }, [admin.isAdmin, admin.isSuper, refreshAdminTeam, refreshReports, refreshSubmissionReviews])

  const reportComment = useCallback(
    async (commentId: number, reason?: string) => {
      try {
        await apiReportComment(commentId, reason)
        toast('已提交举报，管理员会尽快处理')
        return true
      } catch (err) {
        toast(errorMessage(err))
        return false
      }
    },
    [toast],
  )

  const adminDismissReports = useCallback(
    async (commentId: number) => {
      try {
        await dismissCommentReportsApi(commentId)
        await refreshReports()
        toast('举报已忽略，评论保留')
      } catch (err) {
        toast(errorMessage(err))
      }
    },
    [refreshReports, toast],
  )

  const adminRemoveComment = useCallback(
    async (commentId: number) => {
      try {
        await adminDeleteCommentApi(commentId)
        await Promise.all([reload(), refreshReports()])
        toast('评论已彻底删除')
      } catch (err) {
        toast(errorMessage(err))
      }
    },
    [reload, refreshReports, toast],
  )

  // 管理员能读到待审和已下架的数据，公开列表必须自己再筛一遍
  const publicCharacters = useMemo(
    () => (catalog?.characters ?? []).filter((c) => !c.hidden && c.status === 'official'),
    [catalog],
  )

  const publicWorks = useMemo(
    () => (catalog?.works ?? []).filter((w) => w.status === 'official'),
    [catalog],
  )

  /** 未完成的投稿：刚提交 / 次级审核中 / 等主管理员终审 */
  const pendingCharacters = useMemo(
    () =>
      (catalog?.characters ?? []).filter(
        (c) => c.status === 'pending' || c.status === 'reviewing' || c.status === 'waiting_super',
      ),
    [catalog],
  )

  const mySubmissions = useMemo(
    () => pendingCharacters.filter((c) => c.owner_id && c.owner_id === session?.id),
    [pendingCharacters, session],
  )

  /**
   * 红点只统计「自己现在就能处理」的事：
   * - 主管理员：没人碰过的投稿（可一票通过）、待终审、举报、管理员申请
   * - 次级管理员：还没投过票的待审稿、举报；管理员申请与终审不归他
   * - 普通用户：没有待办，只有自己的稿件在流转（「我的」页显示进度而非红点）
   */
  const adminTodo = useMemo<AdminTodo>(() => {
    const myId = session?.id
    const votedByMe = new Set(
      submissionReviews.filter((r) => r.reviewer_id === myId).map((r) => r.character_id),
    )
    let votes = 0
    let finals = 0
    /** 除自己以外还有几个次级管理员：不足 2 人时，主管理员得提前接手 */
    const modCount = Math.max(0, admin.adminCount - 1)

    if (admin.isAdmin) {
      for (const c of pendingCharacters) {
        const mine = Boolean(c.owner_id && c.owner_id === myId)
        if (mine) continue
        if (admin.isSuper) {
          if (c.status === 'waiting_super') finals += 1
          // 有两个以上次级管理员时，新稿先由他们投票，不去打扰主管理员
          else if (c.status === 'pending' && modCount < 2) votes += 1
          // reviewing 说明下级正在推进，不挂在主管理员头上反复闪
        } else if (
          (c.status === 'pending' || c.status === 'reviewing') &&
          !votedByMe.has(c.id)
        ) {
          votes += 1
        }
      }
    }

    const reports = admin.isAdmin ? reportedComments.length : 0
    const applications = admin.isSuper ? adminApplications.length : 0
    return {
      votes,
      finals,
      reports,
      applications,
      mineOpen: mySubmissions.length,
      total: votes + finals + reports + applications,
    }
  }, [
    admin.isAdmin,
    admin.isSuper,
    admin.adminCount,
    adminApplications.length,
    mySubmissions.length,
    pendingCharacters,
    reportedComments.length,
    session?.id,
    submissionReviews,
  ])

  const myProfile = useMemo(
    () => (session ? (profiles.get(session.id) ?? null) : null),
    [profiles, session],
  )

  // 没有建档也要有个能喊出口的名字，否则导航栏只能显示「我的」
  const myDisplayName = useMemo(() => {
    if (myProfile?.display_name) return myProfile.display_name
    const fromSession = (session?.name ?? '').trim()
    if (fromSession) return fromSession
    if (session) return `用户${session.id.slice(-4)}`
    return ''
  }, [myProfile, session])

  const saveMyProfile = useCallback(
    async (patch: ProfilePatch) => {
      if (!session) {
        setLoginOpen(true)
        return false
      }
      try {
        const saved = await saveProfile(session.id, patch)
        setProfiles((prev) => {
          const next = new Map(prev)
          next.set(saved.owner_id, saved)
          return next
        })
        toast('资料已保存')
        return true
      } catch (err) {
        toast(errorMessage(err))
        return false
      }
    },
    [session, toast],
  )

  const bumpStats = useCallback(
    (characterId: number, dLike: number, dFav: number) => {
      setCatalog((prev) => {
        if (!prev) return prev
        const characters = prev.characters.map((c) => {
          if (c.id !== characterId) return c
          const like_count = Math.max(0, c.stats.like_count + dLike)
          const favorite_count = Math.max(0, c.stats.favorite_count + dFav)
          // 热度只由真实互动产生：点赞 ×10 + 收藏 ×25 + 讨论人数 ×5（按人去重，刷条数无效）
          const heat = like_count * 10 + favorite_count * 25 + c.stats.commenter_count * 5
          return { ...c, stats: { ...c.stats, like_count, favorite_count, heat } }
        })
        return { ...prev, characters }
      })
    },
    [],
  )

  const toggleLike = useCallback(
    async (characterId: number) => {
      if (!requireAuth()) return
      const willLike = !likes.has(characterId)
      setLikes((prev) => {
        const next = new Set(prev)
        if (willLike) next.add(characterId)
        else next.delete(characterId)
        return next
      })
      bumpStats(characterId, willLike ? 1 : -1, 0)
      try {
        await setMark('likes', characterId, willLike)
        toast(willLike ? '已点赞' : '已取消点赞')
      } catch (err) {
        setLikes((prev) => {
          const next = new Set(prev)
          if (willLike) next.delete(characterId)
          else next.add(characterId)
          return next
        })
        bumpStats(characterId, willLike ? -1 : 1, 0)
        toast(errorMessage(err))
      }
    },
    [bumpStats, likes, requireAuth, toast],
  )

  const toggleFavorite = useCallback(
    async (characterId: number) => {
      if (!requireAuth()) return
      const willFav = !favorites.has(characterId)
      setFavorites((prev) => {
        const next = new Set(prev)
        if (willFav) next.add(characterId)
        else next.delete(characterId)
        return next
      })
      bumpStats(characterId, 0, willFav ? 1 : -1)
      try {
        await setMark('favorites', characterId, willFav)
        toast(willFav ? '已收藏' : '已取消收藏')
      } catch (err) {
        setFavorites((prev) => {
          const next = new Set(prev)
          if (willFav) next.delete(characterId)
          else next.add(characterId)
          return next
        })
        bumpStats(characterId, 0, willFav ? -1 : 1)
        toast(errorMessage(err))
      }
    },
    [bumpStats, favorites, requireAuth, toast],
  )

  const signOut = useCallback(async () => {
    try {
      await cloud.auth.signOut()
      setSession(null)
      setLikes(new Set())
      setFavorites(new Set())
      toast('已退出登录')
    } catch (err) {
      toast(errorMessage(err))
    }
  }, [toast])

  const value = useMemo<AppContextValue>(
    () => ({
      catalog,
      loading,
      loadError,
      reload,
      session,
      authReady,
      likes,
      favorites,
      toggleLike,
      toggleFavorite,
      requireAuth,
      loginOpen,
      setLoginOpen,
      contributeOpen,
      setContributeOpen,
      signOut,
      theme,
      toggleTheme,
      toast,
      profiles,
      myProfile,
      myDisplayName,
      saveMyProfile,
      isAdmin: admin.isAdmin,
      isSuper: admin.isSuper,
      adminCount: admin.adminCount,
      adminTodo,
      publicCharacters,
      publicWorks,
      pendingCharacters,
      mySubmissions,
      submissionReviews,
      claimAdminRole,
      adminSetHidden,
      adminSetAvatar,
      adminSetCover,
      adminEditText,
      adminReview,
      withdrawMine,
      myAdminApplication,
      applyAdminRole,
      adminApplications,
      adminMembers,
      adminDecideApplication,
      adminRevoke,
      reportedComments,
      reportComment,
      adminDismissReports,
      adminDeleteComment: adminRemoveComment,
      refreshReports,
    }),
    [
      catalog,
      loading,
      loadError,
      reload,
      session,
      authReady,
      likes,
      favorites,
      toggleLike,
      toggleFavorite,
      requireAuth,
      loginOpen,
      contributeOpen,
      signOut,
      theme,
      toggleTheme,
      toast,
      profiles,
      myProfile,
      myDisplayName,
      saveMyProfile,
      admin.isAdmin,
      admin.isSuper,
      admin.adminCount,
      adminTodo,
      publicCharacters,
      publicWorks,
      pendingCharacters,
      mySubmissions,
      submissionReviews,
      claimAdminRole,
      adminSetHidden,
      adminSetAvatar,
      adminSetCover,
      adminEditText,
      adminReview,
      withdrawMine,
      myAdminApplication,
      applyAdminRole,
      adminApplications,
      adminMembers,
      adminDecideApplication,
      adminRevoke,
      reportedComments,
      reportComment,
      adminDismissReports,
      adminRemoveComment,
      refreshReports,
    ],
  )

  return (
    <AppContext.Provider value={value}>
      {children}
      {toastMsg && (
        <div className="toast" role="status">
          {toastMsg}
        </div>
      )}
    </AppContext.Provider>
  )
}
