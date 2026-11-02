import React, { useEffect, useMemo, useState } from "react";
import { sb, erroLegivel } from "./supabase.js";
import { toast } from "./util.js";

const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const CATS_ENT = ["Cachê", "Sinal", "Outros"];
const CATS_SAI = ["Hotel", "Transporte", "Combustível", "Alimentação", "Pagamento músico", "Pagamento técnico", "Equipamento", "Outros"];

// Financeiro geral da banda. Só o Master acessa (regra no banco).
export default function Financeiro() {
  const [lista, setLista] = useState(null);
  const [fests, setFests] = useState([]);
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));
  const [fFest, setFFest] = useState("");
  const vazio = { tipo: "entrada", descricao: "", categoria: "Cachê", valor: "", data: new Date().toISOString().slice(0, 10), festival_id: "", pago: false };
  const [n, setN] = useState(vazio);
  const [apagar, setApagar] = useState(null);

  const carregar = () => sb.from("lancamentos").select("*").order("data", { ascending: false }).then(({ data }) => setLista(data || []));
  useEffect(() => {
    carregar();
    sb.from("festivais").select("id,nome").order("criado_em", { ascending: false }).then(({ data }) => setFests(data || []));
  }, []);

  const nomeFest = Object.fromEntries(fests.map((f) => [f.id, f.nome]));
  const meses = useMemo(() => [...new Set([new Date().toISOString().slice(0, 7), ...(lista || []).map((l) => l.data.slice(0, 7))])].sort().reverse(), [lista]);
  const vis = (lista || []).filter((l) => (!mes || l.data.startsWith(mes)) && (!fFest || l.festival_id === fFest));
  const soma = (arr, t) => arr.filter((l) => l.tipo === t).reduce((s, l) => s + Number(l.valor), 0);
  const ent = soma(vis, "entrada"), sai = soma(vis, "saida");
  const aReceber = vis.filter((l) => l.tipo === "entrada" && !l.pago).reduce((s, l) => s + Number(l.valor), 0);
  const aPagar = vis.filter((l) => l.tipo === "saida" && !l.pago).reduce((s, l) => s + Number(l.valor), 0);

  const porFest = {};
  (lista || []).filter((l) => l.festival_id).forEach((l) => {
    const p = (porFest[l.festival_id] = porFest[l.festival_id] || { e: 0, s: 0 });
    l.tipo === "entrada" ? (p.e += Number(l.valor)) : (p.s += Number(l.valor));
  });

  async function salvar(e) {
    e.preventDefault();
    const valor = Number(String(n.valor).replace(/\./g, "").replace(",", "."));
    if (!n.descricao.trim() || !(valor > 0)) return toast("Preencha a descrição e o valor.");
    const { error } = await sb.from("lancamentos").insert({ ...n, valor, festival_id: n.festival_id || null });
    if (error) return toast(erroLegivel(error));
    toast("Lançamento salvo"); setN({ ...vazio, tipo: n.tipo, categoria: n.tipo === "entrada" ? "Cachê" : "Hotel" }); carregar();
  }
  async function alternarPago(l) { await sb.from("lancamentos").update({ pago: !l.pago }).eq("id", l.id); carregar(); }
  async function remover(l) { await sb.from("lancamentos").delete().eq("id", l.id); setApagar(null); carregar(); }
  const nomeMes = (m) => new Date(m + "-15T12:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <section>
      <div className="fest"><div className="eyebrow">Só o Master vê esta tela</div><h1>Financeiro</h1></div>
      <div className="toolbar" style={{ marginTop: 0 }}>
        <select value={mes} onChange={(e) => setMes(e.target.value)} aria-label="Mês" style={{ width: "auto" }}>
          <option value="">Todos os meses</option>{meses.map((m) => <option key={m} value={m}>{nomeMes(m)}</option>)}
        </select>
        <select value={fFest} onChange={(e) => setFFest(e.target.value)} aria-label="Evento" style={{ width: "auto", maxWidth: "100%" }}>
          <option value="">Todos os eventos</option>{fests.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </select>
      </div>
      <div className="cards">
        <div className="card kpi in"><span className="hint">Entradas</span><b>{brl(ent)}</b></div>
        <div className="card kpi out"><span className="hint">Saídas</span><b>{brl(sai)}</b></div>
        <div className="card kpi"><span className="hint">Saldo</span><b>{brl(ent - sai)}</b></div>
        <div className="card kpi"><span className="hint">A receber · a pagar</span><b style={{ fontSize: 18 }}>{brl(aReceber)} · {brl(aPagar)}</b></div>
      </div>

      <form className="card sharebox" onSubmit={salvar}>
        <b>Novo lançamento</b>
        <div className="seg" role="group" aria-label="Tipo">
          <button type="button" aria-pressed={n.tipo === "entrada"} onClick={() => setN({ ...n, tipo: "entrada", categoria: "Cachê" })}>Entrada</button>
          <button type="button" aria-pressed={n.tipo === "saida"} onClick={() => setN({ ...n, tipo: "saida", categoria: "Hotel" })}>Saída</button>
        </div>
        <div className="row2">
          <div className="field"><label htmlFor="l-desc">Descrição</label><input type="text" id="l-desc" value={n.descricao} onChange={(e) => setN({ ...n, descricao: e.target.value })} placeholder={n.tipo === "entrada" ? "Ex.: Cachê Festival de Passo Fundo" : "Ex.: Hotel 3 diárias"} /></div>
          <div className="field"><label htmlFor="l-valor">Valor (R$)</label><input type="text" id="l-valor" inputMode="decimal" value={n.valor} onChange={(e) => setN({ ...n, valor: e.target.value })} placeholder="0,00" /></div>
        </div>
        <div className="row2">
          <div className="field"><label htmlFor="l-cat">Categoria</label><select id="l-cat" value={n.categoria} onChange={(e) => setN({ ...n, categoria: e.target.value })}>
            {(n.tipo === "entrada" ? CATS_ENT : CATS_SAI).map((c) => <option key={c}>{c}</option>)}</select></div>
          <div className="field"><label htmlFor="l-data">Data</label><input type="date" id="l-data" value={n.data} onChange={(e) => setN({ ...n, data: e.target.value })} /></div>
        </div>
        <div className="row2">
          <div className="field"><label htmlFor="l-fest">Evento (opcional)</label><select id="l-fest" value={n.festival_id} onChange={(e) => setN({ ...n, festival_id: e.target.value })}>
            <option value="">Nenhum (geral)</option>{fests.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}</select></div>
          <label className="hint" style={{ alignSelf: "end", paddingBottom: 12 }}><input type="checkbox" checked={n.pago} onChange={(e) => setN({ ...n, pago: e.target.checked })} /> {n.tipo === "entrada" ? "Já recebido" : "Já pago"}</label>
        </div>
        <div className="toolbar" style={{ margin: 0 }}><button className="primary">Salvar lançamento</button></div>
      </form>

      <h2 className="mes">Lançamentos</h2>
      {lista === null ? <div className="loading">Carregando…</div> : !vis.length ? <div className="card empty">Nenhum lançamento neste filtro.</div> : (
        <div className="card scroll-x"><table className="tbl">
          <thead><tr><th>Data</th><th>Descrição</th><th className="num">Valor</th><th>Situação</th><th></th></tr></thead>
          <tbody>{vis.map((l) => (
            <tr key={l.id}>
              <td style={{ whiteSpace: "nowrap" }}>{new Date(l.data + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</td>
              <td>{l.descricao}<br /><span className="hint">{[l.categoria, nomeFest[l.festival_id]].filter(Boolean).join(" · ")}</span></td>
              <td className="num" style={{ color: l.tipo === "entrada" ? "var(--ok)" : "var(--bad)", fontWeight: 700 }}>{l.tipo === "entrada" ? "+" : "−"} {brl(l.valor)}</td>
              <td><button className={"status " + (l.pago ? "s-ok" : "s-pend")} onClick={() => alternarPago(l)}>{l.pago ? (l.tipo === "entrada" ? "Recebido" : "Pago") : (l.tipo === "entrada" ? "A receber" : "A pagar")}</button></td>
              <td>{apagar === l.id ? <><button className="primary btn-sm" onClick={() => remover(l)}>Apagar</button> <button className="ghost btn-sm" onClick={() => setApagar(null)}>Não</button></>
                : <button className="ghost btn-sm" onClick={() => setApagar(l.id)} aria-label="Apagar lançamento">✕</button>}</td>
            </tr>))}
          </tbody></table></div>
      )}

      {Object.keys(porFest).length > 0 && <>
        <h2 className="mes">Resultado por evento</h2>
        <div className="card scroll-x"><table className="tbl">
          <thead><tr><th>Evento</th><th className="num">Entradas</th><th className="num">Saídas</th><th className="num">Resultado</th></tr></thead>
          <tbody>{Object.entries(porFest).map(([id, p]) => (
            <tr key={id}><td>{nomeFest[id] || "Evento"}</td><td className="num">{brl(p.e)}</td><td className="num">{brl(p.s)}</td><td className="num" style={{ fontWeight: 700 }}>{brl(p.e - p.s)}</td></tr>
          ))}</tbody></table></div>
      </>}
    </section>
  );
}
