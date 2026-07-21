const express = require('express');
const { getDb } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/licenses
router.get('/', authenticate, (req, res) => {
  const db = getDb();
  const { status, employee_id, type } = req.query;

  let query = `
    SELECT l.*,
           e.first_name, e.last_name, e.code as employee_code,
           a.name as area_name,
           u.name as approved_by_name
    FROM licenses l
    JOIN employees e ON l.employee_id = e.id
    LEFT JOIN areas a ON e.area_id = a.id
    LEFT JOIN users u ON l.approved_by = u.id
    WHERE 1=1
  `;
  const params = [];

  if (req.user.role === 'Colaborador') {
    query += ' AND l.employee_id = ?'; params.push(req.user.employee_id);
  }
  if (employee_id) { query += ' AND l.employee_id = ?'; params.push(employee_id); }
  if (status) { query += ' AND l.status = ?'; params.push(status); }
  if (type) { query += ' AND l.type = ?'; params.push(type); }

  query += ' ORDER BY l.created_at DESC';
  res.json(db.prepare(query).all(...params));
});

// POST /api/licenses
router.post('/', authenticate, (req, res) => {
  const db = getDb();
  const { employee_id, type, start_date, end_date, document_number, notes } = req.body;

  if (!type || !start_date || !end_date) {
    return res.status(400).json({ error: 'Tipo y fechas son requeridos' });
  }

  const empId = employee_id || req.user.employee_id;

  const sd = new Date(start_date);
  const ed = new Date(end_date);
  let days = 0;
  const cursor = new Date(sd);
  while (cursor <= ed) {
    const d = cursor.getDay();
    if (d !== 0 && d !== 6) days++;
    cursor.setDate(cursor.getDate() + 1);
  }

  const result = db.prepare(`
    INSERT INTO licenses (employee_id, type, start_date, end_date, days_count, document_number, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(empId, type, start_date, end_date, days, document_number, notes);

  res.status(201).json(db.prepare('SELECT * FROM licenses WHERE id = ?').get(result.lastInsertRowid));
});

// PUT /api/licenses/:id/status
router.put('/:id/status', authenticate, authorize('Administrador', 'RRHH'), (req, res) => {
  const db = getDb();
  const { action, rejection_reason } = req.body;
  const lic = db.prepare('SELECT * FROM licenses WHERE id = ?').get(req.params.id);
  if (!lic) return res.status(404).json({ error: 'Licencia no encontrada' });

  const newStatus = action === 'approve' ? 'Aprobado' : 'Rechazado';

  db.prepare(`
    UPDATE licenses SET status = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(newStatus, req.user.id, req.params.id);

  res.json(db.prepare('SELECT * FROM licenses WHERE id = ?').get(req.params.id));
});

module.exports = router;
