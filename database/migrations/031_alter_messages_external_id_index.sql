ALTER TABLE messages
  ADD INDEX idx_messages_external_message_id (external_message_id);
