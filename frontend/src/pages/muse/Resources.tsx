import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Muse, type Resource } from '@/lib/api'
import { Badge, Button, Card, Spinner } from '@/design-system'
import { AddResourceModal } from '@/features/resources/AddResourceModal'
import { relativeTime } from '@/lib/utils'

const TYPE_ICON: Record<string, string> = {
  url:   '🔗',
  pdf:   '📄',
  text:  '📝',
  agent: '🤖',
}

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'warning' | 'success' | 'error' }> = {
  pending:    { label: 'Queued',     variant: 'warning' },
  processing: { label: 'Processing', variant: 'warning' },
  ready:      { label: 'Ready',      variant: 'success' },
  failed:     { label: 'Failed',     variant: 'error' },
}

export function Resources() {
  const { muse } = useOutletContext<{ muse: Muse }>()
  const [showModal, setShowModal] = useState(false)
  const queryClient = useQueryClient()

  const { data: allResources = [], isLoading } = useQuery<Resource[]>({
    queryKey: ['resources', muse.id],
    queryFn: () => api.get<Resource[]>(`/muses/${muse.id}/resources`),
    refetchInterval: (query) => {
      const data = query.state.data as Resource[] | undefined
      const busy = data?.some((r) => r.status === 'pending' || r.status === 'processing')
      return busy ? 3000 : false
    },
  })

  const deleteResource = useMutation({
    mutationFn: (id: string) => api.delete(`/muses/${muse.id}/resources/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources', muse.id] })
      queryClient.invalidateQueries({ queryKey: ['muse', muse.id] })
      queryClient.invalidateQueries({ queryKey: ['muses'] })
    },
  })

  // Show user-added resources and approved agent resources
  const resources = allResources.filter((r) => r.origin === 'user' || r.approved)
  const processing = resources.filter((r) => r.status === 'pending' || r.status === 'processing')
  const ready = resources.filter((r) => r.status === 'ready')

  return (
    <div className="h-full overflow-y-auto">
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-ink">Resources</h2>
          {resources.length > 0 && (
            <p className="text-sm text-ink-muted mt-0.5">
              {ready.length} ready
              {processing.length > 0 && ` · ${processing.length} processing`}
            </p>
          )}
        </div>
        <Button onClick={() => setShowModal(true)}>+ Add Resource</Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && resources.length === 0 && (
        <div className="text-center py-20">
          <p className="text-4xl mb-4">📚</p>
          <h3 className="font-medium text-ink mb-2">No resources yet</h3>
          <p className="text-sm text-ink-muted max-w-xs mx-auto mb-6">
            Add URLs, PDFs, or notes to build the knowledge base for this Muse.
          </p>
          <Button onClick={() => setShowModal(true)}>Add your first resource</Button>
        </div>
      )}

      {/* Resource list */}
      {resources.length > 0 && (
        <div className="space-y-4">
          {resources.map((resource) => (
            <ResourceRow
              key={resource.id}
              resource={resource}
              onDelete={() => deleteResource.mutate(resource.id)}
              deleting={deleteResource.isPending}
            />
          ))}
        </div>
      )}

      <AddResourceModal
        museId={muse.id}
        open={showModal}
        onClose={() => setShowModal(false)}
      />
    </div>
    </div>
  )
}

function ResourceRow({
  resource,
  onDelete,
  deleting,
}: {
  resource: Resource
  onDelete: () => void
  deleting: boolean
}) {
  const isProcessing = resource.status === 'pending' || resource.status === 'processing'
  const badge = STATUS_BADGE[resource.status] ?? { label: resource.status, variant: 'default' as const }

  const hostname = resource.source_url
    ? (() => { try { return new URL(resource.source_url).hostname } catch { return null } })()
    : null

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span className="text-xl shrink-0 mt-0.5">{TYPE_ICON[resource.source_type] ?? '📄'}</span>

        <div className="flex-1 min-w-0">
          {/* Title + status */}
          <div className="flex items-start justify-between gap-3 mb-1">
            <div className="min-w-0">
              <p className="font-medium text-ink text-sm leading-snug">{resource.title}</p>
              {hostname && (
                <p className="text-xs text-ink-muted mt-0.5">{hostname}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isProcessing && <Spinner size="sm" />}
              <Badge variant={badge.variant}>{badge.label}</Badge>
            </div>
          </div>

          {/* Summary */}
          {resource.summary && (
            <p className="text-sm text-ink-secondary leading-relaxed mt-2">
              {resource.summary}
            </p>
          )}

          {/* Processing skeleton */}
          {isProcessing && !resource.summary && (
            <div className="mt-2 space-y-1.5">
              {[75, 95, 55].map((w, i) => (
                <div key={i} className="h-3 bg-border rounded animate-pulse" style={{ width: `${w}%` }} />
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border">
            <span className="text-xs text-ink-muted">{relativeTime(resource.created_at)}</span>
            {resource.source_url && (
              <a
                href={resource.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-ink-muted hover:text-accent"
              >
                Open source ↗
              </a>
            )}
            <button
              onClick={onDelete}
              disabled={deleting}
              className="ml-auto text-xs text-ink-muted hover:text-error disabled:opacity-50 transition-colors"
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    </Card>
  )
}
