// Cadence - Transcript Parsing & Sanitization Service
import type { TranscriptSegment, TranscriptData } from '../types.ts'
import { formatTimestamp, parseTimestampToSeconds } from './timeUtils.ts'

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

export function cleanText(text: string): string {
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
export function tryParseJson(raw: string, fileName?: string): TranscriptData | null {
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
export function tryParseSubtitle(raw: string, fileName?: string): TranscriptData | null {
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
export function parseTimestampedLines(raw: string, fileName?: string): TranscriptData {
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
