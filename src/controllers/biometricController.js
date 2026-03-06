// DOIS MODOS DE AUTENTICAÇÃO:
//
//   Modo 1 — identificado (patientId conhecido):
//     POST /api/biometric/auth/begin    { patientId }
//     POST /api/biometric/auth/complete { patientId, credential }
//     Usado quando o professor clica no botão de um aluno específico.
//
//   Modo 2 — discoverable / "academia" (patientId desconhecido):
//     POST /api/biometric/checkin/begin    {}   ← sem patientId
//     POST /api/biometric/checkin/complete { credential }
//     O dispositivo descobre sozinho qual credencial usar (resident key).
//     O backend identifica o aluno pelo credential_id retornado.
//     Verifica se há aula hoje e marca presença automaticamente.

const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');

const BiometricCredentialModel = require('../models/BiometricCredential');
const AttendanceModel          = require('../models/Attendance');
const PatientModel             = require('../models/Patient');

const RP_ID     = process.env.WEBAUTHN_RP_ID     || 'localhost';
const RP_NAME   = process.env.WEBAUTHN_RP_NAME   || 'SGP Clínica';
const RP_ORIGIN = process.env.WEBAUTHN_RP_ORIGIN || 'http://localhost:4200';

// Mapeamento de número do dia JS → chave usada no campo `dias` dos patients
// patients.dias é um TEXT[] com valores como ['seg', 'ter', 'qua', ...]
const JS_DAY_TO_KEY = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

function extractChallengeFromClientData(clientDataJSON) {
  try {
    const json = JSON.parse(Buffer.from(clientDataJSON, 'base64').toString('utf8'));
    return json.challenge || '';
  } catch {
    return '';
  }
}

/**
 * Verifica se um aluno tem aula em uma data específica.
 * Considera: dia da semana, data_inicio e data_fim.
 * Retorna true/false.
 */
function patientHasClassOnDate(patient, dateStr) {
  const date      = new Date(dateStr + 'T12:00:00'); // meio-dia evita bug de timezone
  const dayKey    = JS_DAY_TO_KEY[date.getDay()];

  if (!patient.dias || !patient.dias.includes(dayKey)) return false;

  const inicio = new Date(patient.data_inicio);
  inicio.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);

  if (target < inicio) return false;
  if (patient.data_fim) {
    const fim = new Date(patient.data_fim);
    fim.setHours(0, 0, 0, 0);
    if (target > fim) return false;
  }

  return true;
}

class BiometricController {

  // ════════════════════════════════════════════════════════════════════════════
  // REGISTRO
  // ════════════════════════════════════════════════════════════════════════════

  static async registerBegin(req, res, next) {
    try {
      const { patientId, deviceName } = req.body;
      if (!patientId) {
        return res.status(400).json({ success: false, message: 'patientId é obrigatório' });
      }

      const patient = await PatientModel.findById(patientId);
      if (!patient) {
        return res.status(404).json({ success: false, message: 'Aluno não encontrado' });
      }

      const existingCredentials = await BiometricCredentialModel.findByPatientId(patientId);

      const options = await generateRegistrationOptions({
        rpName:   RP_NAME,
        rpID:     RP_ID,
        userID:   new Uint8Array(Buffer.from(String(patientId))),
        userName: patient.nome,
        excludeCredentials: existingCredentials.map(c => ({
          id: c.credential_id, type: 'public-key', transports: ['internal'],
        })),
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification:        'required',
          // 'required' garante que a credencial é "resident key" (discoverable)
          // sem isso o modo checkin/begin não funciona
          residentKey:             'required',
        },
        timeout: 60000,
      });

      await BiometricCredentialModel.saveChallenge(options.challenge, 'registration', patientId);

      res.json({ success: true, data: { options, deviceName } });
    } catch (error) {
      next(error);
    }
  }

  static async registerComplete(req, res, next) {
    try {
      const { patientId, deviceName, credential } = req.body;
      if (!patientId || !credential) {
        return res.status(400).json({ success: false, message: 'patientId e credential são obrigatórios' });
      }

      const challenge     = extractChallengeFromClientData(credential.response.clientDataJSON);
      const challengeRecord = await BiometricCredentialModel.consumeChallenge(challenge, 'registration');

      if (!challengeRecord || String(challengeRecord.patient_id) !== String(patientId)) {
        return res.status(400).json({ success: false, message: 'Challenge inválido ou expirado. Tente novamente.' });
      }

      let verification;
      try {
        verification = await verifyRegistrationResponse({
          response: credential, expectedChallenge: challengeRecord.challenge,
          expectedOrigin: RP_ORIGIN, expectedRPID: RP_ID, requireUserVerification: true,
        });
      } catch (verifyError) {
        return res.status(400).json({ success: false, message: `Verificação falhou: ${verifyError.message}` });
      }

      if (!verification.verified || !verification.registrationInfo) {
        return res.status(400).json({ success: false, message: 'Registro biométrico não verificado' });
      }

      const { credential: regCredential } = verification.registrationInfo;

      await BiometricCredentialModel.create(
        patientId,
        regCredential.id,
        Buffer.from(regCredential.publicKey).toString('base64url'),
        regCredential.counter,
        deviceName || 'Dispositivo'
      );

      res.status(201).json({ success: true, message: 'Biometria cadastrada com sucesso' });
    } catch (error) {
      next(error);
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // AUTENTICAÇÃO IDENTIFICADA (patientId conhecido — modo botão por aluno)
  // ════════════════════════════════════════════════════════════════════════════

  static async authBegin(req, res, next) {
    try {
      const { patientId } = req.body;
      if (!patientId) {
        return res.status(400).json({ success: false, message: 'patientId é obrigatório' });
      }

      const credentials = await BiometricCredentialModel.findByPatientId(patientId);
      if (credentials.length === 0) {
        return res.status(404).json({ success: false, message: 'Nenhuma biometria cadastrada para este aluno.' });
      }

      const options = await generateAuthenticationOptions({
        rpID: RP_ID,
        allowCredentials: credentials.map(c => ({
          id: c.credential_id, type: 'public-key', transports: ['internal'],
        })),
        userVerification: 'required',
        timeout: 60000,
      });

      await BiometricCredentialModel.saveChallenge(options.challenge, 'authentication', patientId);

      res.json({ success: true, data: options });
    } catch (error) {
      next(error);
    }
  }

  static async authComplete(req, res, next) {
    try {
      const { patientId, credential, date } = req.body;
      if (!patientId || !credential) {
        return res.status(400).json({ success: false, message: 'patientId e credential são obrigatórios' });
      }

      const challenge     = extractChallengeFromClientData(credential.response?.clientDataJSON);
      const challengeRecord = await BiometricCredentialModel.consumeChallenge(challenge, 'authentication');

      if (!challengeRecord || String(challengeRecord.patient_id) !== String(patientId)) {
        return res.status(400).json({ success: false, message: 'Challenge inválido ou expirado. Tente novamente.' });
      }

      const storedCredential = await BiometricCredentialModel.findByCredentialId(credential.id);
      if (!storedCredential) {
        return res.status(404).json({ success: false, message: 'Credencial não encontrada' });
      }

      let verification;
      try {
        verification = await verifyAuthenticationResponse({
          response: credential, expectedChallenge: challengeRecord.challenge,
          expectedOrigin: RP_ORIGIN, expectedRPID: RP_ID,
          credential: {
            id:        storedCredential.credential_id,
            publicKey: Buffer.from(storedCredential.public_key, 'base64url'),
            counter:   storedCredential.counter,
          },
          requireUserVerification: true,
        });
      } catch (verifyError) {
        return res.status(401).json({ success: false, message: `Autenticação falhou: ${verifyError.message}` });
      }

      if (!verification.verified) {
        return res.status(401).json({ success: false, message: 'Biometria não verificada' });
      }

      await BiometricCredentialModel.updateCounter(credential.id, verification.authenticationInfo.newCounter);

      const attendanceDate = date || new Date().toISOString().split('T')[0];
      const isDuplicate = await AttendanceModel.checkDuplicate(patientId, attendanceDate);
      if (isDuplicate) {
        return res.status(409).json({ success: false, message: 'Presença já registrada para hoje' });
      }

      const attendance = await AttendanceModel.create(patientId, {
        date: attendanceDate, status: 'present', notes: 'Presença registrada via biometria',
      });

      res.json({ success: true, message: 'Presença registrada com sucesso via biometria!', data: attendance });
    } catch (error) {
      next(error);
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CHECK-IN DISCOVERABLE (patientId desconhecido — modo "academia")
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Gera um challenge SEM allowCredentials.
   * Quando allowCredentials está vazio, o autenticador mostra ao usuário
   * TODAS as suas credenciais cadastradas para este RP e ele escolhe/autentica.
   * O dispositivo retorna o userHandle que contém o patientId — identificando o aluno.
   *
   * Rota: POST /api/biometric/checkin/begin
   * Body: {} (nenhum campo obrigatório)
   * Auth: pública
   */
  static async checkinBegin(req, res, next) {
    try {
      const options = await generateAuthenticationOptions({
        rpID: RP_ID,
        // allowCredentials vazio = discoverable: o dispositivo resolve qual credencial usar
        allowCredentials: [],
        userVerification: 'required',
        timeout: 60000,
      });

      // Challenge sem patient_id — o aluno é identificado apenas no complete
      await BiometricCredentialModel.saveChallenge(options.challenge, 'checkin', null);

      res.json({ success: true, data: options });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Valida a assinatura, identifica o aluno, verifica se tem aula hoje
   * e marca presença — ou retorna os dados para o professor decidir.
   *
   * Rota: POST /api/biometric/checkin/complete
   * Body: { credential, date? }
   * Auth: pública
   *
   * Respostas possíveis:
   *   201 → presença marcada
   *   200 com hasClass: false → aluno autenticado mas sem aula hoje (professor decide)
   *   409 → presença já registrada
   *   404 → credencial não encontrada
   */
  static async checkinComplete(req, res, next) {
    try {
      const { credential, date } = req.body;

      if (!credential) {
        return res.status(400).json({ success: false, message: 'credential é obrigatório' });
      }

      const challenge = extractChallengeFromClientData(credential.response?.clientDataJSON);
      const challengeRecord = await BiometricCredentialModel.consumeChallenge(challenge, 'checkin');

      if (!challengeRecord) {
        return res.status(400).json({ success: false, message: 'Challenge inválido ou expirado. Tente novamente.' });
      }

      // Busca a credencial pelo id retornado pelo autenticador
      const storedCredential = await BiometricCredentialModel.findByCredentialId(credential.id);
      if (!storedCredential) {
        return res.status(404).json({ success: false, message: 'Biometria não cadastrada no sistema.' });
      }

      // Verifica a assinatura criptográfica
      let verification;
      try {
        verification = await verifyAuthenticationResponse({
          response: credential, expectedChallenge: challengeRecord.challenge,
          expectedOrigin: RP_ORIGIN, expectedRPID: RP_ID,
          credential: {
            id:        storedCredential.credential_id,
            publicKey: Buffer.from(storedCredential.public_key, 'base64url'),
            counter:   storedCredential.counter,
          },
          requireUserVerification: true,
        });
      } catch (verifyError) {
        return res.status(401).json({ success: false, message: `Autenticação falhou: ${verifyError.message}` });
      }

      if (!verification.verified) {
        return res.status(401).json({ success: false, message: 'Biometria não verificada' });
      }

      await BiometricCredentialModel.updateCounter(credential.id, verification.authenticationInfo.newCounter);

      // ── Identifica o aluno ──────────────────────────────────────────────────
      const patientId      = storedCredential.patient_id;
      const patient        = await PatientModel.findById(patientId);

      if (!patient) {
        return res.status(404).json({ success: false, message: 'Aluno não encontrado no sistema.' });
      }

      const attendanceDate = date || new Date().toISOString().split('T')[0];

      // ── Verifica se já tem presença hoje ───────────────────────────────────
      const isDuplicate = await AttendanceModel.checkDuplicate(patientId, attendanceDate);
      if (isDuplicate) {
        return res.status(409).json({
          success: false,
          message:  `${patient.nome} já teve a presença registrada hoje.`,
          patient: { id: patient.id, nome: patient.nome }
        });
      }

      // ── Verifica se tem aula neste dia ─────────────────────────────────────
      const hasClass = patientHasClassOnDate(patient, attendanceDate);

      if (!hasClass) {
        // Aluno autenticado mas sem aula hoje.
        // Retorna os dados do aluno para o professor decidir:
        //   - lançar como avulsa (usa o endpoint /attendance/avulso existente)
        //   - ignorar
        return res.status(200).json({
          success:  true,
          hasClass: false,
          message:  `${patient.nome} não tem aula agendada para hoje.`,
          patient: {
            id:              patient.id,
            nome:            patient.nome,
            profissional_id: patient.profissional_id,
            dias:            patient.dias,
          }
        });
      }

      // ── Marca presença ─────────────────────────────────────────────────────
      const attendance = await AttendanceModel.create(patientId, {
        date: attendanceDate, status: 'present', notes: 'Check-in via biometria',
      });

      res.status(201).json({
        success:  true,
        hasClass: true,
        message:  `Presença de ${patient.nome} registrada com sucesso!`,
        patient: { id: patient.id, nome: patient.nome },
        data:    attendance,
      });
    } catch (error) {
      next(error);
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // GESTÃO DE CREDENCIAIS
  // ════════════════════════════════════════════════════════════════════════════

  static async listCredentials(req, res, next) {
    try {
      const { patientId } = req.params;
      const credentials = await BiometricCredentialModel.findByPatientId(patientId);
      res.json({ success: true, data: credentials });
    } catch (error) {
      next(error);
    }
  }

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