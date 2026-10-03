/**
 * Sign-in links (specs/polish/reachability.md deliverable 3): every "Sign in…" the game says links to the sign-in
 * entry with the place you were as `next`, so signing in brings you straight back. The entry is the game portal's
 * login, /student (GamePortalLogin, Google first): it hands a safe `next` to /student/go, which sends you there once
 * you're in (and the middleware sends a visitor already signed in on to /student/go with it).
 */
import { sameOriginPath } from "@/lib/recruitment-access";

export const SIGN_IN = "/student";
/** Pages that would bounce straight back to sign-in: never a `next` (the same rule as /student/go's). */
const ENTRY = /^\/student(\/(go|login|signup))?\/?$/;

/** The sign-in entry, coming back to `place` (a same-site path with its query and hash) after. */
export function signInHref(place: string | null | undefined): string {
  const safe = sameOriginPath(place ?? null);
  if (!safe || ENTRY.test(new URL(safe, "https://tethos.invalid").pathname)) return SIGN_IN;
  return `${SIGN_IN}?next=${encodeURIComponent(safe)}`;
}
/** Where you are now, in the browser (null on the server). */
export const currentPlace = () => (typeof window === "undefined" ? null : `${window.location.pathname}${window.location.search}${window.location.hash}`);

const WORDS = /\bsign in\b/i;
/** A message that asks you to sign in (its words become the link). */
export const mentionsSignIn = (text: string) => WORDS.test(text);
/** A message around its first "sign in": [before, the words, after], or the message alone. */
export function splitSignIn(text: string): string[] {
  const m = WORDS.exec(text);
  return m ? [text.slice(0, m.index), m[0], text.slice(m.index + m[0].length)] : [text];
}
