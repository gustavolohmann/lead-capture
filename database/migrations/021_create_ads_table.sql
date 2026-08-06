CREATE TABLE IF NOT EXISTS ads (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_id INT UNSIGNED NOT NULL,
  ad_set_id BIGINT UNSIGNED NOT NULL,
  creative_id BIGINT UNSIGNED NOT NULL,
  meta_ad_id VARCHAR(100) NULL,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'PAUSED',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ads_company
    FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT fk_ads_ad_set
    FOREIGN KEY (ad_set_id) REFERENCES ad_sets(id),
  CONSTRAINT fk_ads_creative
    FOREIGN KEY (creative_id) REFERENCES ad_creatives(id),
  UNIQUE KEY uq_ads_meta_ad_id (meta_ad_id),
  INDEX idx_ads_company_id (company_id),
  INDEX idx_ads_ad_set_id (ad_set_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
