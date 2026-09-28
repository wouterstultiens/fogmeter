# Fogmeter: daily cognitive benchmark, design v0.1 (for approval)

> Status: **draft for approval**. There is no app code yet. This document covers *what* to measure,
> *how*, and *why*. It is based on a literature review (sources at the bottom).

---

## 0. TL;DR

A **~7-minute morning session** done right after meditation (~6¾ min of measured tasks). A
cut-down ~5½-minute variant is in §12. Every day, in a fixed order:

| # | Module | Time | Measures | Why it's in |
|---|--------|------|----------|-------------|
| 1 | **Check-in**: 4 taps | ~25 s | Sleepiness (KSS), fog 0–10, mood, sleep quality | Subjective fog is a separate signal from test scores; you need both |
| 2 | **Word list: learn + immediate recall** | ~50 s | Verbal episodic memory (encoding) | Matches "forgot the instructions"; memory is the domain most affected in long-COVID-type fog |
| 3 | **PVT-B**: 3-min reaction-time vigilance test | 3:00 | Sustained attention, psychomotor speed, attention lapses | The most state-sensitive test known (sleep loss, fatigue, hangover); almost no practice effect |
| 4 | **Symbol Search** | ~60 s | Processing speed ("mind feels slow") | Highly reliable, sensitive, easy daily parallel forms |
| 5 | **Verbal fluency**: say words for 60 s | ~65 s | Word retrieval, executive search, "going blank" | Matches "mind goes blank in meetings"; timing features catch blank periods |
| 6 | **Word list: delayed recall** | ~30 s | Retention after ~5 min of interference | Real-life analog: told something once, recall it later |
| — | *Passive*: touch accuracy on every tap | 0 s | Fine-motor precision ("clumsiness") | Free data; a dedicated motor test isn't worth its time |

Plus a **~40-second evening log** of exposures such as sleep, alcohol, caffeine and stress, and daily lapses.
There is also a **weekly** 4-item questionnaire and a **fortnightly** Brain Fog Scale.

Scores are **not** read day by day; single days are ~50% noise. The unit of evidence is a
**block of days** compared against **your own baseline**. The outputs are three separate indices:
**Objective Cognition Index**, **Subjective Fog Index**, and a secondary **Motor Precision Index**.

---

## 1. What we're trying to capture

| Your complaint | Cognitive domain | Covered by |
|---|---|---|
| "My mind feels slow" | Processing speed, psychomotor speed | Symbol Search, PVT mean speed |
| "Mind goes blank in meetings", no good input | Attention lapses, word retrieval / generative fluency | PVT lapses + RT variability, verbal fluency (pauses > 5 s) |
| Forgot a coworker's instructions | Verbal episodic memory (encoding under divided attention) | Word list immediate + delayed recall |
| Clumsiness | Fine-motor precision | Passive touch-offset / miss metrics across all tasks |
| "This is not like me" | Change vs. personal baseline | Everything is scored as z vs. *your own* baseline, not population norms |

---

## 2. Research findings that drive the design

1. **Attention and vigilance are the most state-sensitive domains.**
   - Meta-analysis of sleep deprivation (Lim & Dinges 2010, 70 studies), in Hedges' g:
     - simple-attention lapses −0.76
     - working memory −0.55
     - short-term memory recall −0.38
     - processing speed −0.30
     - reasoning −0.13 (n.s.)
   - Hangover likewise hits psychomotor speed and sustained attention (Gunn 2018).
   - **So the PVT gets the largest time share.**
2. **The 3-minute PVT-B is the shortest version still validated** (Basner 2011).
   - Its effect sizes are ~23% smaller than the 10-min PVT, but still medium-to-large.
   - 2-min and 90-s versions were judged insensitive.
   - Over 16 administrations there was essentially **no practice effect** (Basner 2018).
   - Caveat: its resolution is limited when you're well rested (Antler 2022).
3. **Processing-speed tasks are the most reliable brief tasks.**
   - A <1-min Symbol Search reaches 0.80 reliability after averaging just 2–3 days (Sliwinski 2018).
   - Naturalistic sleep variation measurably slows it (Schwarz 2025; Buxton 2025).
   - They do show a practice curve for ~1–5 weeks, so we need a run-in.
4. **Memory is what long-COVID/brain-fog populations lose most consistently** (Hampshire 2024 NEJM; Guo 2022).
   - Encoding while tired is hit hard: sleep deprivation *before* learning g = 0.62 (Newbury 2021).
   - Day to day, brief memory tasks are noisy: single-session ICC 0.26–0.50.
   - So memory is judged on **weekly/block means**. Free recall of a word list is chosen over 2-choice
     recognition because it has no 50% guessing floor and gives more information per second.
5. **Verbal fluency has good alternate-form reliability.**
   - Phonemic ICC 0.91, semantic 0.77 (Woods 2016).
   - It is sensitive to sleep loss, with fewer words and more perseveration (Harrison & Horne 1997).
   - Pause/timing features change after ~24 h awake (Vogel 2010).
   - Weakest evidence of the four tasks for *daily* use over months, so treated as experimental (see §12).
6. **Difference scores are unreliable.**
   - Stroop, Flanker and task-switch costs have test-retest ICC 0.36–0.66 even with ~20-min tasks (Hedge 2018, "reliability paradox").
   - Their raw RTs just duplicate the speed factor. **Dropped.**
7. **Subjective and objective fog often dissociate.**
   - Long-COVID patients were ~3 SD slower on simple RT with *zero* correlation to self-rated fatigue (Zhao 2024).
   - Subjective complaints track mood and stress more than test scores.
   - **So both are measured and never merged into one number.**
8. **Real-life day-to-day effects are small.**
   - One hour less sleep costs ≈0.1 correct items on a 60-s DSST (Schwarz 2025).
   - Only large exposures (hangover, <6 h sleep, illness) will be visible within a week or two.
   - Subtle ones (a supplement) need weeks per arm and a randomised design.

---

## 3. The daily morning session: module specs

**Order rationale.** The list is learned first so the other tasks serve as the retention delay (~5 min).
PVT comes early because it's the most state-sensitive and should not be pre-fatigued. Fluency comes
last before delayed recall as verbal interference, the same every day.

### 3.1 Check-in (~25 s)
- **KSS**, "Rate your sleepiness during the last 5 minutes", 1–9:
  - 1 extremely alert · 3 alert · 5 neither alert nor sleepy · 7 sleepy, no effort to stay awake ·
    9 very sleepy, fighting sleep
  - Validated against PVT lapses (Kaida 2006).
- **Fog**: "Right now my thinking feels…" 0 = completely clear/sharp → 10 = extremely foggy.
  - Custom; no validated single daily fog item exists.
- **Mood**: −3 very bad … +3 very good.
- **Sleep quality** (Consensus Sleep Diary): very poor / poor / fair / good / very good.
- Bed/wake times are prefilled from a wearable or the alarm and only confirmed.
- **Auto-captured**:
  - wake time (alarm dismissal) and minutes since waking
  - session start time
  - meditation done Y/N
  - "interrupted" flag
  - device / app version

### 3.2 Word list: encode + immediate recall (~50 s)
- **List**: 12 unrelated concrete nouns, 1–2 syllables.
  - Mid frequency (SUBTLEX log-freq ≈ 2.5–4.0), high concreteness (≥ 4/5).
  - No semantic or phonological clusters.
- **Presentation**: shown one at a time, **1.5 s each**, as a written word + spoken audio (TTS).
  Auditory presentation mirrors verbal instructions at work.
- **Immediate recall**: 30 s, **spoken** free recall (on-device speech recognition, audio stored);
  tap "done" to end early.
- **Parallel forms**:
  - A pool of ≥3,000 words; lists drawn so that no word repeats within 90 days.
  - Lists balanced on frequency, length and concreteness.
  - List difficulty is stored as a covariate.
  - Why it works: the mobile verbal learning test with daily new lists showed **no practice effect** (Moore 2021).
- **Collision rule**: no list word may belong to that day's fluency category or start with its letter.

### 3.3 PVT-B (3:00)
- **Stimulus**: a millisecond counter starts in a fixed box.
- **Response**: tap anywhere in a large area, same hand and grip daily.
  The RT is shown for 1 s as feedback.
- **Interval**: random 1–4 s between stimuli, excluding the 1-s feedback (Basner 2011), ≈ 60 stimuli.
  *Fixed forever once chosen.*
- **False start**: a response < 100 ms or with no stimulus shows "too soon".
  **Timeout**: 30 s.
- **Primary metric**: **mean response speed** (mean of 1/RT), the most sensitive and robust PVT metric.
- **Secondary metrics**:
  - lapses (RT ≥ 355 ms; also log ≥ 500 ms)
  - slowest-10% speed
  - false starts
  - RT variability (CV of RT). Inflammation and long COVID show up as *variability* before slowing (Handke 2020; Ortelli 2022).

### 3.4 Symbol Search (~60 s)
- **Display**: 3 symbol pairs on top; tap which of 2 bottom pairs exactly matches one of them.
  - 50% of trials have a lure sharing one symbol.
  - Left/right target 50/50.
  - Symbols drawn randomly each day.
- **Trials**: **30**, fixed count rather than fixed time, so every day has the same data.
  This is up from the 12–20 used in ambulatory research, to raise single-day reliability to ≈0.7.
- **Primary metric**: median RT of correct trials (log-transformed). **Accuracy** is a validity check.
- **Implementation**: port or embed the open-source **m2c2kit** implementation (Apache-2.0).

### 3.5 Verbal fluency (60 s + 3 s prompt)
- **Rotation**: alternate days between **letter** and **category**.
  - **Letter**: a rotating set of ~14 letters (language-specific).
  - **Category**: 50+ categories, no repeat within 60 days.
- **Rules**: say as many words as possible, spoken aloud; no names, no same-stem variants.
- **Metrics**:
  - **valid words** (primary, z-scored *within that letter/category's own history*, because forms differ in difficulty)
  - words in the first 15 s
  - latency to first word
  - median gap between words
  - **number of silences > 5 s ("blanks")**
  - repetitions / rule breaks
- **Scoring**: timing comes from voice-activity detection, which needs no speech recognition to be correct.
  Word scoring uses speech recognition, with ~10% of sessions spot-checked by hand at first.

### 3.6 Delayed recall (~30 s)
- **Task**: "Say all the words you remember from this morning's list." 30 s of spoken free recall.
- **Metrics**:
  - immediate correct
  - delayed correct
  - retention (delayed / immediate)
  - intrusions
- **Primary**: immediate + delayed.

### 3.7 Passive motor precision (0 s)
- **Logged on every tap in every task**:
  - distance from target centre (mm)
  - misses (taps outside targets)
  - double taps
  - touch duration
- **Index**: the Motor Precision Index = median offset + miss rate, z-scored.
- **Status**: *secondary/exploratory*. Whether this is a valid "clumsiness" proxy is not established.
  - Why no dedicated test: tapping/pointing tests showed weak sensitivity to sleep loss and mediocre
    daily reliability (e.g. 10-s tapping speed ICC 0.65, rhythm 0.44), so they don't earn a dedicated slot.

---

## 4. Deliberately left out (and why)

| Candidate | Decision | Reason |
|---|---|---|
| Stroop / Flanker / task-switching / Trail Making B−A | Drop | Difference scores are unreliable; raw RT is redundant with Symbol Search/PVT |
| n-back / 2-back | Drop | Lowest within-person reliability (0.41), unstable in the first days, contaminated by speed; the word list covers memory |
| Grid/Dot memory, Color Shapes (visuospatial working memory) | Drop (swap-in option) | Overlaps with the word list; verbal memory matches your complaint better |
| Simple RT / choice RT / Go-No-Go | Drop | Same factor as the PVT; the PVT has more trials |
| Reasoning (matrices), emotion recognition, risk (BART) | Drop | Least sleep-sensitive (g ≈ −0.13); long practice curves; large form effects |
| Prospective memory test | Drop from the test; captured in the evening log | 1–4 binary events per session means hopeless single-day reliability |
| Dedicated tapping/motor test | Drop; passive metrics instead | Weak sensitivity, poor daily reliability |
| Morning-encode → evening-recall | Drop (maybe later) | Needs a second session; uncontrolled rehearsal; adherence drops |

---

## 5. Non-test questionnaires

### 5.1 Evening log (~40 s; if missed, next-morning "yesterday" fallback, flagged)
- **Alcohol**: drinks + time of last drink
- **Caffeine**: servings + time of last
- **Late large meal** (< 3 h before bed): Y/N
- **Exercise**: minutes + intensity (or from wearable)
- **Stress today**: 1–5 (single item, after Elo 2003)
- **Screens in the last hour before bed**: Y/N
- **Illness/symptoms**: none / mild / sick
- **Meds / supplements / nap**: checklist
- **"How was your thinking at work today?"** 0–10.
  **Important**: this checks whether the morning test tracks your *daytime* function.
- **Daily lapses**, 0–3 each (adapted from a daily Cognitive Failures scale, Guevarra 2024):
  - forgot something I meant to do
  - went blank / lost my train of thought
  - dropped or bumped into things

### 5.2 Periodic
- **Weekly (Sunday), PROMIS Cognitive Function 4a**, 7-day recall.
  - Items: "My thinking has been slow", "…brain was not working as well as usual", "…had to work
    harder to keep track…", "…trouble shifting back and forth…".
  - Scale: never … very often.
- **Every 2 weeks, Brain Fog Scale** (Debowska 2024): 23 items, 3 subscales (Mental Fatigue,
  Impaired Cognitive Acuity, Confusion), ~2 min.
- **Once at start** (and every ~3 months), for screening: **PHQ-9** (depression), **GAD-7** (anxiety),
  **STOP-Bang or Epworth** (sleep apnea / sleepiness).

### 5.3 Passive data (if you have a wearable)
- **What to pull**: sleep times and duration, resting HR, overnight HRV, steps.
- **Reliability**: consumer wearables are OK for sleep duration/timing, weak for sleep stages.
- **Keep the subjective sleep-quality question**: it predicts next-day function independently.

---

## 6. Scoring

1. **Validity rules**. A session is invalid if any of these hold:
   - interrupted
   - PVT false starts > 10% of responses
   - Symbol Search accuracy < 75%
   - meditation skipped (flag rather than invalidate)

   One retake per day is allowed *only* if the first attempt was invalid.
2. **Per-metric personal z-score** against the post-run-in baseline, using robust statistics:
   `z = (x − median) / (1.4826 · MAD)`, winsorised at ±3, signed so that **higher = better**.
   - Fluency is z-scored within its form (letter vs. category).
   - Memory is adjusted for list difficulty once there's enough data.
3. **Objective Cognition Index (OCI)**: equal-weight mean of four domain scores, rescaled to
   baseline mean 0 / SD 1. Equal weights are robust with small n; don't fit weights on < ~60 days.
   - **Attention** = mean(z PVT speed, z PVT lapses)
   - **Speed** = z Symbol Search RT
   - **Memory** = z (immediate + delayed recall)
   - **Retrieval** = z fluency words
4. **Subjective Fog Index (SFI)** = mean(z fog rating, z KSS). **Kept separate from the OCI.**
5. **Motor Precision Index**: secondary, exploratory.
6. **Display**:
   - a 7-day rolling mean with a personal baseline band (control chart)
   - a single-day value, shown only faintly
   - "unusual day" flags when the OCI is beyond ±2 SD
   - domain breakdown on tap
7. **Re-baseline** whenever the phone, OS (major version), app task parameters or test time/routine change.

---

## 7. Protocol: from benchmark to experiments

| Phase | Duration | What happens |
|---|---|---|
| **0. Medical check** | parallel | See §9. The most important "experiment" is ruling out treatable causes. |
| **1. Run-in** | 14 days | Learn the tasks; practice curves flatten. Data kept but excluded from the baseline. |
| **2. Baseline (observational)** | 21–28 days | Normal life, full logging. Defines your personal norms. Extended until the fitted learning curve is flat over the last 10 days. Exploratory "what correlates with bad days?" analysis to *generate* hypotheses. Optional: for 1–2 weeks add an early-afternoon session to check that morning scores track daytime. |
| **3. Experiments** | 3–8 weeks each | One intervention at a time, randomised, pre-registered in the app (hypothesis, primary outcome = OCI, duration, stop rule). |

### Experiment designs
- **Fast-acting, next-day exposures**: no alcohol, caffeine cut-off time, no late meal, screens off,
  earlier bedtime, evening exercise.
  - Randomise **day by day**, or in randomised pairs (AB/BA).
  - At least 20–30 days per condition.
- **Slow or cumulative exposures**: supplements (iron, B12, D, omega-3), diet change, sustained sleep
  extension, quitting caffeine.
  - Randomised **ABAB blocks of 2–4 weeks**, at least 2 pairs.
  - Analyse only the last ~60% of each block (built-in washout).
  - Caffeine withdrawal lasts 2–9 days, so caffeine blocks need ≥1 week of washout.
- **Blinding where possible**: identical opaque capsules prepared by someone else, and numbered
  envelopes or pill boxes.
  - Log your daily *guess* of the condition, to check whether you actually were blinded.
  - Expectancy moves subjective ratings more than objective tasks, which is another reason the OCI is primary.
- **Never** change two things at once, and never change the morning routine (meditation, timing) during an experiment.

### How many days? (80% power, α = .05, in within-person SD units of the daily OCI)

| True effect | Days per condition (independent days) | With autocorrelation (≈ ×1.5–1.9) |
|---|---|---|
| Large (d = 1.5), e.g. hangover, < 5 h sleep | ~7 | ~11–13 |
| d = 1.0 | ~16 | ~25–30 |
| d = 0.8 | ~25 | ~40–48 |
| Moderate (d = 0.5), e.g. a supplement that "works" | ~63 | ~95–120 |

Frequent alternation (daily randomisation) keeps the autocorrelation penalty near the left column.

### Analysis
- **Primary**: regression of the daily OCI on condition + a practice/time trend + minutes-since-waking
  (+ sleep duration), with AR(1) errors (Bayesian or GLS).
  - Report the **probability that the effect exceeds a smallest-worthwhile change** (e.g. 0.3 SD),
    not just a p-value.
- **Confirmatory**: a randomisation test using the actual randomisation schedule.
- **Monitoring**: EWMA / control chart against the baseline limits.
- **Avoid**: plain t-tests on daily data, and conclusions from single days.
- **Report**: OCI, SFI and each domain separately. "Felt better but tested the same" is a real and useful finding.

---

## 8. Timing and standardisation rules

- **Sleep inertia is real at your test time.**
  - Your test starts ~16–20 min after the alarm.
  - Performance recovers asymptotically over 1–2 h after waking, faster in the first 15–30 min.
  - It is worse after short sleep (Jewett 1999; Hilditch & McHill 2019).
  - So morning scores partly measure sleep inertia. This makes them *extra* sensitive to sleep manipulations.
  - **Recommendation**: keep the routine, but
    - (a) get out of bed and get light and water before meditating, not just snooze in bed
    - (b) aim for a test start ≥ 25 min after the first alarm
    - (c) keep that interval constant (±5 min); the app logs it and uses it as a covariate
- **Snooze**: keep it identical every day (5 min or none). It's part of the routine, and the app logs alarm vs. natural waking.
- **Meditation**: a single session can acutely improve attention.
  - That's fine as long as it's constant, because it becomes part of the baseline.
  - Days you skip or shorten it are flagged or excluded.
- **Caffeine**: always test **before** the first coffee.
- **Environment**: same phone, same posture and hand, Do-Not-Disturb on, same brightness, quiet room
  (needed for the voice tasks).
- **Device timing**:
  - Touchscreen latency adds a constant 35–140 ms depending on the phone. A constant offset cancels out
    within one device, but it breaks comparisons across devices, hence re-baselining on a phone change.
  - The app must be native (or near-native), with frame-accurate stimulus timestamps and hardware touch
    timestamps. PVT speed, not lapse counts, is the primary metric because it's less sensitive to device offset.

---

## 9. See a doctor in parallel: common treatable causes of brain fog

An app can show *that* and *when* you're foggy, but it can't diagnose *why*. Worth ruling out:

- **Sleep**
  - obstructive sleep apnea (even without obvious snoring)
  - insufficient sleep
  - insomnia
  - delayed circadian rhythm
- **Mental health**: depression, anxiety, burnout / stress-related exhaustion. These often present
  primarily as "brain fog" and subjective memory complaints.
- **Blood work**
  - TSH (thyroid)
  - B12
  - **ferritin** (iron deficiency impairs cognition even without anemia)
  - full blood count
  - glucose / HbA1c
  - possibly celiac serology
  - vitamin D (weak evidence for cognition)
- **Post-viral / long COVID**, especially if the fog started after an infection.
- **Medications and substances**
  - antihistamines and anticholinergics, sleep medication, some antidepressants, beta-blockers
  - alcohol, cannabis
  - withdrawal from any of these
- **Other**: orthostatic intolerance (POTS), perimenopause, adult ADHD.
- **Red flags → see a doctor promptly**:
  - steadily worsening decline
  - new word-finding or language problems
  - weakness, numbness or other neurological symptoms
  - new headaches
  - unexplained weight loss

The app's baseline data (a month of scores + sleep log) is useful to bring to that appointment.

---

## 10. Honest expectations and limitations

- **Single days**:
  - A single morning score is roughly half signal, half noise.
  - Brief-task within-person reliability is only 0.4–0.55 per task. The four-task composite improves this.
- **Blocks**: 7-day means are reliable (≥ 0.85).
- **Subtle interventions**: most will show "no detectable effect" unless run for many weeks with
  randomisation. That is a real answer, not a failure.
- **Population**: nearly all daily-testing research is on 1–2-week studies, often in older adults.
  Practice and form-exhaustion effects over *months* in a working-age adult are less studied.
  The run-in and trend term handle this, but we should watch for it.
- **Fluency**: daily fluency over months is the least evidence-backed module. If its data turn out
  noisy after the baseline, it's the first candidate for replacement (by Grid Memory or more PVT).
- **Morning vs. daytime**: morning scores might not track afternoon meeting performance. The evening
  "thinking at work" item and the optional afternoon validation week test exactly this.

---

## 11. Build notes (for later)

- **Reuse**:
  - **m2c2kit** (open-source, Apache-2.0, TypeScript): Symbol Search, Grid Memory, Color Shapes
  - **PEBL** (open source): PVT logic
  - **StudyU/StudyMe** (open-source N-of-1 app): randomised ABAB scheduling
- **Storage**: all raw trial-level data stored locally with export (CSV/JSON), so analyses can be
  redone later with better methods.
- **Speech**: on-device speech recognition (privacy), audio kept for spot-checking.

---

## 12. Decisions needed from you

1. **Session length.** The recommended session is ~7 min. Alternatives:
   - **A. Recommended (~7 min):** everything in §0.
   - **B. Shorter variant:** fluency moves to *alternate days* (it's the weakest-evidence module), and
     Symbol Search drops to 24 trials. That gives ≈ 5½ min on non-fluency days and ≈ 6½ min on fluency days.
     A strict 5 min would mean dropping immediate recall or fluency entirely, which I don't recommend.
   - **C. "Bad-day minimum" (~3½ min)**, available in either option: check-in + PVT only, so the streak
     never breaks. Minimum days are marked and analysed on PVT only.
2. **Speaking aloud.** Memory recall and fluency use *spoken* answers: they're faster, richer, and avoid
   typing confounds. Is speaking out loud OK in your morning setting (e.g. someone sleeping nearby)?
   The fallback is typed recall and typed fluency, which is lower quality.
3. **Language.** Should the word lists and fluency be in **Dutch or English**? Dutch word norms exist
   (SUBTLEX-NL, Dutch concreteness norms). Test in the language you think and work in most.
4. **Wearable.** Do you have one (Oura, Apple Watch, Garmin, Fitbit…)? If yes, sleep and HRV are
   imported and the questions shrink.
5. **Phone.** iOS or Android? This matters for timing precision and the build approach.
6. **Evening log.** Is a ~40-s evening log acceptable? Without it, we can only correlate scores with
   morning-reported data.

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
- Schwarz J et al. (2025). Day-to-day sleep and smartphone DSST performance. *Sleep* zsaf321.
- Buxton OM et al. (2025). Sleep fragmentation and next-day cognition (M2C2). *Sleep Health*.
- Gunn C et al. (2018). A systematic review of next-day effects of heavy alcohol consumption on cognition. *Addiction*.
- Kaida K et al. (2006). Validation of the Karolinska Sleepiness Scale. *Clin Neurophysiol*.
- Carney CE et al. (2012). The Consensus Sleep Diary. *Sleep* 35:287.
- Debowska A et al. (2024). Brain Fog Scale: development and validation. *Pers Individ Differ* 216:112427.
- Guevarra DA et al. (2024). Daily cognitive failures. *Brain Sciences*.
- McWhirter L et al. (2023). What is brain fog? *JNNP* 94:321.
- Jewett ME et al. (1999). Time course of sleep inertia dissipation. *J Sleep Res* 8:1.
- Hilditch CJ, McHill AW (2019). Sleep inertia: current insights. *Nat Sci Sleep* 11:155.
- Kravitz RL, Duan N (eds.) (2014). *Design and Implementation of N-of-1 Trials*. AHRQ.
- Vohra S et al. (2015). CONSORT extension for N-of-1 trials (CENT). *BMJ* 350:h1738.
- Wang Y, Schork NJ (2019). Power and design issues in crossover-based N-of-1 clinical trials. *Healthcare*.
- Juliano LM, Griffiths RR (2004). Caffeine withdrawal. *Psychopharmacology* 176:1.
- m2c2kit: https://github.com/m2c2-project/m2c2kit (Apache-2.0)
