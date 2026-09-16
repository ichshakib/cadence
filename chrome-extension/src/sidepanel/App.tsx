import { Captions, ExternalLink, Sparkles } from 'lucide-react'
import './App.css'

export default function App() {
  const openYouTube = () => {
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      chrome.tabs.create({ url: 'https://www.youtube.com' })
    } else {
      window.open('https://www.youtube.com', '_blank')
    }
  }

  return (
    <div className="cadence-sidepanel-root">
      <header className="cadence-sidepanel-header">
        <div className="cadence-sidepanel-logo">
          <Captions size={22} className="cadence-sidepanel-icon" />
          <h2>Cadence</h2>
        </div>
        <span className="cadence-sidepanel-tag">Side Panel</span>
      </header>

      <main className="cadence-sidepanel-body">
        <div className="cadence-sidepanel-card">
          <Sparkles size={20} className="cadence-card-icon" />
          <h3>Interactive In-Page Panel</h3>
          <p>
            Cadence embeds directly on YouTube watch pages. You can find the <strong>Transcript</strong> button right next to the Like/Dislike and Share buttons under any video.
          </p>
          <button type="button" className="cadence-btn-primary" onClick={openYouTube}>
            <ExternalLink size={14} />
            Open YouTube
          </button>
        </div>

        <div className="cadence-sidepanel-features">
          <h4>Features Active on YouTube</h4>
          <ul>
            <li>Automatic subtitle and caption detection</li>
            <li>SRT, VTT, and custom text file upload & paste</li>
            <li>Instant batch bilingual translation (20+ languages)</li>
            <li>Timestamp seeking and live playback auto-scroll</li>
            <li>Full transcript search and one-click copy</li>
          </ul>
        </div>
      </main>
    </div>
  )
}
