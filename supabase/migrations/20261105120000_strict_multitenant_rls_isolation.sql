-- ==============================================================================
-- BLINDAGEM MULTI-TENANT E ISOLAMENTO RIGOROSO DE DADOS ENTRE CONTABILIDADES E CLIENTES
-- ==============================================================================

-- 1. Funções Auxiliares de Identificação do Usuário Logado (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.auth_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_get_user_contabilidade_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT contabilidade_id FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'contabilidade'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.auth_get_user_cliente_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT cliente_id FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'cliente'
  LIMIT 1;
$$;

-- Função que retorna a lista de IDs de clientes aos quais o usuário autenticado tem permissão estrita
CREATE OR REPLACE FUNCTION public.auth_get_allowed_client_ids()
RETURNS TABLE (allowed_id UUID)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id FROM public.clientes
  WHERE (
    public.auth_is_admin()
    OR (public.auth_get_user_contabilidade_id() IS NOT NULL AND contabilidade_id = public.auth_get_user_contabilidade_id())
    OR (public.auth_get_user_cliente_id() IS NOT NULL AND id = public.auth_get_user_cliente_id())
  );
$$;

-- 2. TABELA CLIENTES: Remoção de políticas permissivas legadas
DROP POLICY IF EXISTS "Allow all actions for authenticated users on clientes" ON public.clientes;
DROP POLICY IF EXISTS "Permitir leitura anonima clientes" ON public.clientes;
DROP POLICY IF EXISTS "Admin All" ON public.clientes;
DROP POLICY IF EXISTS "Clientes isolation policy" ON public.clientes;
DROP POLICY IF EXISTS "clientes_select_policy" ON public.clientes;
DROP POLICY IF EXISTS "clientes_insert_policy" ON public.clientes;
DROP POLICY IF EXISTS "clientes_update_policy" ON public.clientes;
DROP POLICY IF EXISTS "clientes_delete_policy" ON public.clientes;

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clientes_select_policy" ON public.clientes
FOR SELECT TO authenticated
USING (
  public.auth_is_admin()
  OR (
    public.auth_get_user_contabilidade_id() IS NOT NULL 
    AND contabilidade_id = public.auth_get_user_contabilidade_id()
  )
  OR (
    public.auth_get_user_cliente_id() IS NOT NULL 
    AND id = public.auth_get_user_cliente_id()
  )
);

CREATE POLICY "clientes_insert_policy" ON public.clientes
FOR INSERT TO authenticated
WITH CHECK (
  public.auth_is_admin()
  OR (
    public.auth_get_user_contabilidade_id() IS NOT NULL 
    AND contabilidade_id = public.auth_get_user_contabilidade_id()
  )
);

CREATE POLICY "clientes_update_policy" ON public.clientes
FOR UPDATE TO authenticated
USING (
  public.auth_is_admin()
  OR (
    public.auth_get_user_contabilidade_id() IS NOT NULL 
    AND contabilidade_id = public.auth_get_user_contabilidade_id()
  )
  OR (
    public.auth_get_user_cliente_id() IS NOT NULL 
    AND id = public.auth_get_user_cliente_id()
  )
)
WITH CHECK (
  public.auth_is_admin()
  OR (
    public.auth_get_user_contabilidade_id() IS NOT NULL 
    AND contabilidade_id = public.auth_get_user_contabilidade_id()
  )
  OR (
    public.auth_get_user_cliente_id() IS NOT NULL 
    AND id = public.auth_get_user_cliente_id()
  )
);

CREATE POLICY "clientes_delete_policy" ON public.clientes
FOR DELETE TO authenticated
USING (
  public.auth_is_admin()
  OR (
    public.auth_get_user_contabilidade_id() IS NOT NULL 
    AND contabilidade_id = public.auth_get_user_contabilidade_id()
  )
);

-- 3. TABELA CONTABILIDADES: Remoção de políticas permissivas legadas
DROP POLICY IF EXISTS "Allow all actions for authenticated users on contabilidades" ON public.contabilidades;
DROP POLICY IF EXISTS "contabilidades_select_policy" ON public.contabilidades;
DROP POLICY IF EXISTS "contabilidades_modify_policy" ON public.contabilidades;

ALTER TABLE public.contabilidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contabilidades_select_policy" ON public.contabilidades
FOR SELECT TO authenticated
USING (
  public.auth_is_admin()
  OR (
    public.auth_get_user_contabilidade_id() IS NOT NULL 
    AND id = public.auth_get_user_contabilidade_id()
  )
  OR (
    public.auth_get_user_cliente_id() IS NOT NULL 
    AND id IN (
      SELECT c.contabilidade_id FROM public.clientes c 
      WHERE c.id = public.auth_get_user_cliente_id()
    )
  )
);

CREATE POLICY "contabilidades_modify_policy" ON public.contabilidades
FOR ALL TO authenticated
USING (
  public.auth_is_admin()
  OR (
    public.auth_get_user_contabilidade_id() IS NOT NULL 
    AND id = public.auth_get_user_contabilidade_id()
  )
)
WITH CHECK (
  public.auth_is_admin()
  OR (
    public.auth_get_user_contabilidade_id() IS NOT NULL 
    AND id = public.auth_get_user_contabilidade_id()
  )
);

-- 4. TABELA FATURAS
DROP POLICY IF EXISTS "Allow all actions for authenticated users on faturas" ON public.faturas;
DROP POLICY IF EXISTS "Permitir leitura anonima faturas" ON public.faturas;
DROP POLICY IF EXISTS "Admin All" ON public.faturas;
DROP POLICY IF EXISTS "faturas_select_policy" ON public.faturas;
DROP POLICY IF EXISTS "faturas_modify_policy" ON public.faturas;

ALTER TABLE public.faturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "faturas_select_policy" ON public.faturas
FOR SELECT TO authenticated
USING (
  public.auth_is_admin()
  OR cliente_id IN (SELECT allowed_id FROM public.auth_get_allowed_client_ids())
);

CREATE POLICY "faturas_modify_policy" ON public.faturas
FOR ALL TO authenticated
USING (
  public.auth_is_admin()
  OR cliente_id IN (SELECT allowed_id FROM public.auth_get_allowed_client_ids())
)
WITH CHECK (
  public.auth_is_admin()
  OR cliente_id IN (SELECT allowed_id FROM public.auth_get_allowed_client_ids())
);

-- 5. TABELA CONFIGURACOES_HUB
DROP POLICY IF EXISTS "Allow all actions for authenticated users on configuracoes_hub" ON public.configuracoes_hub;
DROP POLICY IF EXISTS "Permitir leitura anonima configuracoes" ON public.configuracoes_hub;
DROP POLICY IF EXISTS "Admin All" ON public.configuracoes_hub;
DROP POLICY IF EXISTS "configuracoes_hub_select_policy" ON public.configuracoes_hub;
DROP POLICY IF EXISTS "configuracoes_hub_modify_policy" ON public.configuracoes_hub;

ALTER TABLE public.configuracoes_hub ENABLE ROW LEVEL SECURITY;

CREATE POLICY "configuracoes_hub_select_policy" ON public.configuracoes_hub
FOR SELECT TO authenticated
USING (
  public.auth_is_admin()
  OR cliente_id IN (SELECT allowed_id FROM public.auth_get_allowed_client_ids())
);

CREATE POLICY "configuracoes_hub_modify_policy" ON public.configuracoes_hub
FOR ALL TO authenticated
USING (
  public.auth_is_admin()
  OR cliente_id IN (SELECT allowed_id FROM public.auth_get_allowed_client_ids())
)
WITH CHECK (
  public.auth_is_admin()
  OR cliente_id IN (SELECT allowed_id FROM public.auth_get_allowed_client_ids())
);

-- 6. TABELA ARQUIVOS_XML
DROP POLICY IF EXISTS "Allow all actions for authenticated users on arquivos_xml" ON public.arquivos_xml;
DROP POLICY IF EXISTS "arquivos_xml_select_policy" ON public.arquivos_xml;
DROP POLICY IF EXISTS "arquivos_xml_modify_policy" ON public.arquivos_xml;

ALTER TABLE public.arquivos_xml ENABLE ROW LEVEL SECURITY;

CREATE POLICY "arquivos_xml_select_policy" ON public.arquivos_xml
FOR SELECT TO authenticated
USING (
  public.auth_is_admin()
  OR cliente_id IN (SELECT allowed_id FROM public.auth_get_allowed_client_ids())
);

CREATE POLICY "arquivos_xml_modify_policy" ON public.arquivos_xml
FOR ALL TO authenticated
USING (
  public.auth_is_admin()
  OR cliente_id IN (SELECT allowed_id FROM public.auth_get_allowed_client_ids())
)
WITH CHECK (
  public.auth_is_admin()
  OR cliente_id IN (SELECT allowed_id FROM public.auth_get_allowed_client_ids())
);

-- 7. TABELAS NOTAS FISCAIS (nfe_saidas, nfe_entradas, nfce_saidas)
ALTER TABLE public.nfe_saidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfe_entradas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfce_saidas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nfe_saidas_select_policy" ON public.nfe_saidas;
DROP POLICY IF EXISTS "nfe_saidas_modify_policy" ON public.nfe_saidas;
CREATE POLICY "nfe_saidas_select_policy" ON public.nfe_saidas
FOR SELECT TO authenticated
USING (
  public.auth_is_admin()
  OR cliente_id IN (SELECT allowed_id FROM public.auth_get_allowed_client_ids())
);
CREATE POLICY "nfe_saidas_modify_policy" ON public.nfe_saidas
FOR ALL TO authenticated
USING (
  public.auth_is_admin()
  OR cliente_id IN (SELECT allowed_id FROM public.auth_get_allowed_client_ids())
)
WITH CHECK (
  public.auth_is_admin()
  OR cliente_id IN (SELECT allowed_id FROM public.auth_get_allowed_client_ids())
);

DROP POLICY IF EXISTS "nfe_entradas_select_policy" ON public.nfe_entradas;
DROP POLICY IF EXISTS "nfe_entradas_modify_policy" ON public.nfe_entradas;
CREATE POLICY "nfe_entradas_select_policy" ON public.nfe_entradas
FOR SELECT TO authenticated
USING (
  public.auth_is_admin()
  OR cliente_id IN (SELECT allowed_id FROM public.auth_get_allowed_client_ids())
);
CREATE POLICY "nfe_entradas_modify_policy" ON public.nfe_entradas
FOR ALL TO authenticated
USING (
  public.auth_is_admin()
  OR cliente_id IN (SELECT allowed_id FROM public.auth_get_allowed_client_ids())
)
WITH CHECK (
  public.auth_is_admin()
  OR cliente_id IN (SELECT allowed_id FROM public.auth_get_allowed_client_ids())
);

DROP POLICY IF EXISTS "nfce_saidas_select_policy" ON public.nfce_saidas;
DROP POLICY IF EXISTS "nfce_saidas_modify_policy" ON public.nfce_saidas;
CREATE POLICY "nfce_saidas_select_policy" ON public.nfce_saidas
FOR SELECT TO authenticated
USING (
  public.auth_is_admin()
  OR cliente_id IN (SELECT allowed_id FROM public.auth_get_allowed_client_ids())
);
CREATE POLICY "nfce_saidas_modify_policy" ON public.nfce_saidas
FOR ALL TO authenticated
USING (
  public.auth_is_admin()
  OR cliente_id IN (SELECT allowed_id FROM public.auth_get_allowed_client_ids())
)
WITH CHECK (
  public.auth_is_admin()
  OR cliente_id IN (SELECT allowed_id FROM public.auth_get_allowed_client_ids())
);

-- 8. TABELAS DE DISTRIBUIÇÃO DF-E (dfe_notas_destinadas, dfe_consultas_salvas)
DROP POLICY IF EXISTS "dfe_notas_destinadas_auth_select" ON public.dfe_notas_destinadas;
DROP POLICY IF EXISTS "dfe_notas_destinadas_auth_all" ON public.dfe_notas_destinadas;
DROP POLICY IF EXISTS "dfe_notas_destinadas_select_policy" ON public.dfe_notas_destinadas;
DROP POLICY IF EXISTS "dfe_notas_destinadas_modify_policy" ON public.dfe_notas_destinadas;

ALTER TABLE public.dfe_notas_destinadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dfe_notas_destinadas_select_policy" ON public.dfe_notas_destinadas
FOR SELECT TO authenticated
USING (
  public.auth_is_admin()
  OR cliente_id IN (SELECT allowed_id FROM public.auth_get_allowed_client_ids())
);

CREATE POLICY "dfe_notas_destinadas_modify_policy" ON public.dfe_notas_destinadas
FOR ALL TO authenticated
USING (
  public.auth_is_admin()
  OR cliente_id IN (SELECT allowed_id FROM public.auth_get_allowed_client_ids())
)
WITH CHECK (
  public.auth_is_admin()
  OR cliente_id IN (SELECT allowed_id FROM public.auth_get_allowed_client_ids())
);

DROP POLICY IF EXISTS "dfe_consultas_salvas_auth_select" ON public.dfe_consultas_salvas;
DROP POLICY IF EXISTS "dfe_consultas_salvas_auth_all" ON public.dfe_consultas_salvas;
DROP POLICY IF EXISTS "dfe_consultas_salvas_select_policy" ON public.dfe_consultas_salvas;
DROP POLICY IF EXISTS "dfe_consultas_salvas_modify_policy" ON public.dfe_consultas_salvas;

ALTER TABLE public.dfe_consultas_salvas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dfe_consultas_salvas_select_policy" ON public.dfe_consultas_salvas
FOR SELECT TO authenticated
USING (
  public.auth_is_admin()
  OR cliente_id IN (SELECT allowed_id FROM public.auth_get_allowed_client_ids())
);

CREATE POLICY "dfe_consultas_salvas_modify_policy" ON public.dfe_consultas_salvas
FOR ALL TO authenticated
USING (
  public.auth_is_admin()
  OR cliente_id IN (SELECT allowed_id FROM public.auth_get_allowed_client_ids())
)
WITH CHECK (
  public.auth_is_admin()
  OR cliente_id IN (SELECT allowed_id FROM public.auth_get_allowed_client_ids())
);

-- 9. TABELA INUTILIZACOES_SAIDAS
DROP POLICY IF EXISTS "Acesso irrestrito a inutilizacoes_saidas para usuarios autenticados" ON public.inutilizacoes_saidas;
DROP POLICY IF EXISTS "inutilizacoes_saidas_select_policy" ON public.inutilizacoes_saidas;
DROP POLICY IF EXISTS "inutilizacoes_saidas_modify_policy" ON public.inutilizacoes_saidas;

ALTER TABLE public.inutilizacoes_saidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inutilizacoes_saidas_select_policy" ON public.inutilizacoes_saidas
FOR SELECT TO authenticated
USING (
  public.auth_is_admin()
  OR cliente_id IN (SELECT allowed_id FROM public.auth_get_allowed_client_ids())
);

CREATE POLICY "inutilizacoes_saidas_modify_policy" ON public.inutilizacoes_saidas
FOR ALL TO authenticated
USING (
  public.auth_is_admin()
  OR cliente_id IN (SELECT allowed_id FROM public.auth_get_allowed_client_ids())
)
WITH CHECK (
  public.auth_is_admin()
  OR cliente_id IN (SELECT allowed_id FROM public.auth_get_allowed_client_ids())
);
