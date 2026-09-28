// Settings live in localStorage (small, per device).
const KEY = 'fogmeter.config';
const DEFAULTS = {
  token: '',
  repo: 'wouterstultiens/fogmeter-data',
  inputMode: 'speech', // 'speech' | 'typed'
  defaultWake: '07:00',
  defaultBed: '23:00',
};

export function getConfig() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULTS }; }
}

export function setConfig(patch) {
  const next = { ...getConfig(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
  return next;
}

export const APP_VERSION = '1.2.0';
