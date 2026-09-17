"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { previewRecruitmentPositions } from "@/lib/recruitment-round";
import { ROLE_CONTENT } from "@/lib/recruitment-content";
import {
  ApplicationSheet, Keycap, NPCDialogue, SaveStatus, TutorialChecklist,
  VillageButton, VillageField, VillagePanel, WantedPosting,
} from "./ui";
import styles from "./village-preview.module.css";
import sheetStyles from "./island.module.css";
import ApplicationForm from "./ApplicationForm";

const roles = previewRecruitmentPositions();
const sampleStates = ["preparing", "draft", "open", "submitted"] as const;

export default function VillageUIPreview() {
  const [evening, setEvening] = useState(false);
  const [roleId, setRoleId] = useState<string | null>(null);
  const [guideRead, setGuideRead] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const role = roles.find(item => item.id === roleId);
  const content = role ? ROLE_CONTENT[role.slug] : undefined;

  useEffect(() => {
    if (roleId) dialog.current?.showModal();
  }, [roleId]);

  function openRole(id: string) {
    opener.current = document.activeElement as HTMLElement;
    setRoleId(id);
  }

  function closeRole() {
    dialog.current?.close();
    setRoleId(null);
    opener.current?.focus();
  }

  return <main className={styles.preview} data-evening={evening}>
    <header className={styles.header}>
      <Link href="/student/apply/portal?preview=1" className={styles.brand}>Tethos <span>Village interface</span></Link>
      <VillageButton variant="secondary" aria-pressed={evening} onClick={() => setEvening(!evening)}>
        {evening ? "Evening backdrop" : "Daylight backdrop"}
      </VillageButton>
    </header>

    <div className={styles.intro}>
      <div><h1>A little place to begin.</h1><p>Tethos colors and type, with a little village warmth.</p></div>
      <span className={styles.previewLabel}>Component preview · no applications are sent</span>
    </div>

    <div className={styles.layout}>
      <section className={styles.board} aria-labelledby="preview-board-title">
        <div className={styles.boardTitle}><span>TSI HQ</span><h2 id="preview-board-title">Good people wanted.</h2><p>Four roles. Find the one that feels like you.</p></div>
        <div className={styles.postings}>
          {roles.map((item, index) => <WantedPosting key={item.id} title={item.title} summary={item.description ?? undefined}
            status={sampleStates[index]} onClick={() => openRole(item.id)} />)}
        </div>
        <p className={styles.boardCaption}>Example posting states. Recruitment dates are still unconfirmed.</p>
      </section>

      <aside className={styles.sidebar}>
        <TutorialChecklist title="Your first visit" items={[
          { id: "arrive", label: "Arrive on the island", state: "complete" },
          { id: "hq", label: "Step inside TSI HQ", state: "complete" },
          { id: "board", label: "Read the hiring board", state: "current" },
          { id: "apply", label: "Send your first application", state: "upcoming" },
        ]} />
        <VillagePanel>
          <h2 className={styles.smallHeading}>Make yourself at home.</h2>
          <div className={styles.controls}><span><Keycap>W</Keycap><Keycap>A</Keycap><Keycap>S</Keycap><Keycap>D</Keycap> Move</span><span><Keycap>E</Keycap> Interact</span></div>
          <p className={styles.smallCopy}>A quiet prompt when you need it. The island stays in view.</p>
        </VillagePanel>
      </aside>
    </div>

    <section className={styles.dialogueSection} aria-label="Guide dialogue example">
      <NPCDialogue speaker="Eliza" onContinue={() => setGuideRead(!guideRead)} continueLabel={guideRead ? "Read welcome again" : "Got it"}>
        {guideRead ? <>Take your time. You can return to a draft before submitting.</> : <>Welcome to Tech for Social Impact! The <strong>hiring board</strong> is just inside HQ. Have a look. You might find your people.</>}
      </NPCDialogue>
    </section>

    <section className={styles.samples} aria-labelledby="details-title">
      <div className={styles.sectionHeading}><h2 id="details-title">Small details, clear signals.</h2><p>The same controls belong in the world and on your phone.</p></div>
      <div className={styles.sampleGrid}>
        <VillagePanel><h3>Actions & prompts</h3><div className={styles.stack}>
          <VillageButton onClick={() => openRole(roles[2].id)}>Open application preview</VillageButton>
          <VillageButton variant="secondary" onClick={() => document.getElementById("preview-board-title")?.scrollIntoView({ behavior: "instant", block: "center" })}>Back to the board</VillageButton>
          <VillageButton disabled>Applications opening soon</VillageButton>
        </div></VillagePanel>
        <VillagePanel><h3>Honest save feedback</h3><div className={styles.stack}>
          <SaveStatus state="saving" /><SaveStatus state="saved" /><SaveStatus state="local" /><SaveStatus state="error" />
        </div></VillagePanel>
        <VillagePanel tone="butter"><h3>A helpful field</h3><VillageField label="Video link" type="url" defaultValue="https://" hint="Use an HTTP or HTTPS video link." error="Add the full address of your video." />
        </VillagePanel>
      </div>
      <div className={styles.palette} aria-label="Interface colors">
        {[['Tethos blue','#1d9bf0'],['Golden yellow','#ffd166'],['Brand light','#f1ffff'],['Warm paper','#fffbe7'],['Navy','#0d1b2a']].map(([name,color]) => <span key={name}><i style={{ backgroundColor: color }} />{name}<small>{color}</small></span>)}
      </div>
    </section>

    <footer className={styles.pageFooter}>Tethos recruitment · Responsive components, real role copy, example states.</footer>

    <dialog ref={dialog} className={styles.modal} onCancel={event => { event.preventDefault(); closeRole(); }} aria-label={role ? `${role.title} application preview` : "Application preview"}>
      {role && <ApplicationSheet title={role.title} subtitle="Application layout preview · submissions disabled" onClose={closeRole} closeLabel="Close preview" footer={<>
        <span className={styles.previewNote}>Try the real form layout. Preview answers reset when you close.</span>
        <VillageButton variant="secondary" onClick={closeRole}>Back to board</VillageButton>
      </>}>
        <div className={styles.applicationBody}>
          <h2 id="preview-application-title" className={styles.smallHeading}>Tell us a little about yourself.</h2>
          <p>{content?.overview || role.description}</p>
          {content?.draftOverview && <p className={styles.draftNote}>Internal overview and responsibilities are draft copy awaiting review.</p>}
          <details className={styles.roleDetails}><summary>What the role involves</summary><ul>{content?.whatYoullDo.map(item => <li key={item}>{item}</li>)}</ul></details>
          {role.essay_questions.length === 0 ? <VillagePanel tone="butter"><h3>Questions are being prepared.</h3><p>Marketing Director applications will be available once the role details and opening dates are confirmed.</p></VillagePanel> : <div className={sheetStyles.applicationContent}><ApplicationForm key={role.id} position={role} userId="ui-preview" layout="sheet" preview /></div>}
        </div>
      </ApplicationSheet>}
    </dialog>
  </main>;
}
