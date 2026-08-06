CREATE TABLE IF NOT EXISTS companies (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  owner_user_id INT UNSIGNED NOT NULL,
  status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_companies_owner_user
    FOREIGN KEY (owner_user_id) REFERENCES users(id),
  INDEX idx_companies_owner_user_id (owner_user_id),
  INDEX idx_companies_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
