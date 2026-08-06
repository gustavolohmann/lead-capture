ALTER TABLE meta_whatsapp_accounts
  ADD COLUMN phone_number_id VARCHAR(100) NULL AFTER phone_number,
  ADD INDEX idx_meta_whatsapp_phone_number_id (phone_number_id),
  ADD INDEX idx_meta_whatsapp_business_account_id (business_account_id);
