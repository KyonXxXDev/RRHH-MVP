/* =============================================
   Attendance Module — Register & Track
   ============================================= */

const AttendanceModule = {
  records: [],
  employees: [],
  areas: [],
  filters: { date_from: '', date_to: '', employee_id: '', area_id: '', status: '' },

  async render(container) {
    const canEdit = utils.hasRole('Administrador', 'RRHH');
    const today = utils.today();
    container.innerHTML = `
      <div class="page-enter">
        <div class="page-header">
          <div>
            <h1 class="page-title">
              <div class="page-title-icon">🕐</div>
              Control de Asistencia
            </h1>
            <p class="page-subtitle">Registro de entradas, salidas y horas extras</p>
          </div>
          <div class="flex gap-2">
            ${canEdit ? `<button class="btn btn-primary" onclick="AttendanceModule.openNew()">➕ Registrar</button>` : ''}
            <button class="btn btn-secondary" onclick="AttendanceModule.exportData()">📥 Exportar CSV</button>
          </div>
        </div>

        <!-- Stats Row -->
        <div class="kpi-grid" id="attStats" style="grid-template-columns:repeat(4,1fr);margin-bottom:24px">
          <div class="kpi-card green"><div class="kpi-icon green">✅</div><div class="kpi-info"><div class="kpi-label">Presentes Hoy</div><div class="kpi-value" id="statPresent">—</div></div></div>
          <div class="kpi-card orange"><div class="kpi-icon orange">⏰</div><div class="kpi-info"><div class="kpi-label">Tardanzas Hoy</div><div class="kpi-value" id="statTardiness">—</div></div></div>
          <div class="kpi-card red"><div class="kpi-icon red">❌</div><div class="kpi-info"><div class="kpi-label">Faltas Hoy</div><div class="kpi-value" id="statAbsent">—</div></div></div>
          <div class="kpi-card cyan"><div class="kpi-icon cyan">⚡</div><div class="kpi-info"><div class="kpi-label">Horas Extra Hoy</div><div class="kpi-value" id="statOvertime">—</div></div></div>
        </div>

        <!-- Filters -->
        <div class="filter-bar">
          <div class="search-wrap">
            <span class="search-icon">👤</span>
            <select class="search-input" id="attEmpFilter" style="padding-left:38px">
              <option value="">Todos los colaboradores</option>
            </select>
          </div>
          <select class="filter-select" id="attAreaFilter"><option value="">Todas las áreas</option></select>
          <select class="filter-select" id="attStatusFilter">
            <option value="">Todos los estados</option>
            <option value="Presente">Presente</option>
            <option value="Tardanza">Tardanza</option>
            <option value="Ausente">Ausente</option>
            <option value="Permiso">Permiso</option>
            <option value="Vacaciones">Vacaciones</option>
          </select>
          <input type="date" class="filter-select" id="attFrom" value="${today}" style="padding:9px 12px"/>
          <input type="date" class="filter-select" id="attTo" value="${today}" style="padding:9px 12px"/>
          <button class="btn btn-secondary" onclick="AttendanceModule.applyFilters()">🔍 Filtrar</button>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Área</th>
                <th>Fecha</th>
                <th>Entrada</th>
                <th>Salida</th>
                <th>Tardanza</th>
                <th>Horas Extra</th>
                <th>Estado</th>
                ${canEdit ? '<th>Acciones</th>' : ''}
              </tr>
            </thead>
            <tbody id="attTbody"><tr><td colspan="9">${utils.loadingState()}</td></tr></tbody>
          </table>
        </div>
      </div>

      <!-- Register Modal -->
      <div class="modal-overlay" id="attModal">
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title" id="attModalTitle">Registrar Asistencia</h2>
            <button class="modal-close" onclick="utils.closeModal('attModal')">✕</button>
          </div>
          <div class="modal-body">
            <form id="attForm">
              <input type="hidden" id="attId"/>
              <div class="form-group">
                <label class="form-label">Colaborador <span class="required">*</span></label>
                <select class="form-control" id="attEmployee" required>
                  <option value="">Seleccionar colaborador...</option>
                </select>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Fecha <span class="required">*</span></label>
                  <input type="date" class="form-control" id="attDate" value="${today}" required/>
                </div>
                <div class="form-group">
                  <label class="form-label">Estado</label>
                  <select class="form-control" id="attStatus">
                    <option value="Presente">Presente</option>
                    <option value="Ausente">Ausente</option>
                    <option value="Permiso">Permiso</option>
                    <option value="Vacaciones">Vacaciones</option>
                    <option value="Licencia">Licencia</option>
                  </select>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Hora de Entrada</label>
                  <input type="time" class="form-control" id="attCheckIn" value="08:00"/>
                </div>
                <div class="form-group">
                  <label class="form-label">Hora de Salida</label>
                  <input type="time" class="form-control" id="attCheckOut" value="17:30"/>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Notas</label>
                <textarea class="form-control" id="attNotes" placeholder="Observaciones adicionales..."></textarea>
              </div>
              <div style="background:var(--accent-bg);border:1px solid rgba(30,144,255,0.2);border-radius:var(--radius-md);padding:12px;font-size:13px;color:var(--primary)">
                <strong>ℹ️ Nota:</strong> Las tardanzas se calculan automáticamente. Hora de inicio laboral: 08:00. Se permite 10 minutos de gracia.
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="utils.closeModal('attModal')">Cancelar</button>
            <button class="btn btn-primary" onclick="AttendanceModule.save()">💾 Guardar</button>
          </div>
        </div>
      </div>
    `;

    // Setup filters
    document.getElementById('attAreaFilter').addEventListener('change', (e) => {
      this.filters.area_id = e.target.value;
    });

    await this.loadReferenceData();
    await this.loadTodayStats();
    await this.loadData();
  },

  async loadReferenceData() {
    try {
      const [employees, areas] = await Promise.all([api.employees.simpleList(), api.areas.list()]);
      this.employees = employees;
      this.areas = areas;

      const empFilter = document.getElementById('attEmpFilter');
      const empModal = document.getElementById('attEmployee');
      const areaFilter = document.getElementById('attAreaFilter');

      employees.filter(e => e.status === 'Activo').forEach(e => {
        const opt = `<option value="${e.id}">${e.name} — ${e.area_name || ''}</option>`;
        if (empFilter) empFilter.innerHTML += opt;
        if (empModal) empModal.innerHTML += opt;
      });

      areas.forEach(a => {
        if (areaFilter) areaFilter.innerHTML += `<option value="${a.id}">${a.name}</option>`;
      });
    } catch (err) { console.warn(err); }
  },

  async loadTodayStats() {
    try {
      const stats = await api.attendance.stats({ date_from: utils.today(), date_to: utils.today() });
      document.getElementById('statPresent').textContent = stats.present || 0;
      document.getElementById('statTardiness').textContent = stats.tardiness || 0;
      document.getElementById('statAbsent').textContent = stats.absent || 0;
      const hours = Math.round((stats.total_overtime_minutes || 0) / 60 * 10) / 10;
      document.getElementById('statOvertime').textContent = `${hours}h`;
    } catch {}
  },

  applyFilters() {
    this.filters.employee_id = document.getElementById('attEmpFilter').value;
    this.filters.area_id = document.getElementById('attAreaFilter').value;
    this.filters.status = document.getElementById('attStatusFilter').value;
    this.filters.date_from = document.getElementById('attFrom').value;
    this.filters.date_to = document.getElementById('attTo').value;
    this.loadData();
  },

  async loadData() {
    const tbody = document.getElementById('attTbody');
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:40px"><div class="spinner"></div></td></tr>`;

    try {
      const params = { limit: 200, ...this.filters };
      Object.keys(params).forEach(k => !params[k] && delete params[k]);
      const { data } = await api.attendance.list(params);
      this.records = data;
      this.renderTable(data);
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="9">${utils.emptyState('⚠️', 'Error', err.message)}</td></tr>`;
    }
  },

  renderTable(data) {
    const tbody = document.getElementById('attTbody');
    const canEdit = utils.hasRole('Administrador', 'RRHH');

    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="9">${utils.emptyState('🕐', 'Sin registros', 'No hay registros de asistencia para el período seleccionado.')}</td></tr>`;
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
        <td>${r.check_in ? utils.formatTime(r.check_in) : '<span style="color:var(--gray-400)">—</span>'}</td>
        <td>${r.check_out ? utils.formatTime(r.check_out) : '<span style="color:var(--gray-400)">—</span>'}</td>
        <td>
          ${r.tardiness_minutes > 0
            ? `<span style="color:var(--warning);font-weight:600">${utils.formatMinutes(r.tardiness_minutes)}</span>`
            : '<span style="color:var(--success)">—</span>'}
        </td>
        <td>
          ${r.overtime_minutes > 0
            ? `<span style="color:var(--accent);font-weight:600">${utils.formatMinutes(r.overtime_minutes)}</span>`
            : '—'}
        </td>
        <td>${utils.badge(r.status)}</td>
        ${canEdit ? `
        <td>
          <button class="btn btn-sm btn-outline btn-icon" onclick="AttendanceModule.openEdit(${r.id})" title="Editar">✏️</button>
        </td>` : ''}
      </tr>
    `).join('');
  },

  openNew() {
    document.getElementById('attId').value = '';
    document.getElementById('attForm').reset();
    document.getElementById('attDate').value = utils.today();
    document.getElementById('attCheckIn').value = '08:00';
    document.getElementById('attCheckOut').value = '17:30';
    document.getElementById('attModalTitle').textContent = 'Registrar Asistencia';
    utils.openModal('attModal');
  },

  openEdit(id) {
    const record = this.records.find(r => r.id === id);
    if (!record) return;
    document.getElementById('attId').value = record.id;
    document.getElementById('attEmployee').value = record.employee_id;
    document.getElementById('attDate').value = record.date;
    document.getElementById('attStatus').value = record.status;
    if (record.check_in) document.getElementById('attCheckIn').value = utils.formatTime(record.check_in);
    if (record.check_out) document.getElementById('attCheckOut').value = utils.formatTime(record.check_out);
    document.getElementById('attNotes').value = record.notes || '';
    document.getElementById('attModalTitle').textContent = 'Editar Asistencia';
    utils.openModal('attModal');
  },

  async save() {
    const id = document.getElementById('attId').value;
    const payload = {
      employee_id: document.getElementById('attEmployee').value,
      date: document.getElementById('attDate').value,
      check_in: document.getElementById('attCheckIn').value || null,
      check_out: document.getElementById('attCheckOut').value || null,
      notes: document.getElementById('attNotes').value,
      status: document.getElementById('attStatus').value,
    };

    if (!payload.employee_id || !payload.date) {
      utils.toast('Selecciona un colaborador y una fecha', 'warning');
      return;
    }

    try {
      if (id) {
        await api.attendance.update(id, payload);
        utils.toast('Registro actualizado', 'success');
      } else {
        await api.attendance.create(payload);
        utils.toast('Asistencia registrada', 'success');
      }
      utils.closeModal('attModal');
      this.loadTodayStats();
      this.loadData();
    } catch (err) {
      utils.toast('Error: ' + err.message, 'error');
    }
  },

  exportData() {
    utils.exportCSV(this.records, 'asistencia', [
      { label: 'Código', key: 'employee_code' },
      { label: 'Nombre', fn: r => `${r.first_name} ${r.last_name}` },
      { label: 'Área', key: 'area_name' },
      { label: 'Fecha', fn: r => utils.formatDate(r.date) },
      { label: 'Entrada', fn: r => r.check_in ? utils.formatTime(r.check_in) : '' },
      { label: 'Salida', fn: r => r.check_out ? utils.formatTime(r.check_out) : '' },
      { label: 'Tardanza (min)', key: 'tardiness_minutes' },
      { label: 'Horas Extra (min)', key: 'overtime_minutes' },
      { label: 'Estado', key: 'status' },
    ]);
  }
};
