type Variant = 'default' | 'accent' | 'success' | 'warning' | 'error' | 'info'

interface BadgeProps {
  children: React.ReactNode
  variant?: Variant
  className?: string
}

const variants: Record<Variant, string> = {
  default: 'bg-cream-muted text-ink-secondary',
  accent:  'bg-accent-light text-accent-text',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  error:   'bg-error/10 text-error',
  info:    'bg-info/10 text-info',
}

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center px-2 py-0.5 rounded-full overflow-hidden',
        'text-xs font-medium whitespace-nowrap',
        variants[variant],
        className,
      ].join(' ')}
    >
      {children}
    </span>
  )
}
