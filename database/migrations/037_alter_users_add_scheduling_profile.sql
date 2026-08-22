-- Perfil de agenda do vendedor (timezone + slug público)
ALTER TABLE users
  ADD COLUMN timezone VARCHAR(64) NOT NULL DEFAULT 'America/Sao_Paulo' AFTER status,
  ADD COLUMN scheduling_slug VARCHAR(80) NULL AFTER timezone;

ALTER TABLE users
  ADD UNIQUE KEY uq_users_scheduling_slug (scheduling_slug);
