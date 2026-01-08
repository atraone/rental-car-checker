/**
 * Kie.ai image editing service
 * Uses nano banana model for image editing
 * Calls backend proxy endpoint to avoid CORS issues
 */

export interface KieImageInput {
  prompt: string;
  imageBase64: string;
  imageMime: string;
}

import { getApiBaseUrl } from '@/lib/apiBaseUrl';

export async function generateImageWithKie(input: KieImageInput): Promise<string> {
  const baseUrl = getApiBaseUrl();
  const apiUrl = `${baseUrl}/api/kie`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: input.prompt,
      imageBase64: input.imageBase64,
      imageMime: input.imageMime,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `HTTP error: ${response.status}`);
  }

  const data = await response.json();
  
  if (!data.image) {
    throw new Error('No image in response from Kie.ai API');
  }

  return data.image;
}
