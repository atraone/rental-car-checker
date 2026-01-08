export async function POST(req: Request) {
  try {
    const { prompt, imageBase64, imageMime, aspectRatio } = await req.json();

    const apiKey = process.env.OPENAI_API_KEY || process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    
    if (!apiKey) {
      return Response.json({ error: 'OPENAI_API_KEY is not set' }, { status: 500 });
    }

    // Map aspect ratio to DALL-E size
    let size: '1024x1024' | '1792x1024' | '1024x1792' = '1024x1024';
    if (aspectRatio === '16:9') {
      size = '1792x1024';
    } else if (aspectRatio === '9:16') {
      size = '1024x1792';
    }

    // Use DALL-E 3 for image generation
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: size,
        quality: 'standard',
        response_format: 'b64_json',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return Response.json({ error: `OpenAI API error: ${response.status} ${errorText}` }, { status: response.status });
    }

    const data = await response.json();
    
    if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
      return Response.json({ error: 'Invalid response from OpenAI API' }, { status: 500 });
    }

    const imageData = data.data[0];
    if (!imageData.b64_json) {
      return Response.json({ error: 'No base64 image data in OpenAI API response' }, { status: 500 });
    }

    // Return as data URI
    return Response.json({ image: `data:image/png;base64,${imageData.b64_json}` });
  } catch (error: any) {
    console.error('OpenAI API proxy error:', error);
    return Response.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

