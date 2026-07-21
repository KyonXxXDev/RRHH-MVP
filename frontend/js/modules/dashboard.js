/* =============================================
   Dashboard Module — KPIs, Charts, Activity
   ============================================= */

const DashboardModule = {
  charts: {},

  async render(container) {
    container.innerHTML = `
      <div class="page-enter">
        <div class="page-header">
          <div>
            <h1 class="page-title">
              <div class="page-title-icon" style="background:var(--primary)">📊</div>
              Dashboard Ejecutivo
            </h1>
            <p class="page-subtitle">Indicadores clave de Recursos Humanos</p>
          </div>
          <div class="flex gap-2">
            <select class="filter-select" id="dashAreaFilter">
              <option value="">Todas las áreas</option>
            </select>
            <button class="btn btn-primary" onclick="DashboardModule.refresh()">🔄 Actualizar</button>
          </div>
        </div>

        <!-- KPI Cards -->
        <div class="kpi-grid stagger-children" id="kpiGrid">
          ${this._skeletonKPIs()}
        </div>

        <!-- Charts Row 1 -->
        <div class="charts-grid" id="chartsGrid">
          <div class="chart-card">
            <div class="chart-header">
              <div>
                <div class="chart-title">📅 Asistencia Semanal</div>
                <div class="chart-sub">Últimos 7 días hábiles</div>
              </div>
            </div>
            <canvas id="weeklyChart" height="180"></canvas>
          </div>
          <div class="chart-card">
            <div class="chart-header">
              <div>
                <div class="chart-title">🏢 Distribución por Área</div>
                <div class="chart-sub">Colaboradores activos</div>
              </div>
            </div>
            <canvas id="areaChart" height="180"></canvas>
          </div>
        </div>

        <!-- Charts Row 2 -->
        <div class="charts-grid" id="chartsGrid2">
          <div class="chart-card">
            <div class="chart-header">
              <div>
                <div class="chart-title">📈 Tendencia de Tardanzas</div>
                <div class="chart-sub">Últimos 6 meses</div>
              </div>
            </div>
            <canvas id="tardinessChart" height="180"></canvas>
          </div>
          <div class="chart-card">
            <div class="chart-header">
              <div>
                <div class="chart-title">📋 Permisos Recientes</div>
                <div class="chart-sub">Últimas solicitudes</div>
              </div>
            </div>
            <div id="recentPermsList"></div>
          </div>
        </div>
      </div>
    `;

    // Load areas for filter
    try {
      const areas = await api.areas.list();
      const sel = document.getElementById('dashAreaFilter');
      areas.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a.id; opt.textContent = a.name;
        sel.appendChild(opt);
      });
      sel.onchange = () => this.loadData(sel.value);
    } catch {}

    await this.loadData();
  },

  _skeletonKPIs() {
    return Array(7).fill('<div class="kpi-card"><div class="kpi-icon skeleton" style="width:48px;height:48px"></div><div class="kpi-info"><div class="skeleton skeleton-text sm"></div><div class="skeleton" style="height:32px;width:60%;margin:6px 0"></div><div class="skeleton skeleton-text sm"></div></div></div>').join('');
  },

  async loadData(area_id = '') {
    try {
      const params = area_id ? { area_id } : {};
      const data = await api.reports.dashboard();
      const stats = await api.attendance.stats(params);

      this.renderKPIs(data.kpis, stats);
      this.renderWeeklyChart(data.weekly_attendance);
      this.renderAreaChart(data.area_distribution);
      this.renderTardinessChart(data.tardiness_trend);
      this.renderRecentPerms(data.recent_permissions);
    } catch (err) {
      utils.toast('Error al cargar datos del dashboard: ' + err.message, 'error');
    }
  },

  renderKPIs(kpis, stats) {
    const grid = document.getElementById('kpiGrid');
    const cards = [
      { color: 'blue', icon: '👥', label: 'Total Colaboradores', value: kpis.total_employees, sub: `${kpis.total_inactive} inactivos` },
      { color: 'green', icon: '✅', label: 'Asistencia Hoy', value: kpis.today_present, sub: 'colaboradores presentes' },
      { color: 'orange', icon: '⏰', label: 'Tardanzas Hoy', value: kpis.today_tardiness, sub: 'llegadas tarde' },
      { color: 'red', icon: '❌', label: 'Faltas Hoy', value: kpis.today_absent, sub: 'ausencias registradas' },
      { color: 'purple', icon: '📋', label: 'Permisos Pendientes', value: kpis.pending_permissions, sub: 'requieren aprobación' },
      { color: 'teal', icon: '🌴', label: 'Vacaciones Activas', value: kpis.active_vacations, sub: 'en curso hoy' },
      { color: 'cyan', icon: '⚡', label: 'Horas Extra Hoy', value: `${kpis.today_overtime_hours}h`, sub: 'horas adicionales' },
    ];

    grid.innerHTML = cards.map(c => `
      <div class="kpi-card ${c.color}">
        <div class="kpi-icon ${c.color}">${c.icon}</div>
        <div class="kpi-info">
          <div class="kpi-label">${c.label}</div>
          <div class="kpi-value">${c.value}</div>
          <div class="kpi-sub">${c.sub}</div>
        </div>
      </div>
    `).join('');
  },

  renderWeeklyChart(weeklyData) {
    const ctx = document.getElementById('weeklyChart');
    if (!ctx) return;
    if (this.charts.weekly) this.charts.weekly.destroy();

    const labels = weeklyData.map(d => utils.formatDate(d.date, { weekday: 'short', day: 'numeric' }));
    this.charts.weekly = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Presente', data: weeklyData.map(d => d.present), backgroundColor: 'rgba(45,198,83,0.8)', borderRadius: 6 },
          { label: 'Tardanza', data: weeklyData.map(d => d.tardiness), backgroundColor: 'rgba(245,158,11,0.8)', borderRadius: 6 },
          { label: 'Ausente', data: weeklyData.map(d => d.absent), backgroundColor: 'rgba(230,57,70,0.8)', borderRadius: 6 },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 16, font: { family: 'Inter', size: 12 } } } },
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { font: { family: 'Inter', size: 11 } } },
          y: { stacked: true, beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { family: 'Inter', size: 11 } } }
        }
      }
    });
  },

  renderAreaChart(areaData) {
    const ctx = document.getElementById('areaChart');
    if (!ctx) return;
    if (this.charts.area) this.charts.area.destroy();

    const colors = ['#0A2D63','#1E4FAD','#1E90FF','#3BA3FF','#14B8A6','#6366F1','#F59E0B','#E63946'];
    this.charts.area = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: areaData.map(a => a.name),
        datasets: [{
          data: areaData.map(a => a.count),
          backgroundColor: colors.slice(0, areaData.length),
          borderWidth: 2, borderColor: '#fff'
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, padding: 12, font: { family: 'Inter', size: 11 } } },
        }
      }
    });
  },

  renderTardinessChart(trendData) {
    const ctx = document.getElementById('tardinessChart');
    if (!ctx) return;
    if (this.charts.tardiness) this.charts.tardiness.destroy();

    this.charts.tardiness = new Chart(ctx, {
      type: 'line',
      data: {
        labels: trendData.map(d => d.month),
        datasets: [{
          label: 'Tardanzas',
          data: trendData.map(d => d.count),
          borderColor: '#F59E0B',
          backgroundColor: 'rgba(245,158,11,0.10)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#F59E0B',
          pointRadius: 5,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 11 } } },
          y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { family: 'Inter', size: 11 } } }
        }
      }
    });
  },

  renderRecentPerms(perms) {
    const container = document.getElementById('recentPermsList');
    if (!container) return;

    if (!perms || !perms.length) {
      container.innerHTML = utils.emptyState('📋', 'Sin permisos recientes');
      return;
    }

    container.innerHTML = perms.map(p => `
      <div class="flex items-center gap-3" style="padding:10px 0;border-bottom:1px solid var(--gray-100)">
        <div class="avatar" style="width:32px;height:32px;font-size:11px">${utils.initials(p.employee_name)}</div>
        <div style="flex:1;min-width:0">
          <div class="cell-name truncate">${p.employee_name}</div>
          <div class="cell-sub">${p.type} · ${utils.formatDate(p.start_date)}</div>
        </div>
        ${utils.statusBadge(p.status)}
      </div>
    `).join('');
  },

  refresh() { this.loadData(); utils.toast('Dashboard actualizado', 'info'); }
};
