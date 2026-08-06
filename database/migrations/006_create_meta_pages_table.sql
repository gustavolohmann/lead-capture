CREATE TABLE IF NOT EXISTS meta_pages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_id INT UNSIGNED NOT NULL,
  page_id VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  access_token_encrypted TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_meta_pages_company
    FOREIGN KEY (company_id) REFERENCES companies(id),
  UNIQUE KEY uq_meta_pages_company_page (company_id, page_id),
  INDEX idx_meta_pages_company_id (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
