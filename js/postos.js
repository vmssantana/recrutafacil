window.App = window.App || {};

App.Postos = (() => {
  const S = () => App.Storage;

  let modalPosto = null;
  let modalImport = null;
  let editingId = "";
  let importBuffer = [];

  function el(id){ return document.getElementById(id); }
  function up(v){ return S().upper(v); }

  function canEdit(){ return S().canEditPostos(); }

  function init(){
    modalPosto = new bootstrap.Modal(el("modalPosto"), { backdrop:"static", keyboard:false });
    modalImport = new bootstrap.Modal(el("modalImportarPostos"), { backdrop:"static", keyboard:false });

    if (!canEdit()){
      el("btnNovoPosto")?.classList.add("d-none");
      el("btnImportarPostos")?.classList.add("d-none");
    } else {
      el("btnNovoPosto")?.addEventListener("click", openNew);
      el("btnImportarPostos")?.addEventListener("click", () => { resetImportUI(); modalImport.show(); });
    }

    el("btnPostoSave")?.addEventListener("click", saveFromForm);
    el("postosSearch")?.addEventListener("input", render);
    el("btnExportPostos")?.addEventListener("click", exportCSV);

    // import
    el("btnLerArquivoPostos")?.addEventListener("click", readImportFile);
    el("btnConfirmarImportacaoPostos")?.addEventListener("click", confirmImport);

    // drag drop
    const dz = el("postoDropzone");
    const fi = el("postoFile");
    if (dz && fi){
      dz.addEventListener("click", ()=> fi.click());
      dz.addEventListener("dragover",(e)=>{e.preventDefault(); dz.classList.add("border-primary");});
      dz.addEventListener("dragleave",()=> dz.classList.remove("border-primary"));
      dz.addEventListener("drop",(e)=>{e.preventDefault(); dz.classList.remove("border-primary"); if (e.dataTransfer?.files?.length) fi.files=e.dataTransfer.files;});
    }

    // ações tabela
    el("postosTbody")?.addEventListener("click",(e)=>{
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      const act = btn.dataset.act;
      const id = btn.dataset.id;
      if (!id) return;
      if (act === "open") openEdit(id);
      if (act === "del") removeLogical(id);
    });
  }

  function openNew(){
    if (!canEdit()) return S().toast("Perfil CONSULTA: acesso somente leitura em Postos.", "warning");
    editingId = "";
    fillForm({ id:"", nome:"", numero:"", turno:"", lotacao:"", cidade:"", supervisao:"" });
    el("postoModalTitle").textContent = "NOVO POSTO";
    modalPosto.show();
  }

  function openEdit(id){
    const db = S().getData();
    const p = (db.postos||[]).find(x => x.id === id && x.ativo !== false);
    if (!p) return S().toast("POSTO NÃO ENCONTRADO.", "warning");
    editingId = p.id;
    fillForm(p);
    el("postoModalTitle").textContent = canEdit() ? "ALTERAR POSTO" : "CONSULTAR POSTO";
    // readonly se consulta
    setFormReadOnly(!canEdit());
    modalPosto.show();
  }

  function setFormReadOnly(readonly){
    ["postoNome","postoNumero","postoTurno","postoLotacao","postoCidade","postoSupervisao"].forEach(id=>{
      const x = el(id);
      if (!x) return;
      x.disabled = readonly;
      x.classList.toggle("readonly", readonly);
    });
    el("btnPostoSave")?.classList.toggle("d-none", readonly);
  }

  function fillForm(p){
    el("postoId").value = p.id || "";
    el("postoNome").value = up(p.nome || "");
    el("postoNumero").value = up(p.numero || "");
    el("postoTurno").value = up(p.turno || "");
    el("postoLotacao").value = up(p.lotacao || "");
    el("postoCidade").value = up(p.cidade || "");
    el("postoSupervisao").value = up(p.supervisao || "");
    setFormReadOnly(!canEdit());
  }

  function validateForm(){
    const required = ["postoNome","postoNumero","postoTurno","postoLotacao","postoCidade","postoSupervisao"];
    for (const id of required){
      if (!up(el(id).value)) return false;
    }
    return true;
  }

  function saveFromForm(){
    if (!canEdit()) return;
    const form = el("postoForm");
    if (form && !form.checkValidity()){
      form.classList.add("was-validated");
      return;
    }
    if (!validateForm()){
      S().toast("Preencha todos os campos obrigatórios.", "warning");
      return;
    }

    const data = {
      id: editingId || S().nextEntityId("P"),
      nome: up(el("postoNome").value),
      numero: up(el("postoNumero").value),
      turno: up(el("postoTurno").value),
      lotacao: up(el("postoLotacao").value),
      cidade: up(el("postoCidade").value),
      supervisao: up(el("postoSupervisao").value),
      ativo: true,
      dataCriacao: S().nowISO()
    };

    S().setData(db => {
      db.postos ||= [];
      if (editingId){
        const idx = db.postos.findIndex(x => x.id === editingId);
        if (idx >= 0) db.postos[idx] = { ...db.postos[idx], ...data };
      } else {
        db.postos.push(data);
      }
    });

    modalPosto.hide();
    S().toast("POSTO SALVO COM SUCESSO.", "success");
    render();
    App.Vagas?.refreshPostoOptions?.();
    App.Candidatos?.refreshCidadeOptions?.();
  }

  function removeLogical(id){
    if (!canEdit()) return;
    const db = S().getData();
    const p = (db.postos||[]).find(x => x.id === id && x.ativo !== false);
    if (!p) return;

    // não permitir exclusão se houver vaga ativa vinculada
    const hasVagaAtiva = (db.vagas||[]).some(v => v.ativo !== false && v.idPosto === id && ["RASCUNHO","ENVIADA","APROVADA"].includes(S().upper(v.status)));
    if (hasVagaAtiva){
      S().toast("NÃO É POSSÍVEL EXCLUIR: EXISTE VAGA ATIVA VINCULADA.", "warning");
      return;
    }

    if (!S().confirmAction(`EXCLUIR POSTO ${p.id}?`)) return;

    S().setData(db2 => {
      const idx = db2.postos.findIndex(x => x.id === id);
      if (idx >= 0) db2.postos[idx].ativo = false;
    });

    S().toast("POSTO EXCLUÍDO (LÓGICO).", "success");
    render();
    App.Vagas?.refreshPostoOptions?.();
    App.Candidatos?.refreshCidadeOptions?.();
  }

  function render(){
    const db = S().getData();
    const q = up(el("postosSearch")?.value || "");
    const rows = (db.postos||[])
      .filter(p=>p.ativo!==false)
      .filter(p => !q || [p.id,p.nome,p.numero,p.turno,p.lotacao,p.cidade,p.supervisao].some(x => up(x).includes(q)));

    const tbody = el("postosTbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    rows.forEach(p => {
      // Correção visual/organizacional: separar lotação e supervisão caso estejam armazenadas juntas
      // (mantém dados intactos; apenas ajusta exibição)
      let lotacaoView = up(p.lotacao || "");
      let supervisaoView = up(p.supervisao || "");
      if (!supervisaoView) {
        const idx = lotacaoView.indexOf("SUPERV");
        if (idx > 0) {
          supervisaoView = lotacaoView.slice(idx).trim();
          lotacaoView = lotacaoView.slice(0, idx)
            .replace(/[-–—|\s]+$/g, "")
            .trim();
        }
      }

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${p.id}</td>
        <td class="col-nome-wide"><span class="fw-semibold rf-truncate" title="${S().escapeHTML(up(p.nome))}">${S().escapeHTML(up(p.nome))}</span></td>
        <td>${S().escapeHTML(up(p.numero))}</td>
        <td>${S().escapeHTML(up(p.turno))}</td>
        <td><span class="rf-truncate" title="${S().escapeHTML(lotacaoView)}">${S().escapeHTML(lotacaoView)}</span></td>
        <td>${S().escapeHTML(up(p.cidade))}</td>
        <td><span class="rf-truncate" title="${S().escapeHTML(supervisaoView)}">${S().escapeHTML(supervisaoView)}</span></td>
        <td class="text-nowrap"></td>
      `;
      const actionsCell = tr.lastElementChild;

      const actions = (!canEdit())
        ? `<span class="text-muted small">SOMENTE CONSULTA</span>`
        : `
            <button class="btn btn-primary btn-sm btn-acao-icon" title="ABRIR" data-act="open" data-id="${p.id}">
              <i class="bi bi-pencil-square" aria-hidden="true"></i>
              <span class="visually-hidden">ABRIR</span>
            </button>
            <button class="btn btn-danger btn-sm btn-acao-icon" title="EXCLUIR" data-act="del" data-id="${p.id}">
              <i class="bi bi-trash" aria-hidden="true"></i>
              <span class="visually-hidden">EXCLUIR</span>
            </button>
          `;
      actionsCell.innerHTML = actions;
      tbody.appendChild(tr);
    });

    el("postosCount") && (el("postosCount").textContent = `${rows.length} registro(s)`);
  }

  // ===== IMPORTAÇÃO =====
  function resetImportUI(){
    importBuffer = [];
    el("postoFile").value = "";
    el("importPreview").innerHTML = "";
    el("importResult").classList.add("d-none");
    el("btnConfirmarImportacaoPostos").disabled = true;
  }

  function parseCSV(text){
    // separador ; ou ,
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) return [];
    const sep = lines[0].includes(";") ? ";" : ",";
    const header = lines[0].split(sep).map(h => up(h));
    const idx = (name) => header.findIndex(h => h === up(name));
    const required = ["NOME DO POSTO","NÚMERO DO POSTO","NUMERO DO POSTO","TURNO","LOTAÇÃO","LOTACAO","CIDADE","SUPERVISÃO","SUPERVISAO"];

    const rows = [];
    for (let i=1;i<lines.length;i++){
      const cols = lines[i].split(sep).map(c => c.trim());
      if (cols.length < 3) continue;
      const nome = cols[idx("NOME DO POSTO")] ?? cols[idx("NOME")] ?? "";
      const numero = cols[idx("NÚMERO DO POSTO")] ?? cols[idx("NUMERO DO POSTO")] ?? cols[idx("NÚMERO")] ?? cols[idx("NUMERO")] ?? "";
      const turno = cols[idx("TURNO")] ?? "";
      const lotacao = cols[idx("LOTAÇÃO")] ?? cols[idx("LOTACAO")] ?? "";
      const cidade = cols[idx("CIDADE")] ?? "";
      const sup = cols[idx("SUPERVISÃO")] ?? cols[idx("SUPERVISAO")] ?? "";
      if (!nome || !numero || !turno || !lotacao || !cidade || !sup) continue;
      rows.push({ nome: up(nome), numero: up(numero), turno: up(turno), lotacao: up(lotacao), cidade: up(cidade), supervisao: up(sup) });
    }
    return rows;
  }

  async function readImportFile(){
    if (!canEdit()) return;
    const file = el("postoFile")?.files?.[0];
    if (!file) { S().toast("Selecione um arquivo (CSV/TXT).", "warning"); return; }

    const text = await file.text();
    const parsed = parseCSV(text);

    if (!parsed.length){
      S().toast("Nenhuma linha válida encontrada. Verifique o formato.", "warning");
      el("btnConfirmarImportacaoPostos").disabled = true;
      return;
    }
    importBuffer = parsed;
    renderImportPreview(parsed);
    el("btnConfirmarImportacaoPostos").disabled = false;
  }

  function renderImportPreview(list){
    const pv = el("importPreview");
    pv.innerHTML = `
      <table class="table table-sm table-bordered">
        <thead class="table-light">
          <tr><th>NOME</th><th>NÚMERO</th><th>TURNO</th><th>LOTAÇÃO</th><th>CIDADE</th><th>SUPERVISÃO</th></tr>
        </thead>
        <tbody>
          ${list.slice(0,10).map(r => `
            <tr>
              <td>${S().escapeHTML(r.nome)}</td>
              <td>${S().escapeHTML(r.numero)}</td>
              <td>${S().escapeHTML(r.turno)}</td>
              <td>${S().escapeHTML(r.lotacao)}</td>
              <td>${S().escapeHTML(r.cidade)}</td>
              <td>${S().escapeHTML(r.supervisao)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      <div class="text-muted small">Prévia: exibindo até 10 linhas.</div>
    `;
  }

  function confirmImport(){
    if (!canEdit()) return;
    if (!importBuffer.length) return;

    let imported = 0;
    S().setData(db => {
      db.postos ||= [];
      importBuffer.forEach(r => {
        const id = S().nextEntityId("P");
        db.postos.push({
          id, ...r,
          ativo: true,
          dataCriacao: S().nowISO()
        });
        imported++;
      });
    });

    el("importResult").classList.remove("d-none");
    el("importResult").textContent = `${imported} POSTO(S) IMPORTADO(S) COM SUCESSO.`;
    S().toast(`${imported} POSTO(S) IMPORTADO(S).`, "success");
    render();
    App.Vagas?.refreshPostoOptions?.();
    App.Candidatos?.refreshCidadeOptions?.();
  }

  function exportCSV(){
    const db = S().getData();
    const rows = (db.postos||[]).filter(p=>p.ativo!==false).map(p => ({
      id: p.id,
      nome: p.nome,
      numero: p.numero,
      turno: p.turno,
      lotacao: p.lotacao,
      cidade: p.cidade,
      supervisao: p.supervisao
    }));
    const headers = ["id","nome","numero","turno","lotacao","cidade","supervisao"];
    const csv = S().toCSV(rows, headers);
    S().downloadText("postos.csv", csv, "text/csv;charset=utf-8");
  }

  return { init, render };
})();
