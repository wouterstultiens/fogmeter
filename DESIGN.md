# Fogmeter: daily cognitive benchmark, design v0.5 (v1.1 built)

> **v0.5 changes (app 1.1.0, after the first sessions):**
> - **Recall is speech only; no tapping.** Saying and tapping at the same time was double work and distracting.
>   - The recall screen shows only a timer, a microphone circle that lights up when speech is recognised, and
>     "Klaar". No text or count, which would reveal which words count.
>   - Timing now comes from the recogniser's timestamps (a timeline of every change in recognised text):
>     first speech, first list word, median gap between newly recognised list words, and silences > 5 s
>     (`speechTiming` in `scoring.js`). The recogniser lags speech by roughly 0.5–1 s; the lag is about
>     constant, so values compare across days but are not exact.
>   - Lost: the tap count as a cross-check, and "extra taps" as an intrusion estimate. The raw transcripts
>     and every interim/alternative guess are still stored, so intrusions can be coded later.
>   - The review shows both transcripts **on top**, with recognised list words marked, and list words found
>     only in interim guesses listed. The prefilled ticks follow below.
>   - Risk: a word the recogniser never heard must be remembered at review time. `memory.reviewEdits`
>     tracks how often ticks are corrected.
> - **Run-in data is fully visible.** Run-in sessions were always saved and backed up; now the results screen
>   shows raw scores for every session as small charts (run-in shaded), a table of all sessions, and a
>   full detail view per session. The z-scored week trend still needs the baseline.
> - **Optional quick notes, no evening session.** A second fixed daily moment would cost adherence and make the
>   "daytime fog yesterday" item a mix of evening and morning ratings. Instead, "+ Notitie" can be used any
>   time: text + optional 0–10 "how clear right now". Texts prefill the next morning's "anything unusual?"
>   field; ratings are stored separately (`notes` store, `notes/` in the backup) as extra momentary data.
>   The morning "yesterday" block stays unchanged, so it remains the same measure every day.
> - **PVT reaction times come in ~16.7 ms steps** (e.g. 284, 301, 317 ms). Safari on iPhone renders at 60 Hz
>   and both the stimulus onset and the touch timestamp land on frames. The per-trial error (up to ~±8 ms) is
>   random and averages to ~1 ms over ~50 trials; the 355 ms lapse threshold effectively becomes 367 ms
>   (22 frames), the same every day. Left unchanged on purpose: changing the method would break comparability.

> **v0.4 changes (after first use on the iPhone):**
> - Safari's Dutch speech recognition glued words together, missed words and mis-transcribed them.
>   Recall became **say aloud + tap once per word** (tapping dropped again in v0.5), with speech recognition listening in the background:
>   - Taps give a reliable count and timing (first word, gaps, blanks).
>   - The transcripts are matched against the known 12-word list. The matching handles run-together
>     words, plurals and diminutives, and Dutch sound-alikes. It also uses every interim guess and
>     alternative the recogniser produced, not just its final text.
>   - At the end, one review screen shows both transcripts, with per-word "1st / 2nd time" ticks prefilled.
>     You only fix mistakes. The list is never shown before both recalls are done.
> - The **verbal fluency** task (letter/category) is dropped. Its answers are open-ended, so they can't be
>   checked against a known list. The "going blank" signal now comes from PVT lapses and recall timing
>   (first-word latency, pauses between taps).
> - Instruction screens start by themselves after the first 3 sessions.
> - The sections below still describe fluency where it was originally planned; v0.4 supersedes them.
>
> **v0.2 changes (your feedback):**
> - Dutch language.
> - Spoken answers are OK.
> - No wearable.
> - iPhone at zero cost, so a free web app on the home screen.
> - The evening log is gone; a short "yesterday" block is folded into the morning session.
> - Weekly and fortnightly questionnaires are dropped.
> - A v1-first scope. Guiding principle: **consistency beats perfection**.
>
> **v0.3 changes:**
> - "Anything unusual?" is a single free-text field, with no buttons.
> - The one-time intake questionnaires are removed.
> - How sleep and wake times are recorded is spelled out (§3.1).

---

## 0. TL;DR

**One morning session of ~6 min, done right after meditation. Nothing else during the day.**

| # | Step | Time | What it measures |
|---|------|------|------------------|
| 1 | **Now**: 3 taps | ~15 s | Fog right now · sleep quality · bedtime/wake time (prefilled, just confirm) |
| 2 | **Word list**: learn 12 Dutch words, say them back aloud | ~50 s | Verbal memory: "forgot the instructions" |
| 3 | **Reaction test (PVT-B)**: tap when the counter starts | 3:00 | Attention lapses and speed: the most sensitive test for sleep loss and fatigue |
| 4 | **Symbol Search** | ~60 s | Processing speed: "my mind feels slow" |
| 5 | **Word list: second recall** (spoken) | ~30 s | Remembering after ~4 min of other work |
| 6 | **Review**: check what speech recognition heard | ~15 s | Confirms which words were recalled, 1st and 2nd time |
| 7 | **Yesterday**: 3 taps + optional free-text note | ~15 s | Daytime fog yesterday · activity · stress · anything unusual |
| — | *Automatic*: tap accuracy, time since waking, device checks | 0 s | Clumsiness, sleep inertia, data quality |

**Outputs:**
- **Objective Cognition Index** (from the tests): the primary measure.
- **Subjective Fog Index** (from your ratings): kept separate.
- **Motor Precision Index** (automatic): exploratory.

Results are read as **7-day blocks vs. your own baseline**, not day by day: a single day is about half noise.

---

## 1. What we're trying to capture

| Your complaint | Domain | Covered by |
|---|---|---|
| "My mind feels slow" | Processing / psychomotor speed | Symbol Search, PVT speed |
| "Mind goes blank in meetings" | Attention lapses, word retrieval | PVT lapses + RT variability; fluency pauses > 5 s |
| Forgot a coworker's instructions | Verbal episodic memory | Word list: immediate + delayed recall |
| Clumsiness | Fine-motor precision | Automatic tap-accuracy metrics on every tap |
| "This is not like me" | Change vs. your own normal | Everything is scored vs. *your* baseline |

---

## 2. Research findings that drive the design

1. **Attention/vigilance is the most state-sensitive domain.**
   - Sleep-deprivation meta-analysis (Lim & Dinges 2010), Hedges' g:
     - attention lapses −0.76
     - working memory −0.55
     - memory recall −0.38
     - processing speed −0.30
     - reasoning −0.13 (n.s.)
   - Hangover hits the same domains (Gunn 2018).
   - **So the PVT gets the biggest time slot.**
2. **The 3-min PVT-B is the shortest validated version** (Basner 2011).
   - Shorter versions were insensitive.
   - Essentially **no practice effect** over 16 administrations (Basner 2018).
3. **Processing-speed tasks are the most reliable brief tasks.**
   - Symbol Search reaches 0.80 reliability averaged over 2–3 days (Sliwinski 2018).
   - It is slowed by naturalistic poor sleep (Schwarz 2025; Buxton 2025).
   - There is a 1–5 week practice curve, so a run-in period is needed.
4. **Memory is what brain-fog/long-COVID groups lose most consistently** (Hampshire 2024 NEJM).
   - Encoding while tired is hit hard (g = 0.62; Newbury 2021).
   - Daily memory scores are noisy, so they are judged on weekly means.
   - New word lists every day showed no practice effect (Moore 2021).
5. **Verbal fluency has good alternate-form reliability.**
   - Letter ICC 0.91, category 0.77 (Woods 2016).
   - It is hurt by sleep loss (Harrison & Horne 1997).
   - It is the least proven for *daily* use over months, so it is the first to replace if it turns out noisy.
6. **Dropped: Stroop/Flanker/task-switching** ("reliability paradox", Hedge 2018), n-back, reasoning,
   dedicated tapping tests and prospective-memory tests. They are unreliable, redundant or insensitive (details in §4).
7. **Subjective and objective fog often disagree.**
   - Long-COVID patients were ~3 SD slower with *no* correlation to how tired they felt (Zhao 2024).
   - So both are measured and never merged.
8. **Real-life day-to-day effects are small.**
   - Large exposures (short night, illness) show up within 1–2 weeks.
   - Subtle ones need weeks per condition and randomisation (§7).

---

## 3. The morning session: module specs

**Order:** The list is learned first, so the other tasks form the ~5-min retention delay. The PVT comes
early because it's the most state-sensitive. "Now" questions come *before* the tests, so test
performance doesn't colour your rating. "Yesterday" questions come *after*.

### 3.1 Now (~15 s)
- **Fog**: "Hoe helder voelt je hoofd nu?" 0 = helemaal helder → 10 = extreem mistig. One slider.
- **Sleep quality** (Consensus Sleep Diary item): zeer slecht / slecht / redelijk / goed / zeer goed.
- **Sleep times**: *lights out* and *woke up*, both **prefilled with yesterday's values**.
  Usually just tap "klopt" ("correct"); adjust only if different.
  - **v1 records them by asking you.** They are your own estimate, not a measurement.
    - Without a wearable, nothing measures your sleep.
    - A web app can't read the iPhone Health app.
    - The prefill makes it one tap on a normal day.
  - **Wake time** is the easy one: with a fixed alarm it's almost always the alarm time.
    You'd only change it on days you woke earlier or slept in.
  - **Lights out** is the number that varies, and the one worth being honest about. Round to the nearest
    15 min; a rough but consistent estimate is enough to see the effect of short vs. long nights.
  - The app itself logs the **session start time** automatically. Together with the wake time, that gives
    **minutes since waking** (sleep-inertia covariate) and time in bed.
  - **Later option (automatic, still free)**:
    - The iPhone can estimate "time in bed" from when you stop and start using the phone, via the Health app's
      sleep schedule and its "track time in bed with iPhone" option, where your iOS version offers it.
    - An iOS Shortcut could also stamp the moment you stop your alarm.
    - A Shortcut can hand both to the app when you open it.
    - This is less accurate than it sounds (lying awake without the phone counts as sleep), so it stays out of v1.
- **Dropped from v0.1**:
  - The sleepiness scale (KSS) is redundant with the fog slider plus the PVT.
  - Mood is not needed for your goals, and a rough proxy comes from "stress yesterday".

### 3.2 Word list: learn + immediate recall (~50 s)
- **List**: 12 unrelated concrete **Dutch** nouns of 1–2 syllables.
  - Mid frequency (**SUBTLEX-NL**), high concreteness (Brysbaert et al. 2014 Dutch concreteness norms).
  - No semantic or sound clusters.
- **Presentation**: shown one at a time, 1.5 s each, **written + spoken** (Dutch text-to-speech), mirroring verbal instructions at work.
- **Immediate recall**: 30 s, spoken aloud; tap "klaar" to end early.
- **Parallel forms**:
  - A pool of ≥ 3,000 words, with no word repeating within 90 days.
  - Lists balanced on frequency, length and concreteness.
- **Collision rule**: no list word belongs to that day's fluency category or starts with its letter.

### 3.3 PVT-B reaction test (3:00)
- **Task**: a millisecond counter starts in a box; tap anywhere as fast as possible. Your RT is shown for 1 s.
- **Timing**: random 1–4 s wait between stimuli, ≈ 60 stimuli. *Fixed forever once chosen.*
- **False start**: a response < 100 ms, or with no stimulus, shows "te vroeg" ("too early").
- **Primary metric**: mean response speed (mean of 1/RT).
- **Secondary metrics**:
  - lapses (≥ 355 ms)
  - slowest-10% speed
  - false starts
  - RT variability, an early marker in inflammation and long COVID (Handke 2020; Ortelli 2022)

### 3.4 Symbol Search (~60 s)
- **Task**: 3 symbol pairs on top; tap which of 2 bottom pairs matches one of them exactly.
  - 50% of trials have a lure sharing one symbol.
  - Symbols are random each day.
- **Trials**: 30 (a fixed count, so every day has the same amount of data).
- **Primary metric**: median correct-trial RT. Accuracy is a validity check.
- **Source**: port of the open-source m2c2kit task logic.

### 3.5 Word fluency (60 s + 3 s prompt)
- **Rotation**: alternate days between **letter** and **category**.
  - **Letters (Dutch-appropriate)**: D, A, T, K, M, S, B, P, R, V, G, H, L, W.
    - D-A-T is the standard Dutch letter set.
    - Rare letters (C, Q, X, Y, Z, U, I, E, …) are avoided.
  - **Categories**: dieren (animals), beroepen (occupations), groenten (vegetables), fruit, kleding (clothing), gereedschap (tools), meubels (furniture), vervoermiddelen (vehicles), sporten (sports), lichaamsdelen (body parts), keukenspullen (kitchen items), muziekinstrumenten (instruments) … (50+), with no repeat within 60 days.
- **Rule**: speak aloud; no names or places, no same-stem variants.
- **Metrics**:
  - valid words (primary, z-scored within that letter/category's own history)
  - words in the first 15 s
  - time to first word
  - median gap between words
  - **silences > 5 s ("blanks")**

### 3.6 Delayed recall (~30 s)
- **Task**: "Noem alle woorden van de lijst die je nog weet" ("name every word from the list you still remember"). 30 s, spoken.
- **Metrics**: immediate correct, delayed correct, retention (delayed ÷ immediate), intrusions.
- **Primary**: immediate + delayed.

### 3.7 Yesterday (~15 s, after the tests)
All items have a default, so a "normal" day takes three taps and an empty note.

| Item | Options | Why |
|---|---|---|
| **Daytime fog yesterday** | 0–10 slider, or "vrije dag" (day off) | **The most important one.** Checks whether the morning test predicts your actual workday. If it doesn't, the benchmark needs adjusting. |
| **Physical activity yesterday** | geen / licht / flink (none / light / vigorous) | Exercise is a common, plausible fog lever; you have no wearable to measure it |
| **Stress/workload yesterday** | laag / normaal / hoog (low / normal / high) | Stress drives subjective fog and poor sleep. Without it, stressful weeks look like "the intervention failed". |
| **Anything unusual?** | Free-text field, optional, empty by default. Placeholder hint: "bv. ziek, laat gegeten, geen thee, slecht geslapen, meditatie overgeslagen, blanco moment op werk…" ("e.g. sick, ate late, no tea, slept badly, skipped meditation, went blank at work…") | **Log exceptions, not constants.** Your tea (0–1) and alcohol (none) are near-constant, so you only write something when a day deviates. At analysis time the notes are coded into categories (sick, late meal, …), so nothing has to be decided up front. |

**Why the morning works instead of an evening log:**
- Recall of *yesterday* the next morning is fine for these items, because they are coarse and salient.
- It keeps everything to **one habit, one time, one place**.
- The small cost: "daytime fog yesterday" is rated ~16 h later and may be slightly coloured by how you
  feel this morning. That's acceptable and much better than a skipped evening log.

### 3.8 Automatic (0 s)
- **Tap precision** on every tap in every task: distance from target centre, misses, double taps.
  These feed the Motor Precision Index for "clumsiness".
- **Timing context**: session start time, minutes since waking, day of week.
- **Data quality**: interrupted sessions (app backgrounded), Low Power Mode (detected via frame rate; it halves the
  screen refresh rate and skews reaction times), app version.

---

## 4. Deliberately left out

| Candidate | Why not |
|---|---|
| Stroop / Flanker / task-switching / Trail Making | Difference scores unreliable; raw RT redundant with PVT + Symbol Search |
| n-back | Lowest daily reliability (0.41), speed-contaminated |
| Grid/Dot memory, Color Shapes | Overlaps the word list; kept as a **swap-in** if fluency turns out too noisy |
| Simple/choice RT, Go/No-Go | Same factor as the PVT |
| Reasoning, emotion recognition, risk tasks | Barely affected by sleep/fatigue; long practice curves |
| Prospective-memory test | Too few events per day to be reliable; real-life blanks can be noted in the free-text field |
| Dedicated tapping/motor test | Weak sensitivity, mediocre reliability; tap precision is captured for free |
| Evening log | Replaced by the "Yesterday" block (§3.7) |
| Weekly/fortnightly questionnaires, one-time intake | See §5 |

---

## 5. Questionnaires: none

**No weekly, fortnightly or one-time questionnaires.**
- The daily fog sliders, averaged over a week, already capture "fog over the past 1–2 weeks", and more precisely.
- The screening questionnaires (depression, anxiety, sleep apnea) are better handled by a doctor anyway; see §9.

---

## 6. Scoring

1. **Validity**:
   - A session is **invalid** if interrupted, PVT false starts > 10%, or Symbol Search accuracy < 75%.
   - A session is **flagged** (kept, marked) for Low Power Mode, or when the note mentions skipped meditation.
   - A retake is allowed only after an invalid session.
2. **Personal z-scores**: against the post-run-in baseline, with robust statistics
   (median/MAD), winsorised at ±3, signed so higher = better.
3. **Objective Cognition Index (OCI)**: equal-weight mean of four domains, scaled to baseline mean 0 / SD 1.
   - **Attention**: PVT speed + PVT lapses
   - **Speed**: Symbol Search RT
   - **Memory**: immediate + delayed recall
   - **Retrieval**: fluency words
4. **Subjective Fog Index (SFI)**: morning fog rating + yesterday's daytime fog. **Separate from the OCI.**
5. **Motor Precision Index**: exploratory.
6. **In the app**:
   - a line of the 7-day rolling OCI and SFI with your baseline band
   - today's dot shown faintly
   - tap for the domain breakdown
   - no alarming single-day verdicts
7. **Re-baseline** after a new phone, a major iOS update or a task change.

---

## 7. Protocol: from benchmark to experiments

| Phase | Duration | What happens |
|---|---|---|
| **0. Doctor check** | in parallel | See §9. |
| **1. Run-in** | 14 days | Learning the tasks. Data kept, excluded from the baseline. |
| **2. Baseline** | 21–28 days | Normal life. Establishes your personal norm. Exploratory: "what goes with bad days?" |
| **3. Experiments** | 3–8 weeks each | One change at a time, randomised, decided *in advance*: what, how long, what counts as success. |

- **Fast-acting, next-day things** (earlier bedtime, no late meals, screens off, evening walk):
  - randomise **day by day** (the app tells you each morning or evening which condition applies)
  - 20–30 days per condition
- **Slow things** (supplements such as iron, B12 or D, diet change, a sustained sleep schedule):
  - randomised **ABAB blocks of 2–4 weeks**
  - only the last ~60% of each block is analysed (washout)
- **Blinding where possible**: e.g. identical capsules prepared by someone else. The app asks your guess to check the blinding.
- **Never** change two things at once, or the morning routine during an experiment.

**How many days per condition (80% power)?**

| Effect size | Days per condition | Example |
|---|---|---|
| d = 1.5 | ~10 | Very short night, being sick |
| d = 1.0 | ~16–25 | Solid sleep change |
| d = 0.5 | ~60–100 | Subtle supplement effect |

**Analysis:**
- **v1**: in-app charts plus a rough before/after comparison.
- **Proper stats**: done periodically by me (Claude) on your exported data. That's a regression with a
  practice trend, a time-since-waking covariate and autocorrelation, plus a randomisation test. The result
  is stated as the "probability the effect is bigger than a meaningful change".

---

## 8. Timing and standardisation rules

- **Sleep inertia**:
  - You test ~16–20 min after the alarm. Grogginess is still fading then; performance recovers over
    ~1–2 h, and more slowly after a short night.
  - That's OK, and even makes the test extra sensitive to sleep, **as long as it's consistent**.
  - Two cheap improvements:
    - (a) get out of bed and drink water or get light before meditating, instead of snoozing lying down
    - (b) keep the snooze the same every day
  - The app logs minutes since waking and corrects for it.
- **Meditation**: can acutely sharpen attention. That's fine if it's done every day, because it becomes part of the baseline. Skipped days get a chip and are flagged.
- **Tea**: always test **before** your tea.
- **Same setup every day**:
  - same phone, same posture and hand
  - Do Not Disturb on
  - quiet room (for the voice tasks)
  - Low Power Mode **off**
- **Weekends**: do it too, same routine. If the wake time differs, the prefilled sleep times catch it.

---

## 9. See a doctor in parallel

An app shows *that* and *when* you're foggy, not *why*. Worth ruling out:

- **Sleep**:
  - obstructive sleep apnea (often unnoticed)
  - insufficient sleep
  - insomnia
- **Mental health**: depression, anxiety, burnout/stress exhaustion. Very often presents as "brain fog".
- **Blood work**:
  - TSH (thyroid)
  - B12
  - **ferritin** (iron deficiency hurts cognition even without anemia)
  - full blood count
  - glucose / HbA1c
  - possibly celiac serology and vitamin D
- **Post-viral / long COVID**: especially if it started after an infection.
- **Medications**: antihistamines, sleep medication, some antidepressants, beta-blockers.
- **Other**: orthostatic intolerance (POTS), adult ADHD.
- **Red flags, go promptly**:
  - steadily worsening
  - new word-finding problems
  - numbness or weakness
  - new headaches
  - weight loss

Bringing 4–6 weeks of app data to that appointment is genuinely useful.

---

## 10. Honest expectations

- **Noise**:
  - A single morning is about half signal, half noise.
  - 7-day averages are reliable.
  - Most subtle interventions will show "no detectable effect" unless run for weeks. That's a real answer.
- **Evidence limits**:
  - Most daily-testing research ran 1–2 weeks, often in older adults, so months-long practice effects are less studied.
  - The run-in and trend correction handle this.
- **Fluency**: the least proven module. If after the baseline it's too noisy, it's swapped for Grid Memory.
- **Morning vs. workday**: the morning test might not track afternoon meetings. The "daytime fog yesterday" item tests exactly this.

---

## 11. Build approach: free, iPhone, minimum friction

**Choice: a Progressive Web App (PWA) hosted free on GitHub Pages, added to your iPhone home screen.**

- **Why a web app and not a native app**:
  - A native iOS app costs €99/year (Apple Developer Program).
  - The free alternative means re-installing from a Mac every 7 days.
  - A home-screen web app is free and opens full-screen like a normal app.
  - It works offline and updates itself.
- **Timing precision**:
  - Safari adds a roughly constant touch/display delay, which cancels out because you always use the same phone.
  - Frame-accurate stimulus timing uses `requestAnimationFrame`.
  - Reaction times use the high-resolution touch timestamps.
  - Low Power Mode (which throttles frames) is detected and flagged.
- **Speech**:
  - Spoken answers use Safari's built-in speech recognition in Dutch (`nl-NL`).
  - Pause/timing metrics come from on-device voice-activity detection, so timing works even if a word is misheard.
  - At the end of the session, a 5-second **check screen** shows what was heard vs. the list, and you tap to fix mistakes.
  - The check comes at the end so you're never re-shown the words before delayed recall.
  - **Fallback**, if speech recognition turns out unreliable in home-screen mode on iOS:
    - typed recall
    - for fluency, word count estimated from speech bursts
- **Data**:
  - Stored on the phone, with a persistent-storage request.
  - **Automatic backup after every session to a *private* GitHub repo** (e.g. `fogmeter-data`), which is free.
    - It needs a one-time ~5-min token setup.
    - After that it's invisible.
    - It also lets me analyse your data in later sessions.
  - Only scores, trial data and answers are backed up. **No audio is recorded at all**; the end-of-session check screen replaces audio spot-checks.
  - The app code stays in this public repo. Your data never goes here.
- **Launch (built in v1)**: via an **iOS Shortcut** on the home screen, which opens the app in Safari.
  - An automation stamps the time you stop your alarm (wake time).
  - The Shortcut reads the last-24 h step count from Apple Health, which replaces the activity question.
  - Optional: a charger-connected automation stamps bedtime.
  - The app runs in a Safari tab rather than as a home-screen web app, because a Shortcut can only open Safari, and
    the two keep separate storage.
  - Setup steps are in the app under "Uitleg".

### v1 scope (build first)
- All 6 session steps
- "Yesterday" block
- Validity checks
- Local storage + GitHub backup
- Simple 7-day chart

### Later (only if v1 is used consistently)
- Day-by-day randomised experiment scheduler
- In-app statistics
- iOS Shortcut launcher, which could also pass automatic wake time (alarm stopped) and iPhone time-in-bed
- Automatic step count from Apple Health via a Shortcut (the iPhone counts steps without a wearable), which would replace the activity question
- Swap-in Grid Memory

---

## 12. Remaining decisions

1. **Backup**: is a private GitHub repo for your data OK? It's free and automatic, and lets me analyse it later.
   The alternative is manual export (share to iCloud Drive), which is more friction and easier to forget.
2. **Approve v0.3?** If yes, next step is the build, starting with a quick prototype on your phone to verify that
   Dutch speech recognition works in home-screen mode (that decides the speech-vs-typing fallback).

---

## References (key sources)

- Lim J, Dinges DF (2010). A meta-analysis of the impact of short-term sleep deprivation on cognitive variables. *Psychol Bull* 136:375.
- Basner M, Mollicone D, Dinges DF (2011). Validity and sensitivity of a brief psychomotor vigilance test (PVT-B). *Acta Astronautica* 69:949.
- Basner M et al. (2015). Development and validation of the Cognition test battery for spaceflight. *Aerosp Med Hum Perform* 86:942.
- Basner M et al. (2018). Repeated administration effects on psychomotor vigilance test performance. *Sleep* 41:zsx187.
- Basner M et al. (2020). Practice effects in the NASA Cognition battery. *J Clin Exp Neuropsychol* 42:5.
- Antler CA et al. (2022). Comparison of 3-min and 10-min PVT. *Front Neurosci*.
- Sliwinski MJ et al. (2018). Reliability and validity of ambulatory cognitive assessments. *Assessment* 25:14.
- Thompson LI et al. (2022). M2C2 smartphone cognitive assessment. *Alzheimer's & Dementia: DADM*.
- Nicosia J et al. (2023). Ambulatory Research in Cognition (ARC). *JINS* 29:459.
- Moore RC et al. (2021). Mobile Verbal Learning Test. *Int J Methods Psychiatr Res* 30:e1859.
- Woods DL et al. (2016). Computerized analysis of verbal fluency: normative data and effects of repeated testing. *PLoS One* e0166439.
- Harrison Y, Horne JA (1997). Sleep deprivation affects speech. *Sleep* 20:871.
- Hedge C, Powell G, Sumner P (2018). The reliability paradox. *Behav Res Methods* 50:1166.
- Newbury CR et al. (2021). Sleep deprivation and memory: meta-analytic reviews. *Psychol Bull*.
- Hampshire A et al. (2024). Cognition and memory after COVID-19 in a large community sample. *NEJM* 390:806.
- Zhao S et al. (2024). Long COVID is associated with severe cognitive slowing. *eClinicalMedicine*.
- Handke A et al. (2020). Inflammation-induced RT variability. *Brain Behav Immun Health*.
- Ortelli P et al. (2022). Attention and executive deficits in post-COVID. *Sci Rep*.
- Schwarz J et al. (2025). Day-to-day sleep and smartphone DSST performance. *Sleep* zsaf321.
- Buxton OM et al. (2025). Sleep fragmentation and next-day cognition (M2C2). *Sleep Health*.
- Gunn C et al. (2018). Next-day effects of heavy alcohol consumption on cognition. *Addiction*.
- Carney CE et al. (2012). The Consensus Sleep Diary. *Sleep* 35:287.
- Debowska A et al. (2024). Brain Fog Scale: development and validation. *Pers Individ Differ* 216:112427.
- Brysbaert M, Stevens M, De Deyne S, Voorspoels W, Storms G (2014). Norms of age of acquisition and concreteness for 30,000 Dutch words. *Acta Psychologica* 150:80.
- Keuleers E, Brysbaert M, New B (2010). SUBTLEX-NL: a new measure for Dutch word frequency. *Behav Res Methods* 42:643.
- Jewett ME et al. (1999). Time course of sleep inertia dissipation. *J Sleep Res* 8:1.
- Hilditch CJ, McHill AW (2019). Sleep inertia: current insights. *Nat Sci Sleep* 11:155.
- Kravitz RL, Duan N (eds.) (2014). *Design and Implementation of N-of-1 Trials*. AHRQ.
- Wang Y, Schork NJ (2019). Power and design issues in crossover-based N-of-1 clinical trials. *Healthcare*.
- m2c2kit: https://github.com/m2c2-project/m2c2kit (Apache-2.0)
