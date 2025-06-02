# How to Fix Interactive Components in Ustaz

This guide explains how to fix the issue where interactive components were not being created by the AI Tutor.

## 1. Fix Database Permissions

The primary issue is a database row-level security policy error that prevented the AI service from saving assistants to the `ai_assistant_settings` table.

1. Run the SQL in `fix-ai-assistant-permissions.sql` in your Supabase SQL Editor:
   - This adds INSERT and UPDATE policies for the ai_assistant_settings table

## 2. Code Changes

We've made several changes to ensure the AI prioritizes creating interactive components:

1. Updated `src/components/ChatPane.tsx`:
   - Added instructionOverrides to the useAITutor options
   - Set preferInteractiveContent to true
   - Added specific guidelines for interactive components

2. Updated `src/hooks/useAITutor.ts`:
   - Added instructionOverrides to the UseAITutorOptions interface
   - Modified sendMessage and sendMessageWithMetadata to pass instructionOverrides to the API

3. Updated `src/lib/ai-tutor-service.ts`:
   - Set default instructionOverrides in the constructor
   - Added strong guidelines for interactive content priority

4. Enhanced `src/app/api/openai/route.ts`:
   - Added better logging for context and interactive component detection

## 3. Testing the Fix

After applying these changes:

1. Restart your development server with `npm run dev`
2. Try a new conversation about a math topic like quadratic equations
3. The AI should now create interactive components instead of only text responses

## Troubleshooting

If interactive components still don't appear:

1. Check the browser console and server logs for errors
2. Verify that the SQL policies were applied successfully
3. Check that the OpenAI model being used supports function calling (most do)
4. Try clearing your browser cache or starting a new conversation

## Technical Details of the Fix

1. **Database Issue**: The AI service couldn't save assistant settings because there was no INSERT policy for the `ai_assistant_settings` table.

2. **Context Issue**: The AI wasn't being instructed to prioritize interactive components because the `instructionOverrides.preferInteractiveContent` flag wasn't being set.

3. **Tool Call Issue**: The logs showed 0 tool calls being made, meaning the AI wasn't using the function calling capability to create interactive components.

# Fixing OpenAI Assistant Permissions in Ustaz

This guide addresses the row-level security (RLS) policy error and foreign key constraint issues that occur when saving OpenAI assistants to the database.

## Issue 1: RLS Policy Violation

**Error message:** `new row violates row-level security policy for table "ai_assistant_settings"`

**Cause:** The `ai_assistant_settings` table has RLS enabled but is missing INSERT and UPDATE policies.

**Solution:** Run the following SQL in your Supabase database:

```sql
-- Check if INSERT policy exists before creating it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'ai_assistant_settings' 
        AND policyname = 'Allow server to insert AI assistant settings'
    ) THEN
        EXECUTE 'CREATE POLICY "Allow server to insert AI assistant settings" 
                ON ai_assistant_settings 
                FOR INSERT 
                WITH CHECK (true)';
    END IF;
END
$$;

-- Check if UPDATE policy exists before creating it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'ai_assistant_settings' 
        AND policyname = 'Allow server to update AI assistant settings'
    ) THEN
        EXECUTE 'CREATE POLICY "Allow server to update AI assistant settings" 
                ON ai_assistant_settings 
                FOR UPDATE
                USING (true)';
    END IF;
END
$$;
```

## Issue 2: Foreign Key Constraint Violation

**Error message:** `insert or update on table "ai_assistant_settings" violates foreign key constraint "ai_assistant_settings_subject_id_fkey"`

**Cause:** When a new subject is being created, the OpenAI assistant is attempting to save before the subject record is properly created and committed to the database.

**Solution Options:**

### Option 1: Code Fix

Modify the `persistenceService.ts` file to ensure subjects exist before saving assistants:

```typescript
async saveAssistantForSubject(settings: {
  assistant_id: string
  subject_id: string
  model: string
  name: string
}): Promise<AIAssistantSettings | null> {
  try {
    // First, check if the subject exists, and if not, create a placeholder
    const { data: existingSubject } = await supabase
      .from('subjects')
      .select('id')
      .eq('id', settings.subject_id)
      .maybeSingle();
      
    if (!existingSubject) {
      // Subject doesn't exist yet - wait or handle appropriately
      logger.warn(`Subject ${settings.subject_id} doesn't exist yet. Cannot save assistant.`);
      return null;
    }
    
    // Continue with the original code...
    // Deactivate any existing assistants for this subject
    await supabase
      .from('ai_assistant_settings')
      .update({ is_active: false })
      .eq('subject_id', settings.subject_id)
      .eq('is_active', true);
    
    // Insert new active assistant for this subject
    const { data, error } = await supabase
      .from('ai_assistant_settings')
      .insert({
        assistant_id: settings.assistant_id,
        subject_id: settings.subject_id,
        model: settings.model,
        name: settings.name,
        is_active: true
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Failed to save assistant for subject:', error);
    return null;
  }
}
```

### Option 2: Modify AI Tutor Service Order of Operations

Ensure the subject is created and committed to the database before trying to create and save the assistant:

1. In `ai-tutor-service.ts`, modify the `initializeAssistantForSubject` method to check for subject existence:

```typescript
private async initializeAssistantForSubject(subjectId: string, subjectName: string): Promise<void> {
  if (!this.openai) {
    console.log('❌ Cannot initialize assistant: OpenAI client not available');
    return;
  }

  try {
    // First check if the subject exists in the database
    const subjectExists = await persistenceService.checkSubjectExists(subjectId);
    if (!subjectExists) {
      console.log(`⚠️ Subject ${subjectId} does not exist in the database yet. Delaying assistant creation.`);
      return;
    }
    
    // Rest of the existing code...
```

2. Add the helper method to persistenceService:

```typescript
async checkSubjectExists(subjectId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('subjects')
      .select('id')
      .eq('id', subjectId)
      .maybeSingle();
      
    if (error) throw error;
    return !!data;
  } catch (error) {
    logger.error('Failed to check subject existence:', error);
    return false;
  }
}
```

### Option 3: Database Schema Change

Make the foreign key constraint deferrable, so it's only checked at the end of transactions:

```sql
-- Make the foreign key constraint deferrable
ALTER TABLE ai_assistant_settings DROP CONSTRAINT ai_assistant_settings_subject_id_fkey;
ALTER TABLE ai_assistant_settings ADD CONSTRAINT ai_assistant_settings_subject_id_fkey 
  FOREIGN KEY (subject_id) REFERENCES subjects(id) DEFERRABLE INITIALLY DEFERRED;
```

## Recommended Approach

1. Fix the RLS policies first (Option 1 above)
2. Implement the code fix in persistenceService.ts (Option 1 in the second section)
3. Restart your application

This ensures both problems are fixed correctly without making schema changes that might affect other parts of your application. 