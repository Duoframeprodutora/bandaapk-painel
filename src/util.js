import { useEffect, useState } from "react";

// Roteador mínimo baseado no endereço da página
export function usePath() {
  const [path, setPath] = useState(location.pathname + location.search);
  useEffect(() => {
    const on = () => setPath(location.pathname + location.search);
    window.addEventListener("popstate", on);
    window.addEventListener("navegar", on);
    return () => { window.removeEventListener("popstate", on); window.removeEventListener("navegar", on); };
  }, []);
  return path;
}

export function ir(path) {
  history.pushState(null, "", path);
  window.dispatchEvent(new Event("navegar"));
  window.scrollTo({ top: 0 });
}

let toastTimer;
export function toast(msg) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast"; el.className = "toast"; el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 2600);
}

export async function copiar(texto, msg = "Copiado") {
  try { await navigator.clipboard.writeText(texto); toast(msg); }
  catch {
    const ta = document.createElement("textarea"); ta.value = texto; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); toast(msg); } catch { toast("Não foi possível copiar. Selecione o texto e copie."); }
    ta.remove();
  }
}

export const quando = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};
