// Builds all store images (screenshots + promo tiles) with headless Edge.
//   node store-assets/_source/build.mjs            -> everything
//   node store-assets/_source/build.mjs 3 promo    -> only screenshot 3 and the promo tiles
//
// The popup you see in the images is the REAL popup (popup.html / popup.css / popup.js of this repo),
// run with a small stub for the chrome.* APIs and made-up example data. Rebuild after UI changes.
// Everything around the popup (headline, background, sidebar illustration) is drawn here.
import { render } from './render.mjs';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..', '..');            // extension root
const out = path.join(here, '..');                   // store-assets/
const tmp = mkdtempSync(path.join(os.tmpdir(), 'ytf-shots-'));
const url = (p) => 'file:///' + p.replace(/\\/g, '/');

const manifest = JSON.parse(readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const messages = JSON.parse(readFileSync(path.join(root, '_locales', 'en', 'messages.json'), 'utf8'));
const popupCss = readFileSync(path.join(root, 'popup.css'), 'utf8');
const logoUri = 'data:image/svg+xml;base64,' + readFileSync(path.join(out, 'brand', 'logo.svg')).toString('base64');

// ── Theme: take the light/dark colour variables straight from popup.css ─────────────
const rootBlocks = [...popupCss.matchAll(/:root\s*\{([^}]*)\}/g)].map((m) => m[1]);
const themeCss = {
  light: `:root{${rootBlocks[0]};color-scheme:light}`,
  dark: `:root{${rootBlocks[0]};${rootBlocks[1]};color-scheme:dark}`,
};

// ── Example data shown in the popup (made up on purpose, no real channels) ───────────
const rule = (handle, name, over = {}) => ({
  handle, name, addedAt: Date.now(),
  rules: { hideShorts: true, hideComments: false, hideEndscreen: false, hideNotifications: true,
           minDuration: 0, maxDuration: null, titleKeywords: '', titleMode: 'hide', titleMatchType: 'contains', ...over },
});
const exampleStore = () => ({
  detoxSettings: { redirectHomeToSubs: true, hideSidebar: true, hideComments: true, hideShorts: true,
                   hideEndscreen: true, hideTrending: true, pipOnScroll: true },
  sidepanelSettings: { hideHome: true, hideShorts: true, hideExplore: true, hideMoreFromYT: true,
                       hideLegal: true, autoExpandSubs: true },
  channelRules: [
    rule('@example-news', 'Example News', { hideComments: true, minDuration: 600, maxDuration: 3600,
                                            titleKeywords: 'live, reaction, spoiler' }),
    rule('@example-gaming', 'Example Gaming', { hideEndscreen: true, titleKeywords: 'trailer' }),
    rule('@example-tech', 'Example Tech', { minDuration: 300 }),
  ],
  blockedChannels: ['clickbait', 'reactions', 'drama', 'prank', 'spoilers'].map((n, i) =>
    ({ handle: '@example-' + n, name: 'Example ' + n[0].toUpperCase() + n.slice(1), addedAt: Date.now() - (5 - i) * 2 * 86400000 })),
  appearance: { theme: 'dark', accentColor: '#ff0000' },
  extensionEnabled: true,
});

/** The real popup as a standalone page. tab: general|sidepanel|individual|blocked|customization */
function popupPage(name, { tab = 'general', theme = 'dark', expandFirstRule = false } = {}) {
  let html = readFileSync(path.join(root, 'popup.html'), 'utf8');
  const stub = `<script>
    const __store = ${JSON.stringify(exampleStore())};
    const MESSAGES = ${JSON.stringify(messages)};
    const area = { get: (k, cb) => { const o = {}; (Array.isArray(k) ? k : [k]).forEach(x => { if (x in __store) o[x] = JSON.parse(JSON.stringify(__store[x])); }); cb(o); },
                   set: (d, cb) => { Object.assign(__store, d); cb && cb(); } };
    window.chrome = { runtime: { getManifest: () => ({ version: ${JSON.stringify(manifest.version)} }) },
      i18n: { getMessage: (k) => (MESSAGES[k] ? MESSAGES[k].message : '') },
      storage: { sync: area, local: area }, tabs: { query: (q, cb) => cb([]), sendMessage: () => Promise.resolve() } };
  </script>`;
  const after = `<script>window.addEventListener('load', () => {
      document.querySelector('.tab-btn[data-tab="${tab}"]').click();
      ${expandFirstRule ? "const h = document.querySelector('.channel-card .card-header'); if (h) h.click();" : ''}
    });</script>`;
  html = html
    .replace('href="popup.css"', `href="${url(path.join(root, 'popup.css'))}"`)
    // no transitions (otherwise a tab switch can be captured half-way); hide the version so images don't date
    .replace('</head>', `<style>${themeCss[theme]}*,*::before,*::after{transition:none!important;animation:none!important}.version{visibility:hidden}</style></head>`)
    .replace('<script src="popup.js"></script>', `${stub}<script src="${url(path.join(root, 'popup.js'))}"></script>${after}`);
  const file = path.join(tmp, `popup-${name}.html`);
  writeFileSync(file, html);
  return url(file);
}

/** Popup embedded as a scaled iframe */
const popupFrame = (src, scale, style = '') =>
  `<div class="popup" style="width:${500 * scale}px;height:${600 * scale}px;${style}">` +
  `<iframe src="${src}" style="transform:scale(${scale})"></iframe></div>`;

// ── Shared look ──────────────────────────────────────────────────────────────────────
const CHECK = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ff6b72' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='20 6 9 17 4 12'/%3E%3C/svg%3E\")";
const baseCss = `
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:100%;height:100%;overflow:hidden}
  body{position:relative;font-family:"Segoe UI Variable Display","Segoe UI",system-ui,sans-serif;color:#fff;background:#0d0e12}
  .bg{position:absolute;inset:0;background:
      radial-gradient(900px 520px at 88% 6%,rgba(255,90,95,.26),transparent 62%),
      radial-gradient(700px 500px at 4% 108%,rgba(208,31,74,.22),transparent 60%),
      linear-gradient(180deg,#14151c,#0a0a0e)}
  .brand{position:absolute;display:flex;align-items:center;gap:12px;font-weight:650;font-size:22px;letter-spacing:.2px}
  .brand img{width:40px;height:40px;display:block}
  h1{font-weight:780;letter-spacing:-.022em;line-height:1.05}
  h1 em{font-style:normal;background:linear-gradient(90deg,#ff7a7f,#ff3d6b);-webkit-background-clip:text;background-clip:text;color:transparent}
  .sub{color:#b8bcc8;line-height:1.4}
  ul.pts{list-style:none;display:grid;gap:13px;color:#e8eaf0}
  ul.pts li{display:flex;gap:13px;align-items:center}
  ul.pts li::before{content:"";flex:none;width:24px;height:24px;border-radius:8px;background:rgba(255,90,95,.16) ${CHECK} center/15px no-repeat}
  .chips{display:flex;flex-wrap:wrap;gap:10px}
  .chip{padding:8px 15px;border-radius:999px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);color:#e8eaf0;font-weight:560}
  .popup{position:absolute;border-radius:16px;overflow:hidden;background:#000;box-shadow:0 40px 90px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.12)}
  .popup iframe{display:block;width:500px;height:600px;border:0;transform-origin:0 0}
`;
const page = (name, w, h, body, extraCss = '') => {
  const file = path.join(tmp, `${name}.html`);
  writeFileSync(file, `<!doctype html><meta charset="utf-8"><style>${baseCss}body{width:${w}px;height:${h}px}${extraCss}</style><body><div class="bg"></div>${body}</body>`);
  return file;
};

// ── Screenshots (1280 x 800) ─────────────────────────────────────────────────────────
const slideCss = `
  .brand{left:72px;top:56px}
  .copy{position:absolute;left:72px;top:176px;width:500px}
  h1{font-size:58px}
  .sub{margin-top:22px;font-size:23px}
  ul.pts{margin-top:30px;font-size:20.5px}
  .chips{margin-top:30px;font-size:18px}
`;
const slide = (name, { headline, sub, points, chips, visual }) => page(name, 1280, 800, `
  <div class="brand"><img src="${logoUri}" alt=""><span>YT Filter</span></div>
  <div class="copy">
    <h1>${headline}</h1>
    <p class="sub">${sub}</p>
    ${points ? `<ul class="pts">${points.map((p) => `<li>${p}</li>`).join('')}</ul>` : ''}
    ${chips ? `<div class="chips">${chips.map((c) => `<span class="chip">${c}</span>`).join('')}</div>` : ''}
  </div>
  ${visual}`, slideCss);

// Simplified illustration of YouTube's sidebar (NOT a screenshot): shows where the count appears.
const sidebarIllustration = `
  <div class="sbar">
    <div class="sbar-head"><span class="t">Subscriptions</span><span class="n">(46)</span><span class="chev">›</span></div>
    ${['Example News', 'Example Gaming', 'Example Tech', 'Example Music'].map((n, i) =>
      `<div class="row"><i style="background:${['#ff8a5c', '#7c8cff', '#43c59e', '#e879c9'][i]}"></i><span>${n}</span><b></b></div>`).join('')}
    <div class="note">Simplified illustration</div>
  </div>`;
const sidebarCss = `
  .sbar{position:absolute;left:72px;top:490px;width:360px;padding:18px 20px 12px;border-radius:16px;background:#15161c;
        box-shadow:0 24px 60px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.1)}
  .sbar-head{display:flex;align-items:baseline;gap:8px;padding:2px 0 14px;font-size:19px;font-weight:650;border-bottom:1px solid rgba(255,255,255,.08);margin-bottom:8px}
  .sbar-head .n{font-weight:400;color:#9da1ae;position:relative}
  .sbar-head .n::after{content:"";position:absolute;left:-7px;right:-7px;top:-5px;bottom:-5px;border-radius:9px;border:2px solid #ff5a6a;box-shadow:0 0 22px rgba(255,90,106,.45)}
  .sbar-head .chev{color:#9da1ae;margin-left:6px}
  .sbar .row{display:flex;align-items:center;gap:14px;height:38px;font-size:16.5px;color:#d9dce5}
  .sbar .row i{width:26px;height:26px;border-radius:50%;flex:none}
  .sbar .row b{margin-left:auto;width:6px;height:6px;border-radius:50%;background:#4aa8ff}
  .sbar .note{margin-top:8px;text-align:right;font-size:11.5px;color:#767a88}
`;

const SHOTS = {
  1: () => slide('shot1', {
    headline: 'Block any <em>YouTube channel</em>',
    sub: 'Click the block icon next to a channel name, or add an @handle. Its videos disappear from your feed.',
    points: ['Home feed, search and recommendations', 'Manage and undo from one list', 'Optional rules per channel'],
    visual: popupFrame(popupPage('blocked', { tab: 'blocked' }), 1.15, 'right:72px;top:55px'),
  }),
  2: () => slide('shot2', {
    headline: 'Hide Shorts and <em>other distractions</em>',
    sub: 'Switch off what pulls you in and keep only the videos you came for.',
    chips: ['Shorts', 'Comments', 'Related videos', 'End screens', 'Notification bell', 'Trending'],
    visual: popupFrame(popupPage('general', { tab: 'general' }), 1.15, 'right:72px;top:55px'),
  }),
  3: () => slide('shot3', {
    headline: 'Filter by <em>keyword and length</em>',
    sub: 'Give every channel its own rules and decide what shows up.',
    points: ['Hide (or only show) titles with your words', 'Skip short clips or very long streams', 'Shorts, comments and end screens per channel'],
    visual: popupFrame(popupPage('rules', { tab: 'individual', expandFirstRule: true }), 1.15, 'right:72px;top:55px'),
  }),
  4: () => slide('shot4', {
    headline: 'A cleaner sidebar, with your <em>channel count</em>',
    sub: 'Hide the sections you never use and see how many channels you follow at a glance.',
    visual: sidebarIllustration + popupFrame(popupPage('sidepanel', { tab: 'sidepanel' }), 1.15, 'right:72px;top:55px'),
  }),
  5: () => slide('shot5', {
    headline: 'Private, synced and <em>backed up</em>',
    sub: 'No account, no tracking, no servers. Everything stays in your browser.',
    points: ['Settings sync through your browser account', 'Export and import as a JSON file', 'Light and dark theme'],
    // dark popup behind (General), light popup in front (Settings: backup & restore)
    visual: popupFrame(popupPage('dark', { tab: 'general', theme: 'dark' }), 1, 'left:600px;top:150px') +
            popupFrame(popupPage('light', { tab: 'customization', theme: 'light' }), 1, 'left:735px;top:60px'),
  }),
};

// ── Promo tiles ──────────────────────────────────────────────────────────────────────
const promoSmall = () => page('promo-small', 440, 280, `
  <div class="brand" style="left:34px;top:32px;gap:0"><img src="${logoUri}" alt="" style="width:76px;height:76px"></div>
  <div style="position:absolute;left:34px;top:122px;right:30px">
    <div style="font-size:40px;font-weight:780;letter-spacing:-.02em;line-height:1">YT Filter</div>
    <div style="margin-top:12px;font-size:21px;line-height:1.3;color:#d5d8e1;font-weight:560">Block channels.<br>Hide Shorts.<br><span style="color:#ff7a82">Filter your feed.</span></div>
  </div>`);

const promoMarquee = () => page('promo-marquee', 1400, 560, `
  <div class="brand" style="left:80px;top:62px"><img src="${logoUri}" alt=""><span>YT Filter</span></div>
  <div style="position:absolute;left:80px;top:150px;width:640px">
    <h1 style="font-size:64px">Your YouTube feed,<br><em>your rules.</em></h1>
    <p class="sub" style="margin-top:22px;font-size:25px">Block channels, hide Shorts and filter videos by keyword or length.</p>
    <div class="chips" style="margin-top:32px;font-size:19px"><span class="chip">Channel blocker</span><span class="chip">Shorts hider</span><span class="chip">Keyword filter</span></div>
  </div>
  ${popupFrame(popupPage('m-rules', { tab: 'individual', expandFirstRule: true }), 0.78, 'left:745px;top:74px')}
  ${popupFrame(popupPage('m-general', { tab: 'general' }), 0.78, 'left:955px;top:36px')}`);

// ── Run ──────────────────────────────────────────────────────────────────────────────
const NAMES = { 1: 'screenshot-1-block-channels', 2: 'screenshot-2-hide-shorts', 3: 'screenshot-3-keyword-and-duration-rules',
                4: 'screenshot-4-sidebar-subscription-count', 5: 'screenshot-5-private-synced-backup' };
const want = process.argv.slice(2);
const on = (k) => want.length === 0 || want.includes(String(k));

for (const n of [1, 2, 3, 4, 5]) {
  if (!on(n)) continue;
  let file = SHOTS[n]();
  if (n === 4) {   // slide 4 also needs the sidebar styles
    const html = readFileSync(file, 'utf8').replace('</style>', sidebarCss + '</style>');
    writeFileSync(file, html);
  }
  render(file, path.join(out, 'screenshots', NAMES[n] + '.png'), 1280, 800, { wait: 3000 });
  console.log('wrote', NAMES[n] + '.png');
}
if (on('promo')) {
  render(promoSmall(), path.join(out, 'promo-small-440x280.png'), 440, 280, { wait: 2000 });
  console.log('wrote promo-small-440x280.png');
  render(promoMarquee(), path.join(out, 'promo-marquee-1400x560.png'), 1400, 560, { wait: 3000 });
  console.log('wrote promo-marquee-1400x560.png');
}
