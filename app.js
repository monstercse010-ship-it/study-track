/**
 * StudyTrack – app.js
 * Pure vanilla JS, no dependencies beyond Chart.js (loaded via CDN).
 *
 * Architecture overview
 * ─────────────────────
 * State lives in `store` (mirrored to localStorage).
 * The stopwatch is TIMESTAMP-BASED: we persist the epoch timestamp of when
 * the session started plus any accumulated seconds from previous pauses.
 * This means refreshing the tab or throttling never drifts the timer.
 *
 * Midnight split
 * ──────────────
 * On every timer tick (and on page load if running) we detect if the wall-clock
 * has crossed midnight since the last session started. If so, we:
 *   1. Finalize the elapsed time up to midnight into the previous day's total.
 *   2. Reset the session start to midnight so subsequent time counts for today.
 *   3. Continue the stopwatch display without interruption.
 *
 * Alarm system
 * ────────────
 * Alarms are checked inside the same rAF loop. We compare the timestamp-based
 * elapsed seconds (never a simple counter) against the alarm target. Each alarm
 * stores `firedDate` and `firedSessionId` so it fires at most once per
 * calendar day (daily-mode) or once per stopwatch session (session-mode).
 */

'use strict';

/* ═══════════════════════════════════════════════════════
   1.  CONSTANTS & HELPERS
════════════════════════════════════════════════════════ */

const STORE_KEY   = 'studytrack_v2';
const SW_KEY      = 'studytrack_sw';          // separate key for running stopwatch state

const RING_C = 2 * Math.PI * 34;              // circumference for the SVG progress ring

/** Format seconds → "HH:MM:SS" */
function fmtHMS(totalSec) {
  totalSec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** Format seconds → human "2h 35m" */
function fmtHm(totalSec) {
  totalSec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h === 0 && m === 0) return '0m';
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function pad(n) { return String(n).padStart(2, '0'); }

/** "YYYY-MM-DD" for a given Date object (local time) */
function dateKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Midnight (00:00:00) timestamp for a given Date (local time) */
function midnightOf(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
}

/** Build a Date from "YYYY-MM-DD" safely (local tz) */
function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Today's key */
function todayKey() { return dateKey(new Date()); }

/** Unique session id */
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

/** Add seconds to a dailyTotals map, creating entry if missing */
function addToDaily(daily, key, secs) {
  daily[key] = (daily[key] || 0) + secs;
}

/* ═══════════════════════════════════════════════════════
   2.  PERSISTENT STORE
════════════════════════════════════════════════════════ */

/**
 * Data model:
 * {
 *   dailyTotals: { "YYYY-MM-DD": totalSeconds },
 *   sessions:    [{ id, date, startTime, endTime, seconds, subject }],
 *   alarms:      [{ id, targetSec, mode, enabled, firedDate, firedSessionId }],
 *   dailyGoalSec: number | 0,
 *   theme:        "light" | "dark"
 * }
 */
function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return { dailyTotals: {}, sessions: [], alarms: [], dailyGoalSec: 0, theme: 'light' };
}

function saveStore() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (_) {}
}

let store = loadStore();

/* ─── Stopwatch state (separate key so it survives store resets) ─── */
/**
 * swState:
 * {
 *   running:        boolean,
 *   startTimestamp: epoch ms of when this run segment started,
 *   accSec:         seconds already accumulated before current run,
 *   subject:        string,
 *   sessionDate:    "YYYY-MM-DD" of when this session started (for midnight split),
 *   sessionId:      unique id,
 *   lastMidnight:   epoch ms of the most recent midnight we have accounted for
 * }
 */
function loadSwState() {
  try {
    const raw = localStorage.getItem(SW_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return null;
}

function saveSwState(s) {
  if (s === null) { localStorage.removeItem(SW_KEY); }
  else { try { localStorage.setItem(SW_KEY, JSON.stringify(s)); } catch (_) {} }
}

let sw = null;   // null = idle
let animFrame = null;

/* ═══════════════════════════════════════════════════════
   3.  DOM REFERENCES
════════════════════════════════════════════════════════ */

const $ = id => document.getElementById(id);

const hdrDate      = $('hdr-date');
const hdrClock     = $('hdr-clock');
const todayTotalEl = $('today-total');
const themeToggle  = $('theme-toggle');

const swDisplay    = $('sw-display');
const swSubject    = $('sw-subject');
const btnStart     = $('btn-start');
const btnPause     = $('btn-pause');
const btnResume    = $('btn-resume');
const btnSave      = $('btn-save');
const btnReset     = $('btn-reset');
const wakeNote     = $('wake-note');

const alarmList    = $('alarm-list');
const alarmH       = $('alarm-h');
const alarmM       = $('alarm-m');
const alarmMode    = $('alarm-mode');
const btnAddAlarm  = $('btn-add-alarm');

const goalHoursEl  = $('goal-hours');
const btnSaveGoal  = $('btn-save-goal');
const goalProgressRow = $('goal-progress-row');
const ringFill     = $('ring-fill');
const ringPct      = $('ring-pct');
const goalTodayVal = $('goal-today-val');
const goalTargetVal= $('goal-target-val');

const rangeBtns    = document.querySelectorAll('.range-btn');
const monthPickerWrap = $('month-picker-wrap');
const monthPicker  = $('month-picker');
const studyChart   = $('study-chart');
const chartEmpty   = $('chart-empty');
const scTotal      = $('sc-total');
const scAvg        = $('sc-avg');
const scBest       = $('sc-best');
const scStreak     = $('sc-streak');

const historyList  = $('history-list');
const btnAddManual = $('btn-add-manual');
const manualForm   = $('manual-form');
const manDate      = $('man-date');
const manStart     = $('man-start');
const manDurH      = $('man-dur-h');
const manDurM      = $('man-dur-m');
const manSubject   = $('man-subject');
const btnManSave   = $('btn-manual-save');
const btnManCancel = $('btn-manual-cancel');

const btnExport    = $('btn-export');
const importFile   = $('import-file');
const btnClearData = $('btn-clear-data');

const alarmOverlay = $('alarm-overlay');
const overlayMsg   = $('overlay-msg');
const btnStopAlarm = $('btn-stop-alarm');
const btnSnooze    = $('btn-snooze-alarm');

/* ═══════════════════════════════════════════════════════
   4.  THEME
════════════════════════════════════════════════════════ */

function applyTheme(t) {
  document.body.classList.toggle('theme-dark',  t === 'dark');
  document.body.classList.toggle('theme-light', t !== 'dark');
  themeToggle.textContent = t === 'dark' ? '☀️' : '🌙';
}

themeToggle.addEventListener('click', () => {
  store.theme = store.theme === 'dark' ? 'light' : 'dark';
  saveStore();
  applyTheme(store.theme);
  renderChart();
});

applyTheme(store.theme);

/* ═══════════════════════════════════════════════════════
   5.  HEADER CLOCK
════════════════════════════════════════════════════════ */

const DAY_NAMES   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];

function updateHeaderClock() {
  const now = new Date();
  hdrDate.textContent  = `${DAY_NAMES[now.getDay()]}, ${now.getDate()} ${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
  hdrClock.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}
setInterval(updateHeaderClock, 1000);
updateHeaderClock();

/* ═══════════════════════════════════════════════════════
   6.  SCREEN WAKE LOCK
════════════════════════════════════════════════════════ */

let wakeLock = null;

async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeNote.hidden = false;
    wakeLock.addEventListener('release', () => { wakeNote.hidden = true; });
  } catch (_) { /* fail silently */ }
}

function releaseWakeLock() {
  if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  wakeNote.hidden = true;
}

/* ═══════════════════════════════════════════════════════
   7.  STOPWATCH  (timestamp-based)
════════════════════════════════════════════════════════ */

/**
 * Compute total elapsed seconds for the current session right now.
 * Uses startTimestamp + accSec; never increments a counter.
 */
function getElapsedSec() {
  if (!sw) return 0;
  if (!sw.running) return sw.accSec;
  return sw.accSec + (Date.now() - sw.startTimestamp) / 1000;
}

/**
 * MIDNIGHT SPLIT
 * Called on every animation frame while running.
 *
 * We track `sw.lastMidnight`: the epoch ms of the most recent midnight
 * that we've already accounted for. Each time the wall clock crosses a
 * midnight boundary, we:
 *   a) Compute seconds studied in the previous day (from lastMidnight
 *      until the next midnight boundary).
 *   b) Add those seconds to that date's daily total.
 *   c) Save a split session to history.
 *   d) Advance lastMidnight to the new midnight.
 *   e) Update the session's sessionDate to the new day.
 *
 * This loop handles multi-day sessions (e.g. the tab was left open for
 * 36 hours) by processing one midnight boundary per call and iterating.
 */
function processMidnightSplits() {
  if (!sw || !sw.running) return;

  const now     = Date.now();
  let   lastMid = sw.lastMidnight;

  // Calculate the next midnight after lastMidnight
  const lastMidDate  = new Date(lastMid);
  let   nextMidDate  = new Date(
    lastMidDate.getFullYear(),
    lastMidDate.getMonth(),
    lastMidDate.getDate() + 1,
    0, 0, 0, 0
  );

  // Loop so we handle sessions spanning multiple days at once
  while (nextMidDate.getTime() <= now) {
    const nextMid   = nextMidDate.getTime();

    // Credit all seconds that elapsed between sw.startTimestamp and nextMid.
    // On the first segment sw.startTimestamp is the actual start; after prior
    // splits it was reset to the previous midnight boundary (lastMid).
    const creditSec = Math.max(0, (nextMid - sw.startTimestamp) / 1000 + sw.accSec);

    // Save a split session for the previous day
    const prevDayKey = dateKey(new Date(nextMid - 1)); // 1 ms before midnight = yesterday
    if (creditSec > 0) {
      addToDaily(store.dailyTotals, prevDayKey, creditSec);
      store.sessions.push({
        id:        genId(),
        date:      prevDayKey,
        startTime: '', // split session
        endTime:   '',
        seconds:   Math.round(creditSec),
        subject:   sw.subject + ' (auto-split)'
      });
    }

    // Update the session so from now on time accrues to the new day
    sw.sessionDate   = dateKey(nextMidDate);
    sw.lastMidnight  = nextMid;
    sw.startTimestamp = nextMid;  // reset segment start to midnight
    sw.accSec         = 0;        // accumulated seconds reset for new day

    lastMid = nextMid;
    // Advance to the next midnight
    nextMidDate = new Date(
      nextMidDate.getFullYear(),
      nextMidDate.getMonth(),
      nextMidDate.getDate() + 1,
      0, 0, 0, 0
    );
  }

  // Persist if any splits happened
  saveStore();
  saveSwState(sw);
}

/** Total seconds studied today (committed + live running portion for today) */
function getTodayTotal() {
  const key       = todayKey();
  const committed = store.dailyTotals[key] || 0;
  if (!sw || sw.sessionDate !== key) return committed;
  // Include live (running) or paused accumulated seconds for today's session
  const liveForToday = sw.running
    ? sw.accSec + (Date.now() - sw.startTimestamp) / 1000
    : sw.accSec;
  return committed + liveForToday;
}

/** Render the stopwatch display and tab title */
function renderStopwatch() {
  const sec = getElapsedSec();
  swDisplay.textContent = fmtHMS(sec);
  document.title = sw && (sw.running || sw.accSec > 0)
    ? `${fmtHMS(sec)} · StudyTrack`
    : 'StudyTrack';
}

/** Update "Today's total" in the header */
function renderTodayTotal() {
  todayTotalEl.textContent = fmtHm(getTodayTotal());
}

/** Main animation loop — runs while stopwatch is in any active state */
function tick() {
  processMidnightSplits();   // must run first so session date is current
  renderStopwatch();
  renderTodayTotal();
  checkAlarms();
  updateGoalRing();
  if (sw && sw.running) {
    animFrame = requestAnimationFrame(tick);
  }
}

function startTick() {
  if (animFrame) cancelAnimationFrame(animFrame);
  animFrame = requestAnimationFrame(tick);
}

/* ─── Button handlers ─── */

btnStart.addEventListener('click', () => {
  const now     = Date.now();
  const nowDate = new Date(now);
  sw = {
    running:        true,
    startTimestamp: now,
    accSec:         0,
    subject:        swSubject.value.trim(),
    sessionDate:    todayKey(),
    sessionId:      genId(),
    lastMidnight:   midnightOf(new Date()),
    startTimeStr:   `${pad(nowDate.getHours())}:${pad(nowDate.getMinutes())}`
  };
  saveSwState(sw);
  updateSwButtons();
  startTick();
  requestWakeLock();
});

btnPause.addEventListener('click', () => {
  if (!sw || !sw.running) return;
  sw.accSec  += (Date.now() - sw.startTimestamp) / 1000;
  sw.running  = false;
  cancelAnimationFrame(animFrame);
  renderStopwatch();
  renderTodayTotal();
  saveSwState(sw);
  updateSwButtons();
  releaseWakeLock();
});

btnResume.addEventListener('click', () => {
  if (!sw || sw.running) return;
  sw.startTimestamp = Date.now();
  sw.running        = true;
  saveSwState(sw);
  updateSwButtons();
  startTick();
  requestWakeLock();
});

btnSave.addEventListener('click', () => {
  commitSession();
  resetSwState();
  renderStopwatch();
  renderTodayTotal();
  updateSwButtons();
  renderHistory();
  renderChart();
  saveStore();
  releaseWakeLock();
});

btnReset.addEventListener('click', () => {
  if (sw && (sw.accSec > 0 || sw.running)) {
    if (!confirm('Reset and discard the current session?')) return;
  }
  resetSwState();
  renderStopwatch();
  renderTodayTotal();
  updateSwButtons();
  releaseWakeLock();
});

/** Commit the current elapsed time to the store as a saved session */
function commitSession() {
  if (!sw) return;
  const totalSec = getElapsedSec();
  if (totalSec < 1) return;

  const now      = new Date();
  const key      = sw.sessionDate || dateKey(now);
  addToDaily(store.dailyTotals, key, totalSec);

  store.sessions.push({
    id:        sw.sessionId || genId(),
    date:      key,
    startTime: sw.startTimeStr || '',
    endTime:   `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    seconds:   Math.round(totalSec),
    subject:   sw.subject || ''
  });
}

function resetSwState() {
  if (animFrame) cancelAnimationFrame(animFrame);
  sw = null;
  saveSwState(null);
  document.title = 'StudyTrack';
}

function updateSwButtons() {
  const idle    = !sw;
  const running = sw && sw.running;
  const paused  = sw && !sw.running;

  btnStart.hidden  = !idle;
  btnPause.hidden  = !running;
  btnResume.hidden = !paused;
  btnSave.hidden   = idle;
  btnReset.hidden  = idle;
  swSubject.disabled = !!sw;
}

/** On page load: resume stopwatch if it was running */
function resumeOnLoad() {
  const saved = loadSwState();
  if (!saved) return;

  sw = saved;
  updateSwButtons();
  swSubject.value    = sw.subject || '';
  swSubject.disabled = true;

  // Handle the case where the tab was closed while running over midnight
  // processMidnightSplits will do the heavy lifting on the first tick
  if (sw.running) {
    startTick();
    requestWakeLock();
  } else {
    renderStopwatch();
    renderTodayTotal();
  }
}

/* ═══════════════════════════════════════════════════════
   8.  ALARMS
════════════════════════════════════════════════════════ */

let activeAlarmSound = null;    // Web Audio oscillator nodes
let alarmFiring     = false;

/** Build up a beep pattern using Web Audio API — no external file needed */
function playAlarmSound() {
  if (alarmFiring) return;
  alarmFiring = true;

  const ctx = new (window.AudioContext || window.webkitAudioContext)();

  function beep(start, freq, dur) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type = 'square';
    gain.gain.setValueAtTime(0.6, ctx.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
    osc.start(ctx.currentTime + start);
    osc.stop(ctx.currentTime + start + dur + 0.01);
  }

  // Pattern: three ascending double-beeps, repeat every 2s
  function pattern() {
    if (!alarmFiring) return;
    for (let i = 0; i < 3; i++) {
      beep(i * 0.5,       880, 0.18);
      beep(i * 0.5 + 0.2, 1100, 0.18);
    }
    setTimeout(pattern, 2500);
  }

  pattern();
  activeAlarmSound = ctx;

  // Vibrate on mobile
  if (navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 400]);
}

function stopAlarmSound() {
  alarmFiring = false;
  if (activeAlarmSound) {
    try { activeAlarmSound.close(); } catch (_) {}
    activeAlarmSound = null;
  }
  if (navigator.vibrate) navigator.vibrate(0);
}

function showAlarmOverlay(msg) {
  overlayMsg.textContent = msg;
  alarmOverlay.hidden = false;
}

function hideAlarmOverlay() {
  alarmOverlay.hidden = true;
}

btnStopAlarm.addEventListener('click', () => {
  stopAlarmSound();
  hideAlarmOverlay();
});

btnSnooze.addEventListener('click', () => {
  stopAlarmSound();
  hideAlarmOverlay();
  // Snooze: add 5 min to the current alarm target (extend session-mode alarm by 5 min)
  // We'll re-arm by temporarily marking fired alarms as "snoozed" with a future threshold
  const now = Date.now();
  store.alarms.forEach(a => {
    if (a._justFired) {
      a._snoozeUntil = now + 5 * 60 * 1000; // 5-minute grace
      delete a._justFired;
    }
  });
  saveStore();
});

/**
 * CHECK ALARMS — called every animation frame while running.
 * Uses timestamp-based elapsed time (getElapsedSec()), never a counter.
 */
function checkAlarms() {
  if (!sw) return;
  const now       = Date.now();
  const sessionSec = getElapsedSec();
  const todaySec   = getTodayTotal();
  const key        = todayKey();

  store.alarms.forEach(alarm => {
    if (!alarm.enabled) return;
    // Respect snooze grace
    if (alarm._snoozeUntil && now < alarm._snoozeUntil) return;
    if (alarm._snoozeUntil && now >= alarm._snoozeUntil) delete alarm._snoozeUntil;

    const target = alarm.targetSec;

    if (alarm.mode === 'session') {
      // Fire once per stopwatch session
      if (alarm.firedSessionId === sw.sessionId) return;
      if (sessionSec >= target) {
        alarm.firedSessionId = sw.sessionId;
        alarm._justFired = true;
        triggerAlarm(alarm);
      }
    } else {
      // 'daily' mode — fire once per calendar day when daily total reaches target
      if (alarm.firedDate === key) return;
      if (todaySec >= target) {
        alarm.firedDate = key;
        alarm._justFired = true;
        triggerAlarm(alarm);
      }
    }
  });
}

function triggerAlarm(alarm) {
  const h = Math.floor(alarm.targetSec / 3600);
  const m = Math.floor((alarm.targetSec % 3600) / 60);
  const label = `${h}h ${m}m ${alarm.mode === 'session' ? 'session' : 'daily'} alarm`;

  playAlarmSound();
  showAlarmOverlay(`You have studied for ${h}h ${m}m — ${alarm.mode === 'session' ? 'this session' : 'today'}!`);

  // Browser notification
  if (Notification.permission === 'granted') {
    new Notification('StudyTrack – ' + label, {
      body:    `You reached your ${alarm.mode} study goal!`,
      icon:    'icons/icon-192.png',
      silent:  false
    });
  }

  saveStore();
  renderAlarms();
}

function renderAlarms() {
  alarmList.innerHTML = '';
  store.alarms.forEach(alarm => {
    const li  = document.createElement('li');
    li.className = 'alarm-item' + (alarm.firedDate === todayKey() || alarm.firedSessionId ? ' fired' : '');

    const h = Math.floor(alarm.targetSec / 3600);
    const m = Math.floor((alarm.targetSec % 3600) / 60);

    li.innerHTML = `
      <span class="alarm-item-label">
        ${h}h ${pad(m)}m
        <span class="alarm-item-mode">(${alarm.mode === 'session' ? 'per session' : 'daily total'})</span>
      </span>
      <input type="checkbox" class="alarm-toggle" title="Enable / disable" ${alarm.enabled ? 'checked' : ''} data-id="${alarm.id}" />
      <button class="alarm-del-btn" data-id="${alarm.id}" title="Delete alarm">🗑</button>
    `;
    alarmList.appendChild(li);
  });

  alarmList.querySelectorAll('.alarm-toggle').forEach(cb => {
    cb.addEventListener('change', () => {
      const a = store.alarms.find(x => x.id === cb.dataset.id);
      if (a) { a.enabled = cb.checked; saveStore(); }
    });
  });

  alarmList.querySelectorAll('.alarm-del-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      store.alarms = store.alarms.filter(x => x.id !== btn.dataset.id);
      saveStore();
      renderAlarms();
    });
  });
}

btnAddAlarm.addEventListener('click', async () => {
  const h = parseInt(alarmH.value, 10) || 0;
  const m = parseInt(alarmM.value, 10) || 0;
  const target = h * 3600 + m * 60;
  if (target < 60) { alert('Please set at least 1 minute.'); return; }

  // Request notification permission on first alarm
  if (store.alarms.length === 0 && Notification.permission === 'default') {
    await Notification.requestPermission().catch(() => {});
  }

  store.alarms.push({
    id:        genId(),
    targetSec: target,
    mode:      alarmMode.value,
    enabled:   true,
    firedDate: null,
    firedSessionId: null
  });
  saveStore();
  renderAlarms();
});

/* ═══════════════════════════════════════════════════════
   9.  DAILY GOAL
════════════════════════════════════════════════════════ */

function renderGoal() {
  if (store.dailyGoalSec > 0) {
    goalHoursEl.value = (store.dailyGoalSec / 3600).toFixed(1);
    goalProgressRow.hidden = false;
    goalTargetVal.textContent = fmtHm(store.dailyGoalSec);
  } else {
    goalProgressRow.hidden = true;
  }
}

btnSaveGoal.addEventListener('click', () => {
  const h = parseFloat(goalHoursEl.value) || 0;
  store.dailyGoalSec = Math.round(h * 3600);
  saveStore();
  renderGoal();
  updateGoalRing();
  renderChart(); // re-render to show/hide goal line
});

function updateGoalRing() {
  if (store.dailyGoalSec <= 0) return;
  const today    = getTodayTotal();
  const pct      = Math.min(1, today / store.dailyGoalSec);
  const offset   = RING_C * (1 - pct);
  ringFill.style.strokeDashoffset = offset;
  ringPct.textContent  = Math.round(pct * 100) + '%';
  goalTodayVal.textContent = fmtHm(today);
}

/* ═══════════════════════════════════════════════════════
   10. CHART (Chart.js)
════════════════════════════════════════════════════════ */

let chartInstance = null;
let currentRange  = 'daily';

rangeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    rangeBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentRange = btn.dataset.range;
    // Show month picker only for 'daily' view
    const showPicker = (currentRange === 'daily');
    monthPickerWrap.hidden = !showPicker;
    // Pre-fill the picker with current month the first time it becomes visible
    if (showPicker && !monthPicker.value) {
      monthPicker.value = monthPicker.dataset.currentMonth || '';
    }
    renderChart();
  });
});

monthPicker.addEventListener('change', renderChart);

/** Get the CSS variable value resolved on the body */
function cssVar(name) {
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}

/** Build the dataset for the chart based on the current range */
function buildChartData() {
  const daily = store.dailyTotals;

  if (currentRange === 'daily') {
    // Last 7 days or chosen month
    let dates = [];
    if (monthPicker.value) {
      const [y, m] = monthPicker.value.split('-').map(Number);
      const daysInMonth = new Date(y, m, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        dates.push(`${y}-${pad(m)}-${pad(d)}`);
      }
    } else {
      const now = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        dates.push(dateKey(d));
      }
    }
    return {
      labels:  dates.map(k => { const d = parseDateKey(k); return `${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0,3)}`; }),
      values:  dates.map(k => +(((daily[k] || 0) + (k === todayKey() ? getLiveAddition() : 0)) / 3600).toFixed(2)),
      rawSecs: dates.map(k =>  (daily[k] || 0) + (k === todayKey() ? getLiveAddition() : 0)),
      title:   monthPicker.value ? `Daily – ${monthPicker.value}` : 'Last 7 days'
    };
  }

  if (currentRange === 'weekly') {
    // Last 8 Monday-to-Sunday weeks
    const weeks = [];
    const now   = new Date();
    // Find most recent Monday
    const dow   = now.getDay(); // 0=Sun
    const daysToMon = (dow === 0) ? 6 : dow - 1;
    const thisMon   = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysToMon);

    for (let w = 7; w >= 0; w--) {
      const mon = new Date(thisMon.getFullYear(), thisMon.getMonth(), thisMon.getDate() - w * 7);
      const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
      let total = 0;
      for (let d = 0; d < 7; d++) {
        const k = dateKey(new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + d));
        total += (daily[k] || 0) + (k === todayKey() ? getLiveAddition() : 0);
      }
      weeks.push({ label: `${mon.getDate()} ${MONTH_NAMES[mon.getMonth()].slice(0,3)}`, total });
    }
    return {
      labels:  weeks.map(w => w.label),
      values:  weeks.map(w => +(w.total / 3600).toFixed(2)),
      rawSecs: weeks.map(w => w.total),
      title:   'Last 8 weeks'
    };
  }

  if (currentRange === 'monthly') {
    // Last 12 calendar months
    const months = [];
    const now    = new Date();
    for (let i = 11; i >= 0; i--) {
      const y = now.getFullYear(), m = now.getMonth() - i;
      const d = new Date(y, m, 1);
      const yr = d.getFullYear(), mo = d.getMonth();
      const days = new Date(yr, mo + 1, 0).getDate();
      let total = 0;
      for (let day = 1; day <= days; day++) {
        const k = `${yr}-${pad(mo + 1)}-${pad(day)}`;
        total += (daily[k] || 0) + (k === todayKey() ? getLiveAddition() : 0);
      }
      months.push({ label: `${MONTH_NAMES[mo].slice(0,3)} '${String(yr).slice(2)}`, total });
    }
    return {
      labels:  months.map(m => m.label),
      values:  months.map(m => +(m.total / 3600).toFixed(2)),
      rawSecs: months.map(m => m.total),
      title:   'Last 12 months'
    };
  }

  // yearly — all years in data
  const allKeys = Object.keys(daily);
  if (!allKeys.length) return { labels: [], values: [], rawSecs: [], title: 'Yearly' };
  const years = [...new Set(allKeys.map(k => k.slice(0, 4)))].sort();
  return {
    labels:  years,
    values:  years.map(y => {
      const total = Object.entries(daily)
        .filter(([k]) => k.startsWith(y))
        .reduce((s, [k, v]) => s + v + (k === todayKey() ? getLiveAddition() : 0), 0);
      return +(total / 3600).toFixed(2);
    }),
    rawSecs: years.map(y => Object.entries(daily)
      .filter(([k]) => k.startsWith(y))
      .reduce((s, [k, v]) => s + v + (k === todayKey() ? getLiveAddition() : 0), 0)
    ),
    title: 'All years'
  };
}

/** Live addition for today (unsaved session, running or paused) */
function getLiveAddition() {
  if (!sw || sw.sessionDate !== todayKey()) return 0;
  return sw.running
    ? sw.accSec + (Date.now() - sw.startTimestamp) / 1000
    : sw.accSec;
}

/** Summary statistics for the currently displayed data */
function computeSummary(rawSecs) {
  if (!rawSecs.length) return { total: 0, avg: 0, best: 0 };
  const total = rawSecs.reduce((a, b) => a + b, 0);
  const nonZero = rawSecs.filter(v => v > 0);
  const avg  = nonZero.length ? total / nonZero.length : 0;
  const best = Math.max(...rawSecs);
  return { total, avg, best };
}

/** Compute streak: consecutive days with ≥ goalSec (or any if no goal) */
function computeStreak() {
  const daily = store.dailyTotals;
  const minSec = store.dailyGoalSec > 0 ? store.dailyGoalSec : 1;
  const now    = new Date();
  let streak   = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const k = dateKey(d);
    const s = (daily[k] || 0) + (k === todayKey() ? getLiveAddition() : 0);
    if (s >= minSec) { streak++; }
    else { break; }
  }
  return streak;
}

function renderChart() {
  const data = buildChartData();
  const hasData = data.values.some(v => v > 0);

  chartEmpty.hidden = hasData;

  // Update summary cards
  const { total, avg, best } = computeSummary(data.rawSecs);
  scTotal.textContent  = fmtHm(total);
  scAvg.textContent    = fmtHm(avg);
  scBest.textContent   = fmtHm(best);
  scStreak.textContent = computeStreak() + ' day' + (computeStreak() !== 1 ? 's' : '');

  const accent   = cssVar('--accent');
  const textSec  = cssVar('--text-secondary');
  const textMut  = cssVar('--text-muted');
  const surface  = cssVar('--surface');
  const border   = cssVar('--border');

  // Goal line dataset
  const goalHours = store.dailyGoalSec / 3600;
  const plugins = {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: ctx => {
          const sec = data.rawSecs[ctx.dataIndex];
          return ' ' + fmtHm(sec);
        }
      },
      backgroundColor: surface,
      titleColor: textSec,
      bodyColor: accent,
      borderColor: border,
      borderWidth: 1,
      padding: 10,
      cornerRadius: 8
    }
  };

  const datasets = [{
    label: 'Study hours',
    data:  data.values,
    backgroundColor: accent + 'CC',
    borderColor:     accent,
    borderWidth: 2,
    borderRadius: 6,
    hoverBackgroundColor: accent
  }];

  if (currentRange === 'daily' && store.dailyGoalSec > 0) {
    datasets.push({
      type:  'line',
      label: 'Daily goal',
      data:  data.labels.map(() => goalHours),
      borderColor:  '#F59E0B',
      borderWidth:  2,
      borderDash:   [6, 4],
      pointRadius:  0,
      fill:         false,
      tension:      0
    });
  }

  if (chartInstance) chartInstance.destroy();

  if (!hasData) return;

  chartInstance = new Chart(studyChart, {
    type: 'bar',
    data: { labels: data.labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 350 },
      scales: {
        x: {
          grid:  { color: border },
          ticks: { color: textMut, maxRotation: 45 }
        },
        y: {
          beginAtZero: true,
          grid:  { color: border },
          ticks: {
            color: textMut,
            callback: v => v + 'h'
          }
        }
      },
      plugins
    }
  });
}

/* ═══════════════════════════════════════════════════════
   11. HISTORY
════════════════════════════════════════════════════════ */

function renderHistory() {
  historyList.innerHTML = '';

  // Group sessions by date, newest first
  const byDate = {};
  store.sessions.forEach(s => {
    if (!byDate[s.date]) byDate[s.date] = [];
    byDate[s.date].push(s);
  });

  const sortedDates = Object.keys(byDate).sort().reverse();

  if (!sortedDates.length) {
    historyList.innerHTML = '<p class="history-empty">No sessions yet. Start studying!</p>';
    return;
  }

  sortedDates.forEach(date => {
    const sessions = byDate[date].sort((a, b) => (b.startTime || '').localeCompare(a.startTime || ''));
    const dayTotal = sessions.reduce((s, x) => s + (x.seconds || 0), 0);

    const group = document.createElement('div');
    group.className = 'history-day-group';

    const d = parseDateKey(date);
    const header = document.createElement('div');
    header.className = 'history-day-header';
    header.innerHTML = `
      <span>${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}</span>
      <span class="history-day-total">${fmtHm(dayTotal)}</span>
    `;
    // Toggle collapse
    header.addEventListener('click', () => {
      sessionContainer.hidden = !sessionContainer.hidden;
    });

    const sessionContainer = document.createElement('div');
    sessionContainer.className = 'history-sessions';

    sessions.forEach(sess => {
      const item = document.createElement('div');
      item.className = 'history-session-item';

      const timeLabel = sess.startTime
        ? `${sess.startTime}${sess.endTime ? ' – ' + sess.endTime : ''}`
        : 'manual';

      item.innerHTML = `
        <span class="session-time">${timeLabel}</span>
        <span class="session-dur">${fmtHm(sess.seconds)}</span>
        <span class="session-subj">${sess.subject ? '📖 ' + escHtml(sess.subject) : ''}</span>
        <button class="session-del" data-id="${sess.id}" title="Delete session">🗑</button>
      `;
      sessionContainer.appendChild(item);
    });

    sessionContainer.querySelectorAll('.session-del').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        deleteSession(btn.dataset.id);
      });
    });

    group.appendChild(header);
    group.appendChild(sessionContainer);
    historyList.appendChild(group);
  });
}

function deleteSession(id) {
  const idx = store.sessions.findIndex(s => s.id === id);
  if (idx === -1) return;
  const sess = store.sessions[idx];
  store.sessions.splice(idx, 1);
  // Recalculate daily total for that date
  recalcDailyTotal(sess.date);
  saveStore();
  renderHistory();
  renderTodayTotal();
  renderChart();
  updateGoalRing();
}

/** Recompute dailyTotals[date] from the sessions list */
function recalcDailyTotal(date) {
  const total = store.sessions
    .filter(s => s.date === date)
    .reduce((s, x) => s + (x.seconds || 0), 0);
  if (total > 0) store.dailyTotals[date] = total;
  else delete store.dailyTotals[date];
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ─── Manual session form ─── */
btnAddManual.addEventListener('click', () => {
  manualForm.hidden = !manualForm.hidden;
  if (!manualForm.hidden) {
    manDate.value  = todayKey();
    manStart.value = '09:00';
  }
});

btnManCancel.addEventListener('click', () => { manualForm.hidden = true; });

btnManSave.addEventListener('click', () => {
  const date    = manDate.value;
  const start   = manStart.value;
  const durH    = parseInt(manDurH.value, 10) || 0;
  const durM    = parseInt(manDurM.value, 10) || 0;
  const durSec  = durH * 3600 + durM * 60;
  const subject = manSubject.value.trim();

  if (!date || durSec < 60) { alert('Please fill in a date and at least 1 minute duration.'); return; }

  const [sh, sm] = start.split(':').map(Number);
  const endDate  = new Date(parseDateKey(date));
  endDate.setHours(sh, sm + Math.floor(durSec / 60), durSec % 60);
  const endStr   = `${pad(endDate.getHours())}:${pad(endDate.getMinutes())}`;

  store.sessions.push({
    id:        genId(),
    date,
    startTime: start,
    endTime:   endStr,
    seconds:   durSec,
    subject
  });

  addToDaily(store.dailyTotals, date, durSec);
  saveStore();
  renderHistory();
  renderTodayTotal();
  renderChart();
  updateGoalRing();
  manualForm.hidden = true;
});

/* ═══════════════════════════════════════════════════════
   12. TABS
════════════════════════════════════════════════════════ */

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');

    const id = `tab-${btn.dataset.tab}`;
    document.querySelectorAll('.tab-pane').forEach(p => {
      p.hidden = (p.id !== id);
      p.classList.toggle('active', p.id === id);
    });

    if (btn.dataset.tab === 'graphs')  renderChart();
    if (btn.dataset.tab === 'history') renderHistory();
  });
});

/* ═══════════════════════════════════════════════════════
   13. EXPORT / IMPORT / CLEAR
════════════════════════════════════════════════════════ */

btnExport.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ ...store, _version: 2 }, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `studytrack-backup-${todayKey()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

importFile.addEventListener('change', async () => {
  const file = importFile.files[0];
  if (!file) return;
  try {
    const text   = await file.text();
    const parsed = JSON.parse(text);

    // Merge dailyTotals (additive)
    Object.entries(parsed.dailyTotals || {}).forEach(([k, v]) => {
      // We'll recompute from sessions after import, so just merge for now
    });

    // Merge sessions (skip duplicates by id)
    const existingIds = new Set(store.sessions.map(s => s.id));
    (parsed.sessions || []).forEach(s => {
      if (!existingIds.has(s.id)) store.sessions.push(s);
    });

    // Recompute all daily totals from merged sessions
    store.dailyTotals = {};
    store.sessions.forEach(s => addToDaily(store.dailyTotals, s.date, s.seconds || 0));

    saveStore();
    renderHistory();
    renderChart();
    renderTodayTotal();
    updateGoalRing();
    alert('Import complete! ' + (parsed.sessions || []).length + ' sessions processed.');
  } catch (err) {
    alert('Import failed: ' + err.message);
  }
  importFile.value = '';
});

btnClearData.addEventListener('click', () => {
  if (!confirm('This will permanently delete ALL study data. Are you sure?')) return;
  store = { dailyTotals: {}, sessions: [], alarms: [], dailyGoalSec: 0, theme: store.theme };
  saveStore();
  resetSwState();
  renderAll();
  alert('All data cleared.');
});

/* ═══════════════════════════════════════════════════════
   14. CROSS-TAB SYNC via storage event
════════════════════════════════════════════════════════ */

window.addEventListener('storage', e => {
  if (e.key === STORE_KEY) {
    store = loadStore();
    renderAll();
  }
  if (e.key === SW_KEY) {
    // Another tab changed the stopwatch state
    const other = loadSwState();
    if (!other && sw) {
      // Another tab stopped or reset
      if (animFrame) cancelAnimationFrame(animFrame);
      sw = null;
      updateSwButtons();
      renderStopwatch();
    }
  }
});

/* ═══════════════════════════════════════════════════════
   15. PWA SERVICE WORKER REGISTRATION
════════════════════════════════════════════════════════ */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

/* ═══════════════════════════════════════════════════════
   16. INITIAL RENDER
════════════════════════════════════════════════════════ */

function renderAll() {
  renderGoal();
  renderAlarms();
  updateGoalRing();
  renderChart();
  renderHistory();
  renderTodayTotal();
  renderStopwatch();
  updateSwButtons();
}

// Pre-populate the month picker with the current month (shown when user clicks it)
// but don't set a value that would override the "last 7 days" default chart view.
(function initMonthPicker() {
  const now = new Date();
  monthPicker.dataset.currentMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  // Populate the value only when the picker becomes visible (via range button click)
})();

renderAll();
resumeOnLoad();

/* ═══════════════════════════════════════════════════════
   17. DAILY SENTENCE FEATURE
   • AI-powered via /api/daily-sentence (Gemini 2.5 Flash on Vercel)
   • 65-sentence built-in fallback database (fallback-sentences.js)
   • Strictly deduplicated, local date attribution, audio pronunciation
   • Daily read-state persistence & reviewable past history
════════════════════════════════════════════════════════ */

const SENTENCE_KEY = 'studytrack_sentence';

// DOM elements for Daily Sentence
const sentenceCard          = $('sentence-card');
const sentenceDateLabel     = $('sentence-date-label');
const sentenceEn            = $('sentence-en');
const sentenceBn            = $('sentence-bn');
const sentenceUsage         = $('sentence-usage');
const btnSpeakSentence      = $('btn-speak-sentence');
const btnMarkRead           = $('btn-mark-read');
const btnPastSentences      = $('btn-past-sentences');
const btnBannerPastSentences= $('btn-banner-past-sentences');
const sentenceReadBanner    = $('sentence-read-banner');
const pastSentencesModal    = $('past-sentences-modal');
const pastSentencesList     = $('past-sentences-list');
const btnClosePastModal     = $('btn-close-past-modal');

/** Load sentence store from localStorage */
function loadSentenceStore() {
  const defaults = {
    todayDate: '',
    todaySentence: null,
    isRead: false,
    history: []
  };
  try {
    const raw = localStorage.getItem(SENTENCE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      todayDate:     typeof parsed.todayDate === 'string' ? parsed.todayDate : '',
      todaySentence: (parsed.todaySentence && typeof parsed.todaySentence === 'object') ? parsed.todaySentence : null,
      isRead:        Boolean(parsed.isRead),
      history:       Array.isArray(parsed.history) ? parsed.history : []
    };
  } catch (_) {
    return defaults;
  }
}

/** Save sentence store to localStorage */
function saveSentenceStore(data) {
  try {
    localStorage.setItem(SENTENCE_KEY, JSON.stringify(data));
  } catch (_) {}
}

/** Extract normalized list of all previously seen sentences to avoid repeats */
function getUsedSentences(store) {
  const set = new Set();
  if (Array.isArray(store.history)) {
    store.history.forEach(item => {
      if (item && item.sentence) set.add(item.sentence.trim().toLowerCase());
    });
  }
  if (store.todaySentence && store.todaySentence.sentence) {
    set.add(store.todaySentence.sentence.trim().toLowerCase());
  }
  return set;
}

/** Pick a guaranteed unused sentence from built-in fallback database */
function pickFallbackSentence(usedSet) {
  const list = (typeof window !== 'undefined' && Array.isArray(window.FALLBACK_SENTENCES))
    ? window.FALLBACK_SENTENCES
    : [
        {
          sentence: "I'd really appreciate it if you could give me a hand.",
          bangla: "আপনি যদি আমাকে একটু সাহায্য করতেন, আমি সত্যিই কৃতজ্ঞ হতাম।",
          usage: "Use when politely asking someone for help with schoolwork or chores."
        }
      ];

  // Find the first sentence not yet in the used set
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    if (!usedSet.has(s.sentence.trim().toLowerCase())) {
      return {
        sentence: s.sentence,
        bangla:   s.bangla,
        usage:    s.usage,
        source:   'fallback-database'
      };
    }
  }

  // If all sentences in the database have been used, pick the least recently seen one
  const randomIndex = Math.floor(Math.random() * list.length);
  const fallback = list[randomIndex];
  return {
    sentence: fallback.sentence,
    bangla:   fallback.bangla,
    usage:    fallback.usage,
    source:   'fallback-database-recycled'
  };
}

/** Fetch sentence from Vercel Serverless Function (/api/daily-sentence) */
async function fetchFromGeminiAPI(previousSentencesList) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s client timeout

  try {
    const res = await fetch('/api/daily-sentence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ previousSentences: previousSentencesList }),
      signal: controller.signal
    });

    if (!res.ok) {
      throw new Error(`API returned HTTP ${res.status}`);
    }

    const data = await res.json();
    if (!data || !data.sentence || !data.bangla || !data.usage) {
      throw new Error('Incomplete sentence payload received from API');
    }

    return {
      sentence: String(data.sentence).trim(),
      bangla:   String(data.bangla).trim(),
      usage:    String(data.usage).trim(),
      source:   data.source || 'gemini-2.5-flash'
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Speak English sentence aloud using Web Speech API */
function speakEnglishSentence(text, triggerBtn) {
  if (!('speechSynthesis' in window)) {
    return;
  }

  try {
    window.speechSynthesis.cancel(); // Stop any pending speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.88; // Natural, clear educational pace

    if (triggerBtn) {
      utterance.onstart = () => triggerBtn.classList.add('speaking');
      utterance.onend   = () => triggerBtn.classList.remove('speaking');
      utterance.onerror = () => triggerBtn.classList.remove('speaking');
    }

    window.speechSynthesis.speak(utterance);
  } catch (_) {
    if (triggerBtn) triggerBtn.classList.remove('speaking');
  }
}

/** Format a friendly date string (e.g. "Monday, 16 November") */
function formatSentenceDate(d) {
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
}

/** Render the Daily Sentence UI card */
function renderDailySentenceCard(sentenceObj, isTodayRead, dateStr) {
  if (!sentenceCard) return;

  if (isTodayRead) {
    sentenceCard.hidden = true;
    if (sentenceReadBanner) sentenceReadBanner.hidden = false;
    return;
  }

  if (sentenceReadBanner) sentenceReadBanner.hidden = true;
  sentenceCard.hidden = false;

  if (sentenceDateLabel) {
    const today = new Date();
    sentenceDateLabel.textContent = `· ${formatSentenceDate(today)}`;
  }

  if (sentenceEn)    sentenceEn.textContent    = sentenceObj.sentence;
  if (sentenceBn)    sentenceBn.textContent    = sentenceObj.bangla;
  if (sentenceUsage) sentenceUsage.innerHTML   = `<strong>💡 When to use:</strong> ${sentenceObj.usage}`;
}

/** Populate and open the Past Sentences review modal */
function openPastSentencesModal() {
  if (!pastSentencesModal || !pastSentencesList) return;

  const store = loadSentenceStore();
  const history = store.history || [];

  pastSentencesList.innerHTML = '';

  if (history.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'past-empty';
    empty.innerHTML = '✨ No past sentences yet.<br>Click <strong>"✓ Read"</strong> on today\'s sentence to start building your collection!';
    pastSentencesList.appendChild(empty);
  } else {
    // Show newest first
    const sorted = [...history].reverse();

    sorted.forEach(item => {
      const el = document.createElement('div');
      el.className = 'past-sentence-item';

      const topRow = document.createElement('div');
      topRow.className = 'past-item-top';

      const dateSpan = document.createElement('span');
      dateSpan.className = 'past-item-date';
      dateSpan.textContent = item.date || '';

      const speakBtn = document.createElement('button');
      speakBtn.className = 'icon-btn-speak';
      speakBtn.style.width = '30px';
      speakBtn.style.height = '30px';
      speakBtn.style.fontSize = '0.85rem';
      speakBtn.title = 'Listen pronunciation';
      speakBtn.innerHTML = '🔊';
      speakBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        speakEnglishSentence(item.sentence, speakBtn);
      });

      topRow.appendChild(dateSpan);
      topRow.appendChild(speakBtn);

      const enP = document.createElement('div');
      enP.className = 'past-item-en';
      enP.textContent = `“${item.sentence}”`;

      const bnP = document.createElement('div');
      bnP.className = 'past-item-bn';
      bnP.textContent = item.bangla;

      const usageP = document.createElement('div');
      usageP.className = 'past-item-usage';
      usageP.textContent = `💡 ${item.usage}`;

      el.appendChild(topRow);
      el.appendChild(enP);
      el.appendChild(bnP);
      el.appendChild(usageP);

      pastSentencesList.appendChild(el);
    });
  }

  pastSentencesModal.hidden = false;
}

/** Close the Past Sentences review modal */
function closePastSentencesModal() {
  if (pastSentencesModal) pastSentencesModal.hidden = true;
}

/** Initialize Daily Sentence feature */
async function initDailySentenceFeature() {
  const todayKey = dateKey(new Date());
  let store = loadSentenceStore();

  // Check if today already has an active sentence
  if (store.todayDate === todayKey && store.todaySentence) {
    // Already set for today — render current sentence or read-banner
    renderDailySentenceCard(store.todaySentence, store.isRead, store.todayDate);
    return;
  }

  // New day or first visit:
  // If yesterday had a sentence that wasn't archived into history, archive it now
  if (store.todaySentence && store.todayDate && store.todayDate !== todayKey) {
    const alreadyInHistory = store.history.some(h => h.date === store.todayDate || h.sentence === store.todaySentence.sentence);
    if (!alreadyInHistory) {
      store.history.push({
        date:     store.todayDate,
        sentence: store.todaySentence.sentence,
        bangla:   store.todaySentence.bangla,
        usage:    store.todaySentence.usage
      });
    }
  }

  // Reset for today
  store.todayDate     = todayKey;
  store.isRead        = false;
  store.todaySentence = null;
  saveSentenceStore(store);

  const usedSet = getUsedSentences(store);
  const previousList = Array.from(usedSet);

  let sentenceObj = null;

  // Attempt to fetch fresh sentence from Gemini serverless function
  try {
    sentenceObj = await fetchFromGeminiAPI(previousList);
  } catch (err) {
    // Seamless fallback: pick next unused sentence from offline database
    sentenceObj = pickFallbackSentence(usedSet);
  }

  // Store and render
  store.todaySentence = sentenceObj;
  saveSentenceStore(store);
  renderDailySentenceCard(sentenceObj, false, todayKey);
}

// ── Event Handlers for Daily Sentence ───────────────────

// Read aloud button
if (btnSpeakSentence) {
  btnSpeakSentence.addEventListener('click', () => {
    const store = loadSentenceStore();
    if (store.todaySentence && store.todaySentence.sentence) {
      speakEnglishSentence(store.todaySentence.sentence, btnSpeakSentence);
    }
  });
}

// Mark as Read button
if (btnMarkRead) {
  btnMarkRead.addEventListener('click', () => {
    const store = loadSentenceStore();
    if (!store.todaySentence) return;

    store.isRead = true;

    // Archive into history if not already present
    const alreadyArchived = store.history.some(
      h => h.date === store.todayDate && h.sentence === store.todaySentence.sentence
    );
    if (!alreadyArchived) {
      store.history.push({
        date:     store.todayDate,
        sentence: store.todaySentence.sentence,
        bangla:   store.todaySentence.bangla,
        usage:    store.todaySentence.usage
      });
    }

    saveSentenceStore(store);

    // Smooth dismissal animation
    if (sentenceCard) {
      sentenceCard.classList.add('fade-out');
      setTimeout(() => {
        sentenceCard.hidden = true;
        sentenceCard.classList.remove('fade-out');
        if (sentenceReadBanner) sentenceReadBanner.hidden = false;
      }, 320);
    }
  });
}

// Past sentences modal buttons
if (btnPastSentences) {
  btnPastSentences.addEventListener('click', openPastSentencesModal);
}
if (btnBannerPastSentences) {
  btnBannerPastSentences.addEventListener('click', openPastSentencesModal);
}
if (btnClosePastModal) {
  btnClosePastModal.addEventListener('click', closePastSentencesModal);
}

// Close modal when clicking outside modal box
if (pastSentencesModal) {
  pastSentencesModal.addEventListener('click', (e) => {
    if (e.target === pastSentencesModal) closePastSentencesModal();
  });
}

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && pastSentencesModal && !pastSentencesModal.hidden) {
    closePastSentencesModal();
  }
});

// Run initial sentence check on load
initDailySentenceFeature();

// Also check on tab visibility change or midnight split if date changed
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    const todayKey = dateKey(new Date());
    const store = loadSentenceStore();
    if (store.todayDate !== todayKey) {
      initDailySentenceFeature();
    }
  }
});

/* ═══════════════════════════════════════════════════════
   ANIMATED STUDY BACKGROUND
   Parallax (mouse on desktop, scroll on mobile) + particles.

   HOW IT WORKS
   ────────────
   • Each .bg-obj outer div holds its position (left/top) and
     receives JS-driven translate() for the parallax offset.
   • The inner .bg-obj-inner runs the CSS float keyframe animation.
     These two transforms live on separate elements so they never
     interfere with each other.
   • data-layer="1|2|3" controls parallax depth:
       1 = furthest (small shift, most blur/opacity reduction)
       3 = nearest  (biggest shift, sharpest, highest opacity)
   • Particles are injected here so the HTML stays clean.

   HOW TO CUSTOMISE
   ────────────────
   COLORS   → edit PARTICLE_COLORS array and color: on each .bg-obj in HTML
   SPEED    → edit --float-dur inline on each .bg-obj, or LERP_SPEED below
   PARALLAX → edit DEPTH_PX values below (px shift at cursor edge)
   OBJECTS  → add/remove .bg-obj blocks in index.html
   PARTICLES→ edit PARTICLE_COUNT / PARTICLE_COUNT_MOBILE below
════════════════════════════════════════════════════════ */
(function initStudyBg() {
  'use strict';

  const bg = document.getElementById('study-bg');
  if (!bg) return;

  /* ── Config ──────────────────────────────────────────── */
  const LERP_SPEED        = 0.055;   // 0–1: higher = snappier parallax
  const PARTICLE_COUNT    = 22;      // desktop particle count
  const PARTICLE_COUNT_MOB= 9;       // mobile particle count
  const PARTICLE_COLORS   = ['#1E6FFF', '#FF2442', '#A040FF', '#3B82F6', '#FF1A80', '#9333EA'];
  // px shift per layer at full cursor-edge position:
  const DEPTH_PX = { '1': 7, '2': 15, '3': 26 };

  /* ── Reduced-motion guard ───────────────────────────── */
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Inject particle dots ─────────────────────────────
     Small floating circles in the site's purple/magenta palette.
     Each gets random size, position, speed, delay, and color.     */
  const isMobile  = window.innerWidth < 640;
  const pCount    = isMobile ? PARTICLE_COUNT_MOB : PARTICLE_COUNT;

  for (let i = 0; i < pCount; i++) {
    const p = document.createElement('div');
    p.className = 'bg-particle';
    const size  = 1.8 + Math.random() * 3.6;              // 1.8–5.4 px
    const color = PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)];
    // Scatter across full viewport width, upper 80% of height
    p.style.cssText = [
      `left:${Math.random() * 100}%`,
      `top:${10 + Math.random() * 75}%`,
      `width:${size}px`,
      `height:${size}px`,
      `color:${color}`,
      `--pr-dur:${9 + Math.random() * 13}s`,
      `--pr-del:${-(Math.random() * 16).toFixed(1)}s`,
      `opacity:${(0.09 + Math.random() * 0.22).toFixed(2)}`
    ].join(';');
    bg.appendChild(p);
  }

  /* ── Parallax ─────────────────────────────────────────
     Mouse pos is normalised to –1…+1 on each axis.
     currentX/Y lerp toward targetX/Y each frame for smooth motion.
     JS writes transform: translate(x, y) on each outer .bg-obj.
     This does NOT affect the inner CSS float animation.             */
  if (reducedMotion) return;  // skip rAF loop entirely

  const objects = [...bg.querySelectorAll('.bg-obj')];
  let targetX = 0, targetY = 0;
  let currentX = 0, currentY = 0;
  let rafId;

  /* Desktop: follow the mouse */
  document.addEventListener('mousemove', e => {
    targetX = (e.clientX / window.innerWidth  - 0.5) * 2;  // –1 → +1
    targetY = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  /* Reset when cursor leaves the window */
  document.addEventListener('mouseleave', () => {
    targetX = 0;
    targetY = 0;
  });

  /* Mobile: gentle scroll-based vertical shift */
  let lastScrollY = window.scrollY;
  window.addEventListener('scroll', () => {
    if (window.innerWidth >= 768) return;          // desktop uses mouse
    const delta = (window.scrollY - lastScrollY) * 0.004;
    targetY = Math.max(-1, Math.min(1, targetY + delta));
    lastScrollY = window.scrollY;
  }, { passive: true });

  /* Pause the rAF when tab is hidden to save CPU */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(rafId);
    } else {
      rafId = requestAnimationFrame(tick);
    }
  });

  /* Main rAF loop */
  function tick() {
    // Smooth lerp toward target
    currentX += (targetX - currentX) * LERP_SPEED;
    currentY += (targetY - currentY) * LERP_SPEED;

    // Apply per-layer translate to each outer .bg-obj
    for (let i = 0; i < objects.length; i++) {
      const el    = objects[i];
      const depth = DEPTH_PX[el.dataset.layer] ?? 15;
      const x     = (currentX * depth).toFixed(2);
      const y     = (currentY * depth).toFixed(2);
      el.style.transform = `translate(${x}px,${y}px)`;
    }

    rafId = requestAnimationFrame(tick);
  }

  rafId = requestAnimationFrame(tick);
})();
