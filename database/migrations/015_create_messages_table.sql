CREATE TABLE IF NOT EXISTS messages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  conversation_id BIGINT UNSIGNED NOT NULL,
  company_id INT UNSIGNED NOT NULL,
  direction ENUM('INBOUND', 'OUTBOUND') NOT NULL,
  content TEXT NOT NULL,
  external_message_id VARCHAR(255) NULL,
  status VARCHAR(50) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_messages_conversation
    FOREIGN KEY (conversation_id) REFERENCES conversations(id),
  CONSTRAINT fk_messages_company
    FOREIGN KEY (company_id) REFERENCES companies(id),
  INDEX idx_messages_conversation_id (conversation_id),
  INDEX idx_messages_company_id (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
