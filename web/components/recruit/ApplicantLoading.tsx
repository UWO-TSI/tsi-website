import styles from "./island.module.css";

export default function ApplicantLoading() {
  return <div className={styles.loading} role="status" aria-live="polite">
    <span className={styles.eyebrow}>Tech for Social Impact · A little place to begin</span>
    <span className={styles.leaf} aria-hidden="true">❧</span>
    <h1>Making room for you.</h1>
    <p>Getting the village ready…</p>
    <div className={styles.loadingTrack} aria-hidden="true"><span /></div>
  </div>;
}
