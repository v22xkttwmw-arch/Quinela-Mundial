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
}

const LIVE_STATUSES = new Set(["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT", "SUSP"]);

export const isLive = (status: string) => LIVE_STATUSES.has(status);
export const hasLiveMatches = (matches: Match[]) => matches.some((m) => isLive(m.status));

export function useLiveMatches(endpoint: string, intervalMs = 60_000): {
  matches: Match[];
  isRefreshing: boolean;
  setMatches: React.Dispatch<React.SetStateAction<Match[]>>;
} {
  const [matches, setMatches] = useState<Match[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearPoll = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const startPoll = () => {
    clearPoll();
    intervalRef.current = setInterval(async () => {
      try {
        setIsRefreshing(true);
        const { data } = await api.get<Match[]>(endpoint);
        setMatches(data);
      } catch {
        // silently ignore network errors during polling
      } finally {
        setIsRefreshing(false);
      }
    }, intervalMs);
  };

  // Initial fetch
  useEffect(() => {
    api.get<Match[]>(endpoint).then(({ data }) => setMatches(data));
    return clearPoll;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  // Start/stop polling based on live matches
  useEffect(() => {
    if (hasLiveMatches(matches)) {
      startPoll();
    } else {
      clearPoll();
    }
    return clearPoll;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches]);

  return { matches, isRefreshing, setMatches };
}
