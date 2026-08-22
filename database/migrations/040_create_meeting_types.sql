-- Tipos de reunião (link público por user.scheduling_slug + meeting_types.slug)
CREATE TABLE IF NOT EXISTS meeting_types (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(80) NOT NULL,
  description TEXT NULL,
  duration_minutes INT UNSIGNED NOT NULL,
  location_type ENUM('GOOGLE_MEET', 'PRESENTIAL', 'NONE') NOT NULL DEFAULT 'GOOGLE_MEET',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  buffer_before_minutes INT UNSIGNED NOT NULL DEFAULT 0,
  buffer_after_minutes INT UNSIGNED NOT NULL DEFAULT 0,
  minimum_notice_minutes INT UNSIGNED NOT NULL DEFAULT 60,
  booking_window_days INT UNSIGNED NOT NULL DEFAULT 14,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_meeting_types_company
    FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT fk_meeting_types_user
    FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY uq_meeting_types_user_slug (user_id, slug),
  INDEX idx_meeting_types_company_id (company_id),
  INDEX idx_meeting_types_active (user_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
