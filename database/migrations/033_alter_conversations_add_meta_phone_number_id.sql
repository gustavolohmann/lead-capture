ALTER TABLE conversations
  ADD COLUMN meta_phone_number_id VARCHAR(100) NULL AFTER external_user_id,
  ADD INDEX idx_conversations_meta_phone_number_id (meta_phone_number_id);
