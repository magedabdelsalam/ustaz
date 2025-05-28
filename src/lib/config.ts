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
export const OPENAI_MODEL = process.env.NEXT_PUBLIC_OPENAI_MODEL || 'gpt-4o-mini';

