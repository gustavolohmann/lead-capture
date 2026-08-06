CREATE TABLE IF NOT EXISTS meta_connections (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_id INT UNSIGNED NOT NULL,
  business_id VARCHAR(100) NULL,
  access_token_encrypted TEXT NOT NULL,
  token_type VARCHAR(50) NULL,
  expires_at DATETIME NULL,
  scopes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_meta_connections_company
    FOREIGN KEY (company_id) REFERENCES companies(id),
  UNIQUE KEY uq_meta_connections_company_id (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
