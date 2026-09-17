/**
 * Cadence - Official Showcase Website Logic
 * Handles interactive FAQ accordion, smooth scrolling, and UI toast notifications.
 */

document.addEventListener('DOMContentLoaded', () => {
  initFaqAccordion()
  initSmoothScroll()
})

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
      faqItems.forEach((other) => other.classList.remove('open'))
      // Toggle current
      if (!isOpen) {
        item.classList.add('open')
      }
    })
  })
}

/**
 * Smooth scrolling for internal anchor links
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
        }
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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
    <span>${message}</span>
  `

  toast.classList.add('visible')
  setTimeout(() => {
    toast.classList.remove('visible')
  }, 2800)
}
