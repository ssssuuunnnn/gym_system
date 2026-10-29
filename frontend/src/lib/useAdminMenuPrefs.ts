import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMe } from '../api/users';

/** 側欄「最近使用」顯示幾項 */
export const RECENT_MENU_LIMIT = 5;
// 多記幾筆：釘選或沒權限的項目會被濾掉，濾完還要湊得滿 5 項
const RECENT_KEEP = 15;

interface MenuPrefs {
  /** 釘選的選單 key，依釘選先後 */
  pinned: string[];
  /** 最近用過的選單 key，最新的在前 */
  recent: string[];
}

const EMPTY: MenuPrefs = { pinned: [], recent: [] };

function read(storageKey: string | null): MenuPrefs {
  if (!storageKey) return EMPTY;
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
    return { pinned: list(raw?.pinned), recent: list(raw?.recent) };
  } catch {
    return EMPTY;
  }
}

function write(storageKey: string | null, prefs: MenuPrefs) {
  if (!storageKey) return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(prefs));
  } catch {
    // 無痕視窗或封鎖網站資料：這次只記在畫面上
  }
}

/**
 * 後台側欄的釘選與最近使用。存在這台電腦的瀏覽器，依「健身房網址＋帳號」分開記，
 * 同一台電腦換人登入不會混在一起。只存選單 key；顯示前由呼叫端再依權限過濾。
 */
export function useAdminMenuPrefs() {
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: getMe, staleTime: 30_000 });
  const storageKey = me ? `adminMenu:${window.location.hostname}:${me.id}` : null;
  const [prefs, setPrefs] = useState<MenuPrefs>(() => read(storageKey));
  const [loadedKey, setLoadedKey] = useState(storageKey);

  // 帳號載入完成（或換帳號）時改讀那個帳號的紀錄
  if (loadedKey !== storageKey) {
    setLoadedKey(storageKey);
    setPrefs(read(storageKey));
  }

  useEffect(() => write(storageKey, prefs), [storageKey, prefs]);

  const touch = useCallback(
    (key: string) =>
      setPrefs((p) => (p.recent[0] === key ? p : { ...p, recent: [key, ...p.recent.filter((k) => k !== key)].slice(0, RECENT_KEEP) })),
    [],
  );
  const togglePin = useCallback(
    (key: string) =>
      setPrefs((p) => ({ ...p, pinned: p.pinned.includes(key) ? p.pinned.filter((k) => k !== key) : [...p.pinned, key] })),
    [],
  );

  return { ready: storageKey !== null, pinned: prefs.pinned, recent: prefs.recent, touch, togglePin };
}
