/**
 * Dev-only: `?oracle=demo` runs the island's Oracle + identity calls against
 * the systems agent's real services on an in-memory store (memoryIdentityStore),
 * so the temple, ceremony, nameplates and settings can be played signed out.
 * Seeds: `?name=` world name, `?member=0` public account, `?family=INTJ`
 * a finished reading of that type.
 */
import { memoryIdentityStore } from "@/lib/identity/memoryStore";
import { me, setWorldName, updateSettings } from "@/lib/identity/service";
import { DICHOTOMIES } from "@/lib/oracle/engine";
import { STATEMENTS } from "@/lib/oracle/items";
import { answerBatch, finishReading, oracleStatus, startReading } from "@/lib/oracle/service";

const ME = "00000000-0000-4000-8000-00000000d0e5";
let installed = false;

export function installOracleDemo(): void {
  if (installed || process.env.NODE_ENV === "production" || typeof window === "undefined") return;
  const q = new URLSearchParams(window.location.search);
  if (q.get("oracle") !== "demo") return;
  installed = true;
  const m = memoryIdentityStore();
  const ready = (async () => {
    const now = new Date();
    if (q.get("member") === "0") m.setProfile(ME, { membership: "public" });
    m.fund(ME, 1000);
    if (q.get("name")) await setWorldName(m.store, ME, q.get("name"), now);
    const type = q.get("family");
    if (type && /^[EI][SN][TF][JP]$/.test(type)) {
      const s = await startReading(m.store, ME, "demo-seed-0001", now);
      if (s.ok) {
        const answers = s.data.items.map(it => { const st = STATEMENTS.find(x => x.id === it.id)!; return { item_id: it.id, value: st.pole === type[DICHOTOMIES.indexOf(st.dichotomy)] ? 2 : -2 }; });
        await answerBatch(m.store, ME, s.data.attempt_id, answers);
        await finishReading(m.store, ME, s.data.attempt_id, undefined);
      }
    }
  })();
  const json = (r: { ok: boolean; status?: number; error?: string; data?: unknown; [k: string]: unknown }, key: string) => {
    const { ok, status, data, ...rest } = r;
    return new Response(JSON.stringify(ok ? { ok: true, [key]: data } : { ok: false, ...rest }), { status: ok ? 200 : (status ?? 500) });
  };
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.origin);
    if (!/^\/api\/(oracle|identity)\//.test(url.pathname)) return realFetch(input, init);
    await ready;
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    const now = new Date();
    switch (url.pathname) {
      case "/api/oracle/me": return json(await oracleStatus(m.store, ME, now), "oracle");
      case "/api/oracle/start": return json(await startReading(m.store, ME, body.start_key, now), "reading");
      case "/api/oracle/answer": return json(await answerBatch(m.store, ME, body.attempt_id, body.answers), "progress");
      case "/api/oracle/finish": return json(await finishReading(m.store, ME, body.attempt_id, body.tie_answers), "result");
      case "/api/identity/me": return json(await me(m.store, ME), "identity");
      case "/api/identity/settings": return json(await updateSettings(m.store, ME, body), "settings");
      default: return new Response(JSON.stringify({ ok: false, error: "Not in the demo" }), { status: 404 });
    }
  };
}
