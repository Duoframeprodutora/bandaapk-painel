-- Funções internas não podem ser chamadas direto pela API
revoke execute on function public.aviso_problema() from public, anon, authenticated;
revoke execute on function public.novo_usuario() from public, anon, authenticated;
revoke execute on function public.meu_papel() from public, anon;
grant execute on function public.meu_papel() to authenticated;
revoke execute on function public.eh_equipe() from public, anon;
revoke execute on function public.eh_gestor() from public, anon;
revoke execute on function public.eh_master() from public, anon;
grant execute on function public.eh_equipe(), public.eh_gestor(), public.eh_master() to authenticated;
