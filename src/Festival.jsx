import React, { useEffect, useMemo, useState } from "react";
import { sb, linkInscricao, plataforma, erroLegivel } from "./supabase.js";
import { ir, toast, copiar } from "./util.js";
import { FestivalForm, periodo } from "./Festivais.jsx";
import Hotel from "./Hotel.jsx";
import Anotacoes from "./Anotacoes.jsx";

const ST = { pendente: "Pendente", conferida: "Conferida", problema: "Com problema" };
const PROX = { pendente: "conferida", conferida: "problema", problema: "pendente" };
const CL = { pendente: "pend", conferida: "ok", problema: "bad" };

export default function Festival({ id, aba, perfil }) {
  const [fest, setFest] = useState(undefined);
  const [dias, setDias] = useState([]);
  const [insc, setInsc] = useState([]);
  const [diaSel, setDiaSel] = useState(null);
  const gestor = perfil.papel !== "musico";

  async function carregar() {
    const [{ data: f }, { data: ds }, { data: is }] = await Promise.all([
      sb.from("festivais").select("*").eq("id", id).single(),
      sb.from("dias").select("*, categorias(*)").eq("festival_id", id).order("ordem"),
      sb.from("inscricoes").select("*").eq("festival_id", id).order("ordem"),
    ]);
    setFest(f || null);
    const d2 = (ds || []).map((d) => ({ ...d, categorias: (d.categorias || []).sort((a, b) => a.ordem - b.ordem) }));
    setDias(d2); setInsc(is || []);
    setDiaSel((cur) => cur === "sem" || (cur && d2.some((d) => d.id === cur)) ? cur : d2[0]?.id || "sem");
  }
  useEffect(() => {
    carregar();
    const ch = sb.channel("insc-" + id).on("postgres_changes", { event: "*", schema: "public", table: "inscricoes", filter: "festival_id=eq." + id }, carregar).subscribe();
    return () => { sb.removeChannel(ch); };
  }, [id]);

  if (fest === undefined) return <div className="loading">Carregando…</div>;
  if (!fest) return <div className="card empty">Festival não encontrado. <a href="/" onClick={(e) => { e.preventDefault(); ir("/"); }}>Voltar</a></div>;

  const abas = [["inscricoes", "Inscrições"], ["palco", "Palco"], ["hotel", "Hotel"], ["notas", "Anotações"], ...(gestor ? [["dados", "Dados do festival"]] : [])];
  const catInfo = {};
  dias.forEach((d) => d.categorias.forEach((c) => (catInfo[c.id] = { dia: d, cat: c })));
  const semDia = insc.filter((i) => !catInfo[i.categoria_id]);
  const doDia = diaSel === "sem" ? semDia : insc.filter((i) => catInfo[i.categoria_id]?.dia.id === diaSel);
  const todasCats = dias.flatMap((d) => d.categorias.map((c) => ({ id: c.id, nome: d.nome + " · " + c.nome })));

  return (
    <section>
      <div className="fest">
        <div className="eyebrow"><a href="/" onClick={(e) => { e.preventDefault(); ir("/"); }}>Festivais</a> · {fest.inscricoes_abertas ? "inscrições abertas" : "inscrições fechadas"}</div>
        <h1>{fest.nome}</h1>
        <p>{[fest.tipo === "show" ? "Show" : "Festival", periodo(fest), fest.cidade_datas, fest.horarios].filter(Boolean).join(" · ")}</p>
      </div>
      <div className="subtabs" role="tablist">
        {abas.map(([k, n]) => (
          <button key={k} className="chip-btn" role="tab" aria-pressed={aba === k} aria-selected={aba === k} onClick={() => ir("/f/" + id + (k === "inscricoes" ? "" : "/" + k))}>{n}</button>
        ))}
      </div>

      {(aba === "inscricoes" || aba === "palco") && (dias.length > 0 || semDia.length > 0) && (
        <div className="daytabs" role="group" aria-label="Dia do festival" style={{ marginBottom: 8 }}>
          {dias.map((d) => (
            <button key={d.id} className="chip-btn" aria-pressed={diaSel === d.id} onClick={() => setDiaSel(d.id)}>
              {d.nome} · {d.categorias.map((c) => c.nome).join(", ")}
            </button>
          ))}
          {(semDia.length > 0 || !dias.length) && <button className="chip-btn" aria-pressed={diaSel === "sem"} onClick={() => setDiaSel("sem")}>Dia a definir ({semDia.length})</button>}
        </div>
      )}
      {aba === "inscricoes" && gestor && !dias.length && (
        <div className="obs" style={{ marginBottom: 10 }}>Os dias e categorias ainda não foram definidos. Os candidatos já podem se inscrever, e quando o organizador decidir você preenche em <b>Dados do festival</b> e coloca cada um no dia certo.</div>
      )}

      {aba === "inscricoes" && <Inscricoes fest={fest} lista={doDia} catInfo={catInfo} todasCats={todasCats} dia={dias.find((d) => d.id === diaSel)} gestor={gestor} perfil={perfil} recarregar={carregar} />}
      {aba === "palco" && <Palco lista={doDia} catInfo={catInfo} />}
      {aba === "notas" && <Anotacoes perfil={perfil} festivalId={id} />}
      {aba === "hotel" && <Hotel fest={fest} dias={dias} gestor={gestor} />}
      {aba === "dados" && gestor && <Dados fest={fest} dias={dias} recarregar={carregar} />}
    </section>
  );
}

function Inscricoes({ fest, lista, catInfo, todasCats, dia, gestor, perfil, recarregar }) {
  const link = linkInscricao(fest.slug);
  const c = { pendente: 0, conferida: 0, problema: 0 };
  lista.forEach((i) => c[i.status]++);

  async function mudarStatus(i) {
    const novo = PROX[i.status];
    let problema = i.problema;
    if (novo === "problema" && !problema) problema = "Conferir com o candidato";
    const { error } = await sb.from("inscricoes").update({ status: novo, problema }).eq("id", i.id);
    if (error) toast(erroLegivel(error)); else recarregar();
  }
  async function mudarCategoria(i, cat) {
    const { error } = await sb.from("inscricoes").update({ categoria_id: cat || null }).eq("id", i.id);
    if (error) toast(erroLegivel(error)); else { toast("Inscrição movida"); recarregar(); }
  }
  async function salvarProblema(i, texto) {
    await sb.from("inscricoes").update({ problema: texto }).eq("id", i.id);
  }
  async function reordenar(novaLista) {
    const ordens = lista.map((x) => x.ordem).sort((a, b) => a - b);
    await Promise.all(novaLista.map((x, k) => x.ordem !== ordens[k] ? sb.from("inscricoes").update({ ordem: ordens[k] }).eq("id", x.id) : null));
    recarregar();
  }
  function mover(i, delta) {
    const k = lista.indexOf(i), j = k + delta;
    if (j < 0 || j >= lista.length) return;
    const n = [...lista]; [n[k], n[j]] = [n[j], n[k]]; reordenar(n);
  }
  function sortear() {
    const n = [...lista];
    for (let k = n.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [n[k], n[j]] = [n[j], n[k]]; }
    reordenar(n); toast("Ordem do ensaio sorteada");
  }
  function agrupar() {
    const pos = (i) => catInfo[i.categoria_id]?.cat.ordem ?? 99;
    reordenar([...lista].sort((a, b) => pos(a) - pos(b))); toast("Agrupado por categoria");
  }
  function textoLista() {
    return "*" + fest.nome + "*\n" + (dia ? "*Ensaio de " + dia.nome + "* (" + dia.categorias.map((x) => x.nome).join(", ") + ")" : "*Inscrições*") + "\n\n" +
      lista.map((i, k) => (k + 1) + ". *" + i.nome + "* · " + i.musica + (i.versao ? " (" + i.versao + ")" : "") + "\n   Tom: *" + i.tom + "* · " + (catInfo[i.categoria_id]?.cat.nome || "") +
        "\n   " + (i.link || "Áudio enviado pelo candidato") + (i.observacao ? "\n   Obs: " + i.observacao.replace(/\n/g, " / ") : "")).join("\n\n");
  }
  async function ouvir(i) {
    const { data, error } = await sb.storage.from("audios").createSignedUrl(i.audio_path, 3600);
    if (error) return toast("Não foi possível abrir o áudio.");
    window.open(data.signedUrl, "_blank");
  }

  return (
    <>
      {gestor && (
        <div className="card sharebox">
          <b>Link de inscrição para o organizador repassar aos candidatos</b>
          <div className="url">{link}</div>
          <div className="toolbar" style={{ margin: 0 }}>
            <button className="ghost" onClick={() => copiar(link, "Link copiado")}>Copiar link</button>
            <a className="ghost" href={link} target="_blank" rel="noopener" style={{ textDecoration: "none", color: "inherit" }}>Ver como o candidato vê</a>
          </div>
        </div>
      )}
      <div className="toolbar">
        {gestor && <button className="ghost" onClick={sortear} disabled={lista.length < 2}>Sortear ordem do ensaio</button>}
        {gestor && <button className="ghost" onClick={agrupar} disabled={lista.length < 2}>Agrupar por categoria</button>}
        <button className="ghost" onClick={() => copiar(textoLista(), "Lista copiada. Cole no grupo da banda.")} disabled={!lista.length}>Copiar lista para o WhatsApp</button>
      </div>
      <div className="summary">
        <span><b>{lista.length}</b> candidatos</span><span><b>{c.conferida}</b> conferidos</span><span><b>{c.pendente}</b> pendentes</span><span><b>{c.problema}</b> com problema</span>
      </div>
      {!lista.length && <div className="card empty">Nenhuma inscrição neste dia ainda.{gestor && " Copie o link acima e mande para o organizador."}</div>}
      <ol className="list">
        {lista.map((i, k) => (
          <Item key={i.id} i={i} n={k + 1} cat={catInfo[i.categoria_id]?.cat.nome} gestor={gestor} todasCats={todasCats} onCategoria={(c) => mudarCategoria(i, c)}
            onStatus={() => mudarStatus(i)} onProblema={(t) => salvarProblema(i, t)} onUp={() => mover(i, -1)} onDown={() => mover(i, 1)} onOuvir={() => ouvir(i)} />
        ))}
      </ol>
      {gestor && <p className="hint" style={{ marginTop: 14 }}>Toque no status para marcar a versão como Pendente, Conferida ou Com problema.</p>}
    </>
  );
}

function Item({ i, n, cat, gestor, todasCats = [], onCategoria, onStatus, onProblema, onUp, onDown, onOuvir }) {
  const [prob, setProb] = useState(i.problema);
  useEffect(() => setProb(i.problema), [i.problema]);
  const p = plataforma(i.link);
  return (
    <li className={"card item s-" + CL[i.status]}>
      <div className="ord">{n}</div>
      <div className="info">
        <h3>{i.nome}</h3>
        <div className="song">{i.musica}</div>
        {i.versao && <div className="ver">Versão: {i.versao}</div>}
        <div className="meta">
          {cat && <span className="cat">{cat}</span>}
          {i.link ? <>{p && <span className={"pbadge " + p.k}>{p.n}</span>}<a className="lnk" href={i.link} target="_blank" rel="noopener">Abrir versão</a></>
            : i.audio_path && <><span className="pbadge up">Áudio</span><button className="ghost btn-sm" onClick={onOuvir}>Ouvir áudio</button></>}
        </div>
        {i.observacao && <div className="obs" style={{ whiteSpace: "pre-wrap" }}>{i.observacao}</div>}
        {i.link_edicao && <div className="obs">Edição: <a className="lnk" href={i.link_edicao} target="_blank" rel="noopener">{i.link_edicao}</a></div>}
        {i.status === "problema" && (gestor
          ? <input type="text" className="probtxt" aria-label="Qual é o problema" value={prob} onChange={(e) => setProb(e.target.value)} onBlur={() => prob !== i.problema && onProblema(prob)} style={{ background: "var(--bad-soft)", color: "var(--bad)", border: 0, borderRadius: 6, padding: "6px 8px" }} />
          : i.problema && <div className="obs" style={{ background: "var(--bad-soft)", color: "var(--bad)" }}><b>Problema:</b> {i.problema}</div>)}
        {gestor && todasCats.length > 0 && (
          <select value={i.categoria_id || ""} onChange={(e) => onCategoria(e.target.value)} aria-label={"Dia e categoria de " + i.nome} style={{ width: "auto", maxWidth: "100%", padding: "6px 8px", fontSize: 14, marginTop: 4 }}>
            <option value="">Dia a definir</option>
            {todasCats.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        )}
        {gestor && i.whatsapp && <div className="hint">WhatsApp: <a href={"https://wa.me/55" + i.whatsapp.replace(/\D/g, "").replace(/^55/, "")} target="_blank" rel="noopener">{i.whatsapp}</a></div>}
      </div>
      <div className="side">
        <span className="tone-big" title="Tom">{i.tom}</span>
        <button className={"status s-" + CL[i.status]} onClick={onStatus} disabled={!gestor}>{ST[i.status]}</button>
        {gestor && onUp && <div className="mv"><button onClick={onUp} aria-label="Subir na ordem">↑</button><button onClick={onDown} aria-label="Descer na ordem">↓</button></div>}
      </div>
    </li>
  );
}

function Palco({ lista, catInfo }) {
  const [k, setK] = useState(0);
  useEffect(() => setK(0), [lista.length && lista[0]?.id]);
  useEffect(() => {
    let lock;
    navigator.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => {});
    return () => { lock?.release?.(); };
  }, []);
  if (!lista.length) return <div className="card empty">Nenhum candidato neste dia.</div>;
  const idx = Math.min(k, lista.length - 1), i = lista[idx], prox = lista[idx + 1];
  return (
    <div className="stage">
      <div className="card now">
        <div className="eyebrow">{idx + 1} de {lista.length} · {catInfo[i.categoria_id]?.cat.nome}</div>
        <div className="who">{i.nome}</div>
        <div className="what">{i.musica}{i.versao ? " · " + i.versao : ""}</div>
        <div className={"tone-huge" + (i.tom.length > 5 ? " long" : "")}>{i.tom}</div>
        {i.observacao && <div className="obs" style={{ textAlign: "left", whiteSpace: "pre-wrap" }}>{i.observacao}</div>}
      </div>
      {prox ? <div className="card next"><span><span className="eyebrow">Próximo</span><br /><b>{prox.nome}</b> · {prox.musica}</span><span className="tone-big">{prox.tom}</span></div>
        : <div className="card next"><span className="hint">Último candidato do dia.</span></div>}
      <div className="stagenav">
        <button className="ghost" disabled={idx === 0} onClick={() => setK(idx - 1)}>← Anterior</button>
        <button className="primary" disabled={!prox} onClick={() => setK(idx + 1)}>Próximo →</button>
      </div>
    </div>
  );
}

function Dados({ fest, dias, recarregar }) {
  const [apagar, setApagar] = useState(false);
  async function alternar() {
    await sb.from("festivais").update({ inscricoes_abertas: !fest.inscricoes_abertas }).eq("id", fest.id);
    toast(fest.inscricoes_abertas ? "Inscrições fechadas" : "Inscrições abertas"); recarregar();
  }
  async function excluir() {
    const { error } = await sb.from("festivais").delete().eq("id", fest.id);
    if (error) return toast(erroLegivel(error));
    toast("Festival excluído"); ir("/");
  }
  return (
    <>
      <div className="card sharebox">
        <b>Inscrições {fest.inscricoes_abertas ? "abertas" : "fechadas"}</b>
        <span className="hint">{fest.inscricoes_abertas ? "Os candidatos conseguem enviar e corrigir as músicas pelo link." : "O link mostra que as inscrições foram encerradas."}</span>
        <div className="toolbar" style={{ margin: 0 }}><button className="ghost" onClick={alternar}>{fest.inscricoes_abertas ? "Fechar inscrições" : "Reabrir inscrições"}</button></div>
      </div>
      <FestivalForm festival={fest} dias={dias} onSalvo={recarregar} />
      <div className="card sharebox">
        <b className="danger">Excluir festival</b>
        <span className="hint">Apaga o festival, todas as inscrições e a hospedagem. Não dá para desfazer.</span>
        {!apagar ? <div className="toolbar" style={{ margin: 0 }}><button className="ghost danger" onClick={() => setApagar(true)}>Excluir festival</button></div>
          : <div className="toolbar" style={{ margin: 0 }}><button className="primary" onClick={excluir}>Sim, excluir de vez</button><button className="ghost" onClick={() => setApagar(false)}>Cancelar</button></div>}
      </div>
    </>
  );
}
