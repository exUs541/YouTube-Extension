/**
 * ============================================================
 * YouTube Video Filter (Enhanced) – content.js
 * Version: 4.2.0
 * ============================================================
 *
 * WAS MACHT DIESE DATEI?
 * ----------------------
 * Diese Datei ist das sogenannte "Content Script". Sie wird automatisch
 * von Chrome in jede YouTube-Seite injiziert, sobald du dort bist.
 * Das bedeutet: Wenn du youtube.com besuchst, läuft dieser Code
 * unsichtbar im Hintergrund und verändert die Seite nach deinen Einstellungen.
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
  // SCHRITT 2: EINSTELLUNGEN AUS DEM BROWSER LADEN
  // ════════════════════════════════════════════════════════════
  //
  // Diese Funktion liest die gespeicherten Einstellungen aus dem Browser
  // und startet danach alle Filter-Funktionen.
  //
  // WIE FÜGE ICH EINE NEUE EINSTELLUNG HINZU?
  // 1. Füge den Schlüssel in das Array bei chrome.storage.sync.get() hinzu
  // 2. Speichere den Wert in der settings-Variable
  // 3. Nutze ihn in einer der Filter-Funktionen
  //
  function loadSettings() {
    // Chrome liest folgende Schlüssel aus dem Sync-Speicher (geräteübergreifend):
    chrome.storage.sync.get(
      ['detoxSettings', 'sidepanelSettings', 'channelRules', 'blockedVideos', 'blockedChannels', 'extensionEnabled'],
      (data) => {

        // Wenn die Extension deaktiviert ist → alles rückgängig machen und aufhören
        if (data.extensionEnabled === false) {
          console.log('[YouTube Filter] Extension is DISABLED. Skipping all filters.');
          disableAll();
          return;
        }

        // Daten in die settings-Variable kopieren (mit leeren Standardwerten als Fallback)
        settings.detoxSettings    = data.detoxSettings    || {};
        settings.sidepanelSettings= data.sidepanelSettings|| {};
        settings.channelRules     = data.channelRules     || [];
        settings.blockedVideos    = data.blockedVideos    || [];

        // WICHTIG: blockedChannels kann alte String-Einträge oder neue Objekte enthalten.
        // Wir normalisieren alles zu Objekten mit { handle, name }.
        settings.blockedChannels = (data.blockedChannels || []).map(b =>
          typeof b === 'string'
            ? { handle: b, name: b }   // Alter Eintrag: String → in Objekt umwandeln
            : b                         // Neuer Eintrag: ist schon ein Objekt
        );

        // Jetzt Funktionen aufrufen, die die Seite filtern:
        initBaseStyles();       // CSS-Klassen für das Ausblenden einrichten
        updateContextualUI();   // Klassen auf <body> anwenden (hide-shorts, etc.)
        filterAll();            // Alle Videos auf der Seite filtern
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
  // SCHRITT 3: CSS-STILE EINFÜGEN (das "Hide-System")
  // ════════════════════════════════════════════════════════════
  //
  // Wir fügen ein <style>-Tag in die YouTube-Seite ein.
  // Darin definieren wir CSS-Regeln, die bestimmte Elemente ausblenden,
  // WENN der <body> bestimmte Klassen hat (z.B. "hide-shorts").
  //
  // WIE FUNKTIONIERT DAS?
  // .body.hide-shorts [...] { display: none !important; }
  //   → Wenn <body class="hide-shorts"> ist, wird das Element unsichtbar.
  //   → updateContextualUI() setzt/entfernt diese Klassen dynamisch.
  //
  // WIE FÜGE ICH EINE NEUE HIDE-REGEL HINZU?
  // 1. Kopiere eine bestehende Regel, z.B.:
  //    body.hide-xyz ytd-irgendwas { display: none !important; }
  // 2. Ersetze "xyz" und "ytd-irgendwas" mit deinem Selektor
  // 3. Setze die Klasse in updateContextualUI() mit body.classList.toggle()
  //
  function initBaseStyles() {
    // Pruefe ob das Style-Tag schon existiert (damit wir es nicht doppelt einfügen)
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

        /* Rechtliches / Legal in der Sidebar */
        body.side-hide-legal ytd-guide-footer-renderer,
        body.side-hide-legal #footer.ytd-guide-renderer,
        body.side-hide-legal ytd-guide-section-renderer:has(a[href="/reporthistory"]) { display: none !important; }

        /* YouTube-Logo-Klick-Deaktivierung (für Home-Redirect) */
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
      `;
      document.head.appendChild(styleEl);
    }
  }


  // ════════════════════════════════════════════════════════════
  // SCHRITT 4: BODY-KLASSEN AKTUALISIEREN (Hauptfilter-Schalter)
  // ════════════════════════════════════════════════════════════
  //
  // Diese Funktion liest die aktuellen Einstellungen und setzt/entfernt
  // CSS-Klassen auf dem <body>-Element der YouTube-Seite.
  //
  // BEISPIEL: Wenn hideShorts = true
  //   → body.classList.toggle('hide-shorts', true)
  //   → <body class="hide-shorts">
  //   → Die CSS-Regel "body.hide-shorts ytd-...-shorts { display:none }" greift
  //
  // WIE FÜGE ICH EINEN NEUEN SCHALTER HINZU?
  // 1. Füge einen Eintrag in detoxSettings (popup.js) hinzu
  // 2. Füge hier eine body.classList.toggle()-Zeile hinzu
  // 3. Definiere die CSS-Regel in initBaseStyles()
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

    handleRedirection(activeRules.redirectHomeToSubs);
  }


  // ════════════════════════════════════════════════════════════
  // HILFSFUNKTION: Abonnements automatisch aufklappen
  // ════════════════════════════════════════════════════════════
  //
  // Klickt den "Mehr anzeigen"-Button in der Abonnements-Liste
  // der Seitenleiste, wenn die Einstellung "autoExpandSubs" aktiv ist.
  //
  function autoExpandSubscriptions() {
    // Suche den "Mehr anzeigen"-Button in der Abonnements-Sektion:
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
  // HILFSFUNKTION: Aktuellen Kanal der Seite ermitteln
  // ════════════════════════════════════════════════════════════
  //
  // Diese Funktion erkennt, auf welcher Kanal-Seite wir uns befinden.
  // Wird genutzt für:
  // 1. Kanal-spezifische Regeln in updateContextualUI()
  // 2. den "Block Channel"-Button auf Kanal-Seiten
  //
  // GIBT ZURÜCK: { text: "Kanal-Name", handle: "@KanalHandle" }
  //
  function getCurrentPageChannel() {
    // Strategie 1: Kanal-Name aus dem Header der Kanal-Seite lesen
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
  // HILFSFUNKTION: Startseiten-Weiterleitung (Home → Abonnements)
  // ════════════════════════════════════════════════════════════
  //
  // Wenn "Redirect Home to Subs" aktiv ist, wird der Benutzer automatisch
  // von youtube.com auf youtube.com/feed/subscriptions weitergeleitet.
  //
  function handleRedirection(enabled) {
    if (!enabled) return;
    const isHome = window.location.pathname === '/' || window.location.pathname === '/index.html';
    if (isHome) window.location.replace('/feed/subscriptions');

    // YouTube-Logo-Klick abfangen (verhindert, dass man zurück zur Startseite kommt):
    const logo = document.querySelector('a#logo');
    if (logo && !logo.dataset.intercepted) {
      logo.addEventListener('click', (e) => {
        if (settings.detoxSettings.redirectHomeToSubs) {
          e.preventDefault();
          window.location.href = '/feed/subscriptions';
        }
      });
      logo.dataset.intercepted = 'true'; // Merke, dass wir schon einen Listener haben
    }
  }


  // ════════════════════════════════════════════════════════════
  // FILTER-LOGIK: Hilfsfunktionen
  // ════════════════════════════════════════════════════════════

  /**
   * Zeitstring (z.B. "1:23:45" oder "5:30") in Sekunden umrechnen.
   * Wird genutzt um Min/Max-Dauer-Filter anzuwenden.
   * Gibt null zurück, wenn der String kein gültiges Format hat.
   *
   * BEISPIELE:
   *   "1:30"    → 90 Sekunden
   *   "1:00:00" → 3600 Sekunden
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
   * Den Zeitstempel-Text (z.B. "5:30") aus einem Video-Karten-Element lesen.
   * Der Zeitstempel wird als Badge auf dem Thumbnail angezeigt.
   *
   * HINWEIS: YouTube nutzt verschiedene Elemente für den Badge.
   * Wir probieren beide aus.
   */
  function getDurationText(videoNode) {
    // Suche nach dem Time-Badge:
    const badge = videoNode.querySelector(
      'ytd-thumbnail-overlay-time-status-renderer, yt-thumbnail-badge-view-model'
    );
    if (badge) {
      const textEl = badge.querySelector('div, span, #text');
      if (textEl) {
        const text = textEl.innerText.trim();
        // Prüfe, dass es wirklich eine Zeitangabe ist (enthält ":"):
        if (text.includes(':')) return text;
      }
    }
    return null; // Kein Zeitstempel gefunden
  }

  /**
   * Prüft ob ein Video ein YouTube Short ist.
   * Nutzt 3 verschiedene Erkennungsmethoden für Robustheit.
   *
   * SHORTS sind:
   * - Sehr kurze Videos (< 60 Sekunden)
   * - Mit /shorts/ in der URL
   * - Mit speziellem "SHORTS" Badge
   */
  function isShort(videoNode) {
    // Methode 1: URL enthält "/shorts/"
    const link = videoNode.querySelector('a[href*="/shorts/"]');
    if (link) return true;

    // Methode 2: Das Overlay-Badge hat den Typ "SHORTS"
    const overlay = videoNode.querySelector(
      'ytd-thumbnail-overlay-time-status-renderer[overlay-style="SHORTS"]'
    );
    if (overlay) return true;

    // Methode 3: Das Shorts-Logo (SVG-Pfad) ist vorhanden
    if (videoNode.querySelector('path[d^="m13.467 1.19"]')) return true;

    return false; // Kein Short-Merkmal gefunden
  }

  /**
   * Text normalisieren für Vergleiche.
   * Wichtig für Türkisch: "I" (groß) → "ı" (klein ohne Punkt), nicht "i"
   *
   * BEISPIELE:
   *   "MrBeast"  → "mrbeast"
   *   "@CoolCat" → "@coolcat"
   *   "%40Kanal" → "@kanal"  (URL-Dekodierung)
   */
  function normalizeText(text) {
    if (!text) return '';
    try {
      // Erst URL-Encoding auflösen (%40 → @, %C3%96 → Ö, etc.):
      const decoded = decodeURIComponent(text.toString());
      // Dann Kleinschreibung mit türkischer Locale (für dotless-i Unterstützung):
      return decoded.toLocaleLowerCase('tr-TR').trim();
    } catch (e) {
      // Falls decodeURIComponent fehlschlägt (ungültige Kodierung):
      return text.toString().toLocaleLowerCase('tr-TR').trim();
    }
  }

  /**
   * Den Titel eines Videos aus einer Video-Karte lesen.
   * Unterstützt sowohl das alte als auch das neue YouTube-Layout.
   */
  function getVideoTitle(videoNode) {
    // Versuche verschiedene Selektoren (YouTube wechselt diese gelegentlich):
    const titleEl = videoNode.querySelector(
      'a#video-title, a#video-title-link, #video-title-link, #video-title, .yt-lockup-metadata-view-model__title'
    );
    if (!titleEl) return '';

    // Das "title"-Attribut enthält meistens den saubersten Text:
    let attrTitle = titleEl.getAttribute('title');

    // Fallback: Manchmal ist der Titel im übergeordneten <h3> Element:
    if (!attrTitle) {
      const h3 = titleEl.closest('h3');
      if (h3) attrTitle = h3.getAttribute('title');
    }

    if (attrTitle) return attrTitle.trim();

    // Letzter Fallback: Direkt den Textinhalt lesen:
    return (titleEl.innerText || titleEl.textContent || '').replace(/\s\s+/g, ' ').trim();
  }

  /**
   * Den Kanalname und den Handle (@...) aus einer Video-Karte lesen.
   *
   * YouTube hat 4 verschiedene Layouts. Wir versuchen alle 4 Strategien:
   * - A: Klassisches Layout mit ytd-channel-name
   * - B: Neues "lockup" Layout (yt-content-metadata-view-model)
   * - C: Fallback über Channel-Links (/@handle)
   * - D: yt-formatted-string Fallback
   *
   * GIBT ZURÜCK: { text: "Kanal-Name", handle: "@handle", elFound: DOM-Element }
   *
   * HOW TO ADD A NEW STRATEGY:
   * Kopiere einen der "Strategy X"-Blöcke und passe die querySelector-Selektoren an.
   */
  function getChannelInfo(videoNode) {
    let text = '', handle = '', elFound = null;

    // ── Strategie A: Klassisches ytd-Layout ─────────────────
    // Sucht nach einem "a"-Link innerhalb von ytd-channel-name oder #channel-name:
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
    // Im neuen Layout (yt-lockup-view-model) gibt es KEINEN <a>-Tag mit Kanal-URL.
    // Der Kanalname steht als reiner Text in einem <span> in der Metadaten-Zeile.
    // Struktur: yt-lockup-metadata-view-model > yt-content-metadata-view-model
    //             > div.metadata-row > span (Kanalname) | span (Trenner) | span (Aufrufe)
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
  // 🚫 BLOCK-BUTTON NEBEN DEM KANALNAMEN EINFÜGEN
  // ════════════════════════════════════════════════════════════
  //
  // Der 🚫-Button erscheint IMMER direkt neben dem Kanalnamen.
  // So ist sofort klar: "Ich blockiere diesen KANAL" (nicht das Video).
  //
  // Diese Funktion nutzt das `elFound`-Element aus getChannelInfo(),
  // das ist das DOM-Element das den Kanalnamen enthält.
  // Der Button wird direkt daneben eingefügt (insertAdjacentElement).
  //
  // UNTERSTÜTZTE LAYOUTS:
  // - Startseite:       ytd-channel-name > a (Kanalname als Link)
  // - Suchergebnisse:   ytd-channel-name > a
  // - Empfehlungsliste: span in yt-content-metadata-view-model (reiner Text)
  // - Kanal-Seite:      eigener Button in processChannelPage()
  //
  // WIE ÄNDERE ICH DAS ICON?
  // Ändere btn.textContent = '🚫' zu einem anderen Emoji, z.B.:
  //   '❌' '✖' '🔇' '👁‍🗨' oder ein beliebiges Zeichen.
  //
  function injectBlockButton(videoNode, chanName, chanHandle, chanElement) {
    // Guard 1: Button schon eingefügt? → nichts tun
    if (videoNode.querySelector('.ytf-block-btn')) return;

    // Guard 2: Kein Kanalname bekannt? → Abbrechen (wird beim nächsten Intervall erneut versucht)
    if (!chanHandle && !chanName) return;

    // ── Das Kanal-Element finden (wo der Button eingefügt wird) ────
    // Priorität: Das übergebene chanElement > eigene Suche
    //
    // WICHTIG: Wir suchen nach VERSCHIEDENEN Selektoren, weil YouTube
    // je nach Seitentyp unterschiedliche Elemente für den Kanalnamen nutzt.
    //
    let targetEl = chanElement;  // Das Element direkt neben dem Kanalnamen

    if (!targetEl) {
      // Strategie 1: Klassisches Layout — ytd-channel-name enthält den Link
      targetEl = videoNode.querySelector('ytd-channel-name yt-formatted-string#text');
    }
    if (!targetEl) {
      // Strategie 2: Klassisches Layout — Link innerhalb von ytd-channel-name
      targetEl = videoNode.querySelector('ytd-channel-name a');
    }
    if (!targetEl) {
      // Strategie 3: Neues Lockup-Layout — erster Span in den Metadaten
      // Der Kanalname ist hier reiner Text (kein Link)
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
      // Strategie 4: Allgemeiner Fallback — irgendein Kanalname-Link
      targetEl = videoNode.querySelector('#channel-name a, #byline-container a');
    }

    // Kein Kanalnamen-Element gefunden → Abbrechen
    if (!targetEl) return;

    // ── Button erstellen ───────────────────────────────────
    const btn = document.createElement('button');
    btn.className = 'ytf-block-btn';
    btn.textContent = '🚫';
    btn.title = `Block "${chanName || chanHandle}" — Alle Videos von diesem Kanal verstecken`;

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
  // KERN-FUNKTION: Ein einzelnes Video verarbeiten
  // ════════════════════════════════════════════════════════════
  //
  // Diese Funktion wird für JEDE Video-Karte auf der Seite aufgerufen.
  // Sie entscheidet, ob ein Video sichtbar oder versteckt werden soll.
  //
  // REIHENFOLGE DER REGELN (von höchster zu niedrigster Priorität):
  //   REGEL 0 → Blockierte Kanäle (immer versteckt, KEINE Ausnahmen)
  //   REGEL 1 → Kanal-Titel-Keywords (zeige/verstecke basierend auf Titel)
  //   REGEL 2 → Globale Shorts-Einstellung
  //   REGEL 3 → Kanal-spezifische Regeln (Dauer, Shorts)
  //
  // WIE FÜGE ICH EINE NEUE FILTER-REGEL HINZU?
  // 1. Lese den Wert aus settings.detoxSettings oder settings.channelRules
  // 2. Setze shouldHide = true wenn der Filter greift
  // 3. Füge eine forcedShow-Ausnahme hinzu wenn nötig
  //
  function processVideo(videoNode) {
    // Guard: Schon blockiert → nicht nochmal verarbeiten
    if (!videoNode || videoNode.dataset.filtered === 'true_blocked') return;

    // Kanal-Informationen aus der Video-Karte lesen:
    // elFound = das DOM-Element das den Kanalnamen enthält (für Button-Platzierung)
    const { text: chanName, handle: chanHandle, elFound: chanElement } = getChannelInfo(videoNode);

    // Video-Informationen:
    const duration       = parseDuration(getDurationText(videoNode));
    const isAVideoShort  = isShort(videoNode);

    // Normalisierte Versionen für Vergleiche (case-insensitiv, türkisch-kompatibel):
    const normChanHandle = normalizeText(chanHandle);
    const normChanName   = normalizeText(chanName);

    // ═══ TEMPORÄRES DEBUG-LOG ═══
    // Dieses Log erscheint in der Browser-Console (F12).
    // Damit du sehen kannst, welcher Kanal erkannt wird.
    // Kann später entfernt werden wenn alles funktioniert.
    if (chanName || chanHandle) {
      console.log('[YTF Debug] Video:', chanName, '|', chanHandle,
        '| blocked:', settings.blockedChannels?.length || 0, 'channels',
        '| tag:', videoNode.tagName);
    }
    // ═══ ENDE DEBUG-LOG ═══

    // Passende Kanal-Regel suchen (wenn vorhanden):
    const rule = settings.channelRules.find(r =>
      normalizeText(r.handle) === normChanHandle ||
      normalizeText(r.name)   === normChanName
    );

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
  // DOM-BEOBACHTER: Neue Videos automatisch filtern
  // ════════════════════════════════════════════════════════════
  //
  // YouTube lädt Videos dynamisch nach (Infinite Scroll, Navigation).
  // Ein MutationObserver überwacht die Seite auf neue Elemente.
  // Wenn ein neues Video-Element hinzugefügt wird → processVideo() aufrufen.
  //
  // HINWEIS: Wir fügen ytd-compact-video-renderer HIER hinzu, damit auch
  // neue Empfehlungen in der Sidebar sofort gefiltert werden!
  //
  const observer = new MutationObserver((mutations) => {
    updateContextualUI();
    if (settings.sidepanelSettings.autoExpandSubs) autoExpandSubscriptions();

    // Alle Änderungen durchgehen:
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        // Nur Elemente (keine Texte, keine Kommentare):
        if (node.nodeType !== 1) continue;

        // Liste der Video-Elemente die wir beobachten:
        const videoSelectors = [
          'ytd-rich-item-renderer',
          'ytd-video-renderer',
          'ytd-grid-video-renderer',
          'ytd-compact-video-renderer',  // ← Diese Zeile ist wichtig für die Sidebar!
          'yt-lockup-view-model',
          'ytd-rich-grid-media',
          'ytd-reel-item-renderer'
        ];

        // Fall A: Das neu hinzugefügte Element ist selbst ein Video-Element:
        if (videoSelectors.some(sel => node.matches && node.matches(sel))) {
          processVideo(node);
        } else {
          // Fall B: Das Element enthält Video-Elemente (z.B. ein Container):
          videoSelectors.forEach(sel => node.querySelectorAll(sel).forEach(processVideo));
        }
      }
    }
  });

  // Beobachtung starten (auf der ganzen ytd-app oder dem body-Element):
  const target = document.querySelector('ytd-app') || document.body;
  observer.observe(target, { childList: true, subtree: true });


  // ════════════════════════════════════════════════════════════
  // EXTENSION DEAKTIVIEREN (alles zurücksetzen)
  // ════════════════════════════════════════════════════════════
  //
  // Wird aufgerufen wenn der Benutzer die Extension über den Toggle ausschaltet.
  // Entfernt alle unsere CSS-Klassen und -Elemente von der Seite.
  //
  function disableAll() {
    // Unsere Style-Tags entfernen:
    document.getElementById('yt-filter-priority-styles')?.remove();

    // Alle unsere Body-Klassen entfernen:
    document.body.className = document.body.className
      .replace(/\bhide-[^ ]+/g, '')
      .replace(/\bside-hide-[^ ]+/g, '');

    // Alle ausgeblendeten Videos wieder einblenden:
    document.querySelectorAll('[data-filtered]').forEach(el => {
      el.style.display = '';
      el.removeAttribute('hidden');
      el.dataset.filtered = '';
    });

    // Alle unsere eingefügten Block-Buttons entfernen:
    document.querySelectorAll(
      '.ytf-block-btn, .ytf-block-channel-header, .ytf-block-channel-name-icon, .yt-filter-block-btn, .yt-filter-block-btn-header'
    ).forEach(el => el.remove());

    // Logo-Redirect-Listener zurücksetzen:
    const logo = document.querySelector('a#logo');
    if (logo) logo.dataset.intercepted = '';
  }


  // ════════════════════════════════════════════════════════════
  // KANAL-SEITE: Block-Button einfügen
  // ════════════════════════════════════════════════════════════
  //
  // Wenn der Benutzer eine YouTube-Kanal-Seite besucht (z.B. youtube.com/@MrBeast),
  // werden zwei Block-Elemente eingefügt:
  //
  // 1. 🚫-Icon NEBEN DEM KANAL-NAMEN (Punkt 2 deiner Anfrage!)
  //    → Klein und diskret, direkt im Titel
  //    → CSS-Klasse: .ytf-block-channel-name-icon
  //
  // 2. "🚫 Block Channel"-BUTTON NEBEN DEM SUBSCRIBE-BUTTON
  //    → Groß und gut sichtbar, rot
  //    → CSS-Klasse: .ytf-block-channel-header
  //
  // WENN DER KANAL BEREITS BLOCKIERT IST:
  //    → Weiterleitung zur Startseite (damit man nicht versehentlich die Seite sieht)
  //
  function processChannelPage() {
    const path = window.location.pathname;

    // Prüfen ob wir auf einer Kanal-Seite sind:
    const isChannelPage = path.startsWith('/@') ||
                          path.startsWith('/channel/') ||
                          path.startsWith('/c/');
    if (!isChannelPage) return;

    // Kanal-Information von der aktuellen Seite holen:
    const { text: chanName, handle: chanHandle } = getCurrentPageChannel();
    const handleToBlock = chanHandle || chanName;
    if (!handleToBlock) return; // Noch nicht geladen → nächster setInterval-Versuch

    // Normalisierte Versionen für Vergleiche:
    const normHandle = normalizeText(handleToBlock);
    const normName   = normalizeText(chanName);

    // Prüfen ob dieser Kanal bereits blockiert ist:
    const isBlocked = (settings.blockedChannels || []).some(b => {
      const bHandle = normalizeText(typeof b === 'string' ? b : b.handle);
      const bName   = normalizeText(typeof b === 'string' ? b : (b.name || b.handle));
      return bHandle === normHandle || bHandle === normName ||
             bName   === normHandle || bName   === normName;
    });

    // Bereits blockiert → sofort weiterleiten:
    if (isBlocked) {
      window.location.replace('/');
      return;
    }

    // ── Block-Button-Logik (gemeinsam genutzte Funktion) ────
    // Erstellt den "Kanal blockieren"-Handler für beide Buttons:
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
              window.location.replace('/'); // Zur Startseite zurück nach dem Blockieren
            });
          }
        });
      }
    };

    // ── 1. 🚫-Icon neben dem Kanal-Namen ────────────────────
    //
    // Der Kanal-Name steht im Header der Kanal-Seite.
    // WO? Meist in: #channel-name #text oder yt-dynamic-text-view-model
    // Das Icon erscheint direkt dahinter als kleiner, klickbarer Emoji.
    //
    if (!document.querySelector('.ytf-block-channel-name-icon')) {
      // Verschiedene Selektoren für den Kanal-Titel im Header probieren:
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
        // Stil: Klein, inline, dezent – direkt neben dem Kanal-Namen
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
        // Icon als letztes Kind des Titel-Elements einf ügen:
        channelTitleEl.appendChild(iconBtn);
      }
    }

    // ── 2. "🚫 Block Channel"-Button neben Subscribe ────────
    //
    // Dieser große rote Button erscheint direkt neben dem Abonnieren-Button.
    // Er ist gut sichtbar und für schnelles Blockieren gedacht.
    //
    if (!document.querySelector('.ytf-block-channel-header')) {
      // Subscribe-Button finden (YouTube nutzt verschiedene Selektoren je nach Layout):
      const subscribeBtn =
        document.querySelector('ytd-subscribe-button-renderer') ||
        document.querySelector('yt-subscribe-button-shape')     ||
        document.querySelector('button[aria-label*="bbonn"]')   ||
        document.querySelector('button[aria-label*="ubscri"]');

      if (!subscribeBtn) return; // Noch nicht geladen → nächster setInterval-Versuch

      const headerBtn = document.createElement('button');
      headerBtn.className = 'ytf-block-channel-header';
      headerBtn.textContent = '🚫 Block Channel';
      // Stil ähnlich wie YouTube-eigene Buttons:
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

      // Button direkt nach dem Subscribe-Button einfügen:
      subscribeBtn.insertAdjacentElement('afterend', headerBtn);
    }
  }


  // ════════════════════════════════════════════════════════════
  // NACHRICHTEN-LISTENER: Befehle vom Popup empfangen
  // ════════════════════════════════════════════════════════════
  //
  // Das Popup (popup.js) kann Nachrichten an dieses Content-Script senden.
  // Aktuell wird nur 'refresh' genutzt, um die Einstellungen neu zu laden.
  //
  // WIE FÜGE ICH EINE NEUE NACHRICHT HINZU?
  // 1. Hier: if (request.action === 'meineAktion') { ... }
  // 2. Im Popup: chrome.tabs.sendMessage(tab.id, { action: 'meineAktion' })
  //
  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'refresh') loadSettings();
  });


  // ════════════════════════════════════════════════════════════
  // START: Alles ausführen
  // ════════════════════════════════════════════════════════════

  // Beim ersten Laden sofort alles filtern:
  filterAll();
  processChannelPage();

  // Bei YouTube-Navigation (SPA: Single Page App Navigation):
  // YouTube lädt Seiten ohne vollständigen Browser-Reload.
  // Dieses Event wird ausgelöst wenn YouTube intern navigiert.
  window.addEventListener('yt-navigate-finish', () => {
    updateContextualUI();
    if (settings.sidepanelSettings.autoExpandSubs) autoExpandSubscriptions();
    setTimeout(filterAll, 1000); // 1s warten bis die Seite gerendert ist
    processChannelPage();
  });

  // Backup: Alle 3 Sekunden nochmal alles filtern.
  // Das fängt Elemente auf die der Observer oder navigate-finish Event verpasst hat.
  // HINWEIS: Wenn du Performance-Probleme hast, erhöhe diesen Wert (z.B. 5000 = 5 Sekunden).
  setInterval(() => {
    filterAll();
    processChannelPage();
  }, 3000);

})(); // Ende der IIFE (Immediately Invoked Function Expression)
     // Die () am Ende sorgt dafür, dass die Funktion sofort ausgeführt wird.
     // Das schützt unsere Variablen vor Konflikten mit anderen Scripts.
