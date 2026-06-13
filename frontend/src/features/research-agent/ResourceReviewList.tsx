import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Resource } from '@/lib/api'
import { Button, Badge, Card, Spinner } from '@/design-system'

interface Props {
  museId: string
  coverageSummary?: string
  gaps?: string[]
}

export function ResourceReviewList({ museId, coverageSummary, gaps }: Props) {
  const queryClient = useQueryClient()

  const { data: resources = [], isLoading } = useQuery<Resource[]>({
    queryKey: ['agent-resources', museId],
    queryFn: () => api.get<Resource[]>(`/muses/${museId}/resources`),
    select: (r) => r.filter((x) => x.origin === 'research_agent'),
  })

  const approveOne = useMutation({
    mutationFn: (resourceId: string) =>
      api.patch(`/muses/${museId}/resources/${resourceId}`, { approved: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agent-resources', museId] }),
  })

  const removeOne = useMutation({
    mutationFn: (resourceId: string) =>
      api.delete(`/muses/${museId}/resources/${resourceId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-resources', museId] })
      queryClient.invalidateQueries({ queryKey: ['muses'] })
      queryClient.invalidateQueries({ queryKey: ['muse', museId] })
    },
  })

  const approveAll = useMutation({
    mutationFn: () => api.post(`/muses/${museId}/agent/approve-all`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-resources', museId] })
      queryClient.invalidateQueries({ queryKey: ['muse', museId] })
      queryClient.invalidateQueries({ queryKey: ['muses'] })
    },
  })

  const pending = resources.filter((r) => !r.approved)
  const approved = resources.filter((r) => r.approved)

  if (isLoading) return (
    <div className="flex justify-center py-10">
      <Spinner size="md" />
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Coverage report */}
      {coverageSummary && (
        <Card className="p-5 bg-accent-light border-accent/20">
          <p className="text-xs font-semibold text-accent uppercase tracking-wider mb-2">
            What the agent found
          </p>
          <p className="text-sm text-ink leading-relaxed">{coverageSummary}</p>
          {gaps && gaps.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-ink-muted mb-2 font-medium">Knowledge gaps:</p>
              <div className="flex flex-wrap gap-2">
                {gaps.map((g, i) => (
                  <Badge key={i} variant="warning">{g}</Badge>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Actions */}
      {pending.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-ink-secondary">
            <span className="font-semibold text-ink">{pending.length}</span> sources ready for review
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => approveAll.mutate()}
            loading={approveAll.isPending}
          >
            Approve all
          </Button>
        </div>
      )}

      {/* Pending resources */}
      {pending.map((r) => (
        <ResourceCard
          key={r.id}
          resource={r}
          onApprove={() => approveOne.mutate(r.id)}
          onRemove={() => removeOne.mutate(r.id)}
          approving={approveOne.isPending}
          removing={removeOne.isPending}
        />
      ))}

      {/* Approved section */}
      {approved.length > 0 && (
        <div className="pt-2 border-t border-border">
          <p className="text-xs text-ink-muted mb-3 font-medium uppercase tracking-wide">
            Approved ({approved.length})
          </p>
          <div className="space-y-3">
            {approved.map((r) => (
              <div key={r.id} className="flex items-start gap-3 py-2">
                <span className="text-success text-sm mt-0.5 shrink-0">✓</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{r.title}</p>
                  {r.source_url && (
                    <p className="text-xs text-ink-muted truncate">{r.source_url}</p>
                  )}
                </div>
                <button
                  onClick={() => removeOne.mutate(r.id)}
                  className="ml-auto text-ink-muted hover:text-error text-xs shrink-0"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {resources.length === 0 && (
        <p className="text-sm text-ink-muted text-center py-6">
          No resources found. You can re-run the Research Agent or add resources manually.
        </p>
      )}
    </div>
  )
}

function ResourceCard({
  resource,
  onApprove,
  onRemove,
  approving,
  removing,
}: {
  resource: Resource
  onApprove: () => void
  onRemove: () => void
  approving: boolean
  removing: boolean
}) {
  const hostname = resource.source_url
    ? (() => { try { return new URL(resource.source_url).hostname } catch { return resource.source_url } })()
    : null

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="font-medium text-ink text-sm leading-snug">{resource.title}</p>
        <Badge variant="accent" className="shrink-0">Agent</Badge>
      </div>

      {hostname && (
        <p className="text-xs text-ink-muted mb-2">{hostname}</p>
      )}

      {resource.summary && (
        <p className="text-sm text-ink-secondary leading-relaxed mb-4">
          {resource.summary}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={onApprove} loading={approving}>
          Keep
        </Button>
        <Button size="sm" variant="ghost" onClick={onRemove} loading={removing}>
          Remove
        </Button>
        {resource.source_url && (
          <a
            href={resource.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-xs text-ink-muted hover:text-accent self-center"
          >
            Preview ↗
          </a>
        )}
      </div>
    </Card>
  )
}
