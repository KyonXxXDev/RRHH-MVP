const express = require('express');
const { getDb } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/employees
router.get('/', authenticate, (req, res) => {
  const db = getDb();
  const { area_id, status, search, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let query = `
    SELECT e.*, 
           a.name as area_name, 
           p.name as position_name,
           COALESCE(m.first_name || ' ' || m.last_name, '') as manager_name
    FROM employees e
    LEFT JOIN areas a ON e.area_id = a.id
    LEFT JOIN positions p ON e.position_id = p.id
    LEFT JOIN employees m ON e.manager_id = m.id
    WHERE 1=1
  `;
  const params = [];

  if (area_id) { query += ' AND e.area_id = ?'; params.push(area_id); }
  if (status) { query += ' AND e.status = ?'; params.push(status); }
  if (search) {
    query += ' AND (e.first_name LIKE ? OR e.last_name LIKE ? OR e.code LIKE ? OR e.email LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM (${query})`).get(...params).cnt;
  query += ' ORDER BY e.first_name, e.last_name LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);

  const employees = db.prepare(query).all(...params);
  res.json({ data: employees, total, page: parseInt(page), limit: parseInt(limit) });
});

// GET /api/employees/:id
router.get('/:id', authenticate, (req, res) => {
  const db = getDb();
  const employee = db.prepare(`
    SELECT e.*, 
           a.name as area_name, 
           p.name as position_name,
           COALESCE(m.first_name || ' ' || m.last_name, '') as manager_name
    FROM employees e
    LEFT JOIN areas a ON e.area_id = a.id
    LEFT JOIN positions p ON e.position_id = p.id
    LEFT JOIN employees m ON e.manager_id = m.id
    WHERE e.id = ?
  `).get(req.params.id);

  if (!employee) return res.status(404).json({ error: 'Colaborador no encontrado' });
  res.json(employee);
});

// POST /api/employees
router.post('/', authenticate, authorize('Administrador', 'RRHH'), (req, res) => {
  const db = getDb();
  const { first_name, last_name, email, phone, dni, area_id, position_id, manager_id, hire_date, birth_date, address } = req.body;

  if (!first_name || !last_name || !email || !hire_date) {
    return res.status(400).json({ error: 'Campos obligatorios: nombre, apellido, email, fecha de ingreso' });
  }

  // Generate code
  const last = db.prepare("SELECT code FROM employees ORDER BY id DESC LIMIT 1").get();
  const nextNum = last ? parseInt(last.code.replace('EMP', '')) + 1 : 1;
  const code = `EMP${String(nextNum).padStart(3, '0')}`;

  try {
    const result = db.prepare(`
      INSERT INTO employees (code, first_name, last_name, email, phone, dni, area_id, position_id, manager_id, hire_date, birth_date, address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(code, first_name, last_name, email, phone, dni, area_id, position_id, manager_id || null, hire_date, birth_date, address);

    // Log history
    db.prepare(`INSERT INTO employee_history (employee_id, change_type, new_value, changed_by) VALUES (?, ?, ?, ?)`)
      .run(result.lastInsertRowid, 'Ingreso', 'Colaborador registrado en el sistema', req.user.id);

    const newEmp = db.prepare('SELECT * FROM employees WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newEmp);
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'El email o DNI ya está registrado' });
    throw err;
  }
});

// PUT /api/employees/:id
router.put('/:id', authenticate, authorize('Administrador', 'RRHH'), (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Colaborador no encontrado' });

  const { first_name, last_name, email, phone, dni, area_id, position_id, manager_id, hire_date, birth_date, address, status } = req.body;

  db.prepare(`
    UPDATE employees SET
      first_name = COALESCE(?, first_name),
      last_name = COALESCE(?, last_name),
      email = COALESCE(?, email),
      phone = COALESCE(?, phone),
      dni = COALESCE(?, dni),
      area_id = COALESCE(?, area_id),
      position_id = COALESCE(?, position_id),
      manager_id = COALESCE(?, manager_id),
      hire_date = COALESCE(?, hire_date),
      birth_date = COALESCE(?, birth_date),
      address = COALESCE(?, address),
      status = COALESCE(?, status),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(first_name, last_name, email, phone, dni, area_id, position_id, manager_id, hire_date, birth_date, address, status, req.params.id);

  // Log changes
  if (status && status !== existing.status) {
    db.prepare(`INSERT INTO employee_history (employee_id, change_type, old_value, new_value, changed_by) VALUES (?, ?, ?, ?, ?)`)
      .run(req.params.id, 'Cambio de Estado', existing.status, status, req.user.id);
  }
  if (area_id && area_id != existing.area_id) {
    db.prepare(`INSERT INTO employee_history (employee_id, change_type, old_value, new_value, changed_by) VALUES (?, ?, ?, ?, ?)`)
      .run(req.params.id, 'Cambio de Área', existing.area_id, area_id, req.user.id);
  }

  const updated = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /api/employees/:id  (soft delete)
router.delete('/:id', authenticate, authorize('Administrador'), (req, res) => {
  const db = getDb();
  db.prepare("UPDATE employees SET status = 'Inactivo', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id);
  res.json({ message: 'Colaborador desactivado correctamente' });
});

// GET /api/employees/:id/history
router.get('/:id/history', authenticate, (req, res) => {
  const db = getDb();
  const history = db.prepare(`
    SELECT eh.*, COALESCE(u.name, 'Sistema') as changed_by_name
    FROM employee_history eh
    LEFT JOIN users u ON eh.changed_by = u.id
    WHERE eh.employee_id = ?
    ORDER BY eh.created_at DESC
  `).all(req.params.id);
  res.json(history);
});

// GET /api/areas
router.get('/meta/areas', authenticate, (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM areas ORDER BY name').all());
});

// GET /api/positions
router.get('/meta/positions', authenticate, (req, res) => {
  const db = getDb();
  const { area_id } = req.query;
  const query = area_id
    ? 'SELECT * FROM positions WHERE area_id = ? ORDER BY name'
    : 'SELECT * FROM positions ORDER BY name';
  const params = area_id ? [area_id] : [];
  res.json(db.prepare(query).all(...params));
});

module.exports = router;
