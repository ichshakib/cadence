import { useState, useEffect } from 'react'
import {
  Captions,
  Languages,
  ExternalLink,
  Upload,
  FileText,
} from 'lucide-react'
import {
  SUPPORTED_LANGUAGES,
  getStoredTargetLanguage,
  loadStoredTargetLanguageAsync,
  saveStoredTargetLanguage,
} from '../content/transcriptService'
import './App.css'

export default function App() {
  const [targetLang, setTargetLang] = useState<string>(() => getStoredTargetLanguage())
  const [isYouTubeTab, setIsYouTubeTab] = useState<boolean | null>(null)
  const [activeTabId, setActiveTabId] = useState<number | null>(null)

  useEffect(() => {
    loadStoredTargetLanguageAsync().then((lang) => {
      if (lang) setTargetLang(lang)
    })

    if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0]
        const url = tab?.url || ''
        setIsYouTubeTab(url.includes('youtube.com'))
        if (tab?.id) setActiveTabId(tab.id)
      })
    }
  }, [])

  const handleLangChange = (newLang: string) => {
    setTargetLang(newLang)
    saveStoredTargetLanguage(newLang)
  }

  const toggleTranscriptOnPage = () => {
    if (typeof chrome !== 'undefined' && activeTabId && chrome.scripting) {
      chrome.scripting.executeScript({
        target: { tabId: activeTabId },
        world: 'MAIN',
        func: () => {
          window.dispatchEvent(
            new CustomEvent('cadence-transcript-panel-toggle', {
              detail: { isOpen: true },
            })
          )
        },
      })
    }
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
            <Captions size={18} className="cadence-icon" />
          </div>
          <div>
            <h1 className="cadence-title">Cadence</h1>
            <p className="cadence-subtitle">Bilingual YouTube Subtitles</p>
          </div>
        </div>
        <span className={`cadence-status-pill ${isYouTubeTab ? 'active' : ''}`}>
          <span className="cadence-status-dot" />
          {isYouTubeTab ? 'YouTube Active' : 'Standby'}
        </span>
      </header>

      {/* Main Content */}
      <main className="cadence-body">
        {/* Quick Action Button if on YouTube watch page */}
        {isYouTubeTab && (
          <button
            type="button"
            className="cadence-action-btn primary"
            onClick={toggleTranscriptOnPage}
          >
            <Captions size={14} />
            Open Transcript Panel on Page
          </button>
        )}

        {/* Default Translation Language */}
        <section className="cadence-section">
          <label htmlFor="pref-lang" className="cadence-section-label">
            <Languages size={14} />
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
          <p className="cadence-section-hint">
            Uploaded and pasted transcripts will be translated into this language.
          </p>
        </section>

        {/* How to use */}
        <section className="cadence-section cadence-guide-box">
          <div className="cadence-guide-title">
            <FileText size={13} />
            <span>How to add transcripts</span>
          </div>
          <ol className="cadence-guide-list">
            <li>
              Click the <strong>Transcript</strong> button below the video (between Like/Dislike and Share).
            </li>
            <li>
              Click <strong>Upload File</strong> (<Upload size={11} style={{ display: 'inline', verticalAlign: 'middle' }} />) for <code>.srt</code>, <code>.vtt</code>, <code>.txt</code>, or <code>.json</code>.
            </li>
            <li>
              Or click <strong>Paste</strong> to paste timestamped lines or text directly.
            </li>
          </ol>
        </section>
      </main>

      {/* Minimal Footer */}
      <footer className="cadence-footer">
        <span>Cadence v1.0</span>
        <button type="button" className="cadence-link-btn" onClick={openYouTube}>
          YouTube <ExternalLink size={11} />
        </button>
      </footer>
    </div>
  )
}
