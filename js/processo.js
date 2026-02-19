window.App = window.App || {};

App.Processo = (() => {
  const S = () => App.Storage;

  let modal = null;
  let modalStatus = null;
  let currentVagaId = "";
  let editingLinkId = ""; // idCandidato for status change

  function el(id){ return document.getElementById(id); }
  function up(v){ return S().upper(v); }

  function init(){
    modal = new bootstrap.Modal(el("modalProcesso"), { backdrop:"static", keyboard:false });
    modalStatus = new bootstrap.Modal(el("modalStatusCand"), { backdrop:"static", keyboard:false });

    el("processoSearch")?.addEventListener("input", render);
    el("btnExportProcesso")?.addEventListener("click", exportCSV);

    // iniciar a partir da listagem
    el("processoVagasTbody")?.addEventListener("click",(e)=>{
      const btn = e.target.closest("button[data-act='start']");
      if (!btn) return;
      const id = btn.dataset.id;
      if (!id) return;
      openProcess(id);
    });

    // vincular candidato
    el("btnVincularCandidato")?.addEventListener("click", vincularCandidato);
    el("psIdCandidato")?.addEventListener("blur", onCandidateIdBlur);

    // ações nos vinculados
    el("psCandsTbody")?.addEventListener("click",(e)=>{
      const b = e.target.closest("button[data-act]");
      if (!b) return;
      const act = b.dataset.act;
      const idC = b.dataset.cid;
      if (!idC) return;
      if (act === "edit") openStatusModal(idC);
      if (act === "del") excluirVinculo(idC);
    });

    // salvar status
    el("btnSalvarStatusCand")?.addEventListener("click", salvarStatusAlteracao);
  }

  function getPostoLabelByVaga(vaga){
    const db = S().getData();
    const p = (db.postos||[]).find(x=>x.id===vaga.idPosto);
    if (!p) return "";
    return `${up(p.nome)}-${up(p.numero)}`;
  }

  function vagasElegiveis(){
    const db = S().getData();
    return (db.vagas||[])
      .filter(v=>v.ativo!==false)
      .filter(v => ["ENVIADA","APROVADA"].includes(up(v.status)));
  }

  function render(){
    const q = up(el("processoSearch")?.value || "");
    const rows = vagasElegiveis().filter(v => !q || [v.id, getPostoLabelByVaga(v), v.status].some(x=> up(x).includes(q)));

    const tbody = el("processoVagasTbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    rows.forEach(v=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${v.id}</td>
        <td>${S().escapeHTML(getPostoLabelByVaga(v))}</td>
        <td>${S().escapeHTML(v.dataCadastroBR || "")}</td>
        <td>${S().escapeHTML(v.dataPrevistaISO || "")}</td>
        <td><span class="badge text-bg-${up(v.status)==="ENVIADA"?"primary":"secondary"}">${S().escapeHTML(up(v.status))}</span></td>
        <td class="text-nowrap">
          <button class="btn btn-success btn-sm btn-ps-acao" data-act="start" data-id="${v.id}">INICIAR</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    el("processoCount") && (el("processoCount").textContent = `${rows.length} vaga(s)`);
  }

  function getOrCreateProcess(idVaga){
    let proc = null;
    S().setData(db=>{
      db.processos ||= [];
      proc = db.processos.find(p=>p.idVaga===idVaga && p.ativo!==false);
      if (!proc){
        proc = {
          id: S().nextEntityId("PR"),
          idVaga,
          candidatosVinculados: [],
          statusProcesso: "EM PROCESSO",
          timeline: [{ at: S().nowISO(), acao: "CRIADO" }],
          observacoes: "",
          ativo: true
        };
        db.processos.push(proc);
      }
    });
    // recarrega para retornar referência atualizada
    const db2 = S().getData();
    return (db2.processos||[]).find(p=>p.idVaga===idVaga && p.ativo!==false);
  }

  function openProcess(idVaga){
    const db = S().getData();
    const vaga = (db.vagas||[]).find(v=>v.id===idVaga && v.ativo!==false);
    if (!vaga) return S().toast("VAGA NÃO ENCONTRADA.", "warning");

    // se finalizada, bloqueia novos vínculos (deveria não estar aqui, mas por segurança)
    if (up(vaga.status) === "FINALIZADA"){
      S().toast("VAGA FINALIZADA: NÃO É POSSÍVEL VINCULAR NOVOS CANDIDATOS.", "warning");
    }

    currentVagaId = idVaga;
    const proc = getOrCreateProcess(idVaga);

    // topo infos
    el("psVagaId").value = vaga.id;
    el("psPosto").value = getPostoLabelByVaga(vaga);
    el("psDataPrevista").value = vaga.dataPrevistaISO || "";
    el("psDataCadastro").value = vaga.dataCadastroBR || "";

    // limpar form vinculo
    el("psIdCandidato").value = "";
    el("psNomeCandidato").value = "";
    el("psContatoCandidato").value = "";
    el("psStatusCandidato").value = "EM ANÁLISE";
    el("psStatusCandidato").disabled = true;

    renderVinculados(proc);
    modal.show();
  }

  function onCandidateIdBlur(){
    const id = up(el("psIdCandidato").value);
    if (!id) return;
    const db = S().getData();
    const c = (db.candidatos||[]).find(x=>x.id===id && x.ativo!==false);
    if (!c){
      S().toast("CANDIDATO NÃO ENCONTRADO.", "warning");
      el("psNomeCandidato").value = "";
      el("psContatoCandidato").value = "";
      return;
    }
    el("psNomeCandidato").value = up(c.nomeCompleto);
    el("psContatoCandidato").value = up(c.contato);
    // regra: status automático EM ANÁLISE
    el("psStatusCandidato").value = "EM ANÁLISE";
    el("psStatusCandidato").disabled = true;
  }

  function vincularCandidato(){
    const db = S().getData();
    const vaga = (db.vagas||[]).find(v=>v.id===currentVagaId && v.ativo!==false);
    if (!vaga) return;

    if (up(vaga.status) === "FINALIZADA"){
      S().toast("VAGA FINALIZADA: NÃO É POSSÍVEL VINCULAR.", "warning");
      return;
    }

    const idC = up(el("psIdCandidato").value);
    if (!idC) return S().toast("INFORME O ID DO CANDIDATO.", "warning");

    const c = (db.candidatos||[]).find(x=>x.id===idC && x.ativo!==false);
    if (!c) return S().toast("CANDIDATO NÃO ENCONTRADO.", "warning");

    S().setData(db2=>{
      const proc = getOrCreateProcess(currentVagaId);
      const idxP = db2.processos.findIndex(p=>p.id===proc.id);
      const proc2 = db2.processos[idxP];

      proc2.candidatosVinculados ||= [];
      const exists = proc2.candidatosVinculados.find(x=>x.idCandidato===idC && x.ativo!==false);
      if (exists){
        S().toast("CANDIDATO JÁ VINCULADO A ESTA VAGA.", "warning");
        return;
      }

      proc2.candidatosVinculados.push({
        idCandidato: idC,
        nome: up(c.nomeCompleto),
        contato: up(c.contato),
        status: "EM ANÁLISE",
        dataVinculacao: S().nowBRDateTime(),
        ativo: true
      });

      proc2.timeline ||= [];
      proc2.timeline.push({ at: S().nowISO(), acao: "VINCULAR", candidato: idC });
    });

    // atualizar tela
    const proc = getOrCreateProcess(currentVagaId);
    renderVinculados(proc);

    // reset campo id
    el("psIdCandidato").value = "";
    el("psNomeCandidato").value = "";
    el("psContatoCandidato").value = "";
    el("psStatusCandidato").value = "EM ANÁLISE";
    S().toast("CANDIDATO VINCULADO.", "success");
  }

  function renderVinculados(proc){
    const tbody = el("psCandsTbody");
    tbody.innerHTML = "";
    const list = (proc?.candidatosVinculados||[]).filter(x=>x.ativo!==false);

    list.forEach(x=>{
      const tr = document.createElement("tr");
      const st = up(x.status);
      tr.innerHTML = `
        <td>${x.idCandidato}</td>
        <td>${S().escapeHTML(up(x.nome))}</td>
        <td>${S().escapeHTML(up(x.contato))}</td>
        <td>${S().escapeHTML(st)}</td>
        <td>${S().escapeHTML(x.dataVinculacao || "")}</td>
        <td class="text-nowrap"></td>
      `;
      const td = tr.lastElementChild;

      const readonly = st === "APROVADO";
      td.innerHTML = `
        <button class="btn btn-warning btn-sm btn-ps-acao" data-act="edit" data-cid="${x.idCandidato}" ${readonly?"disabled":""}>ALTERAR</button>
        <button class="btn btn-danger btn-sm btn-ps-acao" data-act="del" data-cid="${x.idCandidato}" ${readonly?"disabled":""}>EXCLUIR</button>
      `;
      tbody.appendChild(tr);
    });

    el("psInfo") && (el("psInfo").textContent = `${list.length} candidato(s) vinculado(s).`);
  }

  function openStatusModal(idCandidato){
    editingLinkId = idCandidato;
    const proc = getOrCreateProcess(currentVagaId);
    const link = (proc.candidatosVinculados||[]).find(x=>x.idCandidato===idCandidato && x.ativo!==false);
    if (!link) return;

    // regra: aprovado é somente leitura
    if (up(link.status) === "APROVADO"){
      S().toast("CANDIDATO APROVADO - MODO SOMENTE LEITURA.", "warning");
      return;
    }

    el("stCandId").value = link.idCandidato;
    el("stCandNome").value = up(link.nome);
    el("stCandContato").value = up(link.contato);

    const sel = el("stCandStatus");
    sel.innerHTML = `
      <option value="EM ANÁLISE">EM ANÁLISE</option>
      <option value="APROVADO">APROVADO</option>
      <option value="REPROVADO">REPROVADO</option>
      <option value="DESISTENTE">DESISTENTE</option>
    `;
    sel.value = up(link.status) || "EM ANÁLISE";

    modalStatus.show();
  }

  function salvarStatusAlteracao(){
    const novo = up(el("stCandStatus").value);

    // validações: não permitir mudar de APROVADO para outro (já bloqueado no UI)
    const proc = getOrCreateProcess(currentVagaId);
    const link = (proc.candidatosVinculados||[]).find(x=>x.idCandidato===editingLinkId && x.ativo!==false);
    if (!link) return;

    if (up(link.status) === "APROVADO") {
      S().toast("CANDIDATO APROVADO - SOMENTE LEITURA.", "warning");
      modalStatus.hide();
      return;
    }

    // Apenas 1 candidato aprovado por vaga
    if (novo === "APROVADO"){
      const ja = (proc.candidatosVinculados||[]).some(x=>x.ativo!==false && up(x.status)==="APROVADO" && x.idCandidato!==editingLinkId);
      if (ja){
        S().toast("JÁ EXISTE UM CANDIDATO APROVADO PARA ESTA VAGA.", "warning");
        return;
      }
    }

    S().setData(db=>{
      const p = (db.processos||[]).find(x=>x.idVaga===currentVagaId && x.ativo!==false);
      if (!p) return;
      const l = (p.candidatosVinculados||[]).find(x=>x.idCandidato===editingLinkId && x.ativo!==false);
      if (!l) return;
      l.status = novo;
      p.timeline ||= [];
      p.timeline.push({ at: S().nowISO(), acao:"STATUS", candidato: editingLinkId, para: novo });
    });

    // se aprovado: finaliza vaga e manda para pré-admissão
    if (novo === "APROVADO"){
      finalizarVagaEEnviarPre(currentVagaId, editingLinkId);
      S().toast("CANDIDATO APROVADO. ENVIADO PARA PRÉ-ADMISSÃO.", "success");
    } else {
      S().toast("STATUS ATUALIZADO.", "success");
    }

    modalStatus.hide();
    const proc2 = getOrCreateProcess(currentVagaId);
    renderVinculados(proc2);
    App.Vagas?.render?.();
    App.Admissao?.render?.();
  }

  function excluirVinculo(idCandidato){
    if (!S().confirmAction("Remover candidato do processo?")) return;

    const proc = getOrCreateProcess(currentVagaId);
    const link = (proc.candidatosVinculados||[]).find(x=>x.idCandidato===idCandidato && x.ativo!==false);
    if (!link) return;

    if (up(link.status) === "APROVADO"){
      S().toast("CANDIDATO APROVADO - NÃO PODE SER EXCLUÍDO.", "warning");
      return;
    }

    S().setData(db=>{
      const p = (db.processos||[]).find(x=>x.idVaga===currentVagaId && x.ativo!==false);
      if (!p) return;
      const l = (p.candidatosVinculados||[]).find(x=>x.idCandidato===idCandidato && x.ativo!==false);
      if (!l) return;
      l.ativo = false;
      p.timeline ||= [];
      p.timeline.push({ at: S().nowISO(), acao:"EXCLUIR_VINCULO", candidato: idCandidato });
    });

    const proc2 = getOrCreateProcess(currentVagaId);
    renderVinculados(proc2);
    S().toast("VÍNCULO EXCLUÍDO.", "success");
  }

  function finalizarVagaEEnviarPre(idVaga, idCandidato){
    const db = S().getData();
    const vaga = (db.vagas||[]).find(v=>v.id===idVaga && v.ativo!==false);
    const proc = (db.processos||[]).find(p=>p.idVaga===idVaga && p.ativo!==false);
    const link = (proc?.candidatosVinculados||[]).find(x=>x.idCandidato===idCandidato && x.ativo!==false);
    if (!vaga || !link) return;

    // 1) finaliza vaga
    S().setData(db2=>{
      const idx = db2.vagas.findIndex(v=>v.id===idVaga);
      if (idx>=0){
        db2.vagas[idx].status = "FINALIZADA";
        db2.vagas[idx].historico ||= [];
        db2.vagas[idx].historico.push({ at: S().nowISO(), acao:"FINALIZAR_AUTO", por:"SISTEMA" });
      }
    });

    // 2) cria pré-admissão (se não existir)
    const postoLabel = getPostoLabelByVaga(vaga);
    const resumo = {
      id: S().nextEntityId("PA"),
      idVaga: vaga.id,
      posto: postoLabel,
      nomeCandidato: up(link.nome),
      contato: up(link.contato),
      dataAprovacao: S().nowBRDate(),
      idCandidato: link.idCandidato,
      statusCandidato: "APROVADO",
      statusAdmissao: "PENDENTE",
      anexos: { fichaAdmissao:null, checklist:null, valeTransporte:null },
      arquivado: false,
      dataInicio: S().nowBRDate()
    };

    S().setData(db2=>{
      db2.preAdmissao ||= [];
      const exists = db2.preAdmissao.some(x=>x.idVaga===vaga.id && x.idCandidato===link.idCandidato && x.arquivado!==true);
      if (!exists){
        db2.preAdmissao.push(resumo);
      }
    });
  }

  function vagaTemAprovado(idVaga){
    const db = S().getData();
    const p = (db.processos||[]).find(x=>x.idVaga===idVaga && x.ativo!==false);
    if (!p) return false;
    return (p.candidatosVinculados||[]).some(x=>x.ativo!==false && up(x.status)==="APROVADO");
  }

  function exportCSV(){
    const db = S().getData();
    const rows = [];
    (db.processos||[]).filter(p=>p.ativo!==false).forEach(p=>{
      (p.candidatosVinculados||[]).filter(x=>x.ativo!==false).forEach(x=>{
        rows.push({
          idProcesso: p.id,
          idVaga: p.idVaga,
          idCandidato: x.idCandidato,
          nome: x.nome,
          contato: x.contato,
          status: x.status,
          dataVinculacao: x.dataVinculacao
        });
      });
    });
    const headers = ["idProcesso","idVaga","idCandidato","nome","contato","status","dataVinculacao"];
    S().downloadText("processo_seletivo.csv", S().toCSV(rows, headers), "text/csv;charset=utf-8");
  }

  return { init, render, vagaTemAprovado };
})();
