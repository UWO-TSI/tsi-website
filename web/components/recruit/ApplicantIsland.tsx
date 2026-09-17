"use client";

import { Component, useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { MotionConfig, useReducedMotion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { isPositionOpen, type Position } from "@/lib/recruitment";
import { getRoleContent } from "@/lib/recruitment-content";
import { AudioManager } from "@/lib/game/audio";
import { useAmbientAudio, useAudioState } from "@/lib/game/useAudio";
import { useGraphicsSettings } from "@/lib/game/useGraphicsSettings";
import { isGameControlTarget } from "@/lib/game/keyboardInput";
import type { VillageAction } from "./ApplicantWorld";
import ApplicationForm, { type ApplicationFormHandle } from "./ApplicationForm";
import { ApplicationSheet, WantedPosting, TutorialChecklist, NPCDialogue } from "./ui";
import AuthModal from "./AuthModal";
import RecruitmentLanding from "./RecruitmentLanding";
import styles from "./island.module.css";
import { useApplicantDayPhase } from "./RecruitmentAppearance";
import ApplicantLoading from "./ApplicantLoading";
import appearanceStyles from "./appearance.module.css";
import PreviewCompletion from "./PreviewCompletion";
import CharacterSetup from "./CharacterSetup";
import { ApplicantAppearanceContext, DEFAULT_APPEARANCE, parseAppearance } from "@/lib/game/applicantAppearance";
import FishingOverlay from "@/components/game/FishingOverlay";
import ToastHub from "@/components/game/ToastHub";
import CollectionBook from "@/components/game/CollectionBook";
import { pickFlower as markFlowerPicked, subscribeFlowerPicks, getPickedSnapshot, getPickedServerSnapshot } from "@/lib/game/flowerPicks";
import { ISLAND_FLOWERS } from "@/lib/game/applicantVillage";
import DeveloperProjects from "./DeveloperProjects";
import { useFormOnly } from "./useFormOnly";

const Scene = dynamic(() => import("./ApplicantWorld"), { ssr: false });
const ACTION_LABELS = { flower: "Pick a flower", fish: "Go fishing", guide: "Talk to Jayden", enter: "Enter TSI HQ", board: "Read recruitment board", exit: "Return to village" };
class IslandBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}
type Panel = "welcome" | "guide" | "board" | "role" | "menu" | null;

export default function ApplicantIsland() {
  const params = useSearchParams();
  const preview = process.env.NODE_ENV === "development" && params.get("preview") === "1";
  const compact = useFormOnly();
  const [ready, setReady] = useState(false), [failed, setFailed] = useState(false);
  const [positions, setPositions] = useState<Position[]>([]), [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [near, setNear] = useState<VillageAction>(null), [selected, setSelected] = useState<number | null>(null);
  const [inside, setInside] = useState(false), [returned, setReturned] = useState(false), [transitioning, setTransitioning] = useState(false);
  const [appearance, setAppearance] = useState(DEFAULT_APPEARANCE);
  const [avatarLoaded, setAvatarLoaded] = useState(false), [customizing, setCustomizing] = useState(false), [arrival, setArrival] = useState(false);
  const pickedFlowers = useSyncExternalStore(subscribeFlowerPicks, getPickedSnapshot, getPickedServerSnapshot);
  const [nearFlower, setNearFlower] = useState<number | null>(null);
  const [bagOpen, setBagOpen] = useState(false);
  const [fishing, setFishing] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [applying, setApplying] = useState(false), [showAuth, setShowAuth] = useState(false), [user, setUser] = useState<User | null>(null);
  const [authLoaded, setAuthLoaded] = useState(preview);
  const phase = useApplicantDayPhase();
  const reducedMotion = useReducedMotion();
  const lightPreview = preview ? params.get("lighting") : null;
  const renderedPhase = lightPreview === "day" || lightPreview === "evening" || lightPreview === "night" ? lightPreview : phase;
  const [visitedHQ, setVisitedHQ] = useState(false), [readBoard, setReadBoard] = useState(false);
  const [rehearsed, setRehearsed] = useState(new Set<string>());
  const [applied, setApplied] = useState(new Set<string>());
  const [hidden, setHidden] = useState(false), [metrics, setMetrics] = useState("");
  const dialog = useRef<HTMLDialogElement>(null), previousFocus = useRef<HTMLElement | null>(null);
  const fishingTarget = useRef<[number, number] | null>(null);
  const onFishingTarget = useCallback((target: [number, number] | null) => { fishingTarget.current = target; }, []);
  const formRef = useRef<ApplicationFormHandle>(null);
  const closingRef = useRef(false);
  const [closing, setClosing] = useState(false), [saveNotice, setSaveNotice] = useState("");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [graphics, graphicsActions] = useGraphicsSettings();
  const audio = useAudioState();
  useAmbientAudio(inside ? "applicant-hq" : "applicant-island");
  const direct = `/student/apply?view=form${preview ? "&preview=1" : ""}`;
  const play = !compact && !failed && loadState === "ready" && (preview || !!user);
  const position = selected === null ? null : positions[selected];
  const roleContent = position ? getRoleContent(position.slug) : null;
  const userId = user?.id;
  const collectionScope = `applicant:${preview ? "preview" : userId ?? "guest"}`;
  const onReady = useCallback(() => setReady(true), []), onFailure = useCallback(() => setFailed(true), []);
  const avatarKey = `tethos-applicant-avatar-v1:${preview ? "preview" : userId ?? "guest"}`;
  useEffect(() => {
    if (!play) return;
    let saved = null;
    try { saved = parseAppearance(localStorage.getItem(avatarKey)); } catch { /* Storage may be unavailable. */ }
    setAppearance(saved ?? DEFAULT_APPEARANCE); setAvatarLoaded(true); setCustomizing(!saved); setArrival(!!saved);
  }, [play, avatarKey]);
  const finishAppearance = useCallback(() => {
    try { localStorage.setItem(avatarKey, JSON.stringify(appearance)); } catch { /* Keep the current-session appearance. */ }
    setCustomizing(false); setArrival(!inside);
  }, [appearance, avatarKey, inside]);
  const finishArrival = useCallback(() => setArrival(false), []);
  const arriving = arrival && !inside && !reducedMotion;
  const pickFlower = useCallback((index: number) => {
    if (!markFlowerPicked(index)) return;
    const [x, z] = ISLAND_FLOWERS[index];
    window.dispatchEvent(new CustomEvent("tsi:flower-pick", { detail: { x, z, idx: index * 2 } }));
  }, []);
  const focusGame = useCallback(() => requestAnimationFrame(() => document.querySelector<HTMLElement>('[role="application"]')?.focus()), []);
  const close = useCallback(async () => {
    if (closingRef.current) return;
    closingRef.current = true; setClosing(true); setSaveNotice("");
    try {
      const result = await formRef.current?.flushDraft();
      if (result === "error") {
        setSaveNotice("We couldn’t safely close your application yet. Keep it open, wait for any submission to finish, then try again. Your answers are still here.");
        return;
      }
      if (result === "local") setSaveNotice("Draft saved on this device. Reopen it here to sync when your connection returns.");
      setPanel(panel === "role" ? "board" : null); setSelected(null); setApplying(false);
      if (panel !== "role") focusGame();
    } catch {
      setSaveNotice("We couldn’t save your latest changes. Keep this application open and retry. If this continues, contact the team using the help link below.");
    } finally { closingRef.current = false; setClosing(false); }
  }, [focusGame, panel]);
  const openRole = useCallback((index: number) => {
    AudioManager.playSFX("click"); setSaveNotice("");
    setReadBoard(true);
    setApplying((preview || !!user && isPositionOpen(positions[index])) && !applied.has(positions[index].id) && positions[index].essay_questions.length > 0);
    setSelected(index); setPanel("role");
  }, [preview, user, positions, applied]);
  const act = useCallback((action: VillageAction) => {
    if (!action || action === "clock" || transitioning) return;
    if (action === "flower") { if (nearFlower !== null) pickFlower(nearFlower); return; }
    if (action === "fish") { const target = fishingTarget.current; if (target) window.dispatchEvent(new CustomEvent("tsi:fish-start", { detail: { x: target[0], z: target[1] } })); return; }
    if (action === "guide" || action === "board") { if (action === "board") setReadBoard(true); setPanel(action); AudioManager.playSFX("click"); return; }
    setTransitioning(true); setNear(null);
    AudioManager.playSFX(action === "enter" ? "enter" : "exit");
    timers.current.push(setTimeout(() => { setInside(action === "enter"); if (action === "enter") setVisitedHQ(true); if (action === "exit") setReturned(true); }, 320));
    timers.current.push(setTimeout(() => { setTransitioning(false); focusGame(); }, 900));
  }, [transitioning, focusGame, nearFlower, pickFlower]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    if (!play || !ready) return;
    const unlock = (event: Event) => {
      if (event.target instanceof Element && event.target.closest('[role="application"]')) AudioManager.enable();
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); };
  }, [play, ready]);
  useEffect(() => {
    const change = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", change);
    return () => document.removeEventListener("visibilitychange", change);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/positions${preview ? "?preview=1" : ""}`, { signal: controller.signal })
      .then(async r => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data: Position[]) => { if (!Array.isArray(data)) throw new Error(); setPositions(data.filter(p => !p.archived_at)); setLoadState("ready"); })
      .catch(() => { if (!controller.signal.aborted) setLoadState("error"); });
    return () => controller.abort();
  }, [preview]);
  useEffect(() => {
    if (preview) return;
    const client = createClient(); let alive = true;
    client.auth.getUser().then(({ data }) => {
      if (!alive) return; setUser(data.user); setAuthLoaded(true);
    }).catch(() => { if (alive) setAuthLoaded(true); });
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => { if (alive) { setUser(session?.user ?? null); setAuthLoaded(true); } });
    return () => { alive = false; subscription.unsubscribe(); };
  }, [preview]);
  useEffect(() => {
    let alive = true;
    setApplied(new Set());
    if (!preview && userId) {
      void createClient().from("applications").select("position_id").eq("user_id", userId).then(result => {
        if (alive && result.data) setApplied(new Set(result.data.map(application => application.position_id)));
      });
    }
    return () => { alive = false; };
  }, [preview, userId]);
  useEffect(() => {
    if (panel && play && ready) {
      if (!dialog.current?.open) { previousFocus.current = document.activeElement as HTMLElement; dialog.current?.showModal(); }
      dialog.current?.querySelector<HTMLElement>('button, a[href], input')?.focus();
    }
    else { dialog.current?.close(); previousFocus.current?.focus(); }
  }, [panel, play, ready]);
  useEffect(() => {
    if (!play || ready) return;
    const timer = setTimeout(() => setFailed(true), 40_000); return () => clearTimeout(timer);
  }, [play, ready]);
  useEffect(() => {
    if (!play || !ready || !avatarLoaded || customizing || arriving || panel || bagOpen || fishing || transitioning || hidden) return;
    const key = (e: KeyboardEvent) => {
      if (e.repeat || isGameControlTarget(document.activeElement)) return;
      if (e.key.toLowerCase() === "e") { e.preventDefault(); act(near); }
      if (e.key === "Escape") { e.preventDefault(); setPanel("menu"); }
    };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [play, ready, avatarLoaded, customizing, arriving, panel, bagOpen, fishing, transitioning, hidden, near, act]);
  if (compact) return <RecruitmentLanding />;
  const previewAppearance = preview && ["light", "dark"].includes(params.get("appearance") ?? "") ? params.get("appearance") : undefined;
  return <main className={`${appearanceStyles.theme} ${styles.island}`} data-time={renderedPhase} data-appearance={previewAppearance}>
    {play && <ApplicantAppearanceContext.Provider value={appearance}><IslandBoundary onFailure={onFailure}><Scene guideToHQ={!visitedHQ} guideToBoard={!readBoard} onFishingTarget={onFishingTarget} countdownPositions={positions} nearClock={near === "clock"} loading={!ready} collectionScope={collectionScope} arrival={arriving} onArrived={finishArrival} pickedFlowers={pickedFlowers} onFlowerNear={setNearFlower} onPickFlower={pickFlower} fishing={fishing} phase={renderedPhase} postings={positions.map(p => ({ title: p.title, complete: applied.has(p.id) || preview && rehearsed.has(p.id) }))} onSelectRole={openRole} inside={inside} returned={returned} paused={hidden || !avatarLoaded || customizing || bagOpen || panel !== null || transitioning || showAuth} hidden={hidden}
      onAction={act} onNear={setNear} onReady={onReady} onFailure={onFailure} onMetrics={setMetrics} /></IslandBoundary></ApplicantAppearanceContext.Provider>}
    {play && ready && avatarLoaded && !customizing && <ToastHub />}
    <div className={styles.location}><span>Tethos</span><strong>{inside ? "TSI Headquarters" : "Applicant village"}</strong></div>
    <nav className={styles.tools} aria-label="Game options">
      <Link href={direct}>Back to applications ↗</Link>
      {play && ready && avatarLoaded && !customizing && !arriving && !fishing && !bagOpen && <button onClick={() => setPanel("menu")} aria-label="Open game menu">☰</button>}
    </nav>
    {play && !ready && <ApplicantLoading />}
    {!play && <div className={styles.gate}>
      <span className={styles.eyebrow}>Tethos · Recruitment</span><h1>Your next chapter<br />starts here.</h1>
      <p>{failed ? "The village couldn’t load on this device. You can still read every role and apply directly." : "Meet your guide, explore the village, and find your place on the team inside TSI HQ."}</p>
      {loadState === "error" ? <><p role="alert">We couldn’t load the positions.</p><button className={styles.apply} onClick={() => location.reload()}>Try again</button></>
        : !authLoaded || loadState === "loading" ? <p role="status">Getting ready…</p>
        : !user && !preview && !failed ? <button className={styles.apply} onClick={() => setShowAuth(true)}>Sign in to explore Tethos</button> : null}
      <Link className={styles.plainLink} href={direct}>Browse roles and use the direct form</Link>
    </div>}
    {play && ready && preview && <p className={styles.testNotice}>Local rehearsal · No applications sent</p>}
    {play && ready && avatarLoaded && !customizing && !arriving && !panel && !bagOpen && <>
      <TutorialChecklist className={styles.tutorial} title="Your first visit" items={[
        { id: "arrive", label: "Arrive on the island", state: "complete" },
        { id: "hq", label: "Step inside TSI HQ", state: visitedHQ ? "complete" : "current" },
        { id: "board", label: "Read the hiring board", state: readBoard ? "complete" : visitedHQ ? "current" : "upcoming" },
        { id: "apply", label: preview ? "Rehearse an application" : "Send your first application", state: applied.size || rehearsed.size ? "complete" : readBoard ? "current" : "upcoming" },
      ]} />
      <div className={styles.controls}><span><kbd>WASD</kbd> Move · <kbd>E</kbd> Interact · Click to walk</span></div>
      {!fishing && near && near !== "clock" && <button className={styles.interact} onPointerDown={e => { if (near === "fish") { e.preventDefault(); focusGame(); act(near); } }} onClick={() => { if (near !== "fish") act(near); }}><kbd>E</kbd>{ACTION_LABELS[near]}</button>}
      <button className={styles.backpackButton} disabled={fishing} onClick={() => setBagOpen(true)} aria-label="Open backpack">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M8 6V4a4 4 0 0 1 8 0v2M5 8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v12H5zM3 11v7M21 11v7M8 14h8v4H8zM8 9h8" /></svg>
        <span>Backpack</span>
      </button>
      <button className={styles.sound} onClick={() => { if (!audio.enabled) AudioManager.enable(); else AudioManager.setVolumes({ master: audio.volumes.master ? 0 : 0.7 }); }} aria-label={audio.enabled && audio.volumes.master ? "Mute sound" : "Enable sound"}>{audio.enabled && audio.volumes.master ? "♫ Sound on" : "♪ Sound off"}</button>
    </>}
    {play && ready && !inside && !customizing && !arriving && !panel && !bagOpen && <FishingOverlay onActiveChange={setFishing} collectionScope={collectionScope} zoneOverride="sea" />}
    <CollectionBook open={bagOpen} onClose={() => { setBagOpen(false); focusGame(); }} collectionScope={collectionScope} />
    {play && ready && avatarLoaded && customizing && <CharacterSetup appearance={appearance} onChange={setAppearance} onDone={finishAppearance} />}
    {play && ready && arriving && <div className={styles.arrivalClouds} aria-label="Arriving through the clouds"><i /><i /><i /><span>Welcome to Tethos.<small>A little place to begin.</small></span></div>}
    <div className={styles.fade} data-active={transitioning} aria-hidden="true" />
    <dialog ref={dialog} className={`${styles.dialog} ${panel === "board" ? styles.boardDialog : panel === "role" ? styles.applicationDialog : panel === "guide" ? styles.guideDialog : ""}`} onCancel={e => { e.preventDefault(); void close(); }} aria-label={panel === "role" ? `${position?.title ?? "Role"} application` : undefined} aria-labelledby={panel === "role" || panel === "guide" ? undefined : "island-panel-title"}>
      {panel === "welcome" && <div className={styles.welcome}>
        <span className={styles.eyebrow}>A warm welcome to Tethos</span><h1 id="island-panel-title">Come on in.</h1><p>This is your little corner of the island. Meet Jayden, take a walk, then head into TSI HQ to find the recruitment board.</p>
        <div className={styles.keyGuide}><span><kbd>WASD</kbd> Walk</span><span><kbd>E</kbd> Interact</span><span><kbd>Esc</kbd> Menu</span></div><p className={styles.small}>You can also click the ground to walk. Scroll gently to adjust the view.</p>
        <button className={styles.apply} onClick={() => { AudioManager.enable(); close(); }}>Let’s explore →</button><Link className={styles.plainLink} href={direct}>Go straight to the application</Link>
      </div>}
      {panel === "guide" && <NPCDialogue speaker="Jayden · Your guide" onContinue={() => { void close(); }} continueLabel="Let’s take a look">
        <p>Ummm, hey... I don’t think I’ve seen you before.</p>
        <p>Are you looking for the application portal? Well, this is it! Go on into the building ahead and take a look at the hiring board.</p>
        <p>I wish you the best of luck!!</p>
      </NPCDialogue>}
      {panel === "menu" && <div className={styles.welcome}>
        <span className={styles.eyebrow}>A little breather</span><h2 id="island-panel-title">Village menu</h2>
        <p>WASD or click the ground to walk. E interacts with the nearest guide, door, or board. Shift runs, Space hops, and Escape opens this menu.</p>
        <label className={styles.setting}><span>Pixel finish</span><input type="checkbox" checked={graphics.pixelated} onChange={e => graphicsActions.setPixelated(e.target.checked)} /></label>
        <label className={styles.setting}><span>Lighter graphics</span><input type="checkbox" checked={graphics.liteMode} onChange={e => graphicsActions.setLiteMode(e.target.checked)} /></label>
        <Link className={styles.plainLink} href="/student/apply/dashboard">My applications ↗</Link><Link className={styles.plainLink} href={direct}>Direct application ↗</Link>
        {preview && <p className={styles.small}>Local draft preview · Submissions disabled<br />{metrics}</p>}
        <button className={styles.plainLink} onClick={() => { setPanel(null); setCustomizing(true); }}>Change your character</button>
        <button className={styles.apply} onClick={close}>Back to the village</button>
      </div>}
      {panel === "board" && <section className={styles.board}>
        <div className={styles.boardHeading}><div><span>TSI HQ · Help wanted</span><h2 id="island-panel-title">Find your people.</h2></div><button onClick={close} aria-label="Close recruitment board">×</button></div>
        <p>Four ways to make something good together. Pick a posting to read more.</p>
        <div className={styles.postings}>{positions.map((p, i) => <WantedPosting key={p.id} onClick={() => openRole(i)} title={p.title} summary={getRoleContent(p.slug)?.tagline ?? p.description ?? undefined} status={preview && rehearsed.has(p.id) ? "rehearsed" : applied.has(p.id) ? "submitted" : !p.essay_questions.length ? "preparing" : isPositionOpen(p) ? "open" : p.closes_at && Date.parse(p.closes_at) <= Date.now() ? "closed" : "upcoming"} />)}</div>
        {saveNotice && <p role="status">{saveNotice}</p>}
        {!positions.length && <p>The next round is being prepared. Come back soon, or check My applications in the menu.</p>}
        <small>{preview ? "Local rehearsal only. Recruitment dates are still unconfirmed." : "Your application stays private. Explore any posting before deciding."}</small>
      </section>}
      {panel === "role" && position&&<MotionConfig reducedMotion="user"><ApplicationSheet title={position.title} subtitle={preview ? "Layout preview · Submissions disabled" : "Your space to tell us what you’ll bring to Tethos."} onClose={() => { void close(); }} closeDisabled={closing} closeLabel={closing ? "Saving draft…" : applying ? "Save and return to board" : "Return to board"} className={styles.roleSheet} footer={<div className={styles.applicationFooter}>
        <span role="status">{saveNotice || (closing ? "Saving your latest changes…" : applying ? "Save and close with ×. Review your answers before submitting." : "Read any posting. Apply when you’re ready.")}</span>
        <a href="mailto:team@tethos.ca?subject=Recruitment%20application%20help">Need help? Contact Tethos ↗</a>
      </div>}>
        <div className={styles.applicationContent}>
        {preview && rehearsed.has(position.id) ? <PreviewCompletion onReturn={() => { void close(); }} /> : applying && (preview || user) ? <ApplicationForm key={`${user?.id ?? "preview"}:${position.id}`} ref={formRef} preview={preview} layout="sheet" onPreviewComplete={() => setRehearsed(current => new Set(current).add(position.id))} onReturnToBoard={() => { void close(); }} position={position} userId={user?.id ?? "preview"} onSubmitted={()=>setApplied(current=>new Set(current).add(position.id))}/> : <>
          <p className={styles.description}>{roleContent?.tagline??position.description}</p>
          {position.slug === "developer" && <DeveloperProjects />}
          {roleContent?.positionsCount && <p>Hiring {roleContent.positionsCount} {position.slug.startsWith("director-") ? "Directors" : "positions"}</p>}
          {roleContent?.overview && <><h3>Portfolio overview{roleContent.draftOverview ? " · Draft" : ""}</h3><p>{roleContent.overview}</p></>}
          {roleContent&&<><h3>What you&apos;ll do</h3><ul>{roleContent.whatYoullDo.map(item=><li key={item}>{item}</li>)}</ul></>}
          {roleContent&&<><h3>What we look for</h3><ul>{roleContent.whoYouAre.map(item=><li key={item}>{item}</li>)}</ul></>}
          <h3>Before you apply</h3><p>Bring a PDF résumé under 2 MB. You&apos;ll add your details and answer the questions below. You can save a draft and come back later.</p>
          <ol>{position.essay_questions.map(q=><li key={q.id}>{q.question}<span className={styles.wordLimit}>{q.response_type === "url" ? "Link" : `Up to ${q.max_words} words`}</span></li>)}</ol>
          {position.essay_questions.some(q=>q.response_type==="url")&&<p>Paste a valid HTTP or HTTPS link. Make sure the team can open it.</p>}
          {!position.essay_questions.length&&<p>Application questions are being prepared.</p>}
          {preview ? <p className={styles.preview}>Preview only. Dates and final questions are still being prepared.</p> : applied.has(position.id) ? <Link className={styles.apply} href="/student/apply/dashboard">View your submitted application</Link> : !isPositionOpen(position) ? <p>This role is not currently accepting applications.</p> : <button className={styles.apply} onClick={()=>{if(user)setApplying(true);else{close();setShowAuth(true);}}}>{user ? "Start application" : "Sign in to apply"}</button>}
          {!preview&&<Link className={styles.plainLink} href={`/student/apply/${position.slug}`}>Open the standard application page</Link>}
        </>}
        </div>
      </ApplicationSheet></MotionConfig>}
    </dialog>
    <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} redirectTo="/student/apply/portal" />
  </main>;
}
