const themeButtons = document.querySelectorAll(".themeToggle")

if (localStorage.getItem("theme") === "dark") {
  document.body.classList.add("dark")
}

themeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    document.body.classList.toggle("dark")
    const isDark = document.body.classList.contains("dark")
    localStorage.setItem("theme", isDark ? "dark" : "light")
  })
})

// ============================================================================
// SMART SEARCH + SUGGESTIONS + FILTERED RESULTS FEATURE
// ============================================================================

/**
 * SEARCH INDEX BUILDING
 * Scans page content once on load and builds a searchable index
 */
let searchIndex = []
let shortsIndex = []
let topicsList = []

function buildSearchIndex() {
  // Index all video cards
  const videos = document.querySelectorAll('.video')
  searchIndex = Array.from(videos).map(video => {
    const titleEl = video.querySelector('.title-row p')
    const channelEl = video.querySelector('.posted-by span')
    const viewsDateEl = video.querySelector('.views-date')
    
    const title = titleEl ? titleEl.textContent.trim() : ''
    const channel = channelEl ? channelEl.textContent.trim() : ''
    const meta = viewsDateEl ? viewsDateEl.textContent.trim() : ''
    
    // Store original HTML for restoration
    const originalTitleHTML = titleEl ? titleEl.innerHTML : ''
    
    // Create normalized search text
    const normalizedText = `${title} ${channel} ${meta}`.toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
    
    return {
      element: video,
      title,
      channel,
      meta,
      normalizedText,
      originalTitleHTML,
      titleElement: titleEl
    }
  })
  
  // Index all shorts
  const shorts = document.querySelectorAll('.short-item')
  shortsIndex = Array.from(shorts).map(short => {
    const titleEl = short.querySelector('.short-title')
    const title = titleEl ? titleEl.textContent.trim() : ''
    const normalizedText = title.toLowerCase().replace(/\s+/g, ' ').trim()
    return {
      element: short,
      title,
      normalizedText,
      titleElement: titleEl,
      originalTitleHTML: titleEl ? titleEl.innerHTML : ''
    }
  })
  
  // Index topics
  const topics = document.querySelectorAll('.topic')
  topicsList = Array.from(topics).map(topic => ({
    text: topic.textContent.trim(),
    normalizedText: topic.textContent.trim().toLowerCase().replace(/\s+/g, ' ').trim(),
    element: topic
  }))
}

// ============================================================================
// SUGGESTIONS DROPDOWN
// ============================================================================

let suggestionsDropdown = null
let activeSuggestionIndex = -1
let debounceTimer = null

function createSuggestionsDropdown() {
  const dropdown = document.createElement('div')
  dropdown.className = 'search-suggestions'
  dropdown.setAttribute('role', 'listbox')
  dropdown.setAttribute('aria-label', 'Search suggestions')
  return dropdown
}

function highlightText(text, query) {
  if (!query) return text
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  return text.replace(regex, '<mark class="suggestion-highlight">$1</mark>')
}

function getSuggestions(query) {
  if (!query || query.trim().length === 0) return []
  
  const normalizedQuery = query.toLowerCase().trim()
  const suggestions = []
  
  // Priority 1: Title matches
  searchIndex.forEach(item => {
    if (item.normalizedText.includes(normalizedQuery)) {
      const matchType = item.title.toLowerCase().includes(normalizedQuery) ? 'title' : 'channel'
      suggestions.push({
        text: matchType === 'title' ? item.title : item.channel,
        query: normalizedQuery,
        type: matchType === 'title' ? 'Video title' : 'Channel',
        action: () => performSearch(query)
      })
    }
  })
  
  // Priority 2: Channel matches (if not already added)
  searchIndex.forEach(item => {
    if (item.channel.toLowerCase().includes(normalizedQuery)) {
      const exists = suggestions.some(s => s.text === item.channel && s.type === 'Channel')
      if (!exists) {
        suggestions.push({
          text: item.channel,
          query: normalizedQuery,
          type: 'Channel',
          action: () => performSearch(query)
        })
      }
    }
  })
  
  // Priority 3: Topic matches
  topicsList.forEach(topic => {
    if (topic.normalizedText.includes(normalizedQuery)) {
      suggestions.push({
        text: topic.text,
        query: normalizedQuery,
        type: 'Topic',
        action: () => performSearch(query)
      })
    }
  })
  
  // Remove duplicates and limit to 8
  const unique = []
  const seen = new Set()
  for (const sug of suggestions) {
    const key = `${sug.text}|${sug.type}`
    if (!seen.has(key) && unique.length < 8) {
      seen.add(key)
      unique.push(sug)
    }
  }
  
  return unique
}

function renderSuggestions(query, inputElement) {
  const suggestions = getSuggestions(query)
  
  // Find the form that owns this input
  const form = inputElement?.closest('form')
  if (!form) return
  
  // Create or get dropdown for this specific form
  let dropdown = form.querySelector('.search-suggestions')
  if (!dropdown) {
    dropdown = createSuggestionsDropdown()
    form.appendChild(dropdown)
  }
  
  // Update global reference to current active dropdown
  suggestionsDropdown = dropdown
  
  dropdown.innerHTML = ''
  activeSuggestionIndex = -1
  
  if (suggestions.length === 0) {
    dropdown.style.display = 'none'
    return
  }
  
  dropdown.style.display = 'block'
  
  suggestions.forEach((suggestion, index) => {
    const item = document.createElement('div')
    item.className = 'suggestion-item'
    item.setAttribute('role', 'option')
    item.setAttribute('data-index', index)
    item.tabIndex = 0
    
    item.innerHTML = `
      <i class="material-icons">search</i>
      <span class="suggestion-text">${highlightText(suggestion.text, suggestion.query)}</span>
      <span class="suggestion-type">${suggestion.type}</span>
    `
    
    item.addEventListener('click', () => {
      suggestion.action()
      hideSuggestions()
    })
    
    item.addEventListener('mouseenter', () => {
      setActiveSuggestion(index)
    })
    
    dropdown.appendChild(item)
  })
}

function setActiveSuggestion(index) {
  const items = suggestionsDropdown.querySelectorAll('.suggestion-item')
  items.forEach((item, i) => {
    item.classList.toggle('active', i === index)
  })
  activeSuggestionIndex = index
}

function hideSuggestions() {
  const dropdowns = document.querySelectorAll('.search-suggestions')
  dropdowns.forEach(dropdown => {
    dropdown.style.display = 'none'
  })
  activeSuggestionIndex = -1
}

function handleSuggestionNavigation(direction) {
  if (!suggestionsDropdown) return
  const items = suggestionsDropdown.querySelectorAll('.suggestion-item')
  if (!items || items.length === 0) return
  
  if (direction === 'down') {
    activeSuggestionIndex = (activeSuggestionIndex + 1) % items.length
  } else if (direction === 'up') {
    activeSuggestionIndex = activeSuggestionIndex <= 0 ? items.length - 1 : activeSuggestionIndex - 1
  }
  
  setActiveSuggestion(activeSuggestionIndex)
  items[activeSuggestionIndex]?.scrollIntoView({ block: 'nearest' })
}

function selectActiveSuggestion() {
  if (!suggestionsDropdown) return
  const items = suggestionsDropdown.querySelectorAll('.suggestion-item')
  if (items && activeSuggestionIndex >= 0 && activeSuggestionIndex < items.length) {
    items[activeSuggestionIndex].click()
  }
}

// ============================================================================
// SEARCH INPUT HANDLING
// ============================================================================

let currentSearchQuery = ''
let resultsStatusEl = null

/**
 * Sets up event handlers for a search form (idempotent)
 * @param {HTMLElement} formEl - The form element to set up
 */
function setupSearchForm(formEl) {
  if (!formEl) return
  
  // Check if already bound (idempotent)
  if (formEl.dataset.searchBound === 'true') return
  
  const input = formEl.querySelector('input')
  if (!input) return
  
  // Mark as bound
  formEl.dataset.searchBound = 'true'
  
  // Input event with debounce
  input.addEventListener('input', (e) => {
    const query = e.target.value.trim()
    
    if (query.length === 0) {
      hideSuggestions()
      clearSearch()
    }
    
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      if (query.length > 0) {
        renderSuggestions(query, input)
      } else {
        hideSuggestions()
      }
    }, 150)
  })
  
  // Focus event
  input.addEventListener('focus', () => {
    const query = input.value.trim()
    if (query.length > 0) {
      renderSuggestions(query, input)
    }
  })
  
  // Keyboard navigation
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const form = input.closest('form')
      const currentDropdown = form?.querySelector('.search-suggestions')
      if (currentDropdown?.style.display === 'block') {
        suggestionsDropdown = currentDropdown
        handleSuggestionNavigation('down')
      } else {
        const query = input.value.trim()
        if (query.length > 0) {
          renderSuggestions(query, input)
        }
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const form = input.closest('form')
      const currentDropdown = form?.querySelector('.search-suggestions')
      if (currentDropdown?.style.display === 'block') {
        suggestionsDropdown = currentDropdown
        handleSuggestionNavigation('up')
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const form = input.closest('form')
      const currentDropdown = form?.querySelector('.search-suggestions')
      if (currentDropdown?.style.display === 'block' && activeSuggestionIndex >= 0) {
        suggestionsDropdown = currentDropdown
        selectActiveSuggestion()
      } else {
        performSearch(input.value.trim())
      }
    } else if (e.key === 'Escape') {
      hideSuggestions()
      input.blur()
    }
  })
  
  // Form submit handler
  formEl.addEventListener('submit', (e) => {
    e.preventDefault()
    const query = input.value.trim()
    if (query) {
      performSearch(query)
      hideSuggestions()
      // Close mobile search if this is the mobile form
      if (formEl.classList.contains('mobile-search')) {
        closeMobileSearch()
      }
    }
  })
  
  // Click outside to close (set up once globally)
  if (!window.searchClickHandlerSet) {
    document.addEventListener('click', (e) => {
      const clickedInSearch = e.target.closest('.search, .mobile-search')
      if (!clickedInSearch) {
        hideSuggestions()
      }
    })
    window.searchClickHandlerSet = true
  }
}

function initializeSearchInput() {
  // Set up desktop search form (if it exists)
  const desktopForm = document.querySelector('form.search')
  if (desktopForm) {
    setupSearchForm(desktopForm)
  }
  
  // Do NOT set up mobile form here - it doesn't exist yet
  // It will be set up when createMobileSearchOverlay() is called
}

// ============================================================================
// FILTERING AND HIGHLIGHTING
// ============================================================================

function highlightMatch(text, query) {
  if (!query) return text
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  return text.replace(regex, '<mark class="hl">$1</mark>')
}

function performSearch(query) {
  currentSearchQuery = query
  localStorage.setItem('lastSearch', query)
  
  const normalizedQuery = query.toLowerCase().trim()
  
  if (!normalizedQuery) {
    clearSearch()
    return
  }
  
  // Filter videos
  let visibleCount = 0
  searchIndex.forEach(item => {
    const matches = item.normalizedText.includes(normalizedQuery)
    item.element.style.display = matches ? '' : 'none'
    
    if (matches) {
      visibleCount++
      // Highlight title
      if (item.titleElement && item.title.toLowerCase().includes(normalizedQuery)) {
        item.titleElement.innerHTML = highlightMatch(item.title, normalizedQuery)
      }
    } else {
      // Restore original if hidden
      if (item.titleElement) {
        item.titleElement.innerHTML = item.originalTitleHTML
      }
    }
  })
  
  // Filter shorts
  let shortsVisibleCount = 0
  const shortsShelf = document.querySelector('.shorts-shelf')
  
  shortsIndex.forEach(short => {
    const matches = short.normalizedText.includes(normalizedQuery)
    short.element.style.display = matches ? '' : 'none'
    if (matches) {
      shortsVisibleCount++
      // Highlight short title
      if (short.titleElement && short.title.toLowerCase().includes(normalizedQuery)) {
        short.titleElement.innerHTML = highlightMatch(short.title, normalizedQuery)
      }
    } else {
      if (short.titleElement) {
        short.titleElement.innerHTML = short.originalTitleHTML
      }
    }
  })
  
  // Hide shorts shelf if no matches
  if (shortsShelf) {
    if (shortsVisibleCount === 0) {
      shortsShelf.style.display = 'none'
    } else {
      shortsShelf.style.display = ''
    }
  }
  
  // Show results status
  showResultsStatus(visibleCount, query)
  
  // Update all search inputs (safely handle both desktop and mobile)
  const allSearchInputs = document.querySelectorAll('.search input, .mobile-search input')
  allSearchInputs.forEach(input => {
    if (input) input.value = query
  })
  
  // Close mobile search if open
  closeMobileSearch()
}

function clearSearch() {
  currentSearchQuery = ''
  localStorage.removeItem('lastSearch')
  
  // Show all videos
  searchIndex.forEach(item => {
    item.element.style.display = ''
    if (item.titleElement) {
      item.titleElement.innerHTML = item.originalTitleHTML
    }
  })
  
  // Show all shorts
  shortsIndex.forEach(short => {
    short.element.style.display = ''
    if (short.titleElement) {
      short.titleElement.innerHTML = short.originalTitleHTML
    }
  })
  
  const shortsShelf = document.querySelector('.shorts-shelf')
  if (shortsShelf) {
    shortsShelf.style.display = ''
  }
  
  // Hide results status
  hideResultsStatus()
  
  // Clear all search inputs (safely handle both desktop and mobile)
  const allSearchInputs = document.querySelectorAll('.search input, .mobile-search input')
  allSearchInputs.forEach(input => {
    if (input) input.value = ''
  })
}

function showResultsStatus(count, query) {
  if (!resultsStatusEl) {
    resultsStatusEl = document.createElement('div')
    resultsStatusEl.className = 'search-results-status'
    const videoGrid = document.querySelector('.video-grid')
    if (videoGrid && videoGrid.parentNode) {
      videoGrid.parentNode.insertBefore(resultsStatusEl, videoGrid)
    }
  }
  
  resultsStatusEl.textContent = `Results: ${count} video${count !== 1 ? 's' : ''} found for '${query}'`
  resultsStatusEl.style.display = 'block'
}

function hideResultsStatus() {
  if (resultsStatusEl) {
    resultsStatusEl.style.display = 'none'
  }
}

// ============================================================================
// MOBILE SEARCH OVERLAY
// ============================================================================

function createMobileSearchOverlay() {
  const overlay = document.createElement('div')
  overlay.className = 'mobile-search-overlay'
  overlay.innerHTML = `
    <div class="mobile-search-header">
      <button class="mobile-search-back" type="button" aria-label="Close search">
        <i class="material-icons">arrow_back</i>
      </button>
      <form class="mobile-search">
        <input type="text" placeholder="Search" autocomplete="off">
        <button type="submit"><i class="material-icons">search</i></button>
      </form>
    </div>
  `
  
  document.body.appendChild(overlay)
  
  // Set up the mobile search form with all event handlers
  const mobileForm = overlay.querySelector('form.mobile-search')
  if (mobileForm) {
    setupSearchForm(mobileForm)
  }
  
  // Close button
  overlay.querySelector('.mobile-search-back').addEventListener('click', closeMobileSearch)
  
  // Close on overlay click (outside form)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeMobileSearch()
    }
  })
  
  return overlay
}

let mobileSearchOverlay = null

function openMobileSearch() {
  if (!mobileSearchOverlay) {
    mobileSearchOverlay = createMobileSearchOverlay()
  }
  mobileSearchOverlay.classList.add('active')
  const input = mobileSearchOverlay.querySelector('input')
  if (input) {
    setTimeout(() => input.focus(), 100)
  }
}

function closeMobileSearch() {
  if (mobileSearchOverlay) {
    mobileSearchOverlay.classList.remove('active')
    hideSuggestions()
  }
}

// ============================================================================
// LAST SEARCH CHIP
// ============================================================================

function createLastSearchChip() {
  const lastSearch = localStorage.getItem('lastSearch')
  if (!lastSearch || lastSearch.trim() === '') return
  
  const topicsWrap = document.querySelector('.topics-wrap')
  if (!topicsWrap) return
  
  const chip = document.createElement('button')
  chip.className = 'last-search-chip topic act'
  chip.innerHTML = `
    <span>Last search: ${lastSearch}</span>
    <i class="material-icons">close</i>
  `
  
  chip.addEventListener('click', (e) => {
    if (e.target.closest('.material-icons')) {
      // Dismiss chip
      chip.remove()
      localStorage.removeItem('lastSearch')
    } else {
      // Apply search
      performSearch(lastSearch)
      const searchInput = document.querySelector('.search input')
      if (searchInput) searchInput.value = lastSearch
    }
  })
  
  const topics = topicsWrap.querySelector('.topics')
  if (topics) {
    topics.insertBefore(chip, topics.firstChild)
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
  // Build search index
  buildSearchIndex()
  
  // Initialize search input
  initializeSearchInput()
  
  // Mobile search toggle
  const searchToggle = document.querySelector('.search-toggle')
  if (searchToggle) {
    searchToggle.addEventListener('click', openMobileSearch)
  }
  
  // Create last search chip if exists
  createLastSearchChip()
  
  // Restore last search if exists
  const lastSearch = localStorage.getItem('lastSearch')
  if (lastSearch && lastSearch.trim()) {
    const searchInput = document.querySelector('.search input')
    if (searchInput) {
      searchInput.value = lastSearch
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}