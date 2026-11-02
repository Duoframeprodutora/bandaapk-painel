import React, { useEffect, useState } from "react";
import { sb, slugify, erroLegivel } from "./supabase.js";
import { ir, toast } from "./util.js";

export default function Festivais({ perfil }) {
  const [lista, setLista] = useState(null);
  const [novo, setNovo] = useState(false);
  const gestor = perfil.papel !== "musico";

  const carregar = () => sb.from("festivais").select("*, inscricoes(count)").order("criado_em", { ascending: false })
    .then(({ data }) => setLista(data || []));
  useEffect(() => { carregar(); }, []);

  return (
    <section>
      <div className="fest">
        <div className="eyebrow">Painel da banda</div>
        <h1>Festivais</h1>
      </div>
      {gestor && !novo && <div className="toolbar" style={{ marginTop: 0 }}><button className="primary" onClick={() => setNovo(true)}>Cadastrar festival</button></div>}
      {novo && <FestivalForm onCancelar={() => setNovo(false)} onSalvo={(id) => ir("/f/" + id)} />}
      {lista === null ? <div className="loading">Carregando…</div> :
        lista.length === 0 ? <div className="card empty">Nenhum festival cadastrado ainda.{gestor && " Toque em Cadastrar festival e preencha com o que o organizador passou."}</div> :
          <ul className="fests">
            {lista.map((f) => (
              <li key={f.id} className="card">
                <a href={"/f/" + f.id} onClick={(e) => { e.preventDefault(); ir("/f/" + f.id); }}>
                  <h3>{f.nome}</h3>
                  <span className="hint">{f.cidade_datas}</span>
                  <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span className="pill">{f.inscricoes?.[0]?.count || 0} inscrições</span>
                    <span className={"pill " + (f.inscricoes_abertas ? "on" : "off")}>{f.inscricoes_abertas ? "Inscrições abertas" : "Inscrições fechadas"}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>}
    </section>
  );
}

export const diasParaTexto = (dias) => dias.map((d) => d.nome + ": " + d.categorias.map((c) => c.nome).join(", ")).join("\n");
const lerDias = (texto) => texto.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
  const [n, ...resto] = l.split(":");
  return { nome: n.trim(), cats: resto.join(":").split(",").map((x) => x.trim()).filter(Boolean) };
});

// Cadastro e edição do festival (o Master preenche com o que o organizador passou)
export function FestivalForm({ festival, dias = [], onCancelar, onSalvo }) {
  const [f, setF] = useState({
    nome: festival?.nome || "", cidade_datas: festival?.cidade_datas || "", horarios: festival?.horarios || "",
    qtd_prevista: festival?.qtd_prevista || "", prazo: festival?.prazo || "", contato_ajuda: festival?.contato_ajuda || "",
  });
  const [diasTxt, setDiasTxt] = useState(dias.length ? diasParaTexto(dias) : "");
  const [erro, setErro] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function salvar(e) {
    e.preventDefault(); setErro("");
    const novos = lerDias(diasTxt);
    if (!f.nome.trim()) return setErro("Escreva o nome do festival.");
    if (novos.some((d) => !d.cats.length)) return setErro("Em cada linha coloque o dia, dois-pontos e as categorias. Ex.: Quinta: Popular, Gospel");
    setBusy(true);
    try {
      let id = festival?.id;
      if (id) {
        const { error } = await sb.from("festivais").update(f).eq("id", id); if (error) throw error;
      } else {
        const slug = slugify(f.nome) + "-" + Math.random().toString(36).slice(2, 6);
        const { data, error } = await sb.from("festivais").insert({ ...f, slug }).select().single(); if (error) throw error;
        id = data.id;
        await sb.from("hospedagens").insert({ festival_id: id });
      }
      // Dias e categorias: atualiza pela posição para não perder as inscrições já ligadas
      for (let i = 0; i < novos.length; i++) {
        let dia = dias[i];
        if (dia) await sb.from("dias").update({ nome: novos[i].nome, ordem: i }).eq("id", dia.id);
        else { const r = await sb.from("dias").insert({ festival_id: id, nome: novos[i].nome, ordem: i }).select().single(); if (r.error) throw r.error; dia = { ...r.data, categorias: [] }; }
        const cats = dia.categorias || [];
        for (let j = 0; j < novos[i].cats.length; j++) {
          if (cats[j]) await sb.from("categorias").update({ nome: novos[i].cats[j], ordem: j }).eq("id", cats[j].id);
          else await sb.from("categorias").insert({ dia_id: dia.id, nome: novos[i].cats[j], ordem: j });
        }
        const sobram = cats.slice(novos[i].cats.length).map((c) => c.id);
        if (sobram.length) await sb.from("categorias").delete().in("id", sobram);
      }
      const diasSobrando = dias.slice(novos.length).map((d) => d.id);
      if (diasSobrando.length) await sb.from("dias").delete().in("id", diasSobrando);
      toast("Festival salvo");
      onSalvo(id);
    } catch (err) { setErro(erroLegivel(err)); }
    setBusy(false);
  }

  return (
    <form className="card sharebox" onSubmit={salvar} style={{ marginBottom: 14 }}>
      <b>{festival ? "Editar festival" : "Novo festival"}</b>
      <span className="hint">Só o nome é obrigatório. O resto você preenche quando o organizador decidir, mesmo em cima da hora.</span>
      <div className="row2">
        <div className="field"><label htmlFor="e-nome">Nome do festival</label><input type="text" id="e-nome" value={f.nome} onChange={set("nome")} placeholder="Ex.: Festival da Canção de Passo Fundo" /></div>
        <div className="field"><label htmlFor="e-onde">Cidade e datas (se já souber)</label><input type="text" id="e-onde" value={f.cidade_datas} onChange={set("cidade_datas")} placeholder="Ex.: Passo Fundo, RS · novembro" /></div>
      </div>
      <details open={!!festival}>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>Dias, categorias e outros detalhes (opcional)</summary>
        <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
          <div className="field"><label htmlFor="e-dias">Dias e categorias</label>
            <textarea id="e-dias" value={diasTxt} onChange={(e) => setDiasTxt(e.target.value)} placeholder={"Quinta: Popular, Gospel\nSexta: Sertanejo, Nativista, Composição\nSábado: Final"} style={{ minHeight: 100 }} />
            <span className="hint">Um dia por linha: Dia: categoria, categoria. Enquanto estiver vazio, o candidato se inscreve sem escolher dia e você organiza depois.</span></div>
          <div className="row2">
            <div className="field"><label htmlFor="e-hora">Horários</label><input type="text" id="e-hora" value={f.horarios} onChange={set("horarios")} placeholder="Ex.: ensaio 8h, show 20h" /></div>
            <div className="field"><label htmlFor="e-prazo">Prazo das inscrições</label><input type="text" id="e-prazo" value={f.prazo} onChange={set("prazo")} placeholder="Ex.: 05/11 às 23h59" /></div>
          </div>
          <div className="row2">
            <div className="field"><label htmlFor="e-qtd">Candidatos previstos</label><input type="text" id="e-qtd" value={f.qtd_prevista} onChange={set("qtd_prevista")} placeholder="Ex.: 40" /></div>
            <div className="field"><label htmlFor="e-ajuda">Contato para o candidato pedir ajuda</label><input type="text" id="e-ajuda" value={f.contato_ajuda} onChange={set("contato_ajuda")} placeholder="Ex.: Banda APK (54) 99999-0000" /></div>
          </div>
        </div>
      </details>
      {erro && <div className="err">{erro}</div>}
      <div className="toolbar" style={{ margin: 0 }}>
        <button className="primary" disabled={busy}>{busy ? "Salvando…" : "Salvar festival"}</button>
        {onCancelar && <button type="button" className="ghost" onClick={onCancelar}>Cancelar</button>}
      </div>
    </form>
  );
}
