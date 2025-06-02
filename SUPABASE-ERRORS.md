# Supabase Error Troubleshooting Guide

This document provides solutions for common Supabase errors, particularly with saving messages in the Ustaz AI Tutoring System.

## Common Error: Empty Error Object When Saving Messages

If you encounter the error `Supabase error when saving message: {}`, follow these troubleshooting steps:

### 1. Check Supabase Environment Variables

Ensure your `.env.local` file has the correct Supabase configuration:

```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

You can verify these values are correctly loaded by checking the application logs or by temporarily adding a debug log to print `isSupabaseConfigured` in the `lib/supabase.ts` file.

### 2. Verify Database Tables Structure

Run the `check-database-tables.sql` script in the Supabase SQL Editor to verify your table structure matches the expected schema.

### 3. Fix Database Permissions

Run the `fix-chat-messages-permissions.sql` script in the Supabase SQL Editor to ensure proper Row Level Security (RLS) policies are in place.

### 4. Common Issues

1. **Foreign Key Constraints**: Make sure the subject exists before trying to save a message linked to it.
2. **Authentication Issues**: Check if the user is properly authenticated and the token is valid.
3. **Row Level Security (RLS) Blocking**: RLS policies might prevent inserts if not properly configured.
4. **Schema Changes**: If you've modified the database schema, ensure the application code matches.

### 5. Check Browser Console for Detailed Errors

We've added additional logging. Check your browser's developer console for more detailed error information.

## Running the Diagnostics Scripts

1. Open your Supabase dashboard
2. Navigate to the SQL Editor
3. Open the SQL file (`check-database-tables.sql` or `fix-chat-messages-permissions.sql`)
4. Click "Run" to execute the script
5. Review the results

## Testing Message Persistence

To manually test message persistence:

1. Open your browser console (F12)
2. Navigate to your Ustaz application
3. Select a subject and send a test message
4. Check the console logs for any errors
5. Verify in Supabase Table Editor if the message was saved

## Getting Support

If you're still experiencing issues after trying these solutions:

1. Gather the full error message from browser console
2. Note when exactly the error occurs
3. Check Supabase logs for any related errors
4. Submit an issue with all the collected information 