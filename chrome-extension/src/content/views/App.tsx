// Cadence - Content Script Main App View
import { useState, useEffect, Component, type ReactNode, type ErrorInfo } from 'react'
import './App.css'
import Transcript from './Transcript.tsx'
import { useYouTubeTheme } from '../hooks/useYouTubeTheme.ts'
import { isPanelOpen } from '../panelState.ts'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class PanelErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Cadence] Panel render error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 16, textAlign: 'center' }}>
          <p style={{ fontWeight: 600, color: 'var(--banner-danger, #cc0000)', marginBottom: 8, fontSize: 14 }}>
            Unable to load Cadence transcript
          </p>
          <p style={{ fontSize: 12, color: 'var(--banner-text-secondary, #606060)', marginBottom: 12 }}>
            {this.state.error?.message || 'An unexpected error occurred while rendering the transcript.'}
          </p>
          <button
            type="button"
            className="yt-transcript-btn yt-transcript-btn-primary"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

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
      <PanelErrorBoundary>
        <Transcript />
      </PanelErrorBoundary>
    </div>
  )
}

