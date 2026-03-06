// Implementa o protocolo WebAuthn em 4 endpoints (2 pares begin/complete):
//
//   Registro:
//     POST /api/biometric/register/begin    → gera opções para o navegador
//     POST /api/biometric/register/complete → valida e salva a credencial
//
//   Autenticação (marcar presença):
//     POST /api/biometric/auth/begin        → gera challenge
//     POST /api/biometric/auth/complete     → valida assinatura e marca presença
//
//   Gestão:
//     GET  /api/biometric/:patientId        → lista credenciais do aluno
//     DELETE /api/biometric/:patientId/:credentialId → revoga credencial

const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');

const BiometricCredentialModel = require('../models/BiometricCredential');
const AttendanceModel          = require('../models/Attendance');
const PatientModel             = require('../models/Patient');

// ─── Configuração do Relying Party ─────────────────────────────────────────
// rpID deve ser o domínio do seu app SEM protocolo e SEM porta.
// Em produção: 'seudominio.com.br'
// Em desenvolvimento: 'localhost'
const RP_ID     = process.env.WEBAUTHN_RP_ID     || 'localhost';
const RP_NAME   = process.env.WEBAUTHN_RP_NAME   || 'SGP Clínica';
const RP_ORIGIN = process.env.WEBAUTHN_RP_ORIGIN || 'http://localhost:4200';

class BiometricController {

  // ── REGISTRO — ETAPA 1 ────────────────────────────────────────────────────
  /**
   * Gera as opções que o navegador usa para acionar o autenticador (Touch ID etc).
   * O frontend passa essas opções para `navigator.credentials.create()`.
   *
   * Rota: POST /api/biometric/register/begin
   * Body: { patientId, deviceName }
   * Auth: requer token JWT (apenas gestor/profissional pode cadastrar)
   */
  static async registerBegin(req, res, next) {
    try {
      const { patientId, deviceName } = req.body;

      if (!patientId) {
        return res.status(400).json({ success: false, message: 'patientId é obrigatório' });
      }

      // Busca o aluno para usar o nome como userName no autenticador
      const patient = await PatientModel.findById(patientId);
      if (!patient) {
        return res.status(404).json({ success: false, message: 'Aluno não encontrado' });
      }

      // Lista credenciais já existentes para evitar duplicação no mesmo dispositivo
      const existingCredentials = await BiometricCredentialModel.findByPatientId(patientId);

      const options = await generateRegistrationOptions({
        rpName:                  RP_NAME,
        rpID:                    RP_ID,
        userID:                  patientId,       // ID único do usuário no seu sistema
        userName:                patient.nome,
        // Exclui credenciais já registradas — evita que o mesmo dispositivo
        // seja cadastrado duas vezes
        excludeCredentials:      existingCredentials.map(c => ({
          id:         c.credential_id,
          type:       'public-key',
          transports: ['internal'],               // 'internal' = biometria do dispositivo
        })),
        authenticatorSelection: {
          authenticatorAttachment: 'platform',    // Apenas biometria do próprio device
          userVerification:        'required',    // Obriga verificação biométrica
          residentKey:             'preferred',
        },
        timeout: 60000,
      });

      // Salva o challenge no banco — será validado em registerComplete
      // TTL de 5 min está definido na tabela webauthn_challenges
      await BiometricCredentialModel.saveChallenge(
        options.challenge,
        'registration',
        patientId
      );

      // Armazena deviceName no challenge para recuperar em registerComplete
      // Alternativa: passar novamente no body do complete
      res.json({ success: true, data: { options, deviceName } });
    } catch (error) {
      next(error);
    }
  }

  // ── REGISTRO — ETAPA 2 ────────────────────────────────────────────────────
  /**
   * Recebe a resposta do autenticador, verifica e persiste a credencial.
   *
   * Rota: POST /api/biometric/register/complete
   * Body: { patientId, deviceName, credential }
   *   onde `credential` é o objeto retornado por navigator.credentials.create()
   */
  static async registerComplete(req, res, next) {
    try {
      const { patientId, deviceName, credential } = req.body;

      if (!patientId || !credential) {
        return res.status(400).json({ success: false, message: 'patientId e credential são obrigatórios' });
      }

      // Recupera e invalida o challenge (uso único)
      const challengeRecord = await BiometricCredentialModel.consumeChallenge(
        credential.response.clientDataJSON
          ? JSON.parse(Buffer.from(credential.response.clientDataJSON, 'base64').toString()).challenge
          : '',
        'registration'
      );

      // Se não encontrou, o challenge expirou ou foi adulterado
      if (!challengeRecord || String(challengeRecord.patient_id) !== String(patientId)) {
        return res.status(400).json({ success: false, message: 'Challenge expirado ou inválido' });
      }

      let verification;
      try {
        verification = await verifyRegistrationResponse({
          response:             credential,
          expectedChallenge:    challengeRecord.challenge,
          expectedOrigin:       RP_ORIGIN,
          expectedRPID:         RP_ID,
          requireUserVerification: true,
        });
      } catch (verifyError) {
        return res.status(400).json({ success: false, message: `Verificação falhou: ${verifyError.message}` });
      }

      if (!verification.verified || !verification.registrationInfo) {
        return res.status(400).json({ success: false, message: 'Registro biométrico não verificado' });
      }

      const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;

      // Persiste a credencial no banco
      await BiometricCredentialModel.create(
        patientId,
        Buffer.from(credentialID).toString('base64url'),
        Buffer.from(credentialPublicKey).toString('base64url'),
        counter,
        deviceName || 'Dispositivo'
      );

      res.status(201).json({ success: true, message: 'Biometria cadastrada com sucesso' });
    } catch (error) {
      next(error);
    }
  }

  // ── AUTENTICAÇÃO — ETAPA 1 ────────────────────────────────────────────────
  /**
   * Gera um challenge para o aluno autenticar.
   * O frontend passa isso para navigator.credentials.get().
   *
   * Rota: POST /api/biometric/auth/begin
   * Body: { patientId }
   * Auth: rota pública — o aluno não está logado, ele SE IDENTIFICA pela biometria
   */
  static async authBegin(req, res, next) {
    try {
      const { patientId } = req.body;

      if (!patientId) {
        return res.status(400).json({ success: false, message: 'patientId é obrigatório' });
      }

      // Busca as credenciais do aluno para indicar ao autenticador quais aceitar
      const credentials = await BiometricCredentialModel.findByPatientId(patientId);

      if (credentials.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Nenhuma biometria cadastrada para este aluno. Cadastre primeiro.'
        });
      }

      const options = await generateAuthenticationOptions({
        rpID: RP_ID,
        allowCredentials: credentials.map(c => ({
          id:         c.credential_id,
          type:       'public-key',
          transports: ['internal'],
        })),
        userVerification: 'required',
        timeout: 60000,
      });

      await BiometricCredentialModel.saveChallenge(
        options.challenge,
        'authentication',
        patientId
      );

      res.json({ success: true, data: options });
    } catch (error) {
      next(error);
    }
  }

  // ── AUTENTICAÇÃO — ETAPA 2 ────────────────────────────────────────────────
  /**
   * Verifica a assinatura biométrica e marca presença automaticamente.
   *
   * Rota: POST /api/biometric/auth/complete
   * Body: { patientId, credential, date? }
   * Auth: pública — a verificação biométrica substitui o login
   */
  static async authComplete(req, res, next) {
    try {
      const { patientId, credential, date } = req.body;

      if (!patientId || !credential) {
        return res.status(400).json({ success: false, message: 'patientId e credential são obrigatórios' });
      }

      // Recupera o challenge (uso único)
      const challengeRecord = await BiometricCredentialModel.consumeChallenge(
        credential.response?.clientDataJSON
          ? JSON.parse(Buffer.from(credential.response.clientDataJSON, 'base64').toString()).challenge
          : '',
        'authentication'
      );

      if (!challengeRecord || String(challengeRecord.patient_id) !== String(patientId)) {
        return res.status(400).json({ success: false, message: 'Challenge expirado ou inválido' });
      }

      const credentialIdFromDevice = credential.id; // já em base64url
      const storedCredential = await BiometricCredentialModel.findByCredentialId(credentialIdFromDevice);

      if (!storedCredential) {
        return res.status(404).json({ success: false, message: 'Credencial não encontrada' });
      }

      // Verifica a assinatura criptográfica
      let verification;
      try {
        verification = await verifyAuthenticationResponse({
          response:             credential,
          expectedChallenge:    challengeRecord.challenge,
          expectedOrigin:       RP_ORIGIN,
          expectedRPID:         RP_ID,
          authenticator: {
            credentialID:        Buffer.from(storedCredential.credential_id, 'base64url'),
            credentialPublicKey: Buffer.from(storedCredential.public_key, 'base64url'),
            counter:             storedCredential.counter,
          },
          requireUserVerification: true,
        });
      } catch (verifyError) {
        return res.status(401).json({ success: false, message: `Autenticação falhou: ${verifyError.message}` });
      }

      if (!verification.verified) {
        return res.status(401).json({ success: false, message: 'Biometria não verificada' });
      }

      // Atualiza o counter para prevenir replay attacks
      await BiometricCredentialModel.updateCounter(
        credentialIdFromDevice,
        verification.authenticationInfo.newCounter
      );

      // ── Marca a presença ────────────────────────────────────────────────
      const attendanceDate = date || new Date().toISOString().split('T')[0];

      // Verifica duplicidade — não marca duas vezes no mesmo dia
      const isDuplicate = await AttendanceModel.checkDuplicate(patientId, attendanceDate);
      if (isDuplicate) {
        return res.status(409).json({
          success: false,
          message: 'Presença já registrada para hoje'
        });
      }

      const attendance = await AttendanceModel.create(patientId, {
        date:   attendanceDate,
        status: 'present',
        notes:  'Presença registrada via biometria',
      });

      res.json({
        success: true,
        message: 'Presença registrada com sucesso via biometria!',
        data: attendance
      });
    } catch (error) {
      next(error);
    }
  }

  // ── GESTÃO ────────────────────────────────────────────────────────────────

  /** Lista credenciais de um aluno. Auth: JWT obrigatório. */
  static async listCredentials(req, res, next) {
    try {
      const { patientId } = req.params;
      const credentials = await BiometricCredentialModel.findByPatientId(patientId);
      res.json({ success: true, data: credentials });
    } catch (error) {
      next(error);
    }
  }

  /** Remove uma credencial (revogação). Auth: JWT obrigatório. */
  static async deleteCredential(req, res, next) {
    try {
      const { patientId, credentialId } = req.params;
      const deleted = await BiometricCredentialModel.delete(credentialId, patientId);
      if (!deleted) {
        return res.status(404).json({ success: false, message: 'Credencial não encontrada' });
      }
      res.json({ success: true, message: 'Biometria removida com sucesso' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = BiometricController;