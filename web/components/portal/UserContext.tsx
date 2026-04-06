"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Profile } from "@/lib/supabase/types";

interface UserContextValue {
  profile: Partial<Profile> | null;
  loading: boolean;
  refetch: () => void;
}

const UserContext = createContext<UserContextValue>({ profile: null, loading: true, refetch: () => {} });

export function useUser() {
  return useContext(UserContext);
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Partial<Profile> | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = () => {
    fetch("/api/profile")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setProfile(d?.profile ?? d ?? null))
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchProfile(); }, []);

  return (
    <UserContext.Provider value={{ profile, loading, refetch: fetchProfile }}>
      {children}
    </UserContext.Provider>
  );
}
