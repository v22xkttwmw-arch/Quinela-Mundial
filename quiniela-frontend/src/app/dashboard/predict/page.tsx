"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { PredictorFluido, type ClassicPredictionData } from "@/components/dashboard/PredictorFluido";

export default function PredictPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [savedData, setSavedData] = useState<ClassicPredictionData | null>(null);

  useEffect(() => {
    api.get("/users/me")
      .then((res) => {
        if (!res.data.has_paid_classic) return;
        // Pre-fetch saved prediction so PredictorFluido doesn't need its own fetch
        return api.get<ClassicPredictionData>("/predictions/classic")
          .then((r) => setSavedData(r.data))
          .catch(() => {}); // 404 = no prediction yet — start fresh
      })
      .catch((err) => {
        if (err?.response?.status === 401) return; // guest — show teaser board
        router.push("/login");
      })
      .finally(() => setIsLoading(false));
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-700 border-t-blue-400" />
      </div>
    );
  }

  // Pass savedData (may be null if first-time/free/guest user) — PredictorFluido handles all cases
  return <PredictorFluido initialData={savedData ?? undefined} />;
}
