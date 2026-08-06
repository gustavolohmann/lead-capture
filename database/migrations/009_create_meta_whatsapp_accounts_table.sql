CREATE TABLE IF NOT EXISTS meta_whatsapp_accounts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_id INT UNSIGNED NOT NULL,
  business_account_id VARCHAR(100) NOT NULL,
  phone_number VARCHAR(50) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_meta_whatsapp_company
    FOREIGN KEY (company_id) REFERENCES companies(id),
  UNIQUE KEY uq_meta_whatsapp_company_waba (company_id, business_account_id),
  INDEX idx_meta_whatsapp_company_id (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
