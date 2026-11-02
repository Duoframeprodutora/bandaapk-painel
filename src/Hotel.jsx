import React, { useEffect, useState } from "react";
import { sb, erroLegivel } from "./supabase.js";
import { toast, copiar } from "./util.js";

const WD = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const CAMPOS = [
  ["hotel", "Nome do hotel", "text"], ["endereco", "Endereço", "text"], ["mapa", "Link da localização", "url", "Cole o link do Google Maps"],
  ["contato", "Contato do hotel", "text", "Nome e telefone"], ["checkin", "Check-in", "text"], ["checkout", "Check-out", "text"],
];

export default function Hotel({ fest, dias, gestor }) {
  const [h, setH] = useState(null);
  const [quartos, setQuartos] = useState([]);
  const [pessoas, setPessoas] = useState({});
  const [equipe, setEquipe] = useState([]);
  const [texto, setTexto] = useState("");
  const [editado, setEditado] = useState(false);

  async function carregar() {
    const [a, b, c, d] = await Promise.all([
      sb.from("hospedagens").select("*").eq("festival_id", fest.id).maybeSingle(),
      sb.from("quartos").select("*").eq("festival_id", fest.id).order("ordem"),
      sb.from("quarto_pessoas").select("*").eq("festival_id", fest.id),
      sb.from("equipe").select("*").eq("ativo", true).order("ordem"),
    ]);
    let hosp = a.data;
    if (!hosp && gestor) { const r = await sb.from("hospedagens").insert({ festival_id: fest.id }).select().single(); hosp = r.data; }
    setH(hosp || {}); setQuartos(b.data || []);
    setPessoas(Object.fromEntries((c.data || []).map((x) => [x.equipe_id, x.quarto_id])));
    setEquipe(d.data || []);
  }
  useEffect(() => { carregar(); }, [fest.id]);

  const tecnicos = equipe.filter((e) => e.tecnica);
  const viajam = h?.tecnica === "nao" ? equipe.filter((e) => !e.tecnica) : equipe;
  const nomeQ = (q, k) => "Quarto " + (k + 1) + (q.numero ? " · nº " + q.numero : "");
  const noQuarto = (q) => viajam.filter((e) => pessoas[e.id] === q.id);

  function linhaTecnica() {
    if (!h) return "";
    if (h.tecnica === "nao") return "Equipe técnica não vai neste festival (não precisa montar estrutura).";
    const quando = h.tecnica === "0" ? "no mesmo dia" : h.tecnica === "1" ? "1 dia antes" : "2 dias antes";
    return "Equipe técnica (" + tecnicos.map((e) => e.nome).join(", ") + ") vai " + quando + " para montar a estrutura" + (h.chegada_tecnica ? ": chegada " + h.chegada_tecnica : "") + ".";
  }
  function gerarTexto() {
    if (!h) return "";
    return "*" + fest.nome + "*\n*Logística e hospedagem*\n\n" + linhaTecnica() + (h.chegada_musicos ? "\nMúsicos: chegada " + h.chegada_musicos + "." : "") +
      (h.hotel ? "\n\n*Hotel:* " + h.hotel : "") + (h.endereco ? "\n" + h.endereco : "") + (h.mapa ? "\nLocalização: " + h.mapa : "") + (h.contato ? "\nContato: " + h.contato : "") +
      (h.checkin || h.checkout ? "\nCheck-in: " + (h.checkin || "a confirmar") + " · Check-out: " + (h.checkout || "a confirmar") : "") +
      (h.combinado ? "\n\n*Combinado:*\n" + h.combinado.split("\n").filter(Boolean).map((l) => "• " + l).join("\n") : "") +
      (h.observacoes ? "\n\n*Obs:* " + h.observacoes : "") +
      (quartos.some((q) => noQuarto(q).length) ? "\n\n*Quartos:*\n" + quartos.map((q, k) => noQuarto(q).length ? nomeQ(q, k) + ": " + noQuarto(q).map((e) => e.nome).join(", ") : null).filter(Boolean).join("\n") : "");
  }
  useEffect(() => { if (!editado) setTexto(gerarTexto()); });

  if (!h) return <div className="loading">Carregando…</div>;

  async function salvarCampo(k, v) {
    const { error } = await sb.from("hospedagens").update({ [k]: v }).eq("festival_id", fest.id);
    if (error) toast(erroLegivel(error));
  }
  function diaAntes(n) {
    const primeiro = (dias[0]?.nome || "").toLowerCase().split(/[\s-]/)[0];
    const i = WD.indexOf(primeiro);
    return i < 0 ? "" : WD[(i - n + 7) % 7];
  }
  async function escolherTecnica(t) {
    const novo = { ...h, tecnica: t };
    if (t !== "nao") { const d = diaAntes(+t); if (d) novo.chegada_tecnica = d + " " + ((h.chegada_tecnica || "").match(/\d{1,2}h\d*/) || ["10h"])[0]; }
    setH(novo);
    await sb.from("hospedagens").update({ tecnica: novo.tecnica, chegada_tecnica: novo.chegada_tecnica }).eq("festival_id", fest.id);
  }
  async function addQuarto() {
    const { data, error } = await sb.from("quartos").insert({ festival_id: fest.id, ordem: quartos.length, capacidade: 2 }).select().single();
    if (error) return toast(erroLegivel(error));
    setQuartos([...quartos, data]);
  }
  async function removerQuarto(q) {
    await sb.from("quartos").delete().eq("id", q.id); carregar();
  }
  async function mudarQuarto(q, campo, v) {
    setQuartos(quartos.map((x) => x.id === q.id ? { ...x, [campo]: v } : x));
    await sb.from("quartos").update({ [campo]: campo === "capacidade" ? +v || 1 : v }).eq("id", q.id);
  }
  async function colocar(pessoaId, quartoId) {
    setPessoas({ ...pessoas, [pessoaId]: quartoId || undefined });
    if (!quartoId) await sb.from("quarto_pessoas").delete().eq("festival_id", fest.id).eq("equipe_id", pessoaId);
    else await sb.from("quarto_pessoas").upsert({ festival_id: fest.id, equipe_id: pessoaId, quarto_id: quartoId });
  }
  const opcoes = (atual) => <>{quartos.map((q, k) => <option key={q.id} value={q.id}>{nomeQ(q, k)}</option>)}<option value="">Sem quarto</option></>;
  const semQuarto = viajam.filter((e) => !quartos.some((q) => q.id === pessoas[e.id]));
  const br = (t) => (t || "").split("\n").map((l, k) => <React.Fragment key={k}>{k > 0 && <br />}{l}</React.Fragment>);

  return (
    <>
      {gestor && (
        <form className="card sharebox no-print" onSubmit={(e) => e.preventDefault()}>
          <b>Dados do hotel</b>
          <div className="row2">
            {CAMPOS.map(([k, label, type, ph]) => (
              <div className="field" key={k}><label htmlFor={"h-" + k}>{label}</label>
                <input type={type} id={"h-" + k} value={h[k] || ""} placeholder={ph} onChange={(e) => setH({ ...h, [k]: e.target.value })} onBlur={(e) => salvarCampo(k, e.target.value)} /></div>
            ))}
          </div>
          <div className="field">
            <span className="lbl" id="lbl-tec">Equipe técnica (montagem da estrutura)</span>
            <div className="seg" role="group" aria-labelledby="lbl-tec">
              {[["nao", "Não vai"], ["0", "Mesmo dia"], ["1", "1 dia antes"], ["2", "2 dias antes"]].map(([v, n]) => (
                <button type="button" key={v} aria-pressed={h.tecnica === v} onClick={() => escolherTecnica(v)}>{n}</button>
              ))}
            </div>
            <span className="hint">{h.tecnica === "nao" ? "A equipe técnica sai da divisão de quartos deste festival." : tecnicos.map((e) => e.nome).join(", ") + " entram na divisão de quartos."}</span>
          </div>
          <div className="row2">
            {h.tecnica !== "nao" && <div className="field"><label htmlFor="h-ct">Chegada da equipe técnica</label>
              <input type="text" id="h-ct" value={h.chegada_tecnica || ""} placeholder="Ex.: quarta 10h" onChange={(e) => setH({ ...h, chegada_tecnica: e.target.value })} onBlur={(e) => salvarCampo("chegada_tecnica", e.target.value)} /></div>}
            <div className="field"><label htmlFor="h-cm">Chegada dos músicos</label>
              <input type="text" id="h-cm" value={h.chegada_musicos || ""} placeholder="Ex.: quinta 14h" onChange={(e) => setH({ ...h, chegada_musicos: e.target.value })} onBlur={(e) => salvarCampo("chegada_musicos", e.target.value)} /></div>
          </div>
          {[["combinado", "O que foi combinado", "Ex.: café da manhã incluso, estacionamento para o ônibus"], ["observacoes", "Observações", ""]].map(([k, label, ph]) => (
            <div className="field" key={k}><label htmlFor={"h-" + k}>{label}</label>
              <textarea id={"h-" + k} value={h[k] || ""} placeholder={ph} onChange={(e) => setH({ ...h, [k]: e.target.value })} onBlur={(e) => salvarCampo(k, e.target.value)} /></div>
          ))}
        </form>
      )}

      <div className="card sharebox no-print">
        <b>Quem fica com quem</b>
        <span className="hint">O número do quarto você preenche quando receber a chave. A equipe técnica entra só aqui e não tem login no sistema.</span>
        {!quartos.length && <span className="hint">Nenhum quarto ainda.</span>}
        <ul className="list">
          {quartos.map((q, k) => {
            const p = noQuarto(q), cheio = p.length > q.capacidade;
            return (
              <li className="room" key={q.id}>
                <b>Quarto {k + 1}</b>
                <span className="hint" style={cheio ? { color: "var(--bad)", fontWeight: 700 } : null}>{p.length} de {q.capacidade} lugares</span>
                {gestor && <div className="ppl" style={{ alignItems: "center" }}>
                  <label className="hint" htmlFor={"qn-" + q.id}>Nº</label>
                  <input type="text" id={"qn-" + q.id} value={q.numero} placeholder="na chegada" style={{ width: 110, padding: "6px 8px" }} onChange={(e) => mudarQuarto(q, "numero", e.target.value)} />
                  <label className="hint" htmlFor={"qc-" + q.id}>Lugares</label>
                  <input type="number" id={"qc-" + q.id} min="1" max="8" value={q.capacidade} style={{ width: 70, padding: "6px 8px" }} onChange={(e) => mudarQuarto(q, "capacidade", e.target.value)} />
                  <button className="ghost btn-sm danger" onClick={() => removerQuarto(q)}>Remover</button>
                </div>}
                <div className="ppl">
                  {p.length ? p.map((e) => (
                    <span className="person" key={e.id}>{e.nome} <small className="hint">({e.funcao})</small>
                      {gestor && <select aria-label={"Trocar quarto de " + e.nome} value={q.id} onChange={(ev) => colocar(e.id, ev.target.value)}>{opcoes()}</select>}</span>
                  )) : <span className="hint">Vazio</span>}
                </div>
              </li>
            );
          })}
          {semQuarto.length > 0 && (
            <li className="room"><b>Sem quarto</b><span /><div className="ppl">
              {semQuarto.map((e) => (
                <span className="person" key={e.id}>{e.nome} <small className="hint">({e.funcao})</small>
                  {gestor && quartos.length > 0 && <select aria-label={"Escolher quarto de " + e.nome} value="" onChange={(ev) => colocar(e.id, ev.target.value)}>{opcoes()}</select>}</span>
              ))}
            </div></li>
          )}
        </ul>
        {gestor && <div className="toolbar" style={{ margin: 0 }}><button className="ghost" onClick={addQuarto}>Adicionar quarto</button></div>}
      </div>

      <div className="eyebrow no-print" style={{ margin: "18px 0 8px" }}>PDF para o grupo da banda</div>
      <div className="card pdf print-only-area">
        <div className="eyebrow">{fest.nome}</div>
        <h2>Hospedagem da banda</h2>
        <table><tbody>
          {[["Hotel", h.hotel], ["Endereço", h.endereco], ["Localização", h.mapa && <a className="lnk" href={h.mapa} target="_blank" rel="noopener">{h.mapa}</a>], ["Contato", h.contato],
            ["Equipe técnica", linhaTecnica()], ["Chegada dos músicos", h.chegada_musicos], ["Check-in", h.checkin], ["Check-out", h.checkout],
            ["Combinado", h.combinado && br(h.combinado)], ["Observações", h.observacoes && br(h.observacoes)]].filter((r) => r[1]).map(([k, v]) => (
              <tr key={k}><th style={{ width: "32%" }}>{k}</th><td>{v}</td></tr>
            ))}
        </tbody></table>
        <h3 style={{ fontSize: 18 }}>Quartos</h3>
        <table><thead><tr><th>Quarto</th><th>Quem fica</th></tr></thead><tbody>
          {quartos.map((q, k) => <tr key={q.id}><td><b>{nomeQ(q, k)}</b></td><td>{noQuarto(q).map((e) => e.nome).join(", ") || "—"}</td></tr>)}
        </tbody></table>
      </div>
      <div className="toolbar no-print">
        <button className="primary" onClick={() => window.print()}>Gerar PDF</button>
        <span className="hint">No celular, escolha "Salvar como PDF" na tela de impressão.</span>
      </div>

      <div className="card sharebox no-print" style={{ marginTop: 6 }}>
        <b>Texto pronto para o grupo</b>
        <span className="hint">Gerado automaticamente com os dados acima. Pode ajustar antes de copiar.</span>
        <textarea value={texto} onChange={(e) => { setTexto(e.target.value); setEditado(true); }} style={{ minHeight: 260, fontSize: 14 }} aria-label="Texto para o WhatsApp" />
        <div className="toolbar" style={{ margin: 0 }}>
          <button className="primary" onClick={() => copiar(texto, "Texto copiado. Cole no grupo da banda.")}>Copiar texto</button>
          {editado && <button className="ghost" onClick={() => { setEditado(false); setTexto(gerarTexto()); }}>Gerar de novo</button>}
        </div>
      </div>
    </>
  );
}
