-- Integração de calendário (Google agora; Microsoft depois)
CREATE TABLE IF NOT EXISTS calendar_integrations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  provider VARCHAR(30) NOT NULL DEFAULT 'GOOGLE',
  provider_account_id VARCHAR(191) NULL,
  provider_email VARCHAR(255) NULL,
  calendar_id VARCHAR(255) NOT NULL DEFAULT 'primary',
  encrypted_refresh_token TEXT NULL,
  encrypted_access_token TEXT NULL,
  access_token_expires_at DATETIME NULL,
  scopes TEXT NULL,
  status ENUM('CONNECTED', 'DISCONNECTED', 'ERROR') NOT NULL DEFAULT 'CONNECTED',
  last_sync_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_calendar_integrations_company
    FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT fk_calendar_integrations_user
    FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY uq_calendar_integrations_user_provider (user_id, provider),
  INDEX idx_calendar_integrations_company_id (company_id),
  INDEX idx_calendar_integrations_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
