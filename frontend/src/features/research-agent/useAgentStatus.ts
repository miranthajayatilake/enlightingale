import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type BackgroundJob } from '@/lib/api'
import { useWebSocket } from '@/hooks/useWebSocket'

export interface AgentEvent {
  type: string
  progress: number
  step?: string
  subtopics?: string[]
  subtopic?: string
  index?: number
  total?: number
  resource_count?: number
  coverage_summary?: string
  gaps?: string[]
  message?: string
}

function wsUrl(jobId: string) {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${window.location.host}/ws/jobs/${jobId}`
}

export function useAgentStatus(museId: string, agentStatus: string) {
  const queryClient = useQueryClient()
  const [latestEvent, setLatestEvent] = useState<AgentEvent | null>(null)
  const [subtopics, setSubtopics] = useState<string[]>([])
  const [searching, setSearching] = useState<string | null>(null)

  const isActive = agentStatus === 'running'

  const { data: job } = useQuery<BackgroundJob>({
    queryKey: ['agent-job', museId],
    queryFn: () => api.get<BackgroundJob>(`/muses/${museId}/agent/status`),
    enabled: isActive,
    refetchInterval: isActive ? 5000 : false,
    retry: false,
  })

  const jobId = job?.id ?? null

  useWebSocket(
    jobId ? wsUrl(jobId) : null,
    (raw) => {
      const event = raw as AgentEvent
      setLatestEvent(event)

      if (event.type === 'plan_ready' && event.subtopics) {
        setSubtopics(event.subtopics)
      }
      if (event.type === 'searching' && event.subtopic) {
        setSearching(event.subtopic)
      }
      if (event.type === 'complete') {
        setSearching(null)
        queryClient.invalidateQueries({ queryKey: ['muse', museId] })
        queryClient.invalidateQueries({ queryKey: ['muses'] })
        queryClient.invalidateQueries({ queryKey: ['agent-resources', museId] })
        queryClient.invalidateQueries({ queryKey: ['agent-job', museId] })
      }
      if (event.type === 'error') {
        queryClient.invalidateQueries({ queryKey: ['muse', museId] })
        queryClient.invalidateQueries({ queryKey: ['muses'] })
      }
    },
  )

  // Reset state when agent status changes to running
  useEffect(() => {
    if (agentStatus === 'running') {
      setLatestEvent(null)
      setSubtopics([])
      setSearching(null)
    }
  }, [agentStatus])

  return { job, latestEvent, subtopics, searching }
}
