// js/auth.js
// Camada de autenticação via Supabase, mantendo compatibilidade com o App.Storage (rf_session_v1)
window.Auth = (function () {
  const LEGACY_SESSION_KEY = "rf_session_v1"; // usado pelo App.Storage
  const FALLBACK_SESSION_KEY = "rf_session";  // legado de versões antigas (não remove)

  function _requireClient(){
    if (!window.supabaseClient) throw new Error("supabaseClient não inicializado (js/supabaseClient.js).");
    return window.supabaseClient;
  }

  function _setLegacySession(payload){
    try{
      sessionStorage.setItem(LEGACY_SESSION_KEY, JSON.stringify(payload));
      sessionStorage.setItem(FALLBACK_SESSION_KEY, JSON.stringify(payload));
    }catch(e){
      console.warn("Não foi possível salvar sessão no sessionStorage:", e);
    }
  }

  function _clearLegacySession(){
    sessionStorage.removeItem(LEGACY_SESSION_KEY);
    sessionStorage.removeItem(FALLBACK_SESSION_KEY);
  }

  async function _getOrCreateProfile(user){
    // Busca perfil na tabela `perfis`. Se não existir, cria como USUARIO.
    const sb = _requireClient();
    const userId = user.id;

    const { data, error } = await sb
      .from("perfis")
      .select("perfil,nome,email")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      // erro real de consulta
      console.warn("Falha ao buscar perfil:", error);
      return { perfil: "USUARIO", nome: user.email, email: user.email };
    }

    if (data) return data;

    // não existe: cria
    const perfilPadrao = "USUARIO";
    const { data: created, error: insErr } = await sb
      .from("perfis")
      .insert([{ user_id: userId, nome: user.email, email: user.email, perfil: perfilPadrao }])
      .select("perfil,nome,email")
      .maybeSingle();

    if (insErr) {
      console.warn("Falha ao criar perfil padrão:", insErr);
      return { perfil: perfilPadrao, nome: user.email, email: user.email };
    }
    return created || { perfil: perfilPadrao, nome: user.email, email: user.email };
  }

  async function login(email, senha) {
    const sb = _requireClient();
    const { data, error } = await sb.auth.signInWithPassword({ email, password: senha });
    if (error) throw error;

    const user = data?.user;
    if (!user) throw new Error("Login sem usuário retornado.");

    const prof = await _getOrCreateProfile(user);
    const profile = String(prof?.perfil || "USUARIO").toUpperCase();

    _setLegacySession({
      username: user.email,
      profile,
      loginAt: new Date().toISOString(),
      userId: user.id,
      supabase: true
    });

    return user;
  }

  async function logout() {
    try {
      const sb = _requireClient();
      await sb.auth.signOut();
    } catch (e) {
      // ignora
    } finally {
      _clearLegacySession();
    }
  }

  async function getSession() {
    const sb = _requireClient();
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;
    return data?.session || null;
  }

  async function garantirLogado() {
    const sess = await getSession();
    if (!sess?.user) throw new Error("Sessão ausente");

    // Garante sessão compatível com App.Storage
    const legacy = sessionStorage.getItem(LEGACY_SESSION_KEY);
    if (!legacy) {
      const user = sess.user;
      const prof = await _getOrCreateProfile(user);
      const profile = String(prof?.perfil || "USUARIO").toUpperCase();
      _setLegacySession({
        username: user.email,
        profile,
        loginAt: new Date().toISOString(),
        userId: user.id,
        supabase: true
      });
    }
    return true;
  }

  return { login, logout, getSession, garantirLogado };
})();
