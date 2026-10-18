/* Camada de dados: conversa com o Supabase quando js/config.js está preenchido.
   Sem configuração, o app funciona só com o localStorage (cuidado feito em app.js). */
const Store = {
  sb: null,
  user: null,
  online: false,

  configured() {
    const c = window.APP_CONFIG || {};
    return Boolean(c.SUPABASE_URL && c.SUPABASE_ANON_KEY && window.supabase);
  },

  init() {
    const c = window.APP_CONFIG;
    this.sb = window.supabase.createClient(c.SUPABASE_URL, c.SUPABASE_ANON_KEY);
  },

  /* ---------- conta ---------- */
  async session() {
    const { data } = await this.sb.auth.getSession();
    return data.session;
  },
  async signIn(email, password) {
    const { data, error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user;
  },
  async signOut() {
    await this.sb.auth.signOut();
    this.user = null;
    this.online = false;
  },

  /* ---------- leitura ---------- */
  async load() {
    const [p, d, n, s] = await Promise.all([
      this.sb.from("progress").select("lesson_id, completed_on"),
      this.sb.from("study_days").select("day"),
      this.sb.from("unit_notes").select("module, unit, html, updated_at"),
      this.sb.from("settings").select("start_date, minutes_per_day, study_weekdays").maybeSingle()
    ]);
    for (const r of [p, d, n, s]) if (r.error) throw r.error;

    const S = { done: {}, manual: {}, start: "", plan: { min: 60, days: [1, 2, 3, 4, 5] } };
    p.data.forEach(r => { S.done[r.lesson_id] = r.completed_on; });
    d.data.forEach(r => { S.manual[r.day] = true; });
    if (s.data) {
      S.start = s.data.start_date || "";
      S.plan = { min: s.data.minutes_per_day ?? 60, days: s.data.study_weekdays ?? [1, 2, 3, 4, 5] };
    }

    const notes = {};
    n.data.forEach(r => { notes[`${r.module}/${r.unit}`] = { html: r.html, updatedAt: Date.parse(r.updated_at) }; });
    return { S, notes };
  },

  /* ---------- escrita ---------- */
  setLesson(lessonId, date) {
    const t = this.sb.from("progress");
    return ok(date
      ? t.upsert({ user_id: this.user.id, lesson_id: lessonId, completed_on: date }, { onConflict: "user_id,lesson_id" })
      : t.delete().eq("user_id", this.user.id).eq("lesson_id", lessonId));
  },
  setDay(day, studied) {
    const t = this.sb.from("study_days");
    return ok(studied
      ? t.upsert({ user_id: this.user.id, day }, { onConflict: "user_id,day" })
      : t.delete().eq("user_id", this.user.id).eq("day", day));
  },
  setSettings(S) {
    return ok(this.sb.from("settings").upsert(
      { user_id: this.user.id, start_date: S.start || null, minutes_per_day: S.plan.min, study_weekdays: S.plan.days, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }));
  },
  // noteKey = "basic/3" (módulo/unidade)
  setNote(noteKey, html, updatedAt) {
    const [module, unit] = noteKey.split("/");
    return ok(this.sb.from("unit_notes").upsert(
      { user_id: this.user.id, module, unit: Number(unit), html, updated_at: new Date(updatedAt || Date.now()).toISOString() },
      { onConflict: "user_id,module,unit" }));
  },

  /* Envia de uma vez tudo o que estava salvo só no navegador (primeiro login). */
  async importAll(S, notes) {
    const uid = this.user.id;
    const lessons = Object.entries(S.done).map(([lesson_id, completed_on]) => ({ user_id: uid, lesson_id, completed_on }));
    const days = Object.keys(S.manual).filter(k => S.manual[k]).map(day => ({ user_id: uid, day }));
    const ns = Object.entries(notes).filter(([, v]) => v && v.html)
      .map(([k, v]) => { const [module, unit] = k.split("/"); return { user_id: uid, module, unit: Number(unit), html: v.html, updated_at: new Date(v.updatedAt || Date.now()).toISOString() }; });
    if (lessons.length) await ok(this.sb.from("progress").upsert(lessons, { onConflict: "user_id,lesson_id" }));
    if (days.length) await ok(this.sb.from("study_days").upsert(days, { onConflict: "user_id,day" }));
    if (ns.length) await ok(this.sb.from("unit_notes").upsert(ns, { onConflict: "user_id,module,unit" }));
    await this.setSettings(S);
  }
};

async function ok(query) {
  const { error } = await query;
  if (error) throw error;
}
