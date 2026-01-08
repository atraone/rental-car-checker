import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { readFileSync } from 'fs';
import { join } from 'path';

import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";

const app = new Hono();

// Load API keys directly from .env to avoid Bun env issues
let cachedClaudeKey: string | undefined;
let cachedOpenAIKey: string | undefined;
let cachedKieKey: string | undefined;

function loadApiKeys() {
  if (cachedClaudeKey && cachedOpenAIKey && cachedKieKey) return;
  
  const envPath = join(process.cwd(), '.env');
  try {
    const envContent = readFileSync(envPath, 'utf-8');
    envContent.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const equalIndex = trimmed.indexOf('=');
        if (equalIndex > 0) {
          const key = trimmed.substring(0, equalIndex).trim();
          // Get everything after the = sign (value may contain = or special chars)
          let value = trimmed.substring(equalIndex + 1);
          // Remove leading/trailing whitespace and carriage returns
          value = value.trim().replace(/\r$/, '');
          // Remove surrounding quotes if present
          if ((value.startsWith('"') && value.endsWith('"')) || 
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          if (key === 'EXPO_PUBLIC_CLAUDE_API_KEY' || key === 'ANTHROPIC_API_KEY') {
            cachedClaudeKey = value;
            console.log(`   Cached Claude key: ${value.length} chars`);
          }
          if (key === 'EXPO_PUBLIC_OPENAI_API_KEY' || key === 'OPENAI_API_KEY') {
            cachedOpenAIKey = value;
            console.log(`   Cached OpenAI key: ${value.length} chars`);
          }
          if (key === 'KIE_API_KEY') {
            cachedKieKey = value;
            console.log(`   Cached Kie key: ${value.length} chars`);
          }
        }
      }
    });
  } catch (error) {
    console.warn('Could not load .env for API keys:', error);
  }
}

// Load keys on module init
loadApiKeys();

app.use("*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
}));

app.use(
  "/api/trpc/*",
  trpcServer({
    endpoint: "/api/trpc",
    router: appRouter,
    createContext,
  }),
);

// Claude API proxy endpoint
app.post("/api/claude", async (c) => {
  try {
    const { promptText, imageBase64, imageMime } = await c.req.json();

    if (!promptText || !imageBase64) {
      return c.json({ error: 'Missing required fields: promptText and imageBase64' }, 400);
    }

    // Always prefer cached key (loaded directly from file, not truncated)
    // cachedClaudeKey is the full 108 chars, process.env may be truncated by Bun
    const apiKey = cachedClaudeKey || process.env.ANTHROPIC_API_KEY || process.env.EXPO_PUBLIC_CLAUDE_API_KEY;
    
    if (!apiKey) {
      console.error('API key not found. Available env vars:', Object.keys(process.env).filter(k => k.includes('CLAUDE') || k.includes('ANTHROPIC')));
      return c.json({ error: 'ANTHROPIC_API_KEY is not set' }, 500);
    }
    
    // Use cached key if available (it's the full 108 chars), otherwise use env var
    const cleanApiKey = (cachedClaudeKey || apiKey).trim();
    console.log(`Using Claude API key: ${cleanApiKey.substring(0, 20)}... (length: ${cleanApiKey.length}, from cache: ${!!cachedClaudeKey})`);

    // Remove data URI prefix if present (handle both data:image/...;base64, and plain base64)
    let base64Data = imageBase64;
    let detectedMimeType = imageMime;
    
    if (typeof base64Data === 'string' && base64Data.includes(',')) {
      // Extract base64 part after the comma
      const parts = base64Data.split(',');
      // Check if there's a MIME type in the data URI prefix
      const prefix = parts[0];
      if (prefix.includes('data:') && prefix.includes('image/')) {
        const mimeMatch = prefix.match(/data:image\/([^;]+)/);
        if (mimeMatch) {
          detectedMimeType = `image/${mimeMatch[1]}`;
        }
      }
      base64Data = parts[parts.length - 1]; // Get the last part (the actual base64 data)
    }
    
    if (!base64Data || typeof base64Data !== 'string') {
      return c.json({ error: 'Invalid imageBase64: must be a string' }, 400);
    }

    // Detect MIME type from actual image data (magic bytes)
    // PNG: starts with 89 50 4E 47 (iVBORw0KGgo in base64)
    // JPEG: starts with FF D8 FF (base64: /9j/4AAQ)
    const imageBuffer = Buffer.from(base64Data, 'base64');
    let actualMimeType = detectedMimeType || 'image/jpeg';
    
    // Check PNG magic bytes (first 8 bytes: 89 50 4E 47 0D 0A 1A 0A)
    if (imageBuffer.length >= 8 && 
        imageBuffer[0] === 0x89 && 
        imageBuffer[1] === 0x50 && 
        imageBuffer[2] === 0x4E && 
        imageBuffer[3] === 0x47) {
      actualMimeType = 'image/png';
    }
    // Check JPEG magic bytes (first 3 bytes: FF D8 FF)
    else if (imageBuffer.length >= 3 && 
             imageBuffer[0] === 0xFF && 
             imageBuffer[1] === 0xD8 && 
             imageBuffer[2] === 0xFF) {
      actualMimeType = 'image/jpeg';
    }
    // Check WebP (RIFF...WEBP)
    else if (imageBuffer.length >= 12 &&
             imageBuffer[0] === 0x52 && imageBuffer[1] === 0x49 &&
             imageBuffer[2] === 0x46 && imageBuffer[3] === 0x46 &&
             imageBuffer[8] === 0x57 && imageBuffer[9] === 0x45 &&
             imageBuffer[10] === 0x42 && imageBuffer[11] === 0x50) {
      actualMimeType = 'image/webp';
    }
    
    // Normalize MIME type
    if (actualMimeType === 'image/jpg') {
      actualMimeType = 'image/jpeg';
    }
    
    console.log(`Image MIME type: requested=${imageMime}, detected=${actualMimeType}, size=${imageBuffer.length} bytes`);
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': cleanApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514', // Verified working - better quality than haiku
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: promptText,
              },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: actualMimeType,
                  data: base64Data,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return c.json({ error: `Claude API error: ${response.status} ${errorText}` }, response.status as any);
    }

    const data = await response.json();
    
    if (!data.content || !Array.isArray(data.content) || data.content.length === 0) {
      return c.json({ error: 'Invalid response from Claude API' }, 500);
    }

    // Extract text from the first text block
    const textBlock = data.content.find((block: any) => block.type === 'text');
    if (!textBlock) {
      return c.json({ error: 'No text content in Claude API response' }, 500);
    }

    return c.json({ text: textBlock.text });
  } catch (error: any) {
    console.error('Claude API proxy error:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// OpenAI API proxy endpoint
app.post("/api/openai", async (c) => {
  try {
    const { prompt, imageBase64, imageMime, aspectRatio } = await c.req.json();

    const apiKey = cachedOpenAIKey || process.env.OPENAI_API_KEY || process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    
    if (!apiKey) {
      return c.json({ error: 'OPENAI_API_KEY is not set' }, 500);
    }

    // Remove data URI prefix if present
    let base64Data = imageBase64;
    if (typeof base64Data === 'string' && base64Data.includes(',')) {
      const parts = base64Data.split(',');
      base64Data = parts[parts.length - 1];
    }

    // Detect MIME type from image data
    let actualMimeType = imageMime || 'image/jpeg';
    try {
      const imageBuffer = Buffer.from(base64Data, 'base64');
      if (imageBuffer.length >= 8 && 
          imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50 && 
          imageBuffer[2] === 0x4E && imageBuffer[3] === 0x47) {
        actualMimeType = 'image/png';
      } else if (imageBuffer.length >= 3 && 
                 imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8 && imageBuffer[2] === 0xFF) {
        actualMimeType = 'image/jpeg';
      }
    } catch (e) {
      console.warn('Could not detect MIME type, using provided:', imageMime);
    }

    // Use OpenAI image edits endpoint (actual editing, not generation)
    // This edits the existing image rather than generating a new one
    // Requirements: PNG format, <4MB, square (1024x1024)
    try {
      const imageBuffer = Buffer.from(base64Data, 'base64');
      
      // Process image to meet OpenAI requirements: PNG, 1024x1024, <4MB
      let processedImageBuffer: Buffer;
      let processedImageSize: number;
      
      try {
        // Try to use sharp for image processing (convert to PNG, resize to 1024x1024)
        const sharp = require('sharp');
        
        // Convert to PNG, resize to 1024x1024 square, and compress
        processedImageBuffer = await sharp(imageBuffer)
          .resize(1024, 1024, {
            fit: 'cover', // Cover mode to maintain aspect ratio, crop if needed
            position: 'center',
          })
          .png({
            quality: 90,
            compressionLevel: 9,
          })
          .toBuffer();
        
        processedImageSize = processedImageBuffer.length;
        console.log(`📸 Processed image: ${processedImageSize} bytes (${(processedImageSize / 1024 / 1024).toFixed(2)} MB)`);
        
        // If still too large, reduce quality further
        if (processedImageSize > 4 * 1024 * 1024) {
          console.log('⚠️  Image >4MB, reducing quality...');
          processedImageBuffer = await sharp(imageBuffer)
            .resize(1024, 1024, {
              fit: 'cover',
              position: 'center',
            })
            .png({
              quality: 70,
              compressionLevel: 9,
            })
            .toBuffer();
          processedImageSize = processedImageBuffer.length;
          console.log(`📸 Reduced quality: ${processedImageSize} bytes (${(processedImageSize / 1024 / 1024).toFixed(2)} MB)`);
        }
      } catch (sharpError: any) {
        // Fallback: use original image if sharp fails (preserve existing behavior)
        console.warn('⚠️  Sharp not available, using original image:', sharpError.message);
        processedImageBuffer = imageBuffer;
        processedImageSize = imageBuffer.length;
        
        // Warn if image doesn't meet requirements
        if (processedImageSize > 4 * 1024 * 1024) {
          console.warn(`⚠️  Image size ${(processedImageSize / 1024 / 1024).toFixed(2)}MB exceeds 4MB limit`);
        }
        if (actualMimeType !== 'image/png') {
          console.warn(`⚠️  Image format ${actualMimeType} is not PNG`);
        }
      }
      
      // Create proper PNG mask (1024x1024, fully white = edit entire image)
      let maskBuffer: Buffer;
      try {
        const sharp = require('sharp');
        // Create a 1024x1024 white PNG mask
        maskBuffer = await sharp({
          create: {
            width: 1024,
            height: 1024,
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: 1 },
          },
        })
          .png()
          .toBuffer();
      } catch (maskError: any) {
        // Fallback: create simple white mask (raw RGBA data)
        console.warn('⚠️  Could not create PNG mask with sharp, using fallback:', maskError.message);
        const maskSize = 1024;
        const maskData = Buffer.alloc(maskSize * maskSize * 4); // RGBA
        maskData.fill(255); // All white = edit entire image
        maskBuffer = maskData;
      }
      
      // Use FormData for multipart/form-data request
      const formData = new FormData();
      
      // Add processed image file (PNG, 1024x1024, <4MB)
      // Convert Buffer to Uint8Array for Blob compatibility
      const imageBlob = new Blob([new Uint8Array(processedImageBuffer)], { type: 'image/png' });
      formData.append('image', imageBlob, 'image.png');
      
      // Add mask (PNG, 1024x1024)
      const maskBlob = new Blob([new Uint8Array(maskBuffer)], { type: 'image/png' });
      formData.append('mask', maskBlob, 'mask.png');
      
      formData.append('prompt', prompt);
      formData.append('n', '1');
      formData.append('size', '1024x1024');
      formData.append('response_format', 'b64_json');
      
      console.log('🔄 Using OpenAI image edits endpoint to edit existing image...');
      console.log(`   Image: ${(processedImageSize / 1024 / 1024).toFixed(2)}MB, PNG, 1024x1024`);
      
      // Call image edits endpoint
      const editsResponse = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          // Don't set Content-Type - let fetch set it with boundary automatically
        },
        body: formData,
      });

      if (editsResponse.ok) {
        const editsData = await editsResponse.json();
        if (editsData.data?.[0]?.b64_json) {
          const editedImageData = editsData.data[0].b64_json;
          console.log('✅ Successfully edited image using edits endpoint');
          return c.json({ image: `data:image/png;base64,${editedImageData}` });
        } else {
          console.warn('Edits endpoint returned unexpected format:', Object.keys(editsData));
          return c.json({ error: 'Edits endpoint returned unexpected format' }, 500);
        }
      } else {
        const errorText = await editsResponse.text();
        console.error('❌ Image edits endpoint failed:', editsResponse.status, errorText.substring(0, 300));
        return c.json({ error: `Image editing failed: ${editsResponse.status} ${errorText.substring(0, 100)}` }, 500);
      }
    } catch (error: any) {
      console.error('❌ Image edits endpoint error:', error.message || error);
      return c.json({ error: `Image editing failed: ${error.message || 'Unknown error'}` }, 500);
    }
  } catch (error: any) {
    console.error('OpenAI API proxy error:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// Kie.ai API proxy endpoint - Google Nano Banana Edit model
// 3-step flow: Upload base64 → Create task → Poll for result
app.post("/api/kie", async (c) => {
  try {
    const { prompt, imageBase64, imageMime } = await c.req.json();

    // Use cached key (loaded directly from file) or fallback to process.env
    const apiKey = cachedKieKey || process.env.KIE_API_KEY;
    
    if (!apiKey) {
      return c.json({ error: 'KIE_API_KEY is not set in environment variables' }, 500);
    }

    // Prepare base64 data (can be full data URI or just base64)
    let base64Data = imageBase64;
    let dataUri = imageBase64;
    
    // If it's a data URI, extract base64 part for upload
    if (typeof base64Data === 'string' && base64Data.includes(',')) {
      const parts = base64Data.split(',');
      base64Data = parts[parts.length - 1];
      // Keep full data URI for upload (Kie accepts it)
      dataUri = imageBase64;
    } else {
      // If just base64, create data URI
      const mimeType = imageMime || 'image/png';
      dataUri = `data:${mimeType};base64,${base64Data}`;
    }

    // Detect MIME type from image data
    let actualMimeType = imageMime || 'image/png';
    try {
      const imageBuffer = Buffer.from(base64Data, 'base64');
      if (imageBuffer.length >= 8 && 
          imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50 && 
          imageBuffer[2] === 0x4E && imageBuffer[3] === 0x47) {
        actualMimeType = 'image/png';
      } else if (imageBuffer.length >= 3 && 
                 imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8 && imageBuffer[2] === 0xFF) {
        actualMimeType = 'image/jpeg';
      }
    } catch (e) {
      console.warn('Could not detect MIME type, using provided:', imageMime);
    }

    console.log('🔄 Using Kie.ai Google Nano Banana Edit model...');
    console.log(`   Image: ${(Buffer.from(base64Data, 'base64').length / 1024 / 1024).toFixed(2)}MB, ${actualMimeType}`);

    // Step 1: Upload base64 to get public URL
    console.log('📤 Step 1: Uploading base64 image to Kie.ai...');
    let downloadUrl: string;
    try {
      const uploadResponse = await fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          base64Data: dataUri, // Send full data URI
          uploadPath: 'images',
          fileName: `image_${Date.now()}.${actualMimeType === 'image/png' ? 'png' : 'jpg'}`,
        }),
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('❌ Kie.ai upload failed:', uploadResponse.status, errorText);
        return c.json({ error: `Upload failed: ${uploadResponse.status} ${errorText.substring(0, 100)}` }, 500);
      }

      const uploadData = await uploadResponse.json();
      if (!uploadData.data?.downloadUrl) {
        console.error('❌ No downloadUrl in upload response:', uploadData);
        return c.json({ error: 'Upload response missing downloadUrl' }, 500);
      }

      downloadUrl = uploadData.data.downloadUrl;
      console.log('✅ Upload successful, got downloadUrl');
    } catch (uploadError: any) {
      console.error('❌ Upload error:', uploadError.message);
      return c.json({ error: `Upload error: ${uploadError.message}` }, 500);
    }

    // Step 2: Create edit task
    console.log('📝 Step 2: Creating edit task...');
    let taskId: string;
    try {
      const taskResponse = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'google/nano-banana-edit',
          input: {
            prompt: prompt,
            image_urls: [downloadUrl],
            output_format: 'png',
            image_size: '1:1',
          },
        }),
      });

      if (!taskResponse.ok) {
        const errorText = await taskResponse.text();
        console.error('❌ Task creation failed:', taskResponse.status, errorText);
        return c.json({ error: `Task creation failed: ${taskResponse.status} ${errorText.substring(0, 100)}` }, 500);
      }

      const taskData = await taskResponse.json();
      if (!taskData.data?.taskId) {
        console.error('❌ No taskId in task response:', taskData);
        return c.json({ error: 'Task response missing taskId' }, 500);
      }

      taskId = taskData.data.taskId;
      console.log(`✅ Task created, taskId: ${taskId}`);
    } catch (taskError: any) {
      console.error('❌ Task creation error:', taskError.message);
      return c.json({ error: `Task creation error: ${taskError.message}` }, 500);
    }

    // Step 3: Poll for result
    console.log('⏳ Step 3: Polling for task result...');
    const maxPollAttempts = 60; // 60 attempts
    const pollInterval = 2000; // 2 seconds
    let pollAttempt = 0;

    while (pollAttempt < maxPollAttempts) {
      try {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        pollAttempt++;

        const pollResponse = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
        });

        if (!pollResponse.ok) {
          console.warn(`⚠️  Poll attempt ${pollAttempt} failed: ${pollResponse.status}`);
          continue;
        }

        const pollData = await pollResponse.json();
        const state = pollData.data?.state;

        if (state === 'success') {
          console.log('✅ Task completed successfully');
          
          // Parse resultJson (it's a JSON string)
          let resultJson: any;
          try {
            resultJson = typeof pollData.data.resultJson === 'string' 
              ? JSON.parse(pollData.data.resultJson)
              : pollData.data.resultJson;
          } catch (parseError) {
            resultJson = pollData.data;
          }

          // Get result URL from resultUrls[0] or resultJson
          const resultUrl = resultJson?.resultUrls?.[0] || resultJson?.resultUrl || pollData.data?.resultUrls?.[0];
          
          if (!resultUrl) {
            console.error('❌ No result URL found:', pollData);
            return c.json({ error: 'No result URL in task response' }, 500);
          }

          console.log('📥 Fetching result image from:', resultUrl);

          // Fetch the result image and convert to base64
          const imageResponse = await fetch(resultUrl);
          if (!imageResponse.ok) {
            return c.json({ error: `Failed to fetch result image: ${imageResponse.status}` }, 500);
          }

          const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
          const imageBase64 = imageBuffer.toString('base64');
          const imageDataUri = `data:image/png;base64,${imageBase64}`;

          console.log('✅ Successfully edited image using Kie.ai');
          return c.json({ image: imageDataUri });

        } else if (state === 'failed' || state === 'error') {
          const errorMsg = pollData.data?.error || pollData.data?.message || 'Task failed';
          console.error('❌ Task failed:', errorMsg);
          return c.json({ error: `Task failed: ${errorMsg}` }, 500);
        } else if (state === 'pending' || state === 'processing' || state === 'running') {
          // Continue polling
          if (pollAttempt % 5 === 0) {
            console.log(`   Still processing... (attempt ${pollAttempt}/${maxPollAttempts})`);
          }
          continue;
        } else {
          console.warn(`⚠️  Unknown state: ${state}, continuing to poll...`);
          continue;
        }
      } catch (pollError: any) {
        console.warn(`⚠️  Poll attempt ${pollAttempt} error: ${pollError.message}`);
        if (pollAttempt >= maxPollAttempts) {
          return c.json({ error: `Polling timeout: ${pollError.message}` }, 500);
        }
        continue;
      }
    }

    // Timeout
    return c.json({ error: 'Task polling timeout - task may still be processing' }, 500);
  } catch (error: any) {
    console.error('Kie.ai API proxy error:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

app.get("/", (c) => {
  return c.json({ status: "ok", message: "API is running" });
});

export default app;
