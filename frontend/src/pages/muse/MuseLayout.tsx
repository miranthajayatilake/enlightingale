import { NavLink, Outlet, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, type Muse } from '@/lib/api'
import { Spinner } from '@/design-system'
import { MentorPane } from '@/features/voice/MentorPane'

const TABS = [
  { label: 'Overview',  path: '' },
  { label: 'Resources', path: 'resources' },
  { label: 'Lessons',   path: 'lessons' },
  { label: 'Chat',      path: 'chat' },
]

export function MuseLayout() {
  const { id } = useParams<{ id: string }>()
  const { data: muse, isLoading } = useQuery({
    queryKey: ['muse', id],
    queryFn: () => api.get<Muse>(`/muses/${id}`),
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!muse) {
    return (
      <div className="flex items-center justify-center h-full text-ink-muted">
        Muse not found.
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 pt-7 pb-0 border-b border-border bg-cream shrink-0">
        <div className="flex items-center gap-3 mb-5">
          <span className="text-3xl">{muse.cover_emoji ?? '✦'}</span>
          <div>
            <h1 className="text-xl font-semibold text-ink leading-tight">{muse.name}</h1>
            <p className="text-ink-muted text-sm mt-0.5 capitalize">{muse.knowledge_level} level</p>
          </div>
        </div>

        {/* Tabs */}
        <nav className="flex gap-1 -mb-px">
          {TABS.map(({ label, path }) => (
            <NavLink
              key={path}
              to={path}
              end={path === ''}
              className={({ isActive }) =>
                [
                  'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors duration-100 no-underline',
                  isActive
                    ? 'border-accent text-accent'
                    : 'border-transparent text-ink-muted hover:text-ink',
                ].join(' ')
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Tab content + Mentor pane */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div className="flex-1 min-h-0 overflow-hidden">
          <Outlet context={{ muse }} />
        </div>
        <MentorPane muse={muse} />
      </div>
    </div>
  )
}
