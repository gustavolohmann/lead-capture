ALTER TABLE users
  ADD COLUMN company_id INT UNSIGNED NULL AFTER role_id,
  ADD INDEX idx_users_company_id (company_id),
  ADD CONSTRAINT fk_users_company
    FOREIGN KEY (company_id) REFERENCES companies(id);
