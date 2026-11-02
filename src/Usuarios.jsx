import React, { useEffect, useState } from "react";
import { sb, erroLegivel } from "./supabase.js";
import { toast } from "./util.js";

const PAPEIS = [["master", "Master"], ["vendas", "Vendas"], ["musico", "Músico"]];

async function chamar(body) {
  const { data, error } = await sb.functions.invoke("usuarios", { body });
  if (error) {
    let msg = error.message;
    try { const j = await error.context.json(); msg = j.erro || msg; } catch {}
    throw new Error(msg);
  }
  if (data?.erro) throw new Error(data.erro);
  return data;
}

export default function Usuarios({ perfil }) {
  const [perfis, setPerfis] = useState(null);
  const [emails, setEmails] = useState({});
  const [novo, setNovo] = useState({ nome: "", email: "", senha: "", papel: "musico", funcao: "" });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [senhaDe, setSenhaDe] = useState(null);
  const [senhaNova, setSenhaNova] = useState("");
  const [remover, setRemover] = useState(null);

  async function carregar() {
    const { data } = await sb.from("perfis").select("*").order("criado_em");
    setPerfis(data || []);
    chamar({ acao: "listar" }).then((r) => setEmails(r.emails || {})).catch(() => {});
  }
  useEffect(() => { carregar(); }, []);

  async function criar(e) {
    e.preventDefault(); setMsg(""); setBusy(true);
    try { await chamar({ acao: "criar", ...novo }); toast("Login criado"); setNovo({ nome: "", email: "", senha: "", papel: "musico", funcao: "" }); carregar(); }
    catch (err) { setMsg(erroLegivel(err)); }
    setBusy(false);
  }
  async function mudarPapel(p, papel) {
    if (p.id === perfil.id && papel !== "master") return toast("Você não pode tirar o seu próprio acesso de Master.");
    const { error } = await sb.from("perfis").update({ papel: papel || null }).eq("id", p.id);
    if (error) toast(erroLegivel(error)); else { toast("Perfil atualizado"); carregar(); }
  }
  async function trocarSenha(e) {
    e.preventDefault();
    try { await chamar({ acao: "senha", id: senhaDe.id, senha: senhaNova }); toast("Senha trocada"); setSenhaDe(null); setSenhaNova(""); }
    catch (err) { toast(erroLegivel(err)); }
  }
  async function removerLogin(p) {
    try { await chamar({ acao: "remover", id: p.id }); toast("Login removido"); setRemover(null); carregar(); }
    catch (err) { toast(erroLegivel(err)); }
  }
  const set = (k) => (e) => setNovo({ ...novo, [k]: e.target.value });

  return (
    <section>
      <div className="fest"><div className="eyebrow">Só o Master vê esta tela</div><h1>Usuários e equipe</h1></div>

      <form className="card sharebox" onSubmit={criar}>
        <b>Criar login</b>
        <span className="hint">Passe o e-mail e a senha para a pessoa. Ela pode trocar a senha depois pelo "Esqueci a senha".</span>
        <div className="row2">
          <div className="field"><label htmlFor="u-nome">Nome</label><input type="text" id="u-nome" value={novo.nome} onChange={set("nome")} /></div>
          <div className="field"><label htmlFor="u-funcao">Função</label><input type="text" id="u-funcao" value={novo.funcao} onChange={set("funcao")} placeholder="Ex.: bateria" /></div>
        </div>
        <div className="row2">
          <div className="field"><label htmlFor="u-email">E-mail</label><input type="email" id="u-email" value={novo.email} onChange={set("email")} autoComplete="off" /></div>
          <div className="field"><label htmlFor="u-senha">Senha inicial</label><input type="text" id="u-senha" value={novo.senha} onChange={set("senha")} autoComplete="off" placeholder="Pelo menos 6 caracteres" /></div>
        </div>
        <div className="field"><span className="lbl" id="u-papel">Perfil</span>
          <div className="seg" role="group" aria-labelledby="u-papel">
            {PAPEIS.map(([v, n]) => <button type="button" key={v} aria-pressed={novo.papel === v} onClick={() => setNovo({ ...novo, papel: v })}>{n}</button>)}
          </div>
          <span className="hint">Master vê tudo. Vendas cuida dos festivais e da hospedagem. Músico vê as músicas, o palco e o hotel.</span>
        </div>
        {msg && <div className="err">{msg}</div>}
        <div className="toolbar" style={{ margin: 0 }}><button className="primary" disabled={busy}>{busy ? "Criando…" : "Criar login"}</button></div>
      </form>

      <h2 style={{ fontSize: 22, margin: "18px 0 10px" }}>Logins</h2>
      {perfis === null ? <div className="loading">Carregando…</div> : (
        <ul className="users">
          {perfis.map((p) => (
            <li key={p.id} className="card">
              <div className="info"><b>{p.nome || "Sem nome"}</b>{p.funcao && <span className="hint"> · {p.funcao}</span>}<br /><span className="hint">{emails[p.id] || ""}</span>
                {!p.papel && <><br /><span className="pill off">Aguardando liberação</span></>}</div>
              <div className="toolbar" style={{ margin: 0 }}>
                <select value={p.papel || ""} onChange={(e) => mudarPapel(p, e.target.value)} aria-label={"Perfil de " + p.nome} style={{ width: "auto" }}>
                  <option value="">Sem acesso</option>{PAPEIS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
                </select>
                <button className="ghost btn-sm" onClick={() => { setSenhaDe(p); setSenhaNova(""); }}>Trocar senha</button>
                {p.id !== perfil.id && (remover === p.id
                  ? <><button className="primary btn-sm" onClick={() => removerLogin(p)}>Confirmar</button><button className="ghost btn-sm" onClick={() => setRemover(null)}>Cancelar</button></>
                  : <button className="ghost btn-sm danger" onClick={() => setRemover(p.id)}>Remover</button>)}
              </div>
              {senhaDe?.id === p.id && (
                <form onSubmit={trocarSenha} className="toolbar" style={{ margin: 0, width: "100%" }}>
                  <input type="text" value={senhaNova} onChange={(e) => setSenhaNova(e.target.value)} placeholder="Senha nova" aria-label="Senha nova" style={{ maxWidth: 220 }} />
                  <button className="primary btn-sm">Salvar</button><button type="button" className="ghost btn-sm" onClick={() => setSenhaDe(null)}>Cancelar</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
      <Equipe />
    </section>
  );
}

// Lista de pessoas que viajam (para a divisão de quartos). Não precisam de login.
function Equipe() {
  const [lista, setLista] = useState([]);
  const [n, setN] = useState({ nome: "", funcao: "", tecnica: false });
  const carregar = () => sb.from("equipe").select("*").order("ordem").then(({ data }) => setLista(data || []));
  useEffect(() => { carregar(); }, []);
  async function add(e) {
    e.preventDefault();
    if (!n.nome.trim()) return;
    const { error } = await sb.from("equipe").insert({ ...n, ordem: lista.length + 1 });
    if (error) toast(erroLegivel(error)); else { setN({ nome: "", funcao: "", tecnica: false }); carregar(); }
  }
  async function alterar(p, campo, v) {
    setLista(lista.map((x) => x.id === p.id ? { ...x, [campo]: v } : x));
    await sb.from("equipe").update({ [campo]: v }).eq("id", p.id);
  }
  return (
    <>
      <h2 style={{ fontSize: 22, margin: "22px 0 6px" }}>Equipe que viaja</h2>
      <p className="hint" style={{ marginTop: 0 }}>Usada na divisão de quartos. Marque quem é da equipe técnica (vai antes para montar a estrutura).</p>
      <ul className="users">
        {lista.map((p) => (
          <li key={p.id} className="card" style={{ opacity: p.ativo ? 1 : .55 }}>
            <div className="toolbar" style={{ margin: 0, flex: 1 }}>
              <input type="text" value={p.nome} onChange={(e) => alterar(p, "nome", e.target.value)} aria-label="Nome" style={{ maxWidth: 160 }} />
              <input type="text" value={p.funcao} onChange={(e) => alterar(p, "funcao", e.target.value)} aria-label="Função" style={{ maxWidth: 200 }} />
              <label className="hint"><input type="checkbox" checked={p.tecnica} onChange={(e) => alterar(p, "tecnica", e.target.checked)} /> Equipe técnica</label>
              <label className="hint"><input type="checkbox" checked={p.ativo} onChange={(e) => alterar(p, "ativo", e.target.checked)} /> Ativo</label>
            </div>
          </li>
        ))}
      </ul>
      <form className="toolbar" onSubmit={add}>
        <input type="text" placeholder="Nome" value={n.nome} onChange={(e) => setN({ ...n, nome: e.target.value })} aria-label="Nome" style={{ maxWidth: 160 }} />
        <input type="text" placeholder="Função" value={n.funcao} onChange={(e) => setN({ ...n, funcao: e.target.value })} aria-label="Função" style={{ maxWidth: 200 }} />
        <label className="hint"><input type="checkbox" checked={n.tecnica} onChange={(e) => setN({ ...n, tecnica: e.target.checked })} /> Equipe técnica</label>
        <button className="ghost">Adicionar pessoa</button>
      </form>
    </>
  );
}
