-- Disponibilidade semanal do vendedor (múltiplos intervalos por dia)
CREATE TABLE IF NOT EXISTS availability_rules (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  day_of_week TINYINT UNSIGNED NOT NULL COMMENT '0=Sunday .. 6=Saturday',
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  timezone VARCHAR(64) NOT NULL DEFAULT 'America/Sao_Paulo',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_availability_rules_company
    FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT fk_availability_rules_user
    FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_availability_rules_user_day (user_id, day_of_week, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
