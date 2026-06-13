import { useOutletContext } from 'react-router-dom'
import type { Muse } from '@/lib/api'
import { ChatPanel } from '@/features/chat/ChatPanel'

export function Chat() {
  const { muse } = useOutletContext<{ muse: Muse }>()
  return <ChatPanel muse={muse} />
}
