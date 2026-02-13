-- 027_rag_assistant.sql
-- RAG-powered AI Research Assistant: document chunks with full-text search, conversations, messages

-- Document chunks with full-text search for retrieval
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  token_count INTEGER NOT NULL DEFAULT 0,
  search_vector TSVECTOR,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_document_chunks_search_vector
  ON document_chunks USING GIN (search_vector);

CREATE INDEX IF NOT EXISTS idx_document_chunks_file_id ON document_chunks(file_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_project_id ON document_chunks(project_id);

-- AI conversations
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL DEFAULT 'New Conversation',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_project_id ON ai_conversations(project_id);

-- AI messages within conversations
CREATE TABLE IF NOT EXISTS ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  citations JSONB DEFAULT '[]',
  token_usage JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id ON ai_messages(conversation_id);

-- Add indexing columns to files table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'files' AND column_name = 'indexing_status') THEN
    ALTER TABLE files ADD COLUMN indexing_status VARCHAR(20) DEFAULT 'pending';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'files' AND column_name = 'indexing_error') THEN
    ALTER TABLE files ADD COLUMN indexing_error TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'files' AND column_name = 'indexed_at') THEN
    ALTER TABLE files ADD COLUMN indexed_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'files' AND column_name = 'chunk_count') THEN
    ALTER TABLE files ADD COLUMN chunk_count INTEGER DEFAULT 0;
  END IF;
END $$;
