import React, { useEffect, useState } from "react";
import { sb, ehFormulario, erroLegivel } from "./supabase.js";
import { usePath, ir, quando } from "./util.js";
import Inscricao from "./Inscricao.jsx";
import Festivais from "./Festivais.jsx";
import Festival from "./Festival.jsx";
import Usuarios from "./Usuarios.jsx";

const NOME_PAPEL = { master: "Master", vendas: "Vendas", musico: "Músico" };

export default function App() {
  if (ehFormulario()) return <Inscricao />;
  return <Painel />;
}

function Painel() {
  const [sessao, setSessao] = useState(undefined);
  const [perfil, setPerfil] = useState(undefined);
  const [recuperar, setRecuperar] = useState(false);

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSessao(data.session));
    const { data } = sb.auth.onAuthStateChange((ev, s) => { if (ev === "PASSWORD_RECOVERY") setRecuperar(true); setSessao(s); });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sessao) { setPerfil(sessao === null ? null : undefined); return; }
    sb.from("perfis").select("*").eq("id", sessao.user.id).single()
      .then(({ data }) => setPerfil(data || { papel: null, nome: "" }));
  }, [sessao]);

  if (sessao === undefined || (sessao && perfil === undefined)) return <div className="loading">Carregando…</div>;
  if (!sessao) return <Login />;
  if (recuperar) return <div className="wrap center"><NovaSenha onPronto={() => setRecuperar(false)} /></div>;
  if (!perfil.papel) return (
    <div className="wrap center"><div className="card login">
      <h1>Aguardando liberação</h1>
      <p>Seu login foi criado, mas o Master ainda precisa liberar o seu acesso.</p>
      <button className="ghost" onClick={() => sb.auth.signOut()}>Sair</button>
    </div></div>
  );
  return <Shell perfil={perfil} />;
}

function Shell({ perfil }) {
  const path = usePath();
  const master = perfil.papel === "master";
  const rota = path.split("?")[0];
  let tela;
  if (rota.startsWith("/f/")) tela = <Festival id={rota.split("/")[2]} aba={rota.split("/")[3] || "inscricoes"} perfil={perfil} />;
  else if (rota === "/usuarios" && master) tela = <Usuarios perfil={perfil} />;
  else tela = <Festivais perfil={perfil} />;

  return (
    <>
      <header className="top">
        <div className="wrap">
          <a className="brand" href="/" onClick={(e) => { e.preventDefault(); ir("/"); }} style={{ textDecoration: "none", color: "inherit" }}>
            Banda <span>APK</span>
          </a>
          <nav className="tabs" aria-label="Seções">
            <button aria-current={!rota.startsWith("/usuarios") ? "page" : undefined} onClick={() => ir("/")}>Festivais</button>
            {master && <button aria-current={rota.startsWith("/usuarios") ? "page" : undefined} onClick={() => ir("/usuarios")}>Usuários</button>}
          </nav>
          {master && <Sino />}
          <div className="userbox">
            <span>{perfil.nome || "Você"} · {NOME_PAPEL[perfil.papel]}</span>
            <button className="ghost btn-sm" onClick={() => sb.auth.signOut()}>Sair</button>
          </div>
        </div>
      </header>
      <main className="wrap">{tela}</main>
    </>
  );
}

function Sino() {
  const [lista, setLista] = useState([]);
  const [aberto, setAberto] = useState(false);
  const carregar = () => sb.from("notificacoes").select("*").order("criado_em", { ascending: false }).limit(40).then(({ data }) => setLista(data || []));
  useEffect(() => {
    carregar();
    const ch = sb.channel("notifs").on("postgres_changes", { event: "INSERT", schema: "public", table: "notificacoes" }, carregar).subscribe();
    return () => { sb.removeChannel(ch); };
  }, []);
  const novas = lista.filter((n) => !n.lida).length;
  async function abrir() {
    setAberto(!aberto);
    if (!aberto && novas) {
      await sb.from("notificacoes").update({ lida: true }).eq("lida", false);
      setTimeout(carregar, 4000);
    }
  }
  return (
    <>
      <button className="bell" onClick={abrir} aria-label={novas ? novas + " avisos novos" : "Avisos"} aria-expanded={aberto}>
        🔔{novas > 0 && <span className="dot">{novas}</span>}
      </button>
      {aberto && (
        <div className="card notifs" role="dialog" aria-label="Avisos">
          {lista.length === 0 && <div className="hint">Nenhum aviso ainda. Quando chegar inscrição nova, ela aparece aqui.</div>}
          {lista.map((n) => (
            <div key={n.id} className={"notif" + (n.lida ? "" : " nova")}
              onClick={() => { if (n.festival_id) { setAberto(false); ir("/f/" + n.festival_id); } }} style={{ cursor: n.festival_id ? "pointer" : "default" }}>
              {n.texto}<small>{quando(n.criado_em)}</small>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [primeiro, setPrimeiro] = useState(false);
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { sb.rpc("existe_master").then(({ data }) => setPrimeiro(data === false)); }, []);

  async function entrar(e) {
    e.preventDefault(); setMsg(""); setBusy(true);
    if (primeiro) {
      if (!nome.trim() || senha.length < 6) { setMsg("Preencha seu nome e uma senha com pelo menos 6 caracteres."); setBusy(false); return; }
      const { data, error } = await sb.auth.signUp({ email, password: senha, options: { data: { nome: nome.trim() }, emailRedirectTo: location.origin } });
      setBusy(false);
      if (error) return setMsg(erroLegivel(error));
      if (!data.session) setOk("Conta Master criada. Abra o e-mail que chegou em " + email + " e toque no link de confirmação. Depois é só entrar aqui.");
      return;
    }
    const { error } = await sb.auth.signInWithPassword({ email, password: senha });
    setBusy(false);
    if (error) setMsg(erroLegivel(error));
  }

  async function esqueci() {
    if (!email) return setMsg("Escreva seu e-mail acima e toque de novo em Esqueci a senha.");
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + "/?nova-senha=1" });
    if (error) setMsg(erroLegivel(error)); else setOk("Enviamos um link para " + email + " para você criar uma senha nova.");
  }

  return (
    <div className="wrap center">
      <form className="card login" onSubmit={entrar}>
        <div className="brand" style={{ fontSize: 28 }}>Banda <span>APK</span></div>
        <h1>{primeiro ? "Primeiro acesso" : "Entrar no painel"}</h1>
        {primeiro && <p className="hint">Ainda não existe nenhum Master. Crie aqui a conta principal da banda. Os outros logins você cria depois, dentro do painel.</p>}
        {primeiro && <div className="field"><label htmlFor="l-nome">Seu nome</label><input type="text" id="l-nome" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" /></div>}
        <div className="field"><label htmlFor="l-email">E-mail</label><input type="email" id="l-email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></div>
        <div className="field"><label htmlFor="l-senha">Senha</label><input type="password" id="l-senha" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete={primeiro ? "new-password" : "current-password"} required /></div>
        {msg && <div className="err">{msg}</div>}
        {ok && <div className="obs" style={{ background: "var(--ok-soft)", color: "var(--ok)" }}>{ok}</div>}
        <button className="primary" disabled={busy}>{busy ? "Aguarde…" : primeiro ? "Criar conta Master" : "Entrar"}</button>
        {!primeiro && <button type="button" className="ghost" onClick={esqueci}>Esqueci a senha</button>}
      </form>
    </div>
  );
}

// Quando a pessoa chega pelo link de "esqueci a senha"
function NovaSenha({ onPronto }) {
  const [senha, setSenha] = useState("");
  const [msg, setMsg] = useState("");
  return (
    <form className="card login" onSubmit={async (e) => {
      e.preventDefault();
      if (senha.length < 6) return setMsg("A senha precisa ter pelo menos 6 caracteres.");
      const { error } = await sb.auth.updateUser({ password: senha });
      if (error) setMsg(erroLegivel(error)); else onPronto();
    }}>
      <h1>Criar senha nova</h1>
      <div className="field"><label htmlFor="ns">Senha nova</label><input type="password" id="ns" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" /></div>
      {msg && <div className="err">{msg}</div>}
      <button className="primary">Salvar senha e entrar</button>
    </form>
  );
}
