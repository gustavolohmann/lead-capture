CREATE TABLE IF NOT EXISTS automation_executions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_id INT UNSIGNED NOT NULL,
  automation_id BIGINT UNSIGNED NOT NULL,
  lead_id BIGINT UNSIGNED NOT NULL,
  current_step INT NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'RUNNING',
  scheduled_at TIMESTAMP NULL,
  finished_at TIMESTAMP NULL,
  error TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_automation_executions_company
    FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT fk_automation_executions_automation
    FOREIGN KEY (automation_id) REFERENCES automations(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_automation_executions_lead
    FOREIGN KEY (lead_id) REFERENCES leads(id)
    ON DELETE CASCADE,
  UNIQUE KEY uq_automation_executions_automation_lead (automation_id, lead_id),
  INDEX idx_automation_executions_company_id (company_id),
  INDEX idx_automation_executions_status_scheduled (status, scheduled_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
