const express = require('express');
const { getDb } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/vacations
router.get('/', authenticate, (req, res) => {
  const db = getDb();
  const { status, employee_id } = req.query;

  let query = `
    SELECT v.*,
           e.first_name, e.last_name, e.code as employee_code,
           a.name as area_name,
           e.vacation_days_available,
           u.name as approved_by_name
    FROM vacations v
    JOIN employees e ON v.employee_id = e.id
    LEFT JOIN areas a ON e.area_id = a.id
    LEFT JOIN users u ON v.approved_by = u.id
    WHERE 1=1
  `;
  const params = [];

  if (req.user.role === 'Colaborador') {
    query += ' AND v.employee_id = ?'; params.push(req.user.employee_id);
  }
  if (employee_id) { query += ' AND v.employee_id = ?'; params.push(employee_id); }
  if (status) { query += ' AND v.status = ?'; params.push(status); }

  query += ' ORDER BY v.created_at DESC';
  res.json(db.prepare(query).all(...params));
});

// POST /api/vacations
router.post('/', authenticate, (req, res) => {
  const db = getDb();
  const { employee_id, start_date, end_date, reason } = req.body;

  if (!start_date || !end_date) {
    return res.status(400).json({ error: 'Fechas de inicio y fin son requeridas' });
  }

  const empId = employee_id || req.user.employee_id;

  // Calculate business days
  const sd = new Date(start_date);
  const ed = new Date(end_date);
  let days = 0;
  const cursor = new Date(sd);
  while (cursor <= ed) {
    const d = cursor.getDay();
    if (d !== 0 && d !== 6) days++;
    cursor.setDate(cursor.getDate() + 1);
  }

  // Check available days
  const emp = db.prepare('SELECT vacation_days_available FROM employees WHERE id = ?').get(empId);
  if (!emp) return res.status(404).json({ error: 'Colaborador no encontrado' });
  if (emp.vacation_days_available < days) {
    return res.status(400).json({ error: `Días insuficientes. Disponibles: ${emp.vacation_days_available}, solicitados: ${days}` });
  }

  // Check overlap
  const overlap = db.prepare(`
    SELECT id FROM vacations WHERE employee_id = ? AND status NOT IN ('Rechazado', 'Cancelado')
    AND NOT (end_date < ? OR start_date > ?)
  `).get(empId, start_date, end_date);
  if (overlap) return res.status(409).json({ error: 'Ya existe una solicitud de vacaciones en ese período' });

  const result = db.prepare(`
    INSERT INTO vacations (employee_id, start_date, end_date, days_count, reason)
    VALUES (?, ?, ?, ?, ?)
  `).run(empId, start_date, end_date, days, reason);

  res.status(201).json(db.prepare('SELECT * FROM vacations WHERE id = ?').get(result.lastInsertRowid));
});

// PUT /api/vacations/:id/status
router.put('/:id/status', authenticate, authorize('Administrador', 'RRHH', 'Jefe'), (req, res) => {
  const db = getDb();
  const { action, rejection_reason } = req.body;
  const vac = db.prepare('SELECT * FROM vacations WHERE id = ?').get(req.params.id);
  if (!vac) return res.status(404).json({ error: 'Solicitud no encontrada' });

  let newStatus = action === 'approve' ? 'Aprobado' : 'Rechazado';

  if (newStatus === 'Aprobado') {
    // Deduct days from employee
    db.prepare('UPDATE employees SET vacation_days_available = vacation_days_available - ? WHERE id = ?')
      .run(vac.days_count, vac.employee_id);
  }

  db.prepare(`
    UPDATE vacations SET status = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP,
    rejection_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(newStatus, req.user.id, rejection_reason || null, req.params.id);

  res.json(db.prepare('SELECT * FROM vacations WHERE id = ?').get(req.params.id));
});

module.exports = router;
