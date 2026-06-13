import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, type Muse } from '@/lib/api'
import { Button, Spinner } from '@/design-system'
import { MuseCard } from '@/features/muse/MuseCard'

export function Home() {
  const { data: muses = [], isLoading } = useQuery({
    queryKey: ['muses'],
    queryFn: () => api.get<Muse[]>('/muses'),
    refetchInterval: (query) => {
      // Keep polling while any muse has a running agent
      const data = query.state.data as Muse[] | undefined
      return data?.some((m) => m.agent_status === 'running') ? 8000 : false
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    )
  }

  if (muses.length === 0) return <EmptyHome />

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold text-ink">Your Muses</h1>
        <Link to="/muse/new">
          <Button>＋ New Muse</Button>
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {muses.map((muse) => (
          <MuseCard key={muse.id} muse={muse} />
        ))}
      </div>
    </div>
  )
}

function EmptyHome() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 py-16">
      <div className="text-5xl mb-6 text-accent">✦</div>
      <h1 className="text-3xl font-semibold text-ink mb-3 max-w-md leading-snug">
        What would you like to understand?
      </h1>
      <p className="text-ink-secondary text-lg max-w-sm mb-10 leading-relaxed">
        Create a Muse around any area of interest. Enlightingale will research it
        and teach it back to you through lessons and voice.
      </p>
      <Link to="/muse/new">
        <Button size="lg">Create your first Muse</Button>
      </Link>
    </div>
  )
}
