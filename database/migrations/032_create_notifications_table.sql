CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NULL,
  conversation_id BIGINT UNSIGNED NULL,
  message_id BIGINT UNSIGNED NULL,
  read_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notifications_company
    FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT fk_notifications_user
    FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_notifications_conversation
    FOREIGN KEY (conversation_id) REFERENCES conversations(id),
  CONSTRAINT fk_notifications_message
    FOREIGN KEY (message_id) REFERENCES messages(id),
  UNIQUE KEY uq_notifications_user_message (user_id, message_id),
  INDEX idx_notifications_company_id (company_id),
  INDEX idx_notifications_user_id (user_id),
  INDEX idx_notifications_read_at (read_at),
  INDEX idx_notifications_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
