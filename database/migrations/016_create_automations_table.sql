CREATE TABLE IF NOT EXISTS automations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_id INT UNSIGNED NOT NULL,
  name VARCHAR(255) NOT NULL,
  trigger_key VARCHAR(100) NOT NULL,
  channel ENUM('WHATSAPP', 'INSTAGRAM', 'AUTO') NOT NULL DEFAULT 'AUTO',
  message TEXT NOT NULL,
  delay_minutes INT NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_automations_company
    FOREIGN KEY (company_id) REFERENCES companies(id),
  INDEX idx_automations_company_id (company_id),
  INDEX idx_automations_trigger_key (trigger_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
