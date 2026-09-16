// Cadence - Shared panel visibility state between the action button and transcript panel

let isPanelOpenState: boolean = false

export function isPanelOpen(): boolean {
  return isPanelOpenState
}

export function setPanelOpen(open: boolean): void {
  isPanelOpenState = open
  window.dispatchEvent(
    new CustomEvent('cadence-transcript-panel-toggle', {
      detail: { isOpen: open },
    })
  )
}

export function togglePanelOpen(): boolean {
  const next = !isPanelOpenState
  setPanelOpen(next)
  return next
}
