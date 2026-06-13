import { useEffect, useRef } from 'react'

export function useWebSocket(
  url: string | null,
  onMessage: (data: unknown) => void,
) {
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  useEffect(() => {
    if (!url) return

    const ws = new WebSocket(url)

    ws.onmessage = (event) => {
      try {
        onMessageRef.current(JSON.parse(event.data))
      } catch {
        // ignore non-JSON frames (e.g. ping)
      }
    }

    ws.onerror = () => ws.close()

    return () => ws.close()
  }, [url])
}
