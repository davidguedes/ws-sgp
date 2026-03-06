ALTER TABLE attendance 
  ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) NOT NULL DEFAULT 'regular' 
    CHECK (tipo IN ('regular', 'avulso')),
  ADD COLUMN IF NOT EXISTS valor DECIMAL(10,2) DEFAULT NULL;

ALTER TABLE attendance DROP CONSTRAINT attendance_patient_id_date_key;
ALTER TABLE attendance ADD CONSTRAINT attendance_patient_id_date_tipo_key UNIQUE(patient_id, date, tipo);

-- Adiciona as colunas novas (se ainda não fez)
ALTER TABLE attendance 
  ADD COLUMN IF NOT EXISTS tipo  VARCHAR(20) NOT NULL DEFAULT 'regular',
  ADD COLUMN IF NOT EXISTS valor DECIMAL(10,2) DEFAULT NULL;

-- Remove a constraint antiga de (patient_id, date)
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_patient_id_date_key;

-- Cria a nova constraint que o ON CONFLICT precisa
ALTER TABLE attendance 
  ADD CONSTRAINT attendance_patient_id_date_tipo_key 
  UNIQUE (patient_id, date, tipo);

-- ============================================================
-- MIGRATION: Criação da tabela biometric_credentials
-- Armazena as chaves públicas WebAuthn de cada aluno
-- ============================================================

CREATE TABLE IF NOT EXISTS biometric_credentials (
  id            SERIAL PRIMARY KEY,
  patient_id    INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

  -- credential_id é a chave única gerada pelo autenticador (ex: Touch ID)
  -- armazenado em base64url para serialização segura
  credential_id TEXT NOT NULL UNIQUE,

  -- Chave pública em formato COSE (base64url) — usada para verificar assinaturas
  public_key    TEXT NOT NULL,

  -- Contador de uso: detecta ataques de replay (clonagem de autenticador)
  counter       INTEGER NOT NULL DEFAULT 0,

  -- Identificador do dispositivo/navegador para exibição ao usuário
  device_name   TEXT,

  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at  TIMESTAMP WITH TIME ZONE
);

-- Índice para busca rápida por credential_id durante autenticação
CREATE INDEX IF NOT EXISTS idx_biometric_credential_id
  ON biometric_credentials(credential_id);

-- Índice para listar credenciais de um aluno específico
CREATE INDEX IF NOT EXISTS idx_biometric_patient_id
  ON biometric_credentials(patient_id);

-- ============================================================
-- TABELA DE CHALLENGES TEMPORÁRIOS
-- WebAuthn exige um "challenge" único por tentativa de auth.
-- Armazenamos aqui com TTL curto (5 min) em vez de usar sessão,
-- o que permite APIs stateless (sem cookie/session).
-- ============================================================

CREATE TABLE IF NOT EXISTS webauthn_challenges (
  id           SERIAL PRIMARY KEY,
  challenge    TEXT NOT NULL UNIQUE,
  patient_id   INTEGER,          -- NULL durante registro (aluno ainda não autenticado)
  type         TEXT NOT NULL,    -- 'registration' | 'authentication'
  expires_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Job de limpeza: execute periodicamente (ou via cron no backend)
-- DELETE FROM webauthn_challenges WHERE expires_at < NOW();