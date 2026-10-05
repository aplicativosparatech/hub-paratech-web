CREATE TABLE user_roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'cliente', 'contabilidade')),
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    contabilidade_id UUID REFERENCES contabilidades(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own role" ON user_roles
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles" ON user_roles
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur 
            WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
        )
    );

-- Insert the default admin (Assuming paratech@paratech.com.br is the admin)
INSERT INTO user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'paratech@paratech.com.br'
ON CONFLICT (user_id) DO NOTHING;

