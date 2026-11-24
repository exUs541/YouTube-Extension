# YT Filter – store listing

Copy-paste texts and field values for the **Chrome Web Store** and **Microsoft Edge Add-ons**. One text serves both stores; a heading says so when something applies to one store only. Images and file names: see [README.md](README.md).

## Name and short description

Both come from the package (`_locales/en/messages.json`: `extName`, `extDesc`), do not enter them by hand.

**Name** (37 characters, Chrome allows 75)

```
Channel & Shorts Blocker for YouTube™
```

**Short description** (130 characters, max. 132)

```
Block YouTube channels, hide Shorts, and filter videos by title keyword or length. A cleaner feed with no tracking and no account.
```

Why it reads this way:

- The words people search for ("channel blocker", "shorts blocker", "youtube") are in the name. The short description adds the verbs ("block", "hide", "filter"), as Google recommends.
- "for YouTube™" is the form Google's branding guidelines allow for compatible products. YouTube is not the leading product name, and the logo contains no YouTube shapes (no play triangle, no red tile).
- The brand "YT Filter" stays in the logo, the images and the first sentence of the description.
- No keyword is repeated conspicuously (Google's rule of thumb: fewer than about five repetitions). "Shorts" appears four times.

## Description (both stores)

```
YT Filter takes the clutter out of YouTube. Block channels you never want to see again, hide Shorts, and filter videos by title keyword or length, all from one clean popup.

WHAT YOU CAN DO

• Block channels: click the block icon next to a channel name, or add an @handle. Their videos disappear from your home feed, search results and recommendations.
• Hide Shorts: remove the Shorts shelf and the links to them from your feed and sidebar.
• Filter by keyword: hide, or only show, videos whose title contains, starts with, ends with or exactly matches the words you choose.
• Filter by length: set a minimum or maximum duration for a channel to skip 30-second clips or three-hour streams.
• Rules per channel: give a channel its own settings for keywords, duration, comments, end screens and the notification bell, while everything else follows your global setup.
• Fewer distractions: hide the home feed, related videos, comments, end screens, the notification bell and Trending.
• Cleaner sidebar: hide Home, Shorts, Explore, More from YouTube and other sections, and auto-expand your subscription list.
• Subscription count: see how many channels you follow right in the sidebar, for example "Subscriptions (46)".
• Extras: open your Subscriptions page instead of the home feed, and keep a floating mini player while you scroll a video page.

PRIVATE BY DESIGN

• No account, no ads, no analytics and no servers. The extension runs in your browser.
• Your block list and rules sync across your devices through your browser account.
• Export and import everything as a JSON file for backup.
• The popup follows your light or dark system theme.

HOW TO START

1. Install the extension and open youtube.com.
2. Click the YT Filter icon and switch on what you want in General and Sidepanel.
3. Block a channel with the icon next to its name, or add its @handle in the Blocked tab.
4. Open the Channels tab for rules with keywords and duration.

PERMISSIONS

• storage: saves your block list, rules and settings and syncs them through your browser account.
• Access to youtube.com only: the filters run on YouTube pages. Nothing is sent anywhere.

YouTube is a trademark of Google LLC. YT Filter is an independent extension and is not affiliated with, endorsed by or sponsored by Google or YouTube.
```

## Fields

| Field | Value |
|---|---|
| Category | Productivity (alternative: Entertainment) |
| Language | English |
| Website | `https://github.com/exUs541/YouTube-Extension` |
| Privacy policy URL | `https://github.com/exUs541/YouTube-Extension/blob/main/PRIVACY_POLICY.md` |
| Mature content / remote code | No / No |

## Chrome Web Store only: Privacy practices

Paste into the Developer Dashboard, tab "Privacy practices".

**Single purpose**

```
Filter and declutter the YouTube website: block channels, hide Shorts and other page elements, and hide videos by title keyword or duration.
```

**storage justification**

```
Saves the user's block list, channel rules and settings, and syncs them across the user's devices through the browser account (chrome.storage.sync and chrome.storage.local).
```

**Host permission justification (youtube.com)**

```
The content script runs only on youtube.com pages. It hides videos, Shorts and page elements according to the user's rules and adds a block button next to channel names. It reads page content only to apply these rules and sends nothing to any server.
```

**Remote code:** No. **Data usage:** the extension does not collect or transmit user data. Tick none of the data types and confirm the three certifications (no sale of data, no use unrelated to the single purpose, no creditworthiness use).

## Microsoft Edge only

**Search terms** (max. 7 terms, each max. 30 characters; one term per field in Partner Center)

```
youtube channel blocker
hide youtube shorts
youtube shorts blocker
youtube video filter
youtube keyword filter
distraction free youtube
clean youtube feed
```

They cover the searches that match the features: blocking channels, hiding Shorts, filtering by keyword and length, distraction-free viewing. Each term is worded differently so that none repeats another.

**Notes for certification**

```
No account or login is needed. The extension runs only on youtube.com and stores its settings with chrome.storage; no data is sent to any server.

How to test: open https://www.youtube.com, click the extension icon, open the Blocked tab, add a channel handle and reload - videos from that channel disappear from the feed. In the General tab switch on "Hide Shorts (Global)" to remove Shorts from the feed.

Single purpose: filter and declutter the YouTube website (block channels, hide Shorts, filter by keyword or duration).

Permissions
- storage: save the user's block list, filters and settings and sync them through the browser account.
- Host access (youtube.com only): the filters run on YouTube pages.
```

## Maintainer notes

- Icons, name and short description ship inside the package. They go live only when `version` in `manifest.json` is raised and the change reaches the default branch (the pipeline publishes only on a higher version). Until then the stores show the old logo and name.
- The privacy policy URL points at `main`. The updated text (new name, permissions) is visible there after the merge.
- A name change is applied in the Chrome Web Store on the next update. The URL of the listing stays the same.
- Rebuild the Edge package after a version bump: `store-kit\Build-EdgePackages.ps1 -Only YouTube -Local`.
