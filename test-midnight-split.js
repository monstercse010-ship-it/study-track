/**
 * test-midnight-split.js
 * Node.js smoke test for the midnight-split and alarm logic.
 * Run with: node test-midnight-split.js
 */
'use strict';

let passed = 0, failed = 0;

function assert(label, condition) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    failed++;
  }
}

/* ── Helpers (duplicated from app.js) ─────────────────── */
function pad(n) { return String(n).padStart(2, '0'); }
function dateKey(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function midnightOf(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime(); }
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function addToDaily(daily, key, secs) { daily[key] = (daily[key] || 0) + secs; }

/* ── Extracted midnight-split processor ───────────────── */
function processSplits(sw, store, nowMs) {
  let lastMid = sw.lastMidnight;
  const lastMidDate = new Date(lastMid);
  let nextMidDate = new Date(
    lastMidDate.getFullYear(), lastMidDate.getMonth(),
    lastMidDate.getDate() + 1, 0, 0, 0, 0
  );

  while (nextMidDate.getTime() <= nowMs) {
    const nextMid = nextMidDate.getTime();
    const creditSec = Math.max(0, (nextMid - sw.startTimestamp) / 1000 + sw.accSec);
    const prevDayKey = dateKey(new Date(nextMid - 1));

    if (creditSec > 0) {
      addToDaily(store.dailyTotals, prevDayKey, creditSec);
      store.sessions.push({
        id: genId(), date: prevDayKey, seconds: Math.round(creditSec),
        startTime: '', endTime: '', subject: 'test-split'
      });
    }

    sw.sessionDate    = dateKey(nextMidDate);
    sw.lastMidnight   = nextMid;
    sw.startTimestamp = nextMid;
    sw.accSec         = 0;
    lastMid = nextMid;
    nextMidDate = new Date(
      nextMidDate.getFullYear(), nextMidDate.getMonth(),
      nextMidDate.getDate() + 1, 0, 0, 0, 0
    );
  }
}

function getElapsedSec(sw, nowMs) {
  if (!sw.running) return sw.accSec;
  return sw.accSec + (nowMs - sw.startTimestamp) / 1000;
}

/* ═══ TEST 1: Stopwatch across a single midnight ════════ */
console.log('\n── Test 1: Session crossing one midnight ──');
{
  // Session started at 23:00 yesterday, we check at 02:00 today
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayMid = midnightOf(yesterday);

  // Start at 23:00 yesterday
  const startTime = yesterdayMid + 23 * 3600 * 1000;
  // "Now" is 02:00 today (1 hour into today)
  const todayMid = midnightOf(new Date());
  const nowMs    = todayMid + 2 * 3600 * 1000;

  const sw = {
    running: true,
    startTimestamp: startTime,
    accSec: 0,
    sessionDate: dateKey(yesterday),
    sessionId: genId(),
    lastMidnight: yesterdayMid,
    subject: 'math'
  };

  const store = { dailyTotals: {}, sessions: [] };

  processSplits(sw, store, nowMs);

  const ydKey  = dateKey(yesterday);
  const todKey = dateKey(new Date());

  // Before midnight: 1 hour credited to yesterday
  assert('Yesterday total = 3600s (1 hour before midnight)',
    Math.round(store.dailyTotals[ydKey]) === 3600);

  // After midnight: 2 hours elapsed since midnight, in sw state
  const liveToday = getElapsedSec(sw, nowMs);
  assert('Live elapsed after split = 7200s (2h after midnight)',
    Math.round(liveToday) === 7200);

  assert('sw.sessionDate updated to today', sw.sessionDate === todKey);
  assert('Split session saved for yesterday', store.sessions.some(s => s.date === ydKey));
}

/* ═══ TEST 2: 36-hour session (crosses 2 midnights) ════ */
console.log('\n── Test 2: 36-hour session (2 day boundaries) ──');
{
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const twoDaysAgoMid = midnightOf(twoDaysAgo);

  // Start at noon two days ago
  const startTime = twoDaysAgoMid + 12 * 3600 * 1000;
  // Now: noon today (36 hours later)
  const todayMid = midnightOf(new Date());
  const nowMs    = todayMid + 12 * 3600 * 1000;

  const sw = {
    running: true, startTimestamp: startTime, accSec: 0,
    sessionDate: dateKey(twoDaysAgo), sessionId: genId(),
    lastMidnight: twoDaysAgoMid, subject: 'marathon'
  };
  const store = { dailyTotals: {}, sessions: [] };
  processSplits(sw, store, nowMs);

  const d2Key = dateKey(twoDaysAgo);
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const ydKey = dateKey(yesterday);

  assert('2-days-ago total = 12h (noon to midnight)',
    Math.round(store.dailyTotals[d2Key]) === 12 * 3600);
  assert('Yesterday total = 24h (full day)',
    Math.round(store.dailyTotals[ydKey]) === 24 * 3600);
  assert('2 split sessions saved', store.sessions.length === 2);
  assert('sw on today after both splits', sw.sessionDate === dateKey(new Date()));

  const liveToday = getElapsedSec(sw, nowMs);
  assert('Live today portion = 12h', Math.round(liveToday) === 12 * 3600);
}

/* ═══ TEST 3: Alarm trigger (session mode) ══════════════ */
console.log('\n── Test 3: Session alarm fires at target ──');
{
  const target = 30 * 60; // 30 minutes
  const alarm  = { id: 'a1', targetSec: target, mode: 'session', enabled: true,
                   firedDate: null, firedSessionId: null };
  const sessionId = genId();
  let fired = false;

  function checkAlarm(elapsedSec, sid) {
    if (!alarm.enabled) return;
    if (alarm.mode === 'session') {
      if (alarm.firedSessionId === sid) return;
      if (elapsedSec >= alarm.targetSec) {
        alarm.firedSessionId = sid;
        fired = true;
      }
    }
  }

  checkAlarm(1700, sessionId); // 28 min — should NOT fire
  assert('Alarm not fired at 28min', !fired);

  checkAlarm(1800, sessionId); // 30 min — should fire
  assert('Alarm fired at 30min', fired);

  fired = false;
  checkAlarm(2000, sessionId); // should NOT re-fire same session
  assert('Alarm does not re-fire same session', !fired);
}

/* ═══ TEST 4: Alarm (daily mode) ═══════════════════════ */
console.log('\n── Test 4: Daily alarm fires once per day ──');
{
  const target  = 2 * 3600; // 2 hours
  const alarm   = { id: 'a2', targetSec: target, mode: 'daily', enabled: true,
                    firedDate: null, firedSessionId: null };
  const todKey  = dateKey(new Date());
  let fired = false;

  function checkDailyAlarm(totalSec) {
    if (!alarm.enabled || alarm.firedDate === todKey) return;
    if (totalSec >= alarm.targetSec) { alarm.firedDate = todKey; fired = true; }
  }

  checkDailyAlarm(7000); // <2h, no fire
  assert('Daily alarm not fired at <2h', !fired);
  checkDailyAlarm(7200); // exactly 2h
  assert('Daily alarm fired at 2h', fired);
  fired = false;
  checkDailyAlarm(9000); // should not re-fire
  assert('Daily alarm does not re-fire same day', !fired);
}

/* ═══ TEST 5: fmtHMS & fmtHm formatting ═══════════════ */
console.log('\n── Test 5: Time formatting ──');
{
  function fmtHMS(s) {
    s = Math.max(0, Math.floor(s));
    return `${pad(Math.floor(s/3600))}:${pad(Math.floor((s%3600)/60))}:${pad(s%60)}`;
  }
  function fmtHm(s) {
    s = Math.max(0, Math.floor(s));
    const h = Math.floor(s/3600), m = Math.floor((s%3600)/60);
    if (!h && !m) return '0m';
    if (!h) return `${m}m`;
    if (!m) return `${h}h`;
    return `${h}h ${m}m`;
  }
  assert('fmtHMS(3661) = "01:01:01"', fmtHMS(3661) === '01:01:01');
  assert('fmtHMS(0) = "00:00:00"',     fmtHMS(0)   === '00:00:00');
  assert('fmtHm(5400) = "1h 30m"',     fmtHm(5400) === '1h 30m');
  assert('fmtHm(3600) = "1h"',          fmtHm(3600) === '1h');
  assert('fmtHm(60) = "1m"',            fmtHm(60)   === '1m');
  assert('fmtHm(0) = "0m"',             fmtHm(0)    === '0m');
}

/* ── Summary ─────────────────────────────────────────── */
console.log(`\n${'─'.repeat(45)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
