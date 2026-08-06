CREATE TABLE IF NOT EXISTS lead_forms (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_id INT UNSIGNED NOT NULL,
  page_id VARCHAR(100) NOT NULL,
  form_id VARCHAR(100) NULL,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  questions JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_lead_forms_company
    FOREIGN KEY (company_id) REFERENCES companies(id),
  UNIQUE KEY uq_lead_forms_meta_form_id (form_id),
  INDEX idx_lead_forms_company_id (company_id),
  INDEX idx_lead_forms_page_id (page_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
