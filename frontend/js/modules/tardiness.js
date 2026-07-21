/* =============================================
   Tardiness Module — Tardanzas y Faltas
   ============================================= */

const TardinessModule = {
  records: [],
  filters: { date_from: '', date_to: '' },

  async render(container) {
    const today = utils.today();
    const firstDay = today.substring(0, 8) + '01';

    container.innerHTML = `
      <div class="page-enter">
        <div class="page-header">
          <div>
            <h1 class="page-title">
              <div class="page-title-icon" style="background:#F59E0B">⚠️</div>
              Tardanzas y Faltas
            </h1>
            <p class="page-subtitle">Registro consolidado de incidencias del período</p>
          </div>
          <button class="btn btn-secondary" onclick="TardinessModule.exportData()">📥 Exportar CSV</button>
        </div>

        <!-- Summary Cards -->
        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:24px">
          <div class="kpi-card orange">
            <div class="kpi-icon orange">⏰</div>
            <div class="kpi-info">
              <div class="kpi-label">Total Tardanzas</div>
              <div class="kpi-value" id="tardCount">—</div>
              <div class="kpi-sub">en el período</div>
            </div>
          </div>
          <div class="kpi-card red">
            <div class="kpi-icon red">❌</div>
            <div class="kpi-info">
              <div class="kpi-label">Total Faltas</div>
              <div class="kpi-value" id="absCount">—</div>
              <div class="kpi-sub">en el período</div>
            </div>
          </div>
          <div class="kpi-card orange">
            <div class="kpi-icon orange">⏱️</div>
            <div class="kpi-info">
              <div class="kpi-label">Minutos Acumulados</div>
              <div class="kpi-value" id="tardMins">—</div>
              <div class="kpi-sub">de tardanza total</div>
            </div>
          </div>
        </div>

        <!-- Filters -->
        <div class="filter-bar">
          <select class="filter-select" id="tardEmpFilter" style="flex:1;min-width:200px">
            <option value="">Todos los colaboradores</option>
          </select>
          <select class="filter-select" id="tardAreaFilter"><option value="">Todas las áreas</option></select>
          <select class="filter-select" id="tardTypeFilter">
            <option value="">Tardanzas y Faltas</option>
            <option value="Tardanza">Solo Tardanzas</option>
            <option value="Ausente">Solo Faltas</option>
          </select>
          <input type="date" class="filter-select" id="tardFrom" value="${firstDay}" style="padding:9px 12px"/>
          <input type="date" class="filter-select" id="tardTo" value="${today}" style="padding:9px 12px"/>
          <button class="btn btn-secondary" onclick="TardinessModule.applyFilters()">🔍 Filtrar</button>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Área</th>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Hora Entrada</th>
                <th>Tardanza</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody id="tardTbody"><tr><td colspan="7">${utils.loadingState()}</td></tr></tbody>
          </table>
        </div>
      </div>
    `;

    // Load employees and areas
    try {
      const [employees, areas] = await Promise.all([api.employees.simpleList(), api.areas.list()]);
      const empSel = document.getElementById('tardEmpFilter');
      const areaSel = document.getElementById('tardAreaFilter');

      employees.filter(e => e.status === 'Activo').forEach(e => {
        empSel.innerHTML += `<option value="${e.id}">${e.name}</option>`;
      });
      areas.forEach(a => { areaSel.innerHTML += `<option value="${a.id}">${a.name}</option>`; });
    } catch {}

    this.filters.date_from = firstDay;
    this.filters.date_to = today;
    await this.loadData();
  },

  applyFilters() {
    this.filters.employee_id = document.getElementById('tardEmpFilter').value;
    this.filters.area_id = document.getElementById('tardAreaFilter').value;
    this.filters.status = document.getElementById('tardTypeFilter').value;
    this.filters.date_from = document.getElementById('tardFrom').value;
    this.filters.date_to = document.getElementById('tardTo').value;
    this.loadData();
  },

  async loadData() {
    const tbody = document.getElementById('tardTbody');
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px"><div class="spinner"></div></td></tr>`;

    try {
      const params = { limit: 500, ...this.filters };
      if (!params.status) {
        // Get both tardiness and absences
        delete params.status;
        params.status = 'Tardanza';
        const tard = await api.attendance.list(params);
        params.status = 'Ausente';
        const abs = await api.attendance.list(params);
        this.records = [...tard.data, ...abs.data].sort((a, b) => b.date.localeCompare(a.date));
      } else {
        Object.keys(params).forEach(k => !params[k] && delete params[k]);
        const { data } = await api.attendance.list(params);
        this.records = data;
      }
      this.renderTable(this.records);
      this.updateSummary(this.records);
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7">${utils.emptyState('⚠️', 'Error', err.message)}</td></tr>`;
    }
  },

  updateSummary(records) {
    const tard = records.filter(r => r.status === 'Tardanza');
    const abs = records.filter(r => r.status === 'Ausente');
    const totalMins = tard.reduce((sum, r) => sum + (r.tardiness_minutes || 0), 0);

    document.getElementById('tardCount').textContent = tard.length;
    document.getElementById('absCount').textContent = abs.length;
    document.getElementById('tardMins').textContent = utils.formatMinutes(totalMins);
  },

  renderTable(data) {
    const tbody = document.getElementById('tardTbody');
    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="7">${utils.emptyState('✅', 'Sin incidencias', 'No hay tardanzas ni faltas en el período seleccionado.')}</td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(r => `
      <tr>
        <td>
          <div class="employee-cell">
            <div class="avatar">${utils.initials(r.first_name + ' ' + r.last_name)}</div>
            <div>
              <div class="cell-name">${r.first_name} ${r.last_name}</div>
              <div class="cell-sub">${r.employee_code}</div>
            </div>
          </div>
        </td>
        <td>${r.area_name || '—'}</td>
        <td>${utils.formatDate(r.date)}</td>
        <td>
          ${r.status === 'Tardanza'
            ? '<span class="badge badge-orange">⏰ Tardanza</span>'
            : '<span class="badge badge-red">❌ Falta</span>'}
        </td>
        <td>${r.check_in ? utils.formatTime(r.check_in) : '<span style="color:var(--gray-400)">No registró</span>'}</td>
        <td>
          ${r.tardiness_minutes > 0
            ? `<span style="color:var(--warning);font-weight:700">${utils.formatMinutes(r.tardiness_minutes)}</span>`
            : '—'}
        </td>
        <td>${utils.badge(r.status)}</td>
      </tr>
    `).join('');
  },

  exportData() {
    utils.exportCSV(this.records, 'tardanzas_faltas', [
      { label: 'Código', key: 'employee_code' },
      { label: 'Nombre', fn: r => `${r.first_name} ${r.last_name}` },
      { label: 'Área', key: 'area_name' },
      { label: 'Fecha', fn: r => utils.formatDate(r.date) },
      { label: 'Tipo', key: 'status' },
      { label: 'Hora Entrada', fn: r => r.check_in ? utils.formatTime(r.check_in) : '' },
      { label: 'Minutos Tardanza', key: 'tardiness_minutes' },
    ]);
  }
};
