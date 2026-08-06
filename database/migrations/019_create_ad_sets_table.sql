CREATE TABLE IF NOT EXISTS ad_sets (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_id INT UNSIGNED NOT NULL,
  campaign_id BIGINT UNSIGNED NOT NULL,
  meta_adset_id VARCHAR(100) NULL,
  name VARCHAR(255) NOT NULL,
  daily_budget DECIMAL(10,2) NULL,
  targeting JSON NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'PAUSED',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ad_sets_company
    FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT fk_ad_sets_campaign
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
  UNIQUE KEY uq_ad_sets_meta_adset_id (meta_adset_id),
  INDEX idx_ad_sets_company_id (company_id),
  INDEX idx_ad_sets_campaign_id (campaign_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
