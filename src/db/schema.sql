-- no602 CRM schema
-- Run with: psql $DATABASE_URL -f src/db/schema.sql
-- Or use the auto-migration via the ensureTables() server function.

-- leads: primary CRM entity
CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT,
  email TEXT,
  phone TEXT,
  service_type TEXT CHECK (service_type IN ('post_arm_guards', 'events', 'private_clients', 'executive_protection')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'proposal', 'won', 'lost')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- contacts: people at the lead's organization
CREATE TABLE IF NOT EXISTS contacts (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- activities: timeline of interactions with a lead
CREATE TABLE IF NOT EXISTS activities (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('call', 'email', 'meeting', 'note')),
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- index for fast pipeline queries
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_activities_lead_id ON activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_contacts_lead_id ON contacts(lead_id);

-- ---------------------------------------------------------------------------
-- Receptionist: AI-powered call, SMS, and email handling
-- ---------------------------------------------------------------------------

-- calls: inbound/outbound call log
CREATE TABLE IF NOT EXISTS calls (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  caller_number TEXT,
  caller_name TEXT,
  direction TEXT NOT NULL DEFAULT 'inbound' CHECK (direction IN ('inbound', 'outbound')),
  status TEXT NOT NULL DEFAULT 'missed' CHECK (status IN ('missed', 'answered', 'voicemail', 'completed')),
  duration_seconds INTEGER DEFAULT 0,
  transcript TEXT,
  summary TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- messages: SMS and email conversations
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  contact_number TEXT,
  contact_email TEXT,
  direction TEXT NOT NULL DEFAULT 'inbound' CHECK (direction IN ('inbound', 'outbound')),
  channel TEXT NOT NULL DEFAULT 'sms' CHECK (channel IN ('sms', 'email')),
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
  thread_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- receptionist_settings: key/value config store
CREATE TABLE IF NOT EXISTS receptionist_settings (
  id SERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calls_lead_id ON calls(lead_id);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
CREATE INDEX IF NOT EXISTS idx_messages_lead_id ON messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);

-- ---------------------------------------------------------------------------
-- Marketing: cold email campaigns & lead scraping
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS campaigns (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  subject_line TEXT NOT NULL,
  body_template TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  target_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  opened_count INTEGER NOT NULL DEFAULT 0,
  replied_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_recipients (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  company TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'opened', 'replied', 'bounced', 'unsubscribed')),
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scraped_leads (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT,
  email TEXT,
  phone TEXT,
  source_url TEXT,
  source_type TEXT CHECK (source_type IN ('google_maps', 'linkedin', 'website', 'directory')),
  industry TEXT,
  notes TEXT,
  imported_to_crm BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign_id ON campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_status ON campaign_recipients(status);
CREATE INDEX IF NOT EXISTS idx_scraped_leads_source_type ON scraped_leads(source_type);
CREATE INDEX IF NOT EXISTS idx_scraped_leads_imported ON scraped_leads(imported_to_crm);

-- ---------------------------------------------------------------------------
-- Social Media: content calendar & post scheduler
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS scheduled_posts (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  vertical TEXT NOT NULL CHECK (vertical IN ('post_arm_guards', 'events', 'private_clients', 'executive_protection')),
  platform TEXT NOT NULL CHECK (platform IN ('x', 'tiktok', 'instagram', 'youtube', 'all')),
  script TEXT NOT NULL,
  hook TEXT,
  thumbnail_concept TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'posted', 'failed')),
  last_error TEXT,
  scheduled_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status ON scheduled_posts(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_scheduled_at ON scheduled_posts(scheduled_at);

-- discovered_content: trending security content found by the content discovery
-- engine (Discover tab). source: x = X/Twitter search, rss = Google News feed.
CREATE TABLE IF NOT EXISTS discovered_content (
  id SERIAL PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('x', 'rss')),
  source_id TEXT NOT NULL,
  author TEXT,
  title TEXT,
  text TEXT,
  snippet TEXT,
  url TEXT NOT NULL,
  metrics JSONB,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reposted', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source, source_id)
);
CREATE INDEX IF NOT EXISTS idx_discovered_content_status ON discovered_content(status);
CREATE INDEX IF NOT EXISTS idx_discovered_content_discovered_at ON discovered_content(discovered_at);
