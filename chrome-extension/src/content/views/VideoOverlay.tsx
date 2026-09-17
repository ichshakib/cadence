// Cadence - Video Player Subtitle Overlay Component
// Displays synchronized transcript and bilingual translations directly on top of the YouTube video player.
import { useState, useEffect, useMemo } from 'react'
import type { TranscriptData } from '../types.ts'
import { getCurrentVideoId, loadStoredTranscript, loadStoredTranscriptAsync } from '../transcriptService.ts'

export default function VideoOverlay() {
  const [videoId, setVideoId] = useState<string>(() => getCurrentVideoId())
  const [isEnabled, setIsEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('cadence_video_overlay_enabled') === 'true'
    } catch {
      return false
    }
  })
  const [transcriptData, setTranscriptData] = useState<TranscriptData | null>(() => {
    const id = getCurrentVideoId()
    return loadStoredTranscript(id)
  })
  const [showTranslation, setShowTranslation] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('cadence_show_translation')
      return saved !== 'false'
    } catch {
      return true
    }
  })
  const [currentTime, setCurrentTime] = useState<number>(0)

  // Sync videoId on SPA navigation and periodic checks
  useEffect(() => {
    const checkVideoId = () => {
      const id = getCurrentVideoId()
      if (id && id !== videoId) {
        setVideoId(id)
        const stored = loadStoredTranscript(id)
        if (stored) {
          setTranscriptData(stored)
        } else {
          setTranscriptData(null)
          loadStoredTranscriptAsync(id).then((asyncStored) => {
            if (asyncStored && getCurrentVideoId() === id) {
              setTranscriptData(asyncStored)
            }
          })
        }
      }
    }

    checkVideoId()
    window.addEventListener('yt-navigate-finish', checkVideoId)
    window.addEventListener('yt-page-data-updated', checkVideoId)
    window.addEventListener('popstate', checkVideoId)
    const interval = window.setInterval(checkVideoId, 1000)

    return () => {
      window.removeEventListener('yt-navigate-finish', checkVideoId)
      window.removeEventListener('yt-page-data-updated', checkVideoId)
      window.removeEventListener('popstate', checkVideoId)
      clearInterval(interval)
    }
  }, [videoId])

  // Track video element playback time
  useEffect(() => {
    let videoEl: HTMLVideoElement | null = null

    const handleTime = () => {
      if (videoEl) {
        setCurrentTime(videoEl.currentTime)
      }
    }

    const attachVideo = () => {
      const v = document.querySelector<HTMLVideoElement>('video')
      if (v && v !== videoEl) {
        if (videoEl) {
          videoEl.removeEventListener('timeupdate', handleTime)
        }
        videoEl = v
        videoEl.addEventListener('timeupdate', handleTime)
        setCurrentTime(v.currentTime)
      }
    }

    attachVideo()
    const interval = window.setInterval(attachVideo, 500)

    return () => {
      if (videoEl) {
        videoEl.removeEventListener('timeupdate', handleTime)
      }
      clearInterval(interval)
    }
  }, [videoId])

  // Listen to custom toggle events from the panel button
  useEffect(() => {
    const handleToggle = (e: Event) => {
      const detail = (e as CustomEvent<{ enabled: boolean }>).detail
      if (typeof detail?.enabled === 'boolean') {
        setIsEnabled(detail.enabled)
      }
    }

    const handleTranscriptUpdate = (e: Event) => {
      const detail = (e as CustomEvent<{ transcriptData: TranscriptData | null; showTranslation?: boolean }>).detail
      if (detail) {
        setTranscriptData(detail.transcriptData)
        if (typeof detail.showTranslation === 'boolean') {
          setShowTranslation(detail.showTranslation)
        }
      }
    }

    window.addEventListener('cadence-video-overlay-toggle', handleToggle)
    window.addEventListener('cadence-transcript-updated', handleTranscriptUpdate)

    // Request latest state from Transcript panel if already active
    window.dispatchEvent(new CustomEvent('cadence-request-transcript'))

    return () => {
      window.removeEventListener('cadence-video-overlay-toggle', handleToggle)
      window.removeEventListener('cadence-transcript-updated', handleTranscriptUpdate)
    }
  }, [])

  // Identify currently active segment
  const segments = transcriptData?.segments || []
  const activeSegment = useMemo(() => {
    if (!segments || segments.length === 0) return null
    return (
      segments.find((seg, idx) => {
        const nextSeg = segments[idx + 1]
        const endTime = nextSeg ? nextSeg.start : seg.start + (seg.dur || 4)
        return currentTime >= seg.start && currentTime < endTime
      }) || null
    )
  }, [segments, currentTime])

  // If overlay is disabled or there is no active speech segment at currentTime, render nothing
  if (!isEnabled || !activeSegment) {
    return null
  }

  const hasTranslation = showTranslation && Boolean(activeSegment.translatedText)

  return (
    <div className="cadence-video-subtitle-card" role="status" aria-live="polite">
      <div className="cadence-sub-line-orig">{activeSegment.text}</div>
      {hasTranslation && (
        <div className="cadence-sub-line-trans">{activeSegment.translatedText}</div>
      )}
    </div>
  )
}
