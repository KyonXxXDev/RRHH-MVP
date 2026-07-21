/* =============================================
   HRMS App Router & State Manager
   ============================================= */

const App = {
  currentRoute: 'dashboard',
  user: null,

  routes: {
    dashboard: { title: 'Dashboard', breadcrumb: 'Inicio', module: 'DashboardModule' },
    employees: { title: 'Colaboradores', breadcrumb: 'Gestión', module: 'EmployeesModule' },
    attendance: { title: 'Control de Asistencia', breadcrumb: 'Asistencia', module: 'AttendanceModule' },
    tardiness: { title: 'Tardanzas y Faltas', breadcrumb: 'Incidencias', module: 'TardinessModule' },
    permissions: { title: 'Gestión de Permisos', breadcrumb: 'Solicitudes', module: 'PermissionsModule' },
    vacations: { title: 'Vacaciones', breadcrumb: 'Solicitudes', module: 'VacationsModule' },
    licenses: { title: 'Licencias y Descansos', breadcrumb: 'Solicitudes', module: 'LicensesModule' },
    legajo: { title: 'Legajo Digital', breadcrumb: 'Colaboradores', module: 'LegajoModule' },
    reports: { title: 'Reportes y Estadísticas', breadcrumb: 'Reportes', module: 'ReportsModule' },
  },

  async init() {
    // Auth check
    const token = localStorage.getItem('hrms_token');
    if (!token) { window.location.href = '/index.html'; return; }

    try {
      this.user = await api.auth.me();
      localStorage.setItem('hrms_user', JSON.stringify(this.user));
      this.setupUI();
      this.setupEventListeners();
      this.navigate('dashboard');
      this.loadPendingBadges();
    } catch (err) {
      localStorage.removeItem('hrms_token');
      localStorage.removeItem('hrms_user');
      window.location.href = '/index.html';
    }
  },

  setupUI() {
    const u = this.user;
    const initials = utils.initials(u.name || u.first_name + ' ' + u.last_name);

    // Sidebar user info
    document.getElementById('sidebarAvatar').textContent = initials;
    document.getElementById('sidebarUserName').textContent = u.name;
    document.getElementById('sidebarUserRole').textContent = u.role;

    // Topbar user info
    document.getElementById('topbarAvatar').textContent = initials;
    document.getElementById('topbarUserName').textContent = u.name;

    // Hide nav items based on role
    if (u.role === 'Colaborador') {
      ['nav-employees', 'nav-legajo'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });
    }
  },

  setupEventListeners() {
    // Nav items
    document.querySelectorAll('.nav-item[data-route]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.navigate(btn.dataset.route);
      });
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
      localStorage.removeItem('hrms_token');
      localStorage.removeItem('hrms_user');
      window.location.href = '/index.html';
    });

    // Sidebar toggle
    const sidebarToggle = document.getElementById('sidebarToggle');
    sidebarToggle.addEventListener('click', () => {
      const sidebar = document.getElementById('sidebar');
      const main = document.getElementById('mainContent');
      sidebar.classList.toggle('collapsed');
      main.classList.toggle('collapsed-layout');
      sidebarToggle.textContent = sidebar.classList.contains('collapsed') ? '›' : '‹';
    });

    // Mobile menu
    document.getElementById('mobileMenuBtn').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('mobile-open');
      document.getElementById('sidebarOverlay').classList.toggle('active');
    });

    document.getElementById('sidebarOverlay').addEventListener('click', () => {
      document.getElementById('sidebar').classList.remove('mobile-open');
      document.getElementById('sidebarOverlay').classList.remove('active');
    });

    // Close modals on overlay click
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        utils.closeAllModals();
      }
    });

    // Keyboard ESC to close modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') utils.closeAllModals();
    });
  },

  navigate(route) {
    if (!this.routes[route]) { console.warn('Unknown route:', route); return; }

    this.currentRoute = route;
    const routeConfig = this.routes[route];

    // Update topbar
    document.getElementById('topbarTitle').textContent = routeConfig.title;
    document.getElementById('topbarBreadcrumb').textContent = routeConfig.breadcrumb;

    // Update active nav
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    const activeNav = document.getElementById(`nav-${route}`);
    if (activeNav) activeNav.classList.add('active');

    // Close mobile menu
    document.getElementById('sidebar').classList.remove('mobile-open');
    document.getElementById('sidebarOverlay').classList.remove('active');

    // Render module
    const main = document.getElementById('mainContent');
    main.innerHTML = utils.loadingState();

    const moduleWindow = window[routeConfig.module] || globalThis[routeConfig.module] || eval(routeConfig.module);
    if (moduleWindow && typeof moduleWindow.render === 'function') {
      setTimeout(() => {
        try {
          moduleWindow.render(main);
        } catch (err) {
          console.error('Module render error:', err);
          main.innerHTML = `<div class="card card-body" style="text-align:center;padding:60px">
            <div style="font-size:48px;margin-bottom:16px">⚠️</div>
            <h3 style="color:var(--danger)">Error al cargar el módulo</h3>
            <p style="color:var(--gray-500);margin-top:8px">${err.message}</p>
          </div>`;
        }
      }, 50);
    } else {
      main.innerHTML = `<div class="empty-state">
        <div class="empty-state-icon">🚧</div>
        <h3>Módulo no disponible</h3>
        <p>Este módulo está en construcción.</p>
      </div>`;
    }
  },

  async loadPendingBadges() {
    try {
      const data = await api.permissions.list({ status: 'Pendiente', limit: 200 });
      const badge = document.getElementById('permBadge');
      if (badge && data.total > 0) {
        badge.textContent = data.total;
        badge.style.display = 'flex';
      }
    } catch { /* ignore */ }
  }
};

// Bootstrap
document.addEventListener('DOMContentLoaded', () => App.init());
