import { Link } from 'react-router-dom'
import { Card, Badge } from '@/design-system'
import { relativeTime } from '@/lib/utils'
import type { Muse } from '@/lib/api'

const AGENT_BADGE: Record<string, { label: string; variant: 'accent' | 'success' | 'warning' | 'error' | 'default' }> = {
  running:  { label: 'Researching…', variant: 'accent' },
  complete: { label: 'Ready',        variant: 'success' },
  failed:   { label: 'Agent failed', variant: 'error' },
  idle:     { label: '',             variant: 'default' },
}

export function MuseCard({ muse }: { muse: Muse }) {
  const badge = AGENT_BADGE[muse.agent_status] ?? AGENT_BADGE.idle

  return (
    <Link to={`/muse/${muse.id}`} className="no-underline group">
      <Card
        className="p-5 h-full flex flex-col transition-all duration-150 group-hover:shadow-md group-hover:border-border-strong"
      >
        <div className="flex items-start justify-between mb-3">
          <span className="text-3xl">{muse.cover_emoji ?? '✦'}</span>
          <div className="flex items-center gap-2">
            {muse.agent_status === 'running' && (
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            )}
            {badge.label && (
              <Badge variant={badge.variant}>{badge.label}</Badge>
            )}
          </div>
        </div>

        <h2 className="font-semibold text-ink text-base mb-1.5 leading-snug">{muse.name}</h2>

        <p className="text-ink-muted text-sm leading-relaxed line-clamp-2 mb-auto">
          {muse.description}
        </p>

        <div className="flex items-center gap-3 text-xs text-ink-muted mt-4 pt-4 border-t border-border">
          <span className="capitalize">{muse.knowledge_level}</span>
          <span>·</span>
          <span>
            {muse.resource_count} resource{muse.resource_count !== 1 ? 's' : ''}
          </span>
          <span>·</span>
          <span className="ml-auto">{relativeTime(muse.updated_at)}</span>
        </div>
      </Card>
    </Link>
  )
}
