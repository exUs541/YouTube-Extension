# 📖 YT Filter – User Guide

> **Version:** 4.2.0  
> **Supported Languages:** English, Deutsch, Türkçe, Español, Français  
> **Browser:** Google Chrome (Manifest V3)

---

## Table of Contents

1. [What is YT Filter?](#1-what-is-yt-filter)
2. [Installation](#2-installation)
3. [Getting Started](#3-getting-started)
4. [General Settings](#4-general-settings)
5. [Sidepanel Customization](#5-sidepanel-customization)
6. [Channel Rules (Fine-Tuning)](#6-channel-rules-fine-tuning)
7. [Channel Blocking](#7-channel-blocking)
8. [Appearance & Settings](#8-appearance--settings)
9. [Changelog](#9-changelog)
10. [Troubleshooting / FAQ](#10-troubleshooting--faq)

---

## 1. What is YT Filter?

**YT Filter** is a Chrome extension that gives you full control over your YouTube experience. It lets you:

- **Hide distracting elements** like Shorts, comments, trending content, and endscreens
- **Customize the sidebar** by removing sections you don't need
- **Set rules per channel** – filter videos by title keywords, duration, or type
- **Block entire channels** – all their videos disappear from your feed instantly
- **Personalize the look** with custom colors, themes, and emoji styles

Think of it as a **"Digital Detox Toolkit"** for YouTube.

---

## 2. Installation

### From the Chrome Web Store
1. Visit the [YT Filter page on the Chrome Web Store](#)
2. Click **"Add to Chrome"**
3. Confirm the installation
4. The YT Filter icon appears in your browser toolbar

### Manual Installation (Developer Mode)
1. Download or clone the extension folder
2. Open `chrome://extensions` in Chrome
3. Enable **"Developer mode"** (top-right toggle)
4. Click **"Load unpacked"** and select the extension folder
5. The extension is now active

---

## 3. Getting Started

### Opening the Popup
Click the **YT Filter icon** in your Chrome toolbar to open the settings popup.

### The Interface
The popup has a **sidebar navigation** on the left with 6 tabs:

| Tab | Icon | What it does |
|-----|------|-------------|
| **General** | ⚙️ | Global show/hide toggles for YouTube elements |
| **Sidepanel** | 📁 | Hide sections from YouTube's left navigation |
| **Channels** | 📺 | Per-channel rules (keywords, duration, shorts) |
| **Blocked** | 🚫 | Completely block channels – their videos disappear |
| **Settings** | 🎨 | Colors, themes, language, emoji customization |
| **Changelog** | 📜 | Version history and release notes |

### The Power Toggle
At the bottom of the sidebar, there's an **ON/OFF toggle**. This controls whether the entire extension is active or not.

- **ON** (green): All your filters and rules are applied
- **OFF** (red/grey): YouTube looks completely normal – no filtering at all

---

## 4. General Settings

The **General** tab contains global toggles that affect the entire YouTube site.

### Available Toggles

| Setting | What it does |
|---------|-------------|
| **Redirect Home to Subs** | When you click the YouTube logo, you'll go to your Subscriptions page instead of the Home feed. Great for avoiding algorithmic recommendations! |
| **Hide Home Feed** | Removes the entire video grid from the YouTube homepage. Only the search bar and navigation remain. |
| **Hide Related Sidebar** | Removes the "Up Next" / recommended videos sidebar that appears when watching a video. |
| **Hide Comments** | Hides the entire comment section below videos. |
| **Hide Shorts (Global)** | Removes ALL YouTube Shorts everywhere – from the home feed, search results, and the Shorts shelf. |
| **Hide Endscreens** | Removes the suggested video overlays that appear at the end of videos. |
| **Hide Notifications** | Hides the notification bell and its counter in the YouTube header. |
| **Hide Trending** | Removes trending/explore content from the feed. |

### How Toggles Work
- Click the toggle icon to switch between **visible** (👁️) and **hidden** (❌)
- Changes take effect **immediately** – no need to reload YouTube
- The exact icons depend on your selected [Emoji Theme](#emoji-themes)

---

## 5. Sidepanel Customization

The **Sidepanel** tab lets you hide specific sections from YouTube's left navigation bar (the sidebar you see on the YouTube homepage).

### Available Sections

| Setting | What it hides |
|---------|--------------|
| **Hide Home** | The "Home" button in the sidebar |
| **Hide Shorts** | The "Shorts" button in the sidebar |
| **Hide Subscriptions** | The "Subscriptions" button |
| **Hide My YouTube** | The "Your channel" / "My YouTube" section |
| **Hide Explore** | The entire "Explore" section (Trending, Music, Gaming, etc.) |
| **Hide More from YouTube** | The "More from YouTube" section (YouTube Premium, Music, Kids) |
| **Hide Report History** | The report history link |
| **Hide Legal Notice** | Legal links at the bottom (Terms, Privacy, etc.) |

### Special Feature: Auto-Expand Subscriptions
At the bottom of this tab (below the divider), there's a special toggle:

- **Auto-expand Subscriptions**: Automatically clicks the "Show more" button in the Subscriptions section, so you always see ALL your subscribed channels without manually expanding.

---

## 6. Channel Rules (Fine-Tuning)

The **Channels** tab is for setting **specific rules per channel**. Unlike [Channel Blocking](#7-channel-blocking), this doesn't hide ALL videos from a channel – it gives you **fine-grained control**.

### Adding a Channel Rule
1. Go to the **Channels** tab
2. Type the channel's handle in the input field (e.g., `@MrBeast`)
3. Click **"Add"**
4. The channel card appears with all available settings

### Available Rules per Channel

#### Title Keywords
Filter videos based on words in the title:

- **Keywords**: Enter comma-separated keywords (e.g., `challenge, reaction, shorts`)
- **Match Type**: How keywords are matched:
  - `Contains` – Title contains the keyword anywhere
  - `Starts With` – Title begins with the keyword
  - `Ends With` – Title ends with the keyword
  - `Exactly` – Title must exactly match the keyword
- **Mode**:
  - `Hide` – Videos matching the keywords are **hidden**
  - `Show` – **Only** videos matching the keywords are shown (everything else from this channel is hidden)

**Example:**  
Channel: `@MrBeast`  
Keywords: `challenge, expensive`  
Mode: `Show`  
→ Only MrBeast videos with "challenge" or "expensive" in the title will appear.

#### Duration Limits
- **Min Duration** (seconds): Videos shorter than this are hidden
- **Max Duration** (seconds): Videos longer than this are hidden

**Example:** Min = 300 (5 min), Max = 3600 (1 hour) → Only shows videos between 5 minutes and 1 hour.

#### Channel-Level Toggles
Each channel card also has toggles for:
- **Hide Shorts** for this specific channel
- **Allow Comments** for this channel (overrides global setting)
- **Allow Endscreens** for this channel
- **Allow Notifications** for this channel

### Sorting & Filtering
Use the toolbar above the channel list:
- **Sort**: Alphabetically (A-Z) or by most recently added
- **Filter**: Show only channels with specific settings active (e.g., "With Duration Limits")

### Deleting Rules
- Click **"Delete"** on an individual channel card
- Or use **"Delete All Rules"** at the bottom to remove everything

---

## 7. Channel Blocking

The **Blocked** tab is for **completely blocking channels**. When you block a channel, **ALL their videos disappear** from YouTube – on the homepage, in search results, in the recommendation sidebar, everywhere.

### How to Block a Channel

#### Method 1: Via the Popup
1. Go to the **Blocked** tab (🚫)
2. Type the channel handle in the input field (e.g., `@ChannelName`)
3. Click **"Add"**
4. Done! All videos from this channel are now hidden

#### Method 2: Directly on YouTube
On every video card on YouTube, you'll see a small **🚫 icon** right next to the channel name. This appears on:
- The homepage
- Search results
- The recommendation sidebar (when watching a video)
- Any other page where videos with channel names are shown

**To block a channel:**
1. Find any video from the channel you want to block
2. Click the **🚫** icon next to the channel name
3. The video disappears instantly, and all other videos from that channel will be hidden too

### Managing Blocked Channels
In the **Blocked** tab, you can see all your blocked channels with:
- The channel handle (e.g., `@ChannelName`)
- The date when you blocked them
- An **"Unblock"** button to remove the block

### Sorting Options
- **A-Z**: Alphabetical order
- **Oldest First**: By blocking date (oldest on top)
- **Newest First**: Most recently blocked on top

### Unblocking
- Click **"Unblock"** next to a specific channel to restore their videos
- Click **"Unblock All"** at the bottom to unblock every channel at once

### Important Notes
- Blocking is **case-insensitive** – `@channelname` and `@ChannelName` are treated the same
- Blocking works with **Turkish special characters** (İ/ı) correctly
- Blocked channels are hidden **immediately** – no page reload needed
- The block list is stored locally in your browser – it's **never sent anywhere**

---

## 8. Appearance & Settings

The **Settings** tab lets you customize how YT Filter looks and feels.

### Accent Color
Change the primary color of the extension's interface:
1. Click the **color picker** to choose a color visually
2. Or type a **hex code** directly (e.g., `#ff0000` for red)
3. The UI updates instantly

### Light Mode
Toggle between **dark mode** (default) and **light mode** for the extension popup.

### Language
Choose the display language for the extension:
- **Auto**: Uses your browser's language
- **English**, **Deutsch**, **Türkçe**, **Español**, **Français**

The language change takes effect immediately – no restart needed.

### Emoji Themes
Customize the toggle icons used throughout the extension:

| Theme | Visible | Hidden | Active | Inactive |
|-------|---------|--------|--------|----------|
| **Classic** | 👁️ | 🙈 | ✅ | ❌ |
| **Privacy** | 🛡️ | 🚫 | 🟢 | 🔴 |
| **Check** | ✔️ | ✖️ | 🔘 | ⚪ |
| **Pulse** | 🔴 | ⚪ | 🔴 | 🔘 |
| **Custom** | (your choice) | (your choice) | (your choice) | (your choice) |

With **Custom**, you can type any emoji into each field to create your own theme.

---

## 9. Changelog

You can always check what's new in the **Changelog** tab (📜) inside the extension popup. It shows the full version history from v1.0 to the current version.

---

## 10. Troubleshooting / FAQ

### ❓ Nothing happens after I change settings
**Solution:** Refresh the YouTube page (`F5` or `Ctrl+R`). Most settings take effect instantly, but sometimes YouTube's dynamic content needs a page reload.

### ❓ The 🚫 block button doesn't appear next to channel names
**Possible causes:**
1. The extension might not be loaded – go to `chrome://extensions` and check if it's enabled
2. The YouTube page was opened before the extension was installed – **close the tab and open a new one**
3. After updating the extension, you need to **reload it** (`chrome://extensions` → click the ⟳ reload button) and **open a new YouTube tab**

### ❓ I blocked a channel but their videos still show up
**Solutions:**
1. **Reload the YouTube page** (`F5`) – blocking takes effect on the current page content, but very rarely a reload is needed
2. Check the **Blocked** tab – make sure the channel handle is spelled correctly
3. Make sure the extension power toggle is **ON** (green, not grey)

### ❓ How do I find a channel's handle?
A channel handle starts with `@` and can be found:
- In the URL: `youtube.com/@ChannelName`
- Below the channel name on their channel page
- Next to the channel name on video cards

### ❓ Can I block a channel AND have rules for it?
The **Blocked** tab and the **Channels** tab serve different purposes:
- **Blocked**: The channel is completely invisible – all videos are hidden, no exceptions
- **Channels**: Fine-tuned control – you can filter specific videos while still seeing others

If a channel is in both lists, **blocking takes priority** – all videos will be hidden regardless of channel rules.

### ❓ Does this extension collect my data?
**No.** All settings and blocked channels are stored **locally in your browser** using Chrome's storage API. Nothing is sent to any server. The extension has no network permissions.

### ❓ Will this extension slow down YouTube?
No noticeable impact. The extension uses efficient DOM observers and runs only on YouTube pages. It processes each video card once and remembers the result.

### ❓ Does this work on YouTube Music or YouTube TV?
No, this extension is designed specifically for the main YouTube website (`youtube.com`).

### ❓ How do I completely remove all my settings?
1. Go to `chrome://extensions`
2. Find YT Filter
3. Click **"Remove"** to uninstall
4. All settings are deleted automatically

Alternatively, you can use **"Delete All Rules"** (Channels tab) and **"Unblock All"** (Blocked tab) to reset specific sections.

---

## 🆘 Still need help?

If you encounter a bug or have a feature request, please [open an issue on GitHub](#) or leave a review on the Chrome Web Store.

---

*YT Filter – Take back control of your YouTube experience.* 🎬
