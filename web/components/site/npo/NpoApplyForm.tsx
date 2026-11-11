"use client";

import { useState, type FormEvent } from "react";
import { ORG_TYPES } from "@/lib/npo-applications";

type State = { kind: "idle" } | { kind: "sending" } | { kind: "done" } | { kind: "error"; message: string };

/** The nonprofit application form. Posts to /api/npo-applications; nothing is stored in the browser. */
export default function NpoApplyForm({ contact }: { contact: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const get = (k: string) => String(f.get(k) ?? "");
    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/npo-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_name: get("org_name"), website: get("website"), org_type: get("org_type"), city: get("city"),
          contact_name: get("contact_name"), contact_email: get("contact_email"), contact_role: get("contact_role"),
          problem: get("problem"), users: get("users"), current_tools: get("current_tools"),
          can_commit: f.get("can_commit") === "yes", heard_about: get("heard_about"), company_fax: get("company_fax"),
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
        <h3 className="ts-h3">Thanks, we have your application.</h3>
        <p className="ts-body">We choose partners in September and will be in touch by email. Questions in the meantime: <a href={`mailto:${contact}`}>{contact}</a>.</p>
      </div>
    );
  }

  return (
    <form className="np-form" onSubmit={submit} noValidate={false}>
      <fieldset className="np-form__group">
        <legend className="ts-label">Your organization</legend>
        <label className="np-field"><span>Organization name</span><input name="org_name" required maxLength={200} autoComplete="organization" /></label>
        <label className="np-field"><span>Website <em>optional</em></span><input name="website" maxLength={300} inputMode="url" placeholder="example.org" /></label>
        <label className="np-field"><span>Type</span>
          <select name="org_type" required defaultValue="">
            <option value="" disabled>Choose one</option>
            {ORG_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <label className="np-field"><span>City <em>optional</em></span><input name="city" maxLength={120} autoComplete="address-level2" /></label>
      </fieldset>

      <fieldset className="np-form__group">
        <legend className="ts-label">You</legend>
        <label className="np-field"><span>Your name</span><input name="contact_name" required maxLength={160} autoComplete="name" /></label>
        <label className="np-field"><span>Email</span><input name="contact_email" type="email" required maxLength={254} autoComplete="email" /></label>
        <label className="np-field"><span>Your role <em>optional</em></span><input name="contact_role" maxLength={160} autoComplete="organization-title" /></label>
      </fieldset>

      <fieldset className="np-form__group">
        <legend className="ts-label">What you need</legend>
        <label className="np-field np-field--wide"><span>What would you want built, and what problem does it solve?</span><textarea name="problem" required minLength={20} maxLength={4000} rows={5} /></label>
        <label className="np-field np-field--wide"><span>Who would use it? <em>optional</em></span><textarea name="users" maxLength={2000} rows={3} /></label>
        <label className="np-field np-field--wide"><span>What do you use today? <em>optional</em></span><textarea name="current_tools" maxLength={2000} rows={3} placeholder="Spreadsheets, a website builder, paper forms..." /></label>
        <label className="np-check"><input type="checkbox" name="can_commit" value="yes" /><span>Someone on our team can give 2 to 3 hours a week to check in with the students.</span></label>
        <label className="np-field"><span>How did you hear about us? <em>optional</em></span><input name="heard_about" maxLength={200} /></label>
        <label className="np-trap" aria-hidden="true">Fax<input name="company_fax" tabIndex={-1} autoComplete="off" /></label>
      </fieldset>

      <div className="np-form__send">
        <button type="submit" className="ts-btn ts-btn--primary" disabled={state.kind === "sending"}>{state.kind === "sending" ? "Sending..." : "Send application"}</button>
        {state.kind === "error" && <p className="np-form__error" role="alert">{state.message}</p>}
      </div>
    </form>
  );
}
