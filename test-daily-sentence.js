/**
 * test-daily-sentence.js
 * Verification suite for the Daily Sentence feature.
 */
'use strict';

const fallbackList = require('./fallback-sentences.js');

let passed = 0;
let failed = 0;

function assert(desc, condition) {
  if (condition) {
    console.log(`  ✅ ${desc}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${desc}`);
    failed++;
  }
}

console.log('\n── Daily Sentence Verification Tests ──');

// 1. Fallback count
assert('Fallback list has at least 60 sentences', Array.isArray(fallbackList) && fallbackList.length >= 60);
console.log(`     (Total sentences in fallback database: ${fallbackList.length})`);

// 2. Format and word count checks for every item
let allUnder20Words = true;
let allHaveBanglaScript = true;
let allHaveUsage = true;
const banglaRegex = /[\u0980-\u09FF]/;

fallbackList.forEach((item, index) => {
  const words = item.sentence.trim().split(/\s+/).length;
  if (words >= 20) {
    console.error(`     Sentence #${index + 1} has ${words} words: "${item.sentence}"`);
    allUnder20Words = false;
  }
  if (!banglaRegex.test(item.bangla)) {
    console.error(`     Sentence #${index + 1} missing Bangla script: "${item.bangla}"`);
    allHaveBanglaScript = false;
  }
  if (!item.usage || item.usage.trim().length < 5) {
    console.error(`     Sentence #${index + 1} missing usage: "${item.usage}"`);
    allHaveUsage = false;
  }
});

assert('All sentences are strictly under 20 words', allUnder20Words);
assert('All entries contain authentic Bangla script', allHaveBanglaScript);
assert('All entries contain a clear, descriptive usage note', allHaveUsage);

// 3. Deduplication logic simulation
const usedSet = new Set();
// Add first 10 sentences to usedSet
for (let i = 0; i < 10; i++) {
  usedSet.add(fallbackList[i].sentence.trim().toLowerCase());
}

// Find next sentence
let picked = null;
for (let i = 0; i < fallbackList.length; i++) {
  const s = fallbackList[i];
  if (!usedSet.has(s.sentence.trim().toLowerCase())) {
    picked = s;
    break;
  }
}

assert('Deduplication picks sentence #11 when 1-10 are already used', picked && picked.id === 11);

// 4. Test API response parser simulation
const sampleGeminiResponse = '```json\n{\n  "sentence": "Could you please give me a heads-up before the bell rings?",\n  "bangla": "ঘণ্টা পড়ার আগে দয়া করে আমাকে একটু জানিয়ে দেবে কি?",\n  "usage": "Use when asking a classmate for a timely warning."\n}\n```';

let cleaned = sampleGeminiResponse.trim();
if (cleaned.startsWith('```')) {
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
}
const parsed = JSON.parse(cleaned);

assert('Clean markdown fences and parse valid JSON from AI response', 
  parsed.sentence.startsWith('Could you') && banglaRegex.test(parsed.bangla));

console.log(`\n─────────────────────────────────────────────`);
console.log(`Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) process.exit(1);
