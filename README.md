# StudyTrack

A complete, production-quality offline study tracker built with **plain HTML, CSS and vanilla JavaScript**.  
No framework. No backend. Everything stored in `localStorage`.

---

## Features

| Feature | Detail |
|---|---|
| **Live header** | Real date + seconds-precise clock |
| **Stopwatch** | Timestamp-based HH:MM:SS, survives tab refresh and throttling |
| **Midnight split** | Elapsed time is correctly attributed across calendar days, even if the tab was closed overnight |
| **Graphs** | Chart.js bar chart – Daily / Weekly / Monthly / Yearly views + month picker |
| **Summary cards** | Total, average, best day, streak |
| **Goal ring** | SVG progress ring for daily target |
| **Alarms** | Web Audio API beep (no audio files), full-screen overlay, Snooze, vibrate, Notification API |
| **History** | Sessions grouped by date; delete or add manual sessions; totals recalculated automatically |
| **Export / Import** | JSON backup with merge-on-import |
| **Screen Wake Lock** | Keeps display on while running (where supported) |
| **Tab title** | Shows `01:23:45 · StudyTrack` while running |
| **PWA** | `manifest.json` + `sw.js` service worker; installable on Android/iOS/desktop |
| **Light / Dark theme** | Remembered in `localStorage` |
| **Cross-tab sync** | `storage` event keeps multiple open tabs in sync |
| **Responsive** | Mobile-first CSS, works on phone and desktop |
| **Daily Sentence** | AI-generated (Gemini 2.5 Flash) English sentence with Bangla translation, usage notes, Web Speech audio pronunciation, daily read tracking & reviewable history |

---

## Daily Sentence & Vercel AI Setup

StudyTrack features a daily English sentence designed for real-world fluency (class 8 accessible, smart & polished, < 20 words).

### AI Generation (Secure Serverless Function)
- Route: `/api/daily-sentence.js`
- Model: `gemini-2.5-flash`
- Safe fallback: Includes `fallback-sentences.js` with **65 curated sentences** so the app functions 100% reliably even offline or without an API key.

### Adding your Gemini API Key in Vercel
1. Go to your project on [Vercel](https://vercel.com).
2. Navigate to **Settings** > **Environment Variables**.
3. Add a new variable:
   - **Key**: `GEMINI_API_KEY`
   - **Value**: Your Google AI Studio Gemini API Key
4. Click **Save**.
5. **Redeploy** your latest deployment (or run a new commit/push) for the environment variable to take effect.

---

## Running the App

### Option A — open directly (most features work)
```
index.html  →  double-click or drag into browser
```
Everything except the **PWA install** and **service worker** (which require HTTPS or `localhost`) works this way.

### Option B — local dev server (full PWA support)

**Using Python (built-in):**
```bash
cd studytrack
python -m http.server 5500
# open http://localhost:5500
```

**Using Node.js `serve`:**
```bash
npx serve studytrack
```

**Using VS Code Live Server extension:**  
Right-click `index.html` → *Open with Live Server*.

Once served over `localhost`, the browser will offer an **Install** prompt (or find it in the address-bar / browser menu).

---

## Project Structure

```
studytrack/
├── api/
│   └── daily-sentence.js   Vercel serverless function (Gemini 2.5 Flash)
├── fallback-sentences.js   Built-in 65-sentence offline database
├── index.html              Main shell & markup
├── style.css               All styles (mobile-first, light/dark, red/blue mixed)
├── app.js                  All logic (stopwatch, alarms, charts, history, daily sentence, PWA)
├── manifest.json           PWA web-app manifest
├── sw.js                   Service worker (cache-first, offline support)
├── icons/
│   ├── icon-192.png        PWA icon
│   └── icon-512.png        PWA splash icon
└── generate-icons.js       (dev utility) Regenerate icons with Node.js
```

---

## Architecture Notes

### Timestamp-based stopwatch
The stopwatch stores `startTimestamp` (epoch ms) + `accSec` (accumulated pause seconds) in `localStorage`, not a counter.  
Elapsed = `accSec + (Date.now() – startTimestamp)`.  
Refreshing the tab, sleeping the laptop or browser throttling never drifts the time.

### Midnight split (the tricky part – see `processMidnightSplits()` in `app.js`)
On every animation frame, we compare the current wall-clock time against `sw.lastMidnight`.  
If one or more midnight boundaries have passed since the session started:
1. We credit the seconds up to that midnight to the **previous** day's total and save a split session.
2. We reset `startTimestamp` to midnight and `accSec` to 0 so subsequent seconds count toward **today**.
3. We loop until all midnights have been processed (handles 36-hour sessions left open).
4. The stopwatch display keeps running without interruption.

This also runs on page load (`resumeOnLoad`), so a closed-over-midnight session is correctly split the moment the user reopens the tab.

### Alarms
Alarm checks use `getElapsedSec()` (timestamp-derived) and `getTodayTotal()` (committed + live), never a naive counter.  
Each alarm stores `firedSessionId` (session mode) or `firedDate` (daily mode) so it fires at most once.  
Snooze adds a 5-minute `_snoozeUntil` timestamp before the next check.

---

## Browser compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---|---|---|---|---|
| Core app | ✅ | ✅ | ✅ | ✅ |
| Screen Wake Lock | ✅ | ✅ 🧪 | ✅ 16.4+ | ✅ |
| Web Audio API | ✅ | ✅ | ✅ | ✅ |
| Notifications | ✅ | ✅ | ✅ 16.4+ | ✅ |
| PWA install | ✅ | — | ✅ (iOS) | ✅ |
| navigator.vibrate | ✅ | ✅ | — | ✅ |

---

## Resetting all data

Open the **Data** tab → **Clear All Data**.  
Or clear `localStorage` via DevTools → Application → Local Storage.
