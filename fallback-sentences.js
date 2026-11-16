/**
 * StudyTrack – fallback-sentences.js
 * 
 * Built-in fallback database of 65 daily English sentences.
 * Used when offline or if the Gemini API call fails / is not configured.
 * 
 * Criteria:
 * - Useful in daily life (family, friends, school, teachers, small talk, asking for help, feelings).
 * - Under 20 words.
 * - Simple enough for a class 8 student, but smart, polished, and natural.
 * - Accurate Bangla translation and practical one-line usage context.
 */

(function () {
  'use strict';

  const FALLBACK_SENTENCES = [
    {
      id: 1,
      sentence: "I'd really appreciate it if you could give me a hand.",
      bangla: "আপনি যদি আমাকে একটু সাহায্য করতেন, আমি সত্যিই কৃতজ্ঞ হতাম।",
      usage: "Use when politely asking a friend, classmate, or family member for help with a task."
    },
    {
      id: 2,
      sentence: "Let's play it by ear and see how the day goes.",
      bangla: "পরিস্থিতি বুঝে সিদ্ধান্ত নেওয়া যাক, দেখি দিনটা কেমন যায়।",
      usage: "Use when you prefer to keep plans flexible instead of fixing a rigid schedule."
    },
    {
      id: 3,
      sentence: "Could you please walk me through this one more time?",
      bangla: "দয়া করে কি আমাকে এই বিষয়টি আর একবার বুঝিয়ে বলবেন?",
      usage: "Use when asking a teacher or friend to explain a difficult concept step by step."
    },
    {
      id: 4,
      sentence: "I'm having a bit of a rough day, but I'll manage.",
      bangla: "আজকের দিনটা একটু কঠিন যাচ্ছে, তবে আমি সামলে নেব।",
      usage: "Use to express feelings honestly and politely without sounding overly negative."
    },
    {
      id: 5,
      sentence: "That makes total sense; thanks for pointing it out.",
      bangla: "কথাটা একদম ঠিক; বিষয়টা ধরিয়ে দেওয়ার জন্য ধন্যবাদ।",
      usage: "Use when someone gives you constructive feedback or a smart suggestion."
    },
    {
      id: 6,
      sentence: "Mind if I join you guys, or are you in the middle of something?",
      bangla: "আমি কি তোমাদের সাথে যোগ দিতে পারি, নাকি তোমরা ব্যস্ত আছো?",
      usage: "Use when politely asking to join classmates at a table or in a group discussion."
    },
    {
      id: 7,
      sentence: "I completely lost track of time while finishing my homework.",
      bangla: "হোমওয়ার্ক শেষ করতে করতে সময়ের খেয়ালই ছিল না।",
      usage: "Use when explaining why you were late or didn't check your messages."
    },
    {
      id: 8,
      sentence: "Let me double-check that before giving you a final answer.",
      bangla: "তোমাকে চূড়ান্ত উত্তর দেওয়ার আগে আমি একবার যাচাই করে নিই।",
      usage: "Use when someone asks a question and you want to be completely sure before replying."
    },
    {
      id: 9,
      sentence: "It was really great catching up with you after such a long time!",
      bangla: "এত দিন পর তোমার সাথে আড্ডা দিয়ে খুব ভালো লাগলো!",
      usage: "Use when concluding a conversation with an old friend or relative."
    },
    {
      id: 10,
      sentence: "Take your time; there is really no rush at all.",
      bangla: "ধীরে সুস্থে করো; কোনো তাড়া নেই।",
      usage: "Use to reassure a classmate or sibling who feels pressured to finish quickly."
    },
    {
      id: 11,
      sentence: "I couldn't have pulled this off without your support.",
      bangla: "তোমার সাহায্য ছাড়া আমি এটা কখনোই করতে পারতাম না।",
      usage: "Use to express sincere gratitude to a teammate or helper after a success."
    },
    {
      id: 12,
      sentence: "Do you have a quick minute to look over my notes?",
      bangla: "তোমার কি একটু সময় হবে আমার নোটগুলো একবার দেখে দেওয়ার?",
      usage: "Use when politely asking a peer or teacher for a fast review of your work."
    },
    {
      id: 13,
      sentence: "I'm not quite sure about that, but I can look into it.",
      bangla: "এ বিষয়ে আমি নিশ্চিত নই, তবে আমি খোঁজ নিয়ে জানাতে পারি।",
      usage: "Use when you don't know the answer but want to respond maturely and helpfully."
    },
    {
      id: 14,
      sentence: "That sounds like a wonderful plan; count me in!",
      bangla: "পরিকল্পনাটা দারুণ শোনাচ্ছে; আমাকেও সাথে রেখো!",
      usage: "Use when eagerly agreeing to join a picnic, study group, or outing."
    },
    {
      id: 15,
      sentence: "Sorry to interrupt, but do you happen to know the time?",
      bangla: "কথা কাটানোর জন্য দুঃখিত, এখন কয়টা বাজে বলতে পারেন?",
      usage: "Use to interrupt someone politely in public or at school to ask a quick question."
    },
    {
      id: 16,
      sentence: "Let's call it a day and pick this up fresh tomorrow.",
      bangla: "আজকের মতো এখানেই শেষ করি, কাল আবার নতুন করে শুরু করা যাবে।",
      usage: "Use when suggesting that you and your study partners wrap up after a long session."
    },
    {
      id: 17,
      sentence: "I didn't quite catch that; could you speak up a little?",
      bangla: "আমি ঠিক শুনতে পাইনি; একটু জোরে বলবেন কি?",
      usage: "Use when someone speaks too softly and you need them to repeat clearly."
    },
    {
      id: 18,
      sentence: "Don't be so hard on yourself; you did the best you could.",
      bangla: "নিজেকে এতটা দোষ দিয়ো না; তুমি তো সাধ্যমতো চেষ্টা করেছো।",
      usage: "Use to comfort and motivate a friend who is disappointed with their exam result."
    },
    {
      id: 19,
      sentence: "I'm torn between these two options; which one would you pick?",
      bangla: "আমি এই দুটি বিষয়ের মধ্যে দ্বিধায় পড়েছি; তুমি কোনটা বেছে নিতে?",
      usage: "Use when asking for advice on choosing a topic, book, or gift."
    },
    {
      id: 20,
      sentence: "Could you give me a heads-up before the teacher starts the test?",
      bangla: "শিক্ষক পরীক্ষা শুরু করার আগে আমাকে একটু আগাম জানিয়ে রেখো তো।",
      usage: "Use to ask a classmate for a timely warning or advance notification."
    },
    {
      id: 21,
      sentence: "That's a fair point, though I see it a bit differently.",
      bangla: "তোমার যুক্তিটা মন্দ নয়, তবে আমার দৃষ্টিভঙ্গি একটু ভিন্ন।",
      usage: "Use during a classroom debate or discussion to disagree with dignity and respect."
    },
    {
      id: 22,
      sentence: "I'm trying to cut down on screen time so I can focus better.",
      bangla: "মনোযোগ বাড়াতে আমি স্ক্রিনে কাটানো সময় কমিয়ে আনার চেষ্টা করছি।",
      usage: "Use when explaining your healthy study habits to friends or family."
    },
    {
      id: 23,
      sentence: "Thanks for your patience; I know this took longer than expected.",
      bangla: "ধৈর্য ধরার জন্য ধন্যবাদ; জানি কাজটি হতে প্রত্যাশার চেয়ে বেশি সময় লেগেছে।",
      usage: "Use to apologize gracefully when delivering an assignment or task with a slight delay."
    },
    {
      id: 24,
      sentence: "Would you mind keeping an eye on my bag while I grab water?",
      bangla: "আমি একটু পানি নিয়ে আসি, ব্যাগটার দিকে একটু খেয়াল রাখবে কি?",
      usage: "Use in the library, coaching center, or classroom when stepping away briefly."
    },
    {
      id: 25,
      sentence: "I'm really looking forward to the school science fair this week.",
      bangla: "এই সপ্তাহের স্কুলের বিজ্ঞান মেলাটির জন্য আমি দারুণভাবে অপেক্ষা করছি।",
      usage: "Use to share excitement about an upcoming event with friends or teachers."
    },
    {
      id: 26,
      sentence: "Let's get this difficult part out of the way first.",
      bangla: "চলো কঠিন অংশটা আগে শেষ করে ফেলি, যাতে পরে নির্ভার থাকা যায়।",
      usage: "Use when motivating your study partner to tackle the hardest chapter first."
    },
    {
      id: 27,
      sentence: "Excuse me, how much does this geometry box go for?",
      bangla: "মাফ করবেন, এই জ্যামিতি বক্সটির দাম কত পড়বে?",
      usage: "Use at a stationery store or bookshop to ask the price in a natural way."
    },
    {
      id: 28,
      sentence: "I had a gut feeling that this question would show up on the exam!",
      bangla: "আমার ভেতর থেকেই মনে হচ্ছিল এই প্রশ্নটা পরীক্ষায় আসবেই!",
      usage: "Use with classmates after an exam when your hunch turns out to be correct."
    },
    {
      id: 29,
      sentence: "Could you please lower your voice? People are trying to study.",
      bangla: "দয়া করে একটু আস্তে কথা বলবেন? অনেকেই এখানে পড়াশোনা করছে।",
      usage: "Use politely in a library or reading room when someone is being loud."
    },
    {
      id: 30,
      sentence: "I'll make sure to get back to you as soon as I get home.",
      bangla: "বাসায় পৌঁছামাত্রই আমি তোমাকে নিশ্চিত করে জানাবো।",
      usage: "Use to promise a prompt follow-up message to a friend or teacher."
    },
    {
      id: 31,
      sentence: "Things didn't go as planned, but we learned a valuable lesson.",
      bangla: "পরিকল্পনামাফিক সব হয়নি ঠিকই, তবে আমরা মূল্যবান শিক্ষা পেয়েছি।",
      usage: "Use to maintain a positive, growth mindset after an experiment or project fails."
    },
    {
      id: 32,
      sentence: "If you ever need a study partner, feel free to give me a shout.",
      bangla: "পড়ার জন্য যদি কখনো কোনো সঙ্গীর প্রয়োজন হয়, দ্বিধা না করে আমাকে জানিও।",
      usage: "Use to offer friendly academic support to a classmate or friend."
    },
    {
      id: 33,
      sentence: "Let's take a quick breather to clear our heads.",
      bangla: "মাথাটা একটু হালকা করতে চলো একটা ছোট্ট বিরতি নিই।",
      usage: "Use when you and your friends have been studying continuously for too long."
    },
    {
      id: 34,
      sentence: "I truly appreciate your feedback; it will help me do much better.",
      bangla: "আপনার মতামতের জন্য অসংখ্য ধন্যবাদ; এটা আমাকে আরও ভালো করতে সাহায্য করবে।",
      usage: "Use when responding politely to a teacher's corrections on your paper."
    },
    {
      id: 35,
      sentence: "Excuse me, is this seat taken, or may I sit here?",
      bangla: "মাফ করবেন, এই আসনটিতে কি কেউ বসেছে, নাকি আমি বসতে পারি?",
      usage: "Use politely on public transport, in a seminar room, or cafeteria."
    },
    {
      id: 36,
      sentence: "I couldn't agree more with what you just pointed out.",
      bangla: "তুমি একটু আগে যে কথাটা বললে, আমি তার সাথে পুরোপুরি একমত।",
      usage: "Use to express strong, enthusiastic agreement in a conversation."
    },
    {
      id: 37,
      sentence: "Don't sweat the small stuff; everything is going to be fine.",
      bangla: "ছোটখাটো বিষয় নিয়ে অযথা দুশ্চিন্তা করো না; সব ঠিক হয়ে যাবে।",
      usage: "Use to calm down a friend who is panicking over minor exam details."
    },
    {
      id: 38,
      sentence: "I'm all ears; tell me everything that happened!",
      bangla: "আমি খুব মনোযোগ দিয়ে শুনছি; কী ঘটেছে বিস্তারিত বলো!",
      usage: "Use when giving your undivided attention to someone sharing a story."
    },
    {
      id: 39,
      sentence: "Could you break down this math problem into simpler steps?",
      bangla: "এই গণিতের সমস্যাটিকে কি একটু সহজ ধাপে ভেঙে বুঝিয়ে দেওয়া যায়?",
      usage: "Use when asking a tutor, elder sibling, or teacher for step-by-step help."
    },
    {
      id: 40,
      sentence: "I'd love to help, but my schedule is completely packed right now.",
      bangla: "সাহায্য করতে পারলে ভালো লাগতো, তবে আপাতত আমার একদমই সময় নেই।",
      usage: "Use to say 'no' politely when you are swamped with your own studies."
    },
    {
      id: 41,
      sentence: "You're making steady progress, so keep up the great effort!",
      bangla: "তোমার উন্নতি বেশ লক্ষণীয়, এভাবেই চেষ্টা চালিয়ে যাও!",
      usage: "Use to encourage a younger student or peer who has worked hard."
    },
    {
      id: 42,
      sentence: "Let's put our heads together and solve this tricky question.",
      bangla: "চলো আমরা সবাই মিলে একসাথে বসে এই জটিল প্রশ্নটির সমাধান করি।",
      usage: "Use to suggest collaborative group work on a difficult homework problem."
    },
    {
      id: 43,
      sentence: "I had no idea about that; thanks for bringing it to my attention.",
      bangla: "এ বিষয়ে আমার বিন্দুমাত্র ধারণা ছিল না; নজরে আনার জন্য অনেক ধন্যবাদ।",
      usage: "Use when someone informs you about an important notice or deadline."
    },
    {
      id: 44,
      sentence: "Would it be all right if I turned in my assignment tomorrow?",
      bangla: "আমি যদি অ্যাসাইনমেন্টটি কাল জমা দিই, কোনো সমস্যা হবে কি?",
      usage: "Use to request a polite, short extension from a teacher or instructor."
    },
    {
      id: 45,
      sentence: "It's always better to be safe than sorry, so let's double-check.",
      bangla: "পরে পস্তানোর চেয়ে সতর্ক থাকা ভালো, তাই চলো আর একবার মিলিয়ে নিই।",
      usage: "Use when advising a teammate to review answers before submitting."
    },
    {
      id: 46,
      sentence: "I feel so much more confident after revising the core formulas.",
      bangla: "মূল সূত্রগুলো আবার ঝালিয়ে নেওয়ার পর আত্মবিশ্বাস অনেকটাই বেড়ে গেছে।",
      usage: "Use when sharing a positive study achievement with parents or friends."
    },
    {
      id: 47,
      sentence: "Can you keep this between us, or will it slip out?",
      bangla: "কথাটা কি আমাদের দুজনের মধ্যেই রাখতে পারবে, নাকি সবার কাছে বলে দেবে?",
      usage: "Use playfully before sharing an exciting surprise or personal secret."
    },
    {
      id: 48,
      sentence: "I'll keep my fingers crossed for your debate competition today!",
      bangla: "আজকের বিতর্ক প্রতিযোগিতায় তোমার বিজয়ের জন্য শুভকামনা রইলো!",
      usage: "Use to wish a friend the best of luck before an important contest."
    },
    {
      id: 49,
      sentence: "Let's agree to disagree and move on to the next topic.",
      bangla: "চলো এ বিষয়ে মতভেদটা মেনে নিয়ে আমরা পরের প্রসঙ্গে চলে যাই।",
      usage: "Use to end a debate peacefully when neither side will change their mind."
    },
    {
      id: 50,
      sentence: "Could you please pass the notebook when you're finished with it?",
      bangla: "তোমার ব্যবহার শেষ হলে খাতাটি একটু এদিকে দেবে কি?",
      usage: "Use in the classroom to borrow notes courteously from a desk partner."
    },
    {
      id: 51,
      sentence: "I'm running a couple of minutes behind schedule, but I'm on my way.",
      bangla: "আমার পৌঁছাতে কয়েক মিনিট দেরি হচ্ছে, তবে আমি পথেই আছি।",
      usage: "Use to inform friends or group members responsibly when running slightly late."
    },
    {
      id: 52,
      sentence: "That history chapter really opened my eyes to how our world changed.",
      bangla: "ইতিহাসের ওই অধ্যায়টি পৃথিবী কীভাবে বদলেছে সে সম্পর্কে আমার চোখ খুলে দিয়েছে।",
      usage: "Use when discussing an interesting and thought-provoking reading topic."
    },
    {
      id: 53,
      sentence: "Let's not jump to conclusions until we have all the facts.",
      bangla: "সব তথ্য হাতে পাওয়ার আগে চট করে কোনো সিদ্ধান্তে না পৌঁছানোই ভালো।",
      usage: "Use to advise friends against making premature judgments about an issue."
    },
    {
      id: 54,
      sentence: "I'm genuinely grateful for all the time and patience you gave me.",
      bangla: "আমাকে যে সময় এবং ধৈর্য নিয়ে শিখিয়েছেন, তার জন্য আমি আন্তরিকভাবে কৃতজ্ঞ।",
      usage: "Use to thank a mentor, teacher, or parent for their selfless guidance."
    },
    {
      id: 55,
      sentence: "Let's take it one step at a time so we don't feel overwhelmed.",
      bangla: "চলো ধীরে ধীরে এক এক ধাপ করে এগোই, যাতে অতিরিক্ত চাপ অনুভব না হয়।",
      usage: "Use when facing a massive syllabus or project to keep calm and focused."
    },
    {
      id: 56,
      sentence: "What was the main takeaway from today's science lecture in your view?",
      bangla: "তোমার মতে আজকের বিজ্ঞানের ক্লাসের মূল শিক্ষণীয় দিক কোনটি ছিল?",
      usage: "Use to start a smart, meaningful post-class conversation with a classmate."
    },
    {
      id: 57,
      sentence: "I can't thank you enough for pointing me in the right direction.",
      bangla: "আমাকে সঠিক দিকনির্দেশনা দেওয়ার জন্য আপনাকে যত ধন্যবাদ দেব, কম হবে।",
      usage: "Use when an elder or teacher gives you life-changing advice or pointers."
    },
    {
      id: 58,
      sentence: "Let's stay positive and make the absolute best out of this situation.",
      bangla: "চলো হতাশ না হয়ে বর্তমান পরিস্থিতি থেকেই সেরা সুযোগটা কাজে লাগাই।",
      usage: "Use to motivate peers when circumstances or schedules change unexpectedly."
    },
    {
      id: 59,
      sentence: "Could you please remind me of what the teacher assigned for tomorrow?",
      bangla: "কালকের জন্য শিক্ষক কী বাড়ির কাজ দিয়েছিলেন, একটু মনে করিয়ে দেবে?",
      usage: "Use when politely checking the homework list with a responsible friend."
    },
    {
      id: 60,
      sentence: "Practice really does make perfect, as long as you stay consistent.",
      bangla: "যতদিন তুমি নিয়মিত থাকবে, অনুশীলনের মাধ্যমেই তুমি নিখুঁত হয়ে উঠবে।",
      usage: "Use to remind yourself and your study circle about the power of daily habits."
    },
    {
      id: 61,
      sentence: "I was just thinking out loud; don't take it too seriously.",
      bangla: "আমি শুধু নিজের মনে ভাবছিলাম; কথাটা বেশি গুরুত্ব দিয়ে দেখার কিছু নেই।",
      usage: "Use when sharing an unformed idea or casual speculation with friends."
    },
    {
      id: 62,
      sentence: "Your hard work is finally paying off; I'm genuinely proud of you!",
      bangla: "তোমার কঠোর পরিশ্রমের ফল অবশেষে মিলছে; আমি তোমার জন্য সত্যিই গর্বিত!",
      usage: "Use to celebrate a friend's hard-earned success or academic improvement."
    },
    {
      id: 63,
      sentence: "Let's wrap things up quickly so we don't miss our bus.",
      bangla: "চলো কাজগুলো চটপট গুছিয়ে নিই, নইলে বাসটা মিস হয়ে যেতে পারে।",
      usage: "Use when reminding your friends to pack their school bags promptly."
    },
    {
      id: 64,
      sentence: "I need to get my priorities straight before the final exams start.",
      bangla: "চূড়ান্ত পরীক্ষা শুরু হওয়ার আগেই আমাকে কাজের অগ্রাধিকার ঠিক করে নিতে হবে।",
      usage: "Use when discussing personal discipline and time management with family."
    },
    {
      id: 65,
      sentence: "Whenever you're ready, we can get started on the presentation.",
      bangla: "তুমি যখনই প্রস্তুত হবে, আমরা তখনই প্রেজেন্টেশনের কাজ শুরু করে দিতে পারি।",
      usage: "Use to invite a project partner to work calmly without rushing them."
    }
  ];

  // Expose globally to window
  if (typeof window !== 'undefined') {
    window.FALLBACK_SENTENCES = FALLBACK_SENTENCES;
  }

  // Also support CommonJS if required by tests or Node
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FALLBACK_SENTENCES;
  }
})();
