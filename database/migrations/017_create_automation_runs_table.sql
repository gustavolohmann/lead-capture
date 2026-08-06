CREATE TABLE IF NOT EXISTS automation_runs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_id INT UNSIGNED NOT NULL,
  automation_id BIGINT UNSIGNED NOT NULL,
  lead_id BIGINT UNSIGNED NOT NULL,
  scheduled_at TIMESTAMP NOT NULL,
  sent_at TIMESTAMP NULL,
  status ENUM('SCHEDULED', 'SENT', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'SCHEDULED',
  error TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_automation_runs_company
    FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT fk_automation_runs_automation
    FOREIGN KEY (automation_id) REFERENCES automations(id),
  CONSTRAINT fk_automation_runs_lead
    FOREIGN KEY (lead_id) REFERENCES leads(id),
  UNIQUE KEY uq_automation_runs_automation_lead (automation_id, lead_id),
  INDEX idx_automation_runs_company_id (company_id),
  INDEX idx_automation_runs_scheduled_at (scheduled_at),
  INDEX idx_automation_runs_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
