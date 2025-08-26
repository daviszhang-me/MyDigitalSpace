-- KnowledgeHub PostgreSQL Schema
-- Run this script to set up your database

-- Enable UUID extension for better ID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table for authentication
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Notes table for knowledge management
CREATE TABLE notes (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('ideas', 'projects', 'learning', 'resources')),
    tags TEXT[] DEFAULT '{}',
    is_archived BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table for JWT token management (optional but recommended)
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX idx_notes_user_id ON notes(user_id);
CREATE INDEX idx_notes_category ON notes(category);
CREATE INDEX idx_notes_created_at ON notes(created_at DESC);
CREATE INDEX idx_notes_tags ON notes USING GIN(tags);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

-- Trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to tables
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notes_updated_at 
    BEFORE UPDATE ON notes 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sample data for testing (optional)
-- INSERT INTO users (email, name, password_hash) 
-- VALUES ('demo@knowledgehub.com', 'Demo User', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LwlAl2nH8vK5N3RYG');

-- Workflows table for workflow management
CREATE TABLE workflows (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category VARCHAR(50) DEFAULT 'general',
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
    priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    tags TEXT[] DEFAULT '{}',
    due_date TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    is_template BOOLEAN DEFAULT false,
    template_name VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Workflow steps table for step-by-step processes
CREATE TABLE workflow_steps (
    id BIGSERIAL PRIMARY KEY,
    workflow_id BIGINT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped', 'blocked')),
    step_order INTEGER NOT NULL DEFAULT 0,
    due_date TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    assignee VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Workflow attachments table for linking notes and resources
CREATE TABLE workflow_attachments (
    id BIGSERIAL PRIMARY KEY,
    workflow_id BIGINT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    attachment_type VARCHAR(20) NOT NULL CHECK (attachment_type IN ('note', 'url', 'file')),
    attachment_id BIGINT, -- References notes.id when type is 'note'
    url TEXT,
    title TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Workflow templates table for pre-defined workflows
CREATE TABLE workflow_templates (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) DEFAULT 'general',
    tags TEXT[] DEFAULT '{}',
    is_public BOOLEAN DEFAULT false,
    template_data JSONB NOT NULL, -- Stores workflow and steps structure
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for workflow tables
CREATE INDEX idx_workflows_user_id ON workflows(user_id);
CREATE INDEX idx_workflows_status ON workflows(status);
CREATE INDEX idx_workflows_category ON workflows(category);
CREATE INDEX idx_workflows_due_date ON workflows(due_date);
CREATE INDEX idx_workflows_created_at ON workflows(created_at DESC);
CREATE INDEX idx_workflows_tags ON workflows USING GIN(tags);
CREATE INDEX idx_workflows_is_template ON workflows(is_template);

CREATE INDEX idx_workflow_steps_workflow_id ON workflow_steps(workflow_id);
CREATE INDEX idx_workflow_steps_status ON workflow_steps(status);
CREATE INDEX idx_workflow_steps_step_order ON workflow_steps(step_order);
CREATE INDEX idx_workflow_steps_due_date ON workflow_steps(due_date);

CREATE INDEX idx_workflow_attachments_workflow_id ON workflow_attachments(workflow_id);
CREATE INDEX idx_workflow_attachments_type ON workflow_attachments(attachment_type);
CREATE INDEX idx_workflow_attachments_attachment_id ON workflow_attachments(attachment_id);

CREATE INDEX idx_workflow_templates_user_id ON workflow_templates(user_id);
CREATE INDEX idx_workflow_templates_category ON workflow_templates(category);
CREATE INDEX idx_workflow_templates_is_public ON workflow_templates(is_public);

-- Apply update triggers to workflow tables
CREATE TRIGGER update_workflows_updated_at 
    BEFORE UPDATE ON workflows 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_steps_updated_at 
    BEFORE UPDATE ON workflow_steps 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_templates_updated_at 
    BEFORE UPDATE ON workflow_templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- View for user statistics (updated to include workflows)
CREATE VIEW user_note_stats AS
SELECT 
    u.id as user_id,
    u.name,
    COUNT(n.id) as total_notes,
    COUNT(CASE WHEN n.category = 'ideas' THEN 1 END) as ideas_count,
    COUNT(CASE WHEN n.category = 'projects' THEN 1 END) as projects_count,
    COUNT(CASE WHEN n.category = 'learning' THEN 1 END) as learning_count,
    COUNT(CASE WHEN n.category = 'resources' THEN 1 END) as resources_count,
    COUNT(DISTINCT unnest(n.tags)) as unique_tags_count,
    MAX(n.updated_at) as last_note_update
FROM users u
LEFT JOIN notes n ON u.id = n.user_id AND n.is_archived = false
GROUP BY u.id, u.name;

-- View for workflow statistics
CREATE VIEW user_workflow_stats AS
SELECT 
    u.id as user_id,
    u.name,
    COUNT(w.id) as total_workflows,
    COUNT(CASE WHEN w.status = 'draft' THEN 1 END) as draft_workflows,
    COUNT(CASE WHEN w.status = 'active' THEN 1 END) as active_workflows,
    COUNT(CASE WHEN w.status = 'completed' THEN 1 END) as completed_workflows,
    COUNT(CASE WHEN w.status = 'archived' THEN 1 END) as archived_workflows,
    COUNT(CASE WHEN w.priority = 'urgent' THEN 1 END) as urgent_workflows,
    COUNT(CASE WHEN w.priority = 'high' THEN 1 END) as high_priority_workflows,
    COUNT(DISTINCT unnest(w.tags)) as unique_workflow_tags,
    MAX(w.updated_at) as last_workflow_update
FROM users u
LEFT JOIN workflows w ON u.id = w.user_id AND w.status != 'archived'
GROUP BY u.id, u.name;