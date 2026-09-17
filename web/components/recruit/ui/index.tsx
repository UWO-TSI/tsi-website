"use client";

import { useId, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import styles from "./village-ui.module.css";

const cx = (...names: (string | undefined | false)[]) => names.filter(Boolean).join(" ");

export function VillagePanel({ tone = "cream", className, children, ...props }: HTMLAttributes<HTMLDivElement> & { tone?: "cream" | "butter" | "teal" }) {
  return <div {...props} className={cx(styles.theme, styles.panel, className)} data-tone={tone}>{children}</div>;
}

export function Keycap({ children, className, ...props }: HTMLAttributes<HTMLElement>) {
  return <kbd {...props} className={cx(styles.theme, styles.keycap, className)}>{children}</kbd>;
}

export function VillageButton({ variant = "primary", leadingKey, className, children, type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "quiet"; leadingKey?: string }) {
  return <button {...props} type={type} className={cx(styles.theme, styles.button, className)} data-variant={variant}>
    {leadingKey && <Keycap aria-hidden="true">{leadingKey}</Keycap>}{children}
  </button>;
}

export function NPCDialogue({ speaker, children, onContinue, continueLabel = "Got it", className }: { speaker: string; children: ReactNode; onContinue?: () => void; continueLabel?: string; className?: string }) {
  const nameId = useId();
  return <section className={cx(styles.theme, styles.dialogue, className)} aria-labelledby={nameId}>
    <h2 id={nameId} className={styles.speaker}>{speaker}</h2>
    <div className={styles.dialogueText}>{children}</div>
    {onContinue && <button type="button" className={styles.continue} onClick={onContinue}>{continueLabel}<span aria-hidden="true">▾</span></button>}
  </section>;
}

export type TutorialItem = { id: string; label: string; state: "current" | "complete" | "upcoming" };

export function TutorialChecklist({ title = "A little to-do", items, className }: { title?: string; items: TutorialItem[]; className?: string }) {
  const titleId = useId();
  return <section className={cx(styles.theme, styles.checklist, className)} aria-labelledby={titleId}>
    <h2 id={titleId}>{title}</h2>
    <ol>{items.map(item => <li key={item.id} data-state={item.state} aria-current={item.state === "current" ? "step" : undefined}>
      <span className={styles.taskMark} aria-hidden="true">{item.state === "complete" ? "✓" : item.state === "current" ? "•" : ""}</span>
      <span>{item.label}<span className={styles.srOnly}>{item.state === "complete" ? ", complete" : item.state === "upcoming" ? ", upcoming" : ""}</span></span>
    </li>)}</ol>
  </section>;
}

export type PostingStatus = "open" | "draft" | "preparing" | "submitted" | "upcoming" | "closed" | "rehearsed";
const postingLabels: Record<PostingStatus, string> = { rehearsed: "Rehearsal complete · Not submitted", open: "Read & apply", draft: "Resume draft", preparing: "Questions being prepared", submitted: "Application sent", upcoming: "Dates to be confirmed", closed: "Applications closed" };

export function WantedPosting({ title, summary, status, onClick, className }: { title: string; summary?: string; status: PostingStatus; onClick?: () => void; className?: string }) {
  return <button type="button" className={cx(styles.theme, styles.posting, className)} data-status={status === "rehearsed" ? "submitted" : status} onClick={onClick}>
    <span className={styles.pin} aria-hidden="true" />
    <span className={styles.postingEyebrow}>Tethos · Join the team</span>
    <span className={styles.postingTitle}>{title}</span>
    {summary && <span className={styles.postingSummary}>{summary}</span>}
    <span className={styles.postingStatus}><span aria-hidden="true">{status === "submitted" || status === "rehearsed" ? "✓" : status === "open" ? "↗" : "◌"}</span>{postingLabels[status]}</span>
  </button>;
}

export type DraftSaveState = "idle" | "saving" | "saved" | "local" | "error";
const saveLabels: Record<DraftSaveState, string> = { idle: "Your draft saves as you go", saving: "Saving your draft…", saved: "Draft saved", local: "Saved on this device · Waiting to sync", error: "Couldn’t save · Keep this page open" };

export function SaveStatus({ state, message, className }: { state: DraftSaveState; message?: string; className?: string }) {
  return <span role="status" aria-live="polite" aria-atomic="true" className={cx(styles.theme, styles.saveStatus, className)} data-state={state}>
    <span className={styles.saveMark} aria-hidden="true">{state === "saved" ? "✓" : state === "error" ? "!" : "•"}</span>{message ?? saveLabels[state]}
  </span>;
}

type FieldCopy = { label: string; hint?: string; error?: string };

export function VillageField({ label, hint, error, id, className, "aria-describedby": describedBy, ...props }: InputHTMLAttributes<HTMLInputElement> & FieldCopy) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return <div className={cx(styles.theme, styles.field, className)}>
    <label htmlFor={fieldId}>{label}{props.required && <span className={styles.required}>Required</span>}</label>
    {hint && <p className={styles.hint} id={`${fieldId}-hint`}>{hint}</p>}
    <input {...props} id={fieldId} aria-invalid={error ? true : props["aria-invalid"]} aria-describedby={cx(describedBy, hint && `${fieldId}-hint`, error && `${fieldId}-error`) || undefined} />
    {error && <p className={styles.fieldError} id={`${fieldId}-error`}>{error}</p>}
  </div>;
}

export function VillageTextArea({ label, hint, error, id, className, "aria-describedby": describedBy, rows = 5, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & FieldCopy) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return <div className={cx(styles.theme, styles.field, className)}>
    <label htmlFor={fieldId}>{label}{props.required && <span className={styles.required}>Required</span>}</label>
    {hint && <p className={styles.hint} id={`${fieldId}-hint`}>{hint}</p>}
    <textarea {...props} rows={rows} id={fieldId} aria-invalid={error ? true : props["aria-invalid"]} aria-describedby={cx(describedBy, hint && `${fieldId}-hint`, error && `${fieldId}-error`) || undefined} />
    {error && <p className={styles.fieldError} id={`${fieldId}-error`}>{error}</p>}
  </div>;
}

/** Visual frame only. The caller owns modal focus, save-on-close, and submission. */
export function ApplicationSheet({ title, subtitle, children, footer, onClose, closeLabel = "Save and close", closeDisabled = false, className }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode; onClose: () => void; closeLabel?: string; closeDisabled?: boolean; className?: string }) {
  const titleId = useId();
  return <section className={cx(styles.theme, styles.applicationSheet, className)} aria-labelledby={titleId}>
    <header className={styles.sheetHeader}>
      <div><p className={styles.sheetEyebrow}>Tethos · Recruitment office</p><h2 id={titleId}>{title}</h2>{subtitle && <p className={styles.sheetSubtitle}>{subtitle}</p>}</div>
      <button type="button" className={styles.closeButton} onClick={onClose} disabled={closeDisabled} aria-label={closeLabel} title={closeLabel}><span aria-hidden="true">×</span></button>
    </header>
    <div className={styles.sheetBody}>{children}</div>
    {footer && <footer className={styles.sheetFooter}>{footer}</footer>}
  </section>;
}
