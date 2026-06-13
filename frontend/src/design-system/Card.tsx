import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
  elevated?: boolean
}

export function Card({ children, className = '', onClick, elevated = false }: CardProps) {
  const base = 'bg-surface border border-border rounded-lg'
  const shadow = elevated ? 'shadow-md' : 'shadow-sm'
  const interactive = onClick
    ? 'cursor-pointer hover:shadow-md hover:border-border-strong transition-all duration-150'
    : ''

  return (
    <div className={[base, shadow, interactive, className].join(' ')} onClick={onClick}>
      {children}
    </div>
  )
}
