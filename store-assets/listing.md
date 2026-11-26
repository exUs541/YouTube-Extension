# YT Filter – store listing

Copy-paste texts and field values for the **Chrome Web Store** and **Microsoft Edge Add-ons**. One text serves both stores; a heading says so when something applies to one store only. Images and file names: see [README.md](README.md).

## Name and short description

Both come from the package (`_locales/en/messages.json`: `extName`, `extDesc`), do not enter them by hand.

**Name** (54 characters, Chrome allows 75; live Edge listings use names of up to 72)

```
YT Filter – Channel Blocker & Hide Shorts for YouTube™
```

**Short description** (127 characters, max. 132)

```
Block channels, hide Shorts and comments, filter videos by keyword or length. A calmer YouTube with no account and no tracking.
```

Why it reads this way:

- The name carries the brand and the two phrases people search for most for this kind of tool, "channel blocker" and "hide shorts". "Filter" is part of the brand.
- "for YouTube™" is the form Google's branding guidelines allow for compatible products. YouTube is not the leading product name, and the logo contains no YouTube shapes (no play triangle, no red tile).
- The short description starts with the actions, because search results show only the beginning.
- Edge search position of the previous listing on 2026-11-26 (version 4.4.0, name "YouTube Channel Blocker & Video Filter", no ratings yet): "youtube keyword filter" 9, "youtube filter" 13, "block youtube channels" 25, "youtube channel blocker" 30, "youtube shorts blocker" 50, "hide shorts" not in the first 60. Compare again a week or two after the new version is live.

## Description (both stores)

```
Take back your feed. YT Filter blocks the channels you never want to see again, hides Shorts and other distractions, and filters videos by title keyword or length. Free, without an account and without tracking.

BLOCK WHAT YOU DO NOT WANT
• Block a channel with one click on the icon next to its name, or add its @handle.
• Its videos disappear from the home feed, search results and recommendations.
• Review your list and undo any entry at any time.

FEWER DISTRACTIONS
• Hide Shorts on the feed and in the sidebar.
• Hide the home feed, related videos, comments, end screens, the notification bell and Trending.
• Open your subscriptions instead of the home page.

FILTER BY KEYWORD AND LENGTH
• Hide, or only show, videos whose title contains, starts with, ends with or exactly matches your words.
• Set a minimum or maximum duration, for example to skip 30-second clips or three-hour streams.
• Give single channels their own rules. Everything else follows your general settings.

A SMOOTHER SUBSCRIPTIONS PAGE
• The feed keeps loading after you have hidden many videos, instead of stopping at grey placeholders.
• "Show more" opens your full list right in the sidebar, without sending you to another page.
• See how many subscriptions you have, for example "Subscriptions (46)".
• Hide sidebar sections you never use, or keep your list always expanded.
• A floating mini player stays in view while you scroll below a video.

PRIVATE BY DESIGN
• No ads, no analytics, no servers. The extension works entirely in your browser.
• Your lists and rules sync through your browser account.
• Export and import your settings as a file.
• Light and dark theme.

GET STARTED IN A MINUTE
1. Install the extension and reload your open tabs.
2. Click its icon and switch on what you want under General and Sidepanel.
3. Hide creators right on the page, or add them in the Blocked tab.
4. Add rules for single creators in the Channels tab.

GOOD TO KNOW
• Is this an ad blocker? No. YT Filter is about what appears on your pages: creators, Shorts, videos and clutter.
• Do I need an account? No.
• Where is my data? In your browser, and in your browser account if sync is switched on. Nothing is sent to us.
• Something stopped working? YouTube changes its pages from time to time. Please report it through the support link.

PERMISSIONS
• storage: saves your lists, rules and settings.
• Access to youtube.com only: your rules run there and nowhere else.

YouTube is a trademark of Google LLC. YT Filter is an independent extension and is not affiliated with, endorsed by or sponsored by Google or YouTube.
```

## Fields

| Field | Value |
|---|---|
| Category | Productivity (Chrome: Productivity > Tools) |
| Language | English |
| Website | `https://exus541.github.io/portfolio/details/ytfilter.html` |
| Support URL | `https://github.com/exUs541/YouTube-Extension/issues` |
| Privacy policy URL | `https://github.com/exUs541/YouTube-Extension/blob/main/PRIVACY_POLICY.md` |
| Mature content / remote code | No / No |

## Chrome Web Store only: Privacy practices

Paste into the Developer Dashboard, tab "Privacy practices".

**Single purpose**

```
Filter and declutter the YouTube website: block channels, hide Shorts and other page elements, hide videos by title keyword or duration, and keep the feed and the subscription list usable.
```

**storage justification**

```
Saves the user's block list, channel rules and settings, and syncs them across the user's devices through the browser account (chrome.storage.sync and chrome.storage.local).
```

**Host permission justification (youtube.com)**

```
The content script runs only on youtube.com pages. It hides videos, Shorts and page elements according to the user's rules, adds a block button next to channel names, shows the number of subscriptions, keeps "Show more" in the sidebar on the same page and restarts the feed when YouTube stops loading it. It reads page content only for these functions and sends nothing to any server.
```

**Remote code:** No. **Data usage:** the extension does not collect or transmit user data. Tick none of the data types and confirm the three certifications (no sale of data, no use unrelated to the single purpose, no creditworthiness use).

## Microsoft Edge only

**Search terms** (max. 7 terms, each max. 30 characters, 21 words in total; one term per field in Partner Center)

```
youtube channel blocker
block youtube channels
youtube shorts blocker
hide youtube comments
youtube keyword filter
distraction free youtube
hide recommendations
```

20 words. Each term is a search that matches a function; "hide shorts" and "video filter" are already covered by the name and the other terms.

**Notes for certification**

```
No account or login is needed. The extension runs only on youtube.com and stores its settings with chrome.storage; no data is sent to any server.

How to test: open https://www.youtube.com, click the extension icon, open the Blocked tab, add a channel handle and reload - videos from that channel disappear from the feed. In the General tab switch on "Hide Shorts (Global)" to remove Shorts from the feed.

When signed in: the sidebar shows the number of subscriptions, "Show more" under Subscriptions opens the list in place, and the subscriptions feed continues to load after videos were hidden.

Single purpose: filter and declutter the YouTube website.

Permissions
- storage: save the user's block list, filters and settings and sync them through the browser account.
- Host access (youtube.com only): the filters run on YouTube pages.
```

## Maintainer notes

- Icons, name and short description ship inside the package. They go live only when `version` in `manifest.json` is raised and the change reaches the default branch (the pipeline publishes only on a higher version).
- Description, screenshots, category, search terms and links are entered by hand in the Chrome Developer Dashboard and in Partner Center. Both stores reject changes while a version is in review.
- The privacy policy URL points at `main`.
- A name change is applied in the Chrome Web Store on the next update. The URL of the listing stays the same.
- Rebuild the Edge package after a version bump: `store-kit\Build-EdgePackages.ps1 -Only YouTube -Local`.
