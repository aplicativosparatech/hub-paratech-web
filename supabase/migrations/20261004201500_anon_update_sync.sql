CREATE POLICY "Permitir Hub atualizar ultima_sincronizacao" 
ON configuracoes_hub 
FOR UPDATE 
TO anon 
USING (true) 
WITH CHECK (true);
