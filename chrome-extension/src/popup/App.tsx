import { useState, useEffect } from 'react'
import {
  Captions,
  Languages,
  Search,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { SUPPORTED_LANGUAGES, getStoredTargetLanguage, saveStoredTargetLanguage } from '../content/transcriptService'
import './App.css'

export default function App() {
  const [targetLang, setTargetLang] = useState<string>('en')
  const [isYouTubeTab, setIsYouTubeTab] = useState<boolean | null>(null)

  useEffect(() => {
    setTargetLang(getStoredTargetLanguage())

    if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const url = tabs[0]?.url || ''
        setIsYouTubeTab(url.includes('youtube.com'))
      })
    }
  }, [])

  const handleLangChange = (newLang: string) => {
    setTargetLang(newLang)
    saveStoredTargetLanguage(newLang)
  }

  const openYouTube = () => {
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      chrome.tabs.create({ url: 'https://www.youtube.com' })
    } else {
      window.open('https://www.youtube.com', '_blank')
    }
  }

  return (
    <div className="cadence-popup-root">
      {/* Header */}
      <header className="cadence-header">
        <div className="cadence-logo-row">
          <div className="cadence-icon-badge">
            <Captions size={20} className="cadence-icon" />
          </div>
          <div>
            <h1 className="cadence-title">Cadence</h1>
            <p className="cadence-subtitle">YouTube Transcript & Subtitles</p>
          </div>
        </div>
        <span className={`cadence-status-pill ${isYouTubeTab ? 'active' : ''}`}>
          <span className="cadence-status-dot" />
          {isYouTubeTab ? 'Active' : 'Standby'}
        </span>
      </header>

      {/* Main Content */}
      <main className="cadence-body">
        {isYouTubeTab === false && (
          <div className="cadence-notice">
            <p>Open any YouTube video to access the interactive transcript panel and translation controls.</p>
            <button type="button" className="cadence-action-btn primary" onClick={openYouTube}>
              <ExternalLink size={14} />
              Open YouTube
            </button>
          </div>
        )}

        {/* Default Language Preference */}
        <section className="cadence-section">
          <label htmlFor="pref-lang" className="cadence-section-label">
            <Languages size={15} />
            <span>Default Translation Language</span>
          </label>
          <select
            id="pref-lang"
            className="cadence-select"
            value={targetLang}
            onChange={(e) => handleLangChange(e.target.value)}
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </section>

        {/* Feature Highlights */}
        <section className="cadence-features">
          <div className="cadence-feature-item">
            <CheckCircle2 size={15} className="cadence-feat-icon" />
            <div>
              <strong>Instant Captions & Upload</strong>
              <p>Automatic subtitle extraction, file upload (.srt, .vtt, .json), and paste</p>
            </div>
          </div>
          <div className="cadence-feature-item">
            <Sparkles size={15} className="cadence-feat-icon" />
            <div>
              <strong>Batch Bilingual Translation</strong>
              <p>One-click dual-language subtitles without rate limits</p>
            </div>
          </div>
          <div className="cadence-feature-item">
            <Clock size={15} className="cadence-feat-icon" />
            <div>
              <strong>Live Playback Sync & Seek</strong>
              <p>Auto-scrolling transcript highlights current line; click any timestamp to jump</p>
            </div>
          </div>
          <div className="cadence-feature-item">
            <Search size={15} className="cadence-feat-icon" />
            <div>
              <strong>Full-Text Search & Export</strong>
              <p>Filter through transcript text instantly and copy to clipboard</p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="cadence-footer">
        <span>Cadence Extension v1.0</span>
        <button type="button" className="cadence-link-btn" onClick={openYouTube}>
          YouTube <ExternalLink size={11} />
        </button>
      </footer>
    </div>
  )
}
