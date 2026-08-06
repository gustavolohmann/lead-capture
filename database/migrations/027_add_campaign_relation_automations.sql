-- Vincula automação a uma campanha local (opcional = legado global)
ALTER TABLE automations
  ADD COLUMN campaign_id BIGINT UNSIGNED NULL AFTER company_id;

ALTER TABLE automations
  ADD CONSTRAINT fk_automations_campaign
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
    ON DELETE SET NULL,
  ADD INDEX idx_automations_campaign_id (campaign_id),
  ADD INDEX idx_automations_company_campaign (company_id, campaign_id);
