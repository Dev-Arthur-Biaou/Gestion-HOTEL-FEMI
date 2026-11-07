import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { api, errorMessage } from "@/lib/client";

export function useResource<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(
    async (silent = false) => {
      if (!path) {
        setData(null);
        setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      try {
        const result = await api<T>(path);
        if (mounted.current) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (mounted.current) setError(errorMessage(err));
      } finally {
        if (mounted.current) setLoading(false);
      }
    },
    [path],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return { data, setData, loading, error, reload: load };
}

/* ---- Préférences locales (vues enregistrées), synchronisées sans effet de bord ---- */

const listeners = new Map<string, Set<() => void>>();
const cache = new Map<string, { raw: string | null; value: unknown }>();

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function useLocalState<T>(key: string, initial: T) {
  const initialRef = useRef(initial);

  const subscribe = useCallback(
    (onChange: () => void) => {
      const set = listeners.get(key) ?? new Set<() => void>();
      set.add(onChange);
      listeners.set(key, set);
      const onStorage = (event: StorageEvent) => {
        if (event.key === key) onChange();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        set.delete(onChange);
        window.removeEventListener("storage", onStorage);
      };
    },
    [key],
  );

  const getSnapshot = useCallback((): T => {
    const raw = readRaw(key);
    const cached = cache.get(key);
    if (cached && cached.raw === raw) return cached.value as T;
    let value = initialRef.current;
    if (raw) {
      try {
        value = JSON.parse(raw) as T;
      } catch {
        value = initialRef.current;
      }
    }
    cache.set(key, { raw, value });
    return value;
  }, [key]);

  const getServerSnapshot = useCallback(() => initialRef.current, []);
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const update = useCallback(
    (next: T) => {
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* stockage indisponible : la valeur reste en mémoire */
      }
      cache.delete(key);
      listeners.get(key)?.forEach((onChange) => onChange());
    },
    [key],
  );

  return [value, update] as const;
}
