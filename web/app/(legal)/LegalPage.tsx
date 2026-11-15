import { readFileSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import { markdownToHtml } from "@/lib/legal/markdown";
import s from "./legal.module.css";

/** /terms and /privacy on both hosts: plain readable text from web/content/legal (specs/launch/preregistration.md §5). */
export default function LegalPage({ page }: { page: "terms" | "privacy" }) {
  const html = markdownToHtml(readFileSync(join(process.cwd(), "content/legal", `${page}.md`), "utf8"));
  return <main className={s.page}>
    <nav className={s.nav}>
      <Link href="/">Tethos Island</Link>
      <span>{page === "terms" ? <Link href="/privacy">Privacy Policy</Link> : <Link href="/terms">Terms of Service</Link>}</span>
    </nav>
    <article className={s.doc} dangerouslySetInnerHTML={{ __html: html }} />
  </main>;
}
