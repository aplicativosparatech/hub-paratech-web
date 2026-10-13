-- Adiciona coluna formas_pagamento (JSONB) nas tabelas fiscais para detalhar PIX, Dinheiro, Cartões, Boleto, etc.
ALTER TABLE nfce_saidas ADD COLUMN IF NOT EXISTS formas_pagamento JSONB;
ALTER TABLE nfe_saidas ADD COLUMN IF NOT EXISTS formas_pagamento JSONB;
ALTER TABLE nfe_entradas ADD COLUMN IF NOT EXISTS formas_pagamento JSONB;
