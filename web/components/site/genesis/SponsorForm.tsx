"use client";

import { useState, type FormEvent } from "react";
import { SPONSOR_INTERESTS } from "@/lib/sponsor-inquiries";

type State = { kind: "idle" } | { kind: "sending" } | { kind: "done" } | { kind: "error"; message: string };

/** The short sponsor form on /genesis. Posts to /api/sponsor-inquiries; nothing is stored in the browser. */
export default function SponsorForm() {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const get = (k: string) => String(f.get(k) ?? "");
    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/sponsor-inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: get("name"), organization: get("organization"), email: get("email"),
          interests: f.getAll("interests").map(String), message: get("message"), company_fax: get("company_fax"),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
      setState({ kind: "done" });
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message : "Something went wrong. Please try again." });
    }
  }

  if (state.kind === "done") {
    return (
      <div className="np-form__done" role="status">
        <h3 className="ts-h3">Thanks, we have your details.</h3>
        <p className="ts-body">Judy Gao and Sierra Lin, who run sponsorship, will reply by email.</p>
      </div>
    );
  }

  return (
    <form className="np-form" onSubmit={submit}>
      <fieldset className="np-form__group">
        <legend className="np-legend">You</legend>
        <label className="np-field"><span>Your name</span><input name="name" required maxLength={160} autoComplete="name" /></label>
        <label className="np-field"><span>Company or organization</span><input name="organization" required maxLength={200} autoComplete="organization" /></label>
        <label className="np-field np-field--wide"><span>Email</span><input name="email" type="email" required maxLength={254} autoComplete="email" /></label>
      </fieldset>

      <fieldset className="np-form__group">
        <legend className="np-legend">What interests you <em className="np-legend__note">optional</em></legend>
        {SPONSOR_INTERESTS.map((i) => (
          <label key={i.value} className="np-check np-check--half"><input type="checkbox" name="interests" value={i.value} /><span>{i.label}</span></label>
        ))}
        <label className="np-field np-field--wide"><span>Anything else <em>optional</em></span><textarea name="message" maxLength={2000} rows={3} /></label>
        <label className="np-trap" aria-hidden="true">Fax<input name="company_fax" tabIndex={-1} autoComplete="off" /></label>
      </fieldset>

      <div className="np-form__send">
        <button type="submit" className="ts-btn ts-btn--primary" disabled={state.kind === "sending"}>{state.kind === "sending" ? "Sending..." : "Send"}</button>
        {state.kind === "error" && <p className="np-form__error" role="alert">{state.message}</p>}
      </div>
    </form>
  );
}
