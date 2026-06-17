import type { AnchorTarget } from './useAnchorTarget'

interface Props {
  target: AnchorTarget
  onExplain: (target: AnchorTarget) => void
  onDismiss: () => void
}

/**
 * Floating "Explain this" affordance that appears where the user clicked or selected on the
 * Canvas (PRD v0.4 §6.4). Choosing it asks the Mentor to explain that exact anchor. Fixed
 * positioning at the pointer; `data-explain-popup` keeps useAnchorTarget from re-triggering
 * when the popup itself is clicked.
 */
export function ExplainPopup({ target, onExplain, onDismiss }: Props) {
  return (
    <div
      data-explain-popup
      style={{ position: 'fixed', left: target.x, top: target.y + 10, zIndex: 50 }}
      className="-translate-x-1/2"
    >
      <button
        onClick={() => { onExplain(target); onDismiss() }}
        className="flex items-center gap-1.5 rounded-full bg-sidebar text-sidebar-text text-xs font-medium px-3 py-1.5 shadow-lg hover:bg-sidebar-hover transition-colors whitespace-nowrap"
      >
        <span aria-hidden>🎙</span>
        {target.selectedText ? 'Explain this part' : 'Explain this'}
      </button>
    </div>
  )
}
