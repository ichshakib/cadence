// Cadence - Translation Service (Batch Background + On-Device Chrome AI Fallback)
import type { TranscriptSegment } from '../types.ts'

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

/**
 * Fallback to Chrome on-device AI model if available
 */
export async function translateSegmentsViaChromeAi(
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
