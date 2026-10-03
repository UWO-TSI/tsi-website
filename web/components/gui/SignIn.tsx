"use client";

/**
 * Sign-in links (specs/polish/reachability.md deliverable 3): "Sign in" anywhere in the game, the portal or the phone
 * companion goes to the sign-in entry with this page as `next` (lib/game/signIn.ts), so signing in brings you back.
 * Its own module (re-exported by the GUI sheet) so the toast lane can use it without a cycle.
 */
import { useSyncExternalStore, type ReactNode } from "react";
import { currentPlace, signInHref, splitSignIn } from "@/lib/game/signIn";
import styles from "./gui.module.css";

const onServer = () => null;
function subscribePlace(on: () => void) {
  window.addEventListener("popstate", on);
  window.addEventListener("hashchange", on);
  return () => { window.removeEventListener("popstate", on); window.removeEventListener("hashchange", on); };
}
/** The sign-in entry, back to this page after. */
export function useSignInHref(): string {
  return signInHref(useSyncExternalStore(subscribePlace, currentPlace, onServer));
}

/** "Sign in" to the sign-in entry and back here after: the words in a sentence, or a pill (`button`, an empty state's action). */
export function SignInLink({ children = "Sign in", button, className }: { children?: ReactNode; button?: boolean; className?: string }) {
  const href = useSignInHref();
  return <a href={href} className={[button ? styles.signInButton : styles.signInLink, className].filter(Boolean).join(" ")} data-sign-in="">{children}</a>;
}

/** A message whose "sign in" is the link ("Playing offline: sign in to earn the reward."); any other message as it is. */
export function SignInText({ text }: { text: string }) {
  const [before, words, after] = splitSignIn(text);
  return words === undefined ? <>{text}</> : <>{before}<SignInLink>{words}</SignInLink>{after}</>;
}
