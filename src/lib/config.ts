/**
 * config
 * ----------------
 * TODO: Add description and exports for config.
 */

export function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is not set`);
  }
  return value;
}

export function getOptionalEnv(name: string): string | undefined {
  return process.env[name];
}

export const OPENAI_API_KEY = getOptionalEnv('OPENAI_API_KEY');
// Updated to GPT-5 Nano: $0.05 per million input tokens, $0.40 per million output tokens
// Cheapest model available (Oct 2025) - perfect for educational content
export const OPENAI_MODEL = process.env.NEXT_PUBLIC_OPENAI_MODEL || 'gpt-5-nano';

