-- Debug Permissive Policy for chat_messages
-- This script adds a temporary permissive policy for debugging message insertion issues
-- WARNING: This reduces security - only use for debugging and remove when done

-- First check if the policy already exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'chat_messages' 
        AND policyname = 'Debug permissive insert for chat_messages'
    ) THEN
        EXECUTE 'CREATE POLICY "Debug permissive insert for chat_messages" 
                ON chat_messages 
                FOR INSERT 
                WITH CHECK (true)';
        RAISE NOTICE 'Created permissive debug policy for chat_messages';
    ELSE
        RAISE NOTICE 'Debug policy already exists for chat_messages';
    END IF;
END
$$;

-- Check if our policy was added
SELECT 
    policyname, 
    permissive, 
    cmd, 
    CASE cmd 
        WHEN 'r' THEN 'SELECT'
        WHEN 'a' THEN 'INSERT'
        WHEN 'w' THEN 'UPDATE'
        WHEN 'd' THEN 'DELETE'
        ELSE cmd::text
    END as operation
FROM 
    pg_policies
WHERE 
    tablename = 'chat_messages'
ORDER BY 
    cmd, 
    policyname;

-- To remove this policy after you're done debugging, run:
-- DROP POLICY "Debug permissive insert for chat_messages" ON chat_messages; 