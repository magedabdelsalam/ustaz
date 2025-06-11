// Client-side AI Tutor service that communicates with the server-side API
// No longer directly instantiates AITutorService to avoid client-side OpenAI instantiation

export interface AITutorClientResponse {
  response: string;
  toolCalls: Array<{
    name: string;
    parameters: Record<string, unknown>;
    result: Record<string, unknown>;
  }>;
  context: any;
  simulated?: boolean;
  message?: string;
}

export class AITutorClient {
  async generateResponse(message: string, context: any, userId?: string): Promise<AITutorClientResponse> {
    const response = await fetch('/api/openai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        context,
        userId,
        sessionId: `session-${Date.now()}`,
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    return await response.json();
  }
}

let aiTutorClientInstance: AITutorClient | null = null;

export function useAITutorService() {
  if (!aiTutorClientInstance) {
    aiTutorClientInstance = new AITutorClient();
  }
  return aiTutorClientInstance;
} 