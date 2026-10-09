// Cadence - Transcript & Target Language Storage Service
import type { TranscriptData } from '../types.ts'
import { sanitizeSegmentText } from './transcriptParser.ts'

const STORAGE_PREFIX = 'cadence_yt_transcript_'

/**
 * Save transcript data to localStorage and chrome.storage.local
 */
export function saveTranscript(videoId: string, data: TranscriptData): void {
  const key = videoId ? `${STORAGE_PREFIX}${videoId}` : `${STORAGE_PREFIX}global`
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch (err) {
    console.warn('[Cadence] Failed to save transcript to localStorage', err)
  }

  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    chrome.storage.local.set({ [key]: data }).catch(() => {})
  }
}

/**
 * Synchronous load of stored transcript from localStorage
 */
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

/**
 * Asynchronous load checking localStorage then chrome.storage.local
 */
export async function loadStoredTranscriptAsync(videoId: string): Promise<TranscriptData | null> {
  const local = loadStoredTranscript(videoId)
  if (local) return local

  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      const key = videoId ? `${STORAGE_PREFIX}${videoId}` : `${STORAGE_PREFIX}global`
      const result = await chrome.storage.local.get(key)
      if (result && result[key]) {
        const data = result[key] as TranscriptData
        if (Array.isArray(data.segments)) {
          data.segments = data.segments.map((seg) => ({
            ...seg,
            text: sanitizeSegmentText(seg.text),
          }))
        }
        return data
      }
    } catch {}
  }
  return null
}

/**
 * Remove stored transcript for video from both storage providers
 */
export function clearStoredTranscript(videoId: string): void {
  const key = videoId ? `${STORAGE_PREFIX}${videoId}` : `${STORAGE_PREFIX}global`
  try {
    localStorage.removeItem(key)
  } catch (err) {
    console.warn('[Cadence] Failed to remove stored transcript', err)
  }

  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    chrome.storage.local.remove(key).catch(() => {})
  }
}

// -------------------------------------------------------------
// Target Language Preference Storage
// -------------------------------------------------------------

const TARGET_LANG_KEY = 'cadence_yt_target_lang'
let cachedTargetLang: string = ''

export function getStoredTargetLanguage(): string {
  if (cachedTargetLang) return cachedTargetLang
  try {
    const val = localStorage.getItem(TARGET_LANG_KEY)
    if (val) {
      cachedTargetLang = val
      return val
    }
  } catch {
    // ignore
  }
  return 'en'
}

export async function loadStoredTargetLanguageAsync(): Promise<string> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      const result = await chrome.storage.local.get(TARGET_LANG_KEY)
      if (result && typeof result[TARGET_LANG_KEY] === 'string' && result[TARGET_LANG_KEY]) {
        cachedTargetLang = result[TARGET_LANG_KEY]
        try {
          localStorage.setItem(TARGET_LANG_KEY, cachedTargetLang)
        } catch {}
        return cachedTargetLang
      }
    } catch {
      // ignore
    }
  }
  return getStoredTargetLanguage()
}

export function saveStoredTargetLanguage(lang: string): void {
  cachedTargetLang = lang
  try {
    localStorage.setItem(TARGET_LANG_KEY, lang)
  } catch {
    // ignore
  }
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    chrome.storage.local.set({ [TARGET_LANG_KEY]: lang }).catch(() => {})
  }
}
