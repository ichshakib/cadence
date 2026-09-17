// Cadence - Background Service Worker
// Handles batch translation requests via Google Translate GTX API without CORS issues

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Extract YouTube player response directly from MAIN world via chrome.scripting
  if (request.action === 'GET_PLAYER_DATA') {
    const tabId = sender.tab?.id
    if (!tabId) {
      sendResponse({ success: false, error: 'No active tab ID found' })
      return false
    }

    chrome.scripting
      .executeScript({
        target: { tabId },
        world: 'MAIN',
        func: () => {
          try {
            const win = window as any
            const player = document.getElementById('movie_player') as any
            const playerResponse =
              (typeof player?.getPlayerResponse === 'function' ? player.getPlayerResponse() : null) ||
              win.ytInitialPlayerResponse ||
              null

            const captions = playerResponse?.captions?.playerCaptionsTracklistRenderer
            let captionTracks = captions?.captionTracks || []
            const translationLanguages = captions?.translationLanguages || []
            const videoDetails = playerResponse?.videoDetails || {}

            // If playerResponse captionTracks is missing, try player.getOption('captions', 'tracklist')
            if ((!captionTracks || captionTracks.length === 0) && typeof player?.getOption === 'function') {
              try {
                const tracklist = player.getOption('captions', 'tracklist')
                if (Array.isArray(tracklist) && tracklist.length > 0) {
                  captionTracks = tracklist.map((t: any) => ({
                    baseUrl: t.url || t.baseUrl,
                    name: { simpleText: t.displayName || t.name || t.languageCode },
                    vssId: t.vss_id || t.vssId,
                    languageCode: t.languageCode || t.lang,
                    kind: t.kind,
                    isTranslatable: t.is_translatable ?? true,
                  }))
                }
              } catch {}
            }

            return {
              success: true,
              captionTracks,
              translationLanguages,
              title: videoDetails.title || document.title,
              videoId: videoDetails.videoId || '',
            }
          } catch (err: any) {
            return {
              success: false,
              error: err?.message || String(err),
            }
          }
        },
      })
      .then((results) => {
        const result = results[0]?.result
        if (result && result.success) {
          sendResponse(result)
        } else {
          sendResponse({ success: false, error: result?.error || 'Failed to inspect player data' })
        }
      })
      .catch((err) => {
        sendResponse({ success: false, error: err.message })
      })

    return true
  }

  // Fetch timedtext within page's MAIN world session & cookies via chrome.scripting
  if (request.action === 'FETCH_TIMEDTEXT') {
    const tabId = sender.tab?.id
    const url = request.url
    if (!tabId || !url) {
      sendResponse({ success: false, error: 'Missing tab ID or URL' })
      return false
    }

    chrome.scripting
      .executeScript({
        target: { tabId },
        world: 'MAIN',
        args: [url],
        func: async (trackUrl: string) => {
          try {
            const res = await fetch(trackUrl, { credentials: 'include' })
            const text = await res.text()
            return {
              success: res.ok && text.length > 0,
              status: res.status,
              text,
            }
          } catch (err: any) {
            return {
              success: false,
              error: err?.message || String(err),
            }
          }
        },
      })
      .then((results) => {
        const result = results[0]?.result
        sendResponse(result || { success: false, error: 'No response from main world' })
      })
      .catch((err) => {
        sendResponse({ success: false, error: err.message })
      })

    return true
  }

  // Translates the entire transcript in a single HTTP request using batch delimiter
  if (request.action === 'TRANSLATE_ALL' || request.action === 'TRANSLATE_BATCH') {
    const { texts, sourceLang = 'auto', targetLang = 'en' } = request
    if (!Array.isArray(texts) || texts.length === 0) {
      sendResponse({ success: true, translatedTexts: [], detectedSource: sourceLang })
      return false
    }

    const DELIMITER = '\n___§___\n'
    const combined = texts.join(DELIMITER)

    fetch('https://translate.googleapis.com/translate_a/single', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client: 'gtx',
        sl: sourceLang,
        tl: targetLang,
        dt: 't',
        q: combined,
      }),
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Translation request failed (HTTP ${res.status})`)
        }
        return res.json()
      })
      .then((data) => {
        const fullTranslated = Array.isArray(data[0])
          ? data[0].map((item: any) => item[0] || '').join('')
          : ''
        const detectedSource = data[2] || sourceLang
        const parts = fullTranslated.split(/___§___/i).map((s) => s.trim())

        sendResponse({
          success: true,
          translatedTexts: parts,
          detectedSource,
        })
      })
      .catch((err) => {
        sendResponse({ success: false, error: err.message })
      })

    return true // Keep message port open for async response
  }

  // Single text translation fallback
  if (request.action === 'TRANSLATE_TEXT') {
    const { text, sourceLang = 'auto', targetLang = 'en' } = request
    fetch('https://translate.googleapis.com/translate_a/single', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client: 'gtx',
        sl: sourceLang,
        tl: targetLang,
        dt: 't',
        q: text,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => {
        const translatedText = Array.isArray(data[0])
          ? data[0].map((item: any) => item[0] || '').join('')
          : ''
        const detectedSource = data[2] || sourceLang
        sendResponse({ success: true, translatedText, detectedSource })
      })
      .catch((err) => {
        sendResponse({ success: false, error: err.message })
      })

    return true
  }
})
