// theme change
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

//search
let searchIndex = []
let shortsIndex = []
let topicsList = []

function buildSearchIndex() {
  const videos = document.querySelectorAll('.video')
  searchIndex = Array.from(videos).map(video => {
    const titleEl = video.querySelector('.title-row p')
    const channelEl = video.querySelector('.posted-by span')
    const viewsDateEl = video.querySelector('.views-date')
    const title = titleEl ? titleEl.textContent.trim() : ''
    const channel = channelEl ? channelEl.textContent.trim() : ''
    const meta = viewsDateEl ? viewsDateEl.textContent.trim() : ''
    const originalTitleHTML = titleEl ? titleEl.innerHTML : ''
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

  const topics = document.querySelectorAll('.topic')
  topicsList = Array.from(topics).map(topic => ({
    text: topic.textContent.trim(),
    normalizedText: topic.textContent.trim().toLowerCase().replace(/\s+/g, ' ').trim(),
    element: topic
  }))
}

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
  
  const form = inputElement?.closest('form')
  if (!form) return
  
  let dropdown = form.querySelector('.search-suggestions')
  if (!dropdown) {
    dropdown = createSuggestionsDropdown()
    form.appendChild(dropdown)
  }
  
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

let currentSearchQuery = ''
let resultsStatusEl = null

/**
 * Sets up event handlers for search form
 * @param {HTMLElement} formEl
 */
function setupSearchForm(formEl) {
  if (!formEl) return

  if (formEl.dataset.searchBound === 'true') return
  
  const input = formEl.querySelector('input')
  if (!input) return

  formEl.dataset.searchBound = 'true'
  
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
  
  input.addEventListener('focus', () => {
    const query = input.value.trim()
    if (query.length > 0) {
      renderSuggestions(query, input)
    }
  })

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
  
  formEl.addEventListener('submit', (e) => {
    e.preventDefault()
    const query = input.value.trim()
    if (query) {
      performSearch(query)
      hideSuggestions()
      if (formEl.classList.contains('mobile-search')) {
        closeMobileSearch()
      }
    }
  })
  
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
  const desktopForm = document.querySelector('form.search')
  if (desktopForm) {
    setupSearchForm(desktopForm)
  }

}

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
  
  let visibleCount = 0
  searchIndex.forEach(item => {
    const matches = item.normalizedText.includes(normalizedQuery)
    item.element.style.display = matches ? '' : 'none'
    
    if (matches) {
      visibleCount++
      if (item.titleElement && item.title.toLowerCase().includes(normalizedQuery)) {
        item.titleElement.innerHTML = highlightMatch(item.title, normalizedQuery)
      }
    } else {

      if (item.titleElement) {
        item.titleElement.innerHTML = item.originalTitleHTML
      }
    }
  })
  
  let shortsVisibleCount = 0
  const shortsShelf = document.querySelector('.shorts-shelf')
  
  shortsIndex.forEach(short => {
    const matches = short.normalizedText.includes(normalizedQuery)
    short.element.style.display = matches ? '' : 'none'
    if (matches) {
      shortsVisibleCount++
      if (short.titleElement && short.title.toLowerCase().includes(normalizedQuery)) {
        short.titleElement.innerHTML = highlightMatch(short.title, normalizedQuery)
      }
    } else {
      if (short.titleElement) {
        short.titleElement.innerHTML = short.originalTitleHTML
      }
    }
  })
  
  if (shortsShelf) {
    if (shortsVisibleCount === 0) {
      shortsShelf.style.display = 'none'
    } else {
      shortsShelf.style.display = ''
    }
  }
  
  showResultsStatus(visibleCount, query)
  
  const allSearchInputs = document.querySelectorAll('.search input, .mobile-search input')
  allSearchInputs.forEach(input => {
    if (input) input.value = query
  })
  
  closeMobileSearch()
}

function clearSearch() {
  currentSearchQuery = ''
  localStorage.removeItem('lastSearch')
  
  searchIndex.forEach(item => {
    item.element.style.display = ''
    if (item.titleElement) {
      item.titleElement.innerHTML = item.originalTitleHTML
    }
  })
  
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

  hideResultsStatus()

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
  
  const mobileForm = overlay.querySelector('form.mobile-search')
  if (mobileForm) {
    setupSearchForm(mobileForm)
  }

  overlay.querySelector('.mobile-search-back').addEventListener('click', closeMobileSearch)

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
      chip.remove()
      localStorage.removeItem('lastSearch')
    } else {
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

function init() {
  buildSearchIndex()
  initializeSearchInput()

  const searchToggle = document.querySelector('.search-toggle')
  if (searchToggle) {
    searchToggle.addEventListener('click', openMobileSearch)
  }

  createLastSearchChip()

  const lastSearch = localStorage.getItem('lastSearch')
  if (lastSearch && lastSearch.trim()) {
    const searchInput = document.querySelector('.search input')
    if (searchInput) {
      searchInput.value = lastSearch
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}



// modal and watch progress
(function continueWatchingModalFeature() {
  const STORAGE_KEY = "ytclone_progress_v1";
  const SAVE_EVERY_MS = 2500;

  /** @returns {Record<string, {t:number, d:number, updated:number}>} */
  function loadProgressMap() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveProgressMap(map) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {
    }
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function extractYouTubeIdFromThumbUrl(url) {
    if (!url) return null;
    const m = String(url).match(/i\.ytimg\.com\/vi\/([^/]+)\//i);
    if (m && m[1]) return m[1];
    const m2 = String(url).match(/\/vi\/([^/]+)/i);
    if (m2 && m2[1]) return m2[1];
    return null;
  }

  function ensureProgressBar(containerEl) {
    if (!containerEl) return null;
    let barWrap = containerEl.querySelector(".thumb-progress");
    if (!barWrap) {
      barWrap = document.createElement("div");
      barWrap.className = "thumb-progress";
      barWrap.innerHTML = `<div class="thumb-progress-bar"></div>`;
      containerEl.appendChild(barWrap);
    }
    return barWrap.querySelector(".thumb-progress-bar");
  }

  function setThumbProgress(containerEl, pct) {
    const bar = ensureProgressBar(containerEl);
    if (!bar) return;
    bar.style.width = `${clamp(pct, 0, 100)}%`;
    containerEl.querySelector(".thumb-progress").style.display = pct > 1 ? "" : "none";
  }

  function findCardMeta(cardEl) {
    const titleEl = cardEl.querySelector(".title-row p") || cardEl.querySelector(".short-title");
    const channelEl = cardEl.querySelector(".posted-by span");
    const title = titleEl ? titleEl.textContent.trim() : "Video";
    const channel = channelEl ? channelEl.textContent.trim() : "";
    return { title, channel };
  }

  let overlayEl = null;
  let ytApiReady = false;
  let ytPlayer = null;
  let currentVideoId = null;
  let saveTimer = null;

  function ensureModal() {
    if (overlayEl) return overlayEl;

    overlayEl = document.createElement("div");
    overlayEl.className = "player-modal-overlay";
    overlayEl.innerHTML = `
      <div class="player-modal" role="dialog" aria-modal="true" aria-label="Player">
        <div class="player-modal-header">
          <div class="player-modal-title">
            <h3 id="pm-title">Video</h3>
            <div class="player-meta" id="pm-meta"></div>
          </div>
          <div class="player-modal-actions">
            <button class="pm-btn" type="button" data-action="restart">Start over</button>
            <button class="pm-btn" type="button" data-action="clear">Clear progress</button>
            <button class="player-close" type="button" aria-label="Close">
              <i class="material-icons">close</i>
            </button>
          </div>
        </div>
        <div class="player-modal-body">
          <div id="pm-yt"></div>
        </div>
      </div>
    `;
    document.body.appendChild(overlayEl);

    const closeBtn = overlayEl.querySelector(".player-close");
    closeBtn.addEventListener("click", closeModal);

    overlayEl.addEventListener("click", (e) => {
      if (e.target === overlayEl) closeModal();
    });

    overlayEl.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
      if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        togglePlayPause();
      }
    });

    overlayEl.querySelector('[data-action="restart"]').addEventListener("click", () => {
      if (!currentVideoId) return;
      clearProgress(currentVideoId);
      openModalForVideo(currentVideoId, { start: 0, force: true });
    });

    overlayEl.querySelector('[data-action="clear"]').addEventListener("click", () => {
      if (!currentVideoId) return;
      clearProgress(currentVideoId);
      closeModal();
      refreshAllThumbProgress();
    });

    return overlayEl;
  }

  function loadYouTubeIframeApiOnce() {
    if (window.YT && window.YT.Player) {
      ytApiReady = true;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const existing = document.querySelector('script[data-yt-iframe-api="true"]');
      if (existing) {
        const check = setInterval(() => {
          if (window.YT && window.YT.Player) {
            clearInterval(check);
            ytApiReady = true;
            resolve();
          }
        }, 50);
        return;
      }

      window.onYouTubeIframeAPIReady = function () {
        ytApiReady = true;
        resolve();
      };

      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      tag.async = true;
      tag.defer = true;
      tag.dataset.ytIframeApi = "true";
      document.head.appendChild(tag);

      setTimeout(() => resolve(), 2500);
    });
  }

  function destroyPlayer() {
    if (saveTimer) {
      clearInterval(saveTimer);
      saveTimer = null;
    }
    if (ytPlayer && typeof ytPlayer.destroy === "function") {
      try { ytPlayer.destroy(); } catch {}
    }
    ytPlayer = null;
    currentVideoId = null;
    const mount = document.getElementById("pm-yt");
    if (mount) mount.innerHTML = "";
  }

  function togglePlayPause() {
    if (!ytPlayer || !ytApiReady) return;
    try {
      const state = ytPlayer.getPlayerState();
      if (state === 1) ytPlayer.pauseVideo();
      else ytPlayer.playVideo();
    } catch {
    }
  }

  function closeModal() {
    if (!overlayEl) return;
    overlayEl.classList.remove("active");
    document.body.style.overflow = "";
    destroyPlayer();
  }

  function openModalForVideo(videoId, opts = {}) {
    const { start = null, force = false } = opts;

    const overlay = ensureModal();
    overlay.classList.add("active");
    overlay.tabIndex = -1;
    overlay.focus({ preventScroll: true });
    document.body.style.overflow = "hidden";

    const map = loadProgressMap();
    const saved = map[videoId];
    const startTime = force ? (start ?? 0) : (start ?? (saved?.t ?? 0));

    const anyCard = document.querySelector(`[data-video-id="${CSS.escape(videoId)}"]`);
    const { title, channel } = anyCard ? findCardMeta(anyCard) : { title: "Video", channel: "" };
    overlay.querySelector("#pm-title").textContent = title;
    overlay.querySelector("#pm-meta").textContent = channel ? channel : " ";

    destroyPlayer();
    currentVideoId = videoId;

    loadYouTubeIframeApiOnce().then(() => {
      const mount = document.getElementById("pm-yt");
      if (!mount) return;

      if (!(window.YT && window.YT.Player)) {
        mount.innerHTML = `
          <iframe
            src="https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1&start=${Math.floor(startTime)}&playsinline=1&rel=0"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowfullscreen
          ></iframe>
        `;
        return;
      }

      ytPlayer = new window.YT.Player("pm-yt", {
        videoId,
        playerVars: {
          autoplay: 1,
          start: Math.max(0, Math.floor(startTime)),
          playsinline: 1,
          rel: 0,
          modestbranding: 1
        },
        events: {
          onReady: () => {
            if (saveTimer) clearInterval(saveTimer);
            saveTimer = setInterval(() => saveCurrentProgress(), SAVE_EVERY_MS);
          },
          onStateChange: () => {
            saveCurrentProgress();
          }
        }
      });
    });
  }

  function saveCurrentProgress() {
    if (!ytPlayer || !currentVideoId || !(window.YT && window.YT.Player)) return;

    try {
      const d = ytPlayer.getDuration?.() ?? 0;
      const t = ytPlayer.getCurrentTime?.() ?? 0;
      if (!d || d < 20) return;
      if (t < 2) return;

      const map = loadProgressMap();
      map[currentVideoId] = { t, d, updated: Date.now() };
      saveProgressMap(map);

      refreshThumbProgressForId(currentVideoId, map[currentVideoId]);
    } catch {
    }
  }

  function clearProgress(videoId) {
    const map = loadProgressMap();
    if (map[videoId]) {
      delete map[videoId];
      saveProgressMap(map);
    }
  }


  let moreMenuEl = null;
  let moreMenuForId = null;

  function ensureMoreMenu() {
    if (moreMenuEl) return moreMenuEl;
    moreMenuEl = document.createElement("div");
    moreMenuEl.className = "more-menu";
    moreMenuEl.innerHTML = `
      <div class="mm-item" data-mm="resume"><i class="material-icons">play_arrow</i><span>Resume</span></div>
      <div class="mm-item" data-mm="startover"><i class="material-icons">replay</i><span>Start over</span></div>
      <div class="mm-item" data-mm="clear"><i class="material-icons">delete</i><span>Clear progress</span></div>
      <div class="mm-item" data-mm="copy"><i class="material-icons">link</i><span>Copy YouTube link</span></div>
    `;
    document.body.appendChild(moreMenuEl);

    moreMenuEl.addEventListener("click", async (e) => {
      const item = e.target.closest(".mm-item");
      if (!item || !moreMenuForId) return;

      const action = item.dataset.mm;
      if (action === "resume") {
        openModalForVideo(moreMenuForId);
      } else if (action === "startover") {
        clearProgress(moreMenuForId);
        openModalForVideo(moreMenuForId, { start: 0, force: true });
      } else if (action === "clear") {
        clearProgress(moreMenuForId);
        refreshAllThumbProgress();
      } else if (action === "copy") {
        const url = `https://www.youtube.com/watch?v=${moreMenuForId}`;
        try {
          await navigator.clipboard.writeText(url);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = url;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
      }

      hideMoreMenu();
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest(".more-menu") && !e.target.closest(".more-btn")) hideMoreMenu();
    });

    window.addEventListener("resize", hideMoreMenu);

    return moreMenuEl;
  }

  function showMoreMenu(buttonEl, videoId) {
    const menu = ensureMoreMenu();
    const rect = buttonEl.getBoundingClientRect();
    const padding = 8;

    moreMenuForId = videoId;
    menu.classList.add("active");

    const left = clamp(rect.right - 220, padding, window.innerWidth - 220 - padding);
    const top = clamp(rect.bottom + 8, padding, window.innerHeight - 180 - padding);

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;

    const map = loadProgressMap();
    const has = !!map[videoId];
    const resumeItem = menu.querySelector('[data-mm="resume"]');
    const clearItem = menu.querySelector('[data-mm="clear"]');
    resumeItem.style.opacity = has ? "1" : "0.45";
    clearItem.style.opacity = has ? "1" : "0.45";
    resumeItem.style.pointerEvents = has ? "" : "none";
    clearItem.style.pointerEvents = has ? "" : "none";
  }

  function hideMoreMenu() {
    if (!moreMenuEl) return;
    moreMenuEl.classList.remove("active");
    moreMenuForId = null;
  }

  function attachVideoCardHandlers() {
    const allVideoCards = document.querySelectorAll(".video");
    const allShortCards = document.querySelectorAll(".short-item");

    allVideoCards.forEach((card) => {
      if (card.dataset.pmBound === "true") return;

      const img = card.querySelector(".thumbnail img");
      const id = extractYouTubeIdFromThumbUrl(img?.getAttribute("src"));
      if (!id) return;

      card.dataset.videoId = id;
      card.dataset.pmBound = "true";

      const openTargets = [
        card.querySelector(".thumbnail"),
        card.querySelector(".title-row p")
      ].filter(Boolean);

      openTargets.forEach((t) => {
        t.addEventListener("click", (e) => {
          if (e.target.closest(".more-btn")) return;
          openModalForVideo(id);
        });
      });

      const moreBtn = card.querySelector(".more-btn");
      if (moreBtn) {
        moreBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          showMoreMenu(moreBtn, id);
        });
      }
    });

    allShortCards.forEach((card) => {
      if (card.dataset.pmBound === "true") return;

      const img = card.querySelector(".short-thumb img");
      const id = extractYouTubeIdFromThumbUrl(img?.getAttribute("src"));
      if (!id) return;

      card.dataset.videoId = id;
      card.dataset.pmBound = "true";

      const thumb = card.querySelector(".short-thumb");
      if (thumb) {
        thumb.addEventListener("click", () => openModalForVideo(id));
      }
    });

    refreshAllThumbProgress();
  }

  function refreshThumbProgressForId(videoId, data) {
    const pct = data?.d ? (data.t / data.d) * 100 : 0;
    const cards = document.querySelectorAll(`[data-video-id="${CSS.escape(videoId)}"]`);
    cards.forEach((card) => {
      const isShort = card.classList.contains("short-item");
      const container = isShort ? card.querySelector(".short-thumb") : card.querySelector(".thumbnail");
      if (container) setThumbProgress(container, pct);
    });
  }

  function refreshAllThumbProgress() {
    const map = loadProgressMap();

    document.querySelectorAll(".video .thumbnail, .short-item .short-thumb").forEach((c) => {
      setThumbProgress(c, 0);
    });

    Object.entries(map).forEach(([id, data]) => refreshThumbProgressForId(id, data));
  }

  function init() {
    ensureModal();
    attachVideoCardHandlers();

    const mo = new MutationObserver(() => attachVideoCardHandlers());
    mo.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();