# Fogmeter

A ~6-minute daily morning test for tracking brain fog. It runs as a free web app on iPhone (Safari),
opened through an iOS Shortcut. Why it measures what it measures: see [DESIGN.md](DESIGN.md).

**The session:**
1. Check-in: fog right now, sleep quality, sleep times
2. Learn a 12-word list (Dutch)
3. First recall: say the words aloud; speech recognition listens (no tapping)
4. 3-minute reaction-time test (PVT-B)
5. Symbol Search
6. Second recall (same as step 3)
7. Review: both transcripts on top (recognised list words marked), then per-word "1st / 2nd time" ticks prefilled
   from speech recognition. You only fix mistakes. The list is shown only here, at the end.
8. Three "yesterday" questions + an optional note (prefilled with any quick notes made since the last session)

**Skipping:** every part has a small "Overslaan" (skip): below the Start button on each intro screen, and top
right while a task runs (tap twice, so a stray tap never skips). A skipped part just has no score that day; the rest
of the session counts normally. Skipping the list or the first recall drops the whole word list. Leaving the app
during a part you then skip (e.g. a phone call during the reaction test) doesn't make the session invalid.

**Any time (optional):** "+ Notitie" on the home screen: a short text plus an optional "how clear right now" 0–10.
The text prefills the next morning's note; the rating is stored separately.

**Results:** raw scores of every session (run-in included) as small charts, a table of all sessions with
full per-session details, all notes, and (after the run-in) the 7-day trend vs. your own baseline.

## Setup (one time, ~15 min)

1. **Publish the app (GitHub Pages, free).**
   - In this repo: Settings → Pages → *Build and deployment* → Source: **Deploy from a branch**.
   - Branch: the branch holding the app (currently `claude/cognitive-benchmark-design-byacx3`, or `main` after merging). Folder: **/docs**. Save.
   - After ~1 min the app is live at <https://wouterstultiens.github.io/fogmeter/>.
2. **Private data repo + token.** Create a private repo `fogmeter-data`. Then create a fine-grained
   personal access token limited to that repo with *Contents: Read and write*. Paste it in the app
   under Instellingen → Back-up, and tap "Test verbinding".
3. **iPhone.**
   - Safari microphone: allow it (Settings → Apps → Safari → Microphone).
   - Build the Shortcut: automatic wake time when you stop your alarm, plus step count from Apple Health.
     Step-by-step instructions are in the app under **Uitleg**.
4. Do one **Oefenronde** (practice run, not saved) to check that Dutch speech recognition works on your phone.
   If it doesn't, switch to typing in Instellingen.

## Data

- **On the phone:** sessions are stored in Safari (IndexedDB).
- **Backup:** after each session, one JSON file per session is uploaded to
  `fogmeter-data/sessions/YYYY-MM/`, and each quick note to `fogmeter-data/notes/YYYY-MM/`.
  Run-in sessions are saved and uploaded like any other; only the practice run is not saved.
  If Safari ever clears its storage, the app restores from there.
- **Uploaded:** only scores, trial data (reaction times), recogniser transcripts and your answers. No audio is recorded.
- **Not in this repo:** this repo is public and contains only app code, never your data.

## Development

No build step: plain HTML/CSS/ES modules in `docs/`.

```sh
npm test                 # unit tests (scoring, Shortcut parsing, schedule)
npm run serve            # local server on :8080
node tests/e2e.mjs       # end-to-end run of a full session in headless Chromium (?e2e = short timings)
```

Do **not** change the word pool, fluency categories/letters, or schedule seeds (`docs/js/schedule.js`,
`docs/js/data/words_nl.js`) after data collection has started. That would reshuffle which list belongs to which day.
