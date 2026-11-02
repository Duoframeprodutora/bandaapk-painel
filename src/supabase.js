import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL || "https://dtqsvomrcotzcdmrxkvu.supabase.co";
const key = import.meta.env.VITE_SUPABASE_KEY || "sb_publishable_eUiezAsOuAv_srR9cXjjKA_M-8IeTr4";

export const sb = createClient(url, key);

export const FORM_HOST = "inscricao.bandaapk.com.br";
export const ehFormulario = () =>
  location.hostname.startsWith("inscricao.") || location.pathname.startsWith("/inscricao/");

export function linkInscricao(slug) {
  if (location.hostname.endsWith("bandaapk.com.br")) return "https://" + FORM_HOST + "/" + slug;
  return location.origin + "/inscricao/" + slug;
}

export function erroLegivel(e) {
  const m = (e && (e.message || e.erro)) || String(e || "");
  if (m.includes("Invalid login")) return "E-mail ou senha incorretos.";
  if (m.includes("Email not confirmed")) return "Confirme o seu e-mail pelo link que chegou na caixa de entrada.";
  if (m.includes("Failed to fetch")) return "Sem conexão. Verifique a internet e tente de novo.";
  return m;
}

export function slugify(t) {
  return t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
}

export function plataforma(url) {
  const u = (url || "").toLowerCase().trim();
  if (!u) return null;
  if (/youtu\.?be/.test(u)) return { k: "yt", n: "YouTube", d: "Link do YouTube reconhecido." };
  if (u.includes("spotify")) return { k: "sp", n: "Spotify", d: "Link do Spotify reconhecido." };
  if (u.includes("deezer")) return { k: "dz", n: "Deezer", d: "Link do Deezer reconhecido." };
  if (u.includes("music.apple")) return { k: "", n: "Apple Music", d: "Link do Apple Music reconhecido." };
  if (u.includes("soundcloud")) return { k: "", n: "SoundCloud", d: "Link do SoundCloud reconhecido." };
  if (u.includes("drive.google") || u.includes("dropbox")) return { k: "", n: "Arquivo na nuvem", d: "Confira se o arquivo está liberado para qualquer pessoa com o link." };
  if (/^https?:\/\/\S+\.\S+/.test(u)) return { k: "", n: "Outro link", d: "A banda vai conferir este link." };
  return { k: "bad", n: "Link incompleto", d: "Cole o endereço completo, começando com https://" };
}
