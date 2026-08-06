CREATE TABLE IF NOT EXISTS lead_answers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lead_id BIGINT UNSIGNED NOT NULL,
  form_field_id BIGINT UNSIGNED NOT NULL,
  value TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_lead_answers_lead
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  CONSTRAINT fk_lead_answers_form_field
    FOREIGN KEY (form_field_id) REFERENCES form_fields(id) ON DELETE CASCADE,
  INDEX idx_lead_answers_lead_id (lead_id),
  INDEX idx_lead_answers_form_field_id (form_field_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
