-- Enable all operations for authenticated users (Temporary allow-all for Admin panel development)
CREATE POLICY "Allow all actions for authenticated users on contabilidades" ON contabilidades FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all actions for authenticated users on clientes" ON clientes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all actions for authenticated users on configuracoes_hub" ON configuracoes_hub FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all actions for authenticated users on faturas" ON faturas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all actions for authenticated users on arquivos_xml" ON arquivos_xml FOR ALL TO authenticated USING (true) WITH CHECK (true);
