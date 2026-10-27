-- Habilita a extensão pgvector para buscas vetoriais e RAG de alta performance
CREATE EXTENSION IF NOT EXISTS vector;

-- Tabela de Base de Conhecimento e Embeddings do Robotech IA
CREATE TABLE IF NOT EXISTS public.robotech_conhecimento_vetorial (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT NULL,
    categoria TEXT NOT NULL, -- 'reforma_tributaria', 'monofasicos', 'simples_nacional', 'sefaz_rejeicoes', 'sistemas_paratech'
    conteudo TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    embedding vector(768), -- Dimensão padrão do Gemini text-embedding-004
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para buscas rápidas por texto e categoria
CREATE INDEX IF NOT EXISTS idx_robotech_categoria ON public.robotech_conhecimento_vetorial(categoria);

-- Função RPC para buscar artigos por similaridade de cosseno via pgvector
CREATE OR REPLACE FUNCTION public.match_conhecimento_fiscal(
    query_embedding vector(768),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 3
)
RETURNS TABLE (
    id UUID,
    titulo TEXT,
    categoria TEXT,
    conteudo TEXT,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        conhecimento.id,
        conhecimento.titulo,
        conhecimento.categoria,
        conhecimento.conteudo,
        1 - (conhecimento.embedding <=> query_embedding) AS similarity
    FROM public.robotech_conhecimento_vetorial AS conhecimento
    WHERE 1 - (conhecimento.embedding <=> query_embedding) > match_threshold
    ORDER BY conhecimento.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
