/**
 * Trim icon with custom logic:
 * - Remove dead space on the left
 * - Keep entire top
 * - Crop bottom to make square
 */

import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

async function trimIconCustom() {
  const inputPath = join(__dirname, '../assets/images/icon-vanity-mirror.png');
  const outputPath = join(__dirname, '../assets/images/icon-trimmed.png');
  
  console.log('🔍 Analyzing icon for custom trim...');
  
  try {
    const image = sharp(inputPath);
    const metadata = await image.metadata();
    
    console.log(`📐 Original size: ${metadata.width}x${metadata.height}`);
    
    // Get raw pixel data to analyze
    const { data, info } = await image
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const width = info.width;
    const height = info.height;
    const channels = info.channels;
    
    // Find left edge (first column with non-background content)
    // Background is approximately #1a1216 (26, 18, 22)
    let leftEdge = 0;
    const bgThreshold = 30; // Allow some variance
    
    for (let x = 0; x < width; x++) {
      let hasContent = false;
      for (let y = 0; y < height; y++) {
        const idx = (y * width + x) * channels;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        
        // Check if pixel is significantly different from background
        const distFromBg = Math.abs(r - 26) + Math.abs(g - 18) + Math.abs(b - 22);
        if (distFromBg > bgThreshold) {
          hasContent = true;
          break;
        }
      }
      if (hasContent) {
        leftEdge = x;
        break;
      }
    }
    
    console.log(`📍 Left edge found at: ${leftEdge}px`);
    
    // Keep entire top (y = 0)
    // Calculate new width (from leftEdge to right edge)
    const newWidth = width - leftEdge;
    
    // Make it square by cropping bottom
    const newHeight = newWidth; // Square
    
    console.log(`✂️  Cropping: left=${leftEdge}, width=${newWidth}, height=${newHeight}`);
    
    // Extract and resize
    const finalImage = await sharp(inputPath)
      .extract({
        left: leftEdge,
        top: 0,
        width: newWidth,
        height: Math.min(newHeight, height), // Don't exceed original height
      })
      .resize(512, 512, {
        fit: 'cover', // Crop to square
      })
      .toBuffer();
    
    // Save
    writeFileSync(outputPath, finalImage);
    
    const finalMeta = await sharp(finalImage).metadata();
    console.log(`✅ Final icon: ${finalMeta.width}x${finalMeta.height}`);
    console.log(`📁 Saved to: ${outputPath}`);
    console.log(`💾 Size: ${(finalImage.length / 1024).toFixed(2)} KB`);
    
    return outputPath;
  } catch (error: any) {
    console.error('❌ Error processing icon:', error.message);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  trimIconCustom().catch(console.error);
}

export { trimIconCustom };

