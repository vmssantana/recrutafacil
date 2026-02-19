window.App = window.App || {};

App.Admissao = (() => {
  const S = () => App.Storage;

  let modal = null;
  let currentId = "";

  function el(id){ return document.getElementById(id); }
  function up(v){ return S().upper(v); }

  const ACCEPT = ["application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","image/png","image/jpeg"];

  function init(){
    modal = new bootstrap.Modal(el("modalPreAdmissao"), { backdrop:"static", keyboard:false });

    el("btnExportPre")?.addEventListener("click", exportCSV);

    el("preTbody")?.addEventListener("click",(e)=>{
      const b = e.target.closest("button[data-act='open']");
      if (!b) return;
      open(b.dataset.id);
    });

    el("btnSalvarPre")?.addEventListener("click", salvarPre);
    el("btnArquivarPre")?.addEventListener("click", arquivarPre);

    // whatsapp buttons
    el("btnWA_Ficha")?.addEventListener("click", ()=> abrirWhatsApp("FICHA DE ADMISSÃO", "fileFicha"));
    el("btnWA_Check")?.addEventListener("click", ()=> abrirWhatsApp("LISTA DE DOCUMENTOS", "fileChecklist"));
    el("btnWA_VT")?.addEventListener("click", ()=> abrirWhatsApp("FICHA DE VALE TRANSPORTE", "fileVT"));
  }

  function onlyDigitsPhone(p){
    return String(p||"").replace(/\D/g,"");
  }

  function abrirWhatsApp(docNome, fileInputId){
    const db = S().getData();
    const item = (db.preAdmissao||[]).find(x=>x.id===currentId && x.arquivado!==true);
    if (!item) return;

    const phone = onlyDigitsPhone(item.contato);
    if (!phone){
      S().toast("CONTATO/WHATSAPP NÃO INFORMADO.", "warning");
      return;
    }

    const fileEl = el(fileInputId);
    if (fileEl && fileEl.files && fileEl.files.length === 0){
      S().toast("ANEXE O ARQUIVO ANTES DE ENVIAR.", "warning");
      return;
    }

    const msg = `Olá ${item.nomeCandidato}, você foi APROVADO no processo seletivo para o posto ${item.posto}. Por favor, envie ${docNome} para concluirmos seu processo.`;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
    S().toast("WHATSAPP ABERTO COM MENSAGEM.", "success");
  }

  function render(){
    const db = S().getData();
    const rows = (db.preAdmissao||[]).filter(x=>x.arquivado!==true);

    const tbody = el("preTbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (!rows.length){
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Nenhum candidato aprovado para pré-admissão</td></tr>`;
      return;
    }

    rows.forEach(x=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${x.id}</td>
        <td>${S().escapeHTML(up(x.nomeCandidato))}</td>
        <td>${S().escapeHTML(up(x.posto))}</td>
        <td><span class="badge text-bg-${up(x.statusAdmissao)==="FINALIZADA"?"secondary":"warning"}">${S().escapeHTML(up(x.statusAdmissao||"PENDENTE"))}</span></td>
        <td>${S().escapeHTML(x.dataInicio || "")}</td>
        <td class="text-nowrap"><button class="btn btn-primary btn-sm" data-act="open" data-id="${x.id}">ABRIR</button></td>
      `;
      tbody.appendChild(tr);
    });
  }

  function open(id){
    const db = S().getData();
    const item = (db.preAdmissao||[]).find(x=>x.id===id && x.arquivado!==true);
    if (!item) return S().toast("PRÉ-ADMISSÃO NÃO ENCONTRADA.", "warning");
    currentId = id;

    // Data de início no posto vem da Vaga (dataPrevista)
    const vaga = (db.vagas||[]).find(v=>v.id===item.idVaga && v.ativo!==false);
    const iso = vaga?.dataPrevistaISO || "";
    const dataInicioPosto = iso ? (iso.includes("-") ? iso.split("-").reverse().join("/") : iso) : "";

    // resumo
    el("preResumo").innerHTML = `
      <div class="card card-resumo mb-3">
        <div class="card-body">
          <div class="row g-2">
            <div class="col-md-4"><strong>ID VAGA:</strong> ${S().escapeHTML(item.idVaga)}</div>
            <div class="col-md-8"><strong>POSTO:</strong> ${S().escapeHTML(item.posto)}</div>
            <div class="col-md-6"><strong>DATA DE INÍCIO NO POSTO:</strong> ${S().escapeHTML(dataInicioPosto)}</div>
            <div class="col-md-6"><strong>NOME:</strong> ${S().escapeHTML(item.nomeCandidato)}</div>
            <div class="col-md-6"><strong>WHATSAPP:</strong> ${S().escapeHTML(item.contato)}</div>
            <div class="col-md-6"><strong>DATA APROVAÇÃO:</strong> ${S().escapeHTML(item.dataAprovacao || "")}</div>
            <div class="col-md-6"><strong>ID CANDIDATO:</strong> ${S().escapeHTML(item.idCandidato || "")}</div>
          </div>
        </div>
      </div>
    `;

    // status
    el("preStatus").value = up(item.statusAdmissao || "PENDENTE");

    // status do candidato (permitir marcar DESISTENTE)
    el("preCandStatus") && (el("preCandStatus").value = up(item.statusCandidato || "APROVADO"));

    // limpa inputs file
    ["fileFicha","fileChecklist","fileVT"].forEach(fid => { const f=el(fid); if (f) f.value=""; });

    modal.show();
  }

  function fileMeta(file){
    return { name:file.name, type:file.type, size:file.size, lastModified:file.lastModified };
  }

  function validarArquivo(file){
    if (!file) return { ok:false, msg:"Arquivo não selecionado." };
    const typeOk = ACCEPT.includes(file.type) || file.name.toLowerCase().endsWith(".pdf") || file.name.toLowerCase().endsWith(".doc") || file.name.toLowerCase().endsWith(".docx") || file.name.toLowerCase().endsWith(".png") || file.name.toLowerCase().endsWith(".jpg") || file.name.toLowerCase().endsWith(".jpeg");
    if (!typeOk) return { ok:false, msg:"Formato inválido. Aceito: PDF, DOC, DOCX, PNG, JPG." };
    return { ok:true };
  }

  function salvarPre(){
    const db = S().getData();
    const item = (db.preAdmissao||[]).find(x=>x.id===currentId && x.arquivado!==true);
    if (!item) return;

    const status = up(el("preStatus").value || "PENDENTE");

    const candStatus = up(el("preCandStatus")?.value || (item.statusCandidato || "APROVADO"));

    // anexos (somente metadados)
    const f1 = el("fileFicha")?.files?.[0];
    const f2 = el("fileChecklist")?.files?.[0];
    const f3 = el("fileVT")?.files?.[0];

    if (f1){
      const v = validarArquivo(f1); if (!v.ok) return S().toast(v.msg,"warning");
    }
    if (f2){
      const v = validarArquivo(f2); if (!v.ok) return S().toast(v.msg,"warning");
    }
    if (f3){
      const v = validarArquivo(f3); if (!v.ok) return S().toast(v.msg,"warning");
    }

    S().setData(db2=>{
      const idx = db2.preAdmissao.findIndex(x=>x.id===currentId);
      if (idx<0) return;
      db2.preAdmissao[idx].statusAdmissao = status;
      db2.preAdmissao[idx].statusCandidato = candStatus;
      db2.preAdmissao[idx].anexos ||= {};
      if (f1) db2.preAdmissao[idx].anexos.fichaAdmissao = fileMeta(f1);
      if (f2) db2.preAdmissao[idx].anexos.checklist = fileMeta(f2);
      if (f3) db2.preAdmissao[idx].anexos.valeTransporte = fileMeta(f3);
    });

    
    // Se candidato marcado como DESISTENTE: reativar vaga no Processo Seletivo e liberar novo vínculo
    if (candStatus === "DESISTENTE") {
      if (!S().confirmAction("Marcar candidato como DESISTENTE e reativar a vaga no Processo Seletivo?")) {
        // reverter seleção no UI
        el("preCandStatus") && (el("preCandStatus").value = up(item.statusCandidato || "APROVADO"));
        return;
      }

      S().setData(db3 => {
        // 1) Atualiza vaga para voltar a aparecer no Processo Seletivo
        const v = (db3.vagas||[]).find(x => x.id === item.idVaga && x.ativo !== false);
        if (v) {
          v.status = "APROVADA";
          v.historico ||= [];
          v.historico.push({ at: S().nowISO(), acao:"REATIVAR_VAGA", por:"PRÉ-ADMISSÃO" });
        }

        // 2) Remove/Desativa vínculo do candidato no processo seletivo
        const p = (db3.processos||[]).find(x => x.idVaga === item.idVaga && x.ativo !== false);
        const link = (p?.candidatosVinculados||[]).find(x => x.idCandidato === item.idCandidato && x.ativo !== false);
        if (link) {
          link.status = "DESISTENTE";
          link.ativo = false; // não ocupa mais a vaga
        }
        if (p) {
          p.timeline ||= [];
          p.timeline.push({ at: S().nowISO(), acao:"DESISTENTE_PRE", candidato:item.idCandidato });
        }

        // 3) Arquiva esta pré-admissão (mantém no histórico)
        const pa = (db3.preAdmissao||[]).find(x => x.id === currentId);
        if (pa) {
          pa.arquivado = true;
          pa.statusAdmissao = "PENDENTE";
        }
      });

      S().toast("Candidato marcado como DESISTENTE. Vaga reativada.", "warning");
      modal.hide();
      render();
      App.Processo?.render?.();
      App.Vagas?.render?.();
      return;
    }

    S().toast("PRÉ-ADMISSÃO SALVA.", "success");

    render();
  }

  function arquivarPre(){
    if (!S().confirmAction("Arquivar este processo de pré-admissão?")) return;
    S().setData(db=>{
      const idx = db.preAdmissao.findIndex(x=>x.id===currentId);
      if (idx<0) return;
      db.preAdmissao[idx].statusAdmissao = "FINALIZADA";
      db.preAdmissao[idx].arquivado = true;
      db.preAdmissao[idx].dataArquivamento = S().nowBRDate();
    });
    modal.hide();
    S().toast("PROCESSO ARQUIVADO COM SUCESSO.", "success");
    render();
  }

  function exportCSV(){
    const db = S().getData();
    const rows = (db.preAdmissao||[]).map(x => ({
      id: x.id,
      idVaga: x.idVaga,
      posto: x.posto,
      idCandidato: x.idCandidato,
      nomeCandidato: x.nomeCandidato,
      contato: x.contato,
      dataAprovacao: x.dataAprovacao,
      statusAdmissao: x.statusAdmissao,
      arquivado: x.arquivado ? "SIM" : "NAO",
      dataInicio: x.dataInicio
    }));
    const headers = ["id","idVaga","posto","idCandidato","nomeCandidato","contato","dataAprovacao","statusAdmissao","arquivado","dataInicio"];
    S().downloadText("pre_admissao.csv", S().toCSV(rows, headers), "text/csv;charset=utf-8");
  }

  return { init, render };
})();
