-- Permite leads de formulários próprios (sem Meta Lead Ads)
ALTER TABLE leads
  MODIFY COLUMN page_id VARCHAR(100) NULL,
  MODIFY COLUMN meta_lead_id VARCHAR(100) NULL,
  ADD COLUMN source VARCHAR(50) NOT NULL DEFAULT 'META_LEAD_ADS' AFTER status,
  ADD COLUMN company_form_id BIGINT UNSIGNED NULL AFTER form_id;

ALTER TABLE leads
  ADD INDEX idx_leads_source (source),
  ADD INDEX idx_leads_company_form_id (company_form_id);
