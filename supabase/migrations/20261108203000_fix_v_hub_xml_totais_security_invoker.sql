-- Correção de Segurança do Supabase Advisor (Security Definer View)
-- Ajusta a view v_hub_xml_totais para utilizar SECURITY INVOKER = TRUE
-- garantindo que as políticas de RLS das tabelas base sejam respeitadas.

ALTER VIEW public.v_hub_xml_totais SET (security_invoker = true);

-- Garante as permissões de leitura
GRANT SELECT ON public.v_hub_xml_totais TO authenticated, anon, service_role;
