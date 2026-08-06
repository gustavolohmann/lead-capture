CREATE TABLE IF NOT EXISTS meta_ad_accounts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_id INT UNSIGNED NOT NULL,
  account_id VARCHAR(100) NOT NULL,
  name VARCHAR(255) NULL,
  status VARCHAR(50) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_meta_ad_accounts_company
    FOREIGN KEY (company_id) REFERENCES companies(id),
  UNIQUE KEY uq_meta_ad_accounts_company_account (company_id, account_id),
  INDEX idx_meta_ad_accounts_company_id (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
