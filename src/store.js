import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FS from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { THEMES } from './themes';

const KEY = '@mt_state_v2';

export const DEFAULT = {
  tasks: [],
  unlocked: [],
  stats: {
    xp: 0, done: 0, created: 0, streak: 0, bestStreak: 0, lastDone: null, doneHigh: 0, doneTimed: 0,
    bestDay: 0, dayCount: { date: null, count: 0 }, repeatCreated: 0, early: 0, night: 0, weekend: 0,
    perfectDay: 0, bgSet: 0, themeChanged: 0, exported: 0, nameSet: 0, notesAdded: 0, catAdded: 0,
  },
  settings: {
    lang: 'tr', theme: 'dark', accent: null, bg: null, dim: 0.4, font: 1, radius: 16, compact: false,
    showXp: true, name: '', notifs: true, lead: 0, dailyOn: false, dailyHour: 20, dailyMin: 0,
    cats: [
      { id: 'c1', name: 'Genel', emoji: '📌' }, { id: 'c2', name: 'İş', emoji: '💼' },
      { id: 'c3', name: 'Okul', emoji: '🎓' }, { id: 'c4', name: 'Spor', emoji: '🏃' },
      { id: 'c5', name: 'Kişisel', emoji: '🏠' },
    ],
  },
};

export const clone = (o) => JSON.parse(JSON.stringify(o));
const p2 = (n) => String(n).padStart(2, '0');
export const todayKey = (d = new Date()) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

// Tekrarlayan görevler: günlük -> bugün bitti mi, haftalık -> son 7 gün içinde bitti mi
export const isDone = (t, today = todayKey()) => {
  if (t.repeat === 'daily') return t.lastDone === today;
  if (t.repeat === 'weekly') return !!t.lastDone && (new Date(today) - new Date(t.lastDone)) / 864e5 < 7;
  return !!t.done;
};

export const merge = (s) => ({
  ...clone(DEFAULT), ...s,
  stats: { ...DEFAULT.stats, ...s.stats },
  settings: { ...DEFAULT.settings, ...s.settings },
});

export async function loadState() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) return merge(JSON.parse(raw));
    const d = clone(DEFAULT);
    const oldTheme = await AsyncStorage.getItem('@saved_theme'); // eski sürümden taşı
    if (oldTheme && THEMES[oldTheme]) d.settings.theme = oldTheme;
    return d;
  } catch (e) {
    return clone(DEFAULT);
  }
}
export const saveState = (s) => AsyncStorage.setItem(KEY, JSON.stringify(s)).catch(() => {});

export async function saveBg(uri, old) {
  const dest = `${FS.documentDirectory}bg-${Date.now()}.jpg`;
  await FS.copyAsync({ from: uri, to: dest });
  if (old) FS.deleteAsync(old, { idempotent: true }).catch(() => {});
  return dest;
}
export const removeBg = (old) => old && FS.deleteAsync(old, { idempotent: true }).catch(() => {});

export async function exportData(state) {
  const path = `${FS.documentDirectory}moderntodo-yedek-${todayKey()}.json`;
  await FS.writeAsStringAsync(path, JSON.stringify({ ...state, settings: { ...state.settings, bg: null } }, null, 2));
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'Modern Todo' });
}

export async function importData() {
  const r = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/*', '*/*'], copyToCacheDirectory: true });
  if (r.canceled) return null;
  const j = JSON.parse(await FS.readAsStringAsync(r.assets[0].uri));
  if (!Array.isArray(j.tasks) || !j.stats) throw new Error('bad file');
  return merge(j);
}
