/* =============================================
   Licenses Module — Licencias y Descansos Médicos
   ============================================= */

const LicensesModule = {
  records: [],
  filters: { status: '', employee_id: '', type: '' },

  async render(container) {
    const user = utils.getUser();
    const isColab = user.role === 'Colaborador';

    container.innerHTML = `
      <div class="page-enter">
        <div class="page-header">
          <div>
            <h1 class="page-title">
              <div class="page-title-icon" style="background:var(--danger)">🏥</div>
              Licencias y Descansos Médicos
            </h1>
            <p class="page-subtitle">Registro de licencias por salud, maternidad, paternidad, dolo u otros</p>
          </div>
          <button class="btn btn-primary" onclick="LicensesModule.openRequestModal()">➕ Registrar Licencia</button>
        </div>

        <!-- Filters -->
        <div class="filter-bar">
          ${!isColab ? `
            <select class="filter-select" id="licEmpFilter" style="flex:1;min-width:200px">
              <option value="">Todos los colaboradores</option>
            </select>
          ` : ''}
          <select class="filter-select" id="licTypeFilter">
            <option value="">Todos los tipos</option>
            <option value="Médica">Médica</option>
            <option value="Maternidad">Maternidad</option>
            <option value="Paternidad">Paternidad</option>
            <option value="Estudio">Estudio</option>
            <option value="Duelo">Duelo</option>
            <option value="Otro">Otro</option>
          </select>
          <select class="filter-select" id="licStatusFilter">
            <option value="">Todos los estados</option>
            <option value="Pendiente">Pendiente</option>
            <option value="Aprobado">Aprobado</option>
            <option value="Rechazado">Rechazado</option>
          </select>
          <button class="btn btn-secondary" onclick="LicensesModule.applyFilters()">🔍 Filtrar</button>
        </div>

        <!-- Table -->
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Tipo de Licencia</th>
                <th>Fecha Inicio</th>
                <th>Fecha Fin</th>
                <th>Días Hábiles</th>
                <th>Nro Documento/CITT</th>
                <th>Notas</th>
                <th>Aprobado Por</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody id="licTbody">
              <tr><td colspan="10">${utils.loadingState()}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Request Modal -->
      <div class="modal-overlay" id="licModal">
        <div class="modal modal-md">
          <div class="modal-header">
            <h2 class="modal-title">Registrar Licencia / Descanso</h2>
            <button class="modal-close" onclick="utils.closeModal('licModal')">✕</button>
          </div>
          <div class="modal-body">
            <form id="licForm" novalidate>
              ${!isColab ? `
                <div class="form-group">
                  <label class="form-label">Colaborador <span class="required">*</span></label>
                  <select class="form-control" id="licFormEmpId" required>
                    <option value="">Seleccionar colaborador...</option>
                  </select>
                </div>
              ` : ''}

              <div class="form-group">
                <label class="form-label">Tipo de Licencia <span class="required">*</span></label>
                <select class="form-control" id="licFormType" required>
                  <option value="">Seleccionar tipo...</option>
                  <option value="Médica">Médica</option>
                  <option value="Maternidad">Maternidad</option>
                  <option value="Paternidad">Paternidad</option>
                  <option value="Estudio">Estudio</option>
                  <option value="Duelo">Duelo</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Fecha de Inicio <span class="required">*</span></label>
                  <input type="date" class="form-control" id="licFormStartDate" required onchange="LicensesModule.calculateRequestedDays()" />
                </div>
                <div class="form-group">
                  <label class="form-label">Fecha de Fin <span class="required">*</span></label>
                  <input type="date" class="form-control" id="licFormEndDate" required onchange="LicensesModule.calculateRequestedDays()" />
                </div>
              </div>

              <!-- Days indicator -->
              <div class="form-group" style="background:var(--gray-50);padding:12px;border-radius:var(--radius-md);border:1px dashed var(--gray-200);margin-bottom:20px">
                <span class="text-sm font-semibold text-muted">Días hábiles calculados:</span>
                <span class="text-lg font-bold" style="color:var(--danger);margin-left:4px" id="licDaysCount">0 días</span>
              </div>

              <div class="form-group">
                <label class="form-label">Número de Documento / CITT (Justificante)</label>
                <input type="text" class="form-control" id="licFormDocNumber" placeholder="Ej. CITT-123456 o Certificado Médico ID" />
              </div>

              <div class="form-group">
                <label class="form-label">Notas / Observaciones</label>
                <textarea class="form-control" id="licFormNotes" placeholder="Detalles de la licencia médica o justificación..."></textarea>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="utils.closeModal('licModal')">Cancelar</button>
            <button class="btn btn-primary" onclick="LicensesModule.saveRequest()">💾 Registrar</button>
          </div>
        </div>
      </div>
    `;

    // Populate collaborators dropdown for filters and form
    if (!isColab) {
      try {
        const employees = await api.employees.simpleList();
        const activeEmployees = employees.filter(e => e.status === 'Activo');
        
        utils.populateSelect('licEmpFilter', activeEmployees, 'id', 'name', 'Todos los colaboradores');
        utils.populateSelect('licFormEmpId', activeEmployees, 'id', 'name', 'Seleccionar colaborador...');
      } catch (err) {
        console.warn('Error loading employees for licenses module:', err);
      }
    }

    await this.loadData();
  },

  calculateRequestedDays() {
    const startDate = document.getElementById('licFormStartDate').value;
    const endDate = document.getElementById('licFormEndDate').value;
    const daysLabel = document.getElementById('licDaysCount');

    if (!startDate || !endDate) {
      daysLabel.textContent = '0 días';
      return 0;
    }

    const sd = new Date(startDate);
    const ed = new Date(endDate);

    if (sd > ed) {
      daysLabel.textContent = 'Fechas inválidas';
      return 0;
    }

    let days = 0;
    const cursor = new Date(sd);
    while (cursor <= ed) {
      const d = cursor.getDay();
      if (d !== 0 && d !== 6) { // Exclude Sunday (0) and Saturday (6)
        days++;
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    daysLabel.textContent = `${days} día${days !== 1 ? 's' : ''}`;
    return days;
  },

  applyFilters() {
    const empFilter = document.getElementById('licEmpFilter');
    this.filters.employee_id = empFilter ? empFilter.value : '';
    this.filters.type = document.getElementById('licTypeFilter').value;
    this.filters.status = document.getElementById('licStatusFilter').value;
    this.loadData();
  },

  async loadData() {
    const tbody = document.getElementById('licTbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:40px"><div class="spinner"></div></td></tr>`;

    try {
      const params = { ...this.filters };
      Object.keys(params).forEach(k => !params[k] && delete params[k]);

      const data = await api.licenses.list(params);
      this.records = data;

      this.renderTable();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="10">${utils.emptyState('⚠️', 'Error al cargar licencias', err.message)}</td></tr>`;
    }
  },

  renderTable() {
    const tbody = document.getElementById('licTbody');
    if (!this.records.length) {
      tbody.innerHTML = `<tr><td colspan="10">${utils.emptyState('🏥', 'Sin licencias registradas', 'No se encontraron licencias o descansos médicos.')}</td></tr>`;
      return;
    }

    const user = utils.getUser();
    // Only RRHH and Administrador can approve/reject licenses based on routes authorize
    const canApprove = user.role === 'RRHH' || user.role === 'Administrador';

    tbody.innerHTML = this.records.map(r => {
      const colabName = `${r.first_name} ${r.last_name}`;
      const isPending = r.status === 'Pendiente';

      let actionsHtml = '<div class="flex gap-1">';
      if (isPending && canApprove) {
        actionsHtml += `<button class="btn btn-sm btn-success btn-icon" onclick="LicensesModule.approveRequest(${r.id})" title="Aprobar">✓</button>`;
        actionsHtml += `<button class="btn btn-sm btn-danger btn-icon" onclick="LicensesModule.rejectRequest(${r.id})" title="Rechazar">✗</button>`;
      } else {
        actionsHtml += '—';
      }
      actionsHtml += '</div>';

      const approvedByCol = r.approved_by_name 
        ? `<div class="font-medium text-primary">${r.approved_by_name}</div>`
        : `<span style="color:var(--gray-400)">—</span>`;

      return `
        <tr>
          <td>
            <div class="employee-cell">
              <div class="avatar">${utils.initials(colabName)}</div>
              <div>
                <div class="cell-name">${colabName}</div>
                <div class="cell-sub">${r.employee_code}</div>
              </div>
            </div>
          </td>
          <td><span class="badge badge-purple">${r.type}</span></td>
          <td>${utils.formatDate(r.start_date)}</td>
          <td>${utils.formatDate(r.end_date)}</td>
          <td><strong>${r.days_count} día${r.days_count !== 1 ? 's' : ''}</strong></td>
          <td><code style="font-weight:600;color:var(--gray-700)">${r.document_number || '—'}</code></td>
          <td><span style="font-size:13px;display:inline-block;max-width:180px" class="truncate" title="${r.notes || ''}">${r.notes || '—'}</span></td>
          <td>${approvedByCol}</td>
          <td>${utils.statusBadge(r.status)}</td>
          <td>${actionsHtml}</td>
        </tr>
      `;
    }).join('');
  },

  openRequestModal() {
    const form = document.getElementById('licForm');
    if (form) form.reset();
    document.getElementById('licDaysCount').textContent = '0 días';
    utils.openModal('licModal');
  },

  async saveRequest() {
    const form = document.getElementById('licForm');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const user = utils.getUser();
    const isColab = user.role === 'Colaborador';
    const employee_id = isColab ? null : document.getElementById('licFormEmpId').value;
    const type = document.getElementById('licFormType').value;
    const start_date = document.getElementById('licFormStartDate').value;
    const end_date = document.getElementById('licFormEndDate').value;
    const document_number = document.getElementById('licFormDocNumber').value;
    const notes = document.getElementById('licFormNotes').value;

    if (!isColab && !employee_id) {
      utils.toast('Debe seleccionar un colaborador', 'warning');
      return;
    }

    const sd = new Date(start_date);
    const ed = new Date(end_date);

    if (sd > ed) {
      utils.toast('La fecha de fin no puede ser anterior a la fecha de inicio', 'warning');
      return;
    }

    const requested = this.calculateRequestedDays();
    if (requested <= 0) {
      utils.toast('La solicitud debe comprender al menos 1 día hábil', 'warning');
      return;
    }

    try {
      const payload = {
        employee_id: employee_id ? parseInt(employee_id) : undefined,
        type,
        start_date,
        end_date,
        document_number: document_number || null,
        notes: notes || null
      };

      await api.licenses.create(payload);
      utils.closeModal('licModal');
      utils.toast('Licencia registrada con éxito');
      this.loadData();
    } catch (err) {
      utils.toast('Error al registrar licencia: ' + err.message, 'error');
    }
  },

  async approveRequest(id) {
    const confirmed = await utils.confirm('¿Está seguro de aprobar esta licencia médica / descanso?');
    if (!confirmed) return;

    try {
      await api.licenses.updateStatus(id, 'approve');
      utils.toast('Licencia aprobada con éxito');
      this.loadData();
    } catch (err) {
      utils.toast('Error al aprobar: ' + err.message, 'error');
    }
  },

  async rejectRequest(id) {
    const confirmed = await utils.confirm('¿Está seguro de rechazar esta licencia médica / descanso?', 'Rechazar Licencia');
    if (!confirmed) return;

    try {
      await api.licenses.updateStatus(id, 'reject');
      utils.toast('Licencia rechazada');
      this.loadData();
    } catch (err) {
      utils.toast('Error al rechazar: ' + err.message, 'error');
    }
  }
};
