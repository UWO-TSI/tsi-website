"use client";

/**
 * The cream menus' layout pieces (specs/polish/flat-ui.md round 2, step 7). David: "keep old color pallete but the ui and
 * design needs more work, more space and cleaner more intuitive design". The paper sheet and its palette stay; what's
 * inside loses its boxes:
 * - `Folds` and `Fold`: a list whose rows open in place. The open row is the one piece of paper on the page, and it
 *   holds that row's one action.
 * - `Section`: a group under a quiet heading.
 * - `QuietButton`: a text-weight button for second actions (skip, abandon, report, back).
 * Colours: the --gui-* cream tokens (styles/game-tokens.css).
 */
import { useId, type ButtonHTMLAttributes, type ReactNode } from "react";
import { ChevronDown, ChevronLeft } from "lucide-react";
import c from "./cream.module.css";

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

/** A group under a quiet heading, `aside` at the heading's right (a count, a button). */
export function Section({ title, aside, label, className, children }: { title?: ReactNode; aside?: ReactNode; label?: string; className?: string; children: ReactNode }) {
  return <section className={cx(c.section, className)} aria-label={label ?? (typeof title === "string" ? title : undefined)}>
    {(title || aside) && <header className={c.sectionHead}>{title ? <h3 className={c.sectionTitle}>{title}</h3> : <span />}{aside}</header>}
    {children}
  </section>;
}

/** The rows' list. */
export function Folds({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return <ul className={cx(c.folds, className)} aria-label={label}>{children}</ul>;
}

export type FoldState = "done" | "now" | "locked" | "plain";
/**
 * One row: `lead` (a small mark), the title, a quiet `line` under it and `meta` on the right. `open`: its body shows
 * under it, on paper. Without `onToggle` it is a plain row that doesn't open (a locked chapter).
 */
export function Fold({ lead, title, line, meta, open, onToggle, state = "plain", testId, label, children }: {
  lead?: ReactNode; title: ReactNode; line?: ReactNode; meta?: ReactNode; open?: boolean; onToggle?: () => void; state?: FoldState;
  testId?: string; label?: string; children?: ReactNode;
}) {
  const id = useId();
  const head = <>
    {lead !== undefined && <span className={c.lead} aria-hidden="true">{lead}</span>}
    <span className={c.foldText}><span className={c.foldTitle}>{title}</span>{line ? <span className={c.foldLine}>{line}</span> : null}</span>
    {meta !== undefined && meta !== null ? <span className={c.meta}>{meta}</span> : null}
    {onToggle && <ChevronDown size={18} className={c.chev} aria-hidden="true" />}
  </>;
  return <li className={c.fold} data-open={open || undefined} data-state={state} data-testid={testId}>
    {onToggle ? <button type="button" className={c.foldHead} aria-expanded={!!open} aria-controls={open ? id : undefined} aria-label={label} onClick={onToggle}>{head}</button>
      : <div className={c.foldHead} aria-label={label}>{head}</div>}
    {open && children ? <div id={id} className={c.foldBody}>{children}</div> : null}
  </li>;
}

/** A text-weight button: the second action beside a primary one. */
export function QuietButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} className={cx(c.quiet, className)} />;
}

/** Back to the list a view came from ("All mail"), top left. */
export function BackLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button type="button" className={c.back} onClick={onClick}><ChevronLeft size={16} aria-hidden="true" />{children}</button>;
}
