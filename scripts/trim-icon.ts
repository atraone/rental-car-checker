/**
 * Trim and resize the generated icon for app store use
 * Removes dead space and ensures proper square aspect ratio
 */

import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

async function trimIcon() {
  const inputPath = join(__dirname, '../assets/images/icon-vanity-mirror.png');
  const outputPath = join(__dirname, '../assets/images/icon-trimmed.png');
  
  console.log('🔍 Analyzing icon...');
  
  try {
    // Load the image
    const image = sharp(inputPath);
    const metadata = await image.metadata();
    
    console.log(`📐 Original size: ${metadata.width}x${metadata.height}`);
    
    // Get image stats to find content area
    const stats = await image.stats();
    
    // Trim transparent/white edges (dead space)
    // For app icons, we want to keep some padding but remove excessive space
    const trimmed = await image
      .trim({
        threshold: 10, // Trim pixels with low opacity
      })
      .toBuffer();
    
    const trimmedImage = sharp(trimmed);
    const trimmedMeta = await trimmedImage.metadata();
    
    console.log(`✂️  After trim: ${trimmedMeta.width}x${trimmedMeta.height}`);
    
    // Calculate the size for square format
    // App icons should be 512x512 for Play Store
    const targetSize = 512;
    
    // Determine if we need to add padding or crop
    const currentSize = Math.max(trimmedMeta.width || 0, trimmedMeta.height || 0);
    
    let finalImage;
    
    if (currentSize < targetSize) {
      // Image is smaller - add padding to make it square
      console.log('📦 Adding padding to make square...');
      finalImage = await trimmedImage
        .resize(targetSize, targetSize, {
          fit: 'contain',
          background: { r: 26, g: 18, b: 22, alpha: 1 }, // #1a1216 background
        })
        .toBuffer();
    } else {
      // Image is larger - crop to square and resize
      console.log('✂️  Cropping to square and resizing...');
      const size = Math.min(trimmedMeta.width || 0, trimmedMeta.height || 0);
      finalImage = await trimmedImage
        .extract({
          left: Math.floor(((trimmedMeta.width || 0) - size) / 2),
          top: Math.floor(((trimmedMeta.height || 0) - size) / 2),
          width: size,
          height: size,
        })
        .resize(targetSize, targetSize, {
          fit: 'cover',
        })
        .toBuffer();
    }
    
    // Save the final icon
    writeFileSync(outputPath, finalImage);
    
    const finalMeta = await sharp(finalImage).metadata();
    console.log(`✅ Final icon: ${finalMeta.width}x${finalMeta.height}`);
    console.log(`📁 Saved to: ${outputPath}`);
    console.log(`💾 Size: ${(finalImage.length / 1024).toFixed(2)} KB`);
    
    // Also create a version with minimal padding (for adaptive icon foreground)
    const minimalPaddingPath = join(__dirname, '../assets/images/icon-foreground.png');
    const minimalPadding = await trimmedImage
      .resize(1024, 1024, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }, // Transparent background
      })
      .toBuffer();
    
    writeFileSync(minimalPaddingPath, minimalPadding);
    console.log(`📁 Also created foreground version: ${minimalPaddingPath}`);
    
    return outputPath;
  } catch (error: any) {
    console.error('❌ Error processing icon:', error.message);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  trimIcon().catch(console.error);
}

export { trimIcon };

