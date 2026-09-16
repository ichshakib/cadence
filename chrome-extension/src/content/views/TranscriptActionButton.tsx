import { useState, useEffect } from 'react'
import { Captions } from 'lucide-react'
import { useYouTubeTheme } from '../hooks/useYouTubeTheme.ts'
import { isPanelOpen, setPanelOpen, ensurePanelInjected } from '../panelState.ts'

export default function TranscriptActionButton() {
  const theme = useYouTubeTheme()
  const [isOpen, setIsOpen] = useState<boolean>(() => isPanelOpen())

  useEffect(() => {
    const handleToggle = (e: Event) => {
      const detail = (e as CustomEvent<{ isOpen: boolean }>).detail
      if (typeof detail?.isOpen === 'boolean') {
        setIsOpen(detail.isOpen)
      }
    }
    window.addEventListener('cadence-transcript-panel-toggle', handleToggle)
    return () => {
      window.removeEventListener('cadence-transcript-panel-toggle', handleToggle)
    }
  }, [])

  const handleClick = () => {
    const nextState = !isOpen
    setIsOpen(nextState)
    setPanelOpen(nextState)

    if (nextState) {
      // Guarantee panel is injected and mounted in visible container
      ensurePanelInjected()

      // If opening, smooth scroll to the transcript panel in the right column
      window.setTimeout(() => {
        const panel = document.getElementById('yt-playlist-top-injected')
        if (panel) {
          panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
          const banner = panel.querySelector<HTMLElement>('.yt-playlist-top-banner')
          if (banner) {
            banner.style.transition = 'border-color 0.3s ease, box-shadow 0.3s ease'
            banner.style.borderColor = 'var(--banner-accent, #065fd4)'
            banner.style.boxShadow = '0 0 0 2px var(--banner-accent-subtle, rgba(6, 95, 212, 0.2))'
            window.setTimeout(() => {
              banner.style.borderColor = ''
              banner.style.boxShadow = ''
            }, 1500)
          }
        }
      }, 60)
    }
  }

  const tooltipText = isOpen ? 'Hide Cadence transcript' : 'Show Cadence transcript'

  return (
    <div className="yt-transcript-action-btn-container">
      <button
        type="button"
        className={`yt-transcript-action-btn ${isOpen ? 'active' : ''}`}
        data-theme={theme}
        onClick={handleClick}
        aria-label={tooltipText}
        aria-pressed={isOpen}
      >
        <Captions size={18} className="yt-transcript-action-btn-icon" />
        <span className="yt-transcript-action-btn-label">Transcript</span>
      </button>

      {/* YouTube Native Tooltip */}
      <div className="yt-transcript-native-tooltip" role="tooltip">
        {tooltipText}
      </div>
    </div>
  )
}
