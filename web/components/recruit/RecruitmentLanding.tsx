"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowUpRight, Compass } from "lucide-react";
import { formatClosesAt, getPositionStatus, type Position } from "@/lib/recruitment";
import { getRoleContent } from "@/lib/recruitment-content";
import styles from "./recruitment.module.css";
import { useFormOnly } from "./useFormOnly";

export default function RecruitmentLanding() {
  const params = useSearchParams();
  const formOnly = useFormOnly();
  const preview = process.env.NODE_ENV === "development" && params.get("preview") === "1";
  const [positions, setPositions] = useState<Position[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/positions${preview ? "?preview=1" : ""}`, { signal: controller.signal })
      .then(async r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => { if (!Array.isArray(data)) throw new Error(); setPositions(data); setState("ready"); })
      .catch(() => { if (!controller.signal.aborted) setState("error"); });
    return () => controller.abort();
  }, [preview]);
  return <main className={styles.landing}>
    <nav className={styles.nav} aria-label="Recruitment"><Link href="/">Tethos</Link><Link href="/student/apply/dashboard">My applications <ArrowUpRight size={15} /></Link></nav>
    {preview && <p className={styles.notice}>Local preview · Four roles, with draft questions. Applications are not open.</p>}
    {params.get("error") === "auth" && <p role="alert" className={styles.notice}>Sign-in didn&apos;t finish. You can try again when you choose a role.</p>}
    <header className={styles.hero}>
      <p className={styles.term}>Tethos · 2026–27 recruitment</p>
      <h1>Find your place on the team.</h1>
      <p className={styles.intro}>Choose a role, sign in, and apply. Your draft saves as you go.</p>
    </header>
    <section id="roles" className={styles.roles} aria-labelledby="roles-title">
      <div className={styles.sectionHead}><h2 id="roles-title">Choose a role</h2><span>One application per role</span></div>
      {state === "loading" && <p role="status">Loading roles…</p>}
      {state === "error" && <div role="alert"><p>We couldn&apos;t load the roles. Your saved application hasn&apos;t changed.</p><button className={styles.secondary} onClick={() => location.reload()}>Try again</button></div>}
      {state === "ready" && !positions.length && <p>The next round is being prepared. Check back here for roles and dates.</p>}
      {positions.filter(p => !p.archived_at).map(p => {
        const status = getPositionStatus(p);
        return <Link key={p.id} className={styles.role} href={`/student/apply/${p.slug}${preview ? "?preview=1" : ""}`}>
          <div><h3>{p.title}</h3><p>{getRoleContent(p.slug)?.tagline ?? p.description}</p></div>
          <span className={styles.roleStatus}>{preview ? "Preview role" : status === "open" ? p.closes_at ? `Apply by ${formatClosesAt(p.closes_at)}` : "Applications open" : status === "upcoming" ? "Opening soon" : "Applications closed"}<ArrowUpRight size={20} /></span>
        </Link>;
      })}
    </section>
    <aside className={styles.explore}>
      <p>You&apos;ll need a PDF résumé (up to 2 MB) and answers to your role&apos;s questions. You can read the questions before signing in.</p>
      {!formOnly && <Link href={`/student/apply/portal${preview ? "?preview=1" : ""}`} prefetch={false}><Compass size={18} /> Explore Tethos <span>Optional village visit ↗</span></Link>}
    </aside>
    <footer className={styles.footer}><Link href="/student">Meet Tethos</Link><Link href="/student/apply/internal">Have an internal access code?</Link><a href="mailto:team@tethos.ca">Questions? Contact us</a></footer>
  </main>;
}
