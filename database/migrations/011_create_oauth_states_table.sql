CREATE TABLE IF NOT EXISTS oauth_states (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_id INT UNSIGNED NOT NULL,
  state VARCHAR(128) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_oauth_states_company
    FOREIGN KEY (company_id) REFERENCES companies(id),
  UNIQUE KEY uq_oauth_states_state (state),
  INDEX idx_oauth_states_company_id (company_id),
  INDEX idx_oauth_states_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
