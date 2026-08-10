CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id INT UNSIGNED NOT NULL,
  waba_id VARCHAR(64) NOT NULL,
  meta_template_id VARCHAR(64) NULL,
  name VARCHAR(512) NOT NULL,
  language VARCHAR(16) NOT NULL DEFAULT 'pt_BR',
  category VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  rejected_reason VARCHAR(128) NULL,
  rejection_info JSON NULL,
  quality_score VARCHAR(32) NULL,
  components JSON NOT NULL,
  parameter_format VARCHAR(16) NOT NULL DEFAULT 'POSITIONAL',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_whatsapp_templates_company_waba_name_lang (company_id, waba_id, name, language),
  KEY idx_whatsapp_templates_company_status (company_id, status),
  KEY idx_whatsapp_templates_meta_id (meta_template_id),
  CONSTRAINT fk_whatsapp_templates_company
    FOREIGN KEY (company_id) REFERENCES companies (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
