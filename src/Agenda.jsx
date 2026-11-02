import React, { useEffect, useState } from "react";
import { sb } from "./supabase.js";
import { ir } from "./util.js";
import { FestivalForm, periodo } from "./Festivais.jsx";

const ymd = (d) => d.replaceAll("-", "");
function mais1(d) { const x = new Date(d + "T12:00:00"); x.setDate(x.getDate() + 1); return x.toISOString().slice(0, 10); }

// Link que abre o Google Agenda já com o evento preenchido
export function linkGoogleAgenda(f) {
  if (!f.data_inicio) return null;
  const fim = mais1(f.data_fim || f.data_inicio);
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: (f.tipo === "show" ? "Show: " : "Festival: ") + f.nome,
    dates: ymd(f.data_inicio) + "/" + ymd(fim),
    location: f.cidade_datas || "",
    details: ["Banda APK", f.horarios].filter(Boolean).join("\n") + "\nPainel: https://painel.bandaapk.com.br/f/" + f.id,
  });
  return "https://calendar.google.com/calendar/render?" + p.toString();
}

export default function Agenda({ perfil }) {
  const [lista, setLista] = useState(null);
  const [novo, setNovo] = useState(false);
  const gestor = perfil.papel !== "musico";
  useEffect(() => {
    sb.from("festivais").select("*").order("data_inicio", { ascending: true, nullsFirst: false }).then(({ data }) => setLista(data || []));
  }, []);

  const hoje = new Date().toISOString().slice(0, 10);
  const proximos = (lista || []).filter((f) => f.data_inicio && (f.data_fim || f.data_inicio) >= hoje);
  const passados = (lista || []).filter((f) => f.data_inicio && (f.data_fim || f.data_inicio) < hoje).reverse();
  const semData = (lista || []).filter((f) => !f.data_inicio);
  const porMes = {};
  proximos.forEach((f) => {
    const m = new Date(f.data_inicio + "T12:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    (porMes[m] = porMes[m] || []).push(f);
  });

  const Linha = ({ f }) => {
    const g = linkGoogleAgenda(f);
    return (
      <li className="card" style={{ padding: 14, display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        <a href={"/f/" + f.id} onClick={(e) => { e.preventDefault(); ir("/f/" + f.id); }} style={{ textDecoration: "none", color: "inherit", minWidth: 0 }}>
          <b style={{ fontSize: 17 }}>{f.nome}</b><br />
          <span className="hint">{[periodo(f), f.cidade_datas].filter(Boolean).join(" · ")}</span>{" "}
          <span className="pill">{f.tipo === "show" ? "Show" : "Festival"}</span>
        </a>
        {g && <a className="ghost btn-sm" href={g} target="_blank" rel="noopener" style={{ textDecoration: "none", color: "inherit" }}>Pôr no Google Agenda</a>}
      </li>
    );
  };

  return (
    <section>
      <div className="fest"><div className="eyebrow">Datas da banda</div><h1>Agenda</h1>
        <p>Festivais e shows por data. O botão "Pôr no Google Agenda" abre o evento pronto para salvar na agenda da banda.</p></div>
      {gestor && !novo && <div className="toolbar" style={{ marginTop: 0 }}><button className="primary" onClick={() => setNovo(true)}>Novo show ou festival</button></div>}
      {novo && <FestivalForm tipoInicial="show" onCancelar={() => setNovo(false)} onSalvo={(id) => ir("/f/" + id)} />}
      {lista === null ? <div className="loading">Carregando…</div> : <>
        {!proximos.length && <div className="card empty">Nenhum evento com data marcada pela frente.</div>}
        {Object.entries(porMes).map(([m, fs]) => (
          <div key={m}><h2 className="mes">{m}</h2><ul className="fests">{fs.map((f) => <Linha key={f.id} f={f} />)}</ul></div>
        ))}
        {semData.length > 0 && <><h2 className="mes">Data a definir</h2><ul className="fests">{semData.map((f) => <Linha key={f.id} f={f} />)}</ul></>}
        {passados.length > 0 && <details style={{ marginTop: 18 }}><summary style={{ cursor: "pointer", fontWeight: 700 }}>Eventos que já passaram ({passados.length})</summary>
          <ul className="fests" style={{ marginTop: 10 }}>{passados.map((f) => <Linha key={f.id} f={f} />)}</ul></details>}
      </>}
    </section>
  );
}
