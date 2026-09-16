// Cadence - Background Service Worker
// Handles batch translation requests via Google Translate GTX API without CORS issues

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
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
