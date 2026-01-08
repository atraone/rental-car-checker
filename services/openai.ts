/**
 * OpenAI image generation/editing service
 * 
 * IMPORTANT: In production, this ALWAYS calls the backend at https://atra.one
 * to ensure API keys are never exposed to the frontend.
 * 
 * The backend proxy endpoint handles all external API calls securely.
 */

export interface OpenAIImageInput {
  prompt: string;
  imageBase64: string;
  imageMime: string;
  aspectRatio?: '1:1' | '16:9' | '9:16';
}

import { getApiBaseUrl } from '@/lib/apiBaseUrl';

export async function generateImageWithOpenAI(input: OpenAIImageInput): Promise<string> {
  const baseUrl = getApiBaseUrl();
  const apiUrl = `${baseUrl}/api/openai`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: input.prompt,
      imageBase64: input.imageBase64,
      imageMime: input.imageMime,
      aspectRatio: input.aspectRatio,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `HTTP error: ${response.status}`);
  }

  const data = await response.json();
  
  if (!data.image) {
    throw new Error('No image in response from OpenAI API');
  }

  return data.image;
}

