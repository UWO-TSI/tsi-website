/**
 * The legal pages' Markdown (web/content/legal/*.md) to HTML: headings, paragraphs (line breaks kept), "- " lists,
 * pipe tables, **bold**, `code`, [links](url) and bare emails. Only what those two files use.
 */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function inline(s: string): string {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\[(.+?)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+|\/[^)\s]*)\)/g, '<a href="$2">$1</a>')
    .replace(/(^|[\s(])([\w.+-]+@[\w-]+\.[\w.]+\w)/g, '$1<a href="mailto:$2">$2</a>');
}

const cells = (row: string) => row.trim().replace(/^\||\|$/g, "").split("|").map(c => inline(c.trim()));

export function markdownToHtml(md: string): string {
  const out: string[] = [];
  const blocks = md.replace(/\r/g, "").split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split("\n").filter(l => l.trim() !== "");
    if (!lines.length) continue;
    const h = /^(#{1,3}) (.*)$/.exec(lines[0]);
    if (h && lines.length === 1) { out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); continue; }
    if (lines.every(l => l.startsWith("- "))) { out.push(`<ul>${lines.map(l => `<li>${inline(l.slice(2))}</li>`).join("")}</ul>`); continue; }
    if (lines.length > 2 && lines.every(l => l.trim().startsWith("|"))) {
      const [head, , ...rows] = lines;
      out.push(`<table><thead><tr>${cells(head).map(c => `<th>${c}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${cells(r).map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
      continue;
    }
    // A bold line followed by a list (privacy's "**When you play**" groups) stays one block in the source.
    const listAt = lines.findIndex(l => l.startsWith("- "));
    if (listAt > 0 && lines.slice(listAt).every(l => l.startsWith("- "))) {
      out.push(`<p>${lines.slice(0, listAt).map(inline).join("<br>")}</p>`);
      out.push(`<ul>${lines.slice(listAt).map(l => `<li>${inline(l.slice(2))}</li>`).join("")}</ul>`);
      continue;
    }
    out.push(`<p>${lines.map(inline).join("<br>")}</p>`);
  }
  return out.join("\n");
}
