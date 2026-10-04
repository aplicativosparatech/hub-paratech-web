-- Permitir que a API do Hub leia dados de forma anônima
CREATE POLICY "Permitir leitura anonima clientes" ON clientes FOR SELECT TO anon USING (true);
CREATE POLICY "Permitir leitura anonima configuracoes" ON configuracoes_hub FOR SELECT TO anon USING (true);
CREATE POLICY "Permitir leitura anonima faturas" ON faturas FOR SELECT TO anon USING (true);
