// Cadence - YouTube Native & Caption Track Extraction Service
import type { TranscriptSegment, TranscriptData, CaptionTrackOption } from '../types.ts'
import { formatTimestamp, parseTimestampToSeconds } from './timeUtils.ts'
import { sanitizeSegmentText } from './transcriptParser.ts'
import { saveTranscript } from './transcriptStorage.ts'

export function closeNativeTranscriptPanel(): void {
  // Safe no-op: Cadence NEVER interferes with or closes panels opened by the user
}

export function findNativeSegmentElements(): HTMLElement[] {
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

export function extractSegmentData(el: HTMLElement): { start: number; text: string } | null {
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
 * Robust extractor for captionTracks array from page scripts or HTML.
 * Handles nested JSON structures (e.g. name.runs: [{ text: "..." }]) without premature termination.
 */
export function extractCaptionTracksFromJson(source: string): any[] | null {
  if (!source || !source.includes('captionTracks')) return null

  // If escaped quotes are present, normalize them
  const unescaped = source.includes('\\"') ? source.replace(/\\"/g, '"').replace(/\\\\/g, '\\') : source

  const key = '"captionTracks":'
  let searchIdx = 0
  while (true) {
    const keyIdx = unescaped.indexOf(key, searchIdx)
    if (keyIdx === -1) break

    const arrayStart = unescaped.indexOf('[', keyIdx + key.length)
    if (arrayStart === -1) {
      searchIdx = keyIdx + key.length
      continue
    }

    let depth = 0
    let inString = false
    let escape = false
    let arrayEnd = -1

    for (let i = arrayStart; i < unescaped.length; i++) {
      const ch = unescaped[i]
      if (escape) {
        escape = false
        continue
      }
      if (ch === '\\') {
        escape = true
        continue
      }
      if (ch === '"') {
        inString = !inString
        continue
      }
      if (!inString) {
        if (ch === '[') depth++
        else if (ch === ']') {
          depth--
          if (depth === 0) {
            arrayEnd = i
            break
          }
        }
      }
    }

    if (arrayEnd !== -1) {
      const rawJson = unescaped.substring(arrayStart, arrayEnd + 1)
      try {
        const parsed = JSON.parse(rawJson)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed
        }
      } catch {
        // Continue searching if this instance failed to parse
      }
    }

    searchIdx = keyIdx + key.length
  }

  return null
}

/**
 * Request YouTube player response data from the MAIN world via background service worker or CustomEvents
 */
export async function requestPlayerDataFromPage(): Promise<{
  captionTracks: any[]
  translationLanguages: any[]
  title: string
  videoId: string
} | null> {
  // 1. Primary: Request via Chrome background service worker (chrome.scripting into MAIN world)
  if (typeof chrome !== 'undefined' && typeof chrome.runtime?.sendMessage === 'function') {
    try {
      const bgResponse = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage({ action: 'GET_PLAYER_DATA' }, (res) => {
          if (chrome.runtime.lastError || !res || !res.success) {
            resolve(null)
          } else {
            resolve(res)
          }
        })
      })

      if (bgResponse?.captionTracks && Array.isArray(bgResponse.captionTracks) && bgResponse.captionTracks.length > 0) {
        return bgResponse
      }
    } catch (err) {
      console.debug('[Cadence] Background get_player_data failed, trying fallback:', err)
    }
  }

  // 2. Fallback: CustomEvent communication (if page context script is active)
  return new Promise((resolve) => {
    let handled = false
    const timeout = setTimeout(() => {
      if (!handled) {
        handled = true
        window.removeEventListener('CADENCE_RESPONSE_PLAYER_DATA', onResponse as any)
        resolve(null)
      }
    }, 400)

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
 * Fetch track timedtext via MAIN world session using background service worker or CustomEvents
 */
export async function fetchTrackViaPageContext(url: string): Promise<string | null> {
  // 1. Primary: Use background service worker chrome.scripting to fetch inside MAIN world session
  if (typeof chrome !== 'undefined' && typeof chrome.runtime?.sendMessage === 'function') {
    try {
      const bgResponse = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage({ action: 'FETCH_TIMEDTEXT', url }, (res) => {
          if (chrome.runtime.lastError || !res || !res.success) {
            resolve(null)
          } else {
            resolve(res)
          }
        })
      })

      if (bgResponse?.text && bgResponse.text.trim().length > 0) {
        return bgResponse.text
      }
    } catch (err) {
      console.debug('[Cadence] Background fetch_timedtext failed, trying fallback:', err)
    }
  }

  // 2. Fallback: CustomEvent communication
  return new Promise((resolve) => {
    const requestId = 'req_' + Math.random().toString(36).slice(2)
    let handled = false
    const timeout = setTimeout(() => {
      if (!handled) {
        handled = true
        window.removeEventListener('CADENCE_FETCH_TRACK_RESPONSE', onResponse as any)
        resolve(null)
      }
    }, 1500)

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

  // 1. Try querying MAIN world via background service worker
  let captionTracks: any[] | null = null
  try {
    const pageData = await requestPlayerDataFromPage()
    if (pageData?.captionTracks && Array.isArray(pageData.captionTracks) && pageData.captionTracks.length > 0) {
      captionTracks = pageData.captionTracks
    }
  } catch {}

  // 2. Try window.ytInitialPlayerResponse (if accessible in same world)
  if (!captionTracks || captionTracks.length === 0) {
    const win = window as any
    captionTracks = win.ytInitialPlayerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || null
  }

  // 3. Try inline scripts in document with balanced JSON parser
  if (!captionTracks || captionTracks.length === 0) {
    const scripts = Array.from(document.querySelectorAll('script'))
    for (const script of scripts) {
      const content = script.textContent || ''
      if (content.includes('captionTracks')) {
        const extracted = extractCaptionTracksFromJson(content)
        if (extracted && extracted.length > 0) {
          captionTracks = extracted
          break
        }
      }
    }
  }

  // 4. Fallback: fetch watch page HTML with balanced JSON parser
  if (!captionTracks || captionTracks.length === 0) {
    try {
      const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, { credentials: 'include' })
      if (res.ok) {
        const html = await res.text()
        const extracted = extractCaptionTracksFromJson(html)
        if (extracted && extracted.length > 0) {
          captionTracks = extracted
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
 * Includes rate-limit guard (HTTP 429) to avoid repeated spam requests.
 */
export async function fetchSegmentsFromTrackUrl(baseUrl: string): Promise<TranscriptSegment[]> {
  const sep = baseUrl.includes('?') ? '&' : '?'
  let responseText = ''
  let isRateLimited = false

  const checkRateLimit = (status: number, text: string) => {
    if (status === 429 || text.includes('429 Too Many Requests') || text.includes('unusual traffic')) {
      isRateLimited = true
      return true
    }
    return false
  }

  // 1. Try fetching via MAIN world (runs with YouTube's session cookies & origin)
  try {
    const pageText = await fetchTrackViaPageContext(`${baseUrl}${sep}fmt=json3`)
    if (pageText && pageText.trim().length > 0) {
      if (checkRateLimit(200, pageText)) {
        // Was rate limited by YouTube CDN
      } else {
        responseText = pageText
      }
    }
  } catch {}

  // 1b. If fmt=json3 was empty in page context and NOT rate-limited, try raw baseUrl
  if (!responseText && !isRateLimited) {
    try {
      const pageText = await fetchTrackViaPageContext(baseUrl)
      if (pageText && pageText.trim().length > 0) {
        if (!checkRateLimit(200, pageText)) {
          responseText = pageText
        }
      }
    } catch {}
  }

  // 2. Direct fetch with json3 and credentials (only if not rate limited)
  if (!responseText && !isRateLimited) {
    try {
      const res = await fetch(`${baseUrl}${sep}fmt=json3`, { credentials: 'include' })
      if (res.status === 429) {
        isRateLimited = true
      } else if (res.ok) {
        const text = await res.text()
        if (checkRateLimit(res.status, text)) {
          isRateLimited = true
        } else if (text.trim().length > 0) {
          responseText = text
        }
      }
    } catch {}
  }

  // 3. Direct fetch raw with credentials (only if not rate limited)
  if (!responseText && !isRateLimited) {
    try {
      const res = await fetch(baseUrl, { credentials: 'include' })
      if (res.status === 429) {
        isRateLimited = true
      } else if (res.ok) {
        const text = await res.text()
        if (checkRateLimit(res.status, text)) {
          isRateLimited = true
        } else if (text.trim().length > 0) {
          responseText = text
        }
      }
    } catch {}
  }

  // 4. Direct fetch with srv3 format (only if not rate limited)
  if (!responseText && !isRateLimited) {
    try {
      const res = await fetch(`${baseUrl}${sep}fmt=srv3`, { credentials: 'include' })
      if (res.status === 429) {
        isRateLimited = true
      } else if (res.ok) {
        const text = await res.text()
        if (checkRateLimit(res.status, text)) {
          isRateLimited = true
        } else if (text.trim().length > 0) {
          responseText = text
        }
      }
    } catch {}
  }

  if (isRateLimited && !responseText) {
    throw new Error(
      'YouTube rate-limited subtitle requests (HTTP 429). Please add your free YouTube Data API Key in the Cadence popup to bypass rate limits.'
    )
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
      // Parse XML format (<text start="..." dur="...">...)
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

      // Also parse <p t="..." d="..."> format if present (srv3 format)
      if (segments.length === 0) {
        const pMatches = [...responseText.matchAll(/<p\s+t="(\d+)"(?:\s+d="(\d+)")?[^>]*>([\s\S]*?)<\/p>/gi)]
        for (const m of pMatches) {
          const start = parseInt(m[1], 10) / 1000
          const dur = m[2] ? parseInt(m[2], 10) / 1000 : 4
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
