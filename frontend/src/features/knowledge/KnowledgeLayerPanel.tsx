import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type KnowledgeLayer } from '@/lib/api'
import { Badge, Button, Card, Spinner } from '@/design-system'

interface Props {
  museId: string
  resourceCount: number
}

export function KnowledgeLayerPanel({ museId, resourceCount }: Props) {
  const queryClient = useQueryClient()

  const { data: kl, isLoading } = useQuery<KnowledgeLayer | null>({
    queryKey: ['knowledge', museId],
    queryFn: () => api.get<KnowledgeLayer | null>(`/muses/${museId}/knowledge`),
    refetchInterval: (query) => {
      const data = query.state.data as KnowledgeLayer | null | undefined
      return data?.status === 'building' ? 3000 : false
    },
  })

  const build = useMutation({
    mutationFn: () => api.post(`/muses/${museId}/knowledge/build`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['knowledge', museId] }),
  })

  if (isLoading) return null

  const status = kl?.status ?? 'idle'

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-ink">Knowledge Layer</h2>
        {status === 'ready' && (
          <button
            onClick={() => build.mutate()}
            disabled={build.isPending}
            className="text-xs text-ink-muted hover:text-accent disabled:opacity-50 transition-colors"
          >
            {build.isPending ? 'Starting…' : 'Rebuild'}
          </button>
        )}
      </div>

      {/* Idle — CTA */}
      {status === 'idle' && (
        <div className="flex items-end justify-between gap-6">
          <p className="text-sm text-ink-secondary leading-relaxed max-w-sm">
            Enlightingale will read through your approved resources, extract key concepts,
            embed them for search, and synthesize the knowledge into a structured overview.
          </p>
          <Button
            onClick={() => build.mutate()}
            loading={build.isPending}
            disabled={resourceCount === 0}
            className="shrink-0"
          >
            Build Knowledge Layer
          </Button>
        </div>
      )}

      {/* Building */}
      {status === 'building' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Spinner size="md" />
            <p className="text-sm text-ink-secondary">Building knowledge layer…</p>
          </div>
          <div className="h-1.5 bg-border rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      )}

      {/* Failed */}
      {status === 'failed' && (
        <div className="flex items-end justify-between gap-6">
          <p className="text-sm text-error">
            Build failed.{' '}
            <span className="text-ink-muted">{kl?.error ?? 'Unknown error.'}</span>
          </p>
          <Button variant="secondary" onClick={() => build.mutate()} loading={build.isPending} className="shrink-0">
            Retry
          </Button>
        </div>
      )}

      {/* Ready */}
      {status === 'ready' && kl && (
        <KnowledgeLayerContent kl={kl} />
      )}
    </Card>
  )
}

function KnowledgeLayerContent({ kl }: { kl: KnowledgeLayer }) {
  const [glossaryOpen, setGlossaryOpen] = useState(false)

  return (
    <div className="space-y-6">
      {/* Synthesis */}
      {kl.synthesis && (
        <div>
          <p className="text-xs font-semibold text-accent uppercase tracking-wider mb-2">
            Synthesis
          </p>
          <p className="text-sm text-ink leading-relaxed">{kl.synthesis}</p>
        </div>
      )}

      {/* Glossary */}
      {kl.glossary.length > 0 && (
        <div>
          <button
            onClick={() => setGlossaryOpen((v) => !v)}
            className="flex items-center gap-2 text-xs font-semibold text-accent uppercase tracking-wider mb-2 hover:text-accent-hover transition-colors"
          >
            <span>Key Concepts</span>
            <span className="text-ink-muted font-normal normal-case tracking-normal">
              ({kl.glossary.length})
            </span>
            <span className="text-ink-muted">{glossaryOpen ? '▲' : '▼'}</span>
          </button>

          {/* Always show first 5 as chips */}
          <div className="flex flex-wrap gap-2 mb-2">
            {kl.glossary.slice(0, 5).map(({ term }) => (
              <span
                key={term}
                className="px-2.5 py-1 bg-accent-light text-accent text-xs rounded-full font-medium"
              >
                {term}
              </span>
            ))}
            {kl.glossary.length > 5 && !glossaryOpen && (
              <button
                onClick={() => setGlossaryOpen(true)}
                className="px-2.5 py-1 text-xs text-ink-muted hover:text-accent"
              >
                +{kl.glossary.length - 5} more
              </button>
            )}
          </div>

          {/* Expanded definitions */}
          {glossaryOpen && (
            <div className="mt-3 space-y-3 border-t border-border pt-3">
              {kl.glossary.map(({ term, definition }) => (
                <div key={term}>
                  <p className="text-sm font-medium text-ink">{term}</p>
                  <p className="text-sm text-ink-secondary leading-relaxed">{definition}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Gaps */}
      {kl.gaps.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-accent uppercase tracking-wider mb-2">
            Knowledge Gaps
          </p>
          <div className="flex flex-wrap gap-2">
            {kl.gaps.map((gap, i) => (
              <Badge key={i} variant="warning">{gap}</Badge>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-ink-muted">
        Built from {kl.resource_count} resource{kl.resource_count !== 1 ? 's' : ''}
        {kl.built_at && (
          <> · {new Date(kl.built_at).toLocaleDateString()}</>
        )}
      </p>
    </div>
  )
}
