-- Atribuição / rastreio de origem do lead (Meta Ads + formulários)
ALTER TABLE leads
  ADD COLUMN origin VARCHAR(255) NULL AFTER source,
  ADD COLUMN form_name VARCHAR(255) NULL AFTER company_form_id,
  ADD COLUMN campaign_id VARCHAR(100) NULL AFTER form_name,
  ADD COLUMN campaign_name VARCHAR(255) NULL AFTER campaign_id,
  ADD COLUMN adset_id VARCHAR(100) NULL AFTER campaign_name,
  ADD COLUMN adset_name VARCHAR(255) NULL AFTER adset_id,
  ADD COLUMN ad_id VARCHAR(100) NULL AFTER adset_name,
  ADD COLUMN ad_name VARCHAR(255) NULL AFTER ad_id,
  ADD COLUMN platform VARCHAR(50) NULL AFTER ad_name,
  ADD COLUMN is_organic TINYINT(1) NOT NULL DEFAULT 0 AFTER platform;

ALTER TABLE leads
  ADD INDEX idx_leads_origin (origin),
  ADD INDEX idx_leads_campaign_id (campaign_id),
  ADD INDEX idx_leads_ad_id (ad_id);
