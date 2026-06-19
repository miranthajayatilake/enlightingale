import type { ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { CanvasNode, CanvasTheme } from '@/lib/api'
import { cn } from '@/lib/utils'

/**
 * Renders the unstructured node-tree Canvas (v0.4.2) — a free-form composition of generic
 * presentation primitives (no topic-semantic sections, no hero/takeaways spine). Recursive,
 * tokens-only, responsive, and stamps `data-anchor={node.id}` on every node so the Mentor's
 * tour highlight and "Explain this" resolve against it. Unknown kinds fall back to text.
 */

const NODE_DENSITY_GAP: Record<string, string> = {
  airy: 'space-y-10',
  balanced: 'space-y-6',
  dense: 'space-y-4',
}
// Literal class strings so Tailwind v4 generates them (no runtime interpolation).
const COLS: Record<number, string> = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3' }

const HEADING_SIZE: Record<string, string> = {
  display: 'text-3xl sm:text-4xl font-semibold tracking-tight',
  xl: 'text-2xl font-semibold',
  lg: 'text-xl font-semibold',
  base: 'text-lg font-semibold',
}
const LEVEL_SIZE: Record<number, string> = {
  1: 'text-2xl font-semibold',
  2: 'text-xl font-semibold',
  3: 'text-lg font-semibold',
}

const CALLOUT_TONE: Record<string, { box: string; icon: string }> = {
  info: { box: 'bg-info/10 border-info/30', icon: 'ℹ️' },
  tip: { box: 'bg-accent-light border-accent/30', icon: '✦' },
  warning: { box: 'bg-warning/10 border-warning/30', icon: '⚠️' },
}

const MD_BLOCK = {
  p: ({ children }: { children?: ReactNode }) => <p className="leading-relaxed">{children}</p>,
  strong: ({ children }: { children?: ReactNode }) => <strong className="font-semibold text-ink">{children}</strong>,
  em: ({ children }: { children?: ReactNode }) => <em className="italic">{children}</em>,
  a: ({ children, href }: { children?: ReactNode; href?: string }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2">{children}</a>
  ),
}
const MD_INLINE = { ...MD_BLOCK, p: ({ children }: { children?: ReactNode }) => <>{children}</> }

function Md({ text, inline }: { text: string; inline?: boolean }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={inline ? MD_INLINE : MD_BLOCK}>
      {text}
    </ReactMarkdown>
  )
}

function Stack({ nodes, className }: { nodes: CanvasNode[]; className?: string }) {
  return <div className={cn('space-y-4', className)}>{nodes.map((n) => <Node key={n.id} node={n} />)}</div>
}

function Node({ node }: { node: CanvasNode }) {
  const id = node.id
  switch (node.kind) {
    case 'heading': {
      const level = Math.min(Math.max(node.level ?? 2, 1), 3)
      const Tag = `h${level}` as 'h1' | 'h2' | 'h3'
      const size = (node.style?.size && HEADING_SIZE[node.style.size]) || LEVEL_SIZE[level]
      return <Tag data-anchor={id} className={cn('text-ink leading-tight', size)}>{node.text}</Tag>
    }
    case 'text':
      return (
        <div data-anchor={id} className="text-ink-secondary leading-relaxed">
          <Md text={node.richtext ?? node.text ?? ''} />
        </div>
      )
    case 'list': {
      const Tag = node.ordered ? 'ol' : 'ul'
      return (
        <Tag data-anchor={id} className={cn('space-y-1.5 text-ink-secondary', node.ordered ? 'list-decimal pl-5' : 'list-disc pl-5')}>
          {(node.items ?? []).map((it, i) => <li key={i}><Md text={it} inline /></li>)}
        </Tag>
      )
    }
    case 'quote':
      return (
        <blockquote data-anchor={id} className="border-l-2 border-accent pl-5 text-lg italic text-ink leading-relaxed">
          {node.text}
          {node.cite && <footer className="mt-2 not-italic text-sm text-ink-muted">— {node.cite}</footer>}
        </blockquote>
      )
    case 'stat':
      return (
        <div data-anchor={id}>
          <p className="text-3xl font-semibold text-accent leading-none">{node.value}</p>
          {node.label && <p className="text-xs uppercase tracking-wide text-ink-muted mt-1.5">{node.label}</p>}
        </div>
      )
    case 'key_value':
      return (
        <dl data-anchor={id} className="rounded-lg border border-border divide-y divide-border overflow-hidden">
          {(node.pairs ?? []).map((p, i) => (
            <div key={i} className="flex justify-between gap-4 px-4 py-2.5">
              <dt className="text-sm font-medium text-ink">{p.key}</dt>
              <dd className="text-sm text-ink-secondary text-right">{p.value}</dd>
            </div>
          ))}
        </dl>
      )
    case 'callout': {
      const t = CALLOUT_TONE[node.tone ?? 'info'] ?? CALLOUT_TONE.info
      return (
        <div data-anchor={id} className={cn('flex gap-3 rounded-lg border px-4 py-3.5', t.box)}>
          <span className="text-base leading-none mt-0.5 shrink-0" aria-hidden>{t.icon}</span>
          <div className="text-sm text-ink leading-relaxed"><Md text={node.richtext ?? node.text ?? ''} inline /></div>
        </div>
      )
    }
    case 'figure':
      return (
        <figure data-anchor={id} className="text-center">
          {node.emoji && <div className="text-4xl leading-none">{node.emoji}</div>}
          {node.caption && <figcaption className="text-sm text-ink-muted mt-2">{node.caption}</figcaption>}
        </figure>
      )
    case 'divider':
      return <hr data-anchor={id} className="border-border" />
    case 'group':
      return <div data-anchor={id}><Stack nodes={node.children ?? []} /></div>
    case 'card':
      return (
        <div data-anchor={id} className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <Stack nodes={node.children ?? []} />
        </div>
      )
    case 'columns':
    case 'grid': {
      const cols = COLS[node.style?.cols === 3 ? 3 : 2]
      const gap = node.kind === 'grid' ? 'gap-4' : 'gap-6'
      return (
        <div data-anchor={id} className={cn('grid grid-cols-1 items-start', cols, gap)}>
          {(node.children ?? []).map((c) => <Node key={c.id} node={c} />)}
        </div>
      )
    }
    default:
      return <div data-anchor={id} className="text-ink-secondary leading-relaxed">{node.text ?? node.richtext ?? ''}</div>
  }
}

export function NodeRenderer({ nodes, theme }: { nodes: CanvasNode[]; theme?: CanvasTheme }) {
  const density = theme?.density ?? 'balanced'
  const accent = theme?.accent_treatment ?? 'wash'
  return (
    <div className={cn('canvas-nodes', NODE_DENSITY_GAP[density])} data-accent={accent}>
      {nodes.map((n) => <Node key={n.id} node={n} />)}
    </div>
  )
}
