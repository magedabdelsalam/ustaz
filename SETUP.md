# Environment Setup

## Required Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# OpenAI Configuration (optional)
OPENAI_API_KEY=your_openai_api_key_here

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Getting Supabase Credentials

1. Go to [supabase.com](https://supabase.com) and create an account
2. Create a new project
3. Go to Settings > API
4. Copy the Project URL and anon/public key
5. Go to Settings > API > Service Role keys to get the service role key

## Getting OpenAI API Key (Optional)

1. Go to [platform.openai.com](https://platform.openai.com)
2. Create an account and add billing
3. Go to API Keys section
4. Create a new secret key

Note: The app works without OpenAI integration using simulated responses for development. 