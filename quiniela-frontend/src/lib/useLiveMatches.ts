import { useEffect, useRef, useState } from "react";
import api from "@/lib/api";

export interface Match {
  id: number;
  home_team: string;
  away_team: string;
  status: string;
  elapsed: number | null;
  home_score: number | null;
  away_score: number | null;
  kickoff_time: string;
  venue: string | null;
  round: string | null;
  group_name: string | null;
}

const LIVE_STATUSES = new Set(["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT", "SUSP", "IN_PLAY", "PAUSED"]);

export const isLive = (status: string) => LIVE_STATUSES.has(status);
export const hasLiveMatches = (matches: Match[]) => matches.some((m) => isLive(m.status));

/**
 * Hook de polling inteligente:
 * - 30 s cuando hay partidos en vivo, 60 s en idle
 * - Se pausa cuando la pestaña queda oculta (Page Visibility API)
 * - Refetch inmediato al recuperar el foco
 * - Sin stale closures: usa refs para las callbacks recursivas
 */
export function useLiveMatches(
  endpoint: string,
  options?: {
    /** Intervalo cuando hay partidos en vivo (ms). Default: 30 000 */
    liveMs?: number;
    /** Intervalo sin partidos en vivo (ms). Default: 60 000 */
    idleMs?: number;
  }
): { matches: Match[]; isRefreshing: boolean } {
  const liveMs = options?.liveMs ?? 30_000;
  const idleMs = options?.idleMs ?? 60_000;

  const [matches, setMatches] = useState<Match[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Refs viven fuera del closure de setTimeout, siempre apuntan a la versión fresca
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLiveRef = useRef(false);
  const liveMsRef  = useRef(liveMs);
  const idleMsRef  = useRef(idleMs);
  const endpointRef = useRef(endpoint);

  // Sync options a refs en cada render sin relanzar efectos
  liveMsRef.current  = liveMs;
  idleMsRef.current  = idleMs;
  endpointRef.current = endpoint;

  // doFetch y scheduleNext viven en refs para evitar stale closures en setTimeout
  const doFetch      = useRef<(spinner?: boolean) => Promise<void>>(undefined!);
  const scheduleNext = useRef<() => void>(undefined!);

  doFetch.current = async (spinner = true) => {
    if (typeof document !== "undefined" && document.hidden) return;
    if (spinner) setIsRefreshing(true);
    try {
      const { data } = await api.get<Match[]>(endpointRef.current);
      hasLiveRef.current = data.some((m) => LIVE_STATUSES.has(m.status));
      setMatches(data);
    } catch {
      // silencioso — no interrumpir la UX por errores de red en polling
    } finally {
      if (spinner) setIsRefreshing(false);
    }
  };

  scheduleNext.current = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const delay = hasLiveRef.current ? liveMsRef.current : idleMsRef.current;
    timerRef.current = setTimeout(async () => {
      await doFetch.current!(false);
      scheduleNext.current!();
    }, delay);
  };

  // Arranque inicial + limpieza al desmontar
  useEffect(() => {
    doFetch.current!(true).then(() => scheduleNext.current!());
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  // endpoint es la única dependencia real — cambiar endpoint relanza el ciclo
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  // Page Visibility API: pausar cuando la pestaña queda oculta
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        if (timerRef.current) clearTimeout(timerRef.current);
      } else {
        doFetch.current!(false).then(() => scheduleNext.current!());
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Refetch inmediato al ganar foco (equivalente a revalidateOnFocus de SWR)
  useEffect(() => {
    const onFocus = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      doFetch.current!(false).then(() => scheduleNext.current!());
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  return { matches, isRefreshing };
}
