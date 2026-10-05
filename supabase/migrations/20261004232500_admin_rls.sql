CREATE POLICY "Admin All" ON clientes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin All" ON configuracoes_hub FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin All" ON faturas FOR ALL TO authenticated USING (true) WITH CHECK (true);
