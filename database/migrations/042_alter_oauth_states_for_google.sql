-- OAuth states: suporte a Google Calendar (user_id + provider)
ALTER TABLE oauth_states
  ADD COLUMN user_id INT UNSIGNED NULL AFTER company_id,
  ADD COLUMN provider VARCHAR(30) NOT NULL DEFAULT 'META' AFTER user_id;

ALTER TABLE oauth_states
  ADD INDEX idx_oauth_states_user_id (user_id),
  ADD INDEX idx_oauth_states_provider (provider);
