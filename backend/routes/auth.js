const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'hrms_secret_key_2024';

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son requeridos' });
  }

  const db = getDb();
  const user = db.prepare(`
    SELECT u.*, e.first_name, e.last_name, e.area_id, e.position_id, e.code as employee_code
    FROM users u
    LEFT JOIN employees e ON u.employee_id = e.id
    WHERE u.email = ? AND u.active = 1
  `).get(email);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      employee_id: user.employee_id,
      employee_code: user.employee_code
    },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      employee_id: user.employee_id,
      employee_code: user.employee_code
    }
  });
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  const db = getDb();
  const user = db.prepare(`
    SELECT u.id, u.email, u.name, u.role, u.employee_id,
           e.first_name, e.last_name, e.code as employee_code,
           a.name as area_name, p.name as position_name
    FROM users u
    LEFT JOIN employees e ON u.employee_id = e.id
    LEFT JOIN areas a ON e.area_id = a.id
    LEFT JOIN positions p ON e.position_id = p.id
    WHERE u.id = ?
  `).get(req.user.id);

  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(user);
});

module.exports = router;
