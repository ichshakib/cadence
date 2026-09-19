// Cadence - Content Script Main Entry Point
import { StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import App from './views/App.tsx'
import TranscriptActionButton from './views/TranscriptActionButton.tsx'
import VideoOverlay from './views/VideoOverlay.tsx'
import type { TargetInsertion } from './types.ts'
import { registerPanelInjector } from './panelState.ts'

const PANEL_CONTAINER_ID = 'yt-playlist-top-injected'
const ACTION_BTN_CONTAINER_ID = 'yt-transcript-action-btn-injected'
const VIDEO_OVERLAY_CONTAINER_ID = 'cadence-video-overlay-container'

let panelRoot: Root | null = null
let overlayRoot: Root | null = null

function isElementVisible(el: HTMLElement | null): boolean {
  if (!el) return false
  if (el.hasAttribute('hidden')) return false
  if (el.getAttribute('aria-hidden') === 'true') return false
  if (el.style.display === 'none') return false
  try {
    const style = window.getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden') return false
  } catch {
    // ignore
  }
  return el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0
}

function getFirstValidContentChild(parent: HTMLElement): HTMLElement | null {
  for (const child of Array.from(parent.children) as HTMLElement[]) {
    if (child.id === PANEL_CONTAINER_ID) continue
    // If YouTube's collapsible panels container is currently hidden, don't insert inside it or target it
    if (child.id === 'panels' && !isElementVisible(child)) continue
    return child
  }
  return null
}

function isWatchPage(): boolean {
  return window.location.pathname.startsWith('/watch')
}

function getPanelInsertion(): TargetInsertion | null {
  // Strictly inject only on YouTube watch pages
  if (!isWatchPage()) return null

  // Check if we are inside a genuinely visible playlist
  const isPlaylistUrl = window.location.search.includes('list=')
  const playlistContainer = document.querySelector<HTMLElement>(
    'ytd-playlist-panel-renderer#playlist, #playlist.ytd-watch-flexy, #playlist.ytd-watch-grid, ytd-playlist-panel-renderer'
  )

  // Priority 1: If an active playlist is genuinely visible and URL has list=
  if (
    isPlaylistUrl &&
    playlistContainer &&
    isElementVisible(playlistContainer) &&
    playlistContainer.parentElement &&
    isElementVisible(playlistContainer.parentElement)
  ) {
    return {
      parent: playlistContainer.parentElement,
      before: playlistContainer,
    }
  }

  // Priority 2: Primary target on all standard YouTube watch pages - visible right-hand column (#secondary-inner)
  const secondaryInner = document.querySelector<HTMLElement>(
    '#secondary #secondary-inner, #secondary-inner'
  )
  if (secondaryInner && isElementVisible(secondaryInner)) {
    return {
      parent: secondaryInner,
      before: getFirstValidContentChild(secondaryInner),
    }
  }

  // Priority 3: Above #related recommendations if visible
  const related = document.querySelector<HTMLElement>(
    '#related, ytd-watch-next-secondary-results-renderer'
  )
  if (related && related.parentElement && isElementVisible(related.parentElement)) {
    return {
      parent: related.parentElement,
      before: related,
    }
  }

  // Priority 4: In general #secondary column if visible
  const secondary = document.querySelector<HTMLElement>('#secondary')
  if (secondary && isElementVisible(secondary)) {
    return {
      parent: secondary,
      before: getFirstValidContentChild(secondary),
    }
  }

  // Priority 5: Responsive / Narrow screen / Theater mode fallback
  // When screen width is < 1000px or #secondary is hidden, YouTube stacks content under the video in #primary
  const below = document.querySelector<HTMLElement>('#primary #below, #below')
  if (below && isElementVisible(below)) {
    const comments = below.querySelector<HTMLElement>('#comments, ytd-comments')
    if (comments) {
      return {
        parent: below,
        before: comments,
      }
    }
    return {
      parent: below,
      before: getFirstValidContentChild(below),
    }
  }

  // Priority 6: Fallback to #primary
  const primary = document.querySelector<HTMLElement>('#primary, #primary-inner')
  if (primary && isElementVisible(primary)) {
    return {
      parent: primary,
      before: primary.lastElementChild as HTMLElement | null,
    }
  }

  return null
}

export function injectPanel(): boolean {
  const target = getPanelInsertion()
  if (!target) {
    return false
  }

  const existing = document.getElementById(PANEL_CONTAINER_ID)

  // If already mounted
  if (existing) {
    const isParentVisible = isElementVisible(existing.parentElement)
    if (isParentVisible && existing.parentElement === target.parent && existing.nextElementSibling === target.before) {
      return true
    }
    // Reposition within target if moved or parent was hidden
    try {
      target.parent.insertBefore(existing, target.before)
      return true
    } catch (err) {
      console.warn('[Cadence] Repositioning panel failed, remounting:', err)
      existing.remove()
      panelRoot = null
    }
  }

  // Create new mounting container
  const container = document.createElement('div')
  container.id = PANEL_CONTAINER_ID
  target.parent.insertBefore(container, target.before)

  try {
    panelRoot = createRoot(container)
    panelRoot.render(
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
  if (!isWatchPage()) return null

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

function getPlayerElement(): HTMLElement | null {
  return (
    document.getElementById('movie_player') ||
    document.querySelector<HTMLElement>('.html5-video-player') ||
    document.querySelector<HTMLElement>('ytd-player') ||
    document.querySelector<HTMLElement>('.video-stream.html5-main-video')?.parentElement ||
    null
  )
}

function injectVideoOverlay(): boolean {
  if (!isWatchPage()) return false

  const player = getPlayerElement()
  if (!player) return false

  let existing = document.getElementById(VIDEO_OVERLAY_CONTAINER_ID)
  if (existing && existing.parentElement === player) {
    return true
  }

  if (existing && existing.parentElement !== player) {
    existing.remove()
    existing = null
    overlayRoot = null
  }

  const container = document.createElement('div')
  container.id = VIDEO_OVERLAY_CONTAINER_ID
  player.appendChild(container)

  try {
    overlayRoot = createRoot(container)
    overlayRoot.render(
      <StrictMode>
        <VideoOverlay />
      </StrictMode>
    )
    console.log('[Cadence] Injected Video Overlay container into YouTube player successfully!')
    return true
  } catch (err) {
    console.error('[Cadence] Video overlay injection error:', err)
    return false
  }
}

function cleanupInjected() {
  if (panelRoot) {
    try {
      panelRoot.unmount()
    } catch {}
    panelRoot = null
  }
  const existingPanel = document.getElementById(PANEL_CONTAINER_ID)
  if (existingPanel) {
    existingPanel.remove()
  }

  const existingActionBtn = document.getElementById(ACTION_BTN_CONTAINER_ID)
  if (existingActionBtn) {
    existingActionBtn.remove()
  }

  if (overlayRoot) {
    try {
      overlayRoot.unmount()
    } catch {}
    overlayRoot = null
  }
  const existingOverlay = document.getElementById(VIDEO_OVERLAY_CONTAINER_ID)
  if (existingOverlay) {
    existingOverlay.remove()
  }
}

function injectAll() {
  if (!isWatchPage()) {
    cleanupInjected()
    return
  }
  injectPanel()
  injectActionButton()
  injectVideoOverlay()
}

function init() {
  registerPanelInjector(injectPanel)
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

  // MutationObserver to ensure elements stay attached only on watch pages
  let debounceTimer: number | undefined
  const observer = new MutationObserver(() => {
    if (!isWatchPage()) {
      cleanupInjected()
      return
    }

    const existingPanel = document.getElementById(PANEL_CONTAINER_ID)
    const targetPanel = getPanelInsertion()
    const existingActionBtn = document.getElementById(ACTION_BTN_CONTAINER_ID)
    const targetActionBtn = getActionBtnInsertion()

    const isPanelParentVisible = existingPanel ? isElementVisible(existingPanel.parentElement) : false
    const panelNeedsUpdate =
      !existingPanel ||
      !isPanelParentVisible ||
      (targetPanel &&
        (existingPanel.parentElement !== targetPanel.parent ||
          existingPanel.nextElementSibling !== targetPanel.before))

    const isBtnParentVisible = existingActionBtn ? isElementVisible(existingActionBtn.parentElement) : false
    const btnNeedsUpdate =
      !existingActionBtn ||
      !isBtnParentVisible ||
      (targetActionBtn &&
        (existingActionBtn.parentElement !== targetActionBtn.parent ||
          existingActionBtn.nextElementSibling !== targetActionBtn.before))

    const existingOverlay = document.getElementById(VIDEO_OVERLAY_CONTAINER_ID)
    const playerEl = getPlayerElement()
    const overlayNeedsUpdate = !existingOverlay || (playerEl && existingOverlay.parentElement !== playerEl)

    if (panelNeedsUpdate || btnNeedsUpdate || overlayNeedsUpdate) {
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
