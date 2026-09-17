import { useState, useEffect } from 'react'
import { Captions, Languages, ExternalLink, ArrowUpRight } from 'lucide-react'
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
    <div className="cadence-popup">
      {/* Minimal Header */}
      <header className="popup-header">
        <div className="popup-brand">
          <Captions size={15} className="popup-brand-icon" />
          <span className="popup-brand-title">Cadence</span>
        </div>
        <span className={`popup-status ${isYouTubeTab ? 'active' : ''}`}>
          <span className="status-dot" />
          {isYouTubeTab ? 'YouTube' : 'Standby'}
        </span>
      </header>

      {/* Main Body */}
      <div className="popup-body">
        {/* On-Page Action if on YouTube */}
        {isYouTubeTab && (
          <button
            type="button"
            className="popup-btn popup-btn-action"
            onClick={toggleTranscriptOnPage}
          >
            <span>Open Transcript on Page</span>
            <ArrowUpRight size={13} />
          </button>
        )}

        {/* Translation Language Selector */}
        <div className="popup-field">
          <label htmlFor="pref-lang" className="popup-label">
            <Languages size={12} />
            <span>Translation Language</span>
          </label>
          <select
            id="pref-lang"
            className="popup-select"
            value={targetLang}
            onChange={(e) => handleLangChange(e.target.value)}
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>

        {/* Minimal Instructions */}
        <div className="popup-guide">
          <div className="guide-item">
            <span className="guide-num">1</span>
            <span>Click <strong>Transcript</strong> below any YouTube video</span>
          </div>
          <div className="guide-item">
            <span className="guide-num">2</span>
            <span>Upload <code>.srt</code>, <code>.vtt</code>, <code>.txt</code> or paste lines</span>
          </div>
        </div>
      </div>

      {/* Minimal Footer */}
      <footer className="popup-footer">
        <span>v1.0</span>
        <button type="button" className="footer-link" onClick={openYouTube}>
          youtube.com <ExternalLink size={10} />
        </button>
      </footer>
    </div>
  )
}
