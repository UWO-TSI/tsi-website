"use client";

import { useState, type CSSProperties } from "react";
import { ChevronRight } from "lucide-react";
import { DEVELOPER_PROJECTS } from "@/lib/recruitment-projects";
import { MAX_PROJECT_CHOICES, RANK_LABELS, toggleProjectChoice } from "./project-choices";
import styles from "./project-cards.module.css";

interface ProjectCardsProps {
  /** Present on the application step: current picks, in rank order. */
  choices?: string[];
  /** Present on the application step: turns the cards into a ranking control. */
  onChoicesChange?: (choices: string[]) => void;
}

const slug = (partner: string) => partner.toLowerCase().replace(/[^a-z0-9]+/g, "-");

// One column of partner cards. The name row opens the brief; the pill on the
// right ranks (read-only pages simply omit it). Same component on the role
// page, the village sheet and the direct form.
export default function ProjectCards({ choices, onChoicesChange }: ProjectCardsProps) {
  const [open, setOpen] = useState<string | null>(null);
  const ranking = !!onChoicesChange;
  const picks = choices ?? [];
  const full = picks.length >= MAX_PROJECT_CHOICES;

  return (
    <div className={styles.list} role={ranking ? "group" : undefined} aria-label={ranking ? "Rank your top 3 projects" : undefined}>
      {DEVELOPER_PROJECTS.map((project) => {
        const rank = picks.indexOf(project.partner);
        const ranked = rank !== -1;
        const isOpen = open === project.partner;
        const briefId = `project-brief-${slug(project.partner)}`;
        return (
          <article key={project.partner} className={styles.card} data-ranked={ranked} data-open={isOpen}>
            <div className={styles.row}>
              <span
                className={styles.logo}
                role="img"
                aria-label={`${project.partner} logo`}
                style={{ "--logo": `url("${project.logo}")` } as CSSProperties}
              />
              <button
                type="button"
                className={styles.main}
                aria-expanded={isOpen}
                aria-controls={briefId}
                onClick={() => setOpen(isOpen ? null : project.partner)}
              >
                <span className={styles.text}>
                  <strong>{project.partner}</strong>
                  <span>{project.title}</span>
                </span>
                <ChevronRight className={styles.chev} size={16} aria-hidden />
              </button>
              {ranking && (
                <button
                  type="button"
                  className={styles.rank}
                  aria-pressed={ranked}
                  disabled={!ranked && full}
                  aria-label={ranked ? `Ranked ${RANK_LABELS[rank]}. Remove ${project.partner} from your picks` : `Rank ${project.partner}`}
                  onClick={() => onChoicesChange?.(toggleProjectChoice(picks, project.partner))}
                >
                  {ranked ? RANK_LABELS[rank] : "Rank"}
                </button>
              )}
            </div>
            {isOpen && (
              <div id={briefId} className={styles.brief}>
                {project.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
