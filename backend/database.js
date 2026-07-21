const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'hrms.db');

let db;

function getDb() {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
  }
  return db;
}

function initializeDatabase() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS areas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      area_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (area_id) REFERENCES areas(id)
    );

    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      dni TEXT UNIQUE,
      area_id INTEGER,
      position_id INTEGER,
      manager_id INTEGER,
      hire_date DATE NOT NULL,
      birth_date DATE,
      address TEXT,
      status TEXT DEFAULT 'Activo' CHECK(status IN ('Activo', 'Inactivo')),
      vacation_days_available INTEGER DEFAULT 30,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (area_id) REFERENCES areas(id),
      FOREIGN KEY (position_id) REFERENCES positions(id),
      FOREIGN KEY (manager_id) REFERENCES employees(id)
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('Administrador', 'RRHH', 'Jefe', 'Colaborador')),
      employee_id INTEGER,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      date DATE NOT NULL,
      check_in DATETIME,
      check_out DATETIME,
      tardiness_minutes INTEGER DEFAULT 0,
      overtime_minutes INTEGER DEFAULT 0,
      status TEXT DEFAULT 'Presente' CHECK(status IN ('Presente', 'Ausente', 'Tardanza', 'Permiso', 'Vacaciones', 'Licencia')),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id),
      UNIQUE(employee_id, date)
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      start_time TEXT,
      end_time TEXT,
      reason TEXT NOT NULL,
      status TEXT DEFAULT 'Pendiente' CHECK(status IN ('Pendiente', 'Aprobado por Jefe', 'Aprobado', 'Rechazado')),
      manager_approved_by INTEGER,
      manager_approved_at DATETIME,
      hr_approved_by INTEGER,
      hr_approved_at DATETIME,
      rejection_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id),
      FOREIGN KEY (manager_approved_by) REFERENCES users(id),
      FOREIGN KEY (hr_approved_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS vacations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      days_count INTEGER NOT NULL,
      reason TEXT,
      status TEXT DEFAULT 'Pendiente' CHECK(status IN ('Pendiente', 'Aprobado', 'Rechazado', 'Cancelado')),
      approved_by INTEGER,
      approved_at DATETIME,
      rejection_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id),
      FOREIGN KEY (approved_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS licenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('Médica', 'Maternidad', 'Paternidad', 'Estudio', 'Duelo', 'Otro')),
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      days_count INTEGER NOT NULL,
      document_number TEXT,
      notes TEXT,
      status TEXT DEFAULT 'Pendiente' CHECK(status IN ('Pendiente', 'Aprobado', 'Rechazado')),
      approved_by INTEGER,
      approved_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id),
      FOREIGN KEY (approved_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS employee_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      change_type TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      notes TEXT,
      changed_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id),
      FOREIGN KEY (changed_by) REFERENCES users(id)
    );
  `);

  seedData(db);
}

function seedData(db) {
  const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get();
  if (userCount.cnt > 0) return;

  // Seed Areas
  const insertArea = db.prepare('INSERT OR IGNORE INTO areas (name, description) VALUES (?, ?)');
  const areas = [
    ['Gerencia', 'Alta dirección de la empresa'],
    ['Recursos Humanos', 'Gestión del talento humano'],
    ['Tecnología', 'Departamento de sistemas e IT'],
    ['Ventas', 'Área comercial y ventas'],
    ['Operaciones', 'Gestión operativa y logística'],
    ['Finanzas', 'Contabilidad y finanzas'],
    ['Marketing', 'Marketing y comunicaciones'],
  ];
  for (const [name, desc] of areas) insertArea.run(name, desc);

  // Seed Positions
  const insertPos = db.prepare('INSERT OR IGNORE INTO positions (name, area_id) VALUES (?, ?)');
  const getArea = db.prepare('SELECT id FROM areas WHERE name = ?');

  const positions = [
    ['Director General', 'Gerencia'],
    ['Gerente General', 'Gerencia'],
    ['Jefa de RRHH', 'Recursos Humanos'],
    ['Analista de RRHH', 'Recursos Humanos'],
    ['Asistente de RRHH', 'Recursos Humanos'],
    ['Jefe de TI', 'Tecnología'],
    ['Desarrollador Senior', 'Tecnología'],
    ['Desarrolladora Junior', 'Tecnología'],
    ['DevOps Engineer', 'Tecnología'],
    ['Jefa de Ventas', 'Ventas'],
    ['Ejecutivo de Ventas', 'Ventas'],
    ['Supervisor de Operaciones', 'Operaciones'],
    ['Operario', 'Operaciones'],
    ['Analista Financiero', 'Finanzas'],
    ['Contadora', 'Finanzas'],
    ['Diseñadora Gráfica', 'Marketing'],
    ['Analista de Marketing', 'Marketing'],
  ];

  for (const [name, areaName] of positions) {
    const area = getArea.get(areaName);
    if (area) insertPos.run(name, area.id);
  }

  // Seed Employees
  const getPos = db.prepare('SELECT id FROM positions WHERE name = ?');
  const insertEmp = db.prepare(`
    INSERT OR IGNORE INTO employees 
    (code, first_name, last_name, email, phone, dni, area_id, position_id, hire_date, birth_date, status, vacation_days_available)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const areaGer = getArea.get('Gerencia').id;
  const areaRRHH = getArea.get('Recursos Humanos').id;
  const areaTec = getArea.get('Tecnología').id;
  const areaVen = getArea.get('Ventas').id;
  const areaOpe = getArea.get('Operaciones').id;
  const areaFin = getArea.get('Finanzas').id;
  const areaMkt = getArea.get('Marketing').id;

  const empData = [
    ['EMP001', 'Carlos', 'Mendoza Ríos', 'carlos.mendoza@empresa.com', '987654001', '70000001', areaGer, getPos.get('Director General').id, '2018-03-01', '1975-05-15', 'Activo', 30],
    ['EMP002', 'Ana', 'García Flores', 'ana.garcia@empresa.com', '987654002', '70000002', areaRRHH, getPos.get('Jefa de RRHH').id, '2019-06-01', '1982-08-20', 'Activo', 22],
    ['EMP003', 'Luis', 'Torres Vega', 'luis.torres@empresa.com', '987654003', '70000003', areaTec, getPos.get('Jefe de TI').id, '2020-01-15', '1985-03-10', 'Activo', 18],
    ['EMP004', 'María', 'Ramírez Cruz', 'maria.ramirez@empresa.com', '987654004', '70000004', areaVen, getPos.get('Jefa de Ventas').id, '2019-09-01', '1983-11-25', 'Activo', 25],
    ['EMP005', 'Pedro', 'Castro Luna', 'pedro.castro@empresa.com', '987654005', '70000005', areaTec, getPos.get('Desarrollador Senior').id, '2021-03-10', '1990-07-14', 'Activo', 15],
    ['EMP006', 'Sofía', 'Herrera Díaz', 'sofia.herrera@empresa.com', '987654006', '70000006', areaTec, getPos.get('Desarrolladora Junior').id, '2022-08-01', '1995-02-28', 'Activo', 30],
    ['EMP007', 'Diego', 'Morales Paz', 'diego.morales@empresa.com', '987654007', '70000007', areaVen, getPos.get('Ejecutivo de Ventas').id, '2021-11-01', '1992-09-05', 'Activo', 28],
    ['EMP008', 'Carmen', 'López Salas', 'carmen.lopez@empresa.com', '987654008', '70000008', areaFin, getPos.get('Analista Financiero').id, '2020-04-15', '1988-04-18', 'Activo', 20],
    ['EMP009', 'Roberto', 'Silva Mena', 'roberto.silva@empresa.com', '987654009', '70000009', areaOpe, getPos.get('Supervisor de Operaciones').id, '2019-02-01', '1981-12-30', 'Activo', 10],
    ['EMP010', 'Elena', 'Vargas Quispe', 'elena.vargas@empresa.com', '987654010', '70000010', areaMkt, getPos.get('Diseñadora Gráfica').id, '2022-01-10', '1994-06-22', 'Activo', 30],
    ['EMP011', 'Juan', 'Pérez Salinas', 'juan.perez@empresa.com', '987654011', '70000011', areaTec, getPos.get('DevOps Engineer').id, '2021-07-01', '1991-10-08', 'Activo', 20],
    ['EMP012', 'Patricia', 'Flores Ríos', 'patricia.flores@empresa.com', '987654012', '70000012', areaRRHH, getPos.get('Analista de RRHH').id, '2022-03-01', '1993-01-15', 'Activo', 30],
    ['EMP013', 'Miguel', 'Ruiz Torres', 'miguel.ruiz@empresa.com', '987654013', '70000013', areaVen, getPos.get('Ejecutivo de Ventas').id, '2023-01-05', '1996-03-20', 'Activo', 30],
    ['EMP014', 'Andrea', 'Sánchez Lara', 'andrea.sanchez@empresa.com', '987654014', '70000014', areaFin, getPos.get('Contadora').id, '2020-09-01', '1987-07-11', 'Activo', 12],
    ['EMP015', 'Fernando', 'González Ramos', 'fernando.gonzalez@empresa.com', '987654015', '70000015', areaOpe, getPos.get('Operario').id, '2023-06-01', '1998-05-03', 'Activo', 30],
    ['EMP016', 'Valeria', 'Chávez Medina', 'valeria.chavez@empresa.com', '987654016', '70000016', areaMkt, getPos.get('Analista de Marketing').id, '2022-11-01', '1994-08-17', 'Activo', 30],
    ['EMP017', 'Ricardo', 'Mendez Palma', 'ricardo.mendez@empresa.com', '987654017', '70000017', areaRRHH, getPos.get('Asistente de RRHH').id, '2023-09-01', '1999-04-25', 'Activo', 30],
    ['EMP018', 'Laura', 'Espinoza Reyes', 'laura.espinoza@empresa.com', '987654018', '70000018', areaOpe, getPos.get('Operario').id, '2022-05-15', '1993-11-09', 'Inactivo', 5],
  ];

  for (const emp of empData) insertEmp.run(...emp);

  // Update managers
  const updateMgr = db.prepare('UPDATE employees SET manager_id = ? WHERE code = ?');
  const getEmpByCode = db.prepare('SELECT id FROM employees WHERE code = ?');

  const mgr1 = getEmpByCode.get('EMP001').id; // Carlos (Director)
  const mgr2 = getEmpByCode.get('EMP002').id; // Ana (Jefa RRHH)
  const mgr3 = getEmpByCode.get('EMP003').id; // Luis (Jefe TI)
  const mgr4 = getEmpByCode.get('EMP004').id; // María (Jefa Ventas)
  const mgr9 = getEmpByCode.get('EMP009').id; // Roberto (Supervisor)

  updateMgr.run(mgr1, 'EMP002');
  updateMgr.run(mgr1, 'EMP003');
  updateMgr.run(mgr1, 'EMP004');
  updateMgr.run(mgr1, 'EMP009');
  updateMgr.run(mgr2, 'EMP012');
  updateMgr.run(mgr2, 'EMP017');
  updateMgr.run(mgr3, 'EMP005');
  updateMgr.run(mgr3, 'EMP006');
  updateMgr.run(mgr3, 'EMP011');
  updateMgr.run(mgr4, 'EMP007');
  updateMgr.run(mgr4, 'EMP013');
  updateMgr.run(mgr9, 'EMP015');
  updateMgr.run(mgr9, 'EMP018');

  // Seed Users
  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (name, email, password_hash, role, employee_id) VALUES (?, ?, ?, ?, ?)
  `);

  const pwd = (p) => bcrypt.hashSync(p, 10);

  const emp1 = getEmpByCode.get('EMP001').id;
  const emp2 = getEmpByCode.get('EMP002').id;
  const emp3 = getEmpByCode.get('EMP003').id;
  const emp5 = getEmpByCode.get('EMP005').id;

  insertUser.run('Carlos Mendoza', 'admin@empresa.com', pwd('Admin123!'), 'Administrador', emp1);
  insertUser.run('Ana García', 'rrhh@empresa.com', pwd('RRHH123!'), 'RRHH', emp2);
  insertUser.run('Luis Torres', 'jefe@empresa.com', pwd('Jefe123!'), 'Jefe', emp3);
  insertUser.run('Pedro Castro', 'colaborador@empresa.com', pwd('Colab123!'), 'Colaborador', emp5);

  // Seed Attendance (last 30 days)
  const insertAtt = db.prepare(`
    INSERT OR IGNORE INTO attendance 
    (employee_id, date, check_in, check_out, tardiness_minutes, overtime_minutes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const allEmps = db.prepare("SELECT id FROM employees WHERE status = 'Activo'").all();
  const today = new Date();

  for (let d = 30; d >= 1; d--) {
    const date = new Date(today);
    date.setDate(today.getDate() - d);
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue; // skip weekends

    const dateStr = date.toISOString().split('T')[0];

    for (const emp of allEmps) {
      const rand = Math.random();
      if (rand < 0.05) {
        // Falta (5%)
        insertAtt.run(emp.id, dateStr, null, null, 0, 0, 'Ausente');
      } else if (rand < 0.15) {
        // Tardanza (10%)
        const tardMins = Math.floor(Math.random() * 45) + 5;
        const checkIn = `${dateStr} 0${8 + Math.floor(tardMins/60)}:${String(tardMins % 60).padStart(2,'0')}:00`;
        const checkOut = `${dateStr} 17:30:00`;
        insertAtt.run(emp.id, dateStr, checkIn, checkOut, tardMins, 0, 'Tardanza');
      } else {
        // Presente
        const overtime = Math.random() < 0.2 ? Math.floor(Math.random() * 120) + 30 : 0;
        const checkIn = `${dateStr} 08:${String(Math.floor(Math.random()*5)).padStart(2,'0')}:00`;
        const checkOutHour = 17 + Math.floor(overtime/60);
        const checkOutMin = String(30 + (overtime % 60)).padStart(2,'0');
        const checkOut = `${dateStr} ${checkOutHour}:${checkOutMin}:00`;
        insertAtt.run(emp.id, dateStr, checkIn, checkOut, 0, overtime, 'Presente');
      }
    }
  }

  // Seed Permissions
  const insertPerm = db.prepare(`
    INSERT OR IGNORE INTO permissions 
    (employee_id, type, start_date, end_date, reason, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const permTypes = ['Personal', 'Médico', 'Familiar', 'Capacitación', 'Otro'];
  const permStatuses = ['Pendiente', 'Aprobado por Jefe', 'Aprobado', 'Rechazado'];

  const empIds = allEmps.map(e => e.id);
  for (let i = 0; i < 12; i++) {
    const empId = empIds[Math.floor(Math.random() * empIds.length)];
    const daysOffset = Math.floor(Math.random() * 60) - 30;
    const sd = new Date(); sd.setDate(sd.getDate() + daysOffset);
    const ed = new Date(sd); ed.setDate(sd.getDate() + Math.floor(Math.random() * 2));
    insertPerm.run(
      empId,
      permTypes[Math.floor(Math.random() * permTypes.length)],
      sd.toISOString().split('T')[0],
      ed.toISOString().split('T')[0],
      'Solicitud de permiso por motivos personales',
      permStatuses[Math.floor(Math.random() * permStatuses.length)]
    );
  }

  // Seed Vacations
  const insertVac = db.prepare(`
    INSERT OR IGNORE INTO vacations 
    (employee_id, start_date, end_date, days_count, reason, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (let i = 0; i < 8; i++) {
    const empId = empIds[Math.floor(Math.random() * empIds.length)];
    const daysOffset = Math.floor(Math.random() * 90) - 45;
    const sd = new Date(); sd.setDate(sd.getDate() + daysOffset);
    const count = Math.floor(Math.random() * 10) + 5;
    const ed = new Date(sd); ed.setDate(sd.getDate() + count);
    const statuses = ['Pendiente', 'Aprobado', 'Aprobado', 'Rechazado'];
    insertVac.run(
      empId,
      sd.toISOString().split('T')[0],
      ed.toISOString().split('T')[0],
      count,
      'Vacaciones programadas',
      statuses[Math.floor(Math.random() * statuses.length)]
    );
  }

  // Seed Licenses
  const insertLic = db.prepare(`
    INSERT OR IGNORE INTO licenses 
    (employee_id, type, start_date, end_date, days_count, notes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const licTypes = ['Médica', 'Paternidad', 'Estudio', 'Duelo', 'Otro'];
  for (let i = 0; i < 6; i++) {
    const empId = empIds[Math.floor(Math.random() * empIds.length)];
    const daysOffset = Math.floor(Math.random() * 60) - 30;
    const sd = new Date(); sd.setDate(sd.getDate() + daysOffset);
    const count = Math.floor(Math.random() * 14) + 1;
    const ed = new Date(sd); ed.setDate(sd.getDate() + count);
    const statuses = ['Pendiente', 'Aprobado', 'Aprobado'];
    insertLic.run(
      empId,
      licTypes[Math.floor(Math.random() * licTypes.length)],
      sd.toISOString().split('T')[0],
      ed.toISOString().split('T')[0],
      count,
      'Descanso médico indicado por médico tratante',
      statuses[Math.floor(Math.random() * statuses.length)]
    );
  }

  console.log('✅ Base de datos inicializada con datos de prueba.');
}

module.exports = { getDb, initializeDatabase };
