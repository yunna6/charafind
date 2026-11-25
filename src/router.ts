import { useEffect, useState } from 'react'

export type Route =
  | { name: 'home' }
  | { name: 'work'; id: number }
  | { name: 'character'; id: number }
  | { name: 'rank' }
  | { name: 'me' }
  | { name: 'admin' }

export function parseRoute(hash: string): Route {
  const clean = hash.replace(/^#\/?/, '')
  const parts = clean.split('/').filter(Boolean)
  if (parts[0] === 'work' && parts[1] && Number.isFinite(Number(parts[1]))) {
    return { name: 'work', id: Number(parts[1]) }
  }
  if (parts[0] === 'character' && parts[1] && Number.isFinite(Number(parts[1]))) {
    return { name: 'character', id: Number(parts[1]) }
  }
  if (parts[0] === 'rank') return { name: 'rank' }
  if (parts[0] === 'me') return { name: 'me' }
  if (parts[0] === 'admin') return { name: 'admin' }
  return { name: 'home' }
}

export function navigate(path: string): void {
  const next = path.startsWith('#') ? path : `#${path}`
  if (window.location.hash === next) return
  window.location.hash = next
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash))

  useEffect(() => {
    const onChange = () => {
      setRoute(parseRoute(window.location.hash))
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  return route
}

export function hrefFor(route: Route): string {
  switch (route.name) {
    case 'work':
      return `#/work/${route.id}`
    case 'character':
      return `#/character/${route.id}`
    case 'rank':
      return '#/rank'
    case 'me':
      return '#/me'
    case 'admin':
      return '#/admin'
    default:
      return '#/'
  }
}
