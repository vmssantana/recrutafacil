window.App = window.App || {};

App.Dashboard = (() => {
  const S = () => App.Storage;

  function init(){
    document.getElementById("btnResetDB")?.addEventListener("click", () => {
      if (!S().confirmAction("ATENÇÃO: apagar todos os dados do RecrutaFácil?")) return;
      localStorage.removeItem("rf_db_v1");
      // mantém usuários
      location.reload();
    });
  }

  function render(){
    // Botão de reset visível apenas para ADMIN
    const prof = S().currentProfile?.() || "CONSULTA";
    const wrap = document.getElementById("resetWrap");
    if (wrap) wrap.classList.toggle("d-none", String(prof).toUpperCase() !== "ADMIN");
    const db = S().getData();
    const el = (id) => document.getElementById(id);
    el("kpiPostos") && (el("kpiPostos").textContent = (db.postos||[]).filter(p=>p.ativo!==false).length);
    el("kpiVagas") && (el("kpiVagas").textContent = (db.vagas||[]).filter(v=>v.ativo!==false).length);
    el("kpiCandidatos") && (el("kpiCandidatos").textContent = (db.candidatos||[]).filter(c=>c.ativo!==false).length);
    el("kpiPre") && (el("kpiPre").textContent = (db.preAdmissao||[]).filter(p=>p.arquivado!==true).length);
  }

  return { init, render };
})();
