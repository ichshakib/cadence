// Cadence - Page Context Script (runs in MAIN world of YouTube)
// Communicates with Cadence content script via CustomEvents
// Completely avoids clicking any YouTube buttons or opening any native UI panels.

(function () {
  if ((window as any).__cadence_page_context_injected) return
  ;(window as any).__cadence_page_context_injected = true

  // Handle request for YouTube player response data (caption tracks, title, languages)
  window.addEventListener('CADENCE_REQUEST_PLAYER_DATA', () => {
    try {
      const win = window as any
      const player = document.getElementById('movie_player') as any
      const playerResponse =
        (typeof player?.getPlayerResponse === 'function' ? player.getPlayerResponse() : null) ||
        win.ytInitialPlayerResponse ||
        null

      const captions = playerResponse?.captions?.playerCaptionsTracklistRenderer
      const captionTracks = captions?.captionTracks || []
      const translationLanguages = captions?.translationLanguages || []
      const videoDetails = playerResponse?.videoDetails || {}

      window.dispatchEvent(
        new CustomEvent('CADENCE_RESPONSE_PLAYER_DATA', {
          detail: {
            success: true,
            captionTracks,
            translationLanguages,
            title: videoDetails.title || document.title,
            videoId: videoDetails.videoId || '',
          },
        })
      )
    } catch (err: any) {
      window.dispatchEvent(
        new CustomEvent('CADENCE_RESPONSE_PLAYER_DATA', {
          detail: { success: false, error: err?.message || String(err) },
        })
      )
    }
  })

  // Handle fetching timedtext via page context (runs with YouTube's session & origin)
  window.addEventListener('CADENCE_FETCH_TRACK', async (e: any) => {
    const { url, requestId } = e.detail || {}
    if (!url || !requestId) return

    try {
      const res = await fetch(url, { credentials: 'include' })
      const text = await res.text()
      window.dispatchEvent(
        new CustomEvent('CADENCE_FETCH_TRACK_RESPONSE', {
          detail: { requestId, success: res.ok && text.length > 0, status: res.status, text },
        })
      )
    } catch (err: any) {
      window.dispatchEvent(
        new CustomEvent('CADENCE_FETCH_TRACK_RESPONSE', {
          detail: { requestId, success: false, error: err?.message || String(err) },
        })
      )
    }
  })
})()
