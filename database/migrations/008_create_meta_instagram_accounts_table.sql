CREATE TABLE IF NOT EXISTS meta_instagram_accounts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_id INT UNSIGNED NOT NULL,
  instagram_id VARCHAR(100) NOT NULL,
  username VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_meta_instagram_company
    FOREIGN KEY (company_id) REFERENCES companies(id),
  UNIQUE KEY uq_meta_instagram_company_ig (company_id, instagram_id),
  INDEX idx_meta_instagram_company_id (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
