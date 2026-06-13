interface Props {
  message?: string
  progress?: number
}

/** Shimmer placeholders shaped like real Canvas sections — shown while building. */
export function CanvasSkeleton({ message = 'Composing your overview…', progress }: Props) {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* progress line */}
      <div className="mb-8">
        <p className="text-sm text-ink-secondary mb-2">{message}</p>
        <div className="h-1.5 bg-border rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-500"
            style={progress != null ? { width: `${progress}%` } : { width: '40%' }}
          />
        </div>
      </div>

      <div className="space-y-8 animate-pulse">
        {/* hero */}
        <div className="text-center space-y-3">
          <div className="h-12 w-12 rounded-full bg-cream-muted mx-auto" />
          <div className="h-7 w-2/3 bg-cream-muted rounded mx-auto" />
          <div className="h-4 w-1/2 bg-cream-muted rounded mx-auto" />
        </div>
        {/* prose block */}
        <div className="space-y-2.5">
          <div className="h-5 w-40 bg-cream-muted rounded" />
          <div className="h-3.5 w-full bg-cream-muted rounded" />
          <div className="h-3.5 w-full bg-cream-muted rounded" />
          <div className="h-3.5 w-4/5 bg-cream-muted rounded" />
        </div>
        {/* cluster block */}
        <div className="space-y-3">
          <div className="h-5 w-48 bg-cream-muted rounded" />
          <div className="h-48 w-full bg-cream-muted rounded-xl" />
        </div>
      </div>
    </div>
  )
}
