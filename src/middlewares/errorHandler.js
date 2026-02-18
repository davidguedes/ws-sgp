const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Erro de validação do Joi
  if (err.isJoi) {
    return res.status(400).json({
      success: false,
      message: 'Erro de validação',
      errors: err.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }

  // Erro do PostgreSQL
  if (err.code) {
    switch (err.code) {
      case '23505': // Unique violation
        return res.status(409).json({
          success: false,
          message: 'Registro duplicado',
          error: 'Este registro já existe no banco de dados'
        });
      
      case '23503': // Foreign key violation
        return res.status(400).json({
          success: false,
          message: 'Erro de integridade referencial',
          error: 'Registro referenciado não existe'
        });
      
      case '23502': // Not null violation
        return res.status(400).json({
          success: false,
          message: 'Campo obrigatório ausente',
          error: err.message
        });
      
      default:
        return res.status(500).json({
          success: false,
          message: 'Erro no banco de dados',
          error: process.env.NODE_ENV === 'development' ? err.message : 'Erro interno'
        });
    }
  }

  // Erro genérico
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Erro interno do servidor',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};

const notFound = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Rota não encontrada: ${req.originalUrl}`
  });
};

module.exports = {
  errorHandler,
  notFound
};
