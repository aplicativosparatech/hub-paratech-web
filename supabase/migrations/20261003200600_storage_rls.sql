-- Allow authenticated users to upload to logos bucket
CREATE POLICY "Allow authenticated uploads to logos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'logos');

-- Allow public read access to logos
CREATE POLICY "Allow public read logos" ON storage.objects FOR SELECT TO public USING (bucket_id = 'logos');

-- Allow authenticated users to update logos
CREATE POLICY "Allow authenticated update logos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'logos') WITH CHECK (bucket_id = 'logos');

-- Allow authenticated users to delete logos
CREATE POLICY "Allow authenticated delete logos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'logos');

-- Also add RLS policy for perfis table (needed later for login)
CREATE POLICY "Allow all actions for authenticated users on perfis" ON perfis FOR ALL TO authenticated USING (true) WITH CHECK (true);
