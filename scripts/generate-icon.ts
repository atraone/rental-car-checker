/**
 * Generate app icon using Kie.ai
 * Creates a vanity mirror icon matching the app's aesthetic
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Color scheme from the app
const COLORS = {
  background: '#1a1216',      // Dark purple/black
  primaryPink: '#E8A0B5',     // Main accent pink
  secondaryPink: '#C48799',   // Secondary pink
  tertiaryPink: '#C85A7C',    // Tertiary pink
  yellowSpotlight: '#FFD700', // Gold/yellow spotlight
  frameDark: '#2a1f23',       // Dark frame
  frameBorder: '#6B4A55',     // Frame border
  glass: '#000000',           // Glass pane (black/transparent)
};

async function generateIcon() {
  const { generateImageWithKie } = await import('../services/kie');
  
  // Create a simple base image (512x512) - a basic vanity mirror frame
  // We'll use a data URI for a simple SVG as the base
  const baseImageSvg = `
    <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
      <!-- Background -->
      <rect width="512" height="512" fill="${COLORS.background}"/>
      
      <!-- Outer frame -->
      <rect x="50" y="50" width="412" height="412" fill="${COLORS.frameDark}" stroke="${COLORS.frameBorder}" stroke-width="8" rx="20"/>
      
      <!-- Inner frame (mirror area) -->
      <rect x="100" y="100" width="312" height="312" fill="${COLORS.glass}" stroke="${COLORS.secondaryPink}" stroke-width="4" rx="10"/>
      
      <!-- Corner lights (pink bulbs) -->
      <circle cx="120" cy="120" r="15" fill="${COLORS.primaryPink}" opacity="0.8"/>
      <circle cx="392" cy="120" r="15" fill="${COLORS.primaryPink}" opacity="0.8"/>
      <circle cx="120" cy="392" r="15" fill="${COLORS.primaryPink}" opacity="0.8"/>
      <circle cx="392" cy="392" r="15" fill="${COLORS.primaryPink}" opacity="0.8"/>
      
      <!-- Yellow spotlight from top-left corner -->
      <defs>
        <radialGradient id="spotlight" cx="0.2" cy="0.2">
          <stop offset="0%" stop-color="${COLORS.yellowSpotlight}" stop-opacity="0.6"/>
          <stop offset="50%" stop-color="${COLORS.yellowSpotlight}" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="${COLORS.yellowSpotlight}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="512" height="512" fill="url(#spotlight)"/>
    </svg>
  `;
  
  // Convert SVG to base64 data URI
  const base64Svg = Buffer.from(baseImageSvg).toString('base64');
  const baseImageDataUri = `data:image/svg+xml;base64,${base64Svg}`;
  
  // Prompt for Kie.ai to transform into a professional vanity mirror icon
  const prompt = `Transform this into a professional app store icon for a vanity mirror makeup app. Create a beautiful vanity mirror with:

- Dark elegant background color ${COLORS.background} (deep purple-black)
- Ornate vintage-style mirror frame in dark brown/black tones (${COLORS.frameDark}, ${COLORS.frameBorder})
- Pink/mauve vanity lights around the frame edges (${COLORS.primaryPink}, ${COLORS.secondaryPink}, ${COLORS.tertiaryPink}) - these should glow softly
- A blank, reflective glass mirror pane in the center - should look like clean glass, slightly reflective but empty/blank
- Soft yellow-gold spotlight lighting from the upper-left corner (${COLORS.yellowSpotlight}) creating a warm, flattering glow
- Professional, polished, elegant aesthetic suitable for a beauty/makeup app
- App store icon style: clean, recognizable, works at small sizes
- Square format, 512x512 pixels
- The mirror should be the focal point, with the lights creating a glamorous vanity mirror atmosphere
- Subtle reflections and depth to make it look three-dimensional
- The overall mood should be luxurious, professional, and inviting`;

  console.log('🎨 Generating vanity mirror icon with Kie.ai...');
  console.log('📝 Prompt:', prompt.substring(0, 100) + '...');
  
  try {
    const resultImage = await generateImageWithKie({
      prompt: prompt,
      imageBase64: baseImageDataUri,
      imageMime: 'image/svg+xml',
    });
    
    // Save the result
    const outputPath = join(__dirname, '../assets/images/icon-generated.png');
    
    // Extract base64 from data URI
    const base64Data = resultImage.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    writeFileSync(outputPath, imageBuffer);
    
    console.log('✅ Icon generated successfully!');
    console.log('📁 Saved to:', outputPath);
    console.log('\n💡 Next steps:');
    console.log('   1. Review the generated icon');
    console.log('   2. If you like it, we can integrate it into the app');
    console.log('   3. Update app.json and Android manifest with the new icon');
    
    return outputPath;
  } catch (error) {
    console.error('❌ Error generating icon:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  generateIcon().catch(console.error);
}

export { generateIcon };

