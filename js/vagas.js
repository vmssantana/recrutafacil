window.App = window.App || {};

App.Vagas = (() => {
  const S = () => App.Storage;

  let modal = null;
  let editingId = "";

  const SOLICITANTES = [
    "SUPERVISAO CHAPECO",
    "SUPERVISAO FLORIANOPOLIS",
    "SUPERVISAO JOINVILLE",
    "RH"
  ];

  const MOTIVOS = [
    "UNIDADE SOLICITOU SUBSTITUIÇÃO",
    "COLABORADOR PEDIU DEMISSÃO",
    "NOVO POSTO",
    "OUTROS"
  ];

  function el(id){ return document.getElementById(id); }
  function up(v){ return S().upper(v); }
  function profile(){ return S().currentProfile(); }
  function username(){ return S().getSession()?.username || ""; }

  // === funções globais solicitadas (permanentes) ===
  window.editarVaga = function editarVaga(id){
    console.log(`Editando vaga ${id}`);
    localStorage.setItem("ultimaVagaEditada", id);
    App.Vagas?.openEdit?.(id);
  };

  window.excluirVaga = function excluirVaga(id){
    if (!confirm("Tem certeza que deseja excluir esta requisição?")) return;

    // regra: não permitir exclusão se a vaga já tiver candidatos vinculados
    const db = S().getData();
    const pr = (db.processos||[]).find(p => p.idVaga === id && p.ativo !== false);
    const temVinculos = pr && Array.isArray(pr.candidatosVinculados) && pr.candidatosVinculados.some(x => x.ativo !== false);

    const vaga = (db.vagas||[]).find(v => v.id === id && v.ativo !== false);
    if (!vaga) return;

    if (temVinculos){
      S().toast("NÃO É POSSÍVEL EXCLUIR: EXISTEM CANDIDATOS VINCULADOS.", "warning");
      return;
    }
    if (up(vaga.status) !== "RASCUNHO"){
      S().toast("SOMENTE VAGAS EM RASCUNHO PODEM SER EXCLUÍDAS.", "warning");
      return;
    }
    // apenas criador ou RH/ADMIN
    const isOwner = up(vaga.criadoPor) === up(username());
    const can = isOwner || ["ADMIN","RH"].includes(profile());
    if (!can){
      S().toast("SEM PERMISSÃO PARA EXCLUIR ESTA REQUISIÇÃO.", "warning");
      return;
    }

    // exclusão lógica (ativo=false)
    S().setData(db2 => {
      const idx = db2.vagas.findIndex(v => v.id === id);
      if (idx >= 0) db2.vagas[idx].ativo = false;
      // histórico
      if (idx >= 0){
        db2.vagas[idx].historico ||= [];
        db2.vagas[idx].historico.push({ at: S().nowISO(), acao:"EXCLUIR", por: username() });
      }
    });

    App.Vagas.render();
    S().toast("REQUISIÇÃO EXCLUÍDA COM SUCESSO.", "success");
  };

  function init(){
    modal = new bootstrap.Modal(el("modalVaga"), { backdrop:"static", keyboard:false });

    el("btnNovaVaga")?.addEventListener("click", openNew);
    el("btnVagaSave")?.addEventListener("click", saveDraftOrUpdate);
    el("btnEnviarRH")?.addEventListener("click", sendToRH);

    el("vagasSearch")?.addEventListener("input", render);
    el("btnExportVagas")?.addEventListener("click", exportCSV);

    // delegation
    el("vagasTbody")?.addEventListener("click",(e)=>{
      const ed = e.target.closest(".btn-editar");
      if (ed){ window.editarVaga(ed.dataset.id); return; }
      const dl = e.target.closest(".btn-excluir");
      if (dl){ window.excluirVaga(dl.dataset.id); return; }
    });

    refreshPostoOptions();
    refreshSolicitanteMotivoOptions();
  }

  function refreshSolicitanteMotivoOptions(){
    const s = el("vagaSolicitante");
    if (s){
      s.innerHTML = `<option value="">SELECIONE</option>` + SOLICITANTES.map(x=>`<option value="${x}">${x}</option>`).join("");
    }
    const m = el("vagaMotivo");
    if (m){
      m.innerHTML = `<option value="">SELECIONE</option>` + MOTIVOS.map(x=>`<option value="${x}">${x}</option>`).join("");
    }
  }

  function refreshPostoOptions(){
    const db = S().getData();
    const postos = (db.postos||[]).filter(p=>p.ativo!==false);
    const sel = el("vagaPosto");
    if (!sel) return;

    sel.innerHTML = `<option value="">SELECIONE UM POSTO</option>`;
    postos.forEach(p => {
      const label = `${up(p.nome)}-${up(p.numero)}`;
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = label;
      sel.appendChild(opt);
    });
  }

  function openNew(){
    const db = S().getData();
    const postos = (db.postos||[]).filter(p=>p.ativo!==false);
    if (!postos.length){
      S().toast("CADASTRE POSTOS PRIMEIRO.", "warning");
      return;
    }
    editingId = "";
    clearForm();
    el("vagaModalTitle").textContent = "NOVA REQUISIÇÃO";
    // data cadastro automática
    el("vagaDataCadastro").value = S().nowBRDateTime();
    el("vagaDataCadastro").readOnly = true;
    el("btnEnviarRH").classList.remove("d-none");
    el("btnEnviarRH").disabled = false;
    modal.show();
  }

  function openEdit(id){
    const db = S().getData();
    const v = (db.vagas||[]).find(x=>x.id===id && x.ativo!==false);
    if (!v) return S().toast("VAGA NÃO ENCONTRADA.", "warning");

    // restrições
    const st = up(v.status);
    if (st === "APROVADA" || st === "REJEITADA"){
      S().toast("NÃO É PERMITIDO ALTERAR VAGAS APROVADAS/REJEITADAS.", "warning");
      return;
    }
    if (st === "ENVIADA" && !["RH","ADMIN"].includes(profile())){
      S().toast("VAGAS ENVIADAS SÓ PODEM SER ALTERADAS PELO RH.", "warning");
      return;
    }
    // apenas criador ou RH/ADMIN
    const isOwner = up(v.criadoPor) === up(username());
    const can = isOwner || ["RH","ADMIN"].includes(profile());
    if (!can){
      S().toast("SEM PERMISSÃO PARA ALTERAR ESTA REQUISIÇÃO.", "warning");
      return;
    }

    editingId = id;
    fillForm(v);
    el("vagaModalTitle").textContent = "ALTERAR REQUISIÇÃO";
    el("btnEnviarRH").classList.add("d-none"); // envio só em rascunho via salvar/enviar
    modal.show();
  }

  function clearForm(){
    ["vagaId","vagaPosto","vagaMotivo","vagaSolicitante","vagaJustificativa","vagaDataPrevista","vagaStatus","vagaDataCadastro"].forEach(id=>{
      if (el(id)) el(id).value = "";
    });
    el("vagaStatus").value = "RASCUNHO";
    refreshPostoOptions();
    refreshSolicitanteMotivoOptions();
  }

  function fillForm(v){
    el("vagaId").value = v.id;
    el("vagaPosto").value = v.idPosto || "";
    el("vagaMotivo").value = up(v.motivo || "");
    el("vagaSolicitante").value = up(v.solicitante || "");
    el("vagaJustificativa").value = up(v.justificativa || "");
    el("vagaDataPrevista").value = v.dataPrevistaISO || "";
    el("vagaStatus").value = up(v.status || "RASCUNHO");
    el("vagaDataCadastro").value = v.dataCadastroBR || "";
    el("vagaDataCadastro").readOnly = true;
  }

  function validateRequired(){
    const posto = el("vagaPosto").value;
    const motivo = up(el("vagaMotivo").value);
    const solicitante = up(el("vagaSolicitante").value);
    const dataPrev = el("vagaDataPrevista").value;
    if (!posto || !motivo || !solicitante || !dataPrev) return false;
    return true;
  }

  function saveDraftOrUpdate(){
    const form = el("vagaForm");
    if (form && !form.checkValidity()){
      form.classList.add("was-validated");
      return;
    }
    if (!validateRequired()){
      S().toast("PREENCHA TODOS OS CAMPOS OBRIGATÓRIOS.", "warning");
      return;
    }

    const id = editingId || S().nextEntityId("V");
    const dataCadastroBR = editingId ? (el("vagaDataCadastro").value || S().nowBRDateTime()) : (el("vagaDataCadastro").value || S().nowBRDateTime());
    const dataPrevISO = el("vagaDataPrevista").value;

    const payload = {
      id,
      idPosto: el("vagaPosto").value,
      motivo: up(el("vagaMotivo").value),
      solicitante: up(el("vagaSolicitante").value),
      justificativa: up(el("vagaJustificativa").value),
      dataPrevistaISO: dataPrevISO,
      dataCadastroBR,
      status: up(el("vagaStatus").value || "RASCUNHO"),
      ativo: true
    };

    S().setData(db => {
      db.vagas ||= [];
      const idx = db.vagas.findIndex(v=>v.id===id);
      const base = idx>=0 ? db.vagas[idx] : {};
      const createdBy = base.criadoPor || username();
      const historico = Array.isArray(base.historico) ? base.historico : [];
      historico.push({ at: S().nowISO(), acao: idx>=0 ? "ALTERAR" : "CRIAR", por: username() });

      const obj = { ...base, ...payload, criadoPor: createdBy, historico };
      if (idx>=0) db.vagas[idx] = obj; else db.vagas.push(obj);
    });

    modal.hide();
    S().toast("REQUISIÇÃO SALVA.", "success");
    render();
    App.Processo?.render?.();
  }

  function sendToRH(){
    if (!validateRequired()){
      S().toast("PREENCHA OS CAMPOS OBRIGATÓRIOS ANTES DE ENVIAR.", "warning");
      return;
    }
    // se já enviada/aprovada etc, não permitir
    const st = up(el("vagaStatus").value);
    if (st !== "RASCUNHO"){
      S().toast("ESTA REQUISIÇÃO JÁ FOI ENVIADA OU PROCESSADA.", "warning");
      return;
    }
    // cria se necessário
    if (!editingId){
      saveDraftOrUpdate();
      // após salvar, pega o último id gerado do seq (não confiável). Reabre? melhor: busca pela última criada por username e dataCadastro
    }

    // enviar
    const id = editingId || el("vagaId").value;
    S().setData(db => {
      const idx = db.vagas.findIndex(v=>v.id===id);
      if (idx>=0){
        db.vagas[idx].status = "ENVIADA";
        db.vagas[idx].historico ||= [];
        db.vagas[idx].historico.push({ at: S().nowISO(), acao:"ENVIAR_RH", por: username() });
      }
    });

    modal.hide();
    S().toast("VAGA ENVIADA PARA O RH COM SUCESSO.", "success");
    render();
    App.Processo?.render?.();
  }

  function getPostoLabelById(idPosto){
    const db = S().getData();
    const p = (db.postos||[]).find(x=>x.id===idPosto);
    if (!p) return "";
    return `${up(p.nome)}-${up(p.numero)}`;
  }

  function render(){
    refreshPostoOptions();
    refreshSolicitanteMotivoOptions();

    const db = S().getData();
    const q = up(el("vagasSearch")?.value || "");
    const rows = (db.vagas||[])
      .filter(v=>v.ativo!==false)
      // manter na tela inicial apenas ENVIADA e RASCUNHO
      .filter(v => ["RASCUNHO","ENVIADA"].includes(up(v.status)))
      .filter(v => !q || [v.id, getPostoLabelById(v.idPosto), v.motivo, v.solicitante, v.status].some(x=> up(x).includes(q)));

    const tbody = el("vagasTbody");
    tbody.innerHTML = "";
    rows.forEach(v => {
      const tr = document.createElement("tr");
      const postoLabel = getPostoLabelById(v.idPosto);
      const finalizada = up(v.status) === "FINALIZADA";

      const st = up(v.status);
      const statusBadge = (st === "ENVIADA")
        ? `<span class="badge text-bg-primary badge-status-icon" title="ENVIADA"><i class="bi bi-send"></i><span class="visually-hidden">ENVIADA</span></span>`
        : (st === "FINALIZADA")
          ? `<span class="badge text-bg-success badge-status-icon" title="FINALIZADA"><i class="bi bi-check2-circle"></i><span class="visually-hidden">FINALIZADA</span></span>`
          : `<span class="badge text-bg-secondary badge-status-icon" title="${S().escapeHTML(st)}">${S().escapeHTML(st)}</span>`;

      tr.innerHTML = `
        <td>${v.id}</td>
        <td>
          <span class="fw-semibold rf-truncate" title="${S().escapeHTML(postoLabel)}">${S().escapeHTML(postoLabel)}</span>
        </td>
        <td>
          <span class="text-muted small rf-truncate" title="${S().escapeHTML(up(v.motivo||""))}${v.justificativa ? ` — ${S().escapeHTML(up(v.justificativa))}` : ""}">
            <i class="bi bi-info-circle"></i>
            ${S().escapeHTML(up(v.motivo||""))}
            ${v.justificativa ? `<span class="text-muted"> — ${S().escapeHTML(up(v.justificativa))}</span>` : ""}
          </span>
        </td>
        <td>
          <span class="badge text-bg-secondary rf-truncate" title="${S().escapeHTML(up(v.solicitante||""))}">${S().escapeHTML(up(v.solicitante||""))}</span>
        </td>
        <td>${S().escapeHTML(v.dataCadastroBR||"")}</td>
        <td>${S().escapeHTML(v.dataPrevistaISO||"")}</td>
        <td>${statusBadge}</td>
        <td class="text-nowrap"></td>
      `;
      const td = tr.lastElementChild;

      // indicador FINALIZADA automático (não clicável)
      const hasApproved = App.Processo?.vagaTemAprovado?.(v.id);
      const showFinalIndicator = hasApproved || up(v.status) === "FINALIZADA";
      if (showFinalIndicator && up(v.status)!=="FINALIZADA"){
        // atualiza status automaticamente
        S().setData(db2 => {
          const idx = db2.vagas.findIndex(x=>x.id===v.id);
          if (idx>=0) db2.vagas[idx].status = "FINALIZADA";
        });
        v.status = "FINALIZADA";
      }

      td.innerHTML = `
        <button class="btn btn-warning btn-vagas-acao btn-acao-icon btn-editar" data-id="${v.id}" ${up(v.status)==="FINALIZADA"?"disabled":""} title="ALTERAR">
          <i class="bi bi-pencil-square" aria-hidden="true"></i>
          <span class="visually-hidden">ALTERAR</span>
        </button>
        <button class="btn btn-danger btn-vagas-acao btn-acao-icon btn-excluir" data-id="${v.id}" ${up(v.status)!=="RASCUNHO"?"disabled":""} title="EXCLUIR">
          <i class="bi bi-trash" aria-hidden="true"></i>
          <span class="visually-hidden">EXCLUIR</span>
        </button>
        ${up(v.status)==="FINALIZADA" ? `<span class="badge text-bg-success badge-status-icon ms-1" title="FINALIZADA"><i class="bi bi-check2-circle"></i><span class="visually-hidden">FINALIZADA</span></span>` : ""}
      `;
      tbody.appendChild(tr);
    });

    el("vagasCount") && (el("vagasCount").textContent = `${rows.length} registro(s)`);
  }

  function exportCSV(){
    const db = S().getData();
    const rows = (db.vagas||[]).filter(v=>v.ativo!==false).map(v => ({
      id: v.id,
      idPosto: v.idPosto,
      posto: getPostoLabelById(v.idPosto),
      motivo: v.motivo,
      solicitante: v.solicitante,
      justificativa: v.justificativa,
      dataCadastro: v.dataCadastroBR,
      dataPrevista: v.dataPrevistaISO,
      status: v.status,
      criadoPor: v.criadoPor
    }));
    const headers = ["id","idPosto","posto","motivo","solicitante","justificativa","dataCadastro","dataPrevista","status","criadoPor"];
    S().downloadText("vagas.csv", S().toCSV(rows, headers), "text/csv;charset=utf-8");
  }

  return { init, render, openEdit, refreshPostoOptions };
})();
