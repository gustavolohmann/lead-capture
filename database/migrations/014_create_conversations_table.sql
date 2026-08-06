CREATE TABLE IF NOT EXISTS conversations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_id INT UNSIGNED NOT NULL,
  lead_id BIGINT UNSIGNED NOT NULL,
  channel ENUM('WHATSAPP', 'INSTAGRAM') NOT NULL,
  external_user_id VARCHAR(255) NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_conversations_company
    FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT fk_conversations_lead
    FOREIGN KEY (lead_id) REFERENCES leads(id),
  UNIQUE KEY uq_conversations_company_lead_channel (company_id, lead_id, channel),
  INDEX idx_conversations_company_id (company_id),
  INDEX idx_conversations_lead_id (lead_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
