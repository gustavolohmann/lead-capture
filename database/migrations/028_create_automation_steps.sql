CREATE TABLE IF NOT EXISTS automation_steps (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  automation_id BIGINT UNSIGNED NOT NULL,
  type VARCHAR(50) NOT NULL,
  position INT NOT NULL DEFAULT 0,
  config JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_automation_steps_automation
    FOREIGN KEY (automation_id) REFERENCES automations(id)
    ON DELETE CASCADE,
  INDEX idx_automation_steps_automation_id (automation_id),
  INDEX idx_automation_steps_automation_position (automation_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
