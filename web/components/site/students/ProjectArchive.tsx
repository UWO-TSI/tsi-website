"use client";

import { useRef, useState } from "react";
import Reveal from "@/components/site/Reveal";
import { glitch } from "@/components/site/npo/FaqAscii";
import type { ArchiveYear } from "@/lib/site/projects";

/**
 * Every project by year: one year at a time, picked from the chips, the most recent finished year first. Switching
 * years glitches each client's name in out of noise, the way the FAQ answers arrive.
 */
export default function ProjectArchive({ years, initial = 1 }: { years: readonly ArchiveYear[]; initial?: number }) {
  const [k, setK] = useState(initial);
  const list = useRef<HTMLOListElement>(null);
  const year = years[k];

  const pick = (i: number) => {
    if (i === k) return;
    setK(i);
    requestAnimationFrame(() => {
      list.current?.querySelectorAll<HTMLElement>(".st-arch__client").forEach((el) => glitch(el, el.textContent ?? ""));
    });
  };

  return (
    <section className="ts-section" data-tone="light" id="projects" aria-labelledby="projects-title">
      <div className="ts-wrap">
        <div className="st-arch__head">
          <Reveal delay={0.06}><h2 className="ts-h2" id="projects-title">What teams have built.</h2></Reveal>
          <Reveal delay={0.1} className="st-arch__years" role="tablist" aria-label="Year">
            {years.map((y, i) => (
              <button key={y.year} type="button" role="tab" aria-selected={i === k} aria-controls="st-arch-list" onClick={() => pick(i)}>
                <b>{y.year}</b><span>{y.note}</span>
              </button>
            ))}
          </Reveal>
        </div>
        <ol ref={list} className="st-arch__list" id="st-arch-list" role="tabpanel" aria-label={`${year.year} projects`} key={year.year}>
          {year.projects.map((p, i) => (
            <li key={p.client} className="st-arch__item" style={{ ["--i" as string]: i }}>
              <p className="st-arch__meta">
                <span>{String(i + 1).padStart(2, "0")}</span>
                {p.teams && <span>{p.teams} teams</span>}
              </p>
              <h3 className="st-arch__client">{p.client}</h3>
              <p className="st-arch__built">{p.built}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
