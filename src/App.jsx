import React, { useEffect, useState } from "react";
import { sb, ehFormulario, erroLegivel } from "./supabase.js";
import { usePath, ir, quando } from "./util.js";
import Inscricao from "./Inscricao.jsx";
import Festivais from "./Festivais.jsx";
import Festival from "./Festival.jsx";
import Usuarios from "./Usuarios.jsx";
import Musicas from "./Musicas.jsx";
import Agenda from "./Agenda.jsx";
import Anotacoes from "./Anotacoes.jsx";
import Equipe from "./Equipe.jsx";
import Financeiro from "./Financeiro.jsx";
import { periodo } from "./Festivais.jsx";

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

// Menu do topo. "so" limita a seção a certos perfis.
const MENU = [
  { rota: "/", nome: "Festivais" },
  { rota: "/musicas", nome: "Músicas" },
  { rota: "/palco", nome: "Palco" },
  { rota: "/hotel", nome: "Hotel" },
  { rota: "/agenda", nome: "Agenda" },
  { rota: "/anotacoes", nome: "Anotações" },
  { rota: "/equipe", nome: "Equipe" },
  { rota: "/financeiro", nome: "Financeiro", so: ["master"] },
  { rota: "/usuarios", nome: "Usuários", so: ["master"] },
];

function Shell({ perfil }) {
  const path = usePath();
  const master = perfil.papel === "master";
  const rota = path.split("?")[0];
  const menu = MENU.filter((m) => !m.so || m.so.includes(perfil.papel));
  const ativo = rota.startsWith("/f/") ? "/" : (menu.find((m) => m.rota !== "/" && rota.startsWith(m.rota))?.rota || "/");

  let tela;
  if (rota.startsWith("/f/")) tela = <Festival id={rota.split("/")[2]} aba={rota.split("/")[3] || "inscricoes"} perfil={perfil} />;
  else if (ativo === "/musicas") tela = <Musicas perfil={perfil} />;
  else if (ativo === "/palco") tela = <EscolherEvento aba="palco" perfil={perfil} />;
  else if (ativo === "/hotel") tela = <EscolherEvento aba="hotel" perfil={perfil} />;
  else if (ativo === "/agenda") tela = <Agenda perfil={perfil} />;
  else if (ativo === "/anotacoes") tela = <Anotacoes perfil={perfil} />;
  else if (ativo === "/equipe") tela = <Equipe perfil={perfil} />;
  else if (ativo === "/financeiro" && master) tela = <Financeiro perfil={perfil} />;
  else if (ativo === "/usuarios" && master) tela = <Usuarios perfil={perfil} />;
  else if (perfil.papel === "musico") tela = <Musicas perfil={perfil} />;
  else tela = <Festivais perfil={perfil} />;

  return (
    <>
      <header className="top">
        <div className="wrap">
          <a className="brand" href="/" onClick={(e) => { e.preventDefault(); ir("/"); }} style={{ textDecoration: "none", color: "inherit" }}>
            Banda <span>APK</span>
          </a>
          {master && <Sino />}
          <div className="userbox">
            <span>{perfil.nome || "Você"} · {NOME_PAPEL[perfil.papel]}</span>
            <button className="ghost btn-sm" onClick={() => sb.auth.signOut()}>Sair</button>
          </div>
          <nav className="tabs" aria-label="Seções">
            {menu.map((m) => (
              <button key={m.rota} aria-current={ativo === m.rota ? "page" : undefined} onClick={() => ir(m.rota)}>{m.nome}</button>
            ))}
          </nav>
        </div>
      </header>
      <main className="wrap">{tela}</main>
    </>
  );
}

// Palco e Hotel no menu: escolhe o evento (abre o próximo por padrão) e mostra a aba dele
function EscolherEvento({ aba, perfil }) {
  const [lista, setLista] = useState(null);
  const [sel, setSel] = useState(() => { try { return localStorage.getItem("evento-sel") || ""; } catch { return ""; } });
  useEffect(() => {
    sb.from("festivais").select("id,nome,tipo,data_inicio,data_fim,cidade_datas").order("data_inicio", { ascending: true, nullsFirst: false })
      .then(({ data }) => setLista(data || []));
  }, []);
  if (lista === null) return <div className="loading">Carregando…</div>;
  if (!lista.length) return <div className="card empty">Nenhum festival ou show cadastrado ainda.</div>;
  const hoje = new Date().toISOString().slice(0, 10);
  const proximo = lista.find((f) => f.data_inicio && (f.data_fim || f.data_inicio) >= hoje) || lista.find((f) => !f.data_inicio) || lista[lista.length - 1];
  const atual = lista.find((f) => f.id === sel) || proximo;
  function trocar(id) { setSel(id); try { localStorage.setItem("evento-sel", id); } catch {} }
  return (
    <>
      <div className="toolbar" style={{ marginBottom: 0 }}>
        <label className="hint" htmlFor="ev-sel">Evento:</label>
        <select id="ev-sel" value={atual.id} onChange={(e) => trocar(e.target.value)} style={{ width: "auto", maxWidth: "100%" }}>
          {lista.map((f) => <option key={f.id} value={f.id}>{f.nome} · {periodo(f)}</option>)}
        </select>
      </div>
      <Festival key={atual.id} id={atual.id} aba={aba} perfil={perfil} />
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
