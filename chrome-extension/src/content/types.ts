// Cadence - Transcript Types

export interface TranscriptSegment {
  start: number
  dur: number
  formattedTime: string
  text: string
  translatedText?: string
}

export interface CaptionTrackOption {
  id: string
  name: string
  languageCode: string
  baseUrl?: string
  kind?: string
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
  availableTracks?: CaptionTrackOption[]
  selectedTrackId?: string
  originalSegments?: TranscriptSegment[]
}

export interface TargetInsertion {
  parent: HTMLElement
  before: HTMLElement | null
}
