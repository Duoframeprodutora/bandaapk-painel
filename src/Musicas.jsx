import React, { useEffect, useState } from "react";
import { sb, plataforma } from "./supabase.js";
import { ir } from "./util.js";
import { periodo } from "./Festivais.jsx";

// Área dos músicos: as músicas dos próximos eventos, na ordem do ensaio, com o tom em destaque
export default function Musicas() {
  const [dados, setDados] = useState(null);
  const [abertos, setAbertos] = useState({});

  useEffect(() => {
    (async () => {
      const hoje = new Date().toISOString().slice(0, 10);
      const { data: fs } = await sb.from("festivais").select("*, dias(*, categorias(*)), inscricoes(*)").order("data_inicio", { ascending: true, nullsFirst: false });
      const vivos = (fs || []).filter((f) => !f.data_inicio || (f.data_fim || f.data_inicio) >= hoje).filter((f) => f.inscricoes.length);
      setDados(vivos);
      if (vivos[0]) setAbertos({ [vivos[0].id]: true });
    })();
  }, []);

  async function ouvir(i) {
    const { data } = await sb.storage.from("audios").createSignedUrl(i.audio_path, 3600);
    if (data) window.open(data.signedUrl, "_blank");
  }

  if (dados === null) return <div className="loading">Carregando…</div>;
  return (
    <section>
      <div className="fest"><div className="eyebrow">Para os músicos</div><h1>Músicas</h1>
        <p>As músicas dos próximos eventos, na ordem do ensaio. Toque no evento para abrir.</p></div>
      {!dados.length && <div className="card empty">Nenhuma música cadastrada nos próximos eventos ainda.</div>}
      {dados.map((f) => {
        const dias = [...f.dias].sort((a, b) => a.ordem - b.ordem);
        const cat = {}; dias.forEach((d) => d.categorias.forEach((c) => (cat[c.id] = { d, c })));
        const grupos = [...dias.map((d) => ({ nome: d.nome, itens: f.inscricoes.filter((i) => cat[i.categoria_id]?.d.id === d.id) })),
          { nome: "Dia a definir", itens: f.inscricoes.filter((i) => !cat[i.categoria_id]) }].filter((g) => g.itens.length);
        return (
          <div key={f.id} className="card" style={{ marginBottom: 12 }}>
            <button className="ghost" style={{ width: "100%", textAlign: "left", border: 0, padding: 16, display: "flex", justifyContent: "space-between", gap: 10 }}
              aria-expanded={!!abertos[f.id]} onClick={() => setAbertos({ ...abertos, [f.id]: !abertos[f.id] })}>
              <span><b style={{ fontSize: 18 }}>{f.nome}</b><br /><span className="hint">{[periodo(f), f.cidade_datas, f.inscricoes.length + " músicas"].filter(Boolean).join(" · ")}</span></span>
              <span aria-hidden="true">{abertos[f.id] ? "▴" : "▾"}</span>
            </button>
            {abertos[f.id] && <div style={{ padding: "0 16px 16px" }}>
              <div className="toolbar" style={{ marginTop: 0 }}><button className="primary btn-sm" onClick={() => ir("/f/" + f.id + "/palco")}>Abrir modo palco</button></div>
              {grupos.map((g) => (
                <div key={g.nome}>
                  <h3 className="mes" style={{ fontSize: 17, margin: "12px 0 6px" }}>{g.nome}</h3>
                  <div className="scroll-x"><table className="tbl"><tbody>
                    {g.itens.sort((a, b) => a.ordem - b.ordem).map((i, k) => (
                      <tr key={i.id}>
                        <td className="num" style={{ color: "var(--muted)" }}>{k + 1}</td>
                        <td><b>{i.musica}</b>{i.versao && <span className="hint"> · {i.versao}</span>}<br /><span className="hint">{i.nome}{cat[i.categoria_id] ? " · " + cat[i.categoria_id].c.nome : ""}</span>
                          {i.observacao && <div className="hint" style={{ whiteSpace: "pre-wrap" }}>Obs: {i.observacao}</div>}</td>
                        <td><span className="tone-big" style={{ fontSize: 16 }}>{i.tom}</span></td>
                        <td>{i.link ? <a className="lnk" href={i.link} target="_blank" rel="noopener">{plataforma(i.link)?.n || "Ouvir"}</a>
                          : i.audio_path && <button className="ghost btn-sm" onClick={() => ouvir(i)}>Áudio</button>}</td>
                      </tr>
                    ))}
                  </tbody></table></div>
                </div>
              ))}
            </div>}
          </div>
        );
      })}
    </section>
  );
}
