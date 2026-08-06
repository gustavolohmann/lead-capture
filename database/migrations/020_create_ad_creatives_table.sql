CREATE TABLE IF NOT EXISTS ad_creatives (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_id INT UNSIGNED NOT NULL,
  ad_account_id VARCHAR(100) NOT NULL,
  meta_creative_id VARCHAR(100) NULL,
  name VARCHAR(255) NOT NULL,
  title VARCHAR(255) NULL,
  body TEXT NULL,
  image_hash VARCHAR(255) NULL,
  cta_type VARCHAR(50) NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ad_creatives_company
    FOREIGN KEY (company_id) REFERENCES companies(id),
  UNIQUE KEY uq_ad_creatives_meta_creative_id (meta_creative_id),
  INDEX idx_ad_creatives_company_id (company_id),
  INDEX idx_ad_creatives_ad_account_id (ad_account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
