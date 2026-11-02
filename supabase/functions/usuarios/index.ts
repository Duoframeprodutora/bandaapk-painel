// Cria e gerencia logins da banda. Só o Master pode chamar.
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const { data: u } = await admin.auth.getUser(token);
  if (!u?.user) return json({ erro: "Faça login de novo." }, 401);
  const { data: eu } = await admin.from("perfis").select("papel").eq("id", u.user.id).single();
  if (eu?.papel !== "master") return json({ erro: "Só o Master pode gerenciar usuários." }, 403);

  const body = await req.json().catch(() => ({}));
  const papeis = ["master", "vendas", "musico"];

  if (body.acao === "criar") {
    const email = String(body.email || "").trim().toLowerCase();
    const senha = String(body.senha || "");
    const nome = String(body.nome || "").trim();
    if (!email || senha.length < 6 || !nome) return json({ erro: "Preencha nome, e-mail e uma senha com pelo menos 6 caracteres." }, 400);
    if (!papeis.includes(body.papel)) return json({ erro: "Escolha o perfil." }, 400);
    const { data, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true, user_metadata: { nome } });
    if (error) return json({ erro: error.message.includes("already") ? "Esse e-mail já tem login." : error.message }, 400);
    await admin.from("perfis").update({ nome, papel: body.papel, funcao: String(body.funcao || "") }).eq("id", data.user.id);
    return json({ ok: true });
  }

  if (body.acao === "senha") {
    const senha = String(body.senha || "");
    if (senha.length < 6) return json({ erro: "A senha precisa ter pelo menos 6 caracteres." }, 400);
    const { error } = await admin.auth.admin.updateUserById(String(body.id), { password: senha });
    if (error) return json({ erro: error.message }, 400);
    return json({ ok: true });
  }

  if (body.acao === "remover") {
    if (body.id === u.user.id) return json({ erro: "Você não pode remover o seu próprio login." }, 400);
    const { error } = await admin.auth.admin.deleteUser(String(body.id));
    if (error) return json({ erro: error.message }, 400);
    return json({ ok: true });
  }

  if (body.acao === "listar") {
    const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
    return json({ emails: Object.fromEntries((data?.users || []).map((x) => [x.id, x.email])) });
  }

  return json({ erro: "Ação inválida." }, 400);
});
