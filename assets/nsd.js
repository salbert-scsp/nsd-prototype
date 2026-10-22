/* National Skills Dashboard: shared script for all three pages (Emerging, Evolving, Exposure).
   A page embeds the data (<script type="application/json" id="workforce-data">), loads this file, then calls
   mountShell(), draws its own chart and sections, and hands startPage() a render(entity) function.
   Everything here is the same on every tab: data and selection, tabs, search, featured shortcuts, the rank list,
   tooltips, keyboard charts, sections, tables. */
const $ = (id) => document.getElementById(id);
const W = JSON.parse($("workforce-data").textContent);   // written by public_data/build_prototype_data.py
const NS = "http://www.w3.org/2000/svg";
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const fmt = new Intl.NumberFormat("en-US");
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const rnd1 = (v) => Math.round(v * 10) / 10 || 0;                      // round first, so -0.04 reads as 0.0
const pct = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1) + "%";
const chg = (v) => (!v ? "" : v < 0 ? "neg" : "pos");
const lcAll = (s) => s.toLowerCase();
const plural = (n, one, many) => `${fmt.format(n)} ${n === 1 ? one : many || one + "s"}`;
function svgEl(tag, attrs, parent) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
function txt(parent, x, y, s, attrs = {}) { const t = svgEl("text", { x, y, ...attrs }, parent); t.textContent = s; return t; }

/* ---------- the data, with every change computed here ---------- */
const Y = W.years, YL = { "19": "May 2019", "21": "May 2021", "23": "May 2023", "25": "May 2025" };
const TOL = W.settings.pay_tolerance_pct, CPI = W.cpi_u.annual_average;
const infl = (a, b) => CPI["20" + b] / CPI["20" + a];
const chgPct = (a, b) => (a && b ? rnd1((b / a - 1) * 100) : null);                       // jobs, wages: nominal
const realPct = (w0, w1, y0, y1) => (w0 && w1 ? rnd1(((w1 / w0) / infl(y0, y1) - 1) * 100) : null);   // pay after inflation
const band = (v) => (v === null ? null : v > TOL ? "ahead" : v < -TOL ? "behind" : "even");
const short = (g) => g.name.replace(/ Occupations$/, "");
const GROUPS = W.groups.map((g) => ({ ...g, j19: chgPct(g.emp[0], g.emp[3]), j21: chgPct(g.emp[1], g.emp[3]), r19: realPct(g.wage[0], g.wage[3], "19", "25") }));
const GBY = Object.fromEntries(GROUPS.map((g) => [g.code, g]));
const OCC = W.occupations.map((o) => ({ ...o, grp: GBY[o.g], j19: chgPct(o.emp[0], o.emp[3]), j21: chgPct(o.emp[1], o.emp[3]),
  r19: realPct(o.w[0], o.w[3], "19", "25"), r21: realPct(o.w[1], o.w[3], "21", "25"), pr: o.proj ? rnd1(o.proj.pct) : null }));
const OBY = Object.fromEntries(OCC.map((o) => [o.soc, o]));
const FEAT = Object.entries(W.featured).map(([key, f]) => ({ key, name: f.name, emp: f.emp, members: f.occ.map((s) => OBY[s]), j19: chgPct(f.emp[0], f.emp[3]) }));
const FBY = Object.fromEntries(FEAT.map((f) => [f.key, f]));
const ALLJ = chgPct(W.total.emp[0], W.total.emp[3]), ALLJ21 = chgPct(W.total.emp[1], W.total.emp[3]);
const comparable = (list) => list.filter((o) => o.own19 && o.r19 !== null);        // † occupations never enter a count
const dagger = (list) => list.filter((o) => !o.own19).length;
const ud = (v, fig) => (v === 0 ? "unchanged" : (v > 0 ? "up " : "down ") + (fig ? `<button type="button" class="fig" data-line="${fig}" aria-label="${Math.abs(v).toFixed(1)}%. Highlight this line on the chart">${Math.abs(v).toFixed(1)}%</button>` : Math.abs(v).toFixed(1) + "%"));

/* ---------- the selection: all occupations, one group, one featured field, or one occupation ---------- */
let sel = { type: "all", id: "" };
function entityOf(s) {
  if (s.type === "group") { const g = GBY[s.id]; return { type: "group", id: g.code, name: g.name, short: short(g), emp: g.emp, members: OCC.filter((o) => o.g === g.code), parent: null, g }; }
  if (s.type === "featured") { const f = FBY[s.id]; return { type: "featured", id: f.key, name: f.name, short: f.name, emp: f.emp, members: f.members, parent: null, f }; }
  if (s.type === "occ") { const o = OBY[s.id]; return { type: "occ", id: o.soc, name: o.t, short: o.t, emp: o.emp, members: [o], parent: o.grp, o }; }
  return { type: "all", id: "", name: "All occupations", short: "All occupations", emp: W.total.emp, members: OCC, parent: null };
}
const baseIdx = (e) => (e.type === "occ" && !e.o.own19 ? 1 : 0);    // an occupation with no 2019 row is compared from May 2021
const hashOf = (s) => (s.type === "all" ? "" : "#" + { group: "g", featured: "f", occ: "o" }[s.type] + "=" + s.id);
function selFromHash() {
  const m = location.hash.match(/^#([gfo])=([\w-]+)$/); if (!m) return { type: "all", id: "" };
  const s = { type: { g: "group", f: "featured", o: "occ" }[m[1]], id: m[2] };
  return (s.type === "group" && GBY[s.id]) || (s.type === "featured" && FBY[s.id]) || (s.type === "occ" && OBY[s.id]) ? s : { type: "all", id: "" };
}
let onSelect = () => {};
let occReturn = null;   // the group the reader was in when they picked an occupation; the card's close button goes back to it
function setSel(s, quiet) {
  if (s.type !== "occ") occReturn = null; else if (sel.type !== "occ") occReturn = sel.type === "group" ? sel : null;
  sel = s; try { history.replaceState(null, "", hashOf(s) || location.pathname); } catch (e) {}
  if (!quiet) $("live").textContent = `Showing ${entityOf(s).name}.`;
  onSelect(entityOf(s));
}
const fadeIn = (ids) => ids.forEach((id) => { const el = $(id); if (!el) return; el.classList.remove("fade"); void el.offsetWidth; el.classList.add("fade"); });
/* the occupations the selection stands for: an occupation shows its group for context */
const listOf = (e) => (e.type === "occ" ? OCC.filter((o) => o.g === e.o.g) : e.members);
const inSel = (e, o) => e.type === "all" || (e.type === "group" && o.g === e.id) || (e.type === "featured" && e.members.includes(o)) || (e.type === "occ" && o.soc === e.id);

/* The occupation card: a round close button in its corner. Closing goes back to the group the reader came from, or to all occupations. */
const cardX = (name) => `<button type="button" class="card-x" data-close aria-label="Close ${esc(name)}"><span aria-hidden="true">×</span></button>`;
function closeCard() {
  if (sel.type !== "occ") return;
  const soc = sel.id; setSel(occReturn || { type: "all", id: "" });
  const back = [...document.querySelectorAll(`[data-pick="${soc}"]`)].find((b) => b.offsetParent !== null && (!b.closest("details") || b.closest("details").open)), top = $("headline");
  if (back) back.focus(); else { top.setAttribute("tabindex", "-1"); top.focus(); }
}
/* ---------- tooltips: any mark with data-t / data-v / data-s ---------- */
function moveTip(ev) { const tip = $("tip"), w = tip.offsetWidth, h = tip.offsetHeight; let x = ev.clientX + 14, y = ev.clientY + 14; if (x + w > innerWidth - 8) x = ev.clientX - w - 14; if (y + h > innerHeight - 8) y = ev.clientY - h - 14; tip.style.left = Math.max(8, x) + "px"; tip.style.top = Math.max(8, y) + "px"; }
function showTip(html, ev) { const tip = $("tip"); tip.innerHTML = html; tip.hidden = false; moveTip(ev); }
function hideTip() { const tip = $("tip"); if (tip) tip.hidden = true; }
const tipHtml = (el) => { const d = el.dataset; return `<b>${esc(d.t)}</b>${esc(d.v)}${d.s ? `<span class="tip__src">${esc(d.s)}</span>` : ""}`; };
function setTip(el, t, v, s) { el.setAttribute("data-t", t); el.setAttribute("data-v", v); el.setAttribute("data-s", s); }
const tipData = (t, v, s) => ` data-t="${esc(t)}" data-v="${esc(v)}" data-s="${esc(s)}"`;
document.addEventListener("mousemove", (ev) => { const el = ev.target.closest && ev.target.closest("[data-t]"); if (el) showTip(tipHtml(el), ev); else hideTip(); });
document.addEventListener("mouseout", (ev) => { if (!ev.relatedTarget) hideTip(); });
let kbUntil = 0;
addEventListener("scroll", () => { if (performance.now() > kbUntil) hideTip(); }, true);
const clearKb = () => document.querySelectorAll(".kb-on").forEach((e) => e.classList.remove("kb-on"));
document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") { hideTip(); clearKb(); } });
/* One tab stop per chart or bar list; arrow keys step through its marks, Enter picks one where that is offered. */
function kbChart(box, label, opts = {}) {
  box.setAttribute("tabindex", "0"); box.setAttribute("role", "group"); box.setAttribute("aria-label", label); box.setAttribute("aria-describedby", "kb-help");
  let i = -1;
  const marks = () => { const m = [...box.querySelectorAll("[data-t]")].filter((x) => !x.closest("[hidden]")); if (opts.sortByX) m.sort((a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return (ra.x - rb.x) || (ra.y - rb.y); }); return m; };
  const show = (m, n) => {
    if (!m.length) return; i = Math.max(0, Math.min(m.length - 1, n));
    clearKb(); const el = m[i]; el.classList.add("kb-on"); kbUntil = performance.now() + 400;
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
    const r = el.getBoundingClientRect(), d = el.dataset;
    showTip(tipHtml(el), { clientX: r.left + r.width / 2 - 14, clientY: r.bottom });
    $("live").textContent = `${d.t}. ${d.v}. ${d.s || ""}`;
  };
  box.addEventListener("focus", () => { if (box.matches(":focus-visible")) show(marks(), 0); });
  box.addEventListener("blur", () => { hideTip(); clearKb(); i = -1; });
  box.addEventListener("keydown", (ev) => {
    const m = marks(), step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1, PageDown: 10, PageUp: -10 }[ev.key];
    if (step !== undefined) show(m, i < 0 ? 0 : i + step);
    else if (ev.key === "Home") show(m, 0);
    else if (ev.key === "End") show(m, m.length - 1);
    else if ((ev.key === "Enter" || ev.key === " ") && opts.onPick && i >= 0) opts.onPick(m[i]);
    else return;
    ev.preventDefault();
  });
}
/* Redraw a chart at its container's real width, so text never has to shrink. */
function responsive(box, draw) {
  let w = 0; const run = (force) => { const nw = Math.round(box.clientWidth); if (nw && (force || nw !== w)) { w = nw; draw(nw); } };
  new ResizeObserver(() => run(false)).observe(box); run(true);
  return () => run(true);
}

/* ---------- search: any group, featured field or detailed occupation (an accessible combobox) ---------- */
const ITEMS = [
  ...GROUPS.map((g) => ({ type: "group", id: g.code, label: short(g), sub: `Group of occupations · ${g.code}`, jobs: g.emp[3] })),
  ...FEAT.map((f) => ({ type: "featured", id: f.key, label: f.name, sub: "Featured field", jobs: f.emp[3] })),
  ...OCC.map((o) => ({ type: "occ", id: o.soc, label: o.t, sub: `${o.soc} · ${short(o.grp)}${o.own19 ? "" : " · no 2019 figure (†)"}`, jobs: o.emp[3] || 0 })),
].map((it) => ({ ...it, hay: (it.label + " " + it.id).toLowerCase(), words: it.label.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean) }));
/* Best matches first: the label starts with, or has as a whole word (plural too), what was typed; then words that begin with it;
   then anywhere. Within a tier the occupation with the most jobs comes first, so "nurse" finds registered nurses before nurseries. */
function searchResults(q) {
  const toks = q.toLowerCase().split(/\s+/).filter(Boolean); if (!toks.length) return [];
  const tier = (it) => { const t = toks[0]; return it.label.toLowerCase().startsWith(t) || it.words.some((w) => w === t || w === t + "s" || w === t + "es") ? 0 : it.words.some((w) => w.startsWith(t)) || it.id.startsWith(t) ? 1 : 2; };
  return ITEMS.filter((it) => toks.every((t) => it.hay.includes(t))).map((it) => ({ it, s: tier(it) }))
    .sort((a, b) => (a.s - b.s) || (b.it.jobs - a.it.jobs) || a.it.label.localeCompare(b.it.label)).slice(0, 10).map((x) => x.it);
}
function mountSearch(root, label) {
  root.classList.add("search");
  root.innerHTML = `<label for="q-${root.id}">${esc(label)}</label><input id="q-${root.id}" type="search" role="combobox" aria-expanded="false" aria-controls="ql-${root.id}" aria-autocomplete="list" autocomplete="off" placeholder="Try nurses, 15-1252 or computer"><ul id="ql-${root.id}" role="listbox" hidden></ul>`;
  const input = root.querySelector("input"), list = root.querySelector("ul"); let res = [], act = -1;
  const close = () => { list.hidden = true; input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant"); act = -1; };
  const paint = () => {
    if (!input.value.trim()) return close();
    res = searchResults(input.value);
    list.innerHTML = res.length ? res.map((it, i) => `<li role="option" id="${root.id}-o${i}" data-i="${i}" aria-selected="${i === act}"><b>${esc(it.label)}</b><span>${esc(it.sub)}</span></li>`).join("") : `<li class="none" role="presentation">No occupation or group matches “${esc(input.value)}”.</li>`;
    list.hidden = false; input.setAttribute("aria-expanded", "true");
    if (act >= 0) input.setAttribute("aria-activedescendant", `${root.id}-o${act}`); else input.removeAttribute("aria-activedescendant");
  };
  const pick = (it) => { input.value = ""; close(); setSel({ type: it.type, id: it.id }); };
  input.addEventListener("input", () => { act = -1; paint(); });
  input.addEventListener("focus", paint);
  input.addEventListener("blur", () => setTimeout(close, 120));
  input.addEventListener("keydown", (ev) => {
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") { if (!res.length) return; act = (act + (ev.key === "ArrowDown" ? 1 : -1) + res.length) % res.length; paint(); list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" }); ev.preventDefault(); }
    else if (ev.key === "Enter" && res.length && !list.hidden) { pick(res[act >= 0 ? act : 0]); ev.preventDefault(); }
    else if (ev.key === "Escape") { if (!list.hidden) { close(); ev.stopPropagation(); ev.preventDefault(); } }
  });
  list.addEventListener("mousedown", (ev) => { const li = ev.target.closest("li[data-i]"); if (li) { ev.preventDefault(); pick(res[+li.dataset.i]); } });
}
function mountFeatured(root) {
  root.className = "chips"; root.setAttribute("role", "group"); root.setAttribute("aria-label", "Featured fields");
  root.innerHTML = `<span class="chips__t">Featured</span>` + FEAT.map((f) => `<button type="button" class="chip-btn" data-k="${f.key}" aria-pressed="false">${esc(f.name)}</button>`).join("");
  // a second click on the selected field goes back to all occupations
  root.addEventListener("click", (ev) => { const b = ev.target.closest("[data-k]"); if (b) setSel(sel.type === "featured" && sel.id === b.dataset.k ? { type: "all", id: "" } : { type: "featured", id: b.dataset.k }); });
}
const syncFeatured = () => document.querySelectorAll(".chip-btn").forEach((b) => b.setAttribute("aria-pressed", sel.type === "featured" && sel.id === b.dataset.k));
/* One visible way back: shown whenever a group, field or occupation is selected. */
function mountReset(root) {
  root.innerHTML = `<button type="button" class="reset-btn" hidden><span aria-hidden="true">×</span> <span class="reset-btn__t"></span></button>`;
  root.querySelector("button").addEventListener("click", () => { setSel({ type: "all", id: "" }); followGroup(); $("q-s1")?.focus(); });
}
const syncReset = () => { const b = document.querySelector(".reset-btn"); if (!b) return; b.hidden = sel.type === "all"; b.querySelector(".reset-btn__t").textContent = sel.type === "all" ? "" : `Clear “${entityOf(sel).short}” and show all occupations`; };

/* ---------- the same page on every tab ---------- */
const TABS = [{ id: "emerging", href: "emerging.html", label: "Emerging titles & skills", short: "Emerging" }, { id: "evolving", href: "evolving.html", label: "Evolving occupations", short: "Evolving" }, { id: "exposure", href: "exposure.html", label: "Exposure & transitions", short: "Exposure" }];
const syncTabs = () => document.querySelectorAll(".mast__nav a").forEach((a) => { a.href = TABS.find((t) => t.id === a.dataset.tab).href; });   // the tabs are plain links: a selection stays on the page it was made on
const EYEBROWS = { emerging: { chart: "New tasks, by year" }, evolving: { chart: "Jobs and pay, by occupation" }, exposure: { chart: "Exposure and pay, by occupation" } };
/* Two-tone headline: the first number (with its "up" or "down") is wrapped in a mark so the stylesheet can color it. Text is untouched. */
const KEY_NUMBER = /(?:(?:up|down) )?[−+-]?\d+(?:,\d{3})*(?:\.\d+)?%?/g, BARE_YEAR = /^(?:19|20)\d\d$/;   // a bare year is not the key number
function markKeyNumber(root) {
  if (root.querySelector(".hl")) return;
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const m = [...n.nodeValue.matchAll(KEY_NUMBER)].find((x) => !BARE_YEAR.test(x[0])); if (!m) continue;
    const span = document.createElement("span"); span.className = "hl"; span.textContent = m[0];
    const after = n.splitText(m.index); after.nodeValue = after.nodeValue.slice(m[0].length); n.parentNode.insertBefore(span, after); return;
  }
}
function mountHeadlineMark(h) {
  const obs = new MutationObserver(() => { obs.disconnect(); markKeyNumber(h); obs.observe(h, { childList: true, characterData: true, subtree: true }); });
  obs.observe(h, { childList: true, characterData: true, subtree: true });
}
function mountShell(cfg) {
  const ey = EYEBROWS[cfg.page] || {};
  document.body.insertAdjacentHTML("afterbegin", `<header class="mast"><div class="mast__in">
    <div class="mast__brand"><img class="mast__logo" src="assets/scsp-logo.png" width="647" height="130" alt="Special Competitive Studies Project"><span class="mast__rule" aria-hidden="true"></span><span class="mast__name">National Skills Dashboard</span></div>
    <nav class="mast__nav" aria-label="Dashboard sections">${TABS.map((t) => `<a href="${t.href}" data-tab="${t.id}" title="${esc(t.label)}" aria-label="${esc(t.label)}"${t.id === cfg.page ? ' aria-current="page"' : ""}>${esc(t.short)}</a>`).join("")}</nav></div></header>
  <main class="layout">
    <aside class="rail" aria-label="Choose what to look at">
      <div id="s1"></div><div id="reset"></div>
      <h1 class="headline-b" id="headline"></h1>
      <p class="payline" id="subline"></p>
      <p class="context" id="context"></p>
      <div><p class="eyebrow">Groups of occupations</p><h2 class="rank-h">${esc(cfg.rankTitle)}</h2><div class="rank" id="rank" role="group" aria-label="${esc(cfg.rankLabel)}"></div><p class="note" id="rank-note" style="margin-top:10px"></p></div>
    </aside>
    <div class="main">
      <figure class="plate" id="plate"><p class="eyebrow">${esc(ey.chart || "")}</p><div class="chart" id="chart"></div><p class="note"><span id="chart-note"></span><span id="clip-note"></span></p></figure>
      <p class="method" id="method" style="margin:0"></p>
      <div class="readout" id="readout" aria-live="polite"></div>
      <section aria-label="Detail" id="details"></section>
      <section aria-label="Coming with new data" id="coming"></section>
      <p class="src">Everything on this page is real BLS, O*NET or AIOE data except the section marked Sample.</p>
    </div>
  </main>
  <div class="tip" id="tip" hidden></div>
  <div id="live" class="sr" role="status" aria-live="polite"></div>
  <p id="kb-help" class="sr">Use the arrow keys to move between values, Home and End to jump, Page Up and Page Down to skip ten, Enter to pick one where that is offered, and Escape to close the tooltip.</p>`);
  $("readout").addEventListener("click", (ev) => { if (ev.target.closest("[data-close]")) closeCard(); });
  $("readout").addEventListener("keydown", (ev) => { if (ev.key === "Escape" && sel.type === "occ") { ev.preventDefault(); closeCard(); } });
  mountHeadlineMark($("headline"));
  mountSearch($("s1"), "Find any occupation or group"); mountReset($("reset")); stickHeader();   // the Featured chips were removed from the page; fields stay reachable through search
}
/* The header sticks to the top. Once the page scrolls it gets a shadow; once the scroll passes the height it can save, it switches to a compact size,
   and a margin keeps the content where it was, so nothing jumps. */
function stickHeader() {
  const m = document.querySelector(".mast"); if (!m) return;
  let diff = 0;
  const measure = () => { m.classList.remove("is-compact"); m.style.marginBottom = ""; const full = m.offsetHeight; m.classList.add("is-compact"); diff = full - m.offsetHeight; m.classList.remove("is-compact"); };
  const apply = () => {
    const y = scrollY;
    m.classList.toggle("is-scrolled", y > 2);
    const compact = diff > 0 && y >= diff;
    if (compact !== m.classList.contains("is-compact")) { m.classList.toggle("is-compact", compact); m.style.marginBottom = compact ? diff + "px" : ""; }
  };
  addEventListener("scroll", apply, { passive: true });
  addEventListener("resize", () => { measure(); apply(); }); addEventListener("load", () => { measure(); apply(); });
  measure(); apply();
}
/* A closed section with one plain source line at its end. Returns { body, setSummary }. */
function addSection(title, summary) {
  const d = document.createElement("details"); d.innerHTML = `<summary><span class="sum__t"></span><span class="sum__s"></span></summary><div class="body"></div>`;
  $("details").appendChild(d); const t = d.querySelector(".sum__t"), s = d.querySelector(".sum__s");
  t.textContent = title; s.textContent = summary || "";
  return { el: d, body: d.querySelector(".body"), setTitle: (x) => { t.textContent = x; }, setSummary: (x) => { s.textContent = x; } };
}
/* The one place for what is not measured yet: hatched, tagged Sample, last on the page. */
function addComing(summary) {
  const d = document.createElement("details"); d.className = "coming";
  d.innerHTML = `<summary><span class="sum__t">Coming with new data</span><span class="sample-tag">Sample</span><span class="sum__s">${esc(summary)}</span></summary><div class="body"></div>`;
  $("coming").appendChild(d); return { el: d, body: d.querySelector(".body") };
}
/* The opening section above the two columns: { h, sub, tiles: [{ n, label, red, long }], note }. Text arrives already escaped; numbers are computed by the page. */
function mountHero(o) {
  document.querySelector(".layout").insertAdjacentHTML("beforebegin", `<section class="hero" aria-labelledby="hero-h"><div class="hero__in">
    <h2 class="hero__h" id="hero-h">${o.h}</h2>
    <p class="hero__sub">${o.sub}</p>
    <dl class="hero__tiles">${o.tiles.map((t) => `<div class="hero__tile${t.red ? " hero__tile--red" : ""}${t.long ? " hero__tile--long" : ""}${typeof t.long === "string" ? " hero__tile--" + t.long : ""}"><dt>${t.label}</dt><dd>${t.n}</dd></div>`).join("\n      ")}</dl>${o.note ? `<p class="hero__note">${o.note}</p>` : ""}</div></section>`);
}
const srcLine = (s) => `<p class="note">Source: ${s}</p>`;
/* Each page may set a plain-language explanation for a selected group: setExplain((code) => [sentence, ...]). Numbers go in N() so they set in mono. */
let explainGroup = null;
const setExplain = (fn) => { explainGroup = fn; };
const N = (x) => `<span class="n">${x}</span>`;
/* Each page names its occupation-list section: setGroupSection(secOcc). A click on a group opens it, un-selecting the group (same row, Escape, the Clear link) closes it; nothing else opens or closes it. */
let groupSection = null;
const setGroupSection = (sec) => { groupSection = sec.el; };
const followGroup = () => { if (groupSection) groupSection.open = sel.type === "group"; };
/* The rank list is the group selector. rows: [{ code, name, val, cls, label, bar: { mode: "div" | "lin", v, max }, bench, sub }] already sorted. */
function renderRank(rows, e) {
  $("rank").innerHTML = rows.map((r) => {
    const isSel = e.type === "group" && e.id === r.code, isPar = e.parent && e.parent.code === r.code;
    const w = Math.min(Math.abs(r.bar.v), r.bar.max) / r.bar.max * (r.bar.mode === "div" ? 50 : 100);
    const fill = r.bar.mode === "div" ? (r.bar.v >= 0 ? `left:50%;width:${w}%` : `right:50%;width:${w}%`) : `left:0;width:${w}%`;
    const bench = r.bench === undefined ? "" : `<b style="left:${r.bar.mode === "div" ? 50 + r.bench / r.bar.max * 50 : r.bench / r.bar.max * 100}%"></b>`;
    const open = isSel && explainGroup, sentences = open ? explainGroup(r.code) : [];
    return `<button type="button" class="rk" data-g="${r.code}" aria-expanded="${!!open}" ${open && sentences.length ? 'aria-controls="rk-panel"' : ""} ${isPar ? 'aria-current="true"' : ""}>
      <span class="rk__name">${esc(r.name)}</span><span class="rk__val ${r.cls || ""}" aria-label="${esc(r.label)}">${esc(r.val)}</span>
      <span class="rk__bar" aria-hidden="true">${r.bar.mode === "div" ? "<u></u>" : ""}<i style="${fill}"></i>${bench}</span>${r.sub ? `<span class="rk__sub">${esc(r.sub)}</span>` : ""}</button>${sentences.length ? `<div class="rk-panel" id="rk-panel" role="region" aria-label="${esc(r.name)}, in plain words">${sentences.map((t) => `<p>${t}</p>`).join("")}</div>` : ""}`;
  }).join("");
}
function wireRank() {
  // Escape closes the open group panel and clears the selection; focus stays on the row
  $("rank").addEventListener("keydown", (ev) => {
    const b = ev.target.closest(".rk"); if (ev.key !== "Escape" || !b || sel.type !== "group") return;
    ev.preventDefault(); setSel({ type: "all", id: "" }); followGroup(); document.querySelector(`.rk[data-g="${b.dataset.g}"]`)?.focus();
  });
  $("rank").addEventListener("click", (ev) => { const b = ev.target.closest(".rk"); if (b) { setSel(sel.type === "group" && sel.id === b.dataset.g ? { type: "all", id: "" } : { type: "group", id: b.dataset.g }); followGroup(); document.querySelector(`.rk[data-g="${b.dataset.g}"]`)?.focus(); } });
}
/* A sortable table. cols: [{ k, label, num, val(row) for sorting, html(row) for the cell }]; the first column holds the occupation button. */
const CAP = 5;
/* Long lists start short: the first CAP items, then a plain "Show all N" / "Show fewer" button after `after`. Re-rendering the list starts it short again. */
function capList(items, after, noun) {
  const old = after.nextElementSibling; if (old && old.classList.contains("more")) old.remove();
  const els = [...items]; if (els.length <= CAP) return;
  let all = false;
  const b = document.createElement("button"); b.type = "button"; b.className = "more";
  const paint = () => { els.forEach((el, i) => { el.hidden = !all && i >= CAP; }); b.textContent = all ? "Show fewer" : `Show all ${els.length}${noun ? " " + noun : ""}`; b.setAttribute("aria-expanded", String(all)); };
  b.addEventListener("click", () => { all = !all; paint(); if (!all) b.scrollIntoView({ block: "nearest" }); });
  paint(); after.after(b);
}
/* A sortable table. cols: [{ k, label, num, val(row) for sorting, html(row) for the cell }]; the first column holds the occupation button. Shows CAP rows until "Show all"; a new selection starts short again. */
function dataTable(box, spec) {
  const st = { sort: spec.sort, dir: spec.dir || -1, all: false, sel: null };
  const paint = () => {
    const key = sel.type === "occ" ? "#g=" + OBY[sel.id].g : hashOf(sel); if (key !== st.sel) { st.sel = key; st.all = false; }
    const col = spec.cols.find((c) => c.k === st.sort), rows = spec.rows().slice().sort((x, y) => { const a = col.val(x), b = col.val(y); if (a === null || a === undefined) return 1; if (b === null || b === undefined) return -1; return (a < b ? -1 : a > b ? 1 : 0) * st.dir; });
    const shown = st.all ? rows : rows.slice(0, CAP), had = document.activeElement, focusK = had && had.dataset ? had.dataset.sort : null, focusMore = had && had.matches && had.matches("[data-more]") && box.contains(had);
    box.innerHTML = `<div class="tbl${spec.cls ? " " + spec.cls : ""}" tabindex="0" role="region" aria-label="${esc(spec.label)}"><table><thead><tr>${spec.cols.map((c) => `<th class="${c.num ? "n" : ""}" aria-sort="${st.sort === c.k ? (st.dir > 0 ? "ascending" : "descending") : "none"}"><button type="button" data-sort="${c.k}">${typeof c.label === "function" ? c.label() : c.label}</button></th>`).join("")}</tr></thead>
      <tbody>${shown.map((r) => `<tr>${spec.cols.map((c) => `<td class="${c.num ? "n" : ""}">${c.html(r)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
      ${rows.length > CAP ? `<button type="button" class="more" data-more aria-expanded="${st.all}">${st.all ? "Show fewer" : `Show all ${rows.length}`}</button>` : ""}${spec.note ? spec.note() : ""}`;
    if (focusK) box.querySelector(`[data-sort="${focusK}"]`)?.focus();
    if (focusMore) { const m = box.querySelector("[data-more]"); m?.focus(); if (!st.all) m?.scrollIntoView({ block: "nearest" }); }
  };
  box.addEventListener("click", (ev) => {
    const s = ev.target.closest("[data-sort]"), m = ev.target.closest("[data-more]"), p = ev.target.closest("[data-pick]");
    if (s) { st.dir = st.sort === s.dataset.sort ? -st.dir : (s.dataset.sort === spec.cols[0].k ? 1 : -1); st.sort = s.dataset.sort; paint(); }
    else if (m) { st.all = !st.all; paint(); }
    else if (p) setSel({ type: "occ", id: p.dataset.pick });
  });
  return paint;
}
const pickBtn = (o) => `<button type="button" class="linkish" data-pick="${o.soc}">${esc(o.t)}</button><div class="soc">${o.soc}${o.own19 ? "" : ' · <span class="dag">† no 2019 figure</span>'}</div>`;
/* Start a page: wire the selection, then render once. */
function startPage(render) {
  onSelect = (e) => { syncTabs(); syncFeatured(); syncReset(); render(e); };
  addEventListener("hashchange", () => { const s = selFromHash(); if (hashOf(s) !== hashOf(sel)) { sel = s; occReturn = null; onSelect(entityOf(s)); } });
  sel = selFromHash(); onSelect(entityOf(sel));
}
