CREATE TABLE IF NOT EXISTS leads (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_id INT UNSIGNED NOT NULL,
  page_id VARCHAR(100) NOT NULL,
  form_id VARCHAR(100) NULL,
  meta_lead_id VARCHAR(100) NOT NULL,
  name VARCHAR(255) NULL,
  email VARCHAR(255) NULL,
  phone VARCHAR(50) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'NEW',
  raw_data JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_leads_company
    FOREIGN KEY (company_id) REFERENCES companies(id),
  UNIQUE KEY uq_leads_meta_lead_id (meta_lead_id),
  INDEX idx_leads_company_id (company_id),
  INDEX idx_leads_created_at (created_at),
  INDEX idx_leads_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
