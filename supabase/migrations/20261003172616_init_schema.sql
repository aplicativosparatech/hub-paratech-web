-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Definição de Papéis (Roles)
CREATE TYPE tipo_usuario AS ENUM ('super_admin', 'contabilidade', 'cliente');

-- 2. Tabela de Contabilidades
CREATE TABLE contabilidades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    razao_social TEXT NOT NULL,
    cnpj TEXT UNIQUE,
    email_contato TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabela de Clientes (Empresas)
CREATE TABLE clientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contabilidade_id UUID REFERENCES contabilidades(id) ON DELETE SET NULL,
    razao_social TEXT NOT NULL,
    nome_fantasia TEXT,
    cnpj TEXT UNIQUE,
    nome_sistema_utilizado TEXT,
    
    -- Controle de Integração / Hub
    hub_token UUID DEFAULT uuid_generate_v4() UNIQUE,
    is_ativo BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabela de Perfis de Usuários (Login)
CREATE TABLE perfis (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role tipo_usuario NOT NULL,
    contabilidade_id UUID REFERENCES contabilidades(id),
    cliente_id UUID REFERENCES clientes(id),
    nome TEXT
);

-- 5. Configurações do Hub (Regras e Bloqueios)
CREATE TABLE configuracoes_hub (
    cliente_id UUID PRIMARY KEY REFERENCES clientes(id) ON DELETE CASCADE,
    
    -- Configuração de Pastas e EXEs
    pastas_vendas JSONB DEFAULT '[]'::jsonb,
    pastas_compras JSONB DEFAULT '[]'::jsonb,
    exes_monitorados JSONB DEFAULT '[]'::jsonb,
    
    -- Configuração Financeira (Cobrança)
    dia_vencimento INTEGER NOT NULL,
    valor_mensalidade NUMERIC(10,2) NOT NULL,
    dias_aviso_previo INTEGER DEFAULT 7,
    dias_tolerancia_bloqueio INTEGER DEFAULT 3,
    mensagem_bloqueio TEXT DEFAULT 'SISTEMA BLOQUEADO. Por favor, regularize seu pagamento.',
    
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Faturas (Controle de Pagamentos)
CREATE TABLE faturas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    
    competencia TEXT NOT NULL,
    data_vencimento DATE NOT NULL,
    valor NUMERIC(10,2) NOT NULL,
    
    status TEXT CHECK (status IN ('pendente', 'pago', 'cancelado')) DEFAULT 'pendente',
    
    -- Dados da InfinitePay
    infinitepay_txid TEXT,
    qr_code_payload TEXT,
    
    data_pagamento TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Arquivos XML (O Sincronizador)
CREATE TABLE arquivos_xml (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    
    tipo TEXT CHECK (tipo IN ('venda', 'compra')),
    nome_arquivo TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    
    chave_acesso TEXT,
    data_emissao_xml DATE,
    tamanho_bytes INTEGER,
    
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Set up Row Level Security (RLS) Basics

-- Enable RLS on all tables
ALTER TABLE contabilidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracoes_hub ENABLE ROW LEVEL SECURITY;
ALTER TABLE faturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE arquivos_xml ENABLE ROW LEVEL SECURITY;

-- Super Admin can do everything (Example basic policy)
-- In a real app we would check if auth.uid() is in perfis with role 'super_admin'
-- For now we leave it simple or add specific functions later.
