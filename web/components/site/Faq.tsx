"use client";

import { useState } from "react";

export type Qa = { q: string; a: string };

/** Numbered questions, one open at a time (.3s). Native buttons, so keyboard and screen readers work. */
export default function Faq({ items }: { items: readonly Qa[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <ol className="faq">
      {items.map((it, i) => {
        const isOpen = open === i;
        return (
          <li key={it.q} className="faq__item" data-open={isOpen}>
            <h3 className="faq__q">
              <button type="button" aria-expanded={isOpen} aria-controls={`faq-${i}`} onClick={() => setOpen(isOpen ? null : i)}>
                <span className="faq__num">Q.{String(i + 1).padStart(2, "0")}</span>
                <span className="faq__text">{it.q}</span>
                <span className="faq__sign" aria-hidden="true">{isOpen ? "−" : "+"}</span>
              </button>
            </h3>
            <div id={`faq-${i}`} className="faq__a" role="region" hidden={!isOpen}>
              <p className="ts-body">{it.a}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
