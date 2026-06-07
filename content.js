/**
 * ============================================================
 * YouTube Video Filter (Enhanced) – content.js
 * Version: 4.3.2
 * ============================================================
 *
 * WHAT DOES THIS FILE DO?
 * ----------------------
 * This file is the "Content Script". It is automatically injected
 * by Chrome into every YouTube page as soon as you are there.
 * This means: When you visit youtube.com, this code runs
 * invisibly in the background and modifies the page according to your settings.
 *
 * WIE KANNST DU DEN CODE ANPASSEN?
 * ----------------------------------
 * Jede Funktion ist einzeln dokumentiert. Wenn du etwas ändern möchtest,
 * suche die entsprechende Funktion (z.B. mit STRG+F) und lies dort den Kommentar.
 *
 * WICHTIGE CSS-SELEKTOREN – Cheatsheet:
 * - 'ytd-compact-video-renderer'  → Ein einzelnes Video in der Seitenleiste auf der Video-Seite
 * - 'ytd-rich-item-renderer'       → Ein einzelnes Video auf der Startseite (großes Grid)
 * - 'ytd-video-renderer'           → Ein Video in den Suchergebnissen
 * - 'ytd-thumbnail'                → Der Thumbnail-Bereich (Preview-Bild) eines Videos
 * - 'ytd-channel-name'             → Das Element, das den Kanalnamen enthält
 * - '.ytf-block-btn'               → UNSER eigenes 🚫-Schaltflächen-Element
 * ============================================================
 */

(function() {

  // ════════════════════════════════════════════════════════════
  // SCHRITT 1: EINSTELLUNGEN SPEICHERN (im RAM, nicht dauerhaft)
  // ════════════════════════════════════════════════════════════
  //
  // Hier speichern wir die aktuellen Einstellungen des Benutzers.
  // Diese Variable wird beim Laden aus chrome.storage.sync befüllt.
  // Das ist wie ein "Zwischenspeicher" – Änderungen hier werden NICHT
  // automatisch gespeichert. Dazu braucht man chrome.storage.sync.set().
  //
  // FELDER:
  // - detoxSettings:    Globale Ein/Aus-Schalter (z.B. hideShorts, hideComments)
  // - sidepanelSettings: Einstellungen für die Seitenleiste (z.B. hideExplore)
  // - channelRules:     Array mit Feineinstellungen pro Kanal
  // - blockedChannels:  Array mit komplett blockierten Kanälen (Objekte: {handle, name, addedAt})
  //
  let settings = {
    detoxSettings:    {},
    sidepanelSettings:{},
    channelRules:     [],
    blockedVideos:    [],
    blockedChannels:  []
  };

  // ════════════════════════════════════════════════════════════
  // STEP 1: LOAD SETTINGS FROM BROWSER
  // ════════════════════════════════════════════════════════════
  //
  // This function reads the saved settings from the browser
  // and then starts all filter functions.
  //
  function loadSettings() {
    // Chrome reads the following keys from sync storage (cross-device):
    chrome.storage.sync.get(
      ['detoxSettings', 'sidepanelSettings', 'channelRules', 'blockedVideos', 'blockedChannels', 'extensionEnabled'],
      (data) => {

        // If the extension is disabled → undo everything and stop
        if (data.extensionEnabled === false) {
          console.log('[YouTube Filter] Extension is DISABLED. Skipping all filters.');
          disableAll();
          return;
        }

        // Copy data into settings variable (with empty defaults as fallback)
        settings.detoxSettings    = data.detoxSettings    || {};
        settings.sidepanelSettings= data.sidepanelSettings|| {};
        settings.channelRules     = data.channelRules     || [];
        settings.blockedVideos    = data.blockedVideos    || [];

        // IMPORTANT: blockedChannels can contain old string entries or new objects.
        // We normalize everything to objects with { handle, name }.
        settings.blockedChannels = (data.blockedChannels || []).map(b =>
          typeof b === 'string'
            ? { handle: b, name: b }   // Old entry: String → convert to object
            : b                         // New entry: already an object
        );

        // Call functions that filter the page:
        initBaseStyles();       // Set up CSS classes for hiding
        updateContextualUI();   // Apply classes to <body> (hide-shorts, etc.)
        filterAll();            // Filter all videos on the page
        if (settings.sidepanelSettings.autoExpandSubs) autoExpandSubscriptions();
      }
    );
  }

  // Wenn sich die Einstellungen im Popup ändern → Seite sofort neu filtern
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') loadSettings();
  });

  // Beim ersten Laden der Seite → Einstellungen laden
  loadSettings();


  // ════════════════════════════════════════════════════════════
  // STEP 2: INSERT CSS STYLES (The "Hide System")
  // ════════════════════════════════════════════════════════════
  //
  // We insert a <style> tag into the YouTube page.
  // In it, we define CSS rules that hide specific elements,
  // IF the <body> has certain classes (e.g., "hide-shorts").
  //
  // HOW DOES IT WORK?
  // body.hide-shorts [...] { display: none !important; }
  //   → If <body class="hide-shorts">, the element becomes invisible.
  //   → updateContextualUI() sets/removes these classes dynamically.
  //
  function initBaseStyles() {
    // Check if the style tag already exists (so we don't insert it twice)
    let styleEl = document.getElementById('yt-filter-priority-styles');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'yt-filter-priority-styles';
      styleEl.textContent = `
        /* ── Globale Ausblend-Klassen ───────────────────────── */
        /* Startseiten-Feed ausblenden */
        body.hide-home-feed ytd-browse[page-type="home"] #primary { display: none !important; }

        /* Empfohlene Videos (Seitenleiste beim Video) ausblenden */
        body.hide-sidebar #secondary.ytd-watch-flexy { display: none !important; }

        /* Kommentare ausblenden */
        body.hide-comments #comments { display: none !important; }

        /* ── Shorts ausblenden (mehrere Selektoren für Robustheit) ── */
        /* Shorts in der Sidebar-Navigation */
        body.hide-shorts ytd-guide-entry-renderer:has(a[href*="/shorts"]),
        body.hide-shorts ytd-mini-guide-entry-renderer:has(a[href*="/shorts"]),
        /* Shorts-Regalzeile im Feed */
        body.hide-shorts ytd-rich-shelf-renderer[is-shorts],
        body.hide-shorts ytd-reel-shelf-renderer,
        /* Einzelne Short-Thumbnails */
        body.hide-shorts ytd-thumbnail:has(a[href*="/shorts"]) { display: none !important; }

        /* Endscreens ausblenden */
        body.hide-endscreen .html5-endscreen,
        body.hide-endscreen .ytp-ce-element { display: none !important; }

        /* Benachrichtigungsglocke ausblenden */
        body.hide-notifications ytd-notification-topbar-button-renderer { display: none !important; }

        /* Trending/Entdecken ausblenden */
        body.hide-trending ytd-guide-entry-renderer:has(a[href="/feed/trending"]),
        body.hide-trending ytd-guide-entry-renderer:has(a[href="/feed/explore"]) { display: none !important; }

        /* ── Seitenleisten-Anpassungen ───────────────────────── */
        /* Home-Link in der Sidebar */
        body.side-hide-home ytd-guide-entry-renderer:has(a[href="/"]),
        body.side-hide-home ytd-mini-guide-entry-renderer:has(a[href="/"]) { display: none !important; }

        /* Shorts-Link in der Sidebar */
        body.side-hide-shorts ytd-guide-entry-renderer:has(a[href*="/shorts"]),
        body.side-hide-shorts ytd-guide-entry-renderer:has(a[title="Shorts"]),
        body.side-hide-shorts ytd-guide-entry-renderer:has(path[d^="m13.467 1.19"]),
        body.side-hide-shorts ytd-mini-guide-entry-renderer:has(a[href*="/shorts"]),
        body.side-hide-shorts ytd-mini-guide-entry-renderer:has(path[d^="m13.467 1.19"]) { display: none !important; }

        /* Abonnements-Bereich in der Sidebar */
        body.side-hide-subs ytd-guide-section-renderer:has(ytd-guide-section-title-renderer a[href="/feed/subscriptions"]),
        body.side-hide-subs ytd-mini-guide-entry-renderer:has(a[href="/feed/subscriptions"]) { display: none !important; }

        /* "Du" (Library/You) in der Sidebar */
        body.side-hide-you ytd-guide-entry-renderer:has(a[href="/feed/you"]),
        body.side-hide-you ytd-mini-guide-entry-renderer:has(a[href="/feed/you"]),
        body.side-hide-you ytd-guide-section-renderer:has(a[href="/feed/you"]) { display: none !important; }

        /* Entdecken/Explore in der Sidebar */
        body.side-hide-explore ytd-guide-section-renderer:has(a[href*="/channel/UC-9-kyTW8ZkZNDHQJ6FgpwQ"]),
        body.side-hide-explore ytd-guide-entry-renderer:has(a[href="/feed/trending"]) { display: none !important; }

        /* "Mehr von YouTube" in der Sidebar */
        body.side-hide-more ytd-guide-section-renderer:has(a[href="/premium"]),
        body.side-hide-more ytd-guide-section-renderer:has(a[href*="/music"]) { display: none !important; }

        /* Verlauf in der Sidebar */
        body.side-hide-report ytd-guide-entry-renderer:has(a[href="/reporthistory"]),
        body.side-hide-report ytd-guide-section-renderer:has(a[href="/reporthistory"]) { display: none !important; }

        /* Legal / Legal in the sidebar */
        body.side-hide-legal ytd-guide-footer-renderer,
        body.side-hide-legal #footer.ytd-guide-renderer,
        body.side-hide-legal ytd-guide-section-renderer:has(a[href="/reporthistory"]) { display: none !important; }

        /* Full Navigation Sidebar Hide */
        body.side-hide-guide ytd-guide-renderer,
        body.side-hide-guide app-drawer#guide,
        body.side-hide-guide ytd-mini-guide-renderer,
        body.side-hide-guide #guide-spacer { display: none !important; }
        
        /* Ensure content takes full width when sidebar is hidden */
        body.side-hide-guide ytd-app[guide-persistent-and-visible] #page-manager.ytd-app,
        body.side-hide-guide ytd-app[guide-persistent-and-visible] #masthead-container.ytd-app { 
            margin-left: 0 !important; 
            padding-left: 0 !important;
        }

        /* YouTube-Logo Click Deactivation (for Home-Redirect) */
        body.yt-redirect-logo a#logo { pointer-events: none; }

        /* ════════════════════════════════════════════════════
         * 🚫 BLOCK-BUTTON NEBEN DEM KANALNAMEN
         * ════════════════════════════════════════════════════
         *
         * Dieser Button erscheint IMMER direkt neben dem Kanalnamen.
         * So ist klar, dass der KANAL blockiert wird (nicht das Video).
         *
         * WIE ÄNDERE ICH DAS AUSSEHEN?
         * - Größe:    font-size (z.B. 14px statt 12px)
         * - Abstand:  margin-left (Abstand zum Kanalnamen)
         * - Farbe:    color (Emoji-Farbe kann nicht geändert werden,
         *             aber man könnte 🚫 durch ✖ oder ❌ ersetzen)
         * ════════════════════════════════════════════════════ */
        .ytf-block-btn {
          background: none;        /* Kein Hintergrund — sieht aus wie ein Icon */
          border: none;
          cursor: pointer;
          font-size: 12px;         /* Kleine Größe, dezent neben dem Kanalnamen */
          margin-left: 4px;        /* Abstand zum Kanalnamen */
          padding: 0 2px;
          opacity: 0.5;            /* Halbtransparent — dezent aber sichtbar */
          transition: opacity 0.2s, transform 0.2s;
          vertical-align: middle;  /* Vertikal am Kanalnamen ausgerichtet */
          display: inline;         /* Inline neben dem Text */
          line-height: 1;
          flex-shrink: 0;          /* Nicht schrumpfen wenn wenig Platz */
        }

        /* Beim Hover über die Video-Karte: Button wird deutlicher sichtbar */
        ytd-rich-item-renderer:hover .ytf-block-btn,
        ytd-video-renderer:hover .ytf-block-btn,
        ytd-grid-video-renderer:hover .ytf-block-btn,
        ytd-compact-video-renderer:hover .ytf-block-btn,
        yt-lockup-view-model:hover .ytf-block-btn { opacity: 0.8; }

        /* Beim Hover direkt über den Button: Voll sichtbar + leicht vergrößert */
        .ytf-block-btn:hover { opacity: 1 !important; transform: scale(1.3); }

        /* ── YouTube-Logo Anpassung (Playbutton → Filter) ── */
        /* Verstecke das weiße Play-Dreieck im Logo */
        ytd-topbar-logo-renderer #logo-icon svg g g:first-child path:nth-child(2),
        #logo-icon svg g g:first-child path:nth-child(2) {
          display: none !important;
        }
      `;
      document.head.appendChild(styleEl);
    }
  }


  // ════════════════════════════════════════════════════════════
  // STEP 3: UPDATE BODY CLASSES (Main Filter Switches)
  // ════════════════════════════════════════════════════════════
  //
  // This function reads the current settings and sets/removes
  // CSS classes on the <body> element of the YouTube page.
  //
  // EXAMPLE: If hideShorts = true
  //   → body.classList.toggle('hide-shorts', true)
  //   → <body class="hide-shorts">
  //   → The CSS rule "body.hide-shorts ytd-...-shorts { display:none }" takes effect
  //
  function updateContextualUI() {
    const d = settings.detoxSettings;       // Abkürzung für detoxSettings
    const s = settings.sidepanelSettings;   // Abkürzung für sidepanelSettings
    const body = document.body;

    // Prüfen ob wir uns auf einer Kanal-Seite befinden (für Kanal-spezifische Regeln)
    const currentChannel = getCurrentPageChannel();
    // Suche nach einer Kanal-Regel für den aktuell besuchten Kanal:
    const rule = settings.channelRules.find(
      r => r.handle === currentChannel.handle || r.name === currentChannel.text
    );

    // Aktive Regeln zusammenstellen:
    // Wenn es eine Kanal-Regel gibt, hat sie Vorrang über die globale Einstellung.
    // Beispiel: Global "hideShorts=false", aber für Kanal "hideShorts=true" → Shorts werden versteckt.
    const activeRules = {
      hideHomeFeed:        d.hideHomeFeed,
      hideTrending:        d.hideTrending,
      redirectHomeToSubs:  d.redirectHomeToSubs,
      hideShorts:          rule ? rule.rules.hideShorts        : d.hideShorts,
      hideComments:        rule ? rule.rules.hideComments      : d.hideComments,
      hideEndscreen:       rule ? rule.rules.hideEndscreen     : d.hideEndscreen,
      hideNotifications:   rule ? rule.rules.hideNotifications : d.hideNotifications,
      hideSidebar:         d.hideSidebar
    };

    // CSS-Klassen auf dem Body setzen/entfernen:
    // toggle(klasse, true)  → Klasse setzen
    // toggle(klasse, false) → Klasse entfernen
    // !! konvertiert Wert zu boolean (damit undefined/null → false wird)
    body.classList.toggle('hide-home-feed',      !!activeRules.hideHomeFeed);
    body.classList.toggle('hide-trending',       !!activeRules.hideTrending);
    body.classList.toggle('hide-shorts',         !!activeRules.hideShorts);
    body.classList.toggle('hide-comments',       !!activeRules.hideComments);
    body.classList.toggle('hide-endscreen',      !!activeRules.hideEndscreen);
    body.classList.toggle('hide-notifications',  !!activeRules.hideNotifications);
    body.classList.toggle('hide-sidebar',        !!activeRules.hideSidebar);

    // Seitenleisten-Klassen (side-hide-*):
    body.classList.toggle('side-hide-home',    !!s.hideHome);
    body.classList.toggle('side-hide-shorts',  !!s.hideShorts);
    body.classList.toggle('side-hide-subs',    !!s.hideSubs);
    body.classList.toggle('side-hide-you',     !!s.hideYou);
    body.classList.toggle('side-hide-explore', !!s.hideExplore);
    body.classList.toggle('side-hide-more',    !!s.hideMoreFromYT);
    body.classList.toggle('side-hide-report',  !!s.hideReportHistory);
    body.classList.toggle('side-hide-legal',   !!s.hideLegal);
    body.classList.toggle('side-hide-guide',   !!s.hideGuide);

    handleRedirection(activeRules.redirectHomeToSubs);
  }


  // ════════════════════════════════════════════════════════════
  // HELPER FUNCTION: Auto-expand Subscriptions
  // ════════════════════════════════════════════════════════════
  //
  // Clicks the "Show more" button in the subscriptions list
  // of the sidebar if the "autoExpandSubs" setting is active.
  //
  function autoExpandSubscriptions() {
    // Search for the "Show more" button in the subscriptions section:
    const expander = document.querySelector(
      'ytd-guide-section-renderer:has(a[href="/feed/subscriptions"]) #expander-item'
    );
    if (expander && !expander.hasAttribute('active-filter-expanded')) {
      const text = expander.innerText.toLowerCase();
      // Unterstützt mehrere Sprachen:
      if (text.includes('more') || text.includes('mehr') || text.includes('más') ||
          text.includes('plus') || text.includes('すべて表示')) {
        expander.click();
        // Merke, dass wir schon geklickt haben (damit wir nicht endlos klicken):
        expander.setAttribute('active-filter-expanded', 'true');
      }
    }
  }


  // ════════════════════════════════════════════════════════════
  // HELPER FUNCTION: Determine the current channel of the page
  // ════════════════════════════════════════════════════════════
  //
  // This function identifies which channel page we are currently on.
  // Used for:
  // 1. Channel-specific rules in updateContextualUI()
  // 2. The "Block Channel" button on channel pages
  //
  // RETURNS: { text: "Channel-Name", handle: "@ChannelHandle" }
  //
  function getCurrentPageChannel() {
    // Strategy 1: Read channel name from the header of the channel page
    const headerName =
      document.querySelector('#channel-header #channel-name #text') ||
      document.querySelector('#inner-header-container #channel-name #text');

    // Strategie 2: Handle (@KanalName) aus der URL lesen
    const path = window.location.pathname;
    const handleMatch = path.match(/@([^/?#]+)/);

    // Strategie 3: Kanal-Name vom Video-Upload-Link (auf Video-Seiten)
    const authorLink =
      document.querySelector('ytd-watch-metadata ytd-channel-name a') ||
      document.querySelector('#owner ytd-channel-name a');

    let text   = headerName ? headerName.textContent.trim() : '';
    let handle = handleMatch ? '@' + handleMatch[1] : '';

    if (authorLink) {
      text = text || authorLink.textContent.trim();
      const href   = authorLink.getAttribute('href');
      const hMatch = href.match(/@([^/?#]+)/);
      handle = handle || (hMatch ? '@' + hMatch[1] : href);
    }

    return { text, handle };
  }


  // ════════════════════════════════════════════════════════════
  // HELPER FUNCTION: Customize YouTube Logo (Play → Filter)
  // ════════════════════════════════════════════════════════════
  //
  // Replaces the white play triangle in the YouTube logo with a 
  // funnel symbol (filter) to strengthen the extension's branding.
  //
  function replaceLogoIcon() {
    // Find the container that holds the paths for the red box and the triangle:
    const logoIconGroup = document.querySelector(
      'ytd-topbar-logo-renderer #logo-icon svg g g:first-child, #logo-icon svg g g:first-child'
    );

    if (logoIconGroup && !logoIconGroup.querySelector('.ytf-filter-logo-path')) {
      const paths = logoIconGroup.querySelectorAll('path');
      // The triangle is usually the second path in the first group element
      if (paths.length >= 2) {
        // The triangle is already hidden via CSS (initBaseStyles).
        // We add our filter icon (funnel) here:
        const filterPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        // Path for a funnel icon (filter), adjusted to the YouTube logo size:
        filterPath.setAttribute('d', 'M9 7.5h10.5l-4.2 4.8v4.2l-2.1 2.1v-6.3l-4.2-4.8z');
        filterPath.setAttribute('fill', '#FFFFFF');
        filterPath.setAttribute('class', 'ytf-filter-logo-path');
        logoIconGroup.appendChild(filterPath);
      }
    }
  }


  // ════════════════════════════════════════════════════════════
  // HELPER FUNCTION: Home Page Redirection (Home → Subscriptions)
  // ════════════════════════════════════════════════════════════
  //
  // If "Redirect Home to Subs" is active, the user is automatically
  // redirected from youtube.com to youtube.com/feed/subscriptions.
  //
  function handleRedirection(enabled) {
    if (!enabled) return;
    const isHome = window.location.pathname === '/' || window.location.pathname === '/index.html';
    if (isHome) window.location.replace('/feed/subscriptions');

    // Intercept YouTube logo click (prevents going back to the home page):
    const logo = document.querySelector('a#logo');
    if (logo && !logo.dataset.intercepted) {
      logo.addEventListener('click', (e) => {
        if (settings.detoxSettings.redirectHomeToSubs) {
          e.preventDefault();
          window.location.href = '/feed/subscriptions';
        }
      });
      logo.dataset.intercepted = 'true'; // Note that we already have a listener
    }
  }


  // ════════════════════════════════════════════════════════════
  // FILTER LOGIC: Helper Functions
  // ════════════════════════════════════════════════════════════

  /**
   * Converts a time string (e.g., "1:23:45" or "5:30") into seconds.
   * Used to apply min/max duration filters.
   * Returns null if the string doesn't have a valid format.
   *
   * EXAMPLES:
   *   "1:30"    → 90 seconds
   *   "1:00:00" → 3600 seconds
   *   "abc"     → null
   */
  function parseDuration(timeStr) {
    if (!timeStr) return null;
    const parts = timeStr.trim().split(':').map(p => parseInt(p, 10));
    if (parts.some(isNaN)) return null;
    let s = 0;
    if      (parts.length === 3) s = parts[0] * 3600 + parts[1] * 60 + parts[2];
    else if (parts.length === 2) s = parts[0] * 60 + parts[1];
    else if (parts.length === 1) s = parts[0];
    return s;
  }

  /**
   * Reads the timestamp text (e.g., "5:30") from a video card element.
   * The timestamp is displayed as a badge on the thumbnail.
   *
   * NOTE: YouTube uses different elements for the badge.
   * We try both.
   */
  function getDurationText(videoNode) {
    // Search for the time badge:
    const badge = videoNode.querySelector(
      'ytd-thumbnail-overlay-time-status-renderer, yt-thumbnail-badge-view-model, .yt-core-attributed-string--link-inherit-color'
    );
    if (badge) {
      // Also look for Aria-Label which often contains "1 minute, 30 seconds"
      const aria = badge.getAttribute('aria-label');
      if (aria && aria.includes(':')) return aria.trim();

      const textEl = badge.querySelector('div, span, #text, label');
      if (textEl) {
        const text = textEl.innerText.trim();
        if (text.includes(':')) return text;
      }
    }
    // Fallback for new view models: search for any text containing ":"
    const timeSpan = videoNode.querySelector('span[class*="time-status"], span[class*="badge"]');
    if (timeSpan && timeSpan.innerText.includes(':')) return timeSpan.innerText.trim();

    return null; 
  }

  /**
   * Checks if a video is a YouTube Short.
   * Uses 3 different detection methods for robustness.
   *
   * SHORTS are:
   * - Very short videos (< 60 seconds)
   * - With /shorts/ in the URL
   * - With a special "SHORTS" badge
   */
  function isShort(videoNode) {
    // Method 1: URL contains "/shorts/"
    const link = videoNode.querySelector('a[href*="/shorts/"]');
    if (link) return true;

    // Method 2: The overlay badge has the type "SHORTS"
    const overlay = videoNode.querySelector(
      'ytd-thumbnail-overlay-time-status-renderer[overlay-style="SHORTS"]'
    );
    if (overlay) return true;

    // Method 3: The shorts logo (SVG path) is present
    if (videoNode.querySelector('path[d^="m13.467 1.19"]')) return true;

    return false; // No shorts characteristic found
  }

  /**
   * Normalizes text for comparisons.
   * Important for Turkish: "I" (upper) → "ı" (lower without dot), not "i"
   *
   * EXAMPLES:
   *   "MrBeast"  → "mrbeast"
   *   "@CoolCat" → "@coolcat"
   *   "%40Kanal" → "@kanal"  (URL-decoding)
   */
  function normalizeText(text) {
    if (!text) return '';
    try {
      // First, resolve URL encoding (%40 → @, %C3%96 → Ö, etc.):
      const decoded = decodeURIComponent(text.toString());
      // Then lower case with Turkish locale (for dotless-i support):
      return decoded.toLocaleLowerCase('tr-TR').trim();
    } catch (e) {
      // If decodeURIComponent fails (invalid encoding):
      return text.toString().toLocaleLowerCase('tr-TR').trim();
    }
  }

  /**
   * Reads the title of a video from a video card element.
   * Supports both old and new YouTube layouts.
   */
  function getVideoTitle(videoNode) {
    // Try various selectors (YouTube occasionally changes these):
    const titleEl = videoNode.querySelector(
      'a#video-title, a#video-title-link, #video-title-link, #video-title, .yt-lockup-metadata-view-model__title'
    );
    if (!titleEl) return '';

    // The "title" attribute usually contains the cleanest text:
    let attrTitle = titleEl.getAttribute('title');

    // Fallback: Sometimes the title is in the parent <h3> element:
    if (!attrTitle) {
      const h3 = titleEl.closest('h3');
      if (h3) attrTitle = h3.getAttribute('title');
    }

    if (attrTitle) return attrTitle.trim();

    // Last fallback: Directly read the text content:
    return (titleEl.innerText || titleEl.textContent || '').replace(/\s\s+/g, ' ').trim();
  }

  /**
   * Reads the channel name and the handle (@...) from a video card element.
   *
   * YouTube has 4 different layouts. We try all 4 strategies:
   * - A: Classic layout with ytd-channel-name
   * - B: New "lockup" layout (yt-content-metadata-view-model)
   * - C: Fallback via channel links (/@handle)
   * - D: yt-formatted-string fallback
   *
   * RETURNS: { text: "Channel-Name", handle: "@handle", elFound: DOM-element }
   */
  function getChannelInfo(videoNode) {
    let text = '', handle = '', elFound = null;

    // ── Strategy A: Classic ytd-layout ─────────────────
    // Searches for an "a" link within ytd-channel-name or #channel-name:
    const classicLink = videoNode.querySelector(
      'ytd-channel-name a, #channel-name a, #byline-container a[href*="/@"], #byline-container a[href*="/channel/"]'
    );
    if (classicLink && classicLink.textContent.trim()) {
      text   = classicLink.textContent.trim();
      const href = classicLink.getAttribute('href');
      const m    = href.match(/@([^/?#]+)/);
      handle = m ? '@' + m[1] : href;
      elFound = classicLink;
    }

    // ── Strategie B: Neues "lockup" Layout ──────────────────
    const lockupMeta = videoNode.querySelector('yt-lockup-metadata-view-model');
    if (lockupMeta) {
        const contentMeta = lockupMeta.querySelector('yt-content-metadata-view-model');
        if (contentMeta) {
            const spans = contentMeta.querySelectorAll('span, a');
            for (const sp of spans) {
                const t = sp.textContent.trim();
                if (!t || t === '|' || t === '•' || t === '·') continue;
                if (/^\d[\d.,\s]*(Mio|Tsd|K|M|B|Aufrufe|views|vues|visualizaciones)/i.test(t)) continue;
                if (/^vor\s/i.test(t) || /\bago$/i.test(t)) continue;
                if (/^[\d.,\s]+$/.test(t)) continue;

                text = t;
                elFound = sp;
                break;
            }
        }
    }

    if (!text) {
      // Suche Metadaten-Spans im lockup-spezifischen Layout:
    // Der erste span mit Text ist der Kanalname.
    if (!text) {
      // Suche Metadaten-Spans im lockup-spezifischen Layout:
      // Versuche erst die spezifische Row-Klasse, dann den ganzen Container:
      const metaEl =
        videoNode.querySelector('yt-content-metadata-view-model .yt-content-metadata-view-model__metadata-row') ||
        videoNode.querySelector('yt-content-metadata-view-model');
      if (metaEl) {
        // ALLE spans im Metadaten-Bereich durchgehen und den Kanalnamen finden.
        //
        // WICHTIG: CSS [class*="metadata"] ist CASE-SENSITIVE!
        // YouTube nutzt "ytContentMetadataViewModelMetadataText" (großes M),
        // daher matcht [class*="metadata"] NICHT. Wir nehmen stattdessen
        // einfach alle spans und filtern nach Text-Inhalt.
        //
        // Der ERSTE span mit sinnvollem Text (nicht Aufrufe, nicht Datum) = Kanalname.
        //
        const spans = metaEl.querySelectorAll('span');
        for (const sp of spans) {
          const t = sp.textContent.trim();
          // Überspringen wenn:
          // - leer
          // - nur Trenner (|, •, ·)
          // - Zahl mit Punkt/Komma (z.B. "62.188 Aufrufe" oder "3,9 Mio.")
          // - "vor X" Zeitangaben (z.B. "vor 2 Jahren", "vor 3 Tagen")
          // - "ago" Zeitangaben (Englisch: "2 years ago")
          // - rein numerisch
          if (!t) continue;
          if (t === '|' || t === '•' || t === '·') continue;
          if (/^\d[\d.,\s]*(Mio|Tsd|K|M|B|Aufrufe|views|vues|visualizaciones)/i.test(t)) continue;
          if (/^vor\s/i.test(t) || /\bago$/i.test(t)) continue;
          if (/^[\d.,\s]+$/.test(t)) continue;

          text    = t;
          elFound = sp;

          // Handle aus einem beliebigen Channel-Link im Karten-Element:
          const anyChannelLink = videoNode.querySelector('a[href*="/@"]');
          if (anyChannelLink) {
            const m = anyChannelLink.getAttribute('href').match(/@([^/?#]+)/);
            if (m) handle = '@' + m[1];
          }
          // Wenn kein Link mit @ gefunden, auch /channel/ oder /c/ probieren:
          if (!handle) {
            const anyLink = videoNode.querySelector('a[href*="/channel/"], a[href*="/c/"]');
            if (anyLink) handle = anyLink.getAttribute('href');
          }
          break;
        }
      }
    }

    // ── Strategie C: Fallback über alle Channel-Links ────────
    // Sucht nach allen Links die auf Kanäle zeigen (@, /channel/, /c/):
    if (!text) {
      const links = Array.from(videoNode.querySelectorAll(
        'a[href*="/@"], a[href*="/channel/"], a[href*="/c/"]'
      ));
      for (const link of links) {
        // Avatar-Links und Bild-Links überspringen:
        if (link.id === 'avatar-link') continue;
        if (link.querySelector('img')) continue;
        // Titel-Links überspringen:
        if (link.closest('h3, h4, [id="video-title"]')) continue;
        const t = link.textContent.trim();
        if (!t) continue;
        text = t;
        const href = link.getAttribute('href');
        const m    = href.match(/@([^/?#]+)/);
        handle  = m ? '@' + m[1] : href;
        elFound = link;
        break;
      }
    }

    // ── Strategie D: yt-formatted-string Fallback ────────────
    // Wird auf der Video-Watch-Seite in der Sidebar genutzt:
    if (!text) {
      const fmtStr = videoNode.querySelector(
        'ytd-channel-name yt-formatted-string, #channel-name yt-formatted-string'
      );
      if (fmtStr && fmtStr.textContent.trim()) {
        text    = fmtStr.textContent.trim();
        elFound = fmtStr;
        const anyLink = videoNode.querySelector('a[href*="/@"]');
        if (anyLink) {
          const m = anyLink.getAttribute('href').match(/@([^/?#]+)/);
          if (m) handle = '@' + m[1];
        }
      }
    }

    return { text, handle, elFound };
  }


  // ════════════════════════════════════════════════════════════
  // 🚫 INSERT BLOCK BUTTON NEXT TO CHANNEL NAME
  // ════════════════════════════════════════════════════════════
  //
  // The 🚫 button appears ALWAYS directly next to the channel name.
  // This makes it clear: "I am blocking this CHANNEL" (not the video).
  //
  // This function uses the `elFound` element from getChannelInfo(),
  // which is the DOM element containing the channel name.
  // The button is inserted directly next to it (insertAdjacentElement).
  //
  function injectBlockButton(videoNode, chanName, chanHandle, chanElement) {
    // Guard 1: Button already inserted? → do nothing
    if (videoNode.querySelector('.ytf-block-btn')) return;

    // Guard 2: No channel name known? → cancel (will be retried in the next interval)
    if (!chanHandle && !chanName) return;

    // ── Find the channel element (where the button will be inserted) ────
    let targetEl = chanElement;

    if (!targetEl) {
      // Strategy 1: Classic layout — ytd-channel-name contains the link
      targetEl = videoNode.querySelector('ytd-channel-name yt-formatted-string#text');
    }
    if (!targetEl) {
      // Strategy 2: Classic layout — link inside ytd-channel-name
      targetEl = videoNode.querySelector('ytd-channel-name a');
    }
    if (!targetEl) {
      // Strategy 3: New lockup layout — first span in the metadata
      const metaEl =
        videoNode.querySelector('yt-content-metadata-view-model .yt-content-metadata-view-model__metadata-row') ||
        videoNode.querySelector('yt-content-metadata-view-model');
      if (metaEl) {
        const spans = metaEl.querySelectorAll('span');
        for (const sp of spans) {
          const t = sp.textContent.trim();
          if (!t || t === '|' || t === '•' || t === '·') continue;
          if (/^\d[\d.,\s]*(Mio|Tsd|K|M|B|Aufrufe|views)/i.test(t)) continue;
          if (/^vor\s/i.test(t) || /\bago$/i.test(t)) continue;
          if (/^[\d.,\s]+$/.test(t)) continue;
          targetEl = sp;
          break;
        }
      }
    }
    if (!targetEl) {
      // Strategy 4: General fallback — any channel name link
      targetEl = videoNode.querySelector('#channel-name a, #byline-container a');
    }

    // No channel name element found → cancel
    if (!targetEl) return;

    // ── Create button ───────────────────────────────────
    const btn = document.createElement('button');
    btn.className = 'ytf-block-btn';
    btn.textContent = '🚫';
    btn.title = `Block "${chanName || chanHandle}" — Hide all videos from this channel`;

    // Click-Handler: Kanal blockieren
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const handle = chanHandle || chanName;
      const name   = chanName   || chanHandle;

      chrome.storage.sync.get(['blockedChannels'], (data) => {
        const list = (data.blockedChannels || []).map(b =>
          typeof b === 'string' ? { handle: b, name: b } : b
        );
        const normNew = normalizeText(handle);

        if (!list.some(b =>
          normalizeText(b.handle) === normNew || normalizeText(b.name) === normNew
        )) {
          list.push({ handle, name, addedAt: Date.now() });
          settings.blockedChannels = list;
          chrome.storage.sync.set({ blockedChannels: list }, () => {
            videoNode.style.display = 'none';
            videoNode.dataset.filtered = 'true_blocked';
          });
        }
      });
    });

    // ── Button direkt neben dem Kanalnamen einfügen ──────────
    // insertAdjacentElement('afterend', btn) = direkt NACH dem Element
    try {
      targetEl.insertAdjacentElement('afterend', btn);
    } catch (err) {
      // Fallback: Als Kind des Eltern-Elements anfügen
      if (targetEl.parentElement) targetEl.parentElement.appendChild(btn);
    }
  }


  // ════════════════════════════════════════════════════════════
  // CORE FUNCTION: Process a single video
  // ════════════════════════════════════════════════════════════
  //
  // This function is called for EVERY video card on the page.
  // It decides whether a video should be visible or hidden.
  //
  // RULE ORDER (highest to lowest priority):
  //   RULE 0 → Blocked channels (always hidden, NO exceptions)
  //   RULE 1 → Channel title keywords (show/hide based on title)
  //   RULE 2 → Global shorts setting
  //   RULE 3 → Channel-specific rules (duration, shorts)
  //
  function processVideo(videoNode) {
    // Guard: Already blocked → do not process again
    if (!videoNode || videoNode.dataset.filtered === 'true_blocked') return;

    // Read channel information from the video card:
    const { text: chanName, handle: chanHandle, elFound: chanElement } = getChannelInfo(videoNode);

    // Video information:
    const duration       = parseDuration(getDurationText(videoNode));
    const isAVideoShort  = isShort(videoNode);

    // Normalized versions for comparisons:
    const normChanHandle = normalizeText(chanHandle);
    const normChanName   = normalizeText(chanName);

    // Passende Kanal-Regel suchen (wenn vorhanden):
    const rule = settings.channelRules.find(r =>
      normalizeText(r.handle) === normChanHandle ||
      normalizeText(r.name)   === normChanName
    );

    // ═══ TEMPORÄRES DEBUG-LOG ═══
    if (chanName || chanHandle || duration) {
      console.log(`[YTF Debug] Video: "${getVideoTitle(videoNode)}"`, 
        `| Channel: ${chanName} (${chanHandle})`,
        `| Duration: ${duration}s`,
        `| Rule Found: ${rule ? 'YES' : 'NO'}`,
        `| tag: ${videoNode.tagName}`);
    }

    let shouldHide  = false; // Soll das Video versteckt werden?
    let forcedShow  = false; // Soll das Video IMMER gezeigt werden (überschreibt shouldHide)?

    // ── REGEL 0: Blockierte Kanäle ──────────────────────────
    // Wenn der Kanal blockiert ist → immer verstecken, keine Ausnahmen.
    //
    // HINWEIS: Wir vergleichen mit normalizeText() damit Großschreibung und
    // türkische Zeichen keine Rolle spielen.
    //
    const isBlocked = (settings.blockedChannels || []).some(b => {
      const bHandle = normalizeText(typeof b === 'string' ? b : b.handle);
      const bName   = normalizeText(typeof b === 'string' ? b : (b.name || b.handle));
      return (normChanHandle && bHandle && normChanHandle === bHandle) ||
             (normChanName   && bName   && normChanName   === bName);
    });

    if (isBlocked) {
      console.log('[YTF] ✅ BLOCKING:', chanName, chanHandle); // Debug
      shouldHide = true;
    } else {
      // Block-Button einbinden (nur wenn noch nicht blockiert):
      // chanElement = das DOM-Element mit dem Kanalnamen (für die Platzierung)
      injectBlockButton(videoNode, chanName, chanHandle, chanElement);
    }

    // ── REGEL 1: Titel-Keywords (Kanal-spezifisch) ──────────
    // Wenn diese Video-Karte zu einem Kanal mit Keyword-Regeln gehört:
    //
    // BEISPIEL: Kanal "MrBeast" hat Regel:
    //   keywords = "challenge,reaction", mode = "hide", matchType = "contains"
    //   → Versteckt alle MrBeast-Videos die "challenge" oder "reaction" im Titel haben
    //
    if (rule && rule.rules.titleKeywords) {
      const title    = normalizeText(getVideoTitle(videoNode));
      const keywords = rule.rules.titleKeywords
        .split(',')
        .map(k => normalizeText(k.trim()))
        .filter(k => k); // Leere Strings entfernen
      const matchType = rule.rules.titleMatchType || 'contains';

      const hasMatch = keywords.some(k => {
        if (matchType === 'starts') return title.startsWith(k); // Titel beginnt mit Keyword
        if (matchType === 'ends')   return title.endsWith(k);   // Titel endet mit Keyword
        if (matchType === 'exact')  return title === k;         // Titel ist exakt das Keyword
        return title.includes(k);                               // Standard: Keyword im Titel enthalten
      });

      if (rule.rules.titleMode === 'show') {
        // Modus "Nur zeigen wenn Match":
        if (keywords.length > 0 && !hasMatch) shouldHide = true; // Kein Match → verstecken
        else if (hasMatch) forcedShow = true;                     // Match → IMMER zeigen
      } else {
        // Modus "Verstecken wenn Match" (Standard):
        if (hasMatch) shouldHide = true;
      }
    }

    if (!forcedShow) {
      // ── REGEL 2: Globale Shorts-Einstellung ───────────────
      if (settings.detoxSettings.hideShorts && isAVideoShort) shouldHide = true;

      // ── REGEL 3: Kanal-spezifische Regeln ─────────────────
      if (rule) {
        // Shorts für diesen Kanal verstecken:
        if (rule.rules.hideShorts && (isAVideoShort || (duration !== null && duration < 60))) {
          shouldHide = true;
        }
        // Minimum-Dauer: Videos die kürzer sind → verstecken
        if (rule.rules.minDuration && duration !== null && duration < rule.rules.minDuration) {
          shouldHide = true;
        }
        // Maximum-Dauer: Videos die länger sind → verstecken
        if (rule.rules.maxDuration && duration !== null && duration > rule.rules.maxDuration) {
          shouldHide = true;
        }
      }
    }

    // ── Ergebnis anwenden ─────────────────────────────────────
    if (shouldHide && !forcedShow) {
      videoNode.style.display = 'none';
      videoNode.setAttribute('hidden', 'true');
      videoNode.dataset.filtered = 'true_blocked';

      // NEW: Trigger YouTube's internal hide function if enabled (using a queue)
      if (settings.detoxSettings.syncNativeHide && !videoNode.dataset.nativelyHidden) {
          addToNativeHideQueue(videoNode, isBlocked);
      }
    } else {
      videoNode.style.display = '';
      videoNode.removeAttribute('hidden');
      videoNode.dataset.filtered = 'true';
    }
  }


  // ════════════════════════════════════════════════════════════
  // ALLE VIDEOS FILTERN
  // ════════════════════════════════════════════════════════════
  //
  // Diese Funktion sucht ALLE Video-Karten auf der aktuellen Seite
  // und ruft für jede processVideo() auf.
  //
  // WELCHE ELEMENTE WERDEN GEFILTERT?
  // - ytd-rich-item-renderer        → Startseite (großes Grid)
  // - ytd-video-renderer            → Suchergebnisse
  // - ytd-grid-video-renderer       → Kanal-Seite (Grid-Ansicht)
  // - ytd-compact-video-renderer    → Empfehlungen (Sidebar rechts beim Video)
  // - yt-lockup-view-model          → Neues Layout (Home, Search)
  // - ytd-rich-grid-media           → Variante des Rich-Grid-Layouts
  // - ytd-reel-item-renderer        → Shorts im Feed
  //
  // WIE FÜGE ICH EINEN NEUEN VIDEO-TYP HINZU?
  // Füge den selector-String in das Array ein.
  // Den richtigen Selektor findest du mit DevTools: Rechtsklick → Inspizieren
  //
  function filterAll() {
    const videoSelectors = [
      'ytd-rich-item-renderer',      // Startseite
      'ytd-video-renderer',          // Suchergebnisse
      'ytd-grid-video-renderer',     // Kanal-Seite
      'ytd-compact-video-renderer',  // Empfehlungsliste beim Video ← wichtig für deine Anfrage!
      'yt-lockup-view-model',        // Neues YouTube-Layout
      'ytd-rich-grid-media',
      'ytd-reel-item-renderer'       // Shorts-Zeilen
    ];
    document.querySelectorAll(videoSelectors.join(',')).forEach(processVideo);
  }


  // ════════════════════════════════════════════════════════════
  // DOM OBSERVER: Automatically filter new videos
  // ════════════════════════════════════════════════════════════
  //
  // YouTube loads videos dynamically (infinite scroll, navigation).
  // A MutationObserver monitors the page for new elements.
  // When a new video element is added → call processVideo().
  //
  const observer = new MutationObserver((mutations) => {
    updateContextualUI();
    replaceLogoIcon();
    if (settings.sidepanelSettings.autoExpandSubs) autoExpandSubscriptions();

    // Go through all changes:
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        // Only elements (no text, no comments):
        if (node.nodeType !== 1) continue;

        const videoSelectors = [
          'ytd-rich-item-renderer',
          'ytd-video-renderer',
          'ytd-grid-video-renderer',
          'ytd-compact-video-renderer',
          'yt-lockup-view-model',
          'ytd-rich-grid-media',
          'ytd-reel-item-renderer'
        ];

        // Case A: The added node is a video element:
        if (videoSelectors.some(sel => node.matches && node.matches(sel))) {
          processVideo(node);
        } else {
          // Case B: The node contains video elements:
          videoSelectors.forEach(sel => node.querySelectorAll(sel).forEach(processVideo));
        }
      }
    }
  });

  // Start observation:
  const target = document.querySelector('ytd-app') || document.body;
  observer.observe(target, { childList: true, subtree: true });


  // ════════════════════════════════════════════════════════════
  // DISABLE EXTENSION (Reset everything)
  // ════════════════════════════════════════════════════════════
  //
  // Called when the user toggles the extension off.
  // Removes all our CSS classes and elements from the page.
  //
  function disableAll() {
    // Remove our style tags:
    document.getElementById('yt-filter-priority-styles')?.remove();

    // Remove all our body classes:
    document.body.className = document.body.className
      .replace(/\bhide-[^ ]+/g, '')
      .replace(/\bside-hide-[^ ]+/g, '');

    // Show all hidden videos:
    document.querySelectorAll('[data-filtered]').forEach(el => {
      el.style.display = '';
      el.removeAttribute('hidden');
      el.dataset.filtered = '';
    });

    // Remove all our block buttons:
    document.querySelectorAll(
      '.ytf-block-btn, .ytf-block-channel-header, .ytf-block-channel-name-icon, .yt-filter-block-btn, .yt-filter-block-btn-header'
    ).forEach(el => el.remove());

    // Reset logo redirect listener:
    const logo = document.querySelector('a#logo');
    if (logo) logo.dataset.intercepted = '';
  }


  // ════════════════════════════════════════════════════════════
  // CHANNEL PAGE: Insert block button
  // ════════════════════════════════════════════════════════════
  //
  // When the user visits a channel page, two elements are inserted:
  // 1. 🚫 icon NEXT TO THE CHANNEL NAME
  // 2. "🚫 Block Channel" BUTTON NEXT TO SUBSCRIBE
  //
  function processChannelPage() {
    const path = window.location.pathname;

    const isChannelPage = path.startsWith('/@') ||
                          path.startsWith('/channel/') ||
                          path.startsWith('/c/');
    if (!isChannelPage) return;

    const { text: chanName, handle: chanHandle } = getCurrentPageChannel();
    const handleToBlock = chanHandle || chanName;
    if (!handleToBlock) return;

    const normHandle = normalizeText(handleToBlock);
    const normName   = normalizeText(chanName);

    const isBlocked = (settings.blockedChannels || []).some(b => {
      const bHandle = normalizeText(typeof b === 'string' ? b : b.handle);
      const bName   = normalizeText(typeof b === 'string' ? b : (b.name || b.handle));
      return bHandle === normHandle || bHandle === normName ||
             bName   === normHandle || bName   === normName;
    });

    if (isBlocked) {
      window.location.replace('/');
      return;
    }

    const blockThisChannel = () => {
      if (confirm(`Block "${chanName || handleToBlock}"? All videos from this channel will be hidden everywhere.`)) {
        chrome.storage.sync.get(['blockedChannels'], (data) => {
          const list = (data.blockedChannels || []).map(b =>
            typeof b === 'string' ? { handle: b, name: b } : b
          );
          if (!list.some(b => normalizeText(b.handle) === normHandle)) {
            list.push({ handle: handleToBlock, name: chanName || handleToBlock, addedAt: Date.now() });
            settings.blockedChannels = list;
            chrome.storage.sync.set({ blockedChannels: list }, () => {
              window.location.replace('/');
            });
          }
        });
      }
    };

    // 1. 🚫 icon next to the channel name
    if (!document.querySelector('.ytf-block-channel-name-icon')) {
      const channelTitleEl =
        document.querySelector('#page-header yt-dynamic-text-view-model') ||
        document.querySelector('#channel-header #channel-name')           ||
        document.querySelector('yt-page-header-renderer #title')          ||
        document.querySelector('#inner-header-container #channel-name');

      if (channelTitleEl) {
        const iconBtn = document.createElement('button');
        iconBtn.className = 'ytf-block-channel-name-icon';
        iconBtn.textContent = '🚫';
        iconBtn.title = `Block this channel`;
        Object.assign(iconBtn.style, {
          background:    'none',
          border:        'none',
          cursor:        'pointer',
          fontSize:      '20px',
          marginLeft:    '10px',
          opacity:       '0.6',
          verticalAlign: 'middle',
          display:       'inline-flex',
          alignItems:    'center',
          transition:    'opacity 0.2s, transform 0.2s'
        });
        iconBtn.addEventListener('mouseenter', () => {
          iconBtn.style.opacity   = '1';
          iconBtn.style.transform = 'scale(1.15)';
        });
        iconBtn.addEventListener('mouseleave', () => {
          iconBtn.style.opacity   = '0.6';
          iconBtn.style.transform = 'scale(1)';
        });
        iconBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); blockThisChannel(); };
        channelTitleEl.appendChild(iconBtn);
      }
    }

    // 2. "🚫 Block Channel" button next to subscribe
    if (!document.querySelector('.ytf-block-channel-header')) {
      const subscribeBtn =
        document.querySelector('ytd-subscribe-button-renderer') ||
        document.querySelector('yt-subscribe-button-shape')     ||
        document.querySelector('button[aria-label*="bbonn"]')   ||
        document.querySelector('button[aria-label*="ubscri"]');

      if (!subscribeBtn) return;

      const headerBtn = document.createElement('button');
      headerBtn.className = 'ytf-block-channel-header';
      headerBtn.textContent = '🚫 Block Channel';
      Object.assign(headerBtn.style, {
        backgroundColor: '#cc0000',
        color:           'white',
        border:          'none',
        borderRadius:    '18px',
        padding:         '0 14px',
        height:          '36px',
        cursor:          'pointer',
        fontWeight:      '500',
        fontSize:        '14px',
        display:         'inline-flex',
        alignItems:      'center',
        marginLeft:      '8px',
        flexShrink:      '0',
        transition:      'background-color 0.2s'
      });
      headerBtn.addEventListener('mouseenter', () => headerBtn.style.backgroundColor = '#aa0000');
      headerBtn.addEventListener('mouseleave', () => headerBtn.style.backgroundColor = '#cc0000');
      headerBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); blockThisChannel(); };
      subscribeBtn.insertAdjacentElement('afterend', headerBtn);
    }
  }


  // ════════════════════════════════════════════════════════════
  // MESSAGE LISTENER: Receive commands from popup
  // ════════════════════════════════════════════════════════════
  //
  // The popup (popup.js) can send messages to this content script.
  // Currently only 'refresh' is used to reload settings.
  //
  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'refresh') loadSettings();
  });


  // ════════════════════════════════════════════════════════════
  // START: Execute everything
  // ════════════════════════════════════════════════════════════

  // Filter everything immediately on first load:
  filterAll();
  processChannelPage();
  replaceLogoIcon();

  // On YouTube navigation (SPA: Single Page App Navigation):
  window.addEventListener('yt-navigate-finish', () => {
    updateContextualUI();
    if (settings.sidepanelSettings.autoExpandSubs) autoExpandSubscriptions();
    setTimeout(filterAll, 1000); // Wait 1s for page rendering
    processChannelPage();
    replaceLogoIcon();
  });

  // Backup: Filter everything again every 3 seconds.
  // This catches elements that the observer or navigate-finish event missed.
  setInterval(() => {
    filterAll();
    processChannelPage();
    replaceLogoIcon();
  }, 3000);

  // ════════════════════════════════════════════════════════════
  // INTERNAL HIDE QUEUE: Process one hide action at a time
  // ════════════════════════════════════════════════════════════
  //
  // Why a queue? 
  //   YouTube only allows ONE menu to be open at a time.
  //   If we try to click 10 buttons at once, they will cancel each other out.
  //
  let nativeHideQueue = [];
  let isProcessingQueue = false;

  function addToNativeHideQueue(videoNode, isChannelBlocked) {
    if (videoNode.dataset.nativelyHidden) return;
    videoNode.dataset.nativelyHidden = 'queued';
    nativeHideQueue.push({ node: videoNode, isChannelBlocked });
    processNativeHideQueue();
  }

  async function processNativeHideQueue() {
    if (isProcessingQueue || nativeHideQueue.length === 0) return;
    isProcessingQueue = true;

    while (nativeHideQueue.length > 0) {
      const task = nativeHideQueue.shift();
      try {
        await triggerNativeHide(task.node, task.isChannelBlocked);
      } catch (err) {
        console.error('[YTF] Queue Task Failed:', err);
      }
      // Wait a bit between actions to stay under the radar and let UI settle
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    isProcessingQueue = false;
  }

  async function triggerNativeHide(videoNode, isChannelBlocked) {
    videoNode.dataset.nativelyHidden = 'true';

    // 1. Find the "three dots" menu button
    const menuBtn = videoNode.querySelector(
      'button[aria-label*="menu"], yt-icon-button#button, .dropdown-trigger, #menu button, [id="menu"] [id="button"]'
    );
    if (!menuBtn) {
      console.debug('[YTF] No menu button found for video');
      return;
    }

    // Temporarily show the video so the menu can be opened (YouTube logic)
    const oldDisplay = videoNode.style.display;
    const oldOpacity = videoNode.style.opacity;
    const oldPosition = videoNode.style.position;

    videoNode.style.setProperty('display', 'block', 'important');
    videoNode.style.setProperty('opacity', '0.01', 'important');
    videoNode.style.setProperty('position', 'relative', 'important');
    videoNode.style.setProperty('min-height', '20px', 'important');

    try {
      console.debug('[YTF] Triggering menu for:', getVideoTitle(videoNode));
      
      // Emulate hover to ensure YouTube's menu logic is ready
      menuBtn.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      menuBtn.scrollIntoView({ block: 'center', inline: 'center' });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      menuBtn.click();
      
      // 2. Wait for the menu and retry if items aren't loaded yet
      for (let attempt = 0; attempt < 4; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 500));

        // Search for menu items using broader selectors
        const menuItems = document.querySelectorAll(
          'ytd-menu-service-item-renderer, tp-yt-paper-item, ytd-menu-navigation-item-renderer, #items.ytd-menu-popup-renderer > *'
        );

        if (menuItems.length === 0) {
          // If no items found, try clicking the button again (sometimes first click fails)
          if (attempt === 1) menuBtn.click();
          continue;
        }

        let targetItem = null;
        const searchTerms = isChannelBlocked 
          ? ['recommend', 'empfehlen', 'recomendar', 'recommander', 'kanal nicht', 'don\'t recommend'] 
          : ['interested', 'interesse', 'interesa', 'intéressé', 'interessa', 'ausblenden', 'hide'];

        // Path for "Not interested" icon (circle with slash) - matches your screenshot!
        const hideIconPath = 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9C4.63 15.55 4 13.85 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1c1.06 1.35 1.69 3.05 1.69 4.9 0 4.42-3.58 8-8 8z';

        for (const item of menuItems) {
          const text = (item.innerText || item.textContent || '').toLowerCase();
          
          // Strategy A: Match by text
          const textMatch = searchTerms.some(term => text.includes(term));
          
          // Strategy B: Match by Icon Path (very robust)
          let iconMatch = false;
          const svgPath = item.querySelector('path');
          if (svgPath && svgPath.getAttribute('d') === hideIconPath) {
            iconMatch = true;
          }

          if (textMatch || iconMatch) {
            targetItem = item;
            break;
          }
        }

        if (targetItem) {
          console.log('[YTF] Natively hiding:', getVideoTitle(videoNode));
          targetItem.click();
          
          // Give YouTube a moment to process the click before closing
          await new Promise(resolve => setTimeout(resolve, 200));
          break; 
        }
      }

      // Close menu
      document.body.click();

    } catch (err) {
      console.error('[YTF] Error during native hide:', err);
    } finally {
      // Restore hidden state
      videoNode.style.setProperty('display', oldDisplay);
      videoNode.style.setProperty('opacity', oldOpacity);
      videoNode.style.setProperty('position', oldPosition);
      videoNode.style.removeProperty('min-height');
    }
  }

})(); // End of IIFE
