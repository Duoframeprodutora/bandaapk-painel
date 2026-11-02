import React, { useEffect, useState } from "react";
import { sb, erroLegivel } from "./supabase.js";
import { toast } from "./util.js";

// Músicos e equipe técnica. Usada na divisão de quartos e como lista de contatos da banda.
export default function Equipe({ perfil }) {
  const master = perfil.papel === "master";
  const [lista, setLista] = useState(null);
  const [n, setN] = useState({ nome: "", funcao: "", telefone: "", tecnica: false });
  const carregar = () => sb.from("equipe").select("*").order("ordem").then(({ data }) => setLista(data || []));
  useEffect(() => { carregar(); }, []);

  async function add(e) {
    e.preventDefault();
    if (!n.nome.trim()) return toast("Escreva o nome.");
    const { error } = await sb.from("equipe").insert({ ...n, ordem: (lista?.length || 0) + 1 });
    if (error) toast(erroLegivel(error)); else { setN({ nome: "", funcao: "", telefone: "", tecnica: false }); carregar(); toast("Pessoa adicionada"); }
  }
  async function alterar(p, campo, v) {
    setLista(lista.map((x) => x.id === p.id ? { ...x, [campo]: v } : x));
    const { error } = await sb.from("equipe").update({ [campo]: v }).eq("id", p.id);
    if (error) toast(erroLegivel(error));
  }

  const Grupo = ({ titulo, itens }) => (
    <>
      <h2 className="mes">{titulo}</h2>
      <ul className="users">
        {itens.map((p) => (
          <li key={p.id} className="card" style={{ opacity: p.ativo ? 1 : .55 }}>
            {master ? (
              <div className="toolbar" style={{ margin: 0, flex: 1 }}>
                <input type="text" value={p.nome} onChange={(e) => alterar(p, "nome", e.target.value)} aria-label="Nome" style={{ maxWidth: 150 }} />
                <input type="text" value={p.funcao} onChange={(e) => alterar(p, "funcao", e.target.value)} aria-label="Função" style={{ maxWidth: 180 }} />
                <input type="tel" value={p.telefone} onChange={(e) => alterar(p, "telefone", e.target.value)} aria-label="Telefone" placeholder="Telefone" style={{ maxWidth: 160 }} />
                <label className="hint"><input type="checkbox" checked={p.tecnica} onChange={(e) => alterar(p, "tecnica", e.target.checked)} /> Equipe técnica</label>
                <label className="hint"><input type="checkbox" checked={p.ativo} onChange={(e) => alterar(p, "ativo", e.target.checked)} /> Ativo</label>
              </div>
            ) : (
              <div className="info"><b>{p.nome}</b> <span className="hint">· {p.funcao}</span>
                {p.telefone && <><br /><a href={"https://wa.me/55" + p.telefone.replace(/\D/g, "").replace(/^55/, "")} target="_blank" rel="noopener">{p.telefone}</a></>}</div>
            )}
          </li>
        ))}
      </ul>
    </>
  );

  if (lista === null) return <div className="loading">Carregando…</div>;
  return (
    <section>
      <div className="fest"><div className="eyebrow">Quem faz a banda</div><h1>Equipe</h1>
        <p>Músicos e equipe técnica. Essa lista é usada na divisão de quartos. Quem estiver como "não ativo" sai dos quartos.</p></div>
      <Grupo titulo="Músicos" itens={lista.filter((p) => !p.tecnica)} />
      <Grupo titulo="Equipe técnica" itens={lista.filter((p) => p.tecnica)} />
      {master && (
        <form className="card sharebox" onSubmit={add} style={{ marginTop: 14 }}>
          <b>Adicionar pessoa</b>
          <div className="row2">
            <div className="field"><label htmlFor="q-nome">Nome</label><input type="text" id="q-nome" value={n.nome} onChange={(e) => setN({ ...n, nome: e.target.value })} /></div>
            <div className="field"><label htmlFor="q-func">Função</label><input type="text" id="q-func" value={n.funcao} onChange={(e) => setN({ ...n, funcao: e.target.value })} placeholder="Ex.: teclado" /></div>
          </div>
          <div className="row2">
            <div className="field"><label htmlFor="q-tel">Telefone</label><input type="tel" id="q-tel" value={n.telefone} onChange={(e) => setN({ ...n, telefone: e.target.value })} /></div>
            <label className="hint" style={{ alignSelf: "end", paddingBottom: 12 }}><input type="checkbox" checked={n.tecnica} onChange={(e) => setN({ ...n, tecnica: e.target.checked })} /> Equipe técnica</label>
          </div>
          <div className="toolbar" style={{ margin: 0 }}><button className="primary">Adicionar</button></div>
        </form>
      )}
    </section>
  );
}
