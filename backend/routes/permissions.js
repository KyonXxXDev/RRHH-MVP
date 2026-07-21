const express = require('express');
const { getDb } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/permissions
router.get('/', authenticate, (req, res) => {
  const db = getDb();
  const { status, employee_id, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let query = `
    SELECT p.*,
           e.first_name, e.last_name, e.code as employee_code,
           a.name as area_name,
           u1.name as manager_approver_name,
           u2.name as hr_approver_name
    FROM permissions p
    JOIN employees e ON p.employee_id = e.id
    LEFT JOIN areas a ON e.area_id = a.id
    LEFT JOIN users u1 ON p.manager_approved_by = u1.id
    LEFT JOIN users u2 ON p.hr_approved_by = u2.id
    WHERE 1=1
  `;
  const params = [];

  // If Colaborador, only see their own
  if (req.user.role === 'Colaborador') {
    query += ' AND p.employee_id = ?';
    params.push(req.user.employee_id);
  } else if (req.user.role === 'Jefe') {
    // Manager sees requests from their team
    const teamIds = db.prepare('SELECT id FROM employees WHERE manager_id = (SELECT id FROM employees WHERE id = ?)')
      .all(req.user.employee_id).map(e => e.id);
    teamIds.push(req.user.employee_id);
    query += ` AND p.employee_id IN (${teamIds.map(() => '?').join(',')})`;
    params.push(...teamIds);
  }

  if (employee_id) { query += ' AND p.employee_id = ?'; params.push(employee_id); }
  if (status) { query += ' AND p.status = ?'; params.push(status); }

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM (${query})`).get(...params).cnt;
  query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);

  res.json({ data: db.prepare(query).all(...params), total });
});

// POST /api/permissions
router.post('/', authenticate, (req, res) => {
  const db = getDb();
  const { employee_id, type, start_date, end_date, start_time, end_time, reason } = req.body;

  if (!type || !start_date || !end_date || !reason) {
    return res.status(400).json({ error: 'Tipo, fechas y motivo son requeridos' });
  }

  const empId = employee_id || req.user.employee_id;
  const result = db.prepare(`
    INSERT INTO permissions (employee_id, type, start_date, end_date, start_time, end_time, reason)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(empId, type, start_date, end_date, start_time, end_time, reason);

  res.status(201).json(db.prepare('SELECT * FROM permissions WHERE id = ?').get(result.lastInsertRowid));
});

// PUT /api/permissions/:id/status
router.put('/:id/status', authenticate, (req, res) => {
  const db = getDb();
  const { action, rejection_reason } = req.body; // 'approve' or 'reject'
  const perm = db.prepare('SELECT * FROM permissions WHERE id = ?').get(req.params.id);
  if (!perm) return res.status(404).json({ error: 'Permiso no encontrado' });

  let newStatus = perm.status;
  const updates = { rejection_reason: rejection_reason || null };

  if (action === 'approve') {
    if (req.user.role === 'Jefe' && perm.status === 'Pendiente') {
      newStatus = 'Aprobado por Jefe';
      updates.manager_approved_by = req.user.id;
      updates.manager_approved_at = new Date().toISOString();
    } else if ((req.user.role === 'RRHH' || req.user.role === 'Administrador') && perm.status === 'Aprobado por Jefe') {
      newStatus = 'Aprobado';
      updates.hr_approved_by = req.user.id;
      updates.hr_approved_at = new Date().toISOString();
    } else if (req.user.role === 'Administrador') {
      newStatus = 'Aprobado';
      updates.hr_approved_by = req.user.id;
      updates.hr_approved_at = new Date().toISOString();
    } else {
      return res.status(403).json({ error: 'No tienes permisos para esta acción en este estado' });
    }
  } else if (action === 'reject') {
    if (!['Administrador', 'RRHH', 'Jefe'].includes(req.user.role)) {
      return res.status(403).json({ error: 'No autorizado para rechazar' });
    }
    newStatus = 'Rechazado';
  }

  db.prepare(`
    UPDATE permissions SET 
      status = ?,
      manager_approved_by = COALESCE(?, manager_approved_by),
      manager_approved_at = COALESCE(?, manager_approved_at),
      hr_approved_by = COALESCE(?, hr_approved_by),
      hr_approved_at = COALESCE(?, hr_approved_at),
      rejection_reason = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    newStatus,
    updates.manager_approved_by || null,
    updates.manager_approved_at || null,
    updates.hr_approved_by || null,
    updates.hr_approved_at || null,
    updates.rejection_reason,
    req.params.id
  );

  res.json(db.prepare('SELECT * FROM permissions WHERE id = ?').get(req.params.id));
});

// DELETE /api/permissions/:id
router.delete('/:id', authenticate, (req, res) => {
  const db = getDb();
  const perm = db.prepare('SELECT * FROM permissions WHERE id = ?').get(req.params.id);
  if (!perm) return res.status(404).json({ error: 'Permiso no encontrado' });
  if (perm.status !== 'Pendiente') return res.status(400).json({ error: 'Solo se pueden cancelar permisos pendientes' });
  db.prepare('DELETE FROM permissions WHERE id = ?').run(req.params.id);
  res.json({ message: 'Permiso cancelado' });
});

module.exports = router;
