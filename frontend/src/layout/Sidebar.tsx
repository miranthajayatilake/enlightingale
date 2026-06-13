import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, type Muse } from '@/lib/api'
import { Spinner } from '@/design-system'

export function Sidebar() {
  const location = useLocation()
  const { data: muses = [], isLoading } = useQuery({
    queryKey: ['muses'],
    queryFn: () => api.get<Muse[]>('/muses'),
    staleTime: 30_000,
  })

  return (
    <aside className="w-[260px] h-full bg-sidebar flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/5">
        <Link to="/" className="flex items-center gap-2.5 no-underline">
          <span className="text-accent text-xl leading-none">✦</span>
          <span className="text-sidebar-text font-semibold text-[15px] tracking-tight">
            Enlightingale
          </span>
        </Link>
      </div>

      {/* Muse list */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {isLoading && (
          <div className="flex justify-center py-6">
            <Spinner size="sm" className="border-sidebar-muted border-t-sidebar-text" />
          </div>
        )}

        {!isLoading && muses.length === 0 && (
          <p className="text-sidebar-muted text-xs px-3 py-4 text-center leading-relaxed">
            Your muses will appear here once you create one.
          </p>
        )}

        {muses.map((muse) => {
          const active = location.pathname.startsWith(`/muse/${muse.id}`)
          return (
            <Link
              key={muse.id}
              to={`/muse/${muse.id}`}
              className={[
                'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm no-underline',
                'transition-colors duration-100',
                active
                  ? 'bg-sidebar-active text-sidebar-text'
                  : 'text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-text',
              ].join(' ')}
            >
              <span className="text-base leading-none">
                {muse.cover_emoji ?? '✦'}
              </span>
              <span className="truncate">{muse.name}</span>
              {muse.agent_status === 'running' && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent animate-pulse shrink-0" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* New Muse */}
      <div className="p-3 border-t border-white/5">
        <Link
          to="/muse/new"
          className="flex items-center justify-center gap-2 w-full py-2 px-4 rounded-md text-sm font-medium text-sidebar-muted hover:text-sidebar-text hover:bg-sidebar-hover transition-colors duration-100 no-underline"
        >
          <span className="text-base">＋</span>
          New Muse
        </Link>
      </div>
    </aside>
  )
}
