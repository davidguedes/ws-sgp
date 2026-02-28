const Joi = require('joi');

// Schemas de Autenticação
const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Email inválido',
    'any.required': 'Email é obrigatório'
  }),
  senha: Joi.string().min(6).required().messages({
    'string.min': 'Senha deve ter no mínimo 6 caracteres',
    'any.required': 'Senha é obrigatória'
  })
});

const registerSchema = Joi.object({
  nome: Joi.string().min(3).max(255).required(),
  email: Joi.string().email().required(),
  senha: Joi.string().min(6).required(),
  role: Joi.string().valid('gestor', 'profissional').required()
});

const updatePasswordSchema = Joi.object({
  senhaAtual: Joi.string().required(),
  novaSenha: Joi.string().min(6).required()
});

// Schemas de Paciente
const createPatientSchema = Joi.object({
  nome: Joi.string().min(3).max(255).required(),
  profissional: Joi.number().integer().positive().required(),
  profissional_id: Joi.number().integer().positive(),
  dias: Joi.array().items(
    Joi.string().valid('seg', 'ter', 'qua', 'qui', 'sex', 'sab')
  ).min(1).required(),
  horarios: Joi.object().pattern(
    Joi.string(),
    Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
  ).optional(),
  tipo: Joi.string().valid('fixo', 'experimental', 'convenio').required(),
  valor: Joi.number().positive().allow(0).required(),
  porcentagem: Joi.number().min(0).max(100).required(),
  data_inicio: Joi.date().required(),
  data_fim: Joi.date().allow(null).optional(),
  data_fim: Joi.date().allow(null)
});

const updatePatientSchema = Joi.object({
  nome: Joi.string().min(3).max(255).required(),
  profissional: Joi.number().integer().positive().required(),
  profissional_id: Joi.number().integer().positive(),
  dias: Joi.array().items(
    Joi.string().valid('seg', 'ter', 'qua', 'qui', 'sex', 'sab')
  ).min(1).required(),
  horarios: Joi.object().pattern(
    Joi.string(),
    Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
  ).optional(),
  tipo: Joi.string().valid('fixo', 'experimental', 'convenio').required(),
  valor: Joi.number().positive().allow(0).required(),
  porcentagem: Joi.number().min(0).max(100).required(),
  data_inicio: Joi.date().required(),
  data_fim: Joi.date().allow(null).optional(),
  data_fim: Joi.date().allow(null)
});

// Schemas de Frequência
const createAttendanceSchema = Joi.object({
  date: Joi.date().required(),
  status: Joi.string().valid('present', 'absent', 'makeup').required(),
  notes: Joi.string().allow('').optional()
});

const updateAttendanceSchema = Joi.object({
  date: Joi.date().required(),
  status: Joi.string().valid('present', 'absent', 'makeup').required(),
  notes: Joi.string().allow('').optional()
});

// Schemas de Evolução
const createEvolutionSchema = Joi.object({
  date: Joi.date().optional(),
  eva: Joi.number().integer().min(0).max(10).allow(null).optional(),
  exercises: Joi.object({
    reformer: Joi.array().items(Joi.string()).optional(),
    cadillac: Joi.array().items(Joi.string()).optional(),
    chair: Joi.array().items(Joi.string()).optional(),
    barrel: Joi.array().items(Joi.string()).optional(),
    solo: Joi.array().items(Joi.string()).optional()
  }).optional(),
  notes: Joi.string().required()
});

const updateEvolutionSchema = Joi.object({
  date: Joi.date().required(),
  eva: Joi.number().integer().min(0).max(10).allow(null).optional(),
  exercises: Joi.object({
    reformer: Joi.array().items(Joi.string()).optional(),
    cadillac: Joi.array().items(Joi.string()).optional(),
    chair: Joi.array().items(Joi.string()).optional(),
    barrel: Joi.array().items(Joi.string()).optional(),
    solo: Joi.array().items(Joi.string()).optional()
  }).optional(),
  notes: Joi.string().required()
});

module.exports = {
  loginSchema,
  registerSchema,
  updatePasswordSchema,
  createPatientSchema,
  updatePatientSchema,
  createAttendanceSchema,
  updateAttendanceSchema,
  createEvolutionSchema,
  updateEvolutionSchema
};