"use client";

import { Component, type ReactNode } from "react";
import styles from "./GameSceneBoundary.module.css";

export default class GameSceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className={styles.recovery} role="alert">
        <div>
          <h2>The island couldn’t load</h2>
          <p>Something interrupted the scene. Reload to try again.</p>
          <button onClick={() => window.location.reload()}>Reload island</button>
        </div>
      </section>
    );
  }
}
