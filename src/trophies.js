export const levelOf = (xp) => Math.floor(Math.sqrt(xp / 40)) + 1;
export const levelStart = (l) => 40 * (l - 1) * (l - 1);

export const TIER = {
  bronze: { e: '🥉', xp: 25, c: '#CD7F32' },
  silver: { e: '🥈', xp: 50, c: '#B0B7C3' },
  gold: { e: '🥇', xp: 100, c: '#FFD700' },
  diamond: { e: '💎', xp: 200, c: '#4FC3F7' },
};
const TN = ['bronze', 'silver', 'gold', 'diamond'];

const series = (stat, icon, steps, name, desc) =>
  steps.map((n, i) => ({
    id: `${stat}_${n}`, stat, need: n, icon, tier: TN[Math.floor((i * 4) / steps.length)],
    name: { tr: `${name[0]} ${n}`, en: `${name[1]} ${n}` },
    desc: { tr: desc[0].replace('{n}', n), en: desc[1].replace('{n}', n) },
  }));
const one = (stat, icon, name, desc) => ({
  id: stat, stat, need: 1, icon, tier: 'silver',
  name: { tr: name[0], en: name[1] }, desc: { tr: desc[0], en: desc[1] },
});

export const TROPHIES = [
  ...series('done', '✅', [1, 5, 10, 25, 50, 100, 250, 500, 1000], ['Görev Avcısı', 'Task Hunter'], ['{n} görev tamamla', 'Complete {n} tasks']),
  ...series('xp', '⭐', [100, 500, 1000, 2500, 5000, 10000], ['XP Koleksiyoncusu', 'XP Collector'], ['{n} XP topla', 'Earn {n} XP']),
  ...series('level', '🚀', [2, 5, 10, 15, 20, 30], ['Seviye Atlayıcı', 'Level Up'], ['{n}. seviyeye ulaş', 'Reach level {n}']),
  ...series('bestStreak', '🔥', [3, 7, 14, 30, 60, 100], ['Seri Ustası', 'Streak Master'], ['{n} gün üst üste görev tamamla', 'Complete tasks {n} days in a row']),
  ...series('doneHigh', '❗', [5, 25, 100], ['Önemli İşler', 'High Priority'], ['{n} yüksek öncelikli görev bitir', 'Finish {n} high priority tasks']),
  ...series('doneTimed', '⏰', [5, 25, 100], ['Zaman Yönetimi', 'Time Keeper'], ['{n} saatli görev bitir', 'Finish {n} timed tasks']),
  ...series('bestDay', '⚡', [3, 5, 10], ['Verimli Gün', 'Productive Day'], ['Bir günde {n} görev bitir', 'Finish {n} tasks in one day']),
  ...series('created', '📝', [10, 50, 200], ['Planlayıcı', 'Planner'], ['{n} görev oluştur', 'Create {n} tasks']),
  ...series('repeatCreated', '🔁', [1, 10], ['Alışkanlık', 'Habit'], ['{n} tekrarlayan görev oluştur', 'Create {n} repeating tasks']),
  one('early', '🐦', ['Erken Kuş', 'Early Bird'], ['Sabah 08:00’den önce görev bitir', 'Finish a task before 8 AM']),
  one('night', '🦉', ['Gece Kuşu', 'Night Owl'], ['Gece 23:00’ten sonra görev bitir', 'Finish a task after 11 PM']),
  one('weekend', '🏖️', ['Hafta Sonu Savaşçısı', 'Weekend Warrior'], ['Hafta sonu görev bitir', 'Finish a task on a weekend']),
  one('perfectDay', '🌟', ['Kusursuz Gün', 'Perfect Day'], ['Günün tüm görevlerini bitir (en az 3)', 'Clear all tasks in a day (min 3)']),
  one('bgSet', '🖼️', ['Sanatçı', 'Artist'], ['Kendi arka plan fotoğrafını ayarla', 'Set your own background']),
  one('themeChanged', '🎨', ['Stilist', 'Stylist'], ['Tema veya vurgu rengini değiştir', 'Change theme or accent color']),
  one('exported', '💾', ['Yedekçi', 'Backup Hero'], ['Verilerini dışa aktar', 'Export your data']),
  one('nameSet', '👋', ['Tanışalım', 'Nice to Meet You'], ['Adını ayarla', 'Set your name']),
  one('notesAdded', '🗒️', ['Not Defteri', 'Notebook'], ['Bir göreve not ekle', 'Add a note to a task']),
  one('catAdded', '🏷️', ['Kategori Kaşifi', 'Category Explorer'], ['Kendi kategorini ekle', 'Add your own category']),
];

export const statValue = (stat, st, xp) => (stat === 'level' ? levelOf(xp) : stat === 'xp' ? xp : st[stat] || 0);

// Yeni kazanılan kupaları bulur, bonus XP'yi ekler (zincirleme açılabilir)
export function checkTrophies(stats, unlocked) {
  let xp = stats.xp;
  const have = new Set(unlocked);
  const fresh = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const t of TROPHIES) {
      if (have.has(t.id)) continue;
      if (statValue(t.stat, stats, xp) >= t.need) {
        have.add(t.id); fresh.push(t); xp += TIER[t.tier].xp; changed = true;
      }
    }
  }
  return { xp, fresh, unlocked: [...have] };
}
