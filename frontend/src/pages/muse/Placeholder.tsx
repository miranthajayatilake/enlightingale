/** Temporary placeholder used by tabs that aren't built yet. */
export function Placeholder({ name }: { name: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-20 px-8">
      <div className="text-4xl mb-4 text-border">◌</div>
      <h2 className="text-lg font-medium text-ink mb-2">{name}</h2>
      <p className="text-ink-muted text-sm max-w-xs">
        This section is being built. Check back soon.
      </p>
    </div>
  )
}
