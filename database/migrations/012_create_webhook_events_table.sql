CREATE TABLE IF NOT EXISTS webhook_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  provider VARCHAR(50) NOT NULL,
  event_id VARCHAR(191) NOT NULL,
  payload JSON NULL,
  processed TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_webhook_events_provider_event (provider, event_id),
  INDEX idx_webhook_events_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
