-- Migration: Update content_feed table to support new interactive component types
-- Run this SQL in your Supabase SQL Editor to fix the content_feed_type_check constraint

-- First, drop the existing check constraint
ALTER TABLE content_feed DROP CONSTRAINT IF EXISTS content_feed_type_check;

-- Add the new check constraint with all supported component types
ALTER TABLE content_feed ADD CONSTRAINT content_feed_type_check 
    CHECK (type IN (
        'multiple-choice', 
        'concept-card', 
        'step-solver', 
        'fill-blank', 
        'drag-drop',
        'explainer',
        'interactive-example',
        'progress-quiz',
        'graph-visualizer',
        'text-highlighter',
        'formula-explorer'
    ));

-- Verify the constraint was applied successfully
SELECT 
    con.conname AS constraint_name,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE rel.relname = 'content_feed' 
    AND con.contype = 'c'
    AND con.conname = 'content_feed_type_check'; 