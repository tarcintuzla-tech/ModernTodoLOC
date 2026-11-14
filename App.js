import React, { useState, useEffect, useRef, useMemo, useCallback, useContext, createContext } from 'react';
import {
  View, Text, TextInput, TouchableOpacity as TO, FlatList, ScrollView, Modal, Switch, Alert,
  Platform, ImageBackground, Share, Linking, KeyboardAvoidingView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { L } from './src/i18n';
import { THEMES, ACCENTS, PRIO_COLOR } from './src/themes';
import { TROPHIES, TIER, checkTrophies, levelOf, levelStart, statValue } from './src/trophies';
import { DEFAULT, clone, todayKey, isDone, loadState, saveState, saveBg, removeBg, exportData, importData } from './src/store';
import { ensurePermission, getPermStatus, syncNotifications } from './src/notify';

const Ctx = createContext(null);
const PR = { low: 0, normal: 1, high: 2 };

/* ---------- küçük UI parçaları ---------- */
const T = ({ sub, b, size = 14, s, children, ...p }) => {
  const k = useContext(Ctx);
  return <Text {...p} style={[{ color: sub ? k.sub : k.text, fontSize: size * k.f }, b && { fontWeight: '700' }, s]}>{children}</Text>;
};
const Card = ({ s, children }) => {
  const k = useContext(Ctx);
  return <View style={[{ backgroundColor: k.card, borderRadius: k.r, padding: k.pad, marginBottom: 10 }, s]}>{children}</View>;
};
const Btn = ({ onPress, children, color, s }) => {
  const k = useContext(Ctx);
  return (
    <TO onPress={onPress} activeOpacity={0.8} style={[{ backgroundColor: color || k.tint, paddingVertical: 12, paddingHorizontal: 14, borderRadius: k.r * 0.6, alignItems: 'center', marginTop: 6 }, s]}>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 * k.f }}>{children}</Text>
    </TO>
  );
};
const Chip = ({ on, onPress, children, color }) => {
  const k = useContext(Ctx);
  const c = color || k.tint;
  return (
    <TO onPress={onPress} style={{ paddingVertical: 7, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: on ? c : k.sub + '66', backgroundColor: on ? c : 'transparent' }}>
      <Text style={{ color: on ? '#fff' : k.text, fontSize: 13 * k.f }}>{children}</Text>
    </TO>
  );
};
const Chips = ({ children }) => <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 6 }}>{children}</View>;
const Row = ({ children }) => <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 6 }}>{children}</View>;
const Sec = ({ children }) => <T b size={16} s={{ marginBottom: 6 }}>{children}</T>;
const Label = ({ children }) => <T sub size={12} s={{ marginTop: 8 }}>{children}</T>;
const Inp = (p) => {
  const k = useContext(Ctx);
  return (
    <TextInput placeholderTextColor={k.sub} {...p}
      style={[{ color: k.text, backgroundColor: k.dark ? '#ffffff14' : '#00000010', borderRadius: k.r * 0.6, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 * k.f }, p.style]} />
  );
};
const Switcher = ({ value, onValueChange }) => {
  const k = useContext(Ctx);
  return <Switch value={value} onValueChange={onValueChange} trackColor={{ true: k.tint, false: '#767577' }} thumbColor="#fff" />;
};

// iOS: yerleşik kompakt seçici, Android: tarih sonra saat penceresi
function DT({ value, mode, onChange, label }) {
  const k = useContext(Ctx);
  if (Platform.OS === 'ios') {
    return <DateTimePicker value={value} mode={mode} display="compact" themeVariant={k.dark ? 'dark' : 'light'} onChange={(e, d) => d && onChange(d)} />;
  }
  const openTime = (base) => DateTimePickerAndroid.open({
    value: base, mode: 'time', is24Hour: true,
    onChange: (e, tm) => { if (e.type !== 'set') return; const f = new Date(base); f.setHours(tm.getHours(), tm.getMinutes(), 0, 0); onChange(f); },
  });
  const open = () => (mode === 'time' ? openTime(value)
    : DateTimePickerAndroid.open({ value, mode: 'date', onChange: (e, d) => e.type === 'set' && openTime(d) }));
  return <Btn onPress={open} s={{ marginTop: 0 }}>{label}</Btn>;
}

const fmtDue = (x, lang) => {
  if (!x.dueAt) return '';
  const d = new Date(x.dueAt), loc = lang === 'tr' ? 'tr-TR' : 'en-US';
  const tm = d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
  return '⏰ ' + (x.repeat ? tm : `${d.toLocaleDateString(loc, { day: 'numeric', month: 'short' })} ${tm}`);
};

/* ---------- oyunlaştırma mantığı ---------- */
// İstatistiği değiştirir, kupaları kontrol eder, yeni durumu döndürür
function award(S, mut, extra = {}, msg) {
  const st = { ...S.stats, dayCount: { ...S.stats.dayCount } };
  mut(st);
  const r = checkTrophies(st, S.unlocked);
  st.xp = r.xp;
  return { state: { ...S, ...extra, stats: st, unlocked: r.unlocked }, fresh: r.fresh, msg };
}

function completeTask(S, id) {
  const task = S.tasks.find((x) => x.id === id);
  const now = new Date(), today = todayKey(now);
  if (!task || isDone(task, today)) return { state: S };
  const gain = { low: 5, normal: 10, high: 20 }[task.priority] + (task.dueAt ? 5 : 0);
  const tasks = S.tasks.map((x) => (x.id === id ? { ...x, done: !x.repeat, lastDone: today } : x));
  return award(S, (st) => {
    st.xp += gain; st.done++;
    if (task.priority === 'high') st.doneHigh++;
    if (task.dueAt) st.doneTimed++;
    st.dayCount = st.dayCount.date === today ? { date: today, count: st.dayCount.count + 1 } : { date: today, count: 1 };
    st.bestDay = Math.max(st.bestDay, st.dayCount.count);
    if (st.lastDone !== today) {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      st.streak = st.lastDone === todayKey(y) ? st.streak + 1 : 1;
      st.lastDone = today; st.bestStreak = Math.max(st.bestStreak, st.streak);
    }
    const h = now.getHours();
    if (h < 8) st.early++;
    if (h >= 23) st.night++;
    if ([0, 6].includes(now.getDay())) st.weekend++;
    if (tasks.length >= 3 && tasks.every((x) => isDone(x, today))) st.perfectDay = 1;
  }, { tasks }, `+${gain} ${S.settings.lang === 'tr' ? 'XP kazandın' : 'XP earned'}`);
}

/* ---------- Görevler ekranı ---------- */
function Tasks({ S, act, openDraft }) {
  const k = useContext(Ctx), t = k.t, s = S.settings;
  const [f, setF] = useState('active');
  const [cat, setCat] = useState(null);
  const [q, setQ] = useState('');
  const [quick, setQuick] = useState('');
  const today = todayKey();
  const xp = S.stats.xp, lv = levelOf(xp);
  const pct = (xp - levelStart(lv)) / (levelStart(lv + 1) - levelStart(lv));

  const list = useMemo(() => {
    const end = new Date(); end.setHours(23, 59, 59, 999);
    return S.tasks.filter((x) => {
      const d = isDone(x, today);
      if (f === 'done' ? !d : d) return false;
      if (f === 'today' && x.dueAt && !x.repeat && new Date(x.dueAt) > end) return false;
      if (cat && x.cat !== cat) return false;
      if (q && !`${x.title} ${x.note || ''}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    }).sort((a, b) => (a.dueAt ? +new Date(a.dueAt) : 9e15) - (b.dueAt ? +new Date(b.dueAt) : 9e15) || PR[b.priority] - PR[a.priority]);
  }, [S.tasks, f, cat, q, today]);

  const catOf = (id) => s.cats.find((c) => c.id === id);
  const addQuick = () => { if (!quick.trim()) return; openDraft({ ...blank(s), title: quick.trim() }, true); setQuick(''); };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Row>
        <View style={{ flex: 1 }}>
          <T b size={20}>{t.hello}{s.name ? `, ${s.name}` : ''} 👋</T>
          {S.stats.streak > 0 && <T sub size={12}>🔥 {S.stats.streak} {t.streakDays}</T>}
        </View>
        <View style={{ borderWidth: 1, borderColor: '#FFD700', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 }}>
          <T b size={13} s={{ color: '#FFD700' }}>⭐ {xp} XP · {t.lvl}{lv}</T>
        </View>
      </Row>
      {s.showXp && (
        <View style={{ height: 6, borderRadius: 3, backgroundColor: k.sub + '44', marginBottom: 10 }}>
          <View style={{ height: 6, borderRadius: 3, width: `${Math.max(2, pct * 100)}%`, backgroundColor: k.tint }} />
        </View>
      )}
      <Row>
        <Inp style={{ flex: 1 }} placeholder={t.quick} value={quick} onChangeText={setQuick} onSubmitEditing={addQuick} returnKeyType="done" />
        <TO onPress={() => openDraft(blank(s))} style={{ marginLeft: 8, backgroundColor: k.tint, borderRadius: k.r * 0.6, width: 46, height: 46, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 24 }}>＋</Text>
        </TO>
      </Row>
      <Inp placeholder={'🔎 ' + t.search} value={q} onChangeText={setQ} style={{ marginBottom: 6 }} />
      <Chips>
        {['active', 'today', 'done'].map((x) => <Chip key={x} on={f === x} onPress={() => setF(x)}>{t[x]}</Chip>)}
      </Chips>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 8 }} contentContainerStyle={{ gap: 8 }}>
        <Chip on={!cat} onPress={() => setCat(null)} color={k.sub}>{t.allCats}</Chip>
        {s.cats.map((c) => <Chip key={c.id} on={cat === c.id} onPress={() => setCat(c.id)} color={k.sub}>{c.emoji} {c.name}</Chip>)}
      </ScrollView>
      <FlatList
        data={list} keyExtractor={(x) => x.id} keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<T sub s={{ textAlign: 'center', marginTop: 40 }}>{t.empty}</T>}
        renderItem={({ item }) => {
          const d = isDone(item, today), c = catOf(item.cat);
          const meta = [c && `${c.emoji} ${c.name}`, fmtDue(item, k.lang), item.repeat && `🔁 ${t[item.repeat]}`].filter(Boolean).join('  ·  ');
          return (
            <TO activeOpacity={0.85} onPress={() => openDraft(item)} style={{ backgroundColor: k.card, borderRadius: k.r, padding: k.pad, marginBottom: 10, flexDirection: 'row', alignItems: 'center', opacity: d ? 0.6 : 1 }}>
              <TO hitSlop={10} onPress={() => !d && act((st) => completeTask(st, item.id))} style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: PRIO_COLOR[item.priority], alignItems: 'center', justifyContent: 'center', backgroundColor: d ? PRIO_COLOR[item.priority] : 'transparent' }}>
                {d && <Text style={{ color: '#fff', fontWeight: '700' }}>✓</Text>}
              </TO>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <T b s={d && { textDecorationLine: 'line-through' }}>{item.title}</T>
                {!!item.note && <T sub size={12} numberOfLines={1}>{item.note}</T>}
                {!!meta && <T sub size={11} s={{ marginTop: 2 }}>{meta}</T>}
              </View>
            </TO>
          );
        }}
      />
    </View>
  );
}
const blank = (s) => ({ title: '', note: '', priority: 'normal', cat: s.cats[0]?.id, repeat: null, dueAt: null });

/* ---------- Görev ekle / düzenle ---------- */
function TaskModal({ draft, onClose, onSave, onDelete }) {
  const k = useContext(Ctx), t = k.t, cats = k.cats;
  const [d, setD] = useState(draft);
  const set = (p) => setD((x) => ({ ...x, ...p }));
  const nextHour = () => { const n = new Date(); n.setHours(n.getHours() + 1, 0, 0, 0); return n; };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#000a' }}>
        <View style={{ backgroundColor: k.bg, borderTopLeftRadius: k.r + 8, borderTopRightRadius: k.r + 8, maxHeight: '92%', padding: 16 }}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <T b size={18} s={{ marginBottom: 8 }}>{d.id ? t.editTask : t.newTask}</T>
            <Inp placeholder={t.title} value={d.title} onChangeText={(v) => set({ title: v })} autoFocus={!d.id} />
            <Inp placeholder={t.note} value={d.note} onChangeText={(v) => set({ note: v })} multiline style={{ marginTop: 8, minHeight: 60, textAlignVertical: 'top' }} />
            <Label>{t.priority}</Label>
            <Chips>{['low', 'normal', 'high'].map((p) => <Chip key={p} color={PRIO_COLOR[p]} on={d.priority === p} onPress={() => set({ priority: p })}>{t[p]}</Chip>)}</Chips>
            <Label>{t.category}</Label>
            <Chips>{cats.map((c) => <Chip key={c.id} on={d.cat === c.id} onPress={() => set({ cat: c.id })}>{c.emoji} {c.name}</Chip>)}</Chips>
            <Label>{t.repeat}</Label>
            <Chips>{[null, 'daily', 'weekly'].map((r) => <Chip key={String(r)} on={d.repeat === r} onPress={() => set({ repeat: r })}>{r ? t[r] : t.none}</Chip>)}</Chips>
            <Label>{t.when}</Label>
            {d.dueAt ? (
              <Row>
                <DT value={new Date(d.dueAt)} mode="datetime" label={fmtDue(d, k.lang)} onChange={(x) => set({ dueAt: x.toISOString() })} />
                <TO onPress={() => set({ dueAt: null })}><T s={{ color: '#FF5252' }}>{t.clearTime}</T></TO>
              </Row>
            ) : <Btn color={k.sub} onPress={() => set({ dueAt: nextHour().toISOString() })} s={{ marginTop: 0 }}>{t.addTime}</Btn>}
            <Btn onPress={() => onSave(d)} s={{ marginTop: 16 }}>{t.save}</Btn>
            {d.id && <Btn color="#FF5252" onPress={() => onDelete(d.id)}>{t.del}</Btn>}
            <Btn color={k.sub} onPress={onClose}>{t.cancel}</Btn>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ---------- Başarılar ---------- */
function Trophies({ S }) {
  const k = useContext(Ctx), t = k.t, st = S.stats, lang = k.lang;
  const have = new Set(S.unlocked);
  const tiles = [[t.sLevel, levelOf(st.xp)], [t.sXp, st.xp], [t.sStreak, `🔥${st.streak}`], [t.sBest, st.bestStreak], [t.sDone, st.done], [t.trophyCount, `${have.size}/${TROPHIES.length}`]];
  return (
    <FlatList
      data={TROPHIES} keyExtractor={(x) => x.id} contentContainerStyle={{ padding: 16 }}
      ListHeaderComponent={
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {tiles.map(([l, v]) => (
            <View key={l} style={{ width: '31.5%', backgroundColor: k.card, borderRadius: k.r, padding: 10, alignItems: 'center' }}>
              <T b size={18}>{v}</T><T sub size={11}>{l}</T>
            </View>
          ))}
        </View>
      }
      renderItem={({ item }) => {
        const got = have.has(item.id), val = Math.min(statValue(item.stat, st, st.xp), item.need), ti = TIER[item.tier];
        return (
          <View style={{ backgroundColor: k.card, borderRadius: k.r, padding: k.pad, marginBottom: 8, flexDirection: 'row', alignItems: 'center', opacity: got ? 1 : 0.5, borderWidth: got ? 1 : 0, borderColor: ti.c }}>
            <Text style={{ fontSize: 28 }}>{got ? item.icon : '🔒'}</Text>
            <View style={{ flex: 1, marginHorizontal: 12 }}>
              <T b>{item.name[lang]}</T>
              <T sub size={12}>{item.desc[lang]}</T>
              {!got && <T sub size={11}>{t.progress}: {val}/{item.need}</T>}
            </View>
            <View style={{ alignItems: 'center' }}><Text style={{ fontSize: 22 }}>{ti.e}</Text><T sub size={10}>+{ti.xp} XP</T></View>
          </View>
        );
      }}
    />
  );
}

/* ---------- Ayarlar ---------- */
function Settings({ S, act }) {
  const k = useContext(Ctx), t = k.t, s = S.settings;
  const [nm, setNm] = useState(s.name);
  const [newCat, setNewCat] = useState('');
  const [perm, setPerm] = useState('undetermined');
  useEffect(() => { getPermStatus().then(setPerm); }, []);
  const set = (p, mut = () => {}) => act((x) => award(x, mut, { settings: { ...x.settings, ...p } }));

  const pickBg = async () => {
    try {
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [9, 19], quality: 0.8 });
      if (r.canceled) return;
      const uri = await saveBg(r.assets[0].uri, s.bg);
      set({ bg: uri }, (st) => { st.bgSet = 1; });
    } catch (e) { Alert.alert('Hata', String(e.message || e)); }
  };
  const askPerm = async () => { const ok = await ensurePermission(); setPerm(ok ? 'granted' : 'denied'); if (!ok) Linking.openSettings(); };
  const doExport = async () => { try { await exportData(S); act((x) => award(x, (st) => { st.exported = 1; })); } catch (e) { Alert.alert('Hata', String(e.message || e)); } };
  const doImport = async () => {
    try {
      const imp = await importData();
      if (!imp) return;
      Alert.alert(t.importJson, t.importAsk, [{ text: t.cancel, style: 'cancel' }, {
        text: t.yes, onPress: () => { act((x) => ({ state: { ...imp, settings: { ...imp.settings, bg: x.settings.bg } } })); Alert.alert(t.importOk); },
      }]);
    } catch (e) { Alert.alert('Hata', t.importBad); }
  };
  const shareText = () => Share.share({ message: S.tasks.map((x) => `${isDone(x) ? '☑' : '☐'} ${x.title}${x.dueAt ? ` (${fmtDue(x, k.lang).replace('⏰ ', '')})` : ''}`).join('\n') || '-' });
  const doReset = () => Alert.alert(t.reset, t.resetAsk, [{ text: t.cancel, style: 'cancel' }, {
    text: t.yes, style: 'destructive', onPress: () => { removeBg(s.bg); act(() => ({ state: clone(DEFAULT) })); },
  }]);
  const addCat = () => {
    if (!newCat.trim()) return;
    set({ cats: [...s.cats, { id: 'c' + Date.now(), name: newCat.trim(), emoji: '🏷️' }] }, (st) => { st.catAdded = 1; });
    setNewCat('');
  };
  const leadLabel = (n) => (n ? `${n} ${t.min}` : t.atTime);

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <Card>
        <Sec>{t.profile}</Sec>
        <Inp placeholder={t.name} value={nm} onChangeText={setNm} onEndEditing={() => nm.trim() !== s.name && set({ name: nm.trim() }, (st) => { if (nm.trim()) st.nameSet = 1; })} />
      </Card>

      <Card>
        <Sec>{t.appearance}</Sec>
        <Label>{t.theme}</Label>
        <Chips>{Object.entries(THEMES).map(([id, th]) => <Chip key={id} on={s.theme === id} color={th.tint} onPress={() => set({ theme: id }, (st) => { st.themeChanged = 1; })}>{th.name}</Chip>)}</Chips>
        <Label>{t.accent}</Label>
        <Chips>
          <Chip on={!s.accent} onPress={() => set({ accent: null })}>{t.accentAuto}</Chip>
          {ACCENTS.map((c) => (
            <TO key={c} onPress={() => set({ accent: c }, (st) => { st.themeChanged = 1; })} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c, borderWidth: s.accent === c ? 3 : 0, borderColor: k.text }} />
          ))}
        </Chips>
        <Label>{t.fontSize}</Label>
        <Chips>{[['A-', 0.9], ['A', 1], ['A+', 1.15], ['A++', 1.3]].map(([l, v]) => <Chip key={l} on={s.font === v} onPress={() => set({ font: v })}>{l}</Chip>)}</Chips>
        <Label>{t.corners}</Label>
        <Chips>{[['▭', 6], ['▢', 16], ['◯', 26]].map(([l, v]) => <Chip key={v} on={s.radius === v} onPress={() => set({ radius: v })}>{l}</Chip>)}</Chips>
        <Row><T>{t.compact}</T><Switcher value={s.compact} onValueChange={(v) => set({ compact: v })} /></Row>
        <Row><T>{t.showXp}</T><Switcher value={s.showXp} onValueChange={(v) => set({ showXp: v })} /></Row>
        <Label>{t.bg}</Label>
        <Btn onPress={pickBg}>{t.pickBg}</Btn>
        {s.bg && (
          <>
            <Btn color="#FF5252" onPress={() => { removeBg(s.bg); set({ bg: null }); }}>{t.removeBg}</Btn>
            <Label>{t.dim}</Label>
            <Chips>{[0, 0.2, 0.4, 0.6, 0.8].map((v) => <Chip key={v} on={s.dim === v} onPress={() => set({ dim: v })}>{Math.round(v * 100)}%</Chip>)}</Chips>
          </>
        )}
      </Card>

      <Card>
        <Sec>{t.language}</Sec>
        <Chips>{[['tr', 'Türkçe'], ['en', 'English']].map(([id, l]) => <Chip key={id} on={s.lang === id} onPress={() => set({ lang: id })}>{l}</Chip>)}</Chips>
      </Card>

      <Card>
        <Sec>{t.cats}</Sec>
        <Chips>
          {s.cats.map((c) => (
            <Chip key={c.id} onPress={() => s.cats.length > 1 && set({ cats: s.cats.filter((x) => x.id !== c.id) })}>{c.emoji} {c.name}  ✕</Chip>
          ))}
        </Chips>
        <Row>
          <Inp style={{ flex: 1 }} placeholder={t.addCat} value={newCat} onChangeText={setNewCat} onSubmitEditing={addCat} />
          <TO onPress={addCat} style={{ marginLeft: 8, backgroundColor: k.tint, borderRadius: k.r * 0.6, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: 22 }}>＋</Text></TO>
        </Row>
      </Card>

      <Card>
        <Sec>{t.notifs}</Sec>
        <Row><T>{t.notifsOn}</T><Switcher value={s.notifs} onValueChange={(v) => set({ notifs: v })} /></Row>
        <Label>{t.lead}</Label>
        <Chips>{[0, 5, 15, 30, 60].map((n) => <Chip key={n} on={s.lead === n} onPress={() => set({ lead: n })}>{leadLabel(n)}</Chip>)}</Chips>
        <Row><T>{t.dailyOn}</T><Switcher value={s.dailyOn} onValueChange={(v) => set({ dailyOn: v })} /></Row>
        {s.dailyOn && (
          <Row>
            <T sub>{t.dailyAt}</T>
            <DT mode="time" value={new Date(2000, 0, 1, s.dailyHour, s.dailyMin)} label={`${String(s.dailyHour).padStart(2, '0')}:${String(s.dailyMin).padStart(2, '0')}`}
              onChange={(d) => set({ dailyHour: d.getHours(), dailyMin: d.getMinutes() })} />
          </Row>
        )}
      </Card>

      <Card>
        <Sec>{t.perm}</Sec>
        <T>{perm === 'granted' ? t.permOk : t.permNo}</T>
        {perm !== 'granted' && <Btn onPress={askPerm}>{t.permAsk}</Btn>}
        <Btn color={k.sub} onPress={() => Linking.openSettings()}>{t.openSettings}</Btn>
        <T sub size={11} s={{ marginTop: 8 }}>{t.permNote}</T>
      </Card>

      <Card>
        <Sec>{t.data}</Sec>
        <T sub size={12}>{t.localNote}</T>
        <Btn onPress={doExport}>{t.exportJson}</Btn>
        <Btn onPress={doImport}>{t.importJson}</Btn>
        <Btn color={k.sub} onPress={shareText}>{t.shareText}</Btn>
        <Btn color="#FF5252" onPress={doReset}>{t.reset}</Btn>
      </Card>

      <Btn color={k.sub} onPress={() => Alert.alert(t.dev, t.devText)} s={{ marginBottom: 30 }}>{t.dev}</Btn>
    </ScrollView>
  );
}

/* ---------- Ana uygulama ---------- */
export default function App() {
  const [S, setS] = useState(null);
  const [tab, setTab] = useState('tasks');
  const [draft, setDraft] = useState(null);
  const [toast, setToast] = useState(null);
  const SR = useRef(null), tt = useRef(null), lastKey = useRef(''), chain = useRef(Promise.resolve());

  useEffect(() => { loadState().then((s) => { SR.current = s; setS(s); ensurePermission(); }); }, []);

  useEffect(() => {
    if (!S) return;
    saveState(S);
    const s = S.settings;
    const key = JSON.stringify([S.tasks, s.notifs, s.lead, s.dailyOn, s.dailyHour, s.dailyMin, s.lang]);
    if (key !== lastKey.current) {
      lastKey.current = key;
      chain.current = chain.current.then(() => syncNotifications(S, L[s.lang]));
    }
  }, [S]);

  const act = useCallback((fn) => {
    const r = fn(SR.current);
    SR.current = r.state; setS(r.state);
    const lang = r.state.settings.lang;
    const lines = [r.msg, ...(r.fresh || []).map((x) => `🏆 ${L[lang].unlocked}: ${x.name[lang]} (+${TIER[x.tier].xp} XP)`)].filter(Boolean);
    if (lines.length) { setToast(lines.join('\n')); clearTimeout(tt.current); tt.current = setTimeout(() => setToast(null), 3500); }
  }, []);

  if (!S) return <View style={{ flex: 1, backgroundColor: '#121212' }} />;

  const s = S.settings, base = THEMES[s.theme] || THEMES.dark, t = L[s.lang];
  const k = { ...base, card: s.bg ? base.card + 'E6' : base.card, tint: s.accent || base.tint, f: s.font, r: s.radius, pad: s.compact ? 10 : 16, t, lang: s.lang, cats: s.cats };

  const openDraft = (d, quickAdd) => (quickAdd ? saveTask(d) : setDraft(d));
  async function saveTask(d) {
    if (!d.title.trim()) return Alert.alert(t.titleReq);
    const isNew = !d.id;
    const task = { ...d, id: d.id || String(Date.now()), title: d.title.trim(), note: (d.note || '').trim() };
    if (task.dueAt && s.notifs && !(await ensurePermission())) Alert.alert(t.denied);
    act((x) => award(x, (st) => {
      if (isNew) { st.created++; if (task.repeat) st.repeatCreated++; }
      if (task.note) st.notesAdded = 1;
    }, { tasks: isNew ? [...x.tasks, task] : x.tasks.map((y) => (y.id === task.id ? { ...y, ...task } : y)) }));
    setDraft(null);
  }
  const deleteTask = (id) => { act((x) => ({ state: { ...x, tasks: x.tasks.filter((y) => y.id !== id) } })); setDraft(null); };

  const tabs = [['tasks', '✅', t.tasks], ['trophies', '🏆', t.trophies], ['settings', '⚙️', t.settings]];
  const body = (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar style={k.dark ? 'light' : 'dark'} />
      <View style={{ flex: 1 }}>
        {tab === 'tasks' && <Tasks S={S} act={act} openDraft={openDraft} />}
        {tab === 'trophies' && <Trophies S={S} />}
        {tab === 'settings' && <Settings S={S} act={act} />}
      </View>
      <View style={{ flexDirection: 'row', backgroundColor: k.card, borderTopWidth: 1, borderColor: k.sub + '33' }}>
        {tabs.map(([id, e, l]) => (
          <TO key={id} onPress={() => setTab(id)} style={{ flex: 1, alignItems: 'center', paddingVertical: 8 }}>
            <Text style={{ fontSize: 20, opacity: tab === id ? 1 : 0.5 }}>{e}</Text>
            <Text style={{ fontSize: 11 * s.font, color: tab === id ? k.tint : k.sub, fontWeight: tab === id ? '700' : '400' }}>{l}</Text>
          </TO>
        ))}
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaProvider>
      <Ctx.Provider value={k}>
        {s.bg ? (
          <ImageBackground source={{ uri: s.bg }} resizeMode="cover" style={{ flex: 1, backgroundColor: k.bg }}>
            <View style={{ flex: 1, backgroundColor: `rgba(0,0,0,${s.dim})` }}>{body}</View>
          </ImageBackground>
        ) : <View style={{ flex: 1, backgroundColor: k.bg }}>{body}</View>}
        {draft && <TaskModal key={draft.id || 'new'} draft={draft} onClose={() => setDraft(null)} onSave={saveTask} onDelete={deleteTask} />}
        {toast && (
          <View pointerEvents="none" style={{ position: 'absolute', top: 50, left: 20, right: 20, backgroundColor: k.tint, borderRadius: 14, padding: 12, elevation: 10 }}>
            <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center' }}>{toast}</Text>
          </View>
        )}
      </Ctx.Provider>
    </SafeAreaProvider>
  );
}
