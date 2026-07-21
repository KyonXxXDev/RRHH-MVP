const express = require('express');
const { getDb } = require('../database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/reports/dashboard  — KPIs for the main dashboard
router.get('/dashboard', authenticate, (req, res) => {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];

  const totalEmployees = db.prepare("SELECT COUNT(*) as cnt FROM employees WHERE status = 'Activo'").get().cnt;
  const totalInactive = db.prepare("SELECT COUNT(*) as cnt FROM employees WHERE status = 'Inactivo'").get().cnt;

  const todayAtt = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'Presente' THEN 1 ELSE 0 END) as present,
      SUM(CASE WHEN status = 'Tardanza' THEN 1 ELSE 0 END) as tardiness,
      SUM(CASE WHEN status = 'Ausente' THEN 1 ELSE 0 END) as absent,
      SUM(overtime_minutes) as total_overtime
    FROM attendance WHERE date = ?
  `).get(today);

  const pendingPerms = db.prepare("SELECT COUNT(*) as cnt FROM permissions WHERE status IN ('Pendiente', 'Aprobado por Jefe')").get().cnt;
  const activeVacations = db.prepare(`
    SELECT COUNT(DISTINCT employee_id) as cnt FROM vacations 
    WHERE status = 'Aprobado' AND start_date <= ? AND end_date >= ?
  `).get(today, today).cnt;

  // Weekly attendance for last 7 days
  const weeklyData = db.prepare(`
    SELECT date, 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'Presente' THEN 1 ELSE 0 END) as present,
      SUM(CASE WHEN status = 'Tardanza' THEN 1 ELSE 0 END) as tardiness,
      SUM(CASE WHEN status = 'Ausente' THEN 1 ELSE 0 END) as absent
    FROM attendance 
    WHERE date >= date('now', '-7 days')
    GROUP BY date ORDER BY date
  `).all();

  // Area distribution
  const areaDistribution = db.prepare(`
    SELECT a.name, COUNT(e.id) as count
    FROM employees e
    JOIN areas a ON e.area_id = a.id
    WHERE e.status = 'Activo'
    GROUP BY a.name ORDER BY count DESC
  `).all();

  // Monthly tardiness trend
  const tardinessTrend = db.prepare(`
    SELECT strftime('%Y-%m', date) as month,
      COUNT(*) as count,
      SUM(tardiness_minutes) as total_minutes
    FROM attendance WHERE status = 'Tardanza'
    AND date >= date('now', '-6 months')
    GROUP BY month ORDER BY month
  `).all();

  // Recent activity (last 5 permissions)
  const recentPerms = db.prepare(`
    SELECT p.*, e.first_name || ' ' || e.last_name as employee_name
    FROM permissions p JOIN employees e ON p.employee_id = e.id
    ORDER BY p.created_at DESC LIMIT 5
  `).all();

  res.json({
    kpis: {
      total_employees: totalEmployees,
      total_inactive: totalInactive,
      today_present: todayAtt.present || 0,
      today_tardiness: todayAtt.tardiness || 0,
      today_absent: todayAtt.absent || 0,
      pending_permissions: pendingPerms,
      active_vacations: activeVacations,
      today_overtime_hours: Math.round((todayAtt.total_overtime || 0) / 60 * 10) / 10,
    },
    weekly_attendance: weeklyData,
    area_distribution: areaDistribution,
    tardiness_trend: tardinessTrend,
    recent_permissions: recentPerms,
  });
});

// GET /api/reports/attendance — Monthly attendance report
router.get('/attendance', authenticate, (req, res) => {
  const db = getDb();
  const { year, month, area_id } = req.query;
  const now = new Date();
  const y = year || now.getFullYear();
  const m = String(month || now.getMonth() + 1).padStart(2, '0');
  const dateFrom = `${y}-${m}-01`;
  const dateToRaw = new Date(y, m, 0);
  const dateTo = dateToRaw.toISOString().split('T')[0];

  let areaFilter = '';
  const params = [dateFrom, dateTo];
  if (area_id) { areaFilter = ' AND e.area_id = ?'; params.push(area_id); }

  const data = db.prepare(`
    SELECT e.code, e.first_name || ' ' || e.last_name as name, a.name as area_name,
      COUNT(at.id) as total_days,
      SUM(CASE WHEN at.status = 'Presente' THEN 1 ELSE 0 END) as present,
      SUM(CASE WHEN at.status = 'Tardanza' THEN 1 ELSE 0 END) as tardiness,
      SUM(CASE WHEN at.status = 'Ausente' THEN 1 ELSE 0 END) as absent,
      SUM(CASE WHEN at.status = 'Permiso' THEN 1 ELSE 0 END) as permission,
      SUM(at.tardiness_minutes) as total_tardiness_minutes,
      SUM(at.overtime_minutes) as total_overtime_minutes
    FROM employees e
    LEFT JOIN attendance at ON e.id = at.employee_id AND at.date BETWEEN ? AND ?
    LEFT JOIN areas a ON e.area_id = a.id
    WHERE e.status = 'Activo'${areaFilter}
    GROUP BY e.id ORDER BY a.name, e.last_name
  `).all(...params);

  res.json({ period: `${y}-${m}`, data });
});

// GET /api/reports/tardiness — Tardiness report
router.get('/tardiness', authenticate, (req, res) => {
  const db = getDb();
  const { date_from, date_to, area_id } = req.query;
  const now = new Date();
  const from = date_from || `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  const to = date_to || now.toISOString().split('T')[0];

  let areaFilter = '';
  const params = [from, to];
  if (area_id) { areaFilter = ' AND e.area_id = ?'; params.push(area_id); }

  const data = db.prepare(`
    SELECT e.code, e.first_name || ' ' || e.last_name as name, a.name as area_name,
      COUNT(at.id) as tardiness_count,
      SUM(at.tardiness_minutes) as total_minutes,
      AVG(at.tardiness_minutes) as avg_minutes,
      MAX(at.tardiness_minutes) as max_minutes
    FROM attendance at
    JOIN employees e ON at.employee_id = e.id
    LEFT JOIN areas a ON e.area_id = a.id
    WHERE at.status = 'Tardanza' AND at.date BETWEEN ? AND ?${areaFilter}
    GROUP BY e.id ORDER BY tardiness_count DESC
  `).all(...params);

  res.json({ from, to, data });
});

// GET /api/reports/overtime — Overtime report
router.get('/overtime', authenticate, (req, res) => {
  const db = getDb();
  const { date_from, date_to, area_id } = req.query;
  const now = new Date();
  const from = date_from || `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  const to = date_to || now.toISOString().split('T')[0];

  let areaFilter = '';
  const params = [from, to];
  if (area_id) { areaFilter = ' AND e.area_id = ?'; params.push(area_id); }

  const data = db.prepare(`
    SELECT e.code, e.first_name || ' ' || e.last_name as name, a.name as area_name,
      COUNT(at.id) as overtime_days,
      SUM(at.overtime_minutes) as total_minutes,
      ROUND(SUM(at.overtime_minutes) / 60.0, 2) as total_hours
    FROM attendance at
    JOIN employees e ON at.employee_id = e.id
    LEFT JOIN areas a ON e.area_id = a.id
    WHERE at.overtime_minutes > 0 AND at.date BETWEEN ? AND ?${areaFilter}
    GROUP BY e.id ORDER BY total_minutes DESC
  `).all(...params);

  res.json({ from, to, data });
});

// GET /api/reports/absenteeism — Absenteeism by area
router.get('/absenteeism', authenticate, (req, res) => {
  const db = getDb();
  const { date_from, date_to } = req.query;
  const now = new Date();
  const from = date_from || `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  const to = date_to || now.toISOString().split('T')[0];

  const data = db.prepare(`
    SELECT a.name as area_name,
      COUNT(DISTINCT e.id) as total_employees,
      SUM(CASE WHEN at.status = 'Ausente' THEN 1 ELSE 0 END) as total_absences,
      ROUND(SUM(CASE WHEN at.status = 'Ausente' THEN 1 ELSE 0 END) * 100.0 / COUNT(at.id), 2) as absenteeism_rate
    FROM employees e
    JOIN areas a ON e.area_id = a.id
    LEFT JOIN attendance at ON e.id = at.employee_id AND at.date BETWEEN ? AND ?
    WHERE e.status = 'Activo'
    GROUP BY a.id ORDER BY absenteeism_rate DESC
  `).all(from, to);

  res.json({ from, to, data });
});

module.exports = router;
