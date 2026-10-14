const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function makeBase() {
  const input = path.join(__dirname, '../public/banner-contabilidade.webp');
  const output = path.join(__dirname, '../public/banner-base.webp');
  
  if (!fs.existsSync(input)) {
    console.error('Input banner does not exist:', input);
    return;
  }
  
  const meta = await sharp(input).metadata();
  console.log('Original banner:', meta.width, 'x', meta.height);
  
  // Create a deep blue patch for the center (covering the text and icons)
  const patchWidth = 565;
  const patchHeight = 75;
  const svgPatch = Buffer.from(`
    <svg width="${patchWidth}" height="${patchHeight}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#021431" stop-opacity="0" />
          <stop offset="8%" stop-color="#021a3f" stop-opacity="0.95" />
          <stop offset="16%" stop-color="#01245e" stop-opacity="1" />
          <stop offset="84%" stop-color="#01245e" stop-opacity="1" />
          <stop offset="92%" stop-color="#011b47" stop-opacity="0.95" />
          <stop offset="100%" stop-color="#011538" stop-opacity="0" />
        </linearGradient>
      </defs>
      <rect width="${patchWidth}" height="${patchHeight}" fill="url(#grad)" />
    </svg>
  `);
  
  const patchBuffer = await sharp(svgPatch).png().toBuffer();
  
  await sharp(input)
    .composite([
      { input: patchBuffer, left: 185, top: 0, blend: 'over' }
    ])
    .toFile(output);
    
  console.log('Created banner-base.webp successfully!');
}

makeBase().catch(console.error);
