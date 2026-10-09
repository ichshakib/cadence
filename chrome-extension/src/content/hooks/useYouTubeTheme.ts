import { useState, useEffect } from 'react'

export type YouTubeTheme = 'light' | 'dark'

export function getYouTubeTheme(): YouTubeTheme {
  const html = document.documentElement

  // 1. Direct dark attribute check on <html> or <ytd-app>
  // Note: NEVER check 'darker-dark-theme' or 'darker-dark-theme-deprecate',
  // because YouTube includes those typography/experiment tokens in both light and dark modes!
  // YouTube uses the exact boolean attribute 'dark' (e.g. <html dark> or <ytd-app dark>)
  if (
    html.hasAttribute('dark') ||
    html.getAttribute('dark') === 'true' ||
    html.getAttribute('theme') === 'dark' ||
    Boolean(document.querySelector('ytd-app[dark]'))
  ) {
    return 'dark'
  }

  // 2. Computed text color check
  // In YouTube Light Theme: text color is near-black (#0f0f0f / rgb(15, 15, 15))
  // In YouTube Dark Theme: text color is near-white (#f1f1f1 / rgb(241, 241, 241))
  try {
    const targetEl = document.querySelector('ytd-app') || document.body || html
    const computed = window.getComputedStyle(targetEl)
    const textColor = computed.color
    const textMatch = textColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
    if (textMatch) {
      const r = parseInt(textMatch[1], 10)
      const g = parseInt(textMatch[2], 10)
      const b = parseInt(textMatch[3], 10)
      const textLum = 0.299 * r + 0.587 * g + 0.114 * b
      if (textLum > 170) {
        return 'dark'
      }
      if (textLum < 90) {
        return 'light'
      }
    }

    // 3. Computed background color fallback (only if opacity is solid)
    const bg = computed.backgroundColor
    const bgMatch = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
    if (bgMatch) {
      const alpha = bgMatch[4] !== undefined ? parseFloat(bgMatch[4]) : 1
      if (alpha > 0.5) {
        const br = parseInt(bgMatch[1], 10)
        const bg_val = parseInt(bgMatch[2], 10)
        const bb = parseInt(bgMatch[3], 10)
        const bgLum = 0.299 * br + 0.587 * bg_val + 0.114 * bb
        return bgLum < 128 ? 'dark' : 'light'
      }
    }
  } catch {
    // Ignore error
  }

  return 'light'
}

export function useYouTubeTheme(): YouTubeTheme {
  const [theme, setTheme] = useState<YouTubeTheme>(() => getYouTubeTheme())

  useEffect(() => {
    const updateTheme = () => {
      const current = getYouTubeTheme()
      setTheme(current)
    }

    // Initial check
    updateTheme()

    // 1. Observe attribute changes on <html>
    const observer = new MutationObserver(() => {
      updateTheme()
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [
        'dark',
        'darker-dark-theme',
        'darker-dark-theme-deprecate',
        'theme',
        'class',
        'style',
        'color-version',
      ],
    })

    // 2. Observe <ytd-app> once available
    const ytdApp = document.querySelector('ytd-app')
    if (ytdApp) {
      observer.observe(ytdApp, {
        attributes: true,
        attributeFilter: ['dark'],
      })
    }

    // 3. YouTube SPA navigation events
    window.addEventListener('yt-navigate-finish', updateTheme)
    window.addEventListener('yt-page-data-updated', updateTheme)
    window.addEventListener('popstate', updateTheme)

    const interval = window.setInterval(updateTheme, 1500)

    return () => {
      observer.disconnect()
      window.removeEventListener('yt-navigate-finish', updateTheme)
      window.removeEventListener('yt-page-data-updated', updateTheme)
      window.removeEventListener('popstate', updateTheme)
      clearInterval(interval)
    }
  }, [])

  return theme
}
