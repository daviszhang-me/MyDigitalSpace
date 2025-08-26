-- SQLite Schema for MyDigitalSpace
-- This file creates all necessary tables for the application

-- Users table for authentication and user management
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user', 'guest')),
    is_active INTEGER DEFAULT 1,
    can_create_notes INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Notes table for knowledge management
CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'ideas' CHECK (category IN ('ideas', 'projects', 'learning', 'resources')),
    tags TEXT DEFAULT '[]', -- JSON array as text
    is_archived INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User sessions table for session management
CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    user_agent TEXT
);

-- Workflows table for workflow management
CREATE TABLE IF NOT EXISTS workflows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'general',
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    tags TEXT DEFAULT '[]', -- JSON array as text
    due_date DATETIME,
    completed_at DATETIME,
    is_template INTEGER DEFAULT 0,
    template_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Workflow steps table for step-by-step processes
CREATE TABLE IF NOT EXISTS workflow_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped', 'blocked')),
    step_order INTEGER NOT NULL DEFAULT 0,
    due_date DATETIME,
    completed_at DATETIME,
    assignee TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Workflow attachments table for linking notes and resources
CREATE TABLE IF NOT EXISTS workflow_attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    attachment_type TEXT NOT NULL CHECK (attachment_type IN ('note', 'url', 'file')),
    attachment_id INTEGER, -- References notes.id when type is 'note'
    url TEXT,
    title TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Workflow templates table for pre-defined workflows
CREATE TABLE IF NOT EXISTS workflow_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'general',
    tags TEXT DEFAULT '[]', -- JSON array as text
    is_public INTEGER DEFAULT 0,
    template_data TEXT NOT NULL, -- JSON as text
    usage_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_category ON notes(category);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_is_archived ON notes(is_archived);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflows_category ON workflows(category);
CREATE INDEX IF NOT EXISTS idx_workflows_due_date ON workflows(due_date);
CREATE INDEX IF NOT EXISTS idx_workflows_created_at ON workflows(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflows_is_template ON workflows(is_template);

CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow_id ON workflow_steps(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_status ON workflow_steps(status);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_step_order ON workflow_steps(step_order);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_due_date ON workflow_steps(due_date);

CREATE INDEX IF NOT EXISTS idx_workflow_attachments_workflow_id ON workflow_attachments(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_attachments_type ON workflow_attachments(attachment_type);
CREATE INDEX IF NOT EXISTS idx_workflow_attachments_attachment_id ON workflow_attachments(attachment_id);

CREATE INDEX IF NOT EXISTS idx_workflow_templates_user_id ON workflow_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_category ON workflow_templates(category);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_is_public ON workflow_templates(is_public);

-- Create triggers for updating updated_at timestamps (SQLite version)
CREATE TRIGGER IF NOT EXISTS update_notes_updated_at 
    AFTER UPDATE ON notes 
    FOR EACH ROW 
    BEGIN 
        UPDATE notes SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; 
    END;

CREATE TRIGGER IF NOT EXISTS update_workflows_updated_at 
    AFTER UPDATE ON workflows 
    FOR EACH ROW 
    BEGIN 
        UPDATE workflows SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; 
    END;

CREATE TRIGGER IF NOT EXISTS update_workflow_steps_updated_at 
    AFTER UPDATE ON workflow_steps 
    FOR EACH ROW 
    BEGIN 
        UPDATE workflow_steps SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; 
    END;

CREATE TRIGGER IF NOT EXISTS update_workflow_templates_updated_at 
    AFTER UPDATE ON workflow_templates 
    FOR EACH ROW 
    BEGIN 
        UPDATE workflow_templates SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; 
    END;

-- Create demo user if not exists (for development)
INSERT OR IGNORE INTO users (id, email, name, password_hash, role) 
VALUES (
    'demo-user-123', 
    'demo@knowledgehub.com', 
    'Demo User', 
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LwlAl2nH8vK5N3RYG',
    'user'
);