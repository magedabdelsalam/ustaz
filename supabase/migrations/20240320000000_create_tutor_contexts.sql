-- Create tutor_contexts table
CREATE TABLE IF NOT EXISTS tutor_contexts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject_id TEXT NOT NULL,
    context_json JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, subject_id)
);

-- Enable Row Level Security
ALTER TABLE tutor_contexts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own tutor contexts"
    ON tutor_contexts
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tutor contexts"
    ON tutor_contexts
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tutor contexts"
    ON tutor_contexts
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tutor_contexts_user_subject 
    ON tutor_contexts(user_id, subject_id);

-- Create function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_tutor_contexts_updated_at
    BEFORE UPDATE ON tutor_contexts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 