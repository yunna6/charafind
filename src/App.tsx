import { AppProvider, useApp } from './store'
import { useRoute } from './router'
import { HomePage } from './pages/HomePage'
import { WorkPage } from './pages/WorkPage'
import { CharacterPage } from './pages/CharacterPage'
import { RankPage } from './pages/RankPage'
import { MePage } from './pages/MePage'
import { AdminPage } from './pages/AdminPage'
import { LoginDialog } from './components/LoginDialog'
import { ContributeDialog } from './components/ContributeDialog'
import { FULL_SITE_URL, IS_DEMO } from './cloud'

function Shell() {
  const route = useRoute()
  const { theme, toggleTheme, session, authReady, setLoginOpen, setContributeOpen, isAdmin, adminTodo, myDisplayName } = useApp()

  const todoParts = [
    adminTodo.votes > 0 ? `待审投稿 ${adminTodo.votes}` : '',
    adminTodo.finals > 0 ? `待终审 ${adminTodo.finals}` : '',
    adminTodo.reports > 0 ? `举报 ${adminTodo.reports}` : '',
    adminTodo.applications > 0 ? `管理员申请 ${adminTodo.applications}` : '',
  ].filter(Boolean)
  const todoTitle = adminTodo.total > 0 ? `${adminTodo.total} 件待处理：${todoParts.join('、')}` : ''

  const navItems = [
    { href: '#/', label: '发现', active: route.name === 'home' || route.name === 'work' || route.name === 'character', badge: 0, badgeTitle: '' },
    { href: '#/rank', label: '排行榜', active: route.name === 'rank', badge: 0, badgeTitle: '' },
    { href: '#/me', label: '我的', active: route.name === 'me', badge: 0, badgeTitle: '' },
    ...(isAdmin
      ? [{ href: '#/admin', label: '管理', active: route.name === 'admin', badge: adminTodo.total, badgeTitle: todoTitle }]
      : []),
  ]

  const userName = myDisplayName || '我的'

  return (
    <div className="app-shell">
      <a
        href="#main"
        style={{
          position: 'absolute',
          left: -9999,
          top: 8,
          background: 'var(--accent)',
          color: 'var(--accent-ink)',
          padding: '8px 14px',
          borderRadius: 8,
          zIndex: 200,
        }}
        onFocus={(e) => {
          e.currentTarget.style.left = '12px'
        }}
        onBlur={(e) => {
          e.currentTarget.style.left = '-9999px'
        }}
      >
        跳到正文
      </a>

      {/* 静态演示版是只读快照，先把话说在前头，避免用户以为点赞/评论坏了 */}
      {IS_DEMO && (
        <div className="demo-banner" role="note">
          <span className="demo-banner-tag">静态演示版</span>
          <span className="demo-banner-text">数据为构建时的只读快照，点赞、评论、投稿请到完整版</span>
          <a className="demo-banner-link" href={FULL_SITE_URL}>
            前往完整版 →
          </a>
        </div>
      )}

      <header className="topbar">
        <div className="wrap topbar-inner">
          <a className="brand" href="#/" aria-label="角色图鉴 首页">
            <span className="brand-mark">角</span>
            <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.12 }}>
              <span className="brand-name">角色图鉴</span>
              <span className="brand-sub">Character Index</span>
            </span>
          </a>

          <nav className="nav" aria-label="主导航">
            {navItems.map((item) => (
              <a key={item.href} href={item.href} className={item.active ? 'nav-link active' : 'nav-link'}>
                {item.label}
                {item.badge > 0 && (
                  <span
                    className="nav-dot"
                    title={item.badgeTitle}
                    aria-label={item.badgeTitle}
                  >
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </a>
            ))}
          </nav>

          <div className="topbar-right">
            <button
              type="button"
              className="icon-btn"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? '切换到明亮主题' : '切换到暗色主题'}
              title={theme === 'dark' ? '切换到明亮主题' : '切换到暗色主题'}
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
            {IS_DEMO ? (
              <a className="btn btn-sm" href={FULL_SITE_URL} title="前往可登录的完整版">
                完整版
              </a>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setContributeOpen(true)}
                  title="补充角色或作品"
                >
                  ＋<span className="label">补充</span>
                </button>
                {authReady &&
                  (session ? (
                    <a className="btn btn-sm" href="#/me" title="我的书架">
                      {userName}
                    </a>
                  ) : (
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => setLoginOpen(true)}>
                      登录
                    </button>
                  ))}
              </>
            )}
          </div>
        </div>
      </header>

      <main id="main">
        {route.name === 'work' ? (
          <WorkPage id={route.id} />
        ) : route.name === 'character' ? (
          <CharacterPage id={route.id} />
        ) : route.name === 'rank' ? (
          <RankPage />
        ) : route.name === 'me' ? (
          <MePage />
        ) : route.name === 'admin' ? (
          <AdminPage />
        ) : (
          <HomePage />
        )}
      </main>

      <footer className="footer">
        <div className="wrap footer-inner">
          <span>角色图鉴 · 收录作品与角色的对应关系，欢迎补充</span>
          <span>作品与角色名归原作者所有，本站仅作索引与交流</span>
        </div>
      </footer>

      <LoginDialog />
      <ContributeDialog />
    </div>
  )
}

function SunIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
    </svg>
  )
}

export function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}
