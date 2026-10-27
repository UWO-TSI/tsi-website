/**
 * The catalogue editor: every catchable and forageable species in the game (data.js, built from the roster by
 * build.mjs), with its rarity, sell price, hours, months, biome, weather, rain-any-hour, size and one-liner editable.
 * Each species' changes save to the page's db as one doc in `species` (its key), holding only the fields that differ
 * from the game; web/scripts/apply-species.mjs writes an export of them back into the roster.
 */
(() => {
  const C = window.CATALOGUE, root = document.getElementById("root");
  const BY = new Map(C.species.map(s => [s.key, s]));
  const TABS = [["fish", "Fish"], ["sea", "Sea creatures"], ["bug", "Bugs"], ["fruit", "Fruit"], ["nature", "Shells, mushrooms, flowers"], ["mineral", "Minerals"]];
  const KIND = Object.fromEntries(TABS);
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const FIELDS = ["rarity", "price", "hours", "months", "biome", "weather", "rainAnyHour", "size", "oneLiner"];
  const LABEL = { rarity: "Rarity", price: "Sell price", hours: "Time of day", months: "Months", biome: "Biome", weather: "Weather", rainAnyHour: "Rain any hour", size: "Size", oneLiner: "One-liner" };

  /** key -> { field: value } for the fields that differ from the game. */
  let edits = {};
  let tab = "fish", query = "", db = null, dbState = "connecting", failed = null;
  const views = new Map(), timers = new Map(), saving = new Set(), lastHours = new Map(), opened = new Set();

  // ── values ──────────────────────────────────────────────────────────────────
  const order = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const norm = (f, v) => (Array.isArray(v) && (f === "months" || f === "weather") ? [...v].sort(order) : v);
  const same = (f, a, b) => JSON.stringify(norm(f, a)) === JSON.stringify(norm(f, b));
  const cur = (s, f) => (edits[s.key] && f in edits[s.key] ? edits[s.key][f] : s[f]);
  const tablePrice = (s, rarity) => C.sellPrices[s.category]?.[rarity] ?? null;
  const priceOf = s => cur(s, "price") ?? tablePrice(s, cur(s, "rarity"));
  const changedCount = keys => keys.filter(k => edits[k]).length;
  const biomes = s => (s.tool === "rod" ? C.waterBiomes : C.landBiomes);

  const hh = h => `${h}:00`;
  /** Months as runs, wrapping the new year: [11, 12, 1, 2] is "Nov to Feb". */
  const runs = months => {
    const set = new Set(months), next = m => (m % 12) + 1, prev = m => ((m + 10) % 12) + 1, out = [];
    if (set.size === 12) return "All year";
    for (let m = 1; m <= 12; m++) {
      if (!set.has(m) || set.has(prev(m))) continue;
      let end = m;
      while (set.has(next(end))) end = next(end);
      out.push(end === m ? MONTHS[m - 1] : `${MONTHS[m - 1]} to ${MONTHS[end - 1]}`);
    }
    return out.join(", ");
  };
  const show = {
    rarity: v => v[0].toUpperCase() + v.slice(1),
    price: v => (v === null ? "rarity table" : `${v} coins`),
    hours: v => (v ? `${hh(v[0])} to ${hh(v[1])}${v[1] < v[0] ? " (overnight)" : ""}` : "All day"),
    months: v => (v.length ? runs(v) : "All year"),
    biome: v => v.replace(/_/g, " "),
    weather: v => (v.length ? v.join(", ") : "Any weather"),
    rainAnyHour: v => (v ? "Yes" : "No"),
    size: v => (v ? `${v[0]} to ${v[1]} cm` : "none"),
    oneLiner: v => (v ? `"${v}"` : "none"),
  };

  /** Set one field; a value equal to the game's drops the edit. */
  function set(key, f, v) {
    const s = BY.get(key);
    if (f === "hours" && v && v[0] % 24 === v[1] % 24) v = null;
    if (f === "price" && v !== null && v === tablePrice(s, cur(s, "rarity")) && s.price === null) v = null;
    const e = (edits[key] ??= {});
    if (same(f, v, s[f])) delete e[f]; else e[f] = norm(f, v);
    if (!Object.keys(e).length) delete edits[key];
    sync(key);
    queueSave(key);
  }

  // ── saving ──────────────────────────────────────────────────────────────────
  function queueSave(key) {
    if (!db) return;
    clearTimeout(timers.get(key));
    saving.add(key);
    status();
    timers.set(key, setTimeout(() => save(key), 500));
  }
  async function save(key) {
    timers.delete(key);
    const ref = db.collection("species").doc(key);
    try {
      if (edits[key]) await ref.set(JSON.parse(JSON.stringify(edits[key])));
      else await ref.delete();
      failed = null;
    } catch (e) {
      failed = `Couldn't save ${BY.get(key).name} (${e?.code ?? e?.message ?? "error"}). Change it again to retry.`;
    }
    saving.delete(key);
    status();
  }
  /** Saved docs, kept to known fields that still differ from the game. */
  function clean(key, data) {
    const s = BY.get(key), out = {};
    for (const f of FIELDS) if (data && f in data && !same(f, data[f], s[f])) out[f] = data[f];
    return Object.keys(out).length ? out : null;
  }
  async function connect() {
    try {
      db = window.claude?.use ? await window.claude.use("db") : null;
    } catch { db = null; }
    if (!db) { dbState = "none"; status(); return; }
    try {
      const snap = await db.collection("species").limit(1000).get(), local = edits;
      edits = {};
      for (const d of snap.docs) if (BY.has(d.id)) { const e = clean(d.id, d.data()); if (e) edits[d.id] = e; }
      for (const [k, e] of Object.entries(local)) { edits[k] = { ...edits[k], ...e }; queueSave(k); }
      dbState = "ready";
    } catch (e) {
      dbState = "error";
      failed = `Couldn't read the saved changes (${e?.code ?? e?.message ?? "error"}). Reload to try again.`;
    }
    status();
    list();
  }

  // ── dom ─────────────────────────────────────────────────────────────────────
  function h(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "class") el.className = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) el.append(c);
    return el;
  }
  let statusEl, alertEl, listEl, tabsEl;
  function status() {
    if (!statusEl) return;
    const text = dbState === "connecting" ? "Connecting to the page's database..." : dbState === "ready"
      ? (saving.size ? "Saving..." : "All changes saved") : "";
    statusEl.textContent = text;
    const alert = dbState === "none" ? "This view can't save: there's no database here. Changes stay on this page until you reload." : failed;
    alertEl.hidden = !alert;
    alertEl.textContent = alert ?? "";
  }

  function render() {
    root.replaceChildren(
      h("header", {}, h("h1", {}, "Catalogue editor"),
        h("p", {}, `Every fish, sea creature, bug, fruit, shell, mushroom, flower and mineral in the game (${C.species.length}), as the game has them on ${C.built}. Changes save here; the team applies them to the game.`)),
      h("div", { class: "bar" },
        h("input", { type: "search", placeholder: "Search every kind", "aria-label": "Search species", value: query, oninput: e => { query = e.target.value; list(); } }),
        statusEl = h("span", { class: "status", role: "status" })),
      alertEl = h("p", { class: "status bad", role: "alert", hidden: true }),
      tabsEl = h("nav", { role: "tablist", "aria-label": "Kinds" }),
      listEl = h("ul", { class: "list" }));
    status();
    list();
  }
  function tabs() {
    tabsEl.replaceChildren(...TABS.map(([id, name]) => {
      const keys = C.species.filter(s => s.category === id).map(s => s.key), n = changedCount(keys);
      return h("button", { role: "tab", "aria-selected": String(id === tab && !query), onclick: () => { tab = id; query = ""; root.querySelector("input[type=search]").value = ""; list(); } },
        name, h("span", { class: "count" }, String(keys.length), n ? [" · ", h("b", {}, `${n} changed`)] : null));
    }));
  }
  function list() {
    tabs();
    const q = query.trim().toLowerCase();
    const shown = q ? C.species.filter(s => `${s.name} ${s.key} ${cur(s, "oneLiner")}`.toLowerCase().includes(q)) : C.species.filter(s => s.category === tab);
    views.clear();
    listEl.replaceChildren(...shown.map(item));
    if (!shown.length) listEl.append(h("li", { class: "empty" }, "Nothing matches."));
  }

  function item(s) {
    const v = { s, fields: {} };
    const summary = h("summary");
    const det = h("details", { ontoggle: () => {
      det.open ? opened.add(s.key) : opened.delete(s.key);
      if (det.open && !v.editor) { v.editor = editor(s, v); det.append(v.editor); paint(v); }
    } }, summary);
    v.det = det; v.summary = summary;
    views.set(s.key, v);
    paint(v);
    if (opened.has(s.key)) det.open = true;
    return h("li", {}, det);
  }

  function sync(key) {
    tabs();
    if (views.has(key)) paint(views.get(key));
  }
  function paint(v) {
    const s = v.s, e = edits[s.key];
    v.det.classList.toggle("changed", !!e);
    const r = cur(s, "rarity");
    v.summary.replaceChildren(
      h("img", { src: `icons/${s.key}.webp`, alt: "", loading: "lazy", width: 48, height: 48 }),
      h("div", {},
        h("div", {}, h("span", { class: "name" }, s.name), query ? h("span", { class: "kind" }, KIND[s.category]) : null),
        h("div", { class: "line" }, cur(s, "oneLiner") || "No one-liner yet."),
        h("div", { class: "chips" },
          h("span", { class: "chip" }, h("span", { class: "dot", style: `background:${C.colors[r]}` }), show.rarity(r)),
          h("span", { class: "chip" }, `${priceOf(s)} coins`),
          h("span", { class: "chip" }, show.hours(cur(s, "hours"))),
          h("span", { class: "chip" }, show.months(cur(s, "months"))),
          h("span", { class: "chip" }, show.biome(cur(s, "biome"))))),
      h("span", { class: "badge", hidden: !e }, "changed"));
    for (const [f, fv] of Object.entries(v.fields)) {
      if (show[f]) fv.was.textContent = e && f in e ? `was ${show[f](s[f])}` : "";
      fv.sync();
    }
  }

  // ── the editor ──────────────────────────────────────────────────────────────
  function field(v, f, body, sync, wide) {
    const was = h("span", { class: "was" });
    v.fields[f] = { was, sync };
    return h("div", { class: `field${wide ? " wide" : ""}` }, h("div", { class: "label" }, h("span", {}, LABEL[f]), was), body);
  }
  const pressed = (el, on) => el.setAttribute("aria-pressed", String(!!on));

  function editor(s, v) {
    const k = s.key, out = h("div", { class: "edit" });

    // rarity
    const rb = C.rarities.map(r => h("button", { type: "button", onclick: () => set(k, "rarity", r) }, h("span", { class: "dot", style: `background:${C.colors[r]}` }), show.rarity(r)));
    out.append(field(v, "rarity", h("div", { class: "seg", role: "group", "aria-label": "Rarity" }, rb), () => rb.forEach((b, i) => pressed(b, C.rarities[i] === cur(s, "rarity")))));

    // sell price
    const pin = h("input", { type: "number", min: 1, step: 1, inputmode: "numeric", "aria-label": "Sell price in coins" });
    const perr = h("div", { class: "err" }), phint = h("div", { class: "hint" });
    const ptable = h("button", { type: "button", class: "reset", onclick: () => set(k, "price", null) }, "Use the rarity table");
    pin.addEventListener("change", () => {
      const n = Number(pin.value);
      if (!Number.isInteger(n) || n < 1) { perr.textContent = "A whole number of coins, 1 or more."; return; }
      perr.textContent = "";
      set(k, "price", n);
    });
    out.append(field(v, "price", h("div", {}, h("div", { class: "row" }, pin, h("span", {}, "coins"), ptable), phint, perr), () => {
      if (document.activeElement !== pin) pin.value = priceOf(s);
      const own = cur(s, "price") !== null, r = cur(s, "rarity");
      phint.textContent = own ? `Its own price. The ${r} ${KIND[s.category].toLowerCase()} rate is ${tablePrice(s, r)}.` : `The ${r} ${KIND[s.category].toLowerCase()} rate. Type a number to give it its own price.`;
      ptable.hidden = !own;
    }));

    // time of day: a 24-hour bar, a handle at each end of the window; dragging the bar paints a new one
    const cells = Array.from({ length: 24 }, () => h("i"));
    const grid = h("div", { class: "cells", "aria-hidden": "true" }, cells);
    const startH = h("button", { type: "button", class: "h", role: "slider", "aria-label": "Starts at", "aria-valuemin": 0, "aria-valuemax": 23 });
    const endH = h("button", { type: "button", class: "h", role: "slider", "aria-label": "Ends at", "aria-valuemin": 1, "aria-valuemax": 24 });
    const bar = h("div", { class: "hours" }, grid, startH, endH);
    const allDay = h("input", { type: "checkbox" }), readout = h("div", { class: "hint" });
    const hours = () => cur(s, "hours");
    const setHours = hv => { if (hv) lastHours.set(k, hv); set(k, "hours", hv); };
    allDay.addEventListener("change", () => setHours(allDay.checked ? null : (lastHours.get(k) ?? s.hours ?? [6, 18])));
    const at = (x, round) => { const r = grid.getBoundingClientRect(), t = Math.min(1, Math.max(0, (x - r.left) / r.width)) * 24; return round ? Math.round(t) : Math.min(23, Math.floor(t)); };
    const moveStart = b => { const [, e] = hours(); b = ((b % 24) + 24) % 24; if (b !== e % 24) setHours([b, e]); };
    const moveEnd = b => { const [st] = hours(); b = ((b % 24) + 24) % 24 || 24; if (b % 24 !== st) setHours([st, b]); };
    for (const [el, move, idx] of [[startH, moveStart, 0], [endH, moveEnd, 1]]) {
      el.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); el.setPointerCapture(e.pointerId); el.focus(); el.dataset.drag = "1"; });
      el.addEventListener("pointermove", e => { if (el.dataset.drag) move(at(e.clientX, true)); });
      el.addEventListener("pointerup", () => delete el.dataset.drag);
      el.addEventListener("pointercancel", () => delete el.dataset.drag);
      el.addEventListener("keydown", e => {
        const step = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key];
        if (!step || !hours()) return;
        e.preventDefault();
        move(hours()[idx] + step);
      });
    }
    let anchor = null;
    grid.addEventListener("pointerdown", e => { e.preventDefault(); grid.setPointerCapture(e.pointerId); anchor = at(e.clientX); setHours([anchor, anchor + 1]); });
    grid.addEventListener("pointermove", e => { if (anchor === null) return; const c = at(e.clientX); setHours(c >= anchor ? [anchor, c + 1] : [c, anchor + 1]); });
    grid.addEventListener("pointerup", () => (anchor = null));
    grid.addEventListener("pointercancel", () => (anchor = null));
    const ticks = h("div", { class: "ticks", "aria-hidden": "true" }, ["0", "6", "12", "18", "24"].map(t => h("span", {}, t)));
    out.append(field(v, "hours", h("div", {}, h("label", { class: "row" }, allDay, "All day"), bar, ticks, readout), () => {
      const hv = hours(), inside = c => hv && (hv[0] <= hv[1] ? c >= hv[0] && c < hv[1] : c >= hv[0] || c < hv[1]);
      allDay.checked = !hv;
      bar.classList.toggle("off", !hv);
      cells.forEach((c, i) => c.classList.toggle("on", !hv || inside(i)));
      startH.hidden = endH.hidden = !hv;
      if (hv) {
        startH.style.left = `${(hv[0] / 24) * 100}%`; endH.style.left = `${(hv[1] / 24) * 100}%`;
        startH.setAttribute("aria-valuenow", hv[0]); startH.setAttribute("aria-valuetext", hh(hv[0]));
        endH.setAttribute("aria-valuenow", hv[1]); endH.setAttribute("aria-valuetext", hh(hv[1]));
      }
      readout.textContent = hv ? `Out from ${show.hours(hv)}. Drag the handles, or drag across the bar to paint a new window.` : "Out all day.";
    }, true));

    // months
    const mb = MONTHS.map((m, i) => h("button", { type: "button", "aria-label": MONTH_NAMES[i], onclick: () => {
      const all = cur(s, "months"), on = new Set(all.length ? all : MONTHS.map((_, j) => j + 1));
      on.has(i + 1) ? on.delete(i + 1) : on.add(i + 1);
      if (on.size) set(k, "months", on.size === 12 ? [] : [...on]);
    } }, m));
    const year = h("button", { type: "button", onclick: () => set(k, "months", []) }, "All year");
    out.append(field(v, "months", h("div", {}, h("div", { class: "seg months", role: "group", "aria-label": "Months" }, mb), h("div", { class: "seg", style: "margin-top:4px" }, year)), () => {
      const all = cur(s, "months");
      mb.forEach((b, i) => pressed(b, !all.length || all.includes(i + 1)));
      pressed(year, !all.length);
    }, true));

    // biome
    const sel = h("select", { "aria-label": "Biome", onchange: e => set(k, "biome", e.target.value) }, biomes(s).map(b => h("option", { value: b }, show.biome(b))));
    out.append(field(v, "biome", h("div", {}, sel, h("div", { class: "hint" }, s.tool === "rod" ? "Where it bites: the sea, else the river (pond fish only in ponds)." : "Where it turns up on the island.")), () => (sel.value = cur(s, "biome"))));

    // weather
    const any = h("button", { type: "button", onclick: () => set(k, "weather", []) }, "Any");
    const wb = C.weathers.map(w => h("button", { type: "button", onclick: () => {
      const on = new Set(cur(s, "weather"));
      on.has(w) ? on.delete(w) : on.add(w);
      set(k, "weather", on.size === C.weathers.length ? [] : [...on]);
    } }, w));
    out.append(field(v, "weather", h("div", { class: "seg", role: "group", "aria-label": "Weather" }, any, wb), () => {
      const on = cur(s, "weather");
      pressed(any, !on.length);
      wb.forEach((b, i) => pressed(b, on.includes(C.weathers[i])));
    }));

    // rain any hour
    const rain = h("input", { type: "checkbox", onchange: e => set(k, "rainAnyHour", e.target.checked) });
    const rainHint = h("div", { class: "hint" });
    out.append(field(v, "rainAnyHour", h("div", {}, h("label", { class: "row" }, rain, "Also out in the rain, any hour"), rainHint), () => {
      rain.checked = cur(s, "rainAnyHour");
      rain.disabled = !cur(s, "hours");
      rainHint.textContent = rain.disabled ? "It's out all day already." : "";
    }));

    // size
    if (s.size) {
      const lo = h("input", { type: "number", min: 0.5, step: 0.5, "aria-label": "Smallest, cm" }), hi = h("input", { type: "number", min: 0.5, step: 0.5, "aria-label": "Largest, cm" });
      const serr = h("div", { class: "err" });
      const commit = () => {
        const a = Number(lo.value), b = Number(hi.value);
        if (!(a > 0 && b > a && Number.isFinite(b))) { serr.textContent = "Smallest above 0, largest above smallest."; return; }
        serr.textContent = "";
        set(k, "size", [a, b]);
      };
      lo.addEventListener("change", commit); hi.addEventListener("change", commit);
      out.append(field(v, "size", h("div", {}, h("div", { class: "row" }, lo, "to", hi, "cm"), serr), () => {
        const [a, b] = cur(s, "size");
        if (document.activeElement !== lo) lo.value = a;
        if (document.activeElement !== hi) hi.value = b;
      }));
    }

    // one-liner
    const line = h("input", { type: "text", maxlength: 140, "aria-label": "One-liner" });
    line.addEventListener("change", () => set(k, "oneLiner", line.value.trim()));
    out.append(field(v, "oneLiner", line, () => { if (document.activeElement !== line) line.value = cur(s, "oneLiner"); }, true));

    const reset = h("button", { type: "button", class: "reset", onclick: () => { delete edits[k]; sync(k); queueSave(k); } }, "Reset to the game's values");
    const resetBox = h("div", { class: "field wide" }, reset);
    v.fields._reset = { was: h("span"), sync: () => (reset.disabled = !edits[k]) };
    out.append(resetBox);
    return out;
  }

  render();
  connect();
})();
