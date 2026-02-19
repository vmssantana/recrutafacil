// js/db.js
window.DB = (function () {
  // CHAVE DE CONTROLE: se false, usa LocalStorage; se true, usa Supabase
  const USE_SUPABASE = true;

  // Helpers LocalStorage
  function lsGet(key) {
    return JSON.parse(localStorage.getItem(key) || "[]");
  }
  function lsSet(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  // Helpers Supabase
  async function sbSelect(table) {
    const { data, error } = await window.supabaseClient.from(table).select("*");
    if (error) throw error;
    return data || [];
  }
  async function sbUpsert(table, row, conflictKey = "codigo") {
    const { data, error } = await window.supabaseClient
      .from(table)
      .upsert(row, { onConflict: conflictKey })
      .select();
    if (error) throw error;
    return data;
  }
  async function sbDelete(table, codigo) {
    const { error } = await window.supabaseClient.from(table).delete().eq("codigo", codigo);
    if (error) throw error;
  }

  // API por módulo — 100% Supabase (ou LocalStorage se desligar a chave)
  return {
    USE_SUPABASE,

    // POSTOS
    async getPostos() {
      return USE_SUPABASE ? sbSelect("postos") : lsGet("postos");
    },
    async savePosto(posto) {
      if (USE_SUPABASE) return sbUpsert("postos", posto, "codigo");
      const arr = lsGet("postos");
      const i = arr.findIndex(x => x.codigo === posto.codigo);
      if (i >= 0) arr[i] = posto; else arr.push(posto);
      lsSet("postos", arr);
    },
    async deletePosto(codigo) {
      if (USE_SUPABASE) return sbDelete("postos", codigo);
      lsSet("postos", lsGet("postos").filter(x => x.codigo !== codigo));
    },

    // VAGAS
    async getVagas() {
      return USE_SUPABASE ? sbSelect("vagas") : lsGet("vagas");
    },
    async saveVaga(vaga) {
      if (USE_SUPABASE) return sbUpsert("vagas", vaga, "codigo");
      const arr = lsGet("vagas");
      const i = arr.findIndex(x => x.codigo === vaga.codigo);
      if (i >= 0) arr[i] = vaga; else arr.push(vaga);
      lsSet("vagas", arr);
    },
    async deleteVaga(codigo) {
      if (USE_SUPABASE) return sbDelete("vagas", codigo);
      lsSet("vagas", lsGet("vagas").filter(x => x.codigo !== codigo));
    },

    // CANDIDATOS
    async getCandidatos() {
      return USE_SUPABASE ? sbSelect("candidatos") : lsGet("candidatos");
    },
    async saveCandidato(c) {
      if (USE_SUPABASE) return sbUpsert("candidatos", c, "codigo");
      const arr = lsGet("candidatos");
      const i = arr.findIndex(x => x.codigo === c.codigo);
      if (i >= 0) arr[i] = c; else arr.push(c);
      lsSet("candidatos", arr);
    },
    async deleteCandidato(codigo) {
      if (USE_SUPABASE) return sbDelete("candidatos", codigo);
      lsSet("candidatos", lsGet("candidatos").filter(x => x.codigo !== codigo));
    },

    // PROCESSO SELETIVO
    async getProcessos() {
      return USE_SUPABASE ? sbSelect("processos_seletivos") : lsGet("processos");
    },
    async saveProcesso(p) {
      // Atenção: tabela no Supabase = processos_seletivos
      if (USE_SUPABASE) return sbUpsert("processos_seletivos", p, "id");
      const arr = lsGet("processos");
      const i = arr.findIndex(x => x.id === p.id);
      if (i >= 0) arr[i] = p; else arr.push(p);
      lsSet("processos", arr);
    },

    // PRÉ-ADMISSÃO
    async getPreAdmissao() {
      return USE_SUPABASE ? sbSelect("pre_admissao") : lsGet("preAdmissoes");
    },
    async savePreAdmissao(pa) {
      if (USE_SUPABASE) return sbUpsert("pre_admissao", pa, "id");
      const arr = lsGet("preAdmissoes");
      const i = arr.findIndex(x => x.id === pa.id);
      if (i >= 0) arr[i] = pa; else arr.push(pa);
      lsSet("preAdmissoes", arr);
    },
  };
})();
