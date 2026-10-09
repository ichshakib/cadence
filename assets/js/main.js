/**
 * Cadence - Official Showcase Website Logic
 * Handles interactive mobile drawer navigation, scroll locking, FAQ accordion, smooth scrolling, and UI toast notifications.
 */

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu()
  initFaqAccordion()
  initSmoothScroll()
})

/**
 * Responsive Mobile Navigation Drawer with Strict Background Scroll Lock
 */
function initMobileMenu() {
  const toggleBtn = document.getElementById('mobile-menu-toggle')
  const drawer = document.getElementById('mobile-nav-drawer')
  const backdrop = document.getElementById('mobile-nav-backdrop')
  const closeBtn = document.getElementById('mobile-nav-close')
  const navLinks = drawer ? drawer.querySelectorAll('.mobile-nav-link, .mobile-cta-btn') : []

  if (!toggleBtn || !drawer || !backdrop) return

  let savedScrollY = 0

  function lockBodyScroll() {
    savedScrollY = window.pageYOffset || document.documentElement.scrollTop || 0
    document.documentElement.classList.add('menu-open')
    document.body.classList.add('menu-open')
    document.body.style.position = 'fixed'
    document.body.style.top = `-${savedScrollY}px`
    document.body.style.left = '0'
    document.body.style.right = '0'
    document.body.style.width = '100%'
  }

  function unlockBodyScroll() {
    document.documentElement.classList.remove('menu-open')
    document.body.classList.remove('menu-open')
    document.body.style.position = ''
    document.body.style.top = ''
    document.body.style.left = ''
    document.body.style.right = ''
    document.body.style.width = ''
    window.scrollTo(0, savedScrollY)
  }

  function openMenu() {
    drawer.classList.add('is-open')
    backdrop.classList.add('is-open')
    toggleBtn.classList.add('is-active')
    toggleBtn.setAttribute('aria-expanded', 'true')
    drawer.setAttribute('aria-hidden', 'false')
    lockBodyScroll()
  }

  function closeMenu() {
    drawer.classList.remove('is-open')
    backdrop.classList.remove('is-open')
    toggleBtn.classList.remove('is-active')
    toggleBtn.setAttribute('aria-expanded', 'false')
    drawer.setAttribute('aria-hidden', 'true')
    unlockBodyScroll()
  }

  toggleBtn.addEventListener('click', () => {
    const isOpen = drawer.classList.contains('is-open')
    if (isOpen) {
      closeMenu()
    } else {
      openMenu()
    }
  })

  if (closeBtn) {
    closeBtn.addEventListener('click', closeMenu)
  }

  backdrop.addEventListener('click', closeMenu)

  // Prevent background touch scrolling on backdrop
  backdrop.addEventListener(
    'touchmove',
    (e) => {
      e.preventDefault()
    },
    { passive: false }
  )

  backdrop.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault()
    },
    { passive: false }
  )

  // Prevent touchmove events outside the drawer while open
  document.addEventListener(
    'touchmove',
    (e) => {
      if (drawer.classList.contains('is-open') && !drawer.contains(e.target)) {
        e.preventDefault()
      }
    },
    { passive: false }
  )

  // Close when pressing Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.classList.contains('is-open')) {
      closeMenu()
    }
  })

  // Close when any mobile navigation link is clicked
  navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      closeMenu()
    })
  })

  // Close menu on resize if viewport expands beyond tablet/mobile breakpoint
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768 && drawer.classList.contains('is-open')) {
      closeMenu()
    }
  })
}

/**
 * FAQ Accordion Interaction
 */
function initFaqAccordion() {
  const faqItems = document.querySelectorAll('.faq-item')
  faqItems.forEach((item) => {
    const questionBtn = item.querySelector('.faq-question-btn')
    if (!questionBtn) return

    questionBtn.addEventListener('click', () => {
      const isOpen = item.classList.contains('open')
      // Close other items
      faqItems.forEach((other) => {
        other.classList.remove('open')
        const btn = other.querySelector('.faq-question-btn')
        if (btn) btn.setAttribute('aria-expanded', 'false')
      })
      // Toggle current
      if (!isOpen) {
        item.classList.add('open')
        questionBtn.setAttribute('aria-expanded', 'true')
      }
    })
  })
}

/**
 * Smooth scrolling for internal anchor links with sticky header compensation
 */
function initSmoothScroll() {
  const links = document.querySelectorAll('a[href^="#"]')
  links.forEach((link) => {
    link.addEventListener('click', (e) => {
      const targetId = link.getAttribute('href')
      if (targetId && targetId !== '#') {
        const targetEl = document.querySelector(targetId)
        if (targetEl) {
          e.preventDefault()
          targetEl.scrollIntoView({ behavior: 'smooth' })
          targetEl.setAttribute('tabindex', '-1')
          targetEl.focus({ preventScroll: true })
        }
      } else if (targetId === '#') {
        e.preventDefault()
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    })
  })
}

/**
 * Toast Notification Helper
 */
function showToast(message) {
  let toast = document.getElementById('cadence-toast')
  if (!toast) {
    toast = document.createElement('div')
    toast.id = 'cadence-toast'
    toast.className = 'cadence-toast'
    document.body.appendChild(toast)
  }

  toast.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
    <span>${message}</span>
  `

  toast.classList.add('visible')
  toast.classList.add('show')
  setTimeout(() => {
    toast.classList.remove('visible')
    toast.classList.remove('show')
  }, 2800)
}
