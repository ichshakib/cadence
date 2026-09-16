// Cadence - Content Script Main Entry Point
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './views/App.tsx'
import TranscriptActionButton from './views/TranscriptActionButton.tsx'
import type { TargetInsertion } from './types.ts'

const PANEL_CONTAINER_ID = 'yt-playlist-top-injected'
const ACTION_BTN_CONTAINER_ID = 'yt-transcript-action-btn-injected'

function getPanelInsertion(): TargetInsertion | null {
  // Only inject on watch pages or pages with a video player
  const isWatch = window.location.pathname.startsWith('/watch') || !!document.querySelector('video')
  if (!isWatch) return null

  // Priority 1: Right on top of the playlist panel renderer
  const playlistContainer = document.querySelector<HTMLElement>(
    'ytd-playlist-panel-renderer#playlist, #playlist.ytd-watch-flexy, #playlist.ytd-watch-grid, ytd-playlist-panel-renderer'
  )
  if (playlistContainer && playlistContainer.parentElement) {
    return {
      parent: playlistContainer.parentElement,
      before: playlistContainer,
    }
  }

  // Priority 2: At the top of #secondary-inner (right-hand column)
  const secondaryInner = document.querySelector<HTMLElement>(
    '#secondary #secondary-inner, #secondary-inner'
  )
  if (secondaryInner) {
    return {
      parent: secondaryInner,
      before: secondaryInner.firstElementChild as HTMLElement | null,
    }
  }

  // Priority 3: Above #related or recommendations
  const related = document.querySelector<HTMLElement>(
    '#related, ytd-watch-next-secondary-results-renderer'
  )
  if (related && related.parentElement) {
    return {
      parent: related.parentElement,
      before: related,
    }
  }

  // Priority 4: In general #secondary column
  const secondary = document.querySelector<HTMLElement>('#secondary')
  if (secondary) {
    return {
      parent: secondary,
      before: secondary.firstElementChild as HTMLElement | null,
    }
  }

  return null
}

function injectPanel(): boolean {
  const target = getPanelInsertion()
  if (!target) {
    return false
  }

  const existing = document.getElementById(PANEL_CONTAINER_ID)

  // If already mounted and in the correct spot
  if (existing) {
    if (existing.parentElement === target.parent && existing.nextElementSibling === target.before) {
      return true
    }
    // Reposition within target if moved during navigation
    target.parent.insertBefore(existing, target.before)
    return true
  }

  // Create new mounting container
  const container = document.createElement('div')
  container.id = PANEL_CONTAINER_ID
  target.parent.insertBefore(container, target.before)

  try {
    const root = createRoot(container)
    root.render(
      <StrictMode>
        <App width="100%" height="auto" />
      </StrictMode>
    )
    console.log('[Cadence] Injected Transcript panel successfully into target area!')
    return true
  } catch (err) {
    console.error('[Cadence] Panel injection error:', err)
    return false
  }
}

function getActionBtnInsertion(): TargetInsertion | null {
  const isWatch = window.location.pathname.startsWith('/watch') || !!document.querySelector('video')
  if (!isWatch) return null

  // Find YouTube's action button bar under the video
  const buttonsContainer = document.querySelector<HTMLElement>(
    '#top-level-buttons-computed, ytd-watch-metadata #top-level-buttons-computed, ytd-menu-renderer #top-level-buttons-computed, #menu.ytd-watch-metadata #top-level-buttons-computed, #actions-inner #menu ytd-menu-renderer'
  )
  if (!buttonsContainer) return null

  const children = Array.from(buttonsContainer.children) as HTMLElement[]

  // Priority 1: Search for the Share button explicitly
  const shareBtn = children.find((child) => {
    if (child.id === ACTION_BTN_CONTAINER_ID) return false
    const ariaLabel = (child.getAttribute('aria-label') || '').toLowerCase()
    const text = (child.textContent || '').toLowerCase()
    const hasShareIcon = !!child.querySelector('yt-icon[type="share"], ytd-share-target-renderer, button[aria-label*="share" i]')
    return ariaLabel.includes('share') || text.includes('share') || hasShareIcon
  })

  if (shareBtn) {
    return {
      parent: buttonsContainer,
      before: shareBtn,
    }
  }

  // Priority 2: Find the Like/Dislike button and place directly after it (before its next sibling)
  const likeDislikeBtn = children.find((child) => {
    if (child.id === ACTION_BTN_CONTAINER_ID) return false
    const tag = child.tagName.toLowerCase()
    return (
      tag.includes('segmented-like-dislike') ||
      tag.includes('like-button') ||
      !!child.querySelector('ytd-segmented-like-dislike-button-renderer, segmented-like-dislike-button-view-model, #segmented-like-button')
    )
  }) || (children[0]?.id === ACTION_BTN_CONTAINER_ID ? null : children[0])

  if (likeDislikeBtn) {
    const next = likeDislikeBtn.nextElementSibling as HTMLElement | null
    return {
      parent: buttonsContainer,
      before: next,
    }
  }

  // Priority 3: If multiple buttons exist, insert before index 1
  if (children.length > 1) {
    return {
      parent: buttonsContainer,
      before: children[1],
    }
  }

  return {
    parent: buttonsContainer,
    before: null,
  }
}

function injectActionButton(): boolean {
  const target = getActionBtnInsertion()
  if (!target) return false

  const existing = document.getElementById(ACTION_BTN_CONTAINER_ID)

  if (existing) {
    if (existing.parentElement === target.parent && existing.nextElementSibling === target.before) {
      return true
    }
    target.parent.insertBefore(existing, target.before)
    return true
  }

  const container = document.createElement('div')
  container.id = ACTION_BTN_CONTAINER_ID
  container.className = 'style-scope ytd-menu-renderer'
  target.parent.insertBefore(container, target.before)

  try {
    const root = createRoot(container)
    root.render(
      <StrictMode>
        <TranscriptActionButton />
      </StrictMode>
    )
    console.log('[Cadence] Injected Transcript Action Button between Like/Dislike and Share!')
    return true
  } catch (err) {
    console.error('[Cadence] Action Button injection error:', err)
    return false
  }
}

function injectAll() {
  injectPanel()
  injectActionButton()
}

function init() {
  injectAll()

  // YouTube SPA navigation events
  const scheduleReinjection = () => {
    injectAll()
    setTimeout(injectAll, 200)
    setTimeout(injectAll, 700)
    setTimeout(injectAll, 1500)
  }

  window.addEventListener('yt-navigate-finish', scheduleReinjection)
  window.addEventListener('yt-page-data-updated', () => setTimeout(injectAll, 300))
  window.addEventListener('popstate', () => setTimeout(injectAll, 200))

  // MutationObserver to ensure both elements stay attached when YouTube re-renders the DOM
  let debounceTimer: number | undefined
  const observer = new MutationObserver(() => {
    const existingPanel = document.getElementById(PANEL_CONTAINER_ID)
    const targetPanel = getPanelInsertion()
    const existingActionBtn = document.getElementById(ACTION_BTN_CONTAINER_ID)
    const targetActionBtn = getActionBtnInsertion()

    const panelNeedsUpdate = !existingPanel || (targetPanel && (existingPanel.parentElement !== targetPanel.parent || existingPanel.nextElementSibling !== targetPanel.before))
    const btnNeedsUpdate = !existingActionBtn || (targetActionBtn && (existingActionBtn.parentElement !== targetActionBtn.parent || existingActionBtn.nextElementSibling !== targetActionBtn.before))

    if (panelNeedsUpdate || btnNeedsUpdate) {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = window.setTimeout(() => {
        injectAll()
      }, 150)
    }
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
