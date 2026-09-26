import { DEVELOPER_PROJECTS } from "@/lib/recruitment-projects";
import ProjectCards from "./ProjectCards";
import styles from "./developer-projects.module.css";

// Read-only list for the role page and the village sheet's role overlay.
// The application step reuses the same cards with ranking (ProjectChoices).
export default function DeveloperProjects() {
  return (
    <section className={styles.projects} aria-label="This year’s developer projects">
      <h2>This year’s projects</h2>
      <p>{DEVELOPER_PROJECTS.length} nonprofit partners. Open a card to read what each team will build; you can rank your top 3 in the application.</p>
      <ProjectCards />
    </section>
  );
}
