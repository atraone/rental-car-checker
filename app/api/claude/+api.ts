/**
 * WARNING: This Expo Router API route is ONLY for local development.
 * 
 * In production, all API calls MUST go through the backend at https://atra.one
 * to ensure API keys are never exposed to the frontend.
 * 
 * The frontend services (services/claude.ts) use getApiBaseUrl() which
 * automatically routes to atra.one in production builds.
 */
export async function POST(req: Request) {
  // Block direct API calls in production - force use of backend
  if (process.env.NODE_ENV === 'production' || process.env.EXPO_PUBLIC_ENV === 'production') {
    return Response.json({ 
      error: 'Direct API calls are disabled in production. Use the backend at https://atra.one' 
    }, { status: 403 });
  }

  try {
    const { promptText, imageBase64, imageMime } = await req.json();

    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.EXPO_PUBLIC_CLAUDE_API_KEY;
    
    if (!apiKey) {
      return Response.json({ error: 'ANTHROPIC_API_KEY is not set' }, { status: 500 });
    }

    // Determine MIME type for API
    let mimeType = imageMime;
    if (!mimeType || mimeType === 'image/jpg') {
      mimeType = 'image/jpeg';
    }

    // Remove data URI prefix if present
    let base64Data = imageBase64;
    if (base64Data.includes(',')) {
      base64Data = base64Data.split(',')[1];
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20240620',
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
                  media_type: mimeType,
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
      return Response.json({ error: `Claude API error: ${response.status} ${errorText}` }, { status: response.status });
    }

    const data = await response.json();
    
    if (!data.content || !Array.isArray(data.content) || data.content.length === 0) {
      return Response.json({ error: 'Invalid response from Claude API' }, { status: 500 });
    }

    // Extract text from the first text block
    const textBlock = data.content.find((block: any) => block.type === 'text');
    if (!textBlock) {
      return Response.json({ error: 'No text content in Claude API response' }, { status: 500 });
    }

    return Response.json({ text: textBlock.text });
  } catch (error: any) {
    console.error('Claude API proxy error:', error);
    return Response.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

