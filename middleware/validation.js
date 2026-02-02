// backend/middleware/validation.js
// Request validation middleware

// Validate email format
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate phone format (French)
const validatePhone = (phone) => {
  const phoneRegex = /^(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/;
  return phoneRegex.test(phone);
};

// Validate UUID
const validateUUID = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

// Middleware: Validate registration data
const validateRegistration = (req, res, next) => {
  const { email, password, firstname, lastname } = req.body;
  
  const errors = [];
  
  if (!email || !validateEmail(email)) {
    errors.push('Email invalide');
  }
  
  if (!password || password.length < 8) {
    errors.push('Le mot de passe doit contenir au moins 8 caractères');
  }
  
  if (!firstname || firstname.trim().length < 2) {
    errors.push('Le prénom doit contenir au moins 2 caractères');
  }
  
  if (!lastname || lastname.trim().length < 2) {
    errors.push('Le nom doit contenir au moins 2 caractères');
  }
  
  if (errors.length > 0) {
    return res.status(400).json({ 
      error: 'Données invalides', 
      details: errors 
    });
  }
  
  next();
};

// Middleware: Validate login data
const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  
  const errors = [];
  
  if (!email || !validateEmail(email)) {
    errors.push('Email invalide');
  }
  
  if (!password) {
    errors.push('Mot de passe requis');
  }
  
  if (errors.length > 0) {
    return res.status(400).json({ 
      error: 'Données invalides', 
      details: errors 
    });
  }
  
  next();
};

// Middleware: Validate reservation data
const validateReservation = (req, res, next) => {
  const { reservation_date, reservation_time, meeting_type } = req.body;
  
  const errors = [];
  
  if (!reservation_date) {
    errors.push('Date de réservation requise');
  } else {
    const date = new Date(reservation_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (date < today) {
      errors.push('La date de réservation ne peut pas être dans le passé');
    }
  }
  
  if (!reservation_time) {
    errors.push('Heure de réservation requise');
  }
  
  if (meeting_type && !['visio', 'presentiel'].includes(meeting_type)) {
    errors.push('Type de réunion invalide (visio ou presentiel)');
  }
  
  if (errors.length > 0) {
    return res.status(400).json({ 
      error: 'Données invalides', 
      details: errors 
    });
  }
  
  next();
};

// Middleware: Validate contact message
const validateContactMessage = (req, res, next) => {
  const { name, email, message } = req.body;
  
  const errors = [];
  
  if (!name || name.trim().length < 2) {
    errors.push('Le nom doit contenir au moins 2 caractères');
  }
  
  if (!email || !validateEmail(email)) {
    errors.push('Email invalide');
  }
  
  if (!message || message.trim().length < 10) {
    errors.push('Le message doit contenir au moins 10 caractères');
  }
  
  if (errors.length > 0) {
    return res.status(400).json({ 
      error: 'Données invalides', 
      details: errors 
    });
  }
  
  next();
};

// Middleware: Validate UUID parameter
const validateUUIDParam = (paramName) => {
  return (req, res, next) => {
    const uuid = req.params[paramName];
    
    if (!uuid || !validateUUID(uuid)) {
      return res.status(400).json({ 
        error: 'ID invalide',
        message: `Le paramètre ${paramName} doit être un UUID valide`
      });
    }
    
    next();
  };
};

// Middleware: Sanitize input (basic XSS protection)
const sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    if (typeof obj === 'string') {
      return obj
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    }
    
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitize(value);
      }
      return sanitized;
    }
    
    return obj;
  };
  
  if (req.body) {
    req.body = sanitize(req.body);
  }
  
  if (req.query) {
    req.query = sanitize(req.query);
  }
  
  next();
};

module.exports = {
  validateEmail,
  validatePhone,
  validateUUID,
  validateRegistration,
  validateLogin,
  validateReservation,
  validateContactMessage,
  validateUUIDParam,
  sanitizeInput
};
