"use client";
import { useEffect, useState } from "react";
import api from "@/lib/api";

export type PlanType = "basic" | "classic" | "vip";

export interface UserProfile {
  id: number;
  email: string;
  has_paid_classic: boolean;
  has_paid_survival: boolean;
  is_admin: boolean;
  total_points: number;
}

export function getPlanType(u: Pick<UserProfile, "has_paid_classic" | "has_paid_survival">): PlanType {
  if (u.has_paid_classic && u.has_paid_survival) return "vip";
  if (u.has_paid_classic) return "classic";
  return "basic";
}

// Module-level cache so all components in a session share one fetch
let _cache: UserProfile | null = null;
let _promise: Promise<UserProfile | null> | null = null;

function fetchUser(): Promise<UserProfile | null> {
  if (!_promise) {
    _promise = api.get<UserProfile>("/users/me")
      .then((r) => { _cache = r.data; return r.data; })
      .catch(() => null);
  }
  return _promise;
}

export function useUser() {
  const [user, setUser] = useState<UserProfile | null>(_cache);

  useEffect(() => {
    if (_cache) { setUser(_cache); return; }
    fetchUser().then((u) => { if (u) setUser(u); });
  }, []);

  return {
    user,
    planType: user ? getPlanType(user) : ("basic" as PlanType),
    isVip:     user ? getPlanType(user) === "vip"     : false,
    isClassic: user ? getPlanType(user) !== "basic"   : false,
  };
}
