// Cadence - Shared panel visibility state between the action button and transcript panel
// The panel starts closed by default and does not pop open automatically on page load.

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

// Panel/popover is closed by default
let isPanelOpenState = false

// Clear any stale persistent open flag from chrome.storage.local
if (typeof chrome !== 'undefined' && chrome.storage?.local) {
  chrome.storage.local.remove(STORAGE_KEY).catch(() => {})

  // Listen for explicit manual toggle requests from extension popup or background
  chrome.storage.onChanged.addListener((changes) => {
    if (typeof changes[STORAGE_KEY]?.newValue === 'boolean') {
      isPanelOpenState = changes[STORAGE_KEY].newValue
      window.dispatchEvent(
        new CustomEvent('cadence-transcript-panel-toggle', {
          detail: { isOpen: isPanelOpenState },
        })
      )
    }
  })
}

export function isPanelOpen(): boolean {
  return isPanelOpenState
}

export function setPanelOpen(open: boolean): void {
  isPanelOpenState = open
  try {
    sessionStorage.setItem(STORAGE_KEY, String(open))
  } catch {}

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
