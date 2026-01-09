/**
 * Claude API service for text+vision analysis
 * 
 * IMPORTANT: This calls the backend at https://atra.one/api/rental-car/claude
 * which requires JWT authentication and validates subscription status.
 * 
 * The backend endpoint:
 * - Validates user's JWT with Supabase
 * - Checks for active subscription or testing user status
 * - Forwards request to Anthropic Claude API
 * - Returns the text response
 */

import { getApiBaseUrl } from '@/lib/apiBaseUrl';
import { supabase } from '@/lib/supabase';

export interface ClaudeAnalysisInput {
  promptText: string;
  imageBase64: string;
  imageMime: string;
}

export async function analyzeWithClaude(input: ClaudeAnalysisInput): Promise<string> {
  const baseUrl = getApiBaseUrl();
  const apiUrl = `${baseUrl}/api/rental-car/claude`;

  // Get current session for JWT
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !session) {
    throw new Error('User not authenticated');
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
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
