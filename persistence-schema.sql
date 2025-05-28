-- Persistence Schema for Ustaz AI Tutoring System
-- Run this SQL in Supabase SQL Editor

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist (for development)
DROP TABLE IF EXISTS content_feed CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS subjects CASCADE;

-- Subjects table - stores learning subjects/topics
CREATE TABLE subjects (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    keywords TEXT[] DEFAULT '{}',
    lesson_plan JSONB,
    learning_progress JSONB,
    last_active TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chat messages table - stores conversation history
CREATE TABLE chat_messages (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL,
    subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    has_generated_content BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Content feed table - stores interactive learning components
CREATE TABLE content_feed (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL,
    subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN (
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
    )),
    data JSONB NOT NULL,
    title TEXT NOT NULL,
    order_index INTEGER NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX idx_subjects_user_id ON subjects(user_id);
CREATE INDEX idx_subjects_last_active ON subjects(user_id, last_active DESC);

CREATE INDEX idx_chat_messages_user_subject ON chat_messages(user_id, subject_id);
CREATE INDEX idx_chat_messages_timestamp ON chat_messages(subject_id, timestamp);

CREATE INDEX idx_content_feed_user_subject ON content_feed(user_id, subject_id);
CREATE INDEX idx_content_feed_order ON content_feed(subject_id, order_index);

-- Row Level Security (RLS) policies
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_feed ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subjects
CREATE POLICY "Users can view own subjects" ON subjects
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subjects" ON subjects
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subjects" ON subjects
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own subjects" ON subjects
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for chat_messages
CREATE POLICY "Users can view own chat messages" ON chat_messages
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat messages" ON chat_messages
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chat messages" ON chat_messages
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chat messages" ON chat_messages
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for content_feed
CREATE POLICY "Users can view own content feed" ON content_feed
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own content feed" ON content_feed
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own content feed" ON content_feed
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own content feed" ON content_feed
    FOR DELETE USING (auth.uid() = user_id);

-- Optional: Create a function to clean up old data (run periodically)
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
    -- Delete content and messages older than 90 days for inactive subjects
    DELETE FROM content_feed 
    WHERE subject_id IN (
        SELECT id FROM subjects 
        WHERE last_active < NOW() - INTERVAL '90 days'
    );
    
    DELETE FROM chat_messages 
    WHERE subject_id IN (
        SELECT id FROM subjects 
        WHERE last_active < NOW() - INTERVAL '90 days'
    );
    
    -- Delete inactive subjects older than 90 days
    DELETE FROM subjects 
    WHERE last_active < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE subjects IS 'Stores learning subjects/topics with lesson plans and progress';
COMMENT ON TABLE chat_messages IS 'Stores conversation history between user and AI tutor';
COMMENT ON TABLE content_feed IS 'Stores interactive learning components in chronological order';
COMMENT ON FUNCTION cleanup_old_data() IS 'Cleans up data older than 90 days for inactive subjects'; 