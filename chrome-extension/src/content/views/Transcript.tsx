// Cadence - Interactive YouTube Transcript & Bilingual Subtitles Component
import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  Upload,
  ClipboardPaste,
  Languages,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  AlertCircle,
  X,
  UploadCloud,
  CornerDownRight,
  Search,
  Subtitles,
} from 'lucide-react'
import type { TranscriptData, TranscriptSegment } from '../types.ts'
import {
  parseTranscriptContent,
  seekVideo,
  getCurrentVideoId,
  saveTranscript,
  loadStoredTranscript,
  loadStoredTranscriptAsync,
  clearStoredTranscript,
  translateSegments,
  SUPPORTED_LANGUAGES,
  getStoredTargetLanguage,
  loadStoredTargetLanguageAsync,
  saveStoredTargetLanguage,
} from '../transcriptService.ts'
import { setPanelOpen } from '../panelState.ts'

export default function Transcript() {
  const [videoId, setVideoId] = useState<string>(() => getCurrentVideoId())
  const [targetLang, setTargetLang] = useState<string>(() => getStoredTargetLanguage())
  const [transcriptData, setTranscriptData] = useState<TranscriptData | null>(() => {
    const id = getCurrentVideoId()
    const stored = loadStoredTranscript(id)
    return stored
  })

  const [currentTime, setCurrentTime] = useState<number>(0)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [autoScroll, setAutoScroll] = useState<boolean>(true)
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle')
  const [isDragging, setIsDragging] = useState<boolean>(false)

  // Translation state
  const [isTranslating, setIsTranslating] = useState<boolean>(false)
  const [translateProgress, setTranslateProgress] = useState<{ done: number; total: number } | null>(null)
  const [translateError, setTranslateError] = useState<string | null>(null)
  const [showTranslation, setShowTranslation] = useState<boolean>(true)
  const [isVideoOverlayEnabled, setIsVideoOverlayEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('cadence_video_overlay_enabled') === 'true'
    } catch {
      return false
    }
  })

  // Toggle Video Player Subtitle Overlay
  const toggleVideoOverlay = useCallback(() => {
    setIsVideoOverlayEnabled((prev) => {
      const next = !prev
      try {
        localStorage.setItem('cadence_video_overlay_enabled', String(next))
      } catch {}
      window.dispatchEvent(
        new CustomEvent('cadence-video-overlay-toggle', {
          detail: { enabled: next },
        })
      )
      return next
    })
  }, [])

  // Paste dialog / input state
  const [isPasteOpen, setIsPasteOpen] = useState<boolean>(false)
  const [pasteInput, setPasteInput] = useState<string>('')
  const [parseError, setParseError] = useState<string | null>(null)

  const activeItemRef = useRef<HTMLDivElement | null>(null)
  const listContainerRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Track latest transcript data and translation handler in refs for storage listeners
  const transcriptDataRef = useRef<TranscriptData | null>(transcriptData)
  useEffect(() => {
    transcriptDataRef.current = transcriptData
  }, [transcriptData])

  // Sync transcript and translation visibility changes with the video overlay
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('cadence-transcript-updated', {
        detail: { transcriptData, showTranslation },
      })
    )
  }, [transcriptData, showTranslation])

  // Respond to query from newly mounted VideoOverlay
  useEffect(() => {
    const handleRequest = () => {
      window.dispatchEvent(
        new CustomEvent('cadence-transcript-updated', {
          detail: { transcriptData, showTranslation },
        })
      )
    }
    window.addEventListener('cadence-request-transcript', handleRequest)
    return () => {
      window.removeEventListener('cadence-request-transcript', handleRequest)
    }
  }, [transcriptData, showTranslation])

  const performTranslationRef = useRef<(langToUse: string) => Promise<void>>(async () => {})

  // Initial load: sync target language and transcript from chrome.storage.local if available
  useEffect(() => {
    const id = getCurrentVideoId()
    if (id && !transcriptData) {
      loadStoredTranscriptAsync(id).then((stored) => {
        if (stored && getCurrentVideoId() === id) {
          setTranscriptData(stored)
          if (stored.targetLanguage) {
            setTargetLang(stored.targetLanguage)
          }
        }
      })
    }
    loadStoredTargetLanguageAsync().then((lang) => {
      if (lang) {
        setTargetLang(lang)
      }
    })
  }, [])

  // Sync video ID across YouTube SPA navigation
  useEffect(() => {
    const checkVideoId = async () => {
      const id = getCurrentVideoId()
      if (id && id !== videoId) {
        setVideoId(id)
        setParseError(null)
        setTranslateError(null)
        setIsPasteOpen(false)
        setIsTranslating(false)

        const stored = loadStoredTranscript(id)
        if (stored) {
          setTranscriptData(stored)
          if (stored.targetLanguage) {
            setTargetLang(stored.targetLanguage)
          }
        } else {
          setTranscriptData(null)
          loadStoredTranscriptAsync(id).then((asyncStored) => {
            if (asyncStored && getCurrentVideoId() === id) {
              setTranscriptData(asyncStored)
              if (asyncStored.targetLanguage) {
                setTargetLang(asyncStored.targetLanguage)
              }
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

  // Sync Target Language from chrome.storage
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      const listener = (changes: any, areaName: string) => {
        if (areaName === 'local' || !areaName) {
          if (changes.cadence_yt_target_lang) {
            const newLang = changes.cadence_yt_target_lang.newValue
            if (newLang && typeof newLang === 'string') {
              setTargetLang(newLang)
              // If we already have a loaded transcript, dynamically translate to the new language
              const current = transcriptDataRef.current
              if (current && current.segments && current.segments.length > 0 && current.targetLanguage !== newLang) {
                performTranslationRef.current(newLang)
              }
            }
          }
        }
      }
      chrome.storage.onChanged.addListener(listener)
      return () => {
        chrome.storage.onChanged.removeListener(listener)
      }
    }
  }, [])

  // Track video playback time
  useEffect(() => {
    const video = document.querySelector<HTMLVideoElement>('video')
    if (!video) return

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime)
    }

    video.addEventListener('timeupdate', handleTimeUpdate)
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate)
    }
  }, [videoId])

  const segments = transcriptData?.segments || []

  // Check if any segment already has translation
  const hasTranslations = useMemo(() => {
    return segments.some((s) => Boolean(s.translatedText))
  }, [segments])

  // Check if current translation matches the selected target language
  const isTranslatedForCurrentLang = useMemo(() => {
    return hasTranslations && (transcriptData?.targetLanguage || 'en') === targetLang
  }, [hasTranslations, transcriptData?.targetLanguage, targetLang])

  const selectedLangObj = useMemo(() => {
    return SUPPORTED_LANGUAGES.find((l) => l.code === targetLang) || { code: 'en', name: 'English' }
  }, [targetLang])

  // Identify currently active segment based on video currentTime
  const activeIndex = useMemo(() => {
    if (segments.length === 0) return -1
    return segments.findIndex((seg, idx) => {
      const nextSeg = segments[idx + 1]
      const endTime = nextSeg ? nextSeg.start : seg.start + (seg.dur || 4)
      return currentTime >= seg.start && currentTime < endTime
    })
  }, [segments, currentTime])

  // Smoothly auto-scroll to active item
  useEffect(() => {
    if (autoScroll && activeItemRef.current && listContainerRef.current) {
      activeItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      })
    }
  }, [activeIndex, autoScroll])

  // Search filter across both original and translated text
  const filteredSegments = useMemo(() => {
    if (!searchQuery.trim()) return segments
    const q = searchQuery.toLowerCase()
    return segments.filter(
      (s) =>
        s.text.toLowerCase().includes(q) ||
        (showTranslation && s.translatedText && s.translatedText.toLowerCase().includes(q))
    )
  }, [segments, searchQuery, showTranslation])

  // Process raw text and set transcript
  const handleLoadContent = useCallback((raw: string, fileName?: string) => {
    const parsed = parseTranscriptContent(raw, fileName)
    if (!parsed.segments || parsed.segments.length === 0) {
      setParseError('No readable transcript lines or timestamps found.')
      return false
    }

    setTranscriptData(parsed)
    saveTranscript(videoId, parsed)
    setIsPasteOpen(false)
    setPasteInput('')
    setParseError(null)
    setTranslateError(null)
    setShowTranslation(true)
    return true
  }, [videoId])

  // File Upload handling
  const handleFile = useCallback((file: File) => {
    setParseError(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result
      if (typeof content === 'string') {
        handleLoadContent(content, file.name)
      }
    }
    reader.onerror = () => {
      setParseError('Failed to read file.')
    }
    reader.readAsText(file)
  }, [handleLoadContent])

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFile(files[0])
    }
    e.target.value = ''
  }

  const triggerUpload = () => {
    fileInputRef.current?.click()
  }

  // Paste handling
  const handlePasteSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!pasteInput.trim()) {
      setParseError('Please paste your transcript content first.')
      return
    }
    handleLoadContent(pasteInput, 'Pasted Transcript')
  }

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0])
    } else {
      const text = e.dataTransfer.getData('text')
      if (text) {
        handleLoadContent(text, 'Pasted Transcript')
      }
    }
  }

  const handleSeek = (time: number) => {
    seekVideo(time)
  }

  const handleClearTranscript = () => {
    clearStoredTranscript(videoId)
    setTranscriptData(null)
    setSearchQuery('')
    setParseError(null)
    setTranslateError(null)
  }

  const handleCopyTranscript = async () => {
    if (!transcriptData || segments.length === 0) return

    try {
      const textToCopy = segments
        .map((s) => {
          if (showTranslation && s.translatedText) {
            return `[${s.formattedTime}] ${s.text}\n   ↳ ${s.translatedText}`
          }
          return `[${s.formattedTime}] ${s.text}`
        })
        .join('\n\n')

      await navigator.clipboard.writeText(textToCopy)
      setCopyStatus('copied')
      setTimeout(() => setCopyStatus('idle'), 2000)
    } catch (e) {
      console.warn('Failed to copy transcript', e)
    }
  }

  // Perform translation for a specific target language
  const performTranslation = async (langToUse: string) => {
    const currentData = transcriptDataRef.current
    if (!currentData || !currentData.segments || currentData.segments.length === 0) return
    setIsTranslating(true)
    setTranslateError(null)
    const baseSegments = currentData.originalSegments || currentData.segments
    setTranslateProgress({ done: 0, total: baseSegments.length })

    try {
      const res = await translateSegments(
        baseSegments,
        langToUse,
        currentData.detectedLanguage,
        (done, total) => setTranslateProgress({ done, total })
      )

      const updated: TranscriptData = {
        ...currentData,
        segments: res.translatedSegments,
        originalSegments: currentData.originalSegments || baseSegments.map((s: TranscriptSegment) => ({ ...s })),
        detectedLanguage: res.detectedSource,
        targetLanguage: langToUse,
        showTranslation: true,
      }
      setTranscriptData(updated)
      saveTranscript(videoId || getCurrentVideoId(), updated)
      setShowTranslation(true)
      setIsTranslating(false)
      setTranslateProgress(null)
    } catch (err: any) {
      console.error('[Cadence] Translation error:', err)
      setTranslateError(err.message || 'Translation failed')
      setIsTranslating(false)
      setTranslateProgress(null)
    }
  }

  useEffect(() => {
    performTranslationRef.current = performTranslation
  })

  // Translate / Toggle Dual-Row Bilingual Subtitles
  const handleTranslateOrToggle = async () => {
    if (!transcriptData || segments.length === 0) return
    setTranslateError(null)

    // If translations already exist for the selected language, toggle visibility
    if (isTranslatedForCurrentLang) {
      setShowTranslation(!showTranslation)
      return
    }

    // Otherwise, perform translation for the selected language
    await performTranslation(targetLang)
  }

  const handleTargetLangChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value
    setTargetLang(newLang)
    saveStoredTargetLanguage(newLang)

    // Immediately translate and update displayed subtitles
    if (transcriptData && segments.length > 0) {
      await performTranslation(newLang)
    }
  }

  // Highlight search matches
  const renderHighlightedText = (text: string, query: string) => {
    if (!query.trim()) return text
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`(${escapedQuery})`, 'gi')
    const parts = text.split(regex)

    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="yt-transcript-highlight">
          {part}
        </mark>
      ) : (
        part
      )
    )
  }

  return (
    <div
      className={`yt-transcript-container ${isDragging ? 'dragging' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden file input for file selection */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept=".txt,.srt,.vtt,.json,.text,text/*"
        onChange={onFileInputChange}
      />

      {/* Header */}
      <div className="yt-transcript-header">
        <div className="yt-transcript-header-main">
          <div className="yt-transcript-title-area">
            <h3 className="yt-transcript-title">Cadence Transcript</h3>
            {segments.length > 0 && (
              <span className="yt-transcript-count-badge" title={transcriptData?.fileName || ''}>
                • {segments.length} lines
              </span>
            )}
            {transcriptData?.fileName && (
              <span className="yt-transcript-filename-badge" title={transcriptData.fileName}>
                {transcriptData.fileName}
              </span>
            )}
          </div>

          <div className="yt-transcript-header-controls">
            {/* Upload & Paste buttons (when no transcript loaded) */}
            {segments.length === 0 && (
              <>
                <button
                  type="button"
                  className="yt-transcript-icon-btn"
                  title="Upload transcript file (.txt, .srt, .vtt, .json)"
                  onClick={triggerUpload}
                  aria-label="Upload transcript"
                >
                  <Upload size={16} />
                </button>

                <button
                  type="button"
                  className={`yt-transcript-icon-btn ${isPasteOpen ? 'active' : ''}`}
                  title="Paste transcript text"
                  onClick={() => {
                    setIsPasteOpen(!isPasteOpen)
                    setParseError(null)
                  }}
                  aria-label="Paste transcript"
                >
                  <ClipboardPaste size={16} />
                </button>
              </>
            )}

            {/* When transcript exists: language select, translate/bilingual, copy, auto-scroll, clear */}
            {segments.length > 0 && (
              <>
                <select
                  className="yt-transcript-lang-select"
                  value={targetLang}
                  onChange={handleTargetLangChange}
                  title="Select translation language"
                  aria-label="Select translation language"
                  disabled={isTranslating}
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.name}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  className={`yt-transcript-icon-btn ${isTranslatedForCurrentLang && showTranslation ? 'active' : ''}`}
                  title={
                    isTranslating
                      ? `Translating to ${selectedLangObj.name} (${translateProgress?.done ?? 0}/${translateProgress?.total ?? segments.length})...`
                      : isTranslatedForCurrentLang
                      ? (showTranslation ? `Bilingual Subtitles (${selectedLangObj.name}) ON - Click to hide` : `Bilingual Subtitles (${selectedLangObj.name}) OFF - Click to show`)
                      : `Translate to ${selectedLangObj.name} (bilingual subtitles)`
                  }
                  disabled={isTranslating}
                  onClick={handleTranslateOrToggle}
                  aria-label="Toggle bilingual translation"
                >
                  {isTranslating ? (
                    <RefreshCw size={16} className="yt-icon-spin" />
                  ) : (
                    <Languages size={16} />
                  )}
                </button>

                <button
                  type="button"
                  className={`yt-transcript-icon-btn ${isVideoOverlayEnabled ? 'active' : ''}`}
                  title={
                    isVideoOverlayEnabled
                      ? 'Subtitles on Video Player: ON (Click to hide on player)'
                      : 'Subtitles on Video Player: OFF (Click to show on player)'
                  }
                  onClick={toggleVideoOverlay}
                  aria-label="Toggle subtitles on video player"
                >
                  <Subtitles size={16} />
                </button>

                <button
                  type="button"
                  className={`yt-transcript-icon-btn ${copyStatus === 'copied' ? 'copied' : ''}`}
                  title={copyStatus === 'copied' ? 'Copied to clipboard!' : 'Copy transcript'}
                  onClick={handleCopyTranscript}
                  aria-label={copyStatus === 'copied' ? 'Copied to clipboard' : 'Copy transcript'}
                >
                  {copyStatus === 'copied' ? (
                    <Check size={16} />
                  ) : (
                    <Copy size={16} />
                  )}
                </button>

                <button
                  type="button"
                  className={`yt-transcript-icon-btn ${autoScroll ? 'active' : ''}`}
                  title={autoScroll ? 'Auto-scroll is ON' : 'Auto-scroll is OFF'}
                  onClick={() => setAutoScroll(!autoScroll)}
                  aria-label="Toggle auto-scroll"
                >
                  <RefreshCw size={16} />
                </button>

                <button
                  type="button"
                  className="yt-transcript-icon-btn yt-transcript-btn-danger"
                  title="Clear current transcript"
                  onClick={handleClearTranscript}
                  aria-label="Clear transcript"
                >
                  <Trash2 size={16} />
                </button>
              </>
            )}

            {/* Collapse/Expand button */}
            <button
              type="button"
              className="yt-transcript-icon-btn"
              title={isCollapsed ? 'Expand transcript' : 'Collapse transcript'}
              onClick={() => setIsCollapsed(!isCollapsed)}
              aria-label={isCollapsed ? 'Expand transcript' : 'Collapse transcript'}
            >
              {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
            </button>

            {/* Close Panel button */}
            <button
              type="button"
              className="yt-transcript-icon-btn"
              title="Close transcript"
              onClick={() => setPanelOpen(false)}
              aria-label="Close transcript"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Translation error message if translation failed */}
        {translateError && (
          <div className="yt-transcript-error-badge" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={14} />
              <span>{translateError}</span>
            </span>
            <button
              type="button"
              className="yt-error-dismiss-btn"
              onClick={() => setTranslateError(null)}
              aria-label="Dismiss error"
            >
              <X size={14} />
            </button>
          </div>
        )}


        {/* Search Bar */}
        {!isCollapsed && !isPasteOpen && segments.length > 0 && (
          <div className="yt-transcript-search-wrap">
            <Search size={14} className="yt-transcript-search-icon" />
            <input
              type="text"
              className="yt-transcript-search-input"
              placeholder="Search in original or translation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="yt-transcript-search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Paste Dialog */}
      {!isCollapsed && isPasteOpen && (
        <form className="yt-transcript-paste-panel" onSubmit={handlePasteSubmit}>
          <div className="yt-transcript-paste-header">
            <span className="yt-transcript-paste-title">Paste Transcript</span>
            <span className="yt-transcript-paste-subtitle">
              Paste YouTube transcript, timestamps [01:23], SRT, VTT, or any text
            </span>
          </div>

          <textarea
            className="yt-transcript-paste-textarea"
            placeholder="Paste your transcript text here...&#10;&#10;Examples:&#10;[00:15] Hello and welcome!&#10;[01:30] Today we discuss...&#10;&#10;Or paste SRT, VTT, or copied YouTube transcript."
            value={pasteInput}
            onChange={(e) => {
              setPasteInput(e.target.value)
              if (parseError) setParseError(null)
            }}
            rows={6}
            autoFocus
          />

          {parseError && (
            <div className="yt-transcript-error-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <AlertCircle size={14} />
              <span>{parseError}</span>
            </div>
          )}

          <div className="yt-transcript-paste-actions">
            <button
              type="button"
              className="yt-transcript-btn yt-transcript-btn-secondary"
              onClick={() => {
                setIsPasteOpen(false)
                setParseError(null)
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="yt-transcript-btn yt-transcript-btn-primary"
            >
              Load Transcript
            </button>
          </div>
        </form>
      )}

      {/* Body / Transcript list or Empty upload dropzone */}
      {!isCollapsed && !isPasteOpen && (
        <div className="yt-transcript-body" ref={listContainerRef}>
          {segments.length === 0 ? (
            /* Empty state with Dropzone */
            <div className="yt-transcript-dropzone" onClick={triggerUpload}>
              <div className="yt-dropzone-icon">
                <UploadCloud size={32} />
              </div>
              <div className="yt-dropzone-primary-text">
                Upload or paste transcript
              </div>
              <div className="yt-dropzone-sub-text">
                Upload an SRT, VTT, or TXT subtitle file, or paste your transcript text
              </div>
              <div className="yt-dropzone-actions" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="yt-transcript-btn yt-transcript-btn-primary"
                  onClick={triggerUpload}
                >
                  <Upload size={15} style={{ marginRight: 6 }} />
                  Upload File
                </button>
                <button
                  type="button"
                  className="yt-transcript-btn yt-transcript-btn-secondary"
                  onClick={() => {
                    setIsPasteOpen(true)
                    setParseError(null)
                  }}
                >
                  <ClipboardPaste size={15} style={{ marginRight: 6 }} />
                  Paste
                </button>
              </div>
              {parseError && (
                <div className="yt-transcript-error-badge" style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <AlertCircle size={14} />
                  <span>{parseError}</span>
                </div>
              )}
            </div>
          ) : filteredSegments.length === 0 ? (
            <div className="yt-transcript-status-msg">
              No lines matching "{searchQuery}"
            </div>
          ) : (
            <div className="yt-transcript-list">
              {filteredSegments.map((segment) => {
                const isActive = segments[activeIndex] === segment
                return (
                  <div
                    key={`${segment.start}-${segment.formattedTime}-${segment.text.slice(0, 15)}`}
                    ref={isActive ? activeItemRef : null}
                    className={`yt-transcript-item ${isActive ? 'active' : ''}`}
                    onClick={() => handleSeek(segment.start)}
                  >
                    <button
                      type="button"
                      className="yt-transcript-timestamp"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSeek(segment.start)
                      }}
                      title={`Jump to ${segment.formattedTime}`}
                    >
                      {segment.formattedTime}
                    </button>

                    <div className="yt-transcript-content-rows">
                      <div className="yt-transcript-row-original">
                        {searchQuery
                          ? renderHighlightedText(segment.text, searchQuery)
                          : segment.text}
                      </div>

                      {showTranslation && segment.translatedText && (
                        <div className="yt-transcript-row-translation">
                          <CornerDownRight size={13} className="yt-transcript-arrow" aria-hidden="true" />
                          <span className="yt-transcript-translation-text">
                            {searchQuery
                              ? renderHighlightedText(segment.translatedText, searchQuery)
                              : segment.translatedText}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
