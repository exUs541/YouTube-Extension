# Store assets – YT Filter

Everything for the store listings of YT Filter in one place: images, logo sources and the store texts, for the Chrome Web Store and Microsoft Edge Add-ons at once. One image set serves both stores (the sizes are accepted by both).

This folder is not part of the extension package. The packager (`.github/scripts/package-extension.mjs`) skips `store-assets/`, and changes here do not start a release.

## Contents

```
store-assets/
├─ listing.md                          store texts and field values (both stores; store-only parts are marked)
├─ screenshots/                        5 × 1280×800
├─ promo-small-440x280.png             small promo tile
├─ promo-marquee-1400x560.png          large promo tile (Chrome "marquee", Edge "large")
├─ brand/
│  ├─ logo.svg                         logo master (128 px grid)
│  ├─ logo-small.svg                   simplified version for 16 and 32 px
│  ├─ logo-300x300.png                 Edge logo
│  └─ logo-512.png
├─ _source/                            generator for all images and icons
│  ├─ build.mjs                        screenshots and promo tiles
│  ├─ make-icons.mjs                   icons and logos from brand/*.svg
│  └─ render.mjs                       helper (headless Edge or Chrome)
└─ YouTube-<version>.zip               built package (git-ignored)
```

## Which file goes where

| Store field | File | Chrome | Edge |
|---|---|---|---|
| Extension icon 128 × 128 | `../icons/icon128.png` (inside the package) | store icon | automatic |
| Logo 300 × 300 | `brand/logo-300x300.png` | – | logo |
| Screenshots | `screenshots/screenshot-1-…` to `screenshot-5-…` | up to 5 | up to 6 |
| Small tile 440 × 280 | `promo-small-440x280.png` | required | required |
| Large tile 1400 × 560 | `promo-marquee-1400x560.png` | optional | optional |
| Package | `YouTube-<version>.zip` | built by the release pipeline | upload by hand the first time, pipeline afterwards |

Screenshot order (the first counts most) and the optional captions for Edge:

1. `screenshot-1-block-channels.png` – "Block any YouTube channel with one click"
2. `screenshot-2-hide-shorts.png` – "Hide Shorts and other distractions, with a feed that keeps loading"
3. `screenshot-3-keyword-and-duration-rules.png` – "Rules per channel: title keywords and video length"
4. `screenshot-4-sidebar-subscription-count.png` – "Your channel count in the sidebar, and Show more stays on the page"
5. `screenshot-5-private-synced-backup.png` – "No tracking. Settings sync and can be backed up. Light and dark theme"

## File naming

Files that apply to one store only carry the store in their name (`…-chrome.…` or `…-edge.…`). Everything without such a suffix is shared by both stores.

## Regenerate the images

Needs Node 20 and Microsoft Edge (or Chrome). From the extension folder:

```
node store-assets/_source/build.mjs            # all screenshots and both tiles
node store-assets/_source/build.mjs 3 promo    # only screenshot 3 and the tiles
node store-assets/_source/make-icons.mjs       # icons/icon16/32/48/128.png and brand/logo-*.png
```

- The popups in the screenshots are the real `popup.html` with `popup.css` and `popup.js`, filled with example data (no real channels). After a change to the popup, run `build.mjs` again.
- Headlines, background and texts are in `_source/build.mjs`. Only the sidebar in screenshot 4 is a simplified illustration, labelled as such.
- The version number in the popup is hidden in the images so they do not go stale.
- To change the logo, edit `brand/logo.svg`, then run `make-icons.mjs` and `build.mjs`.

## Notes

- The logo is an original mark (a funnel on a tile) and contains no YouTube shapes. Google's branding guidelines do not allow Google marks or altered marks as a logo.
- The texts describe only features that exist in the code. Checked live on 2026-11-26: subscription counter, "Show more" and the feed reload. A live test of all other features against the current YouTube layout is still open.
