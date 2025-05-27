export function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is not set`);
  }
  return value;
}

export const OPENAI_API_KEY = getEnv('OPENAI_API_KEY');
export const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

