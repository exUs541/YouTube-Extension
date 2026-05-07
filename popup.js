// ════════════════════════════════════════════════════════════
// DUAL-STORAGE SYSTEM: sync + local Backup
// ════════════════════════════════════════════════════════════
//
// WHY DUAL STORAGE?
//   - chrome.storage.sync  → Synchronized across all devices with the same
//     Google account. Can be empty briefly after extension reload
//     until Google provides the data.
//   - chrome.storage.local → Local backup. Always immediately available,
//     persists even after extension reload.
//
// STRATEGY:
//   Write: Always to BOTH storages simultaneously.
//   Read:  First sync, then local as fallback.
//   → Settings are NEVER lost, even after reload.
//
const STORAGE_KEYS = [
    'detoxSettings', 'sidepanelSettings', 'channelRules',
    'blockedChannels', 'appearance', 'extensionEnabled'
];

/**
 * Saves data to sync AND local simultaneously.
 * @param {object} data     - Key-value pairs to be saved
 * @param {function} [cb]   - Optional callback after saving
 */
function storageSave(data, cb) {
    // Write to Sync (cross-device):
    chrome.storage.sync.set(data, () => {
        // Simultaneously update local backup:
        chrome.storage.local.set(data, () => {
            if (cb) cb();
        });
    });
}

/**
 * Reads data — first from sync, then from local as fallback.
 * Intelligently combines both sources: local data fills gaps in sync.
 * @param {string[]} keys   - Array of keys to be read
 * @param {function} cb     - Callback with the read data
 */
function storageLoad(keys, cb) {
    chrome.storage.sync.get(keys, (syncData) => {
        const syncHasData = keys.some(k => syncData[k] !== undefined);
        if (syncHasData) {
            // Sync has data — but supplement missing fields from local (fallback)
            chrome.storage.local.get(keys, (localData) => {
                const merged = {};
                keys.forEach(k => {
                    merged[k] = syncData[k] !== undefined ? syncData[k] : localData[k];
                });
                cb(merged);
            });
        } else {
            // Sync is empty (e.g. directly after reload or no Google account) →
            // Load completely from local:
            chrome.storage.local.get(keys, (localData) => {
                if (Object.keys(localData).length > 0) {
                    console.log('[YTFilter] Sync empty — loading from local backup.');
                    // Write local data back to sync (for later synchronization):
                    chrome.storage.sync.set(localData);
                }
                cb(localData);
            });
        }
    });
}


document.addEventListener('DOMContentLoaded', () => {
    const manifest = chrome.runtime.getManifest();
    const versionStr = `v${manifest.version}`;
    const appVerEl = document.getElementById('app-current-version');
    const clVerEl = document.getElementById('changelog-current-version');
    if (appVerEl) appVerEl.innerText = versionStr;
    if (clVerEl) clVerEl.innerText = versionStr;

    // Tab switching
    const tabBtns = document.querySelectorAll('.tab-btn');
    function switchTab(btn) {
        tabBtns.forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => { c.classList.remove('active'); c.style.display = 'none'; });
        btn.classList.add('active');
        const content = document.getElementById(btn.dataset.tab);
        if (content) { content.classList.add('active'); content.style.display = 'flex'; }
    }
    tabBtns.forEach(btn => btn.onclick = () => switchTab(btn));

    // Translation Engine (v4.1.1)
    let currentTranslations = null;

    function getMsg(key) {
        if (currentTranslations && currentTranslations[key]) return currentTranslations[key].message;
        const msg = chrome.i18n.getMessage(key);
        return msg || key;
    }

    async function applyTranslations() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const message = getMsg(key);
            if (message) {
                if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                    el.placeholder = message;
                } else if (el.tagName === 'OPTION') {
                    if (el.parentElement && el.parentElement.id === 'emoji-theme-preset') return;
                    el.text = message;
                } else {
                    el.innerText = message;
                }
            }
        });
        const handleInput = document.getElementById('new-channel-handle');
        if (handleInput) handleInput.placeholder = getMsg('placeholderChannel') || '@ChannelHandle';
    }

    async function loadLanguage(lang) {
        if (lang === 'auto' || !lang) {
            currentTranslations = null;
        } else {
            try {
                const response = await fetch(chrome.runtime.getURL(`_locales/${lang}/messages.json`));
                if (response.ok) currentTranslations = await response.json();
            } catch (e) {
                console.error('Failed to load language:', lang, e);
                currentTranslations = null;
            }
        }
        await applyTranslations();
        if (settingsData.channelRules && settingsData.channelRules.length > 0) {
            processAndRenderChannels(settingsData.channelRules);
        }
    }

    // Settings state
    let settingsData = {
        detoxSettings: {},
        sidepanelSettings: {},
        channelRules: [],
        blockedChannels: [],
        appearance: { 
            theme: 'dark', accentColor: '#ff0000', emojiTheme: 'classic',
            emojis: { visible: '👁️', hidden: '🙈', active: '✅', inactive: '❌' },
            language: 'auto'
        },
        extensionEnabled: true
    };

    const emojiThemes = {
        classic: { visible: '👁️', hidden: '🙈', active: '✅', inactive: '❌' },
        privacy: { visible: '🛡️', hidden: '🚫', active: '🟢', inactive: '🔴' },
        check: { visible: '✔️', hidden: '✖️', active: '🔘', inactive: '⚪' },
        pulse: { visible: '🔴', hidden: '⚪', active: '🔴', inactive: '🔘' }
    };

    const expandedChannels = new Set();

    function applyAppearance() {
        const app = settingsData.appearance;
        document.body.classList.toggle('light-theme', app.theme === 'light');
        document.documentElement.style.setProperty('--accent-color', app.accentColor);
        
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.innerText = app.theme === 'light' ? (app.emojis.active || '✅') : (app.emojis.inactive || '❌');
        }

        if (document.getElementById('primary-color')) {
            document.getElementById('primary-color').value = app.accentColor;
            document.getElementById('hex-color').value = app.accentColor.toUpperCase();
            document.getElementById('emoji-theme-preset').value = app.emojiTheme || 'custom';
            document.getElementById('language-selector').value = app.language || 'auto';
            document.getElementById('emoji-visible').value = app.emojis.visible;
            document.getElementById('emoji-hidden').value = app.emojis.hidden;
            document.getElementById('emoji-active').value = app.emojis.active;
            document.getElementById('emoji-inactive').value = app.emojis.inactive;
        }
    }

    function updateEyeVisuals() {
        const emojis = settingsData.appearance.emojis;
        document.querySelectorAll('.eye-toggle').forEach(el => {
            const id = el.dataset.id;
            if (!id || id === 'app-light-mode') return;

            let val = false;
            if (id.startsWith('side-')) {
                const map = {
                    'side-hide-home': 'hideHome',
                    'side-hide-shorts': 'hideShorts',
                    'side-hide-subs': 'hideSubs',
                    'side-hide-you': 'hideYou',
                    'side-hide-explore': 'hideExplore',
                    'side-hide-more': 'hideMoreFromYT',
                    'side-hide-report': 'hideReportHistory',
                    'side-hide-legal': 'hideLegal',
                    'side-hide-guide': 'hideGuide',
                    'side-auto-expand-subs': 'autoExpandSubs'
                };
                val = settingsData.sidepanelSettings[map[id]] || false;
            } else {
                const map = {
                    'detox-redirect-subs': 'redirectHomeToSubs', 'detox-home-feed': 'hideHomeFeed', 'detox-sidebar': 'hideSidebar',
                    'detox-comments': 'hideComments', 'detox-shorts': 'hideShorts', 'detox-endscreen': 'hideEndscreen',
                    'detox-notifications': 'hideNotifications', 'detox-trending': 'hideTrending'
                };
                val = settingsData.detoxSettings[map[id]] || false;
            }
            
            if (id === 'detox-redirect-subs' || id === 'side-auto-expand-subs') {
                el.innerText = val ? (emojis.active || '✅') : (emojis.inactive || '❌');
            } else {
                el.innerText = val ? (emojis.hidden || '🙈') : (emojis.visible || '👁️');
            }
        });
    }

    function updatePowerToggleUI() {
        const toggle = document.getElementById('extension-toggle');
        const symbol = toggle.querySelector('.power-symbol');
        if (settingsData.extensionEnabled) {
            toggle.classList.add('active');
            symbol.innerText = 'ON';
        } else {
            toggle.classList.remove('active');
            symbol.innerText = 'OFF';
        }
    }

    function saveGlobalState() {
        // Saves to sync AND local simultaneously:
        storageSave(settingsData, notifyRefresh);
    }

    document.querySelectorAll('.eye-toggle').forEach(el => {
        el.onclick = () => {
            const id = el.dataset.id;
            if (id === 'app-light-mode') {
                settingsData.appearance.theme = settingsData.appearance.theme === 'dark' ? 'light' : 'dark';
                saveGlobalState();
                applyAppearance();
                return;
            }

            if (id.startsWith('side-')) {
                const map = {
                    'side-hide-home': 'hideHome',
                    'side-hide-shorts': 'hideShorts',
                    'side-hide-subs': 'hideSubs',
                    'side-hide-you': 'hideYou',
                    'side-hide-explore': 'hideExplore',
                    'side-hide-more': 'hideMoreFromYT',
                    'side-hide-report': 'hideReportHistory',
                    'side-hide-legal': 'hideLegal',
                    'side-hide-guide': 'hideGuide',
                    'side-auto-expand-subs': 'autoExpandSubs'
                };
                const key = map[id];
                settingsData.sidepanelSettings[key] = !settingsData.sidepanelSettings[key];
            } else {
                const map = {
                    'detox-redirect-subs': 'redirectHomeToSubs', 'detox-home-feed': 'hideHomeFeed', 'detox-sidebar': 'hideSidebar',
                    'detox-comments': 'hideComments', 'detox-shorts': 'hideShorts', 'detox-endscreen': 'hideEndscreen',
                    'detox-notifications': 'hideNotifications', 'detox-trending': 'hideTrending'
                };
                const key = map[id];
                settingsData.detoxSettings[key] = !settingsData.detoxSettings[key];
            }
            saveGlobalState();
            updateEyeVisuals();
        };
    });

    const primaryColorInput = document.getElementById('primary-color');
    const hexColorInput = document.getElementById('hex-color');
    if (primaryColorInput && hexColorInput) {
        primaryColorInput.oninput = (e) => {
            settingsData.appearance.accentColor = e.target.value;
            hexColorInput.value = e.target.value.toUpperCase();
            saveGlobalState();
            applyAppearance();
        };
        hexColorInput.oninput = (e) => {
            let hex = e.target.value;
            if (!hex.startsWith('#')) hex = '#' + hex;
            if (/^#[0-9A-F]{6}$/i.test(hex)) {
                settingsData.appearance.accentColor = hex;
                primaryColorInput.value = hex;
                saveGlobalState();
                applyAppearance();
            }
        };
    }

    const emojiThemeSelect = document.getElementById('emoji-theme-preset');
    if (emojiThemeSelect) {
        emojiThemeSelect.onchange = (e) => {
            const val = e.target.value;
            settingsData.appearance.emojiTheme = val;
            if (emojiThemes[val]) {
                settingsData.appearance.emojis = { ...emojiThemes[val] };
            }
            saveGlobalState();
            applyAppearance();
            updateEyeVisuals();
        };
    }

    ['visible', 'hidden', 'active', 'inactive'].forEach(type => {
        const input = document.getElementById(`emoji-${type}`);
        if (input) {
            input.oninput = (e) => {
                settingsData.appearance.emojis[type] = e.target.value || settingsData.appearance.emojis[type];
                settingsData.appearance.emojiTheme = 'custom';
                saveGlobalState();
                applyAppearance();
                updateEyeVisuals();
            };
        }
    });

    const langSelector = document.getElementById('language-selector');
    if (langSelector) {
        langSelector.onchange = (e) => {
            const lang = e.target.value;
            settingsData.appearance.language = lang;
            saveGlobalState();
            loadLanguage(lang);
        };
    }

    const powerToggle = document.getElementById('extension-toggle');
    if (powerToggle) {
        powerToggle.onclick = () => {
            settingsData.extensionEnabled = !settingsData.extensionEnabled;
            saveGlobalState();
            updatePowerToggleUI();
        };
    }

    function loadAll() {
        // Liest aus sync mit lokalem Fallback (nie leer nach Reload):
        storageLoad(STORAGE_KEYS, (data) => {
            if (data.detoxSettings) settingsData.detoxSettings = data.detoxSettings;
            if (data.sidepanelSettings) settingsData.sidepanelSettings = data.sidepanelSettings;
            if (data.channelRules) settingsData.channelRules = data.channelRules;
            if (data.blockedChannels) settingsData.blockedChannels = data.blockedChannels;
            if (data.appearance) settingsData.appearance = data.appearance;
            if (data.extensionEnabled !== undefined) settingsData.extensionEnabled = data.extensionEnabled;

            applyAppearance();
            updatePowerToggleUI();
            updateEyeVisuals();

            loadLanguage(settingsData.appearance.language || 'auto').then(() => {
                processAndRenderChannels(settingsData.channelRules || []);
                processAndRenderBlockedChannels();
            });
        });
    }

    function addChannelRule(handle) {
        const list = settingsData.channelRules || [];
        const d = settingsData.detoxSettings;
        if (!list.some(r => r.handle === handle)) {
            list.push({
                handle: handle,
                name: handle,
                addedAt: Date.now(),
                rules: { 
                    hideShorts: !!d.hideShorts, hideComments: !!d.hideComments, 
                    hideEndscreen: !!d.hideEndscreen, hideNotifications: !!d.hideNotifications,
                    minDuration: 0, maxDuration: null,
                    titleKeywords: '', titleMode: 'hide', titleMatchType: 'contains'
                }
            });
            settingsData.channelRules = list;
            storageSave({ channelRules: list }, () => {
                const handleInput = document.getElementById('new-channel-handle');
                if (handleInput) handleInput.value = '';
                loadAll();
                notifyRefresh();
            });
        }
    }

    const addRuleBtn = document.getElementById('add-channel-rule-btn');
    if (addRuleBtn) {
        addRuleBtn.onclick = () => {
            const handleInput = document.getElementById('new-channel-handle');
            const handle = handleInput.value.trim();
            if (handle) addChannelRule(handle);
        };
    }

    function processAndRenderChannels(rules) {
        let list = Array.isArray(rules) ? [...rules] : [];
        const filterBy = document.getElementById('filter-by');
        const sortBy = document.getElementById('sort-by');
        
        if (filterBy) {
            const val = filterBy.value;
            if (val !== 'all') {
                list = list.filter(r => {
                    const res = r.rules;
                    if (val === 'shorts') return res.hideShorts === false;
                    if (val === 'comments') return res.hideComments === false;
                    if (val === 'endscreen') return res.hideEndscreen === false;
                    if (val === 'bell') return res.hideNotifications === false;
                    if (val === 'duration') return res.minDuration > 0 || res.maxDuration !== null;
                    return true;
                });
            }
        }
        
        if (sortBy) {
            const val = sortBy.value;
            if (val === 'alpha') list.sort((a, b) => (a.name || a.handle).localeCompare(b.name || b.handle));
            else list.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
        }
        renderChannelRules(list, rules || []);
    }

    function renderChannelRules(visibleRules, allRules) {
        const listEl = document.getElementById('channel-rules-list');
        if (!listEl) return;
        listEl.innerHTML = '';
        const em = settingsData.appearance.emojis;

        if (!Array.isArray(visibleRules)) return;

        visibleRules.forEach((rule) => {
            const index = allRules.findIndex(r => r.handle === rule.handle);
            const card = document.createElement('div');
            card.className = `channel-card ${expandedChannels.has(rule.handle) ? 'expanded' : ''}`;
            card.innerHTML = `
                <div class="card-header"><div class="card-title">${rule.name || rule.handle}</div><div class="expand-icon">▼</div></div>
                <div class="card-body">
                    <div class="keyword-row">
                        <label data-i18n="ruleKeywords">${getMsg('ruleKeywords')}</label>
                        <input type="text" class="title-keywords" value="${rule.rules.titleKeywords || ''}" data-type="keywords">
                        <div class="keyword-row-inputs">
                            <select class="title-mode" data-type="mode">
                                <option value="hide" ${rule.rules.titleMode === 'hide' ? 'selected' : ''} data-i18n="ruleModeHide">${getMsg('ruleModeHide')}</option>
                                <option value="show" ${rule.rules.titleMode === 'show' ? 'selected' : ''} data-i18n="ruleModeShow">${getMsg('ruleModeShow')}</option>
                            </select>
                            <select class="title-match-type" data-type="match">
                                <option value="contains" ${rule.rules.titleMatchType === 'contains' ? 'selected' : ''} data-i18n="matchContains">${getMsg('matchContains')}</option>
                                <option value="starts" ${rule.rules.titleMatchType === 'starts' ? 'selected' : ''} data-i18n="matchStarts">${getMsg('matchStarts')}</option>
                                <option value="ends" ${rule.rules.titleMatchType === 'ends' ? 'selected' : ''} data-i18n="matchEnds">${getMsg('matchEnds')}</option>
                                <option value="exact" ${rule.rules.titleMatchType === 'exact' ? 'selected' : ''} data-i18n="matchExact">${getMsg('matchExact')}</option>
                            </select>
                        </div>
                    </div>
                    <div class="card-grid">
                        <div class="grid-item">
                            <span data-i18n="labelMin">${getMsg('labelMin')}</span>
                            <div class="card-row"><input type="number" class="min-input" value="${rule.rules.minDuration ? Math.round(rule.rules.minDuration / 60) : ''}" placeholder="0"><span data-i18n="labelMinutes">${getMsg('labelMinutes')}</span></div>
                        </div>
                        <div class="grid-item">
                            <span data-i18n="labelMax">${getMsg('labelMax')}</span>
                            <div class="card-row"><input type="number" class="max-input" value="${rule.rules.maxDuration ? Math.round(rule.rules.maxDuration / 60) : ''}" placeholder="∞"><span data-i18n="labelMinutes">${getMsg('labelMinutes')}</span></div>
                        </div>
                    </div>
                    <div class="card-grid" style="margin-top: 10px;">
                        <div class="grid-item">
                            <span data-i18n="labelShorts">${getMsg('labelShorts')}</span>
                            <div class="eye-toggle rule-shorts" data-active="${rule.rules.hideShorts}">${rule.rules.hideShorts ? em.hidden : em.visible}</div>
                        </div>
                        <div class="grid-item">
                            <span data-i18n="labelComments">${getMsg('labelComments')}</span>
                            <div class="eye-toggle rule-comments" data-active="${rule.rules.hideComments}">${rule.rules.hideComments ? em.hidden : em.visible}</div>
                        </div>
                        <div class="grid-item">
                            <span data-i18n="labelEndscreen">${getMsg('labelEndscreen')}</span>
                            <div class="eye-toggle rule-endscreen" data-active="${rule.rules.hideEndscreen}">${rule.rules.hideEndscreen ? em.hidden : em.visible}</div>
                        </div>
                        <div class="grid-item">
                            <span data-i18n="labelBell">${getMsg('labelBell')}</span>
                            <div class="eye-toggle rule-bell" data-active="${rule.rules.hideNotifications}">${rule.rules.hideNotifications ? em.inactive : em.active}</div>
                        </div>
                    </div>
                    <button class="secondary-btn danger delete-rule" style="margin-top: 10px; width: 100%;" data-i18n="btnDelete">${getMsg('btnDelete')}</button>
                </div>
            `;

            card.querySelector('.card-header').onclick = () => {
                if (expandedChannels.has(rule.handle)) { expandedChannels.delete(rule.handle); card.classList.remove('expanded'); }
                else { expandedChannels.add(rule.handle); card.classList.add('expanded'); }
            };

            const toggleRule = (el, type) => {
                const newState = !(el.getAttribute('data-active') === 'true');
                el.setAttribute('data-active', newState);
                if (type === 'bell') {
                    el.innerText = newState ? em.inactive : em.active;
                    rule.rules.hideNotifications = newState;
                } else {
                    el.innerText = newState ? em.hidden : em.visible;
                    if (type === 'shorts') rule.rules.hideShorts = newState;
                    if (type === 'comments') rule.rules.hideComments = newState;
                    if (type === 'endscreen') rule.rules.hideEndscreen = newState;
                }
                saveChannelStates();
            };

            const saveChannelStates = () => {
                rule.rules.minDuration = card.querySelector('.min-input').value ? parseInt(card.querySelector('.min-input').value) * 60 : 0;
                rule.rules.maxDuration = card.querySelector('.max-input').value ? parseInt(card.querySelector('.max-input').value) * 60 : null;
                rule.rules.titleKeywords = card.querySelector('[data-type="keywords"]').value.trim();
                rule.rules.titleMode = card.querySelector('[data-type="mode"]').value;
                rule.rules.titleMatchType = card.querySelector('[data-type="match"]').value;
                allRules[index] = rule;
                storageSave({ channelRules: allRules }, notifyRefresh);
            };

            card.querySelector('.rule-shorts').onclick = (e) => { e.stopPropagation(); toggleRule(e.target, 'shorts'); };
            card.querySelector('.rule-comments').onclick = (e) => { e.stopPropagation(); toggleRule(e.target, 'comments'); };
            card.querySelector('.rule-endscreen').onclick = (e) => { e.stopPropagation(); toggleRule(e.target, 'endscreen'); };
            card.querySelector('.rule-bell').onclick = (e) => { e.stopPropagation(); toggleRule(e.target, 'bell'); };
            
            card.querySelectorAll('input, select').forEach(i => i.oninput = saveChannelStates);
            card.querySelector('.delete-rule').onclick = (e) => { e.stopPropagation(); allRules.splice(index, 1); storageSave({ channelRules: allRules }, loadAll); };
            
            listEl.appendChild(card);
        });
    }

    const sortEl = document.getElementById('sort-by');
    if (sortEl) sortEl.onchange = () => processAndRenderChannels(settingsData.channelRules);
    const filterEl = document.getElementById('filter-by');
    if (filterEl) filterEl.onchange = () => processAndRenderChannels(settingsData.channelRules);

    const clearBtn = document.getElementById('delete-all-rules');
    if (clearBtn) {
        clearBtn.onclick = () => {
            if (confirm('Delete all rules?')) {
                storageSave({ channelRules: [] }, loadAll);
            }
        };
    }

    function addBlockedChannel(handle) {
        const list = settingsData.blockedChannels || [];
        const clean = handle.startsWith('@') ? handle : '@' + handle;
        if (!list.some(b => (typeof b === 'string' ? b === clean : b.handle === clean))) {
            list.push({ handle: clean, name: clean, addedAt: Date.now() });
            settingsData.blockedChannels = list;
            storageSave({ blockedChannels: list }, () => {
                const handleInput = document.getElementById('new-blocked-handle');
                if (handleInput) handleInput.value = '';
                processAndRenderBlockedChannels();
                notifyRefresh();
            });
        }
    }

    const addBlockedBtn = document.getElementById('add-blocked-btn');
    if (addBlockedBtn) {
        addBlockedBtn.onclick = () => {
            const inp = document.getElementById('new-blocked-handle');
            const handle = inp ? inp.value.trim() : '';
            if (handle) addBlockedChannel(handle);
        };
    }

    const newBlockedInput = document.getElementById('new-blocked-handle');
    if (newBlockedInput) {
        newBlockedInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const handle = newBlockedInput.value.trim();
                if (handle) addBlockedChannel(handle);
            }
        });
    }

    function processAndRenderBlockedChannels() {
        let list = (settingsData.blockedChannels || []).map(b => typeof b === 'string' ? { handle: b, name: b, addedAt: 0 } : b);
        const sortEl = document.getElementById('sort-blocked-by');
        if (sortEl) {
            const val = sortEl.value;
            if (val === 'alpha') list.sort((a, b) => (a.name || a.handle).localeCompare(b.name || b.handle));
            else if (val === 'reverse-chrono') list.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
            else list.sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
        }
        renderBlockedChannels(list);
    }

    const sortBlockedEl = document.getElementById('sort-blocked-by');
    if (sortBlockedEl) sortBlockedEl.onchange = processAndRenderBlockedChannels;

    function renderBlockedChannels(list) {
        const listEl = document.getElementById('blocked-channels-list');
        if (!listEl) return;
        listEl.innerHTML = '';

        if (!list || list.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'blocked-empty';
            empty.textContent = getMsg('noBlocked');
            listEl.appendChild(empty);
            return;
        }

        list.forEach(item => {
            const handle = typeof item === 'string' ? item : item.handle;
            const name = typeof item === 'string' ? item : (item.name || item.handle);
            const addedAt = typeof item === 'object' ? item.addedAt : 0;
            const date = addedAt ? new Date(addedAt).toLocaleDateString() : '';

            const row = document.createElement('div');
            row.className = 'blocked-item';
            row.innerHTML = `
                <div class="blocked-item-info">
                    <span class="blocked-item-name">🚫 ${name}</span>
                    ${date ? `<span class="blocked-item-date">${date}</span>` : ''}
                </div>
                <button class="unblock-btn secondary-btn" data-i18n="unblockBtn">${getMsg('unblockBtn')}</button>
            `;
            row.querySelector('.unblock-btn').onclick = () => {
                settingsData.blockedChannels = (settingsData.blockedChannels || []).filter(b => {
                    const bHandle = typeof b === 'string' ? b : b.handle;
                    return bHandle !== handle;
                });
                storageSave({ blockedChannels: settingsData.blockedChannels }, () => {
                    processAndRenderBlockedChannels();
                    notifyRefresh();
                });
            };
            listEl.appendChild(row);
        });
    }

    const clearBlockedBtn = document.getElementById('delete-all-blocked');
    if (clearBlockedBtn) {
        clearBlockedBtn.onclick = () => {
            if (confirm('Unblock all channels?')) {
                storageSave({ blockedChannels: [] }, loadAll);
            }
        };
    }

    function notifyRefresh() {
        chrome.tabs.query({ url: "*://*.youtube.com/*" }, (tabs) => {
            tabs.forEach(tab => chrome.tabs.sendMessage(tab.id, { action: 'refresh' }).catch(() => {}));
        });
    }

    // ── Feedback Button ─────────────────────────────────────────
    const feedbackBtn = document.getElementById('open-feedback-form');
    if (feedbackBtn) {
        feedbackBtn.addEventListener('click', () => {
            chrome.tabs.create({ url: 'https://forms.gle/ekH8ym617Pa1zcHD7' });
        });
    }

    // ── Export / Import ─────────────────────────────────────────
    //
    // EXPORT: Alle Einstellungen als JSON-Datei herunterladen.
    //   Nützlich als Backup vor der Deinstallation.
    //
    // IMPORT: JSON-Datei einlesen und Einstellungen wiederherstellen.
    //   Nach dem Neuinstallieren einfach die exportierte Datei importieren.
    //
    const exportBtn = document.getElementById('export-settings-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            storageLoad(STORAGE_KEYS, (data) => {
                // JSON-Datei mit allen Einstellungen erstellen:
                const json = JSON.stringify(data, null, 2);
                const blob = new Blob([json], { type: 'application/json' });
                const url  = URL.createObjectURL(blob);
                const a    = document.createElement('a');
                a.href     = url;
                a.download = `ytfilter-backup-${new Date().toISOString().slice(0,10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
            });
        });
    }

    const importBtn = document.getElementById('import-settings-btn');
    if (importBtn) {
        importBtn.addEventListener('click', () => {
            // Datei-Auswahl Dialog öffnen:
            const input   = document.createElement('input');
            input.type    = 'file';
            input.accept  = '.json';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    try {
                        const data = JSON.parse(ev.target.result);
                        // Validierung: Mindestens ein bekannter Schlüssel muss enthalten sein
                        const valid = STORAGE_KEYS.some(k => data[k] !== undefined);
                        if (!valid) { alert('Ungültige Backup-Datei.'); return; }
                        storageSave(data, () => {
                            loadAll();
                            notifyRefresh();
                            alert('✅ Einstellungen erfolgreich importiert!');
                        });
                    } catch (err) {
                        alert('Fehler beim Lesen der Datei: ' + err.message);
                    }
                };
                reader.readAsText(file);
            };
            input.click();
        });
    }

    loadAll();
});
