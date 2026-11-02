import React, { useEffect, useState } from "react";
import { sb, plataforma, erroLegivel, linkInscricao } from "./supabase.js";
import { copiar } from "./util.js";


export default function Inscricao() {
  const partes = location.pathname.split("/").filter(Boolean);
  const slug = partes[0] === "inscricao" ? partes[1] : partes[0];
  const token = new URLSearchParams(location.search).get("t");

  const [fest, setFest] = useState(undefined);
  const [passo, setPasso] = useState(1);
  const [d, setD] = useState({ nome: "", whatsapp: "", categoria_id: "", musica: "", versao: "", tom: "", link: "", observacao: "", link_edicao: "" });
  const [fonte, setFonte] = useState("link");
  const [arquivo, setArquivo] = useState(null);
  const [audioAntigo, setAudioAntigo] = useState("");
  const [confirmou, setConfirmou] = useState(false);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [pronto, setPronto] = useState(null);

  useEffect(() => {
    if (!slug) { setFest(null); return; }
    sb.rpc("festival_publico", { p_slug: slug }).then(({ data }) => setFest(data || null));
    if (token) sb.rpc("minha_inscricao", { p_token: token }).then(({ data }) => {
      if (!data) return;
      setD({ ...d, ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v ?? ""])) });
      if (data.audio_path && !data.link) { setFonte("audio"); setAudioAntigo(data.audio_path); }
    });
  }, []);

  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });

  if (fest === undefined) return <div className="loading">Carregando…</div>;
  if (!fest) return (
    <Moldura><div className="card done"><h2>Link de inscrição não encontrado</h2>
      <p>Confira se o link está completo. Se continuar assim, fale com a organização do festival.</p></div></Moldura>
  );
  if (!fest.abertas) return (
    <Moldura fest={fest}><div className="card done"><h2>Inscrições encerradas</h2>
      <p>As inscrições de música para este festival já foram fechadas. Em caso de dúvida, fale com a organização.</p></div></Moldura>
  );

  const opcao = fest.opcoes.find((o) => o.categoria_id === d.categoria_id);
  const PASSOS = fest.opcoes.length ? [1, 2, 3, 4, 5, 6, 7] : [1, 3, 4, 5, 6, 7];
  const TOTAL = PASSOS.length, pos = PASSOS.indexOf(passo) + 1, ULTIMO = 7;

  function erroDoPasso(n) {
    if (n === 1 && !d.nome.trim()) return "Escreva o seu nome para continuar.";
    if (n === 1 && d.whatsapp.replace(/\D/g, "").length < 10) return "Escreva o seu WhatsApp com DDD.";
    if (n === 2 && !d.categoria_id) return "Toque no dia e na categoria em que você vai cantar.";
    if (n === 3 && !d.musica.trim()) return "Escreva o nome da música.";
    if (n === 3 && !d.versao.trim()) return "Escreva de quem é a versão que você ensaiou.";
    if (n === 4 && !d.tom.trim()) return "Escreva o tom da música para continuar.";
    if (n === 5) {
      if (fonte === "link") { const p = plataforma(d.link); if (!p || p.k === "bad") return "Cole o link da música, ou toque em Tenho um áudio."; }
      else if (!arquivo && !audioAntigo) return "Escolha o arquivo de áudio no seu celular.";
    }
    return "";
  }
  function avancar(delta) {
    if (delta > 0) { const m = erroDoPasso(passo); if (m) return setErro(m); }
    setErro(""); setPasso(PASSOS[Math.min(TOTAL - 1, Math.max(0, pos - 1 + delta))]); window.scrollTo({ top: 0 });
  }

  async function enviar(e) {
    e.preventDefault();
    if (passo < ULTIMO) return avancar(1);
    if (!confirmou) return setErro("Marque o quadradinho confirmando que esta é a versão que você vai cantar.");
    setEnviando(true); setErro("");
    try {
      let audio_path = fonte === "audio" ? audioAntigo : "";
      if (fonte === "audio" && arquivo) {
        const ext = (arquivo.name.split(".").pop() || "mp3").toLowerCase().replace(/[^a-z0-9]/g, "");
        audio_path = slug + "/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + "." + ext;
        const up = await sb.storage.from("audios").upload(audio_path, arquivo, { contentType: arquivo.type || "audio/mpeg" });
        if (up.error) throw new Error("Não foi possível enviar o áudio. Confira se é um arquivo de áudio com até 30 MB.");
      }
      const { data, error } = await sb.rpc("enviar_inscricao", {
        p_slug: slug, p_categoria: d.categoria_id || null, p_nome: d.nome, p_whatsapp: d.whatsapp, p_musica: d.musica,
        p_versao: d.versao, p_tom: d.tom, p_link: fonte === "link" ? d.link : "", p_audio_path: audio_path,
        p_observacao: d.observacao, p_link_edicao: d.link_edicao, p_token: token || null,
      });
      if (error) throw error;
      setPronto(linkInscricao(slug) + "?t=" + data);
    } catch (err) { setErro(erroLegivel(err)); }
    setEnviando(false);
  }

  if (pronto) return (
    <Moldura fest={fest}>
      <div className="card done">
        <h2>{token ? "Inscrição atualizada" : "Inscrição recebida"}</h2>
        <p><b>{d.nome}</b>, sua música <b>{d.musica}</b> ({d.versao}, tom {d.tom}) está registrada{opcao ? " para " + opcao.dia + " · " + opcao.categoria : ""}.</p>
        <p className="hint">Se precisar corrigir alguma coisa até o prazo, use este link. Guarde ele:</p>
        <code>{pronto}</code>
        <button className="primary big" onClick={() => copiar(pronto, "Link copiado")}>Copiar meu link</button>
      </div>
    </Moldura>
  );

  return (
    <Moldura fest={fest}>
      <form className="card form-cand" id="form" onSubmit={enviar} noValidate style={{ padding: 18, display: "grid", gap: 18 }}>
        {token && <div className="obs" style={{ background: "var(--tone-soft)" }}>Você está corrigindo a sua inscrição.</div>}
        <div className="prog"><div className="prog-txt">Passo {pos} de {TOTAL}</div><div className="prog-bar"><span style={{ width: Math.round(pos / TOTAL * 100) + "%" }} /></div></div>

        {passo === 1 && <div className="step">
          <label className="q" htmlFor="f-nome">Qual é o seu nome?</label>
          <input type="text" id="f-nome" value={d.nome} onChange={set("nome")} autoComplete="name" placeholder="Seu nome completo" />
          <label className="q2" htmlFor="f-zap">Seu WhatsApp</label>
          <input type="tel" id="f-zap" value={d.whatsapp} onChange={set("whatsapp")} inputMode="tel" placeholder="(54) 99999-0000" />
          <span className="hint">A banda só usa para falar com você se tiver alguma dúvida na música.</span>
        </div>}

        {passo === 2 && <div className="step">
          <span className="q">Em qual dia e categoria você vai cantar?</span>
          <div className="bigchoices" role="group" aria-label="Dia e categoria">
            {fest.opcoes.map((o) => (
              <button type="button" key={o.categoria_id} className="bigchoice" aria-pressed={d.categoria_id === o.categoria_id}
                onClick={() => setD({ ...d, categoria_id: o.categoria_id })}>
                <b>{o.categoria}</b><span>{o.dia}</span>
              </button>
            ))}
          </div>
        </div>}

        {passo === 3 && <div className="step">
          <label className="q" htmlFor="f-musica">Qual música você vai cantar?</label>
          <input type="text" id="f-musica" value={d.musica} onChange={set("musica")} placeholder="Ex.: Evidências" />
          <label className="q2" htmlFor="f-versao">De quem é a versão que você ensaiou?</label>
          <input type="text" id="f-versao" value={d.versao} onChange={set("versao")} placeholder="Ex.: Chitãozinho e Xororó" />
          <span className="hint">Muitas músicas têm várias versões. Diga o cantor da gravação que você usou para ensaiar.</span>
        </div>}

        {passo === 4 && <div className="step">
          <label className="q" htmlFor="f-tom">Qual é o tom?</label>
          <input type="text" id="f-tom" value={d.tom} onChange={set("tom")} placeholder="Ex.: C, sobe para Eb no final" />
          <span className="hint">Escreva do seu jeito. Se a música muda de tom no meio, conte em que parte.</span>
        </div>}

        {passo === 5 && <div className="step">
          <span className="q">Mande a música do jeito que você ensaiou</span>
          <div className="bigchoices">
            <button type="button" className="bigchoice" aria-pressed={fonte === "link"} onClick={() => setFonte("link")}><b>Tenho um link</b><span>YouTube, Spotify ou outro</span></button>
            <button type="button" className="bigchoice" aria-pressed={fonte === "audio"} onClick={() => setFonte("audio")}><b>Tenho um áudio</b><span>Arquivo de áudio pronto</span></button>
          </div>
          {fonte === "link" ? <>
            <label className="q2" htmlFor="f-link">Cole o link aqui</label>
            <input type="url" id="f-link" value={d.link || ""} onChange={set("link")} inputMode="url" placeholder="Toque e segure para colar" />
            {plataforma(d.link) && <div className="platform"><span className={"pbadge " + plataforma(d.link).k}>{plataforma(d.link).n}</span><span>{plataforma(d.link).d}</span></div>}
          </> : <>
            <label className="dropzone" htmlFor="f-file">
              <b>Toque aqui para escolher o áudio</b>
              <span className="hint">{arquivo ? "Selecionado: " + arquivo.name : audioAntigo ? "Já existe um áudio enviado. Escolha outro só se quiser trocar." : "MP3, M4A, WAV ou áudio do WhatsApp, até 30 MB"}</span>
            </label>
            <input type="file" id="f-file" accept="audio/*" hidden onChange={(e) => setArquivo(e.target.files[0] || null)} />
          </>}
        </div>}

        {passo === 6 && <div className="step">
          <label className="q" htmlFor="f-obs">Quer avisar a banda de alguma coisa?</label>
          <textarea id="f-obs" value={d.observacao} onChange={set("observacao")} placeholder="Ex.: Sem o solo do meio. Repetir o último refrão." />
          <label className="q2" htmlFor="f-edit">Link da sua edição (se tiver)</label>
          <input type="url" id="f-edit" value={d.link_edicao} onChange={set("link_edicao")} placeholder="Pode deixar em branco" />
          <span className="hint">Este passo é opcional. Se não tiver nada, é só tocar em Continuar.</span>
        </div>}

        {passo === 7 && <div className="step">
          <span className="q">Confira se está tudo certo</span>
          <dl className="review">
            {[["Nome", d.nome], ["WhatsApp", d.whatsapp], ...(opcao ? [["Dia", opcao.dia + " · " + opcao.categoria]] : []), ["Música", d.musica], ["Versão", d.versao], ["Tom", d.tom],
              ["Música enviada", fonte === "link" ? d.link : (arquivo ? arquivo.name : "Áudio já enviado")], ["Avisos", d.observacao || "Nenhum"]].map(([k, v]) => (
              <React.Fragment key={k}><dt>{k}</dt><dd>{v}</dd></React.Fragment>
            ))}
          </dl>
          <label className="confirm" htmlFor="f-ok">
            <input type="checkbox" id="f-ok" checked={confirmou} onChange={(e) => setConfirmou(e.target.checked)} />
            <span><b>Sim, esta é exatamente a versão que vou cantar.</b></span>
          </label>
        </div>}

        {erro && <div className="err" role="alert">{erro}</div>}
        <div className="stepnav">
          <button className="ghost big" type="button" onClick={() => avancar(-1)} style={{ visibility: passo === 1 ? "hidden" : "visible" }}>Voltar</button>
          {passo < ULTIMO
            ? <button className="primary big" type="button" onClick={() => avancar(1)}>Continuar</button>
            : <button className="primary big" type="submit" disabled={enviando}>{enviando ? "Enviando…" : token ? "Salvar correção" : "Enviar inscrição"}</button>}
        </div>
        {fest.contato_ajuda && <p className="hint" style={{ textAlign: "center", margin: 0 }}>Precisa de ajuda? Fale com <b>{fest.contato_ajuda}</b></p>}
      </form>
    </Moldura>
  );
}

function Moldura({ fest, children }) {
  return (
    <>
      <header className="top"><div className="wrap"><div className="brand">Banda <span>APK</span></div></div></header>
      <main className="wrap">
        {fest && <div className="fest">
          <div className="eyebrow">Inscrição de música · Banda de apoio</div>
          <h1>{fest.nome}</h1>
          <p>{[fest.cidade_datas, fest.prazo && "inscrições até " + fest.prazo].filter(Boolean).join(" · ")}</p>
        </div>}
        {children}
      </main>
    </>
  );
}
