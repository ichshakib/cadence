// Cadence - Shared panel visibility state between the action button and transcript panel

const STORAGE_KEY = 'cadence_panel_open'

type InjectHandler = () => boolean
let panelInjectHandler: InjectHandler | null = null

export function registerPanelInjector(handler: InjectHandler): void {
  panelInjectHandler = handler
}

export function ensurePanelInjected(): boolean {
  if (panelInjectHandler) {
    try {
      return panelInjectHandler()
    } catch (err) {
      console.error('[Cadence] Failed to ensure panel injection:', err)
    }
  }
  return false
}

function getInitialPanelState(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

let isPanelOpenState: boolean = getInitialPanelState()

export function isPanelOpen(): boolean {
  return isPanelOpenState
}

export function setPanelOpen(open: boolean): void {
  isPanelOpenState = open
  try {
    sessionStorage.setItem(STORAGE_KEY, String(open))
  } catch {
    // ignore
  }

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

