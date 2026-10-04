// Sleep times from the check-in → timing context stored with each session.

/** "Wakker gelegen" choices: total minutes awake during the night (not falling asleep). */
export const AWAKE = [
  { label: 'geen', value: 0 },
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 uur', value: 60 },
  { label: '1½ uur+', value: 90 },
];

/**
 * bedTime/wakeTime: 'HH:MM' (lights out / woke up). awakeMin: minutes lying awake, or null when unknown
 * (sessions from before app 1.5), in which case sleepMin is null too.
 */
export function sleepContext(startedAt, bedTime, wakeTime, awakeMin = null) {
  const at = (base, hhmm) => { const [H, M] = hhmm.split(':').map(Number); const d = new Date(base); d.setHours(H, M, 0, 0); return d; };
  let wakeAt = at(startedAt, wakeTime);
  if (wakeAt > startedAt) wakeAt = new Date(wakeAt - 86400000);
  let bedAt = at(wakeAt, bedTime);
  if (bedAt >= wakeAt) bedAt = new Date(bedAt - 86400000);
  const timeInBedMin = Math.round((wakeAt - bedAt) / 60000);
  return {
    wakeAt: wakeAt.toISOString(),
    bedAt: bedAt.toISOString(),
    timeInBedMin,
    awakeMin,
    sleepMin: Number.isFinite(awakeMin) ? Math.max(0, timeInBedMin - awakeMin) : null,
    minutesSinceWake: Math.round((startedAt - wakeAt) / 60000),
  };
}
