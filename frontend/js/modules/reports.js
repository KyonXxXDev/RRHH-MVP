/* =============================================
   Reports Module — Reportes y Estadísticas
   ============================================= */

const ReportsModule = {
  currentReport: 'attendance', // 'attendance', 'tardiness', 'overtime', 'absenteeism'
  data: [],
  chart: null,

  async render(container) {
    const today = utils.today();
    const firstDay = today.substring(0, 8) + '01';

    container.innerHTML = `
      <div class="page-enter">
        <div class="page-header print-hidden">
          <div>
            <h1 class="page-title">
              <div class="page-title-icon" style="background:var(--info)">📈</div>
              Reportes y Estadísticas
            </h1>
            <p class="page-subtitle">Consolidado y analítica del personal para toma de decisiones</p>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-secondary" onclick="ReportsModule.exportReport()">📥 Exportar CSV</button>
            <button class="btn btn-outline" onclick="window.print()">🖨️ Imprimir</button>
          </div>
        </div>

        <!-- Report Selector Tabs -->
        <div class="card print-hidden" style="margin-bottom:24px">
          <div class="card-header" style="padding: 0; justify-content: flex-start; gap: 0; border-bottom: none">
            <button class="report-tab-btn active" data-report="attendance" onclick="ReportsModule.switchReport('attendance')">
              📅 Asistencia Mensual
            </button>
            <button class="report-tab-btn" data-report="tardiness" onclick="ReportsModule.switchReport('tardiness')">
              ⏰ Tardanzas Acumuladas
            </button>
            <button class="report-tab-btn" data-report="overtime" onclick="ReportsModule.switchReport('overtime')">
              ⏱️ Horas Extras
            </button>
            <button class="report-tab-btn" data-report="absenteeism" onclick="ReportsModule.switchReport('absenteeism')">
              ❌ Ausentismo por Área
            </button>
          </div>
        </div>

        <!-- Filter Bar -->
        <div class="filter-bar print-hidden" id="reportFilters" style="margin-bottom:24px">
          <!-- Populated dynamically based on active tab -->
        </div>

        <!-- Report Content -->
        <div class="grid" id="reportGrid" style="grid-template-columns: 1fr; gap: 24px; align-items: start;">
          <!-- Content populated dynamically -->
        </div>
      </div>
    `;

    // Inject inline styles for report module if not present
    if (!document.getElementById('reports-custom-styles')) {
      const styles = document.createElement('style');
      styles.id = 'reports-custom-styles';
      styles.textContent = `
        .report-tab-btn {
          padding: 16px 24px;
          font-size: 14px;
          font-weight: 600;
          color: var(--gray-500);
          border: none;
          background: transparent;
          border-bottom: 2px solid transparent;
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .report-tab-btn:hover {
          color: var(--primary-light);
          background: var(--gray-50);
        }
        .report-tab-btn.active {
          color: var(--primary);
          border-bottom-color: var(--primary);
          background: var(--white);
        }
        
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          .print-hidden, .sidebar, .topbar, #toastContainer, .sidebar-overlay {
            display: none !important;
          }
          .main-content {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            left: 0 !important;
          }
          .card {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
          }
          .table-wrap {
            box-shadow: none !important;
            border: none !important;
          }
          th, td {
            padding: 8px 12px !important;
            border-bottom: 1px solid #ddd !important;
          }
          .charts-panel {
            display: none !important;
          }
        }
      `;
      document.head.appendChild(styles);
    }

    this.renderFilters();
    await this.loadReportData();
  },

  switchReport(reportType) {
    this.currentReport = reportType;
    
    // Update active tab header
    document.querySelectorAll('.report-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.report === reportType);
    });

    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }

    this.renderFilters();
    this.loadReportData();
  },

  async renderFilters() {
    const bar = document.getElementById('reportFilters');
    if (!bar) return;

    const today = utils.today();
    const firstDay = today.substring(0, 8) + '01';

    let areas = [];
    try {
      areas = await api.areas.list();
    } catch (err) {
      console.warn('Error loading areas for report filters:', err);
    }

    const areaOptions = `<option value="">Todas las áreas</option>` + 
      areas.map(a => `<option value="${a.id}">${a.name}</option>`).join('');

    if (this.currentReport === 'attendance') {
      const year = new Date().getFullYear();
      const month = new Date().getMonth() + 1;
      
      bar.innerHTML = `
        <div style="flex:1" class="flex gap-3">
          <select class="filter-select" id="repYear">
            <option value="${year}">${year}</option>
            <option value="${year - 1}">${year - 1}</option>
          </select>
          <select class="filter-select" id="repMonth">
            ${Array.from({length: 12}, (_, i) => i + 1).map(m => `
              <option value="${m}" ${m === month ? 'selected' : ''}>${utils.formatDate(`2024-${String(m).padStart(2,'0')}-01`, {month: 'long'})}</option>
            `).join('')}
          </select>
          <select class="filter-select" id="repArea">${areaOptions}</select>
        </div>
        <button class="btn btn-secondary" onclick="ReportsModule.loadReportData()">🔍 Consultar</button>
      `;
    } else if (this.currentReport === 'tardiness' || this.currentReport === 'overtime') {
      bar.innerHTML = `
        <div style="flex:1" class="flex gap-3 items-center flex-wrap">
          <select class="filter-select" id="repArea">${areaOptions}</select>
          <span class="text-sm font-semibold text-muted">Desde:</span>
          <input type="date" class="filter-select" id="repFrom" value="${firstDay}"/>
          <span class="text-sm font-semibold text-muted">Hasta:</span>
          <input type="date" class="filter-select" id="repTo" value="${today}"/>
        </div>
        <button class="btn btn-secondary" onclick="ReportsModule.loadReportData()">🔍 Consultar</button>
      `;
    } else if (this.currentReport === 'absenteeism') {
      bar.innerHTML = `
        <div style="flex:1" class="flex gap-3 items-center">
          <span class="text-sm font-semibold text-muted">Rango:</span>
          <input type="date" class="filter-select" id="repFrom" value="${firstDay}"/>
          <span class="text-sm font-semibold text-muted">hasta:</span>
          <input type="date" class="filter-select" id="repTo" value="${today}"/>
        </div>
        <button class="btn btn-secondary" onclick="ReportsModule.loadReportData()">🔍 Consultar</button>
      `;
    }
  },

  getFilterParams() {
    const params = {};
    if (this.currentReport === 'attendance') {
      const yr = document.getElementById('repYear');
      const mo = document.getElementById('repMonth');
      const ar = document.getElementById('repArea');
      if (yr) params.year = yr.value;
      if (mo) params.month = mo.value;
      if (ar && ar.value) params.area_id = ar.value;
    } else {
      const from = document.getElementById('repFrom');
      const to = document.getElementById('repTo');
      const ar = document.getElementById('repArea');
      if (from) params.date_from = from.value;
      if (to) params.date_to = to.value;
      if (ar && ar.value) params.area_id = ar.value;
    }
    return params;
  },

  async loadReportData() {
    const grid = document.getElementById('reportGrid');
    if (!grid) return;
    grid.innerHTML = `<div style="text-align:center;padding:60px"><div class="spinner"></div><p style="margin-top:12px;color:var(--gray-500)">Cargando reporte...</p></div>`;

    const params = this.getFilterParams();

    try {
      let res;
      if (this.currentReport === 'attendance') {
        res = await api.reports.attendance(params);
        this.data = res.data;
      } else if (this.currentReport === 'tardiness') {
        res = await api.reports.tardiness(params);
        this.data = res.data;
      } else if (this.currentReport === 'overtime') {
        res = await api.reports.overtime(params);
        this.data = res.data;
      } else if (this.currentReport === 'absenteeism') {
        res = await api.reports.absenteeism(params);
        this.data = res.data;
      }

      this.renderReportContent();
    } catch (err) {
      grid.innerHTML = utils.emptyState('⚠️', 'Error al consultar reporte', err.message);
    }
  },

  renderReportContent() {
    const grid = document.getElementById('reportGrid');
    if (!grid) return;

    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }

    if (!this.data || !this.data.length) {
      grid.innerHTML = utils.emptyState('📊', 'Reporte sin datos', 'No se encontraron registros para los filtros seleccionados.');
      return;
    }

    // Grid layout for table + chart
    if (this.currentReport === 'attendance') {
      // Monthly attendance is large, so render full width table
      grid.style.gridTemplateColumns = '1fr';
      grid.innerHTML = `
        <div class="card">
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Colaborador</th>
                  <th>Área</th>
                  <th>Días Trab.</th>
                  <th style="color:var(--success)">Presentes</th>
                  <th style="color:var(--warning)">Tardanzas</th>
                  <th style="color:var(--danger)">Faltas</th>
                  <th>Permisos</th>
                  <th>Min. Tardanza</th>
                  <th>Horas Extra</th>
                </tr>
              </thead>
              <tbody>
                ${this.data.map(r => `
                  <tr>
                    <td>
                      <div class="font-semibold text-primary">${r.name}</div>
                      <div class="cell-sub">${r.code}</div>
                    </td>
                    <td>${r.area_name || '—'}</td>
                    <td><strong>${r.total_days}</strong></td>
                    <td class="text-success font-semibold">${r.present}</td>
                    <td class="text-warning font-semibold">${r.tardiness}</td>
                    <td class="text-danger font-semibold">${r.absent}</td>
                    <td>${r.permission}</td>
                    <td>${r.total_tardiness_minutes > 0 ? `<span style="color:var(--warning)">${utils.formatMinutes(r.total_tardiness_minutes)}</span>` : '0 min'}</td>
                    <td>${r.total_overtime_minutes > 0 ? `<span style="color:var(--success)">${(r.total_overtime_minutes / 60).toFixed(1)}h</span>` : '—'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } else {
      // Other reports render as 2-column layout (Table + Chart)
      grid.style.gridTemplateColumns = '1.2fr 0.8fr';
      if (window.innerWidth <= 1024) {
        grid.style.gridTemplateColumns = '1fr';
      }

      let tableHtml = '';
      let chartTitle = '';

      if (this.currentReport === 'tardiness') {
        chartTitle = 'Ranking de Impuntualidad (Tardanzas acumuladas)';
        tableHtml = `
          <table>
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Área</th>
                <th>Cant. Tardanzas</th>
                <th>Minutos Totales</th>
                <th>Promedio Minutos</th>
                <th>Tardanza Máxima</th>
              </tr>
            </thead>
            <tbody>
              ${this.data.map(r => `
                <tr>
                  <td>
                    <div class="font-semibold text-primary">${r.name}</div>
                    <div class="cell-sub">${r.code}</div>
                  </td>
                  <td>${r.area_name || '—'}</td>
                  <td><strong class="text-warning">${r.tardiness_count}</strong></td>
                  <td>${utils.formatMinutes(r.total_minutes)}</td>
                  <td>${Math.round(r.avg_minutes)} min</td>
                  <td style="color:var(--danger)">${r.max_minutes} min</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      } else if (this.currentReport === 'overtime') {
        chartTitle = 'Ranking de Horas Extras acumuladas';
        tableHtml = `
          <table>
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Área</th>
                <th>Días con Horas Extra</th>
                <th>Minutos Extras</th>
                <th>Horas Extras</th>
              </tr>
            </thead>
            <tbody>
              ${this.data.map(r => `
                <tr>
                  <td>
                    <div class="font-semibold text-primary">${r.name}</div>
                    <div class="cell-sub">${r.code}</div>
                  </td>
                  <td>${r.area_name || '—'}</td>
                  <td><strong>${r.overtime_days}</strong></td>
                  <td>${utils.formatMinutes(r.total_minutes)}</td>
                  <td class="text-success font-bold">${r.total_hours}h</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      } else if (this.currentReport === 'absenteeism') {
        chartTitle = 'Tasa de Ausentismo por Área (%)';
        tableHtml = `
          <table>
            <thead>
              <tr>
                <th>Área</th>
                <th>Total Empleados</th>
                <th>Total Ausencias</th>
                <th>Tasa de Ausentismo</th>
              </tr>
            </thead>
            <tbody>
              ${this.data.map(r => `
                <tr>
                  <td><strong>${r.area_name}</strong></td>
                  <td>${r.total_employees}</td>
                  <td>${r.total_absences}</td>
                  <td class="font-bold" style="color: ${r.absenteeism_rate > 5 ? 'var(--danger)' : 'var(--success)'}">
                    ${r.absenteeism_rate}%
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }

      grid.innerHTML = `
        <div class="card">
          <div class="table-wrap">
            ${tableHtml}
          </div>
        </div>
        <div class="card charts-panel" style="padding:20px">
          <div class="chart-header" style="margin-bottom:16px">
            <div class="chart-title">${chartTitle}</div>
          </div>
          <div style="position:relative;height:280px">
            <canvas id="reportChartCanvas"></canvas>
          </div>
        </div>
      `;

      // Trigger chart generation after rendering canvas
      setTimeout(() => this.renderChart(), 50);
    }
  },

  renderChart() {
    const canvas = document.getElementById('reportChartCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    if (this.currentReport === 'tardiness') {
      // Top 5 employees with tardiness
      const sorted = [...this.data].sort((a,b) => b.total_minutes - a.total_minutes).slice(0, 5);
      
      this.chart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: sorted.map(r => r.name.split(' ')[0] + ' ' + (r.name.split(' ')[1] || '')),
          datasets: [{
            label: 'Minutos Totales',
            data: sorted.map(r => r.total_minutes),
            backgroundColor: 'rgba(245, 158, 11, 0.85)',
            borderColor: '#F59E0B',
            borderWidth: 1.5,
            borderRadius: 6
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          indexAxis: 'y',
          plugins: { legend: { display: false } },
          scales: {
            x: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
            y: { grid: { display: false } }
          }
        }
      });
    } else if (this.currentReport === 'overtime') {
      // Top 5 employees with overtime
      const sorted = [...this.data].sort((a,b) => b.total_hours - a.total_hours).slice(0, 5);
      
      this.chart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: sorted.map(r => r.name.split(' ')[0] + ' ' + (r.name.split(' ')[1] || '')),
          datasets: [{
            label: 'Horas Extras',
            data: sorted.map(r => r.total_hours),
            backgroundColor: 'rgba(45, 198, 83, 0.85)',
            borderColor: '#2DC653',
            borderWidth: 1.5,
            borderRadius: 6
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false } },
            y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } }
          }
        }
      });
    } else if (this.currentReport === 'absenteeism') {
      this.chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: this.data.map(r => r.area_name),
          datasets: [{
            data: this.data.map(r => r.absenteeism_rate),
            backgroundColor: ['#E63946', '#F59E0B', '#1E90FF', '#14B8A6', '#6366F1', '#8B5CF6', '#EC4899'].slice(0, this.data.length),
            borderWidth: 2,
            borderColor: '#fff'
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          cutout: '60%',
          plugins: {
            legend: { position: 'bottom', labels: { usePointStyle: true, font: { size: 11 } } }
          }
        }
      });
    }
  },

  exportReport() {
    if (!this.data || !this.data.length) {
      utils.toast('No hay datos disponibles para exportar', 'warning');
      return;
    }

    if (this.currentReport === 'attendance') {
      utils.exportCSV(this.data, 'reporte_asistencia_mensual', [
        { label: 'Código', key: 'code' },
        { label: 'Colaborador', key: 'name' },
        { label: 'Área', key: 'area_name' },
        { label: 'Días con Registro', key: 'total_days' },
        { label: 'Días Presente', key: 'present' },
        { label: 'Días Tardanza', key: 'tardiness' },
        { label: 'Días Ausente', key: 'absent' },
        { label: 'Días Permiso', key: 'permission' },
        { label: 'Minutos de Tardanza', key: 'total_tardiness_minutes' },
        { label: 'Minutos Horas Extra', key: 'total_overtime_minutes' }
      ]);
    } else if (this.currentReport === 'tardiness') {
      utils.exportCSV(this.data, 'reporte_tardanzas_acumuladas', [
        { label: 'Código', key: 'code' },
        { label: 'Colaborador', key: 'name' },
        { label: 'Área', key: 'area_name' },
        { label: 'Cantidad de Tardanzas', key: 'tardiness_count' },
        { label: 'Minutos Totales', key: 'total_minutes' },
        { label: 'Minutos Promedio', key: 'avg_minutes' },
        { label: 'Tardanza Máxima (min)', key: 'max_minutes' }
      ]);
    } else if (this.currentReport === 'overtime') {
      utils.exportCSV(this.data, 'reporte_horas_extras', [
        { label: 'Código', key: 'code' },
        { label: 'Colaborador', key: 'name' },
        { label: 'Área', key: 'area_name' },
        { label: 'Días con Horas Extra', key: 'overtime_days' },
        { label: 'Minutos Extra', key: 'total_minutes' },
        { label: 'Horas Extra', key: 'total_hours' }
      ]);
    } else if (this.currentReport === 'absenteeism') {
      utils.exportCSV(this.data, 'reporte_tasa_ausentismo', [
        { label: 'Área', key: 'area_name' },
        { label: 'Total Colaboradores', key: 'total_employees' },
        { label: 'Ausencias Totales', key: 'total_absences' },
        { label: 'Tasa Ausentismo (%)', key: 'absenteeism_rate' }
      ]);
    }
  }
};
