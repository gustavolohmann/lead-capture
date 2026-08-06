CREATE TABLE IF NOT EXISTS form_fields (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  form_id BIGINT UNSIGNED NOT NULL,
  type VARCHAR(30) NOT NULL,
  label VARCHAR(255) NOT NULL,
  placeholder VARCHAR(255) NULL,
  required TINYINT(1) NOT NULL DEFAULT 0,
  position INT NOT NULL DEFAULT 0,
  options JSON NULL,
  validation JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_form_fields_form
    FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE,
  INDEX idx_form_fields_form_id (form_id),
  INDEX idx_form_fields_position (form_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
