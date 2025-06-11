-- Ustaz AI Tutoring System Database Schema
-- This is the consolidated schema file for the entire database structure

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

-- Profiles table for user information
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Assistant settings table - stores global AI assistant configuration
CREATE TABLE ai_assistant_settings (
  id SERIAL PRIMARY KEY,
  assistant_id TEXT NOT NULL,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

-- Table for persisting full TutorContext per user and subject
CREATE TABLE IF NOT EXISTS tutor_contexts (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id VARCHAR(255) NOT NULL,
  context_json JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, subject_id)
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Profile indexes
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- AI Assistant settings indexes
CREATE INDEX IF NOT EXISTS idx_ai_assistant_active ON ai_assistant_settings(is_active);
CREATE INDEX IF NOT EXISTS idx_ai_assistant_subject ON ai_assistant_settings(subject_id);

-- Subject indexes
CREATE INDEX IF NOT EXISTS idx_subjects_user_id ON subjects(user_id);
CREATE INDEX IF NOT EXISTS idx_subjects_last_active ON subjects(user_id, last_active DESC);

-- Chat message indexes
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_subject ON chat_messages(user_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_messages(subject_id, timestamp);

-- Content feed indexes
CREATE INDEX IF NOT EXISTS idx_content_feed_user_subject ON content_feed(user_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_content_feed_order ON content_feed(subject_id, order_index);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_assistant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_feed ENABLE ROW LEVEL SECURITY;

-- Profile policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- AI Assistant settings policies (read-only for all authenticated users)
CREATE POLICY "All authenticated users can view AI settings" ON ai_assistant_settings FOR SELECT USING (auth.role() = 'authenticated');

-- Subject policies
CREATE POLICY "Users can view own subjects" ON subjects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own subjects" ON subjects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own subjects" ON subjects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own subjects" ON subjects FOR DELETE USING (auth.uid() = user_id);

-- Chat message policies
CREATE POLICY "Users can view own chat messages" ON chat_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own chat messages" ON chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own chat messages" ON chat_messages FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own chat messages" ON chat_messages FOR DELETE USING (auth.uid() = user_id);

-- Content feed policies
CREATE POLICY "Users can view own content feed" ON content_feed FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own content feed" ON content_feed FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own content feed" ON content_feed FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own content feed" ON content_feed FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================

-- Function to automatically create user profile
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;   
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger
CREATE TRIGGER update_profiles_updated_at 
  BEFORE UPDATE ON profiles 
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_ai_assistant_settings_updated_at 
  BEFORE UPDATE ON ai_assistant_settings 
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Function to clean up old data
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

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE profiles IS 'Stores user profile information';
COMMENT ON TABLE ai_assistant_settings IS 'Stores per-subject AI assistant configuration and OpenAI assistant IDs';
COMMENT ON TABLE subjects IS 'Stores learning subjects/topics with lesson plans and progress';
COMMENT ON TABLE chat_messages IS 'Stores conversation history between user and AI tutor';
COMMENT ON TABLE content_feed IS 'Stores interactive learning components in chronological order';
COMMENT ON FUNCTION cleanup_old_data() IS 'Cleans up data older than 90 days for inactive subjects'; 