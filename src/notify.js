import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { isDone } from './store';

const TT = Notifications.SchedulableTriggerInputTypes;

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export async function ensurePermission() {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('tasks', {
        name: 'Tasks', importance: Notifications.AndroidImportance.MAX, vibrationPattern: [0, 250, 250, 250], lightColor: '#6C63FF',
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
    return status === 'granted';
  } catch (e) {
    return false;
  }
}
export const getPermStatus = async () => (await Notifications.getPermissionsAsync()).status;

// Tüm bildirimleri görevlerin güncel durumuna göre yeniden kurar (basit ve tutarlı)
export async function syncNotifications(S, t) {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    const s = S.settings;
    if (!s.notifs || (await getPermStatus()) !== 'granted') return;
    const now = Date.now();
    for (const task of S.tasks) {
      if (!task.dueAt || isDone(task)) continue;
      const when = new Date(new Date(task.dueAt).getTime() - s.lead * 60000);
      let trigger;
      if (task.repeat === 'daily') trigger = { type: TT.DAILY, hour: when.getHours(), minute: when.getMinutes(), channelId: 'tasks' };
      else if (task.repeat === 'weekly') trigger = { type: TT.WEEKLY, weekday: when.getDay() + 1, hour: when.getHours(), minute: when.getMinutes(), channelId: 'tasks' };
      else if (when.getTime() > now) trigger = { type: TT.DATE, date: when, channelId: 'tasks' };
      else continue;
      await Notifications.scheduleNotificationAsync({
        identifier: task.id,
        content: { title: s.lead ? t.notifSoon : t.notifNow, body: task.note ? `${task.title}\n${task.note}` : task.title, sound: true },
        trigger,
      });
    }
    if (s.dailyOn) {
      await Notifications.scheduleNotificationAsync({
        identifier: 'daily-reminder',
        content: { title: t.dailyTitle, body: t.dailyBody, sound: true },
        trigger: { type: TT.DAILY, hour: s.dailyHour, minute: s.dailyMin, channelId: 'tasks' },
      });
    }
  } catch (e) {
    console.log('Bildirim senkron hatası:', e);
  }
}
