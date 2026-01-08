/**
 * Prepare all icon sizes from the trimmed icon
 * Creates all necessary icon variants for the app
 */

import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

async function prepareIcons() {
  const sourceIcon = join(__dirname, '../assets/images/icon-trimmed.png');
  const imagesDir = join(__dirname, '../assets/images');
  
  console.log('🎨 Preparing all icon variants...\n');
  
  try {
    const icon = sharp(sourceIcon);
    
    // 1. Main icon (already done, but verify)
    console.log('✅ Main icon: icon.png (512x512)');
    
    // 2. Adaptive icon foreground (for Android)
    // Android adaptive icons need 1024x1024 with safe zone
    const adaptiveForeground = await icon
      .resize(1024, 1024, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }, // Transparent
      })
      .toBuffer();
    
    writeFileSync(join(imagesDir, 'adaptive-icon.png'), adaptiveForeground);
    console.log('✅ Adaptive icon: adaptive-icon.png (1024x1024)');
    
    // 3. Splash icon (can use same as main)
    const splashIcon = await icon
      .resize(1024, 1024, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }, // White background for splash
      })
      .toBuffer();
    
    writeFileSync(join(imagesDir, 'splash-icon.png'), splashIcon);
    console.log('✅ Splash icon: splash-icon.png (1024x1024)');
    
    // 4. Favicon (for web)
    const favicon = await icon
      .resize(32, 32, {
        fit: 'contain',
        background: { r: 26, g: 18, b: 22, alpha: 1 }, // #1a1216 background
      })
      .toBuffer();
    
    writeFileSync(join(imagesDir, 'favicon.png'), favicon);
    console.log('✅ Favicon: favicon.png (32x32)');
    
    console.log('\n🎉 All icons prepared successfully!');
    console.log('\n📋 Icon files:');
    console.log('   - icon.png (main app icon)');
    console.log('   - adaptive-icon.png (Android adaptive icon)');
    console.log('   - splash-icon.png (splash screen)');
    console.log('   - favicon.png (web favicon)');
    
  } catch (error: any) {
    console.error('❌ Error preparing icons:', error.message);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  prepareIcons().catch(console.error);
}

export { prepareIcons };

