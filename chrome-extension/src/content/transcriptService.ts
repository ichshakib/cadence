// Cadence - Transcript & Translation Service
import type { TranscriptSegment, TranscriptData, CaptionTrackOption } from './types.ts'

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

export function seekVideo(seconds: number): void {
  const video = document.querySelector<HTMLVideoElement>('video')
  if (video) {
    video.currentTime = Math.max(0, seconds)
    if (video.paused) {
      video.play().catch(() => {})
    }
  }
}

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

const STORAGE_PREFIX = 'cadence_yt_transcript_'

export function saveTranscript(videoId: string, data: TranscriptData): void {
  try {
    const key = videoId ? `${STORAGE_PREFIX}${videoId}` : `${STORAGE_PREFIX}global`
    localStorage.setItem(key, JSON.stringify(data))
  } catch (err) {
    console.warn('[Cadence] Failed to save transcript to localStorage', err)
  }
}

export function sanitizeSegmentText(text: string): string {
  if (!text) return ''
  return text
    .replace(/<[^>]+>/g, '') // remove html tags (like <c>, <b>)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    // Strip leading accessibility timestamp words (e.g. "2 seconds", "13 seconds", "1 minute 5 seconds")
    .replace(/^\s*(?:\d+\s*(?:hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)[,\s]*)+\s*/i, '')
    // Strip leading numerical timestamps like "0:02", "[0:02]", "0:02 - "
    .replace(/^\s*\[?(?:\d{1,2}:)?\d{1,2}:\d{2}\]?\s*[-:—]?\s*/, '')
    .trim()
}

export function loadStoredTranscript(videoId: string): TranscriptData | null {
  try {
    const key = videoId ? `${STORAGE_PREFIX}${videoId}` : `${STORAGE_PREFIX}global`
    const stored = localStorage.getItem(key)
    if (stored) {
      const data = JSON.parse(stored) as TranscriptData
      if (Array.isArray(data.segments)) {
        data.segments = data.segments.map((seg) => ({
          ...seg,
          text: sanitizeSegmentText(seg.text),
        }))
      }
      return data
    }
  } catch (err) {
    console.warn('[Cadence] Failed to load stored transcript', err)
  }
  return null
}

export function clearStoredTranscript(videoId: string): void {
  try {
    const key = videoId ? `${STORAGE_PREFIX}${videoId}` : `${STORAGE_PREFIX}global`
    localStorage.removeItem(key)
  } catch (err) {
    console.warn('[Cadence] Failed to remove stored transcript', err)
  }
}

// -------------------------------------------------------------
// Parsers for Multiple Transcript Formats
// -------------------------------------------------------------

function cleanText(text: string): string {
  return text
    .replace(/<[^>]+>/g, '') // remove html tags (like <c>, <b>)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Try parsing JSON format
 */
function tryParseJson(raw: string, fileName?: string): TranscriptData | null {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return null
  }

  try {
    const parsed = JSON.parse(trimmed)
    let rawItems: any[] = []

    if (Array.isArray(parsed)) {
      rawItems = parsed
    } else if (Array.isArray(parsed.segments)) {
      rawItems = parsed.segments
    } else if (Array.isArray(parsed.transcript)) {
      rawItems = parsed.transcript
    } else if (Array.isArray(parsed.events)) {
      // YouTube player response timedtext format
      rawItems = parsed.events.map((e: any) => ({
        start: (e.tStartMs || 0) / 1000,
        dur: (e.dDurationMs || 0) / 1000,
        text: (e.segs || []).map((s: any) => s.utf8 || '').join(''),
      }))
    }

    if (rawItems.length > 0) {
      const segments: TranscriptSegment[] = []
      for (const item of rawItems) {
        const text = cleanText(item.text || item.content || item.sentence || '')
        if (!text) continue
        const start = typeof item.start === 'number'
          ? item.start
          : typeof item.startTime === 'number'
          ? item.startTime
          : typeof item.timestamp === 'string'
          ? parseTimestampToSeconds(item.timestamp)
          : 0
        const dur = typeof item.dur === 'number' ? item.dur : (typeof item.duration === 'number' ? item.duration : 4)

        segments.push({
          start,
          dur,
          formattedTime: formatTimestamp(start),
          text,
        })
      }

      if (segments.length > 0) {
        return {
          title: parsed.title || fileName || 'Uploaded Transcript',
          segments,
          rawText: raw,
          fileName,
        }
      }
    }
  } catch {
    // Not valid JSON
  }

  return null
}

/**
 * Parse SRT / WebVTT subtitle format
 */
function tryParseSubtitle(raw: string, fileName?: string): TranscriptData | null {
  const cueTimeRegex = /((?:\d{1,2}:)?\d{1,2}:\d{2}[,.]\d{2,3})\s*-->\s*((?:\d{1,2}:)?\d{1,2}:\d{2}[,.]\d{2,3})/

  if (!cueTimeRegex.test(raw)) {
    return null
  }

  const lines = raw.split(/\r?\n/)
  const segments: TranscriptSegment[] = []
  let currentStart: number | null = null
  let currentEnd: number | null = null
  let currentTextLines: string[] = []

  const commitCue = () => {
    if (currentStart !== null && currentTextLines.length > 0) {
      const text = cleanText(currentTextLines.join(' '))
      if (text) {
        const dur = currentEnd !== null ? Math.max(1, currentEnd - currentStart) : 4
        segments.push({
          start: currentStart,
          dur,
          formattedTime: formatTimestamp(currentStart),
          text,
        })
      }
    }
    currentStart = null
    currentEnd = null
    currentTextLines = []
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed === 'WEBVTT' || /^\d+$/.test(trimmed)) {
      if (!trimmed) {
        commitCue()
      }
      continue
    }

    const match = trimmed.match(cueTimeRegex)
    if (match) {
      commitCue()
      currentStart = parseTimestampToSeconds(match[1])
      currentEnd = parseTimestampToSeconds(match[2])
    } else if (currentStart !== null) {
      currentTextLines.push(trimmed)
    }
  }
  commitCue()

  if (segments.length > 0) {
    return {
      title: fileName || 'Subtitle Transcript',
      segments,
      rawText: raw,
      fileName,
    }
  }

  return null
}

/**
 * Parse YouTube / Timestamped text lines:
 * Handles:
 * 1) [00:15] Text here
 * 2) 00:15 - Text here
 * 3) YouTube copy-paste alternating lines:
 *    00:15
 *    Text here
 * 4) Freeform text with inline timestamps [00:15]
 */
function parseTimestampedLines(raw: string, fileName?: string): TranscriptData {
  const lines = raw.split(/\r?\n/)
  const segments: TranscriptSegment[] = []

  const standaloneTsRegex = /^\s*\[?((?:\d{1,2}:)?\d{1,2}:\d{2})\]?\s*$/
  let isAlternatingYouTubeFormat = false

  let tsCount = 0
  for (let j = 0; j < Math.min(lines.length, 10); j++) {
    if (standaloneTsRegex.test(lines[j])) tsCount++
  }
  if (tsCount >= 2) {
    isAlternatingYouTubeFormat = true
  }

  if (isAlternatingYouTubeFormat) {
    let pendingStart: number | null = null
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      const tsMatch = trimmed.match(standaloneTsRegex)
      if (tsMatch) {
        pendingStart = parseTimestampToSeconds(tsMatch[1])
      } else if (pendingStart !== null) {
        const text = cleanText(trimmed)
        if (text) {
          segments.push({
            start: pendingStart,
            dur: 4,
            formattedTime: formatTimestamp(pendingStart),
            text,
          })
        }
        pendingStart = null
      }
    }

    if (segments.length > 0) {
      for (let s = 0; s < segments.length - 1; s++) {
        segments[s].dur = Math.max(1, segments[s + 1].start - segments[s].start)
      }
      return {
        title: fileName || 'Transcript',
        segments,
        rawText: raw,
        fileName,
      }
    }
  }

  // Case B: Inline timestamp matching (e.g. `[00:15] text` or `00:15 text`)
  const inlineTsRegex = /^\s*\[?((?:\d{1,2}:)?\d{1,2}:\d{2})\]?\s*[-:—]?\s*(.+)$/

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const match = trimmed.match(inlineTsRegex)
    if (match) {
      const start = parseTimestampToSeconds(match[1])
      const text = cleanText(match[2])
      if (text) {
        segments.push({
          start,
          dur: 4,
          formattedTime: formatTimestamp(start),
          text,
        })
      }
    }
  }

  if (segments.length > 0) {
    for (let s = 0; s < segments.length - 1; s++) {
      segments[s].dur = Math.max(1, segments[s + 1].start - segments[s].start)
    }
    return {
      title: fileName || 'Transcript',
      segments,
      rawText: raw,
      fileName,
    }
  }

  // Case C: Embedded timestamps like [00:12]
  const pattern = /\[(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\]/g
  const matches = [...raw.matchAll(pattern)]
  if (matches.length > 0) {
    for (let m = 0; m < matches.length; m++) {
      const current = matches[m]
      const next = matches[m + 1]
      const startIndex = current.index + current[0].length
      const endIndex = next ? next.index : raw.length
      const text = cleanText(raw.substring(startIndex, endIndex))

      const hrs = current[1] ? parseInt(current[1], 10) : 0
      const mins = parseInt(current[2], 10)
      const secs = parseInt(current[3], 10)
      const totalSecs = hrs * 3600 + mins * 60 + secs

      const nextHrs = next && next[1] ? parseInt(next[1], 10) : 0
      const nextMins = next ? parseInt(next[2], 10) : 0
      const nextSecs = next ? parseInt(next[3], 10) : 0
      const nextTotalSecs = next ? nextHrs * 3600 + nextMins * 60 + nextSecs : totalSecs + 5
      const dur = Math.max(1, nextTotalSecs - totalSecs)

      if (text) {
        segments.push({
          start: totalSecs,
          dur,
          formattedTime: formatTimestamp(totalSecs),
          text,
        })
      }
    }

    if (segments.length > 0) {
      return {
        title: fileName || 'Transcript',
        segments,
        rawText: raw,
        fileName,
      }
    }
  }

  // Case D: Plain text fallback
  const nonEmpties = lines.map((l) => cleanText(l)).filter(Boolean)
  let currentTime = 0
  for (const paragraph of nonEmpties) {
    segments.push({
      start: currentTime,
      dur: 5,
      formattedTime: formatTimestamp(currentTime),
      text: paragraph,
    })
    currentTime += 5
  }

  return {
    title: fileName || 'Pasted Transcript',
    segments,
    rawText: raw,
    fileName,
  }
}

/**
 * Universal parser for uploaded or pasted transcript text
 */
export function parseTranscriptContent(rawText: string, fileName?: string): TranscriptData {
  if (!rawText || !rawText.trim()) {
    return {
      title: fileName || 'Empty Transcript',
      segments: [],
      rawText: '',
      fileName,
    }
  }

  // 1. JSON
  const jsonResult = tryParseJson(rawText, fileName)
  if (jsonResult && jsonResult.segments.length > 0) {
    return jsonResult
  }

  // 2. SRT or WebVTT
  const subResult = tryParseSubtitle(rawText, fileName)
  if (subResult && subResult.segments.length > 0) {
    return subResult
  }

  // 3. YouTube copy-paste / bracketed timestamps / plain lines
  return parseTimestampedLines(rawText, fileName)
}


export function closeNativeTranscriptPanel(): void {
  // Safe no-op: Cadence NEVER interferes with or closes panels opened by the user
}

function findNativeSegmentElements(): HTMLElement[] {
  // 1. Try modern 2026 YouTube transcript view-model
  const modern = Array.from(
    document.querySelectorAll<HTMLElement>(
      'transcript-segment-view-model, .ytwTranscriptSegmentViewModelHost, [class*="TranscriptSegmentViewModelHost"]'
    )
  )
  if (modern.length > 0) return modern

  // 2. Try legacy ytd-transcript-segment-renderer
  const legacy = Array.from(
    document.querySelectorAll<HTMLElement>('ytd-transcript-segment-renderer')
  )
  if (legacy.length > 0) return legacy

  // 3. Try finding inside engagement panel
  const panel = document.querySelector<HTMLElement>(
    'ytd-engagement-panel-section-list-renderer[target-id*="transcript"], ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]'
  )
  if (panel) {
    const inPanel = Array.from(
      panel.querySelectorAll<HTMLElement>(
        'transcript-segment-view-model, ytd-transcript-segment-renderer, [class*="segment"]'
      )
    ).filter((el) => /\b(?:\d{1,2}:)?\d{1,2}:\d{2}\b/.test(el.textContent || ''))
    if (inPanel.length > 0) return inPanel
  }

  return []
}

function extractSegmentData(el: HTMLElement): { start: number; text: string } | null {
  // Look for dedicated timestamp element
  const tsEl = el.querySelector<HTMLElement>(
    '.ytwTranscriptSegmentViewModelTimestamp, [class*="ViewModelTimestamp"], .segment-timestamp, [class*="timestamp"]'
  )
  const timeStr = tsEl?.textContent?.trim() || ''

  let start = 0
  let matchedTs = ''
  if (timeStr) {
    start = parseTimestampToSeconds(timeStr)
    matchedTs = timeStr
  } else {
    const rawContent = el.textContent || ''
    const match = rawContent.match(/\b(?:\d{1,2}:)?\d{1,2}:\d{2}\b/)
    if (match) {
      start = parseTimestampToSeconds(match[0])
      matchedTs = match[0]
    } else {
      return null
    }
  }

  // Extract clean subtitle text
  let rawExtractedText = ''

  // Priority A: Search for the dedicated text container
  const textContainer = el.querySelector<HTMLElement>(
    '[class*="SegmentViewModelText"], [class*="ViewModelText"], [class*="segment-text"], .segment-text, [class*="transcript-segment-text"]'
  )
  if (textContainer && textContainer.textContent?.trim()) {
    rawExtractedText = textContainer.textContent
  }

  // Priority B: Clone the segment element and strip all timestamp and accessibility nodes
  if (!rawExtractedText) {
    try {
      const clone = el.cloneNode(true) as HTMLElement
      const nodesToRemove = clone.querySelectorAll(
        '.ytwTranscriptSegmentViewModelTimestamp, [class*="Timestamp" i], [class*="timestamp" i], ' +
        '[class*="accessibility" i], [class*="Accessibility"], .segment-timestamp, ' +
        'button, [role="button"], [aria-hidden="true"]'
      )
      nodesToRemove.forEach((n) => n.remove())
      rawExtractedText = clone.textContent || ''
    } catch {
      // fallback
    }
  }

  // Priority C: Structure-agnostic fallback
  if (!rawExtractedText) {
    const fullText = (el.innerText || el.textContent || '').trim()
    rawExtractedText = fullText.replace(matchedTs, '').trim()
  }

  // Clean and strip any leading accessibility words like "2 seconds", "13 seconds", "16 seconds"
  const text = sanitizeSegmentText(rawExtractedText)
  if (!text) return null

  return { start, text }
}

/**
 * Extract transcript from YouTube's native panel ONLY if the user has ALREADY opened it.
 * Cadence NEVER simulates button clicks and NEVER causes YouTube's native panel to open.
 */
export async function extractFromNativeTranscript(): Promise<TranscriptSegment[] | null> {
  const segmentEls = findNativeSegmentElements()
  if (segmentEls.length === 0) {
    return null
  }

  const segments: TranscriptSegment[] = []
  for (const el of segmentEls) {
    const data = extractSegmentData(el)
    if (!data || !data.text) continue

    segments.push({
      start: data.start,
      dur: 4,
      formattedTime: formatTimestamp(data.start),
      text: data.text,
    })
  }

  if (segments.length > 0) {
    for (let i = 0; i < segments.length - 1; i++) {
      segments[i].dur = Math.max(1, segments[i + 1].start - segments[i].start)
    }
    return segments
  }

  return null
}


/**
 * Request YouTube player response data from the MAIN world pageContext script
 */
export async function requestPlayerDataFromPage(): Promise<{
  captionTracks: any[]
  translationLanguages: any[]
  title: string
  videoId: string
} | null> {
  return new Promise((resolve) => {
    let handled = false
    const timeout = setTimeout(() => {
      if (!handled) {
        handled = true
        window.removeEventListener('CADENCE_RESPONSE_PLAYER_DATA', onResponse as any)
        resolve(null)
      }
    }, 600)

    const onResponse = (e: CustomEvent) => {
      if (!handled && e.detail?.success) {
        handled = true
        clearTimeout(timeout)
        window.removeEventListener('CADENCE_RESPONSE_PLAYER_DATA', onResponse as any)
        resolve(e.detail)
      }
    }

    window.addEventListener('CADENCE_RESPONSE_PLAYER_DATA', onResponse as any)
    window.dispatchEvent(new CustomEvent('CADENCE_REQUEST_PLAYER_DATA'))
  })
}

/**
 * Fetch track timedtext via MAIN world pageContext script using active YouTube session
 */
export async function fetchTrackViaPageContext(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const requestId = 'req_' + Math.random().toString(36).slice(2)
    let handled = false
    const timeout = setTimeout(() => {
      if (!handled) {
        handled = true
        window.removeEventListener('CADENCE_FETCH_TRACK_RESPONSE', onResponse as any)
        resolve(null)
      }
    }, 2500)

    const onResponse = (e: CustomEvent) => {
      if (!handled && e.detail?.requestId === requestId) {
        handled = true
        clearTimeout(timeout)
        window.removeEventListener('CADENCE_FETCH_TRACK_RESPONSE', onResponse as any)
        if (e.detail?.success && e.detail.text) {
          resolve(e.detail.text)
        } else {
          resolve(null)
        }
      }
    }

    window.addEventListener('CADENCE_FETCH_TRACK_RESPONSE', onResponse as any)
    window.dispatchEvent(new CustomEvent('CADENCE_FETCH_TRACK', { detail: { url, requestId } }))
  })
}

/**
 * Fetch available caption and transcript tracks for the current video
 */
export async function getAvailableCaptionTracks(videoId: string): Promise<CaptionTrackOption[]> {
  const tracks: CaptionTrackOption[] = []

  // Check if native transcript already exists in DOM
  const hasNative = Boolean(
    document.querySelector('transcript-segment-view-model, ytd-transcript-segment-renderer')
  )
  if (hasNative) {
    tracks.push({
      id: 'native',
      name: 'YouTube Native Subtitles',
      languageCode: 'auto',
      kind: 'native',
    })
  }

  // 1. Try querying pageContext in MAIN world
  let captionTracks: any[] | null = null
  try {
    const pageData = await requestPlayerDataFromPage()
    if (pageData?.captionTracks && Array.isArray(pageData.captionTracks) && pageData.captionTracks.length > 0) {
      captionTracks = pageData.captionTracks
    }
  } catch {}

  // 2. Try window.ytInitialPlayerResponse (if accessible)
  if (!captionTracks || captionTracks.length === 0) {
    const win = window as any
    captionTracks = win.ytInitialPlayerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || null
  }

  // 3. Try inline scripts in document
  if (!captionTracks || captionTracks.length === 0) {
    const scripts = Array.from(document.querySelectorAll('script'))
    for (const script of scripts) {
      const content = script.textContent || ''
      if (content.includes('captionTracks')) {
        const match = content.match(/"captionTracks":\s*(\[.*?\])(?:,"|\})/)
        if (match && match[1]) {
          try {
            captionTracks = JSON.parse(match[1])
            break
          } catch {}
        }
      }
    }
  }

  // 4. Fallback: fetch watch page HTML
  if (!captionTracks || captionTracks.length === 0) {
    try {
      const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, { credentials: 'omit' })
      if (res.ok) {
        const html = await res.text()
        const match = html.match(/"captionTracks":\s*(\[.*?\])(?:,"|\})/)
        if (match && match[1]) {
          try {
            captionTracks = JSON.parse(match[1])
          } catch {}
        }
      }
    } catch {}
  }

  if (Array.isArray(captionTracks)) {
    for (let i = 0; i < captionTracks.length; i++) {
      const ct = captionTracks[i]
      const rawName = ct.name?.simpleText || ct.name?.runs?.[0]?.text || ct.languageCode || `Track ${i + 1}`
      const isAsr = ct.kind === 'asr' || ct.vssId?.startsWith('a.')
      const displayName = isAsr && !rawName.toLowerCase().includes('auto') ? `${rawName} (auto)` : rawName
      const id = ct.vssId || `${ct.languageCode || 'track'}_${i}`

      if (!tracks.some((t) => t.id === id || (t.baseUrl && t.baseUrl === ct.baseUrl))) {
        tracks.push({
          id,
          name: displayName,
          languageCode: ct.languageCode || 'en',
          baseUrl: ct.baseUrl,
          kind: isAsr ? 'asr' : 'standard',
        })
      }
    }
  }

  return tracks
}

/**
 * Fetch segments from a caption track baseUrl (JSON3 or XML format)
 */
export async function fetchSegmentsFromTrackUrl(baseUrl: string): Promise<TranscriptSegment[]> {
  const sep = baseUrl.includes('?') ? '&' : '?'
  let responseText = ''

  // 1. Try fetching via page context (runs with YouTube's session cookies & origin)
  try {
    const pageText = await fetchTrackViaPageContext(`${baseUrl}${sep}fmt=json3`)
    if (pageText && pageText.trim().length > 0) {
      responseText = pageText
    }
  } catch {}

  // 2. Direct fetch with json3
  if (!responseText) {
    try {
      const res = await fetch(`${baseUrl}${sep}fmt=json3`)
      if (res.ok) {
        responseText = await res.text()
      }
    } catch {}
  }

  // 3. Direct fetch raw
  if (!responseText) {
    try {
      const res = await fetch(baseUrl)
      if (res.ok) {
        responseText = await res.text()
      }
    } catch {}
  }

  const segments: TranscriptSegment[] = []

  if (responseText && responseText.trim()) {
    try {
      const data = JSON.parse(responseText)
      if (Array.isArray(data.events)) {
        for (const event of data.events) {
          if (!Array.isArray(event.segs)) continue
          const text = sanitizeSegmentText(event.segs.map((s: any) => s.utf8 || '').join(''))
          if (!text) continue

          const start = (event.tStartMs || 0) / 1000
          const dur = (event.dDurationMs || 0) / 1000

          segments.push({
            start,
            dur,
            formattedTime: formatTimestamp(start),
            text,
          })
        }
      }
    } catch {
      const matches = [...responseText.matchAll(/<text\s+start="([\d.]+)"(?:\s+dur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/gi)]
      for (const m of matches) {
        const start = parseFloat(m[1])
        const dur = parseFloat(m[2] || '4')
        const text = sanitizeSegmentText(m[3])
        if (text) {
          segments.push({
            start,
            dur,
            formattedTime: formatTimestamp(start),
            text,
          })
        }
      }
    }
  }

  return segments
}

/**
 * Fetch captions/transcripts from YouTube for a video, optionally targeting a specific track ID
 */
export async function fetchYouTubeCaptions(videoId: string, targetTrackId?: string): Promise<TranscriptData> {
  if (!videoId) {
    throw new Error('No YouTube video ID detected. Please navigate to a video watch page.')
  }

  const videoTitle = document.querySelector('h1.ytd-watch-metadata yt-formatted-string, #title h1')?.textContent?.trim() || 'YouTube Subtitles'
  const availableTracks = await getAvailableCaptionTracks(videoId)

  // 1. If a specific track was requested:
  if (targetTrackId) {
    if (targetTrackId === 'native') {
      const nativeSegments = await extractFromNativeTranscript()
      if (nativeSegments && nativeSegments.length > 0) {
        const result: TranscriptData = {
          title: videoTitle,
          segments: nativeSegments,
          originalSegments: nativeSegments.map((s) => ({ ...s })),
          fileName: 'YouTube Native Subtitles',
          availableTracks,
          selectedTrackId: 'native',
        }
        saveTranscript(videoId, result)
        return result
      }
    } else {
      const matched = availableTracks.find((t) => t.id === targetTrackId)
      if (matched?.baseUrl) {
        const segments = await fetchSegmentsFromTrackUrl(matched.baseUrl)
        if (segments && segments.length > 0) {
          const result: TranscriptData = {
            title: `${videoTitle} (${matched.name})`,
            segments,
            originalSegments: segments.map((s) => ({ ...s })),
            fileName: matched.name,
            availableTracks,
            selectedTrackId: matched.id,
            detectedLanguage: matched.languageCode,
          }
          saveTranscript(videoId, result)
          return result
        }
      }
    }
  }

  // 2. Default selection:
  // Priority 1: Check caption tracks from player
  if (availableTracks.length > 0) {
    const selected =
      availableTracks.find((t) => t.baseUrl && (t.languageCode === 'en' || t.id.includes('.en'))) ||
      availableTracks.find((t) => Boolean(t.baseUrl))

    if (selected?.baseUrl) {
      const segments = await fetchSegmentsFromTrackUrl(selected.baseUrl)
      if (segments.length > 0) {
        const result: TranscriptData = {
          title: `${videoTitle} (${selected.name})`,
          segments,
          originalSegments: segments.map((s) => ({ ...s })),
          fileName: selected.name,
          availableTracks,
          selectedTrackId: selected.id,
          detectedLanguage: selected.languageCode,
        }
        saveTranscript(videoId, result)
        return result
      }
    }
  }

  // Priority 2: Extract from YouTube's native transcript in DOM if already open
  try {
    const nativeSegments = await extractFromNativeTranscript()
    if (nativeSegments && nativeSegments.length > 0) {
      const result: TranscriptData = {
        title: videoTitle,
        segments: nativeSegments,
        originalSegments: nativeSegments.map((s) => ({ ...s })),
        fileName: 'YouTube Native Subtitles',
        availableTracks,
        selectedTrackId: 'native',
      }
      saveTranscript(videoId, result)
      return result
    }
  } catch (err) {
    console.debug('[Cadence] Native transcript extraction error:', err)
  }

  throw new Error(
    'This video has no accessible closed captions or subtitles on YouTube. You can upload an SRT/VTT file or paste the transcript text below.'
  )
}

// -------------------------------------------------------------
// Translation: Zero-Config Web Translator (No chrome://flags)
// with fallback to Chrome Built-in AI if available
// -------------------------------------------------------------

export function isTranslationApiSupported(): boolean {
  const win = window as any
  return Boolean(
    (win.translation && typeof win.translation.createTranslator === 'function') ||
    (win.ai && win.ai.translator && typeof win.ai.translator.create === 'function')
  )
}

export async function detectLanguage(text: string): Promise<string> {
  const win = window as any
  try {
    if (win.translation && typeof win.translation.createDetector === 'function') {
      const detector = await win.translation.createDetector()
      const results = await detector.detect(text)
      if (results && results.length > 0) {
        return results[0].detectedLanguage || 'de'
      }
    } else if (win.ai?.languageDetector && typeof win.ai.languageDetector.create === 'function') {
      const detector = await win.ai.languageDetector.create()
      const results = await detector.detect(text)
      if (results && results.length > 0) {
        return results[0].detectedLanguage || 'de'
      }
    }
  } catch (err) {
    console.debug('[Cadence] Language detection error:', err)
  }
  return 'de'
}

export interface TargetLanguage {
  code: string
  name: string
}

export const SUPPORTED_LANGUAGES: TargetLanguage[] = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish (Español)' },
  { code: 'fr', name: 'French (Français)' },
  { code: 'de', name: 'German (Deutsch)' },
  { code: 'it', name: 'Italian (Italiano)' },
  { code: 'pt', name: 'Portuguese (Português)' },
  { code: 'ru', name: 'Russian (Русский)' },
  { code: 'zh-CN', name: 'Chinese (中文)' },
  { code: 'ja', name: 'Japanese (日本語)' },
  { code: 'ko', name: 'Korean (한국어)' },
  { code: 'ar', name: 'Arabic (العربية)' },
  { code: 'hi', name: 'Hindi (हिन्दी)' },
  { code: 'bn', name: 'Bengali (বাংলা)' },
  { code: 'tr', name: 'Turkish (Türkçe)' },
  { code: 'nl', name: 'Dutch (Nederlands)' },
  { code: 'pl', name: 'Polish (Polski)' },
  { code: 'vi', name: 'Vietnamese (Tiếng Việt)' },
  { code: 'id', name: 'Indonesian (Bahasa Indonesia)' },
  { code: 'uk', name: 'Ukrainian (Українська)' },
]

const TARGET_LANG_KEY = 'cadence_yt_target_lang'

export function getStoredTargetLanguage(): string {
  try {
    return localStorage.getItem(TARGET_LANG_KEY) || 'en'
  } catch {
    return 'en'
  }
}

export function saveStoredTargetLanguage(lang: string): void {
  try {
    localStorage.setItem(TARGET_LANG_KEY, lang)
  } catch {
    // ignore
  }
}

/**
 * Fallback to Chrome on-device AI model if available
 */
async function translateSegmentsViaChromeAi(
  segments: TranscriptSegment[],
  targetLang = 'en',
  sourceLang?: string,
  onProgress?: (done: number, total: number) => void
): Promise<{ translatedSegments: TranscriptSegment[]; detectedSource: string }> {
  const win = window as any
  let detected = sourceLang
  if (!detected || detected === 'auto') {
    const sample = segments.slice(0, 10).map((s) => s.text).join(' ')
    detected = await detectLanguage(sample)
  }
  if (!detected) detected = 'de'

  let translator: any = null

  if (win.translation && typeof win.translation.createTranslator === 'function') {
    translator = await win.translation.createTranslator({
      sourceLanguage: detected,
      targetLanguage: targetLang,
    })
  } else if (win.ai?.translator && typeof win.ai.translator.create === 'function') {
    translator = await win.ai.translator.create({
      sourceLanguage: detected,
      targetLanguage: targetLang,
    })
  }

  if (!translator) {
    throw new Error('On-device AI translator could not be initialized.')
  }

  const translatedSegments: TranscriptSegment[] = []
  const total = segments.length

  for (let idx = 0; idx < total; idx++) {
    const seg = segments[idx]
    try {
      const translatedText = await translator.translate(seg.text)
      translatedSegments.push({
        ...seg,
        text: seg.text,
        translatedText: translatedText || undefined,
      })
    } catch {
      translatedSegments.push({ ...seg })
    }
    if (onProgress) {
      onProgress(idx + 1, total)
    }
  }

  return {
    translatedSegments,
    detectedSource: detected,
  }
}

/**
 * Universal translate function:
 * Uses zero-config background translation (single batch request)
 * and falls back to on-device AI if available.
 */
export async function translateSegments(
  segments: TranscriptSegment[],
  targetLang = 'en',
  sourceLang = 'auto',
  onProgress?: (done: number, total: number) => void
): Promise<{ translatedSegments: TranscriptSegment[]; detectedSource: string }> {
  const total = segments.length
  if (total === 0) {
    return { translatedSegments: [], detectedSource: sourceLang }
  }

  // 1. Single Request via Extension Background Service Worker
  if (typeof chrome !== 'undefined' && typeof chrome.runtime?.sendMessage === 'function') {
    try {
      if (onProgress) onProgress(0, total)
      const allTexts = segments.map((s) => s.text)

      const result = await new Promise<{ texts: string[]; detectedSource: string }>((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            action: 'TRANSLATE_ALL',
            texts: allTexts,
            sourceLang,
            targetLang,
          },
          (response) => {
            if (chrome.runtime.lastError) {
              return reject(new Error(chrome.runtime.lastError.message))
            }
            if (!response || !response.success) {
              return reject(new Error(response?.error || 'Translation failed'))
            }
            resolve({
              texts: response.translatedTexts || [],
              detectedSource: response.detectedSource || sourceLang,
            })
          }
        )
      })

      if (onProgress) onProgress(total, total)

      const translatedSegments: TranscriptSegment[] = segments.map((seg, idx) => ({
        ...seg,
        text: seg.text,
        translatedText: result.texts[idx] || undefined,
      }))

      return {
        translatedSegments,
        detectedSource: result.detectedSource,
      }
    } catch (err) {
      console.warn('[Cadence] Single-request translation error, trying on-device AI:', err)
    }
  }

  // 2. Secondary: On-Device AI
  if (isTranslationApiSupported()) {
    return translateSegmentsViaChromeAi(segments, targetLang, sourceLang, onProgress)
  }

  throw new Error('Translation service is temporarily unreachable. Please try again.')
}

export function translateSegmentsToEnglish(
  segments: TranscriptSegment[],
  sourceLang = 'auto',
  onProgress?: (done: number, total: number) => void
) {
  return translateSegments(segments, 'en', sourceLang, onProgress)
}
