/**
 * Claude API service for text+vision analysis
 * 
 * IMPORTANT: In production, this ALWAYS calls the backend at https://atra.one
 * to ensure API keys are never exposed to the frontend.
 * 
 * The backend proxy endpoint handles all external API calls securely.
 */

export interface ClaudeAnalysisInput {
  promptText: string;
  imageBase64: string;
  imageMime: string;
}

import { getApiBaseUrl } from '@/lib/apiBaseUrl';

export async function analyzeWithClaude(input: ClaudeAnalysisInput): Promise<string> {
  const baseUrl = getApiBaseUrl();
  const apiUrl = `${baseUrl}/api/claude`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      promptText: input.promptText,
      imageBase64: input.imageBase64,
      imageMime: input.imageMime,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `HTTP error: ${response.status}`);
  }

  const data = await response.json();
  
  if (!data.text) {
    throw new Error('No text in response from Claude API');
  }

  return data.text;
}

