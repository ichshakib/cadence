/**
 * Cadence - Official Showcase Website Logic
 * Handles interactive demo playback, language switcher, real-time search,
 * clipboard export, and FAQ accordions.
 */

// Sample Demo Transcript with Bilingual Translations
const DEMO_TRANSCRIPT = [
  {
    start: 4,
    formatted: '00:04',
    original: 'Welcome back everyone. Today we are exploring modern speech AI.',
    translations: {
      es: 'Bienvenidos a todos. Hoy estamos explorando la IA del habla moderna.',
      fr: 'Bienvenue à tous. Aujourd\'hui, nous explorons l\'IA vocale moderne.',
      de: 'Willkommen zurück allerseits. Heute erkunden wir moderne Sprach-KI.',
      ja: '皆さん、お帰りなさい。今日は最新の音声AIを探求します。',
      ko: '모두 환영합니다. 오늘은 최신 음성 AI를 살펴봅니다.',
      bn: 'সবাইকে স্বাগতম। আজ আমরা আধুনিক স্পিচ এআই অন্বেষণ করছি।',
      zh: '欢迎大家回来。今天我们将探讨现代语音人工智能。',
    },
  },
  {
    start: 12,
    formatted: '00:12',
    original: 'Understanding speech cadence and acoustic rhythm is crucial for natural conversation.',
    translations: {
      es: 'Comprender la cadencia del habla y el ritmo acústico es crucial para una conversación natural.',
      fr: 'Comprendre la cadence de la parole et le rythme acoustique est crucial pour une conversation naturelle.',
      de: 'Das Verständnis von Sprachkadenz und akustischem Rhythmus ist entscheidend für natürliche Konversation.',
      ja: '自然な会話には、音声の抑揚と音響リズムを理解することが極めて重要です。',
      ko: '자연스러운 대화를 위해서는 말의 리듬과 음향적 흐름을 이해하는 것이 매우 중요합니다.',
      bn: 'স্বাভাবিক কথোপকথনের জন্য বক্তব্যের তাল এবং ধ্বনিগত ছন্দ বোঝা অত্যন্ত জরুরি।',
      zh: '理解语音节奏和声学韵律对于自然对话至关重要。',
    },
  },
  {
    start: 21,
    formatted: '00:21',
    original: 'Cadence displays synchronized bilingual subtitles directly on your YouTube video player.',
    translations: {
      es: 'Cadence muestra subtítulos bilingües sincronizados directamente en tu reproductor de YouTube.',
      fr: 'Cadence affiche des sous-titres bilingues synchronisés directement sur votre lecteur YouTube.',
      de: 'Cadence zeigt synchronisierte zweisprachige Untertitel direkt auf Ihrem YouTube-Videoplayer an.',
      ja: 'CadenceはYouTube動画プレーヤー上に直接、同期されたバイリンガル字幕を表示します。',
      ko: 'Cadence는 YouTube 비디오 플레이어에 직접 동기화된 이중 자막을 표시합니다.',
      bn: 'Cadence সরাসরি আপনার YouTube ভিডিও প্লেয়ারে সমন্বিত দ্বিভাষিক সাবটাইটেল প্রদর্শন করে।',
      zh: 'Cadence 直接在 YouTube 视频播放器上显示同步的双语字幕。',
    },
  },
  {
    start: 32,
    formatted: '00:32',
    original: 'You can follow both the original transcript and your native translation simultaneously.',
    translations: {
      es: 'Puedes seguir tanto la transcripción original como tu traducción simultáneamente.',
      fr: 'Vous pouvez suivre à la fois la transcription originale et votre traduction simultanément.',
      de: 'Sie können sowohl das Originaltranskript als auch Ihre Übersetzung gleichzeitig verfolgen.',
      ja: 'オリジナルの文字起こしとお好みの翻訳を同時に追うことができます。',
      ko: '원문 스크립트와 모국어 번역을 동시에 확인할 수 있습니다.',
      bn: 'আপনি একই সাথে মূল ট্রান্সক্রিপ্ট এবং আপনার মাতৃভাষার অনুবাদ অনুসরণ করতে পারেন।',
      zh: '你可以同时查看原始文字记录和你的母语翻译。',
    },
  },
  {
    start: 43,
    formatted: '00:43',
    original: 'Clicking any timestamp jumps video playback immediately to that exact scene.',
    translations: {
      es: 'Al hacer clic en cualquier marca de tiempo, la reproducción salta a esa escena exacta.',
      fr: 'Cliquer sur un horodatage saute instantanément la lecture à cette scène exacte.',
      de: 'Ein Klick auf einen Zeitstempel springt sofort zu genau dieser Szene.',
      ja: '任意のタイムスタンプをクリックすると、そのシーンへ即座にジャンプします。',
      ko: '타임스탬프를 클릭하면 해당 장면으로 영상 재생이 즉시 이동합니다.',
      bn: 'যেকোনো টাইমস্ট্যাম্পে ক্লিক করলে ভিডিও প্লেব্যাক সঙ্গে সঙ্গে সেই দৃশ্যে চলে যায়।',
      zh: '点击任何时间戳均可让视频播放立即跳转到该精确片段。',
    },
  },
  {
    start: 55,
    formatted: '00:55',
    original: 'And you can filter through hundreds of dialogue lines in milliseconds with instant search.',
    translations: {
      es: 'Y puedes filtrar cientos de líneas de diálogo en milisegundos con búsqueda instantánea.',
      fr: 'Et vous pouvez filtrer des centaines de répliques en quelques millisecondes.',
      de: 'Und Sie können mit der Sofortsuche Hunderte von Dialogzeilen in Millisekunden durchsuchen.',
      ja: 'さらにインスタント検索で、数百行の対話をミリ秒単位で絞り込むことができます。',
      ko: '또한 실시간 검색으로 수백 줄의 대화를 몇 밀리초 만에 필터링할 수 있습니다.',
      bn: 'এবং তাত্ক্ষণিক অনুসন্ধানের মাধ্যমে আপনি মিলিসেকেন্ডে শত শত সংলাপের লাইন অনুসন্ধান করতে পারেন।',
      zh: '你还可以通过即时搜索在几毫秒内筛选数百行对话内容。',
    },
  },
]

const TOTAL_DEMO_DURATION = 65

// State
let activeIndex = 0
let currentLang = 'es'
let searchQuery = ''
let isPlaying = false
let playTimer = null

document.addEventListener('DOMContentLoaded', () => {
  initDemo()
  initFaqAccordion()
})

function initDemo() {
  const scrollContainer = document.getElementById('demo-transcript-list')
  const langSelect = document.getElementById('demo-lang-select')
  const searchInput = document.getElementById('demo-search-input')
  const playBtn = document.getElementById('demo-play-btn')
  const copyBtn = document.getElementById('demo-copy-btn')
  const progressTrack = document.getElementById('demo-timeline-track')

  if (!scrollContainer) return

  renderTranscriptList()

  // Language Dropdown Change
  if (langSelect) {
    langSelect.addEventListener('change', (e) => {
      currentLang = e.target.value
      renderTranscriptList()
      updateVideoOverlay()
    })
  }

  // Real-time Search Input
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim().toLowerCase()
      renderTranscriptList()
    })
  }

  // Play / Pause Simulation
  if (playBtn) {
    playBtn.addEventListener('click', togglePlay)
  }

  // Timeline Progress Track Click
  if (progressTrack) {
    progressTrack.addEventListener('click', (e) => {
      const rect = progressTrack.getBoundingClientRect()
      const clickX = e.clientX - rect.left
      const percent = Math.max(0, Math.min(1, clickX / rect.width))
      const targetTime = percent * TOTAL_DEMO_DURATION
      seekToTime(targetTime)
    })
  }

  // Copy Transcript
  if (copyBtn) {
    copyBtn.addEventListener('click', copyTranscript)
  }

  // Toggle On-Video Subtitles Overlay
  const subtitlesToggleBtn = document.getElementById('demo-subtitles-toggle-btn')
  if (subtitlesToggleBtn) {
    subtitlesToggleBtn.addEventListener('click', toggleSubtitlesOverlay)
  }
}

let isSubtitlesOverlayOn = true

function toggleSubtitlesOverlay() {
  isSubtitlesOverlayOn = !isSubtitlesOverlayOn
  const btn = document.getElementById('demo-subtitles-toggle-btn')
  const overlay = document.getElementById('demo-subtitles-overlay')

  if (btn) {
    if (isSubtitlesOverlayOn) {
      btn.classList.add('active')
      btn.title = 'On-Video Subtitles: ON (Click to hide)'
    } else {
      btn.classList.remove('active')
      btn.title = 'On-Video Subtitles: OFF (Click to show)'
    }
  }

  if (overlay) {
    overlay.style.display = isSubtitlesOverlayOn ? 'inline-flex' : 'none'
  }

  showToast(isSubtitlesOverlayOn ? 'On-Video Subtitles enabled' : 'On-Video Subtitles hidden')
}

function renderTranscriptList() {
  const container = document.getElementById('demo-transcript-list')
  if (!container) return

  container.innerHTML = ''

  const filtered = DEMO_TRANSCRIPT.filter((item) => {
    if (!searchQuery) return true
    const orig = item.original.toLowerCase()
    const trans = (item.translations[currentLang] || '').toLowerCase()
    return orig.includes(searchQuery) || trans.includes(searchQuery)
  })

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: var(--text-muted); font-size: 0.9rem;">
        No lines matching "${searchQuery}"
      </div>
    `
    return
  }

  filtered.forEach((item) => {
    const originalIndex = DEMO_TRANSCRIPT.indexOf(item)
    const isActive = originalIndex === activeIndex

    const row = document.createElement('div')
    row.className = `transcript-row-item ${isActive ? 'active' : ''}`
    row.setAttribute('data-index', originalIndex)

    const translatedText = item.translations[currentLang] || item.original

    row.innerHTML = `
      <span class="transcript-row-timestamp">${item.formatted}</span>
      <div class="transcript-row-content">
        <div class="transcript-text-original">${highlightText(item.original, searchQuery)}</div>
        <div class="transcript-text-translated">
          <span class="transcript-arrow-icon">↳</span>
          <span>${highlightText(translatedText, searchQuery)}</span>
        </div>
      </div>
    `

    row.addEventListener('click', () => {
      setActiveSegment(originalIndex)
    })

    container.appendChild(row)
  })

  updateVideoOverlay()
}

function highlightText(text, query) {
  if (!query) return text
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  return text.replace(regex, '<mark style="background: rgba(56, 189, 248, 0.35); color: #fff; padding: 0 2px; border-radius: 2px;">$1</mark>')
}

function setActiveSegment(index) {
  activeIndex = index
  const item = DEMO_TRANSCRIPT[index]
  if (!item) return

  // Update progress bar and time display
  const progressFill = document.getElementById('demo-progress-fill')
  const timeDisplay = document.getElementById('demo-time-display')

  const percent = (item.start / TOTAL_DEMO_DURATION) * 100
  if (progressFill) progressFill.style.width = `${percent}%`
  if (timeDisplay) timeDisplay.textContent = `${item.formatted} / 01:05`

  // Re-render highlight classes
  const rows = document.querySelectorAll('.transcript-row-item')
  rows.forEach((r) => {
    const rowIdx = parseInt(r.getAttribute('data-index'), 10)
    if (rowIdx === activeIndex) {
      r.classList.add('active')
      r.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    } else {
      r.classList.remove('active')
    }
  })

  updateVideoOverlay()
}

function updateVideoOverlay() {
  const overlayOrig = document.getElementById('video-sub-orig')
  const overlayTrans = document.getElementById('video-sub-trans')

  const currentItem = DEMO_TRANSCRIPT[activeIndex]
  if (!currentItem) return

  if (overlayOrig) overlayOrig.textContent = currentItem.original
  if (overlayTrans) {
    const text = currentItem.translations[currentLang] || currentItem.original
    overlayTrans.innerHTML = `<span>↳</span> <span>${text}</span>`
  }
}

function seekToTime(seconds) {
  let closestIndex = 0
  for (let i = 0; i < DEMO_TRANSCRIPT.length; i++) {
    if (seconds >= DEMO_TRANSCRIPT[i].start) {
      closestIndex = i
    }
  }
  setActiveSegment(closestIndex)
}

function togglePlay() {
  isPlaying = !isPlaying
  const playBtn = document.getElementById('demo-play-btn')

  if (isPlaying) {
    if (playBtn) {
      playBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="4" width="4" height="16" rx="1"/>
          <rect x="14" y="4" width="4" height="16" rx="1"/>
        </svg>
      `
    }
    playTimer = setInterval(() => {
      let nextIndex = (activeIndex + 1) % DEMO_TRANSCRIPT.length
      setActiveSegment(nextIndex)
    }, 2800)
  } else {
    if (playBtn) {
      playBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
      `
    }
    if (playTimer) clearInterval(playTimer)
  }
}

function copyTranscript() {
  const text = DEMO_TRANSCRIPT.map((item) => {
    const trans = item.translations[currentLang] || item.original
    return `[${item.formatted}] ${item.original}\n   ↳ ${trans}`
  }).join('\n\n')

  navigator.clipboard.writeText(text).then(() => {
    showToast('Bilingual transcript copied to clipboard!')
  }).catch(() => {
    showToast('Transcript copied to clipboard!')
  })
}

function showToast(message) {
  let toast = document.getElementById('cadence-toast')
  if (!toast) {
    toast = document.createElement('div')
    toast.id = 'cadence-toast'
    toast.className = 'cadence-toast'
    document.body.appendChild(toast)
  }

  toast.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
    <span>${message}</span>
  `

  toast.classList.add('visible')
  setTimeout(() => {
    toast.classList.remove('visible')
  }, 2600)
}

function initFaqAccordion() {
  const faqItems = document.querySelectorAll('.faq-item')
  faqItems.forEach((item) => {
    const questionBtn = item.querySelector('.faq-question-btn')
    if (!questionBtn) return

    questionBtn.addEventListener('click', () => {
      const isOpen = item.classList.contains('open')
      // Close other items
      faqItems.forEach((other) => other.classList.remove('open'))
      // Toggle current
      if (!isOpen) {
        item.classList.add('open')
      }
    })
  })
}
