// Every server-side Supabase call gets a ceiling. Without it a stalled
// database (2026-09-18: the free-tier instance was IO-starved for hours)
// makes API routes hang until Vercel's 300 s limit, and every page that
// waits on them spins forever. Failing in 20 s lets routes return an error
// the UI already knows how to show ("couldn't load, try again").
export const SUPABASE_FETCH_TIMEOUT_MS = 20_000;

export const fetchWithTimeout: typeof fetch = (input, init) =>
  fetch(input, {
    ...init,
    signal: init?.signal
      ? AbortSignal.any([init.signal, AbortSignal.timeout(SUPABASE_FETCH_TIMEOUT_MS)])
      : AbortSignal.timeout(SUPABASE_FETCH_TIMEOUT_MS),
  });
