CREATE TABLE IF NOT EXISTS campaigns (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_id INT UNSIGNED NOT NULL,
  ad_account_id VARCHAR(100) NOT NULL,
  campaign_id VARCHAR(100) NULL,
  name VARCHAR(255) NOT NULL,
  objective VARCHAR(100) NOT NULL DEFAULT 'LEAD_GENERATION',
  status VARCHAR(50) NOT NULL DEFAULT 'PAUSED',
  daily_budget DECIMAL(10,2) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_campaigns_company
    FOREIGN KEY (company_id) REFERENCES companies(id),
  UNIQUE KEY uq_campaigns_meta_campaign_id (campaign_id),
  INDEX idx_campaigns_company_id (company_id),
  INDEX idx_campaigns_ad_account_id (ad_account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
