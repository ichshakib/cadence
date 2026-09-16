// Cadence - Transcript & Translation Service
import type { TranscriptSegment, TranscriptData } from './types.ts'

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

export function loadStoredTranscript(videoId: string): TranscriptData | null {
  try {
    const key = videoId ? `${STORAGE_PREFIX}${videoId}` : `${STORAGE_PREFIX}global`
    const stored = localStorage.getItem(key)
    if (stored) {
      return JSON.parse(stored) as TranscriptData
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

/**
 * Fetch automatic captions from YouTube player data if available on the current page
 */
export async function fetchYouTubeCaptions(videoId: string): Promise<TranscriptData | null> {
  try {
    // 1. Check window.ytInitialPlayerResponse
    const win = window as any
    let playerResponse = win.ytInitialPlayerResponse

    // 2. Fallback: Search script tags for ytInitialPlayerResponse
    if (!playerResponse) {
      const scripts = Array.from(document.querySelectorAll('script'))
      for (const script of scripts) {
        const content = script.textContent || ''
        if (content.includes('ytInitialPlayerResponse')) {
          const match = content.match(/ytInitialPlayerResponse\s*=\s*({.+?});/)
          if (match && match[1]) {
            try {
              playerResponse = JSON.parse(match[1])
              break
            } catch {
              // continue
            }
          }
        }
      }
    }

    const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks
    if (!Array.isArray(captionTracks) || captionTracks.length === 0) {
      return null
    }

    // Pick English or first track
    const track = captionTracks.find((t: any) => t.languageCode === 'en') || captionTracks[0]
    if (!track?.baseUrl) return null

    const response = await fetch(`${track.baseUrl}&fmt=json3`)
    if (!response.ok) return null

    const data = await response.json()
    if (!Array.isArray(data.events)) return null

    const segments: TranscriptSegment[] = []
    for (const event of data.events) {
      if (!Array.isArray(event.segs)) continue
      const text = cleanText(event.segs.map((s: any) => s.utf8 || '').join(''))
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

    if (segments.length > 0) {
      const trackName = track.name?.simpleText || track.languageCode || 'YouTube Subtitles'
      const title = playerResponse?.videoDetails?.title || `${trackName} Subtitles`
      const result: TranscriptData = {
        title,
        segments,
        detectedLanguage: track.languageCode,
        fileName: `${trackName} (YouTube Auto)`,
      }
      saveTranscript(videoId, result)
      return result
    }
  } catch (err) {
    console.debug('[Cadence] Could not auto-fetch YouTube captions:', err)
  }
  return null
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
