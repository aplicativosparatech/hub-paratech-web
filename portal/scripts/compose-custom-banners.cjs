const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const brainDir = 'C:/Users/Paratech/.gemini/antigravity/brain/969c8710-1ae2-4717-b1cb-0cb850cfe8e5';
const outputDir = path.join(__dirname, '../public/banners');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Banner final com +30% de altura (de 75px para 98px)
const TARGET_WIDTH = 1280;
const TARGET_HEIGHT = 98;

const bannerConfigs = [
  {
    slug: 'contabilidades',
    aiFilePattern: 'contabilidades_banner',
    title: 'CONTABILIDADE',
    motto: 'ORGANIZAÇÃO • SEGURANÇA • RESULTADOS',
    icon1: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
    icon2: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>'
  },
  {
    slug: 'clientes',
    aiFilePattern: 'clientes_banner',
    title: 'GESTÃO DE CLIENTES',
    motto: 'EMPRESAS • CADASTROS • CERTIFICADOS A1',
    icon1: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    icon2: '<rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="9" y1="22" x2="9" y2="2"/>'
  },
  {
    slug: 'notas-fiscais',
    aiFilePattern: 'notas_fiscais_banner',
    title: 'DOCUMENTOS FISCAIS',
    motto: 'NF-E • NFC-E • SINCRONIZAÇÃO SEFAZ EM TEMPO REAL',
    icon1: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="m9 15 2 2 4-4"/>',
    icon2: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>'
  },
  {
    slug: 'corretor-tributario',
    aiFilePattern: 'corretor_tributario_banner',
    title: 'CORRETOR TRIBUTÁRIO',
    motto: 'AUDITORIA DE XMLS • REFORMA IBS & CBS • MULTI-IA',
    icon1: '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>',
    icon2: '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/>'
  },
  {
    slug: 'saneador-arquivos',
    aiFilePattern: 'saneador_arquivos_banner',
    title: 'SANEADOR DE ARQUIVOS',
    motto: 'BANCOS DE DADOS • PLANILHAS • SQL • ESTOQUE FISCAL',
    icon1: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>',
    icon2: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13h2"/><path d="M8 17h2"/><path d="M14 13h2"/><path d="M14 17h2"/>'
  },
  {
    slug: 'sugestor-tributario',
    aiFilePattern: 'sugestor_tributario_banner',
    title: 'SUGESTOR TRIBUTÁRIO',
    motto: 'CLASSIFICAÇÃO FISCAL • OCR DE PRODUTOS • NCM & REFORMA',
    icon1: '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>',
    icon2: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>'
  },
  {
    slug: 'faturas',
    aiFilePattern: 'faturas_banner',
    title: 'FATURAMENTO & RECORRÊNCIA',
    motto: 'MENSALIDADES • PIX AUTOMATIZADO • COBRANÇAS',
    icon1: '<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>',
    icon2: '<line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'
  },
  {
    slug: 'relatorios',
    aiFilePattern: 'relatorios_banner',
    title: 'RELATÓRIOS & AUDITORIA',
    motto: 'PRODUTOS MONOFÁSICOS • RESUMOS FISCAIS • BI',
    icon1: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
    icon2: '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>'
  },
  {
    slug: 'integracoes',
    aiFilePattern: 'integracoes_banner',
    title: 'INTEGRAÇÕES & APIS',
    motto: 'SERVIDORES MCP • MULTI-IA FISCAL • GATEWAYS',
    icon1: '<rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/>',
    icon2: '<path d="m13 2-2 2.5h3L11 8"/><path d="M18 11h-4l1-3h-4l-1 5h3l-2 5"/>'
  },
  {
    slug: 'permissoes',
    aiFilePattern: 'permissoes_banner',
    title: 'CONTROLE DE PERMISSÕES',
    motto: 'SEGURANÇA RBAC • PERFIS DE ACESSO • ADMIN & CLIENTE',
    icon1: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    icon2: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'
  },
  {
    slug: 'aparencia',
    aiFilePattern: 'aparencia_banner',
    title: 'PERSONALIZAÇÃO & APARÊNCIA',
    motto: 'TEMAS CLARO & ESCURO • TELA CHEIA • CABEÇALHOS',
    icon1: '<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
    icon2: '<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>'
  },
  {
    slug: 'configuracoes-portal',
    aiFilePattern: 'configuracoes_banner',
    title: 'CONFIGURAÇÕES DO PORTAL',
    motto: 'IDENTIDADE VISUAL • ALERTAS WHATSAPP • PARÂMETROS',
    icon1: '<line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/>',
    icon2: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>'
  },
  {
    slug: 'configuracoes',
    aiFilePattern: 'configuracoes_banner',
    title: 'CONFIGURAÇÕES DO HUB',
    motto: 'PASTAS LOCAIS • SERVIÇO DESKTOP • SINCRONIZAÇÃO ERP',
    icon1: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    icon2: '<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>'
  },
  {
    slug: 'dashboard',
    aiFilePattern: 'dashboard_banner',
    title: 'DASHBOARD FISCAL',
    motto: 'PANORAMA GERAL • INDICADORES TRIBUTÁRIOS • ESTRATÉGIA',
    icon1: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
    icon2: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>'
  },
  {
    slug: 'meus-clientes',
    aiFilePattern: 'clientes_banner',
    title: 'CARTEIRA CONTÁBIL',
    motto: 'EMPRESAS VINCULADAS • AUDITORIA MENSAL • SUPORTE',
    icon1: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>',
    icon2: '<rect x="4" y="2" width="16" height="20" rx="2" ry="2"/>'
  },
  {
    slug: 'meu-perfil',
    aiFilePattern: 'contabilidades_banner',
    title: 'MEU PERFIL',
    motto: 'DADOS CADASTRAIS • CREDENCIAMENTO • SEGURANÇA',
    icon1: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    icon2: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'
  },
  {
    slug: 'default',
    aiFilePattern: 'dashboard_banner',
    title: 'HUBPARATECH',
    motto: 'ORGANIZAÇÃO • SEGURANÇA • RESULTADOS',
    icon1: '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>',
    icon2: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>'
  }
];

function findAiImage(pattern) {
  const files = fs.readdirSync(brainDir);
  const match = files.find(f => f.startsWith(pattern) && (f.endsWith('.jpg') || f.endsWith('.png')));
  if (match) {
    return path.join(brainDir, match);
  }
  return null;
}

async function composeAll() {
  console.log(`Compondo ${bannerConfigs.length} banners ultra-widescreen inovadores com +30% altura (${TARGET_WIDTH}x${TARGET_HEIGHT})...`);

  for (const cfg of bannerConfigs) {
    const aiImgPath = findAiImage(cfg.aiFilePattern);
    if (!aiImgPath) {
      console.warn(`Imagem AI não encontrada para padrão: ${cfg.aiFilePattern}, pulando...`);
      continue;
    }

    const outputPath = path.join(outputDir, `${cfg.slug}.webp`);

    // 1. Redimensiona e recorta a imagem base gerada por IA na proporção panorâmica exata
    // Usamos 'cover' com posição 'center' ou 'right' para valorizar as artes da direita
    const baseBuffer = await sharp(aiImgPath)
      .resize(TARGET_WIDTH, TARGET_HEIGHT, {
        fit: 'cover',
        position: 'center'
      })
      .toBuffer();

    // 2. Camada SVG de gradiente sutil no centro + Ícones + Tipografia de alta precisão
    const titleEscaped = cfg.title.replace(/&/g, '&amp;');
    const mottoEscaped = cfg.motto.replace(/&/g, '&amp;');

    const svgOverlay = Buffer.from(`
      <svg width="${TARGET_WIDTH}" height="${TARGET_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <!-- Gradiente de escurecimento suave atrás do texto no centro -->
          <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#020817" stop-opacity="0.88" />
            <stop offset="60%" stop-color="#020817" stop-opacity="0.75" />
            <stop offset="100%" stop-color="#020817" stop-opacity="0" />
          </radialGradient>
        </defs>

        <!-- Sombra/Glow central para máxima legibilidade -->
        <ellipse cx="${TARGET_WIDTH / 2}" cy="${TARGET_HEIGHT / 2}" rx="380" ry="46" fill="url(#centerGlow)" />

        <style>
          .title { font-family: 'Segoe UI', Arial, sans-serif; font-size: 30px; font-weight: 900; fill: #ffffff; letter-spacing: 2.5px; }
          .motto { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11.5px; font-weight: 700; fill: #38bdf8; letter-spacing: 3px; }
          .icon { stroke: #ffffff; stroke-width: 2; fill: none; stroke-linecap: round; stroke-linejoin: round; }
        </style>
        
        <!-- Grupo Centralizado com Título e Ícones -->
        <g transform="translate(${TARGET_WIDTH / 2}, ${TARGET_HEIGHT / 2})">
          
          <!-- Ícone 1 (à esquerda) -->
          <g transform="translate(-250, -15) scale(1.3)" class="icon">
            ${cfg.icon1}
          </g>
          
          <!-- Ícone 2 (ao lado) -->
          <g transform="translate(-210, -15) scale(1.3)" class="icon">
            ${cfg.icon2}
          </g>

          <!-- Título Principal -->
          <text x="25" y="-2" text-anchor="middle" class="title">${titleEscaped}</text>
          
          <!-- Slogan / Subtítulo -->
          <text x="25" y="27" text-anchor="middle" class="motto">— ${mottoEscaped} —</text>
        </g>
      </svg>
    `);

    const overlayBuffer = await sharp(svgOverlay).png().toBuffer();

    // 3. Compõe a arte de IA com a camada de texto e salva como WebP otimizado
    await sharp(baseBuffer)
      .composite([{ input: overlayBuffer, left: 0, top: 0, blend: 'over' }])
      .webp({ quality: 90 })
      .toFile(outputPath);

    console.log(`✓ Banner inovador gerado: ${cfg.slug}.webp (${TARGET_WIDTH}x${TARGET_HEIGHT})`);
  }

  console.log('Todos os banners exclusivos foram compostos com sucesso!');
}

composeAll().catch(console.error);
