// controllers/biometricController.js
//
// Implementa o protocolo WebAuthn compatível com @simplewebauthn/server v10+
//
// BREAKING CHANGES v10 que este arquivo já contempla:
//   - registerComplete: registrationInfo.credentialID/credentialPublicKey/counter
//     → movidos para registrationInfo.credential.id / .publicKey / .counter
//   - authComplete: argumento `authenticator` com credentialID/credentialPublicKey
//     → substituído por `credential` com id/publicKey

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

// ─── Helper: extrai o challenge do clientDataJSON enviado pelo browser ───────
// O clientDataJSON chega como base64url. Decodificamos e extraímos o campo
// "challenge" para buscar o registro correspondente no banco.
function extractChallengeFromClientData(clientDataJSON) {
  try {
    const json = JSON.parse(Buffer.from(clientDataJSON, 'base64').toString('utf8'));
    return json.challenge || '';
  } catch {
    return '';
  }
}

class BiometricController {

  // ── REGISTRO — ETAPA 1 ────────────────────────────────────────────────────
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
        rpName:  RP_NAME,
        rpID:    RP_ID,
        // v10+: userID deve ser Uint8Array
        userID:  new Uint8Array(Buffer.from(String(patientId))),
        userName: patient.nome,
        excludeCredentials: existingCredentials.map(c => ({
          id:         c.credential_id,   // já é Base64URLString
          type:       'public-key',
          transports: ['internal'],
        })),
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification:        'required',
          residentKey:             'preferred',
        },
        timeout: 60000,
      });

      await BiometricCredentialModel.saveChallenge(options.challenge, 'registration', patientId);

      res.json({ success: true, data: { options, deviceName } });
    } catch (error) {
      next(error);
    }
  }

  // ── REGISTRO — ETAPA 2 ────────────────────────────────────────────────────
  static async registerComplete(req, res, next) {
    try {
      const { patientId, deviceName, credential } = req.body;

      if (!patientId || !credential) {
        return res.status(400).json({ success: false, message: 'patientId e credential são obrigatórios' });
      }

      // Extrai o challenge que está dentro do clientDataJSON para buscar no banco
      const challenge = extractChallengeFromClientData(credential.response.clientDataJSON);

      const challengeRecord = await BiometricCredentialModel.consumeChallenge(challenge, 'registration');

      if (!challengeRecord || String(challengeRecord.patient_id) !== String(patientId)) {
        return res.status(400).json({ success: false, message: 'Challenge inválido ou expirado. Tente novamente.' });
      }

      let verification;
      try {
        verification = await verifyRegistrationResponse({
          response:                credential,
          expectedChallenge:       challengeRecord.challenge,
          expectedOrigin:          RP_ORIGIN,
          expectedRPID:            RP_ID,
          requireUserVerification: true,
        });
      } catch (verifyError) {
        return res.status(400).json({ success: false, message: `Verificação falhou: ${verifyError.message}` });
      }

      if (!verification.verified || !verification.registrationInfo) {
        return res.status(400).json({ success: false, message: 'Registro biométrico não verificado' });
      }

      // v10+: dados da credencial estão em registrationInfo.credential
      //   .id        → Base64URLString (string, salva diretamente)
      //   .publicKey → Uint8Array (convertemos para base64url para o banco)
      //   .counter   → number
      const { credential: regCredential } = verification.registrationInfo;
      const publicKeyBase64url = Buffer.from(regCredential.publicKey).toString('base64url');

      await BiometricCredentialModel.create(
        patientId,
        regCredential.id,
        publicKeyBase64url,
        regCredential.counter,
        deviceName || 'Dispositivo'
      );

      res.status(201).json({ success: true, message: 'Biometria cadastrada com sucesso' });
    } catch (error) {
      next(error);
    }
  }

  // ── AUTENTICAÇÃO — ETAPA 1 ────────────────────────────────────────────────
  static async authBegin(req, res, next) {
    try {
      const { patientId } = req.body;

      if (!patientId) {
        return res.status(400).json({ success: false, message: 'patientId é obrigatório' });
      }

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
          id:         c.credential_id,   // Base64URLString
          type:       'public-key',
          transports: ['internal'],
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

  // ── AUTENTICAÇÃO — ETAPA 2 ────────────────────────────────────────────────
  static async authComplete(req, res, next) {
    try {
      const { patientId, credential, date } = req.body;

      if (!patientId || !credential) {
        return res.status(400).json({ success: false, message: 'patientId e credential são obrigatórios' });
      }

      const challenge = extractChallengeFromClientData(credential.response?.clientDataJSON);

      const challengeRecord = await BiometricCredentialModel.consumeChallenge(challenge, 'authentication');

      if (!challengeRecord || String(challengeRecord.patient_id) !== String(patientId)) {
        return res.status(400).json({ success: false, message: 'Challenge inválido ou expirado. Tente novamente.' });
      }

      // credential.id vem do browser como Base64URLString
      const storedCredential = await BiometricCredentialModel.findByCredentialId(credential.id);

      if (!storedCredential) {
        return res.status(404).json({ success: false, message: 'Credencial não encontrada' });
      }

      let verification;
      try {
        // v10+: argumento `authenticator` foi renomeado para `credential`
        //   id        → Base64URLString (direto do banco)
        //   publicKey → Uint8Array (reconstruído via Buffer)
        //   counter   → number
        verification = await verifyAuthenticationResponse({
          response:                credential,
          expectedChallenge:       challengeRecord.challenge,
          expectedOrigin:          RP_ORIGIN,
          expectedRPID:            RP_ID,
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

      // Atualiza counter — previne replay attacks
      await BiometricCredentialModel.updateCounter(
        credential.id,
        verification.authenticationInfo.newCounter
      );

      // Marca presença
      const attendanceDate = date || new Date().toISOString().split('T')[0];

      const isDuplicate = await AttendanceModel.checkDuplicate(patientId, attendanceDate);
      if (isDuplicate) {
        return res.status(409).json({ success: false, message: 'Presença já registrada para hoje' });
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