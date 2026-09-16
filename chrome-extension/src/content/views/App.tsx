// Cadence - Content Script Main App View
import { useState, useEffect } from 'react'
import './App.css'
import Transcript from './Transcript.tsx'
import { useYouTubeTheme } from '../hooks/useYouTubeTheme.ts'
import { isPanelOpen } from '../panelState.ts'

interface AppProps {
  width?: string | number
  height?: string | number
}

export default function App({
  width = '100%',
  height = 'auto',
}: AppProps) {
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

  if (!isOpen) {
    return null
  }

  return (
    <div
      className="yt-playlist-top-banner"
      data-theme={theme}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
    >
      <Transcript />
    </div>
  )
}
