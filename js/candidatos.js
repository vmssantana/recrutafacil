window.App = window.App || {};

App.Candidatos = (() => {
  const S = () => App.Storage;

  let modal = null;
  let editingId = "";

  const CARGOS_FIXOS = [
    "SERVENTE",
    "LIDER",
    "ENCARREGADO",
    "PEDAGOGO",
    "AUXILIAR DE SAUDE BUCAL",
    "AUXILIAR ADMINISTRATIVO",
    "SUPERVISOR"
  ];

  function el(id){ return document.getElementById(id); }
  function up(v){ return S().upper(v); }

  function init(){
    modal = new bootstrap.Modal(el("modalCandidato"), { backdrop:"static", keyboard:false });

    el("btnNovoCand")?.addEventListener("click", openNew);
    el("btnCandSave")?.addEventListener("click", save);
    el("candSearch")?.addEventListener("input", render);
    el("btnExportCandidatos")?.addEventListener("click", exportCSV);

    // delegation: alterar/excluir
    el("candTbody")?.addEventListener("click",(e)=>{
      const a = e.target.closest("button[data-act]");
      if (!a) return;
      const id = a.dataset.id;
      if (!id) return;
      if (a.dataset.act === "edit") openEdit(id);
      if (a.dataset.act === "del") removeLogical(id);
    });

    refreshCargoSelect("");
    render();
  }

  function refreshCargoSelect(selectedValue=""){
    const sel = el("cargoInteresse");
    if (!sel) return;
    // se o HTML estiver com input antigo, não quebra
    if (sel.tagName.toLowerCase() !== "select") return;

    const selected = up(selectedValue);
    sel.innerHTML = `<option value="">SELECIONE UM CARGO</option>`;
    CARGOS_FIXOS.forEach(c=>{
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      sel.appendChild(opt);
    });

    // retrocompat
    if (selected && !CARGOS_FIXOS.includes(selected)){
      const opt = document.createElement("option");
      opt.value = selected;
      opt.textContent = `${selected} (CADASTRADO ANTES)`;
      sel.appendChild(opt);
    }
    sel.value = selected || "";
  }

  // ===== RESTAURAÇÃO: cidades vindas de Postos =====
  function carregarCidades(selected=""){
    const selectCidade = el("cidadeInteresse");
    if (!selectCidade) return;

    const db = S().getData();
    const cidades = (db.postos||[])
      .filter(p=>p.ativo!==false && p.cidade)
      .map(p=> up(p.cidade));

    const cidadesUnicas = [...new Set(cidades)].sort();

    // limpa mantendo placeholder
    while (selectCidade.options.length > 1){
      selectCidade.remove(1);
    }

    if (!cidadesUnicas.length){
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "NENHUMA CIDADE CADASTRADA";
      selectCidade.appendChild(opt);
      selectCidade.disabled = true;
      return;
    }

    selectCidade.disabled = false;
    cidadesUnicas.forEach(c=>{
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      selectCidade.appendChild(opt);
    });

    if (selected) selectCidade.value = up(selected);
  }

  function refreshCidadeOptions(){
    carregarCidades(el("cidadeInteresse")?.value || "");
  }

  function clearForm(){
    editingId = "";
    el("candId").value = "";
    el("candNome").value = "";
    el("candContato").value = "";
    el("candObs").value = "";
    // cargo
    const ci = el("cargoInteresse");
    if (ci){
      if (ci.tagName.toLowerCase() === "select") ci.value = "";
      else ci.value = "";
    }
    // cidade
    if (el("cidadeInteresse")) el("cidadeInteresse").value = "";
  }

  function openNew(){
    clearForm();
    el("candModalTitle").textContent = "NOVO CANDIDATO";
    refreshCargoSelect("");
    modal.show();
    setTimeout(()=> carregarCidades(), 80);
  }

  function openEdit(id){
    const db = S().getData();
    const c = (db.candidatos||[]).find(x=>x.id===id && x.ativo!==false);
    if (!c) return S().toast("CANDIDATO NÃO ENCONTRADO.", "warning");

    editingId = c.id;
    el("candId").value = c.id;
    el("candNome").value = up(c.nomeCompleto||"");
    el("candContato").value = up(c.contato||"");
    el("candObs").value = up(c.observacoes||"");
    // cargo
    refreshCargoSelect(c.cargoInteresse || "");
    const ci = el("cargoInteresse");
    if (ci && ci.tagName.toLowerCase() !== "select"){
      ci.value = up(c.cargoInteresse||"");
    }
    modal.show();
    setTimeout(()=> carregarCidades(c.cidadeInteresse||""), 80);
  }

  function validateRequired(){
    const nome = up(el("candNome").value);
    const contato = up(el("candContato").value);
    let cargo = "";
    const ci = el("cargoInteresse");
    if (ci){
      cargo = up(ci.value);
    }
    const cidade = up(el("cidadeInteresse")?.value || "");
    if (!nome || !contato || !cargo || !cidade) return false;
    if (el("cidadeInteresse")?.disabled) return false;
    return true;
  }

  function save(){
    const form = el("candForm");
    if (form && !form.checkValidity()){
      form.classList.add("was-validated");
      return;
    }
    if (!validateRequired()){
      S().toast("PREENCHA OS CAMPOS OBRIGATÓRIOS.", "warning");
      return;
    }

    const ci = el("cargoInteresse");
    const cargo = up(ci?.value || "");
    const data = {
      id: editingId || S().nextEntityId("C"),
      nomeCompleto: up(el("candNome").value),
      contato: up(el("candContato").value),
      cargoInteresse: cargo,
      cidadeInteresse: up(el("cidadeInteresse").value),
      observacoes: up(el("candObs").value),
      ativo: true,
      dataCriacao: S().nowISO()
    };

    S().setData(db => {
      db.candidatos ||= [];
      const idx = db.candidatos.findIndex(x=>x.id===data.id);
      if (idx>=0) db.candidatos[idx] = { ...db.candidatos[idx], ...data };
      else db.candidatos.push(data);
    });

    modal.hide();
    S().toast("CANDIDATO SALVO.", "success");
    render();
  }

  function removeLogical(id){
    if (!S().confirmAction(`EXCLUIR CANDIDATO ${id}?`)) return;
    S().setData(db=>{
      const idx = db.candidatos.findIndex(x=>x.id===id);
      if (idx>=0) db.candidatos[idx].ativo = false;
    });
    S().toast("CANDIDATO EXCLUÍDO (LÓGICO).", "success");
    render();
  }

  function render(){
    const db = S().getData();
    const q = up(el("candSearch")?.value || "");
    const rows = (db.candidatos||[])
      .filter(c=>c.ativo!==false)
      .filter(c => !q || [c.id,c.nomeCompleto,c.contato,c.cargoInteresse,c.cidadeInteresse].some(x=> up(x).includes(q)));

    const tbody = el("candTbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    rows.forEach(c=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${c.id}</td>
        <td>${S().escapeHTML(up(c.nomeCompleto))}</td>
        <td>${S().escapeHTML(up(c.contato))}</td>
        <td>${S().escapeHTML(up(c.cargoInteresse))}</td>
        <td class="text-nowrap">
          <button class="btn btn-warning btn-sm" data-act="edit" data-id="${c.id}">ALTERAR</button>
          <button class="btn btn-danger btn-sm" data-act="del" data-id="${c.id}">EXCLUIR</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    el("candCount") && (el("candCount").textContent = `${rows.length} registro(s)`);
  }

  function exportCSV(){
    const db = S().getData();
    const rows = (db.candidatos||[]).filter(c=>c.ativo!==false).map(c => ({
      id: c.id,
      nomeCompleto: c.nomeCompleto,
      contato: c.contato,
      cargoInteresse: c.cargoInteresse,
      cidadeInteresse: c.cidadeInteresse,
      observacoes: c.observacoes
    }));
    const headers = ["id","nomeCompleto","contato","cargoInteresse","cidadeInteresse","observacoes"];
    S().downloadText("candidatos.csv", S().toCSV(rows, headers), "text/csv;charset=utf-8");
  }

  return { init, render, refreshCidadeOptions };
})();
