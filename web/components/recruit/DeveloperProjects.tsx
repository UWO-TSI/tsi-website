import { DEVELOPER_PROJECTS } from "@/lib/recruitment-projects";
import styles from "./developer-projects.module.css";

export default function DeveloperProjects() {
  return <section className={styles.projects} aria-label="This year’s developer projects">
    <h2>This year’s projects</h2>
    <p>Five nonprofit partners. Explore what each team will be building; you can rank your top 3 in the application.</p>
    {DEVELOPER_PROJECTS.map(project => <details key={project.partner}>
      <summary><strong>{project.partner}</strong><span>{project.title}</span></summary>
      <div>{project.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</div>
    </details>)}
  </section>;
}
