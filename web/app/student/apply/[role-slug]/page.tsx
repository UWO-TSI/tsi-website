"use client";

import DeveloperProjects from "@/components/recruit/DeveloperProjects";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import ApplicationForm from "@/components/recruit/ApplicationForm";
import AuthModal from "@/components/recruit/AuthModal";
import { createClient } from "@/lib/supabase/client";
import { getPositionStatus, formatClosesAt, type Position } from "@/lib/recruitment";
import { getRoleContent } from "@/lib/recruitment-content";
import styles from "@/components/recruit/recruitment.module.css";

export default function RoleApplicationPage() {
  return <Suspense fallback={<p className="p-12" role="status">Loading role…</p>}><RoleApplication /></Suspense>;
}

function RoleApplication() {
  const slug = useParams()["role-slug"] as string;
  const params = useSearchParams();
  const preview = process.env.NODE_ENV === "development" && params.get("preview") === "1";
  const [position, setPosition] = useState<Position | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [showAuth, setShowAuth] = useState(false);
  const [supabase] = useState(() => createClient());
  const allRoles = `/student/apply${preview ? "?preview=1" : ""}`;

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    async function load() {
      let internalCode: string | null = null;
      try { internalCode = sessionStorage.getItem("tethos:internal-code"); } catch { /* Storage may be unavailable. */ }
      const query = preview ? "?preview=1" : internalCode ? `?code=${encodeURIComponent(internalCode)}` : "";
      try {
        const [response, auth] = await Promise.all([
          fetch(`/api/positions${query}`, { signal: controller.signal }),
          preview ? Promise.resolve({ data: { user: null } }) : supabase.auth.getUser(),
        ]);
        if (!response.ok) throw new Error("Roles unavailable");
        const positions: Position[] = await response.json();
        const found = positions.find(p => p.slug === slug && !p.archived_at) ?? null;
        let alreadySubmitted = false;
        if (auth.data.user && found) {
          const { data, error } = await supabase.from("applications").select("id")
            .eq("user_id", auth.data.user.id).eq("position_id", found.id).maybeSingle();
          if (error) throw error;
          alreadySubmitted = !!data;
        }
        if (alive) { setPosition(found); setUser(auth.data.user); setSubmitted(alreadySubmitted); setState("ready"); }
      } catch { if (alive && !controller.signal.aborted) setState("error"); }
    }
    load();
    return () => { alive = false; controller.abort(); };
  }, [preview, slug, supabase]);

  const content = position ? getRoleContent(position.slug) : null;
  const status = position ? getPositionStatus(position) : null;
  return <main className={`${styles.landing} ${styles.rolePage}`}>
    <nav className={styles.nav} aria-label="Recruitment"><Link href={allRoles}>← All roles</Link><Link href="/student/apply/dashboard">My applications ↗</Link></nav>
    {state === "loading" && <p role="status">Loading role…</p>}
    {state === "error" && <div role="alert"><h1>We couldn’t load this role.</h1><p>Your saved application hasn’t changed.</p><button className={styles.secondary} onClick={() => location.reload()}>Try again</button></div>}
    {state === "ready" && !position && <><h1>Role not found</h1><p>This posting may no longer be available. <Link href={allRoles}>Browse all roles</Link>.</p></>}
    {state === "ready" && position && <>
      {preview && <p className={styles.notice}>Local draft preview · Application dates are being prepared. Submissions are disabled.</p>}
      <header className={styles.hero}>
        <p className={styles.term}>Tethos · Recruitment{!preview && position.closes_at ? ` · Closes ${formatClosesAt(position.closes_at)}` : ""}</p>
        <h1>{position.title}</h1>{content?.positionsCount && <p className={styles.hiring}>Hiring {content.positionsCount} {position.slug.startsWith("director-") ? "Directors" : "positions"}</p>}<p className={styles.intro}>{content?.tagline ?? position.description}</p>
      </header>
      <section className={styles.applyStart} aria-label="Start your application">
        {submitted ? <Link className={styles.startButton} href="/student/apply/dashboard">View your submitted application ↗</Link>
          : preview ? <p>Preview the role and questions below. Applications will open when the round is ready.</p>
          : status !== "open" ? <p>{status === "upcoming" ? "Applications for this role open soon." : "This role is not currently accepting applications."}</p>
          : !user ? <><button className={styles.startButton} onClick={() => setShowAuth(true)}>Sign in to apply →</button><p>Continue with Google or email. You’ll return straight to this application.</p></>
          : <><h2>Your application</h2><p>Your draft saves as you go. You can leave and come back to this role.</p></>}
      </section>
      {user && status === "open" && !submitted && !preview && <ApplicationForm key={position.id} position={position} userId={user.id} />}
      {position.slug === "developer" && !(user && status === "open" && !submitted && !preview) && <DeveloperProjects />}
      <details className={styles.roleDetails} open={!user || preview}>
        <summary>About this role</summary>
        {content ? <>
          {content.overview && <><h2>Portfolio overview{content.draftOverview ? " · Draft" : ""}</h2><p>{content.overview}</p></>}
          {content.howItWorks && <><h2>{content.howItWorks.title}</h2>{content.howItWorks.paragraphs.map(p => <p key={p}>{p}</p>)}</>}
          {content.preApplyNote && <p>{content.preApplyNote}</p>}
          {content.whatYoullDo.length > 0 && <><h2>Key responsibilities</h2><ul>{content.whatYoullDo.map(item => <li key={item}>{item}</li>)}</ul></>}
          <h2>What we look for</h2><ul>{content.whoYouAre.map(item => <li key={item}>{item}</li>)}</ul>
          {content.about && <><h2>{content.about.title}</h2><p>{content.about.body}</p>{content.about.subtitle && <h3>{content.about.subtitle}</h3>}{content.about.stats && <ul>{content.about.stats.map(item => <li key={item}>{item}</li>)}</ul>}{content.about.link && <a href={content.about.link.href}>{content.about.link.label} ↗</a>}</>}
          {content.applyInstructions && <p>{content.applyInstructions}</p>}
        </> : <p>{position.description}</p>}
      </details>
      <details className={styles.roleDetails} open={!user || preview}>
        <summary>{position.essay_questions.length ? `What you’ll need · ${position.essay_questions.length} ${position.essay_questions.length === 1 ? "question" : "questions"}` : "Questions being prepared"}</summary>
        {position.essay_questions.length > 0 ? <p>Your contact details, program and year, a PDF résumé (up to 2 MB), and answers to these questions:</p> : <p>This role’s application questions haven’t been added yet.</p>}
        <ol>{position.essay_questions.map(q => <li key={q.id}>{q.question}<small>{q.response_type === "url" ? "Link" : `Up to ${q.max_words} words`}{q.required === false ? " · Optional" : ""}</small></li>)}</ol>
        {position.essay_questions.some(q => q.response_type === "url") && <p>Make sure any links you share are viewable by the team.</p>}
      </details>
      {!user && !preview && status === "open" && <button className={styles.startButton} onClick={() => setShowAuth(true)}>Sign in to apply →</button>}
    </>}
    <footer className={styles.footer}><Link href={allRoles}>Browse roles</Link><a href="mailto:team@tethos.ca">Questions? Contact us</a></footer>
    <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} redirectTo={`/student/apply/${slug}`} />
  </main>;
}
