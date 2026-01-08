// Vercel serverless function entrypoint
// This wraps the Hono app for Vercel's Node.js runtime

const { Hono } = require('hono');
const { cors } = require('hono/cors');

const app = new Hono();

// Load API keys from environment variables
const getApiKey = (keys) => {
  for (const key of keys) {
    if (process.env[key]) return process.env[key];
  }
  return null;
};

// CORS middleware
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Health check endpoint
app.get('/', (c) => {
  return c.json({ status: 'ok', message: 'API is running' });
});

// Claude API proxy endpoint
app.post('/api/claude', async (c) => {
  try {
    const { promptText, imageBase64, imageMime } = await c.req.json();

    if (!promptText || !imageBase64) {
      return c.json({ error: 'Missing required fields: promptText and imageBase64' }, 400);
    }

    const apiKey = getApiKey(['ANTHROPIC_API_KEY', 'EXPO_PUBLIC_CLAUDE_API_KEY']);
    
    if (!apiKey) {
      return c.json({ error: 'ANTHROPIC_API_KEY is not set' }, 500);
    }

    // Remove data URI prefix if present
    let base64Data = imageBase64;
    let detectedMimeType = imageMime;
    
    if (typeof base64Data === 'string' && base64Data.includes(',')) {
      const parts = base64Data.split(',');
      const prefix = parts[0];
      if (prefix.includes('data:') && prefix.includes('image/')) {
        const mimeMatch = prefix.match(/data:image\/([^;]+)/);
        if (mimeMatch) {
          detectedMimeType = `image/${mimeMatch[1]}`;
        }
      }
      base64Data = parts[parts.length - 1];
    }

    // Detect MIME type from image data
    const imageBuffer = Buffer.from(base64Data, 'base64');
    let actualMimeType = detectedMimeType || 'image/jpeg';
    
    if (imageBuffer.length >= 8 && 
        imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50 && 
        imageBuffer[2] === 0x4E && imageBuffer[3] === 0x47) {
      actualMimeType = 'image/png';
    } else if (imageBuffer.length >= 3 && 
               imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8 && imageBuffer[2] === 0xFF) {
      actualMimeType = 'image/jpeg';
    }

    if (actualMimeType === 'image/jpg') {
      actualMimeType = 'image/jpeg';
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
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
      return c.json({ error: `Claude API error: ${response.status} ${errorText}` }, response.status);
    }

    const data = await response.json();
    
    if (!data.content || !Array.isArray(data.content) || data.content.length === 0) {
      return c.json({ error: 'Invalid response from Claude API' }, 500);
    }

    const textBlock = data.content.find((block) => block.type === 'text');
    if (!textBlock) {
      return c.json({ error: 'No text content in Claude API response' }, 500);
    }

    return c.json({ text: textBlock.text });
  } catch (error) {
    console.error('Claude API proxy error:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// OpenAI API proxy endpoint
app.post('/api/openai', async (c) => {
  try {
    const { prompt, imageBase64, imageMime } = await c.req.json();

    const apiKey = getApiKey(['OPENAI_API_KEY', 'EXPO_PUBLIC_OPENAI_API_KEY']);
    
    if (!apiKey) {
      return c.json({ error: 'OPENAI_API_KEY is not set' }, 500);
    }

    // Remove data URI prefix if present
    let base64Data = imageBase64;
    if (typeof base64Data === 'string' && base64Data.includes(',')) {
      const parts = base64Data.split(',');
      base64Data = parts[parts.length - 1];
    }

    // Process image with sharp if available
    let processedImageBuffer;
    try {
      const sharp = require('sharp');
      const imageBuffer = Buffer.from(base64Data, 'base64');
      
      processedImageBuffer = await sharp(imageBuffer)
        .resize(1024, 1024, {
          fit: 'cover',
          position: 'center',
        })
        .png({
          quality: 90,
          compressionLevel: 9,
        })
        .toBuffer();
    } catch (error) {
      // Fallback to original image
      processedImageBuffer = Buffer.from(base64Data, 'base64');
    }

    // Create mask
    let maskBuffer;
    try {
      const sharp = require('sharp');
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
    } catch (error) {
      const maskSize = 1024;
      maskBuffer = Buffer.alloc(maskSize * maskSize * 4);
      maskBuffer.fill(255);
    }

    // Use FormData for multipart request
    const FormData = require('form-data');
    const formData = new FormData();
    
    formData.append('image', processedImageBuffer, { filename: 'image.png', contentType: 'image/png' });
    formData.append('mask', maskBuffer, { filename: 'mask.png', contentType: 'image/png' });
    formData.append('prompt', prompt);
    formData.append('n', '1');
    formData.append('size', '1024x1024');
    formData.append('response_format', 'b64_json');

    const editsResponse = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        ...formData.getHeaders(),
      },
      body: formData,
    });

    if (editsResponse.ok) {
      const editsData = await editsResponse.json();
      if (editsData.data?.[0]?.b64_json) {
        const editedImageData = editsData.data[0].b64_json;
        return c.json({ image: `data:image/png;base64,${editedImageData}` });
      }
    }

    const errorText = await editsResponse.text();
    return c.json({ error: `Image editing failed: ${editsResponse.status}` }, 500);
  } catch (error) {
    console.error('OpenAI API proxy error:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// Kie.ai API proxy endpoint
app.post('/api/kie', async (c) => {
  try {
    const { prompt, imageBase64, imageMime } = await c.req.json();

    const apiKey = process.env.KIE_API_KEY;
    
    if (!apiKey) {
      return c.json({ error: 'KIE_API_KEY is not set in environment variables' }, 500);
    }

    // Prepare base64 data
    let base64Data = imageBase64;
    let dataUri = imageBase64;
    
    if (typeof base64Data === 'string' && base64Data.includes(',')) {
      const parts = base64Data.split(',');
      base64Data = parts[parts.length - 1];
      dataUri = imageBase64;
    } else {
      const mimeType = imageMime || 'image/png';
      dataUri = `data:${mimeType};base64,${base64Data}`;
    }

    // Detect MIME type
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
      // Use provided MIME type
    }

    // Step 1: Upload base64
    let downloadUrl;
    const uploadResponse = await fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        base64Data: dataUri,
        uploadPath: 'images',
        fileName: `image_${Date.now()}.${actualMimeType === 'image/png' ? 'png' : 'jpg'}`,
      }),
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      return c.json({ error: `Upload failed: ${uploadResponse.status}` }, 500);
    }

    const uploadData = await uploadResponse.json();
    if (!uploadData.data?.downloadUrl) {
      return c.json({ error: 'Upload response missing downloadUrl' }, 500);
    }

    downloadUrl = uploadData.data.downloadUrl;

    // Step 2: Create edit task
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
      return c.json({ error: `Task creation failed: ${taskResponse.status}` }, 500);
    }

    const taskData = await taskResponse.json();
    if (!taskData.data?.taskId) {
      return c.json({ error: 'Task response missing taskId' }, 500);
    }

    const taskId = taskData.data.taskId;

    // Step 3: Poll for result
    const maxPollAttempts = 60;
    const pollInterval = 2000;
    let pollAttempt = 0;

    while (pollAttempt < maxPollAttempts) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      pollAttempt++;

      const pollResponse = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!pollResponse.ok) {
        continue;
      }

      const pollData = await pollResponse.json();
      const state = pollData.data?.state;

      if (state === 'success') {
        let resultJson;
        try {
          resultJson = typeof pollData.data.resultJson === 'string' 
            ? JSON.parse(pollData.data.resultJson)
            : pollData.data.resultJson;
        } catch (parseError) {
          resultJson = pollData.data;
        }

        const resultUrl = resultJson?.resultUrls?.[0] || resultJson?.resultUrl || pollData.data?.resultUrls?.[0];
        
        if (!resultUrl) {
          return c.json({ error: 'No result URL in task response' }, 500);
        }

        const imageResponse = await fetch(resultUrl);
        if (!imageResponse.ok) {
          return c.json({ error: `Failed to fetch result image: ${imageResponse.status}` }, 500);
        }

        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
        const imageBase64Result = imageBuffer.toString('base64');
        const imageDataUri = `data:image/png;base64,${imageBase64Result}`;

        return c.json({ image: imageDataUri });

      } else if (state === 'failed' || state === 'error') {
        const errorMsg = pollData.data?.error || pollData.data?.message || 'Task failed';
        return c.json({ error: `Task failed: ${errorMsg}` }, 500);
      } else if (state === 'pending' || state === 'processing' || state === 'running') {
        continue;
      }
    }

    return c.json({ error: 'Task polling timeout' }, 500);
  } catch (error) {
    console.error('Kie.ai API proxy error:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// Export for Vercel
module.exports = async (req, res) => {
  return app.fetch(req, res);
};
