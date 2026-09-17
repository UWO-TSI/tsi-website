import { DEVELOPER_PROJECTS } from "@/lib/recruitment-projects";
import styles from "./developer-projects.module.css";

// embedded: accordion only, no heading — rendered beside the ranking list
// inside ProjectChoices on the application's Questions step.
export default function DeveloperProjects({ embedded = false }: { embedded?: boolean }) {
  return <section className={embedded ? `${styles.projects} ${styles.embedded}` : styles.projects} aria-label="This year’s developer projects">
    {!embedded && <>
      <h2>This year’s projects</h2>
      <p>Five nonprofit partners. Explore what each team will be building; you can rank your top 3 in the application.</p>
    </>}
    {DEVELOPER_PROJECTS.map(project => <details key={project.partner}>
      <summary><strong>{project.partner}</strong><span>{project.title}</span></summary>
      <div>{project.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</div>
    </details>)}
  </section>;
}
