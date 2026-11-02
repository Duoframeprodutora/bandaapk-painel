import React, { useEffect, useState } from "react";
import { sb, erroLegivel } from "./supabase.js";
import { toast, quando } from "./util.js";

// Anotações da banda: gerais ou de um festival. Todo mundo da banda vê e escreve.
export default function Anotacoes({ perfil, festivalId }) {
  const [lista, setLista] = useState(null);
  const [fests, setFests] = useState([]);
  const [filtro, setFiltro] = useState(festivalId || "");
  const [texto, setTexto] = useState("");
  const [onde, setOnde] = useState(festivalId || "");

  async function carregar() {
    let q = sb.from("anotacoes").select("*, festivais(nome)").order("criado_em", { ascending: false }).limit(200);
    if (filtro) q = q.eq("festival_id", filtro);
    const { data } = await q; setLista(data || []);
  }
  useEffect(() => {
    if (!festivalId) sb.from("festivais").select("id,nome").order("criado_em", { ascending: false }).then(({ data }) => setFests(data || []));
  }, []);
  useEffect(() => {
    carregar();
    const ch = sb.channel("notas-" + (filtro || "todas")).on("postgres_changes", { event: "*", schema: "public", table: "anotacoes" }, carregar).subscribe();
    return () => { sb.removeChannel(ch); };
  }, [filtro]);

  async function salvar(e) {
    e.preventDefault();
    if (!texto.trim()) return;
    const { error } = await sb.from("anotacoes").insert({ texto: texto.trim(), festival_id: onde || null, autor_id: perfil.id, autor_nome: perfil.nome || "" });
    if (error) return toast(erroLegivel(error));
    setTexto(""); carregar();
  }
  async function apagar(n) {
    const { error } = await sb.from("anotacoes").delete().eq("id", n.id);
    if (error) toast(erroLegivel(error)); else carregar();
  }

  return (
    <section>
      {!festivalId && <div className="fest"><div className="eyebrow">Da banda, para a banda</div><h1>Anotações</h1>
        <p>O que aconteceu, o que combinar, o que não esquecer. Todo mundo da banda vê.</p></div>}
      <form className="card sharebox" onSubmit={salvar}>
        <label className="lbl" htmlFor="n-texto">Nova anotação</label>
        <textarea id="n-texto" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ex.: Retorno do palco estava baixo no ensaio. Pedir mais monitor para o técnico." />
        <div className="toolbar" style={{ margin: 0 }}>
          {!festivalId && <select value={onde} onChange={(e) => setOnde(e.target.value)} aria-label="Sobre qual evento" style={{ width: "auto", maxWidth: "100%" }}>
            <option value="">Geral (sem evento)</option>{fests.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>}
          <button className="primary">Salvar anotação</button>
        </div>
      </form>
      {!festivalId && fests.length > 0 && (
        <div className="toolbar"><span className="hint">Mostrar:</span>
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Filtrar anotações" style={{ width: "auto", maxWidth: "100%" }}>
            <option value="">Todas</option>{fests.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select></div>
      )}
      {lista === null ? <div className="loading">Carregando…</div> : !lista.length ? <div className="card empty">Nenhuma anotação ainda.</div> : (
        <ul className="fests">
          {lista.map((n) => (
            <li key={n.id} className="card nota">
              <div style={{ whiteSpace: "pre-wrap" }}>{n.texto}</div>
              <small>{n.autor_nome || "Alguém da banda"} · {quando(n.criado_em)}{!festivalId && n.festivais?.nome ? " · " + n.festivais.nome : ""}
                {(n.autor_id === perfil.id || perfil.papel === "master") && <> · <button className="ghost btn-sm danger" style={{ padding: "2px 8px" }} onClick={() => apagar(n)}>Apagar</button></>}</small>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
