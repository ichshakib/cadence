// Cadence - Transcript Types

export interface TranscriptSegment {
  start: number
  dur: number
  formattedTime: string
  text: string
  translatedText?: string
}

export interface TranscriptData {
  title?: string
  sourceVideoUrl?: string
  segments: TranscriptSegment[]
  detectedLanguage?: string
  targetLanguage?: string
  showTranslation?: boolean
  rawText?: string
  fileName?: string
}

export interface TargetInsertion {
  parent: HTMLElement
  before: HTMLElement | null
}
