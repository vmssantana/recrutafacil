window.App = window.App || {};

App.Storage = (() => {
  const DB_KEY = "rf_db_v1";
  const USERS_KEY = "rf_users_v1";
  const SESSION_KEY = "rf_session_v1";

  const pad2 = (n) => String(n).padStart(2, "0");

  function nowISO(){ return new Date().toISOString(); }

  function nowBRDateTime(){
    const d = new Date();
    return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  function nowBRDate(){
    const d = new Date();
    return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()}`;
  }

  function upper(v){ return String(v ?? "").toUpperCase().trim(); }

  function sanitizeText(v){
    return String(v ?? "").replace(/[\u0000-\u001F\u007F]/g, "").trim();
  }

  function escapeHTML(str){
    return String(str ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  function toast(msg, type="info"){
    const container = document.getElementById("toastContainer");
    if (!container){ alert(msg); return; }

    const el = document.createElement("div");
    el.className = `toast align-items-center text-bg-${type} border-0`;
    el.role = "alert";
    el.ariaLive = "assertive";
    el.ariaAtomic = "true";
    el.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">${escapeHTML(msg)}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>
    `;
    container.appendChild(el);
    const t = new bootstrap.Toast(el, { delay: 2800 });
    t.show();
    el.addEventListener("hidden.bs.toast", ()=> el.remove());
  }

  function confirmAction(msg){ return window.confirm(msg); }

  function getDefaultDB(){
    return {
      postos: [],
      vagas: [],
      candidatos: [],
      processos: [],
      preAdmissao: [],
      meta: { createdAt: nowISO(), version: 1, seq: { P:0, V:0, C:0, PR:0, PA:0 } }
    };
  }

  function getData(){
    const raw = localStorage.getItem(DB_KEY);
    if (!raw){
      const db = getDefaultDB();
      localStorage.setItem(DB_KEY, JSON.stringify(db));
      migrateLegacyKeys();
      return JSON.parse(localStorage.getItem(DB_KEY));
    }
    try{
      const db = JSON.parse(raw);
      db.postos ||= [];
      db.vagas ||= [];
      db.candidatos ||= [];
      db.processos ||= [];
      db.preAdmissao ||= [];
      db.meta ||= { createdAt: nowISO(), version: 1, seq: { P:0, V:0, C:0, PR:0, PA:0 } };
      db.meta.seq ||= { P:0, V:0, C:0, PR:0, PA:0 };

      // MIGRAÇÃO SEGURA: algumas versões antigas usavam o campo "comarca" como localidade.
      // Objetivo: manter dados existentes e padronizar visualização em "cidade".
      // Não remove dados: apenas garante que "cidade" esteja preenchido quando possível.
      let touched = false;
      (db.postos || []).forEach(p => {
        if (!p) return;
        if ((!p.cidade || String(p.cidade).trim() === "") && p.comarca && String(p.comarca).trim() !== "") {
          p.cidade = p.comarca;
          touched = true;
        }
      });
      if (touched) {
        // grava de volta já migrado para evitar repetição
        localStorage.setItem(DB_KEY, JSON.stringify(db));
      }
      return db;
    }catch{
      const db = getDefaultDB();
      localStorage.setItem(DB_KEY, JSON.stringify(db));
      migrateLegacyKeys();
      return JSON.parse(localStorage.getItem(DB_KEY));
    }
  }

  function setData(mutator){
    const db = getData();
    mutator(db);
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  }

  function ensureSeqFromExisting(prefix, list, field="id"){
    const db = getData();
    const seq = db.meta.seq || (db.meta.seq = {});
    const max = (list||[])
      .map(x => String(x?.[field] || ""))
      .filter(id => id.startsWith(prefix))
      .map(id => parseInt(id.slice(prefix.length),10))
      .filter(n => Number.isFinite(n))
      .reduce((a,b)=> Math.max(a,b), 0);
    if ((seq[prefix]||0) < max){
      seq[prefix] = max;
      localStorage.setItem(DB_KEY, JSON.stringify(db));
    }
  }

  function nextEntityId(prefix){
    let next = 1;
    setData(db => {
      db.meta ||= { createdAt: nowISO(), version: 1, seq: {} };
      db.meta.seq ||= {};
      db.meta.seq[prefix] = (db.meta.seq[prefix] || 0) + 1;
      next = db.meta.seq[prefix];
    });
    return `${prefix}${String(next).padStart(3,"0")}`;
  }

  // ===== MIGRAÇÃO (retrocompatibilidade) =====
  function migrateLegacyKeys(){
    // Alguns builds antigos gravavam listas em chaves soltas (postos/vagas/candidatos/processos/preAdmissoes)
    const legacy = {
      postos: "postos",
      vagas: "vagas",
      candidatos: "candidatos",
      processos: "processos",
      preAdmissoes: "preAdmissoes"
    };

    const db = getDefaultDB();
    const current = localStorage.getItem(DB_KEY);
    if (current){
      try{
        Object.assign(db, JSON.parse(current));
      }catch{}
    }

    let changed = false;

    // Importa listas se existirem e se o DB estiver vazio naquela entidade
    for (const [entity, key] of Object.entries(legacy)){
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try{
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length){
          if ((db[entity]||[]).length === 0){
            // normalize
            db[entity] = arr;
            changed = true;
          }
        }
      }catch{}
    }

    // preAdmissoes legado pode ser array de resumo
    if (legacy.preAdmissoes){
      const raw = localStorage.getItem(legacy.preAdmissoes);
      if (raw){
        try{
          const arr = JSON.parse(raw);
          if (Array.isArray(arr) && arr.length && (db.preAdmissao||[]).length === 0){
            db.preAdmissao = arr.map(x => ({
              id: nextEntityId("PA"),
              idVaga: upper(x.idVaga),
              idCandidato: upper(x.idCandidato),
              posto: upper(x.posto || ""),
              nomeCandidato: upper(x.nomeCandidato || ""),
              contato: upper(x.contatoWhatsApp || x.contato || ""),
              dataAprovacao: x.dataAprovacao || nowBRDate(),
              statusAdmissao: "PENDENTE",
              anexos: {},
              arquivado: false,
              dataInicio: nowBRDate()
            }));
            changed = true;
          }
        }catch{}
      }
    }

    if (changed){
      // garante seq
      db.meta ||= { createdAt: nowISO(), version: 1, seq: { P:0, V:0, C:0, PR:0, PA:0 } };
      localStorage.setItem(DB_KEY, JSON.stringify(db));
      // recalcula seq para todos
      ensureSeqFromExisting("P", db.postos);
      ensureSeqFromExisting("V", db.vagas);
      ensureSeqFromExisting("C", db.candidatos);
      ensureSeqFromExisting("PR", db.processos);
      ensureSeqFromExisting("PA", db.preAdmissao);
    }
  }

  // ===== CSV helpers =====
  function toCSV(rows, headers){
    const esc = (v) => {
      const s = String(v ?? "");
      const needs = /[",\n;]/.test(s);
      const out = s.replaceAll('"','""');
      return needs ? `"${out}"` : out;
    };
    const head = headers.map(esc).join(";");
    const lines = rows.map(r => headers.map(h => esc(r[h])).join(";"));
    return [head, ...lines].join("\n");
  }

  function downloadText(filename, content, mime="text/plain;charset=utf-8"){
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // ===== AUTH =====
  function ensureDefaultUsers(){
    let users = [];
    try{
      users = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
      if (!Array.isArray(users)) users = [];
    }catch{ users = []; }

    const hasConsulta = users.some(u => String(u.username||"").toLowerCase() === "recrutafacil");
    const hasAdmin = users.some(u => String(u.username||"").toLowerCase() === "admin");

    if (!hasConsulta){
      users.push({ username:"recrutafacil", passHash: btoa("admin123"), profile:"CONSULTA", createdAt: nowISO() });
    }
    if (!hasAdmin){
      users.push({ username:"admin", passHash: btoa("admin123"), profile:"ADMIN", createdAt: nowISO() });
    }
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function getUsers(){
    ensureDefaultUsers();
    try{ return JSON.parse(localStorage.getItem(USERS_KEY) || "[]"); }catch{ return []; }
  }

  function setSession(obj){ sessionStorage.setItem(SESSION_KEY, JSON.stringify(obj)); }
  function getSession(){
    try{
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    }catch{ return null; }
  }
  function isLogged(){ return !!getSession(); }
  function logout(){ sessionStorage.removeItem(SESSION_KEY); }

  function login(username, password){
    const u = sanitizeText(username).toLowerCase();
    const p = sanitizeText(password);
    const users = getUsers();
    const found = users.find(x => String(x.username).toLowerCase() === u);
    if (!found) return { ok:false, msg:"Usuário inválido." };
    if (found.passHash !== btoa(p)) return { ok:false, msg:"Senha inválida." };
    setSession({ username: found.username, profile: (found.profile||"CONSULTA").toUpperCase(), loginAt: nowISO() });
    return { ok:true };
  }

  function currentProfile(){ return (getSession()?.profile || "NÃO AUTENTICADO").toUpperCase(); }

  function canEditPostos(){
    // CONSULTA: somente leitura em Postos
    return currentProfile() !== "CONSULTA";
  }

  return {
    // util
    nowISO, nowBRDateTime, nowBRDate, upper, sanitizeText, escapeHTML,
    toast, confirmAction,

    // db
    getData, setData, nextEntityId, ensureSeqFromExisting,

    // csv
    toCSV, downloadText,

    // auth
    ensureDefaultUsers, login, logout, isLogged, getSession, currentProfile, canEditPostos
  };
})();

// ===== App shell =====
App.UI = (() => {
  const S = () => App.Storage;

  function showModule(name){
    document.querySelectorAll(".module").forEach(s => s.classList.remove("active"));
    document.querySelectorAll("[data-module]").forEach(a => a.classList.remove("active"));
    document.getElementById(`mod-${name}`)?.classList.add("active");
    document.querySelector(`[data-module='${name}']`)?.classList.add("active");
  }

  function initNav(){
    document.querySelectorAll("[data-module]").forEach(a => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const m = a.getAttribute("data-module");
        if (!S().isLogged()){
          openLoginModal();
          return;
        }
        showModule(m);
        // render after navigation
        App[m.charAt(0).toUpperCase()+m.slice(1)]?.render?.();
      });
    });
  }

  let loginModal = null;
  function openLoginModal(){
    if (!loginModal){
      const el = document.getElementById("modalLogin");
      if (!el) { alert("Tela de login não encontrada."); return; }
      loginModal = new bootstrap.Modal(el, { backdrop:"static", keyboard:false });
    }
    document.getElementById("loginError")?.classList.add("d-none");
    loginModal.show();
  }

  function closeLoginModal(){ loginModal?.hide(); }

  function updateSessionUI(){
    const badge = document.getElementById("sessionBadge");
    const btnLogin = document.getElementById("btnLogin");
    const btnLogout = document.getElementById("btnLogout");
    const s = S().getSession();
    if (badge) badge.textContent = s ? `${s.username} • ${s.profile}` : "NÃO AUTENTICADO";
    if (btnLogin) btnLogin.classList.toggle("d-none", !!s);
    if (btnLogout) btnLogout.classList.toggle("d-none", !s);
  }

  function initLogin(){
    document.getElementById("btnLogin")?.addEventListener("click", openLoginModal);
    document.getElementById("btnLogout")?.addEventListener("click", () => {
      S().logout();
      updateSessionUI();
      openLoginModal();
    });

    document.getElementById("btnDoLogin")?.addEventListener("click", () => {
      const user = document.getElementById("loginUser")?.value || "";
      const pass = document.getElementById("loginPass")?.value || "";
      const res = S().login(user, pass);
      if (!res.ok){
        const err = document.getElementById("loginError");
        if (err){ err.textContent = res.msg || "Falha no login."; err.classList.remove("d-none"); }
        return;
      }
      updateSessionUI();
      closeLoginModal();
      App.initModules();
      showModule("dashboard");
      App.Dashboard?.render?.();
    });

    // enter to login
    document.getElementById("loginPass")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") document.getElementById("btnDoLogin")?.click();
    });
  }

  return { initNav, initLogin, updateSessionUI, openLoginModal, showModule };
})();

App.initModules = (() => {
  let done = false;
  return () => {
    if (done) return;
    done = true;
    const S = App.Storage;
    const db = S.getData();
    S.ensureSeqFromExisting("P", db.postos);
    S.ensureSeqFromExisting("V", db.vagas);
    S.ensureSeqFromExisting("C", db.candidatos);
    S.ensureSeqFromExisting("PR", db.processos);
    S.ensureSeqFromExisting("PA", db.preAdmissao);

    App.Dashboard?.init?.();
    App.Postos?.init?.();
    App.Vagas?.init?.();
    App.Candidatos?.init?.();
    App.Processo?.init?.();
    App.Admissao?.init?.();

    App.Dashboard?.render?.();
    App.Postos?.render?.();
    App.Vagas?.render?.();
    App.Candidatos?.render?.();
    App.Processo?.render?.();
    App.Admissao?.render?.();
  };
})();

App.init = () => {
  const S = App.Storage;
  S.ensureDefaultUsers();
  App.UI.initNav();
  App.UI.initLogin();
  App.UI.updateSessionUI();

  if (!S.isLogged()){
    App.UI.openLoginModal();
    App.UI.showModule("dashboard");
  } else {
    App.initModules();
    App.UI.showModule("dashboard");
  }
};
