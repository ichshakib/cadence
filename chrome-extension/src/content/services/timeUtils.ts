// Cadence - Time & Video Control Utilities

/**
 * Format seconds into HH:MM:SS or MM:SS
 */
export function formatTimestamp(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const hrs = Math.floor(total / 3600)
  const mins = Math.floor((total % 3600) / 60)
  const secs = total % 60
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Parse string timestamp (e.g. "01:23:45", "04:12", "[00:15]") to seconds
 */
export function parseTimestampToSeconds(timeStr: string): number {
  if (!timeStr) return 0
  const clean = timeStr.trim().replace(/^\[|\]$/g, '').replace(',', '.')
  const parts = clean.split(':').map((p) => parseFloat(p) || 0)
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1]
  } else if (parts.length === 1) {
    return parts[0]
  }
  return 0
}

/**
 * Seek active HTML5 video element on the page to a timestamp
 */
export function seekVideo(seconds: number): void {
  const video = document.querySelector<HTMLVideoElement>('video')
  if (video) {
    video.currentTime = Math.max(0, seconds)
    if (video.paused) {
      video.play().catch(() => {})
    }
  }
}

/**
 * Extract the current YouTube video ID from window.location
 */
export function getCurrentVideoId(): string {
  try {
    const url = new URL(window.location.href)
    const v = url.searchParams.get('v')
    if (v) return v
    if (url.pathname.startsWith('/shorts/')) {
      const parts = url.pathname.split('/').filter(Boolean)
      return parts[1] || ''
    }
  } catch {
    // fallback
  }
  return ''
}
