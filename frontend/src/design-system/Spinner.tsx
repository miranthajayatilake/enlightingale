type Size = 'sm' | 'md' | 'lg'

const sizes: Record<Size, string> = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-[3px]',
}

export function Spinner({ size = 'md', className = '' }: { size?: Size; className?: string }) {
  return (
    <div
      className={[
        'rounded-full border-border border-t-accent animate-spin',
        sizes[size],
        className,
      ].join(' ')}
    />
  )
}
