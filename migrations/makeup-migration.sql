-- ─────────────────────────────────────────────────────────────
-- Migration: sistema de controle de reposição de aulas
-- CORRIGIDO: makeup_origin_id como INTEGER para referenciar
--            attendance.id (serial4 / integer)
-- ─────────────────────────────────────────────────────────────

-- Se a coluna já existe como UUID (versão anterior), remove primeiro
ALTER TABLE attendance DROP COLUMN IF EXISTS makeup_origin_id;

ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS reposto          BOOLEAN  DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS makeup_origin_id INTEGER  REFERENCES attendance(id) ON DELETE SET NULL;

-- Índice para consultas de pendências
CREATE INDEX IF NOT EXISTS idx_attendance_makeup_pendente
  ON attendance (patient_id, status, reposto)
  WHERE status = 'makeup' AND reposto = FALSE;

-- Índice para rastrear presenças que são reposições
CREATE INDEX IF NOT EXISTS idx_attendance_makeup_origin
  ON attendance (makeup_origin_id)
  WHERE makeup_origin_id IS NOT NULL;