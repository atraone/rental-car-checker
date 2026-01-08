/**
 * Re-crop icon with equal deadspace on left, right, and top
 * Bottom is cropped to make it square
 */

import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

async function recropIconEqual() {
  const inputPath = join(__dirname, '../assets/images/icon-vanity-mirror.png');
  const outputPath = join(__dirname, '../assets/images/icon-trimmed.png');
  
  console.log('🔍 Analyzing base icon for equal deadspace cropping...');
  
  try {
    const image = sharp(inputPath);
    const metadata = await image.metadata();
    
    console.log(`📐 Original size: ${metadata.width}x${metadata.height}`);
    
    // Get raw pixel data to find content edges
    const { data, info } = await image
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const width = info.width;
    const height = info.height;
    const channels = info.channels;
    
    // Background is approximately #1a1216 (26, 18, 22)
    const bgThreshold = 30;
    
    // Find left edge
    let leftEdge = 0;
    for (let x = 0; x < width; x++) {
      let hasContent = false;
      for (let y = 0; y < height; y++) {
        const idx = (y * width + x) * channels;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
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
    
    // Find right edge
    let rightEdge = width - 1;
    for (let x = width - 1; x >= 0; x--) {
      let hasContent = false;
      for (let y = 0; y < height; y++) {
        const idx = (y * width + x) * channels;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const distFromBg = Math.abs(r - 26) + Math.abs(g - 18) + Math.abs(b - 22);
        if (distFromBg > bgThreshold) {
          hasContent = true;
          break;
        }
      }
      if (hasContent) {
        rightEdge = x;
        break;
      }
    }
    
    // Find top edge (keep all top as user requested)
    let topEdge = 0;
    
    // Find bottom edge (where to crop)
    let bottomEdge = height - 1;
    for (let y = height - 1; y >= 0; y--) {
      let hasContent = false;
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * channels;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const distFromBg = Math.abs(r - 26) + Math.abs(g - 18) + Math.abs(b - 22);
        if (distFromBg > bgThreshold) {
          hasContent = true;
          break;
        }
      }
      if (hasContent) {
        bottomEdge = y;
        break;
      }
    }
    
    console.log(`📍 Content edges:`);
    console.log(`   Left: ${leftEdge}px`);
    console.log(`   Right: ${rightEdge}px`);
    console.log(`   Top: ${topEdge}px`);
    console.log(`   Bottom: ${bottomEdge}px`);
    
    // Calculate deadspace
    const leftDeadspace = leftEdge;
    const rightDeadspace = width - 1 - rightEdge;
    const topDeadspace = topEdge;
    
    console.log(`\n📏 Current deadspace:`);
    console.log(`   Left: ${leftDeadspace}px`);
    console.log(`   Right: ${rightDeadspace}px`);
    console.log(`   Top: ${topDeadspace}px`);
    
    // Calculate content dimensions
    const contentWidth = rightEdge - leftEdge + 1;
    const contentHeight = bottomEdge - topEdge + 1;
    
    // Use the MINIMUM deadspace to ensure equal minimal padding on all sides
    // This gives us the smallest equal deadspace (user wants "minimal but still a few px")
    const targetDeadspace = Math.min(leftDeadspace, rightDeadspace, topDeadspace);
    
    // But if top is 0, use the average of left and right for a balanced look
    let finalTargetDeadspace = targetDeadspace;
    if (topDeadspace === 0 && leftDeadspace > 0 && rightDeadspace > 0) {
      // Use average of left/right, but keep it minimal
      finalTargetDeadspace = Math.floor((leftDeadspace + rightDeadspace) / 2);
      // But don't make it larger than the smaller side
      finalTargetDeadspace = Math.min(finalTargetDeadspace, Math.min(leftDeadspace, rightDeadspace));
    }
    
    console.log(`\n🎯 Target deadspace (equal on all sides): ${finalTargetDeadspace}px`);
    
    // Calculate new crop dimensions with equal deadspace
    // Center the content horizontally
    const contentCenterX = (leftEdge + rightEdge) / 2;
    const contentWidthWithPadding = contentWidth + (finalTargetDeadspace * 2);
    const newLeft = Math.max(0, Math.floor(contentCenterX - contentWidthWithPadding / 2));
    const newRight = newLeft + contentWidthWithPadding - 1;
    const newTop = Math.max(0, topEdge); // Keep top as-is (user said "top all kept")
    
    // Calculate new width
    const newWidth = newRight - newLeft + 1;
    
    // Make it square - use width as the square size, crop bottom
    const squareSize = newWidth;
    const newHeightSquare = squareSize;
    
    // Calculate where bottom should be
    const newBottom = newTop + newHeightSquare - 1;
    
    console.log(`\n✂️  Cropping:`);
    console.log(`   Left: ${newLeft}px`);
    console.log(`   Top: ${newTop}px`);
    console.log(`   Width: ${newWidth}px`);
    console.log(`   Height: ${newHeightSquare}px (square)`);
    console.log(`   Bottom: ${newBottom}px (from top: ${newTop})`);
    
    // Extract and resize to 512x512
    const finalImage = await sharp(inputPath)
      .extract({
        left: newLeft,
        top: newTop,
        width: newWidth,
        height: Math.min(newHeightSquare, height - newTop), // Don't exceed original height
      })
      .resize(512, 512, {
        fit: 'cover', // Maintain aspect ratio, crop to square
      })
      .toBuffer();
    
    // Save
    writeFileSync(outputPath, finalImage);
    
    const finalMeta = await sharp(finalImage).metadata();
    console.log(`\n✅ Final icon: ${finalMeta.width}x${finalMeta.height}`);
    console.log(`📁 Saved to: ${outputPath}`);
    console.log(`💾 Size: ${(finalImage.length / 1024).toFixed(2)} KB`);
    
    // Verify deadspace is equal
    const finalImageData = await sharp(finalImage)
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const finalWidth = finalImageData.info.width;
    const finalHeight = finalImageData.info.height;
    
    // Check deadspace in final image
    let finalLeft = 0;
    let finalRight = finalWidth - 1;
    let finalTop = 0;
    
    // Find edges in final image
    for (let x = 0; x < finalWidth; x++) {
      let hasContent = false;
      for (let y = 0; y < finalHeight; y++) {
        const idx = (y * finalWidth + x) * finalImageData.info.channels;
        const r = finalImageData.data[idx];
        const g = finalImageData.data[idx + 1];
        const b = finalImageData.data[idx + 2];
        const distFromBg = Math.abs(r - 26) + Math.abs(g - 18) + Math.abs(b - 22);
        if (distFromBg > bgThreshold) {
          hasContent = true;
          break;
        }
      }
      if (hasContent) {
        finalLeft = x;
        break;
      }
    }
    
    for (let x = finalWidth - 1; x >= 0; x--) {
      let hasContent = false;
      for (let y = 0; y < finalHeight; y++) {
        const idx = (y * finalWidth + x) * finalImageData.info.channels;
        const r = finalImageData.data[idx];
        const g = finalImageData.data[idx + 1];
        const b = finalImageData.data[idx + 2];
        const distFromBg = Math.abs(r - 26) + Math.abs(g - 18) + Math.abs(b - 22);
        if (distFromBg > bgThreshold) {
          hasContent = true;
          break;
        }
      }
      if (hasContent) {
        finalRight = x;
        break;
      }
    }
    
    const finalLeftDeadspace = finalLeft;
    const finalRightDeadspace = finalWidth - 1 - finalRight;
    
    console.log(`\n✅ Final deadspace verification:`);
    console.log(`   Left: ${finalLeftDeadspace}px`);
    console.log(`   Right: ${finalRightDeadspace}px`);
    console.log(`   Top: ${finalTop}px (kept as-is)`);
    
    return outputPath;
  } catch (error: any) {
    console.error('❌ Error processing icon:', error.message);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  recropIconEqual().catch(console.error);
}

export { recropIconEqual };

