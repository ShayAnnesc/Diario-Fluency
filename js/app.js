/* Diário do Inglês: interface, cálculos e sincronização. Depende de data.js e store.js. */

/* ---------- datas ---------- */
const pad = n => String(n).padStart(2, "0");
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const diffDays = (a, b) => Math.round((parse(ymd(b)) - parse(ymd(a))) / 864e5);
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const fmtDate = d => `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
const fmtH = m => `${Math.floor(m / 60)}h${pad(m % 60)}`;
const todayStr = () => ymd(new Date());
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const $ = id => document.getElementById(id);

/* ---------- estado ---------- */
// plan: minutos de estudo por dia e dias da semana (0 = domingo … 6 = sábado)
const EMPTY = () => ({ done: {}, manual: {}, start: "", plan: { min: 60, days: [1, 2, 3, 4, 5] } });
let S = EMPTY();
let notes = {};              // "basic/1" (módulo/unidade) -> {html, updatedAt}
const LS = "diario-ingles-v1";
function lsGet(k, f) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : f; } catch { return f; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
const cacheKey = () => Store.user ? `${LS}:${Store.user.id}` : LS;
function cache() { lsSet(cacheKey(), { S, notes }); }
// Anotações salvas antes da divisão por módulo usavam a chave "u1": passam a ser "basic/1".
const migrateNotes = ns => Object.fromEntries(Object.entries(ns || {}).map(([k, v]) => [/^u\d+$/.test(k) ? `basic/${k.slice(1)}` : k, v]));
function loadCache() {
  const l = lsGet(cacheKey(), null);
  S = Object.assign(EMPTY(), l?.S || {});
  delete S.goal;   // a meta fixa foi trocada pelo planejamento
  notes = migrateNotes(l?.notes);
}
const hasData = st => st && (Object.keys(st.S?.done || {}).length || Object.keys(st.S?.manual || {}).length || Object.values(st.notes || {}).some(n => n?.html));

/* ---------- módulos ---------- */
const lessonsOf = m => m.units.flatMap(u => u.l);
const doneIn = m => lessonsOf(m).filter(l => S.done[l.id]).length;
const doneMinIn = m => lessonsOf(m).filter(l => S.done[l.id]).reduce((s, l) => s + l.min, 0);
const isComplete = m => m.units.length > 0 && doneIn(m) === lessonsOf(m).length;
const isUnlocked = i => i === 0 || isComplete(MODULES[i - 1]);
// Módulo em estudo: o primeiro liberado, com conteúdo e ainda não concluído.
const studyIdx = () => { const i = MODULES.findIndex((m, k) => isUnlocked(k) && m.units.length && !isComplete(m)); return i < 0 ? 0 : i; };
const unitDone = (m, n) => m.units[n - 1].l.filter(l => S.done[l.id]).length;
const firstOpenUnit = m => { const i = m.units.findIndex((u, k) => unitDone(m, k + 1) < u.l.length); return i < 0 ? Math.max(1, m.units.length) : i + 1; };
const noteKey = (m, n) => `${m.id}/${n}`;

let curMod = 0;                                       // módulo aberto na página do módulo
const selMap = lsGet(LS + ":units", {});              // unidade aberta em cada módulo
const mod = () => MODULES[curMod];
const sel = () => selMap[mod().id] || firstOpenUnit(mod());

/* ---------- salvamento ---------- */
// Fila única: as gravações chegam ao Supabase na mesma ordem em que aconteceram.
let queue = Promise.resolve();
function remote(fn) {
  cache();
  if (!Store.online) return;
  queue = queue.then(fn).catch(e => { console.error(e); toast("Não foi possível salvar no Supabase. A alteração ficou guardada neste navegador."); });
}
const noteTimers = {};
function saveNote(key) {
  cache();
  clearTimeout(noteTimers[key]);
  noteTimers[key] = setTimeout(() => { const n = notes[key]; remote(() => Store.setNote(key, n.html, n.updatedAt)); }, 900);
}

/* ---------- cálculos de estudo ---------- */
function studiedSet() {
  const s = new Set(Object.values(S.done));
  Object.entries(S.manual).forEach(([d, v]) => { if (v) s.add(d); });
  return s;
}
function startDate(set) {
  if (S.start) return S.start;
  return [...set].sort()[0] || todayStr();
}
/* ---------- planejamento ---------- */
const plan = () => S.plan || EMPTY().plan;
const isPlanned = s => plan().days.includes(parse(s).getDay());
const weeklyMin = () => plan().min * plan().days.length;
const avgLesson = m => m.min / m.lessons;
// Aulas por semana que cabem no planejamento: sempre inteiro, arredondado para baixo.
const plannedPerWeek = m => Math.floor(weeklyMin() / avgLesson(m));
const nextPlanned = d => { if (!plan().days.length) return d; let x = new Date(d); while (!plan().days.includes(x.getDay())) x = addDays(x, 1); return x; };
// Percorre o calendário: cada dia planejado soma os minutos do dia, e uma aula termina
// quando o tempo acumulado cobre a duração dela. Devolve o dia em que a última aula termina.
function planFinish(from, durations) {
  const { min, days } = plan();
  if (!days.length || !min) return null;
  if (!durations.length) return new Date(from);
  let d = new Date(from), budget = 0, k = 0;
  for (let guard = 0; guard < 3650; guard++, d = addDays(d, 1)) {
    if (!days.includes(d.getDay())) continue;
    budget += min;
    while (k < durations.length && budget >= durations[k]) { budget -= durations[k]; k++; }
    if (k >= durations.length) return d;
  }
  return null;
}

// Sequência: dias planejados cumpridos em seguida. Folga sem estudo não quebra; estudar na folga soma.
function streaks(set, start, end = todayStr()) {
  const t = todayStr();
  let cur = 0, d = parse(end);
  if (end === t && !set.has(t)) d = addDays(d, -1);
  for (; ymd(d) >= start; d = addDays(d, -1)) { const s = ymd(d); if (set.has(s)) cur++; else if (isPlanned(s)) break; }
  let best = 0, run = 0;
  for (let x = parse(start); ymd(x) <= end; x = addDays(x, 1)) {
    const s = ymd(x);
    if (set.has(s)) { run++; best = Math.max(best, run); } else if (isPlanned(s) && s !== t) run = 0;
  }
  return { cur, best };
}
// Dias desde o início: planejados cumpridos, planejados perdidos (hoje ainda não conta) e extras fora do plano.
function constancy(set, start, end = todayStr()) {
  const t = todayStr(); let hit = 0, missed = 0, extra = 0;
  for (let x = parse(start); ymd(x) <= end; x = addDays(x, 1)) {
    const s = ymd(x), planned = isPlanned(s), studied = set.has(s);
    if (planned && studied) hit++; else if (planned && s !== t) missed++; else if (!planned && studied) extra++;
  }
  return { hit, missed, extra };
}
// Ritmo de um conjunto de aulas dentro de um período: aulas e minutos por dia nas últimas
// 4 semanas do período (ou no período todo, se for menor ou se nada foi feito nessas semanas).
function rateIn(lessons, start, end = todayStr()) {
  const done = lessons.filter(l => S.done[l.id] && S.done[l.id] >= start && S.done[l.id] <= end);
  if (!done.length) return null;
  const days = Math.max(1, diffDays(parse(start), parse(end)) + 1), win = Math.min(28, days);
  const from = ymd(addDays(parse(end), -(win - 1)));
  const recent = done.filter(l => S.done[l.id] >= from);
  const [list, span] = recent.length ? [recent, win] : [done, days];
  return { perDay: list.length / span, minPerDay: list.reduce((s, l) => s + l.min, 0) / span };
}
// Período de um módulo: do início dos registros (1º módulo) ou do dia seguinte ao fim do
// módulo anterior até a última aula (se concluído) ou hoje.
function moduleRange(i) {
  const dates = k => lessonsOf(MODULES[k]).map(l => S.done[l.id]).filter(Boolean).sort();
  const ds = dates(i), t = todayStr();
  let start = i === 0 ? startDate(studiedSet()) : null;
  if (i > 0) { const prev = dates(i - 1); start = isComplete(MODULES[i - 1]) && prev.length ? ymd(addDays(parse(prev[prev.length - 1]), 1)) : (ds[0] || t); }
  if (ds[0] && ds[0] < start) start = ds[0];
  const end = isComplete(MODULES[i]) ? ds[ds.length - 1] : t;
  return { start, end: end < start ? start : end };
}
// Aulas por dia: média das últimas 4 semanas (ou desde o início, se for menos que isso).
function pace(start) {
  const dates = Object.values(S.done);
  if (!dates.length) return null;
  const days = Math.max(1, diffDays(parse(start), new Date()) + 1);
  const win = Math.min(28, days);
  const from = ymd(addDays(new Date(), -(win - 1)));
  const perDay = dates.filter(d => d >= from).length / win;
  return perDay || dates.length / days;
}

/* ---------- trilha do curso ---------- */
const LOCK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
const CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
function renderTrail() {
  const study = studyIdx();
  $("trail").innerHTML = MODULES.map((m, i) => {
    const unlocked = isUnlocked(i), complete = isComplete(m), done = doneIn(m), total = m.lessons;
    const pct = Math.round(done / total * 100);
    const state = complete ? '<span class="chip done">Concluído</span>'
      : !unlocked ? `<span class="chip">${LOCK}Bloqueado</span>`
      : i === study && m.units.length ? '<span class="chip on">Em andamento</span>' : '<span class="chip on">Liberado</span>';
    const foot = !unlocked
      ? `<div class="lockline">${LOCK}<span>Libera ao concluir o ${MODULES[i - 1].name}</span></div>`
      : !m.units.length
        ? `<div class="lockline"><span>Liberado! Conteúdo ainda não cadastrado.</span></div>`
        : `<div class="bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Progresso do ${m.name}"><span style="width:${pct}%"></span></div>
           <div class="row num" style="font-size:12.5px"><span>${done}/${total} aulas</span><span>${pct}%</span></div>`;
    return `<article class="mod ${unlocked && i === study ? "active" : unlocked ? "" : "locked"}">
      <div class="row"><span class="eyebrow">Módulo ${i + 1}</span>${state}</div>
      <h3>${m.name}</h3>
      <div class="num muted" style="font-size:12.5px">${m.lessons} aulas · ${fmtH(m.min)} de carga horária</div>
      <p>${m.desc}</p>
      <div class="tags">${m.tags.map(t => `<span class="chip">${t}</span>`).join("")}</div>
      ${foot}
      <a class="modopen${unlocked ? "" : " ghost"}" href="#modulo-${m.id}">${unlocked ? "Acessar módulo →" : "Ver detalhes"}</a>
    </article>`;
  }).join("");
}

/* ---------- progresso e previsão (só leitura; o planejamento se ajusta em Métricas) ---------- */
let paceView = null;   // null = módulo em estudo · "course" = curso inteiro · id de um módulo
const perWeek = r => Math.round(r * 7);
const fmtWeek = n => n ? plural(n, "aula", "aulas") + "/semana" : "menos de 1 aula/semana";
const leftDurations = m => m.units.length
  ? lessonsOf(m).filter(l => !S.done[l.id]).map(l => l.min)
  : Array(m.lessons - doneIn(m)).fill(avgLesson(m));

// Início e fim de cada módulo: datas reais para o que já foi feito; para o resto, previsão
// no ritmo real (`p` aulas/dia) ou, com `usePlan`, seguindo o planejamento dia a dia.
function timeline(p, usePlan) {
  const si = studyIdx(); let prevEnd = null;
  return MODULES.map((m, i) => {
    const ds = lessonsOf(m).map(l => S.done[l.id]).filter(Boolean).sort();
    const left = m.lessons - doneIn(m);
    let start = null, end = null;
    if (!left || i < si) { start = ds[0] ? parse(ds[0]) : null; end = ds.length ? parse(ds[ds.length - 1]) : null; }
    else if (i === si) {
      start = ds[0] ? parse(ds[0]) : parse(startDate(studiedSet()));
      end = usePlan ? planFinish(new Date(), leftDurations(m)) : p ? addDays(new Date(), Math.ceil(left / p)) : null;
    } else if (prevEnd) {
      start = usePlan ? nextPlanned(addDays(prevEnd, 1)) : addDays(prevEnd, 1);
      end = usePlan ? planFinish(start, Array(m.lessons).fill(avgLesson(m))) : p ? addDays(start, Math.ceil(m.lessons / p) - 1) : null;
    }
    prevEnd = end;
    return { start, end };
  });
}

function ring(pct) {
  const C = 2 * Math.PI * 44;
  return `<svg class="ring" viewBox="0 0 104 104" role="img" aria-label="${Math.round(pct * 100)}% concluído">
    <circle class="trk" cx="52" cy="52" r="44"/>
    <circle class="val" cx="52" cy="52" r="44" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}" transform="rotate(-90 52 52)"/>
    <text x="52" y="59" text-anchor="middle">${Math.round(pct * 100)}%</text></svg>`;
}
const stat = (v, of, label) => `<div class="stat"><b>${v}${of ? `<span class="muted" style="font-size:13px">/${of}</span>` : ""}</b><span>${label}</span></div>`;
const fcRow = (title, sub, when) => `<div class="fcrow"><div><span>${title}</span><small>${sub}</small></div><b class="when">${when}</b></div>`;

function forecastRows(endPace, endPlan, p, m, label) {
  const a = p
    ? fcRow("No seu ritmo atual", `${fmtWeek(perWeek(p))} · faltam ${plural(Math.max(0, diffDays(new Date(), endPace)), "dia", "dias")}`, fmtDate(endPace))
    : fcRow("No seu ritmo atual", "Conclua a primeira aula para calcular", "—");
  const b = endPlan
    ? fcRow("Com o seu planejamento", `${fmtWeek(plannedPerWeek(m))} · ${plural(plan().days.length, "dia", "dias")} × ${fmtH(plan().min)}`, fmtDate(endPlan))
    : fcRow("Com o seu planejamento", "Defina os dias e o tempo de estudo em Métricas", "—");
  return `<div class="forecast"><div class="eyebrow">${label}</div>${a}${b}</div>`;
}

function courseTimeline(tlBest, si) {
  return `<div class="tl">${MODULES.map((m, i) => {
    const t = tlBest[i], cur = i === si && !isComplete(m);
    const when = isComplete(m) ? `concluído em ${fmtDate(t.end)}` : t.start && t.end ? `${cur ? "desde" : "de"} ${fmtDate(t.start)}${cur ? "" : ` até ${fmtDate(t.end)}`}${cur ? ` · termina ${fmtDate(t.end)}` : ""}` : "—";
    return `<div class="tlrow${cur ? " cur" : ""}"><span class="tldot"></span><b>${m.name}</b><span class="muted">${when}</span></div>`;
  }).join("")}</div>`;
}
// Prévia de um módulo que ainda não começou: data em que as métricas passam a existir.
function lockedPreview(i, t, p) {
  const m = MODULES[i];
  return `<div class="lockedview">
      <div class="emptyicon" aria-hidden="true">${LOCK.replace(/14/g, "26")}</div>
      <div><div class="eyebrow">Métricas do ${m.name} disponíveis a partir de</div>
      <div class="when big-date">${t.start ? fmtDate(t.start) : "—"}</div>
      <small class="muted">Quando você concluir o ${MODULES[i - 1].name}. Previsão ${p ? `no seu ritmo atual (${fmtWeek(perWeek(p))})` : `seguindo o seu planejamento (${fmtWeek(plannedPerWeek(m))})`}.</small></div>
    </div>
    <div class="stats">${stat(m.lessons, "", "aulas")}${stat(fmtH(m.min), "", "de carga horária")}${stat(t.start ? fmtDate(t.start) : "—", "", "início previsto")}${stat(t.end ? fmtDate(t.end) : "—", "", "término previsto")}</div>`;
}

function renderPace() {
  const si = studyIdx(), set = studiedSet(), p = pace(startDate(set));
  const view = paceView || MODULES[si].id;
  const tlPace = timeline(p), tlPlan = timeline(null, true), tlBest = p ? tlPace : tlPlan;
  const chips = [...MODULES.map((m, i) => ({ id: m.id, label: m.name, lock: !isUnlocked(i) && !doneIn(m) })), { id: "course", label: "Curso inteiro" }];
  let title, body;

  if (view === "course") {
    const total = MODULES.reduce((s, m) => s + m.lessons, 0), done = MODULES.reduce((s, m) => s + doneIn(m), 0);
    const min = MODULES.reduce((s, m) => s + m.min, 0), doneMin = MODULES.reduce((s, m) => s + doneMinIn(m), 0);
    const last = MODULES.length - 1;
    title = "Progresso do curso";
    body = `<div class="big">${ring(done / total)}<div class="stats">
        ${stat(done, total, "aulas concluídas")}${stat(fmtH(doneMin), "", `de ${fmtH(min)} estudadas`)}
        ${stat(MODULES.filter(isComplete).length, MODULES.length, "módulos concluídos")}${stat(MODULES[si].name, "", "módulo atual")}
      </div></div>
      ${forecastRows(tlPace[last].end, tlPlan[last].end, p, MODULES[si], "Previsão para terminar o curso")}
      ${courseTimeline(tlBest, si)}`;
  } else {
    const i = MODULES.findIndex(m => m.id === view), m = MODULES[i];
    const started = isUnlocked(i) || doneIn(m) > 0;
    title = `Progresso do ${m.name}`;
    if (!started) {
      body = lockedPreview(i, tlBest[i], p);
    } else {
      const done = doneIn(m), left = m.lessons - done;
      const unitsFull = m.units.filter((u, k) => unitDone(m, k + 1) === u.l.length).length;
      body = `<div class="big">${ring(done / m.lessons)}<div class="stats">
          ${stat(done, m.lessons, "aulas concluídas")}${stat(left, "", "aulas restantes")}
          ${stat(fmtH(doneMinIn(m)), "", `de ${fmtH(m.min)} estudadas`)}${stat(unitsFull, m.units.length || "—", "unidades completas")}
        </div></div>
        ${!left ? `<div class="forecast">${fcRow("Módulo concluído", "Parabéns!", fmtDate(tlBest[i].end))}</div>`
          : !m.units.length ? `<div class="forecast"><small class="muted">O conteúdo deste módulo ainda não foi cadastrado.</small></div>`
          : forecastRows(tlPace[i].end, tlPlan[i].end, p, m, `Previsão para terminar o ${m.name}`)}`;
    }
  }

  $("pace").innerHTML = `
    <div class="pace-head"><h2>${title}</h2><a class="back" href="#metricas">Ver métricas →</a></div>
    <div class="seg sm" role="group" aria-label="Ver progresso de">${chips.map(c =>
      `<button type="button" data-pv="${c.id}" aria-pressed="${c.id === view}">${c.lock ? LOCK : ""}${c.label}</button>`).join("")}</div>
    ${body}`;
}
$("pace").addEventListener("click", e => {
  const b = e.target.closest("[data-pv]"); if (!b) return;
  paceView = b.dataset.pv === MODULES[studyIdx()].id ? null : b.dataset.pv;
  renderPace();
});

/* ---------- calendário (semana / mês) ---------- */
const WD = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MONTHS_LONG = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
let calView = lsGet(LS + ":view", "week");
let calRef = new Date();   // qualquer dia dentro da semana/mês exibido

function calData() {
  const set = studiedSet(), perDay = {};
  Object.values(S.done).forEach(d => { perDay[d] = (perDay[d] || 0) + 1; });
  return { set, start: startDate(set), perDay, t: todayStr() };
}
// st = estudou · miss = dia planejado sem estudo · off = folga (fora do plano)
// open = hoje, planejado e ainda sem estudo · pre = antes do início · fut = futuro
function dayState(s, c) {
  if (c.set.has(s) && s <= c.t) return "st";
  if (!isPlanned(s)) return s > c.t ? "fut off" : "off";
  if (s > c.t) return "fut";
  if (s === c.t) return "open";
  if (s < c.start) return "pre";
  return "miss";
}

function renderCalendar() {
  const c = calData();
  $("calSeg").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.view === calView)));
  if (calView === "month") renderMonth(c); else renderWeek(c);
  const on = c.set.has(c.t);
  $("todayBtn").classList.toggle("on", on);
  $("todayBtn").textContent = on ? "Estudei hoje ✓" : "Estudei hoje";
}

function renderWeek(c) {
  const ws = addDays(calRef, -calRef.getDay()), we = addDays(ws, 6);
  $("calTitle").textContent = ws.getMonth() === we.getMonth()
    ? `${ws.getDate()} – ${we.getDate()} ${MONTHS[we.getMonth()]} ${we.getFullYear()}`
    : `${ws.getDate()} ${MONTHS[ws.getMonth()]} – ${we.getDate()} ${MONTHS[we.getMonth()]} ${we.getFullYear()}`;
  let html = "", hit = 0, planned = 0, extra = 0, lessons = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(ws, i), s = ymd(d), st = dayState(s, c), n = c.perDay[s] || 0, pl = isPlanned(s);
    if (st === "st" && pl) hit++;
    if (st === "st" && !pl) extra++;
    if (pl && (st === "st" || st === "miss")) planned++;
    lessons += n;
    const word = { st: "Estudou", miss: "Não estudou", open: "Hoje", off: "Folga", pre: "", fut: "", "fut off": "Folga" }[st];
    const text = n ? plural(n, "aula", "aulas") : word;
    html += `<button type="button" class="wd ${st}${s === c.t ? " today" : ""}" data-d="${s}"${s > c.t ? " disabled" : ""}
      aria-label="${WD[i]}, ${fmtDate(d)}${text ? ": " + text : ""}">
      <span class="wn">${WD[i]}</span><span class="wdt">${d.getDate()}</span>
      <span class="dot">${st === "st" ? CHECK : ""}</span><span class="wc${n ? "" : " s"}">${text || "&nbsp;"}</span></button>`;
  }
  $("calBody").innerHTML = `<div class="wk">${html}</div>`;
  const parts = [];
  if (planned) parts.push(`${hit} de ${plural(planned, "dia planejado", "dias planejados")} cumpridos`);
  if (extra) parts.push(`${plural(extra, "dia extra", "dias extras")} fora do plano`);
  if (parts.length) parts.push(plural(lessons, "aula concluída", "aulas concluídas"));
  $("calSum").textContent = parts.length ? parts.join(" · ")
    : (ymd(ws) > c.t ? "Semana que ainda não chegou." : "Nenhum dia planejado passou nesta semana ainda.");
}

function renderMonth(c) {
  const y = calRef.getFullYear(), m = calRef.getMonth();
  const first = new Date(y, m, 1), daysIn = new Date(y, m + 1, 0).getDate();
  const gridStart = addDays(first, -first.getDay()), cells = Math.ceil((first.getDay() + daysIn) / 7) * 7;
  $("calTitle").textContent = `${MONTHS_LONG[m]} ${y}`;
  let html = WD.map(w => `<span class="mh">${w}</span>`).join("");
  let studied = 0, missed = 0, lessons = 0;
  for (let i = 0; i < cells; i++) {
    const d = addDays(gridStart, i), s = ymd(d), st = dayState(s, c), n = c.perDay[s] || 0, inMonth = d.getMonth() === m;
    if (inMonth) { if (st === "st") studied++; if (st === "miss") missed++; lessons += n; }
    html += `<button type="button" class="md ${st}${inMonth ? "" : " out"}${s === c.t ? " today" : ""}" data-d="${s}"${s > c.t ? " disabled" : ""}
      aria-label="${fmtDate(d)}${st === "st" ? ": estudou" : st === "miss" ? ": não estudou" : st.includes("off") ? ": folga" : ""}${n ? `, ${plural(n, "aula", "aulas")}` : ""}">${d.getDate()}${n ? `<small>${n}</small>` : ""}</button>`;
  }
  $("calBody").innerHTML = `<div class="mo">${html}</div>`;
  $("calSum").textContent = studied || missed
    ? `${plural(studied, "dia", "dias")} com estudo · ${plural(missed, "dia planejado perdido", "dias planejados perdidos")} · ${plural(lessons, "aula concluída", "aulas concluídas")}`
    : "Nenhum dia registrado neste mês.";
}

function toggleDay(s) {
  const n = Object.values(S.done).filter(x => x === s).length;
  if (n) return toast(`Você concluiu ${plural(n, "aula", "aulas")} nesse dia, então ele conta como estudado.`);
  if (S.manual[s]) delete S.manual[s]; else S.manual[s] = true;
  const on = !!S.manual[s];
  remote(() => Store.setDay(s, on));
  renderCalendar(); renderPace(); renderMetrics();
}
$("calBody").addEventListener("click", e => { const b = e.target.closest(".wd, .md"); if (b && !b.disabled) toggleDay(b.dataset.d); });
$("todayBtn").addEventListener("click", () => toggleDay(todayStr()));
$("calSeg").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  calView = b.dataset.view; lsSet(LS + ":view", calView); renderCalendar();
});
function shiftCal(dir) {
  calRef = calView === "month" ? new Date(calRef.getFullYear(), calRef.getMonth() + dir, 1) : addDays(calRef, 7 * dir);
  renderCalendar();
}
$("calPrev").addEventListener("click", () => shiftCal(-1));
$("calNext").addEventListener("click", () => shiftCal(1));
$("calToday").addEventListener("click", () => { calRef = new Date(); renderCalendar(); });

/* ---------- aba Métricas ---------- */
let mScope = null;   // null = módulo em estudo · "course" = curso inteiro · id de um módulo
$("mScope").addEventListener("click", e => {
  const b = e.target.closest("[data-ms]"); if (!b) return;
  mScope = b.dataset.ms === MODULES[studyIdx()].id ? null : b.dataset.ms;
  renderMetrics();
});

function renderMetrics() {
  const si = studyIdx(), set = studiedSet(), gp = pace(startDate(set)), t = todayStr();
  const tlPace = timeline(gp), tlPlan = timeline(null, true), tlBest = gp ? tlPace : tlPlan;
  const id = mScope || MODULES[si].id, course = id === "course";
  const i = course ? -1 : MODULES.findIndex(m => m.id === id), m = course ? null : MODULES[i];
  const started = course || isUnlocked(i) || doneIn(m) > 0;
  const total = course ? MODULES.reduce((s, x) => s + x.lessons, 0) : m.lessons;
  const totalMin = course ? MODULES.reduce((s, x) => s + x.min, 0) : m.min;
  const avg = totalMin / total, name = course ? "curso" : m.name, last = MODULES.length - 1;

  $("mScope").innerHTML = [{ id: "course", label: "Curso inteiro" }, ...MODULES.map((x, k) => ({ id: x.id, label: x.name, lock: !isUnlocked(k) && !doneIn(x) }))]
    .map(c => `<button type="button" data-ms="${c.id}" aria-pressed="${c.id === id}">${c.lock ? LOCK : ""}${c.label}</button>`).join("");

  // Planejamento: configuração + previsão de término do escopo escolhido
  renderPlan(avg, name);
  $("mForecast").innerHTML = course
      ? forecastRows(tlPace[last].end, tlPlan[last].end, gp, MODULES[si], "Previsão para terminar o curso") + courseTimeline(tlBest, si)
    : !started
      ? `<div class="forecast"><div class="eyebrow">Previsão para o ${m.name}</div>
          ${fcRow("Começa em", `quando você concluir o ${MODULES[i - 1].name}`, tlBest[i].start ? fmtDate(tlBest[i].start) : "—")}
          ${fcRow("Termina em", `${m.lessons} aulas · ${fmtH(m.min)}`, tlBest[i].end ? fmtDate(tlBest[i].end) : "—")}</div>`
    : isComplete(m) ? `<div class="forecast">${fcRow("Módulo concluído", "Parabéns!", fmtDate(tlBest[i].end))}</div>`
    : !m.units.length ? `<div class="forecast"><small class="muted">O conteúdo do ${m.name} ainda não foi cadastrado.</small></div>`
    : forecastRows(tlPace[i].end, tlPlan[i].end, gp, m, `Previsão para terminar o ${m.name}`);

  $("mConstCard").hidden = $("mPaceCard").hidden = !started;
  $("mLockedCard").hidden = started;
  if (!started) { $("mLocked").innerHTML = lockedPreview(i, tlBest[i], gp); return; }

  // Constância e ritmo dentro do período do escopo
  const { start, end } = course ? { start: startDate(set), end: t } : moduleRange(i);
  const lessons = course ? MODULES.flatMap(lessonsOf) : lessonsOf(m);
  const { cur, best } = streaks(set, start, end), { hit, missed, extra } = constancy(set, start, end);
  const r = rateIn(lessons, start, end), ended = end !== t;
  const done = lessons.filter(l => S.done[l.id]), lessonDays = new Set(done.map(l => S.done[l.id])).size;
  const doneMin = done.reduce((s, l) => s + l.min, 0);
  const plannedW = Math.floor(weeklyMin() / avg), realW = r ? perWeek(r.perDay) : null;
  const tile = (v, label, cls = "") => `<div class="stat ${cls}"><b>${v}</b><span>${label}</span></div>`;
  $("mPeriod").textContent = `Período: ${fmtDate(parse(start))} até ${ended ? fmtDate(parse(end)) : "hoje"}.`;
  $("mConstancy").innerHTML =
    tile(hit + missed ? Math.round(hit / (hit + missed) * 100) + "%" : "—", "de constância nos dias planejados", "hl") +
    tile(cur, ended ? "dias seguidos no fim do módulo" : "dias seguidos agora") + tile(best, "maior sequência") +
    tile(`${hit}<span class="muted" style="font-size:14px">/${hit + missed}</span>`, "dias planejados cumpridos") +
    tile(missed, "dias planejados perdidos") + tile(extra, "dias extras, fora do plano");
  $("mPace").innerHTML =
    tile(realW === null ? "—" : realW, `aulas por semana de fato (últimas 4 semanas${ended ? " do módulo" : ""})`, "hl") +
    tile(plannedW, "aulas por semana planejadas") +
    tile(realW === null || !plannedW ? "—" : Math.round(realW / plannedW * 100) + "%", "do ritmo planejado") +
    tile(fmtH(r ? Math.round(r.minPerDay * 7) : 0), "por semana de fato") + tile(fmtH(weeklyMin()), "por semana planejadas") +
    tile(lessonDays ? Math.round(done.length / lessonDays) : "—", "aulas por dia de estudo") +
    tile(fmtH(doneMin), `estudadas no ${name}`) + tile(fmtH(totalMin - doneMin), `restantes no ${name}`);
}

/* ---------- planejamento (única parte editável das métricas) ---------- */
$("planH").innerHTML = Array.from({ length: 9 }, (_, h) => `<option value="${h}">${h} h</option>`).join("");
$("planM").innerHTML = [0, 15, 30, 45].map(m => `<option value="${m}">${pad(m)} min</option>`).join("");
$("planDays").innerHTML = WD.map((w, i) => `<button type="button" data-wd="${i}" aria-label="${w}">${w}</button>`).join("");
function renderPlan(avg, name) {
  const { min, days } = plan(), n = Math.floor(weeklyMin() / avg);
  if (document.activeElement !== $("startDate")) { $("startDate").value = startDate(studiedSet()); $("startDate").max = todayStr(); }
  $("planH").value = Math.floor(min / 60);
  $("planM").value = min % 60;
  $("planDays").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(days.includes(Number(b.dataset.wd)))));
  $("planOut").innerHTML = !days.length || !min
    ? `<b>—</b><span>Escolha pelo menos um dia e um tempo de estudo.</span>`
    : `<b>${n ? plural(n, "aula", "aulas") : "Menos de 1 aula"} por semana</b>
       <span>${plural(days.length, "dia", "dias")} × ${fmtH(min)} = ${fmtH(weeklyMin())} por semana · aula média do ${name}: ${Math.round(avg)} min</span>`;
}
function savePlan() { remote(() => Store.setSettings(S)); renderAll(false); }
function setPlanMin() {
  S.plan = { ...plan(), min: Number($("planH").value) * 60 + Number($("planM").value) };
  savePlan();
}
$("planH").addEventListener("change", setPlanMin);
$("planM").addEventListener("change", setPlanMin);
$("planDays").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  const wd = Number(b.dataset.wd), days = plan().days;
  S.plan = { ...plan(), days: days.includes(wd) ? days.filter(d => d !== wd) : [...days, wd].sort() };
  savePlan();
});
$("startDate").addEventListener("change", e => {
  const v = e.target.value; if (!v || v > todayStr()) return;
  S.start = v; savePlan();
});

/* ---------- navegação: #inicio, #metricas, #modulo-<id> ---------- */
function route() {
  const h = location.hash.slice(1) || "inicio";
  const mi = h.startsWith("modulo-") ? MODULES.findIndex(m => m.id === h.slice(7)) : -1;
  const view = mi >= 0 ? "module" : h === "metricas" ? "metrics" : "study";
  $("panelStudy").hidden = view !== "study";
  $("panelMetrics").hidden = view !== "metrics";
  $("panelModule").hidden = view !== "module";
  if (view === "module") { curMod = mi; renderContent(); }
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);

/* ---------- página do módulo ---------- */

function renderModHead() {
  const m = mod(), unlocked = isUnlocked(curMod);
  const done = doneIn(m), pct = Math.round(done / m.lessons * 100);
  $("cEyebrow").textContent = `Módulo ${curMod + 1} de ${MODULES.length}`;
  $("cTitle").textContent = m.name;
  $("cProg").innerHTML = unlocked && m.units.length
    ? `<div class="bar"><span style="width:${pct}%"></span></div><span class="num">${done}/${m.lessons} aulas · ${pct}% · ${fmtH(m.min)}</span>`
    : `<span class="num muted">${m.lessons} aulas · ${fmtH(m.min)} de carga horária</span>`;
}
function renderContent() {
  const m = mod(), unlocked = isUnlocked(curMod);
  renderModHead();
  const hasUnits = unlocked && m.units.length > 0;
  $("unitsArea").hidden = !hasUnits;
  $("modEmpty").hidden = hasUnits;
  if (hasUnits) { renderUnits(); renderDetail(); renderNotes(); return; }
  const prev = MODULES[curMod - 1];
  const left = prev ? prev.lessons - doneIn(prev) : 0;
  $("modEmpty").innerHTML = unlocked
    ? `<div class="emptyicon" aria-hidden="true">＋</div>
       <h3>O conteúdo do ${m.name} ainda não foi cadastrado</h3>
       <p class="muted">${m.lessons} aulas · ${fmtH(m.min)} de carga horária. Quando tiver o programa do módulo, adicione as unidades em <code>js/data.js</code> no mesmo formato do Basic.</p>`
    : `<div class="emptyicon" aria-hidden="true">${LOCK.replace(/14/g, "28")}</div>
       <h3>${m.name} bloqueado</h3>
       <p class="muted">Conclua o ${prev.name} para liberar este módulo${prev.units.length ? ` (faltam ${plural(left, "aula", "aulas")})` : ""}. Ele terá ${m.lessons} aulas e ${fmtH(m.min)} de carga horária.</p>
       <div class="tags" style="justify-content:center">${m.tags.map(t => `<span class="chip">${t}</span>`).join("")}</div>`;
}

function renderUnits() {
  const m = mod(), s = sel();
  $("ulist").setAttribute("aria-label", `Unidades do ${m.name}`);
  $("ulist").innerHTML = `<div class="eyebrow" style="padding:4px 10px 6px">Unidades do ${m.name}</div>` + m.units.map((u, i) => {
    const n = i + 1, d = unitDone(m, n), tot = u.l.length;
    return `<button type="button" class="unit${d === tot ? " full" : ""}" data-u="${n}" aria-current="${n === s}">
      <span class="n">${n}</span><span class="t">${u.t}</span><span class="c">${d}/${tot}</span>
      <span class="bar"><span style="width:${d / tot * 100}%"></span></span></button>`;
  }).join("");
}
$("ulist").addEventListener("click", e => {
  const b = e.target.closest(".unit"); if (!b) return;
  selMap[mod().id] = Number(b.dataset.u); lsSet(LS + ":units", selMap);
  renderUnits(); renderDetail(); renderNotes();
  if (window.matchMedia("(max-width: 1180px)").matches) $("detail").scrollIntoView({ behavior: "smooth", block: "start" });
});

function renderDetail() {
  const m = mod(), s = sel(), u = m.units[s - 1];
  const d = unitDone(m, s), tot = u.l.length, mins = u.l.reduce((a, l) => a + l.min, 0);
  $("detail").innerHTML = `
    <div class="dhead">
      <div class="eyebrow">${m.name} · Unidade ${s} de ${m.units.length}</div>
      <div class="row"><h2 style="font-size:26px">${u.t}</h2><span class="num muted" style="font-size:13px">${d}/${tot} aulas · ${fmtH(mins)}</span></div>
      <div class="bar"><span style="width:${d / tot * 100}%"></span></div>
    </div>
    <div class="lessons">${u.l.map(l => {
      const when = S.done[l.id];
      return `<div class="lesson${when ? " done" : ""}">
        <button type="button" class="check" data-l="${l.id}" aria-pressed="${!!when}" aria-label="${when ? "Desmarcar" : "Marcar como concluída"}: ${l.title}">${CHECK}</button>
        <div style="min-width:0">
          <div class="lt">${l.title}</div>
          <p class="ld">${l.desc}</p>
          <div class="meta"><span class="type">${TYPES[l.type]}</span><span class="num">${l.min} min</span><span class="num">${l.acts} atividades</span></div>
        </div>
      </div>`;
    }).join("")}</div>`;
}
const detail = $("detail");
detail.addEventListener("click", e => {
  const c = e.target.closest(".check"); if (!c) return;
  const m = mod(), wasDone = isComplete(m), id = c.dataset.l;
  if (S.done[id]) delete S.done[id]; else S.done[id] = todayStr();
  const date = S.done[id] || null;
  remote(() => Store.setLesson(id, date));
  renderAll(false);
  const s = sel();
  if (date && unitDone(m, s) === m.units[s - 1].l.length) toast(`Unidade ${s} concluída!`);
  if (!wasDone && isComplete(m)) {
    const next = MODULES[curMod + 1];
    toast(next ? `${m.name} concluído! O ${next.name} foi liberado.` : "Curso concluído! Parabéns!");
  }
});

/* ---------- anotações (coluna da direita) ---------- */
function renderNotes() {
  const m = mod(), s = sel(), key = noteKey(m, s);
  $("notesCard").innerHTML = `
    <div class="nhead">
      <div class="eyebrow">Unidade ${s} · ${m.units[s - 1].t}</div>
      <h2>Minhas anotações</h2>
    </div>
    <div>
      <div class="tool" role="toolbar" aria-label="Formatação">
        <button type="button" data-cmd="bold" title="Negrito (Ctrl+B)"><b>B</b></button>
        <button type="button" data-cmd="italic" title="Itálico (Ctrl+I)"><i>I</i></button>
        <button type="button" data-cmd="underline" title="Sublinhado (Ctrl+U)"><u>U</u></button>
        <button type="button" data-cmd="mark" title="Marca-texto">Marca-texto</button>
        <span class="sep"></span>
        <button type="button" data-cmd="h3" title="Título">Título</button>
        <button type="button" data-cmd="p" title="Texto normal">Texto</button>
        <button type="button" data-cmd="quote" title="Destaque">Destaque</button>
        <span class="sep"></span>
        <button type="button" data-cmd="insertUnorderedList" title="Lista">• Lista</button>
        <button type="button" data-cmd="insertOrderedList" title="Lista numerada">1. Lista</button>
        <span class="sep"></span>
        <button type="button" data-cmd="removeFormat" title="Limpar formatação">Limpar</button>
      </div>
      <div class="editor" id="editor" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Anotações da unidade ${s}"
        data-ph="Escreva o que aprendeu nesta unidade: regras de gramática, frases úteis, vocabulário novo, dúvidas para revisar…"></div>
    </div>
    <div class="nmeta"><span id="nwords"></span><span id="nupd">Salva sozinho enquanto você escreve</span></div>`;
  $("editor").innerHTML = notes[key]?.html || "";
  updNoteMeta();
}
function updNoteMeta() {
  const ed = $("editor"); if (!ed) return;
  const n = (ed.innerText.trim().match(/\S+/g) || []).length;
  $("nwords").textContent = plural(n, "palavra", "palavras");
  const up = notes[noteKey(mod(), sel())]?.updatedAt, d = up && new Date(up);
  $("nupd").textContent = d ? `Editado em ${fmtDate(d)}, ${pad(d.getHours())}:${pad(d.getMinutes())}` : "Salva sozinho enquanto você escreve";
}
const notesCard = $("notesCard");
notesCard.addEventListener("mousedown", e => { if (e.target.closest(".tool button")) e.preventDefault(); });
notesCard.addEventListener("click", e => {
  const b = e.target.closest(".tool button"); if (!b) return;
  $("editor").focus();
  const cmd = b.dataset.cmd;
  if (cmd === "h3" || cmd === "p") document.execCommand("formatBlock", false, cmd === "h3" ? "<h3>" : "<p>");
  else if (cmd === "quote") document.execCommand("formatBlock", false, "<blockquote>");
  else if (cmd === "mark") { document.execCommand("styleWithCSS", false, true); document.execCommand("hiliteColor", false, "rgba(242, 183, 5, .42)"); document.execCommand("styleWithCSS", false, false); }
  else document.execCommand(cmd, false, null);
  onEdit();
});
notesCard.addEventListener("input", e => { if (e.target.id === "editor") onEdit(); });
notesCard.addEventListener("paste", e => {
  if (!e.target.closest || !e.target.closest("#editor")) return;
  e.preventDefault();
  document.execCommand("insertText", false, (e.clipboardData || window.clipboardData).getData("text/plain"));
});
function onEdit() {
  const ed = $("editor"), key = noteKey(mod(), sel());
  notes[key] = { html: ed.innerText.trim() ? ed.innerHTML : "", updatedAt: Date.now() };
  updNoteMeta(); saveNote(key);
}

/* ---------- geral ---------- */
let toastT;
function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 3200); }
// withNotes = false mantém o editor como está (não perde o que está sendo digitado).
function renderAll(withNotes = true) {
  renderTrail(); renderPace(); renderCalendar(); renderMetrics();
  if (withNotes) return renderContent();
  const m = mod();
  renderModHead();
  if (isUnlocked(curMod) && m.units.length) { renderUnits(); renderDetail(); }
}

/* ---------- login ---------- */
function showAuth(msg = "") {
  $("app").hidden = true; $("auth").hidden = false;
  authMsg(msg);
}
function authMsg(text, err = false) { const m = $("authMsg"); m.textContent = text; m.classList.toggle("err", err); }
function authBusy(on) { $("signInBtn").disabled = on; }
const AUTH_ERR = {
  "Invalid login credentials": "Usuário ou senha incorretos.",
  "Email not confirmed": "Essa conta ainda não foi confirmada. No Supabase, confirme o usuário em Authentication → Users."
};
const authError = e => AUTH_ERR[e?.message] || e?.message || "Algo deu errado. Tente de novo.";
// O Supabase entra por e-mail: o usuário "dev" vira "dev@<LOGIN_DOMAIN>". Quem digitar um e-mail completo entra com ele.
const LOGIN_DOMAIN = window.APP_CONFIG?.LOGIN_DOMAIN || "diario.fluency.com";
const toEmail = u => u.includes("@") ? u : `${u}@${LOGIN_DOMAIN}`;
const toUser = email => email?.endsWith("@" + LOGIN_DOMAIN) ? email.slice(0, -LOGIN_DOMAIN.length - 1) : email || "";
function readCreds() {
  const user = $("username").value.trim().toLowerCase(), password = $("password").value;
  if (!user || !password) { authMsg("Informe o usuário e a senha.", true); return null; }
  return { email: toEmail(user), password };
}
$("authForm").addEventListener("submit", async e => {
  e.preventDefault();
  const c = readCreds(); if (!c) return;
  authBusy(true); authMsg("Entrando…");
  try { await enter(await Store.signIn(c.email, c.password)); }
  catch (err) { authMsg(authError(err), true); }
  authBusy(false);
});
$("signOutBtn").addEventListener("click", async () => {
  await Store.signOut();
  S = EMPTY(); notes = {};
  showAuth("Você saiu da conta.");
});

async function enter(user) {
  Store.user = user;
  loadCache();
  $("auth").hidden = true; $("app").hidden = false;
  $("who").textContent = toUser(user.email); $("who").hidden = false; $("signOutBtn").hidden = false;
  renderAll(); route();
  try {
    const r = await Store.load();
    const anon = lsGet(LS, null); // dados de antes de existir login
    if (anon) anon.notes = migrateNotes(anon.notes);
    const remoteEmpty = !hasData({ S: r.S, notes: r.notes });
    if (remoteEmpty && hasData(anon)) {
      S = Object.assign(EMPTY(), anon.S); notes = Object.assign({}, anon.notes);
      await Store.importAll(S, notes);
      toast("O progresso salvo neste navegador foi enviado para sua conta.");
    } else { S = r.S; notes = r.notes; }
    Store.online = true; cache(); renderAll();
  } catch (e) {
    console.error(e);
    toast("Não consegui carregar do Supabase. Confira o js/config.js e se o schema.sql foi executado.");
  }
}

async function boot() {
  if (!Store.configured()) {
    loadCache(); $("app").hidden = false; renderAll(); route();
    return;
  }
  Store.init();
  Store.sb.auth.onAuthStateChange(ev => { if (ev === "SIGNED_OUT" && !$("app").hidden) showAuth("Sua sessão terminou. Entre de novo."); });
  const session = await Store.session().catch(() => null);
  if (session) enter(session.user); else showAuth();
}
boot();
