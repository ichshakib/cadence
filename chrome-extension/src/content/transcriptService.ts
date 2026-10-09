// Cadence - Transcript & Translation Service (Facade)
// Re-exports all modular sub-services for clean modularity and backwards compatibility.

// 1. Time & Video Control Utilities
export {
  formatTimestamp,
  parseTimestampToSeconds,
  seekVideo,
  getCurrentVideoId,
} from './services/timeUtils.ts'

// 2. Transcript & Language Storage
export {
  saveTranscript,
  loadStoredTranscript,
  loadStoredTranscriptAsync,
  clearStoredTranscript,
  getStoredTargetLanguage,
  loadStoredTargetLanguageAsync,
  saveStoredTargetLanguage,
} from './services/transcriptStorage.ts'

// 3. Transcript Parsing & Sanitization
export {
  sanitizeSegmentText,
  cleanText,
  tryParseJson,
  tryParseSubtitle,
  parseTimestampedLines,
  parseTranscriptContent,
} from './services/transcriptParser.ts'

// 4. YouTube Native & Caption Track Extraction
export {
  closeNativeTranscriptPanel,
  findNativeSegmentElements,
  extractSegmentData,
  extractFromNativeTranscript,
  extractCaptionTracksFromJson,
  requestPlayerDataFromPage,
  fetchTrackViaPageContext,
  getAvailableCaptionTracks,
  fetchSegmentsFromTrackUrl,
  fetchYouTubeCaptions,
} from './services/youtubeCaptions.ts'

// 5. Translation Service & Language Definitions
export {
  SUPPORTED_LANGUAGES,
  isTranslationApiSupported,
  detectLanguage,
  translateSegmentsViaChromeAi,
  translateSegments,
  translateSegmentsToEnglish,
} from './services/translationService.ts'
export type { TargetLanguage } from './services/translationService.ts'
