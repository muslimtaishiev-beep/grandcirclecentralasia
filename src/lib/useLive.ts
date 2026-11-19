import { useEffect, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import type { LiveMark, LiveTopic } from '../shared/live';

/**
 * Фоновое слежение за лентой изменений организации (live/{tenantId}).
 * Одна подписка на организацию, сколько бы экранов её ни слушали.
 * Оборвалась — переподключается сама; вкладка вернулась из фона или
 * появилась сеть — экраны перезапрашивают данные (за время сна могли
 * пропустить изменения).
 *
 * Колбэк получает отметку изменения или null — «обнови всё».
 */
type Cb = (m: LiveMark | null) => void;
interface Listener { topics: LiveTopic[]; cb: Cb; timer?: ReturnType<typeof setTimeout> }
interface Feed {
  listeners: Set<Listener>;
  last: Partial<Record<LiveTopic, number>>;
  ready: boolean;
  unsub: (() => void) | null;
  retry: number;
  retryTimer?: ReturnType<typeof setTimeout>;
}

const TOPICS: LiveTopic[] = ['admissions', 'exams'];
const BACKOFF = [2_000, 5_000, 15_000, 30_000];
const feeds = new Map<string, Feed>();

/** Несколько изменений подряд (ученик листает разделы) — один перезапрос. */
function emit(l: Listener, m: LiveMark | null) {
  if (l.timer) clearTimeout(l.timer);
  l.timer = setTimeout(() => { l.timer = undefined; l.cb(m); }, 400);
}

function connect(tenantId: string, f: Feed) {
  f.unsub?.();
  f.retryTimer = undefined;
  f.unsub = onSnapshot(doc(db, 'live', tenantId), snap => {
    f.retry = 0;
    const d = (snap.data() || {}) as Partial<Record<LiveTopic, LiveMark>>;
    const wasReady = f.ready;
    f.ready = true;
    for (const topic of TOPICS) {
      const m = d[topic];
      if (!m?.at) continue;
      const prev = f.last[topic];
      f.last[topic] = m.at;
      // Первый снимок — точка отсчёта; после переподключения пропущенное тоже придёт.
      if (!wasReady || (prev !== undefined && m.at <= prev)) continue;
      f.listeners.forEach(l => { if (l.topics.includes(topic)) emit(l, m); });
    }
  }, err => {
    console.warn('live:', err.message);
    f.unsub = null;
    if (f.retryTimer) clearTimeout(f.retryTimer);
    f.retryTimer = setTimeout(() => { if (f.listeners.size) connect(tenantId, f); }, BACKOFF[Math.min(f.retry++, BACKOFF.length - 1)]);
  });
}

let hiddenAt = 0;
function wake() {
  feeds.forEach((f, t) => {
    if (!f.unsub && f.listeners.size) { if (f.retryTimer) clearTimeout(f.retryTimer); f.retry = 0; connect(t, f); }
    f.listeners.forEach(l => emit(l, null));
  });
}
if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    // Короткий уход (переключился на секунду) — подписка жива, перезапрос не нужен.
    if (hiddenAt && Date.now() - hiddenAt > 20_000) wake();
    hiddenAt = 0;
  });
  window.addEventListener('online', wake);
}

function subscribe(tenantId: string, topics: LiveTopic[], cb: Cb): () => void {
  let f = feeds.get(tenantId);
  if (!f) { f = { listeners: new Set(), last: {}, ready: false, unsub: null, retry: 0 }; feeds.set(tenantId, f); }
  const l: Listener = { topics, cb };
  f.listeners.add(l);
  if (!f.unsub && !f.retryTimer) connect(tenantId, f);
  return () => {
    if (l.timer) clearTimeout(l.timer);
    f!.listeners.delete(l);
    if (!f!.listeners.size) {
      f!.unsub?.();
      if (f!.retryTimer) clearTimeout(f!.retryTimer);
      feeds.delete(tenantId);
    }
  };
}

/** Перезапросить данные экрана, когда в организации меняется нужная тема. */
export function useLive(tenantId: string | undefined, topics: LiveTopic[], cb: Cb) {
  const ref = useRef(cb);
  ref.current = cb;
  const key = topics.join(',');
  useEffect(() => {
    if (!tenantId) return;
    return subscribe(tenantId, key.split(',') as LiveTopic[], m => ref.current(m));
  }, [tenantId, key]);
}
