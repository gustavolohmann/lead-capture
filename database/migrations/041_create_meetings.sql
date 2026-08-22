-- Reuniões / agendamentos
CREATE TABLE IF NOT EXISTS meetings (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_id INT UNSIGNED NOT NULL,
  seller_user_id INT UNSIGNED NOT NULL,
  lead_id BIGINT UNSIGNED NULL,
  meeting_type_id BIGINT UNSIGNED NULL,
  customer_name VARCHAR(180) NOT NULL,
  customer_email VARCHAR(180) NOT NULL,
  customer_phone VARCHAR(50) NULL,
  title VARCHAR(255) NOT NULL,
  start_at DATETIME NOT NULL,
  end_at DATETIME NOT NULL,
  timezone VARCHAR(64) NOT NULL DEFAULT 'America/Sao_Paulo',
  status ENUM('PENDING', 'SCHEDULED', 'CANCELLED', 'COMPLETED', 'NO_SHOW', 'FAILED') NOT NULL DEFAULT 'SCHEDULED',
  calendar_provider VARCHAR(30) NULL,
  provider_event_id VARCHAR(191) NULL,
  provider_calendar_id VARCHAR(255) NULL,
  meeting_url VARCHAR(500) NULL,
  source ENUM('MANUAL', 'PUBLIC_LINK', 'AUTOMATION') NOT NULL DEFAULT 'MANUAL',
  public_manage_token VARCHAR(64) NULL,
  idempotency_key VARCHAR(128) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  cancelled_at DATETIME NULL,
  CONSTRAINT fk_meetings_company
    FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT fk_meetings_seller
    FOREIGN KEY (seller_user_id) REFERENCES users(id),
  CONSTRAINT fk_meetings_lead
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
  CONSTRAINT fk_meetings_meeting_type
    FOREIGN KEY (meeting_type_id) REFERENCES meeting_types(id) ON DELETE SET NULL,
  UNIQUE KEY uq_meetings_public_manage_token (public_manage_token),
  UNIQUE KEY uq_meetings_seller_idempotency (seller_user_id, idempotency_key),
  INDEX idx_meetings_seller_start (seller_user_id, start_at, end_at),
  INDEX idx_meetings_company_id (company_id),
  INDEX idx_meetings_status (status),
  INDEX idx_meetings_lead_id (lead_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
