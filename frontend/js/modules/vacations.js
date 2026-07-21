/* =============================================
   Vacations Module — Gestión de Vacaciones
   ============================================= */

const VacationsModule = {
  records: [],
  filters: { status: '', employee_id: '' },
  availableDays: 0,

  async render(container) {
    const user = utils.getUser();
    const isColab = user.role === 'Colaborador';

    // Fetch available vacation days for logged-in user
    if (user.employee_id) {
      try {
        const emp = await api.employees.get(user.employee_id);
        this.availableDays = emp.vacation_days_available || 0;
      } catch (err) {
        console.warn('Error fetching available vacation days:', err);
      }
    }

    container.innerHTML = `
      <div class="page-enter">
        <div class="page-header">
          <div>
            <h1 class="page-title">
              <div class="page-title-icon" style="background:var(--success)">🌴</div>
              Gestión de Vacaciones
            </h1>
            <p class="page-subtitle">Solicitudes de vacaciones y saldos disponibles</p>
          </div>
          <button class="btn btn-primary" onclick="VacationsModule.openRequestModal()">➕ Solicitar Vacaciones</button>
        </div>

        <!-- Dashboard Summary -->
        <div class="kpi-grid" style="grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); margin-bottom: 24px;">
          <div class="kpi-card green">
            <div class="kpi-icon green">📅</div>
            <div class="kpi-info">
              <div class="kpi-label">Mis Días Disponibles</div>
              <div class="kpi-value">${user.employee_id ? this.availableDays : '—'}</div>
              <div class="kpi-sub">días hábiles de vacaciones</div>
            </div>
          </div>
        </div>

        <!-- Filters -->
        <div class="filter-bar">
          ${!isColab ? `
            <select class="filter-select" id="vacEmpFilter" style="flex:1;min-width:200px">
              <option value="">Todos los colaboradores</option>
            </select>
          ` : ''}
          <select class="filter-select" id="vacStatusFilter">
            <option value="">Todos los estados</option>
            <option value="Pendiente">Pendiente</option>
            <option value="Aprobado">Aprobado</option>
            <option value="Rechazado">Rechazado</option>
          </select>
          <button class="btn btn-secondary" onclick="VacationsModule.applyFilters()">🔍 Filtrar</button>
        </div>

        <!-- Table -->
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Fecha Inicio</th>
                <th>Fecha Fin</th>
                <th>Días Solicitados</th>
                <th>Saldo Restante</th>
                <th>Motivo</th>
                <th>Aprobado Por</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody id="vacTbody">
              <tr><td colspan="9">${utils.loadingState()}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Request Modal -->
      <div class="modal-overlay" id="vacModal">
        <div class="modal modal-md">
          <div class="modal-header">
            <h2 class="modal-title">Nueva Solicitud de Vacaciones</h2>
            <button class="modal-close" onclick="utils.closeModal('vacModal')">✕</button>
          </div>
          <div class="modal-body">
            <form id="vacForm" novalidate>
              ${!isColab ? `
                <div class="form-group">
                  <label class="form-label">Colaborador <span class="required">*</span></label>
                  <select class="form-control" id="vacFormEmpId" required onchange="VacationsModule.onFormEmployeeChange()">
                    <option value="">Seleccionar colaborador...</option>
                  </select>
                </div>
              ` : ''}

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Fecha de Inicio <span class="required">*</span></label>
                  <input type="date" class="form-control" id="vacFormStartDate" required onchange="VacationsModule.calculateRequestedDays()" />
                </div>
                <div class="form-group">
                  <label class="form-label">Fecha de Fin <span class="required">*</span></label>
                  <input type="date" class="form-control" id="vacFormEndDate" required onchange="VacationsModule.calculateRequestedDays()" />
                </div>
              </div>

              <!-- Days indicator -->
              <div class="form-group flex justify-between items-center" style="background:var(--gray-50);padding:12px;border-radius:var(--radius-md);border:1px dashed var(--gray-200);margin-bottom:20px">
                <div>
                  <span class="text-sm font-semibold text-muted">Días hábiles solicitados:</span>
                  <span class="text-lg font-bold" style="color:var(--primary);margin-left:4px" id="vacDaysCount">0 días</span>
                </div>
                <div>
                  <span class="text-xs text-muted" id="vacFormAvailableLabel">Saldos disponibles: ${this.availableDays} d</span>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Motivo (Opcional)</label>
                <textarea class="form-control" id="vacFormReason" placeholder="Comentarios adicionales..."></textarea>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="utils.closeModal('vacModal')">Cancelar</button>
            <button class="btn btn-primary" onclick="VacationsModule.saveRequest()">💾 Enviar Solicitud</button>
          </div>
        </div>
      </div>
    `;

    // Populate collaborators dropdown for filters and form
    if (!isColab) {
      try {
        const employees = await api.employees.simpleList();
        const activeEmployees = employees.filter(e => e.status === 'Activo');
        
        utils.populateSelect('vacEmpFilter', activeEmployees, 'id', 'name', 'Todos los colaboradores');
        utils.populateSelect('vacFormEmpId', activeEmployees, 'id', 'name', 'Seleccionar colaborador...');
      } catch (err) {
        console.warn('Error loading employees for vacations module:', err);
      }
    }

    await this.loadData();
  },

  async onFormEmployeeChange() {
    const select = document.getElementById('vacFormEmpId');
    if (!select) return;
    const empId = select.value;
    const label = document.getElementById('vacFormAvailableLabel');
    if (!empId) {
      label.textContent = 'Seleccione colaborador';
      return;
    }

    try {
      const emp = await api.employees.get(empId);
      label.textContent = `Saldos disponibles: ${emp.vacation_days_available} d`;
    } catch {
      label.textContent = 'Error al obtener días';
    }
  },

  calculateRequestedDays() {
    const startDate = document.getElementById('vacFormStartDate').value;
    const endDate = document.getElementById('vacFormEndDate').value;
    const daysLabel = document.getElementById('vacDaysCount');

    if (!startDate || !endDate) {
      daysLabel.textContent = '0 días';
      return 0;
    }

    const sd = new Date(startDate);
    const ed = new Date(endDate);

    if (sd > ed) {
      daysLabel.textContent = 'Error: fechas inválidas';
      daysLabel.style.color = 'var(--danger)';
      return 0;
    }

    daysLabel.style.color = 'var(--primary)';

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
    const empFilter = document.getElementById('vacEmpFilter');
    this.filters.employee_id = empFilter ? empFilter.value : '';
    this.filters.status = document.getElementById('vacStatusFilter').value;
    this.loadData();
  },

  async loadData() {
    const tbody = document.getElementById('vacTbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:40px"><div class="spinner"></div></td></tr>`;

    try {
      const params = { ...this.filters };
      Object.keys(params).forEach(k => !params[k] && delete params[k]);

      const data = await api.vacations.list(params);
      this.records = data;

      this.renderTable();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="9">${utils.emptyState('⚠️', 'Error al cargar vacaciones', err.message)}</td></tr>`;
    }
  },

  renderTable() {
    const tbody = document.getElementById('vacTbody');
    if (!this.records.length) {
      tbody.innerHTML = `<tr><td colspan="9">${utils.emptyState('🌴', 'Sin solicitudes', 'No se encontraron solicitudes de vacaciones.')}</td></tr>`;
      return;
    }

    const user = utils.getUser();
    const canApprove = utils.canApprove();

    tbody.innerHTML = this.records.map(r => {
      const colabName = `${r.first_name} ${r.last_name}`;
      
      const isPending = r.status === 'Pendiente';

      let actionsHtml = '<div class="flex gap-1">';
      if (isPending && canApprove) {
        actionsHtml += `<button class="btn btn-sm btn-success btn-icon" onclick="VacationsModule.approveRequest(${r.id})" title="Aprobar">✓</button>`;
        actionsHtml += `<button class="btn btn-sm btn-danger btn-icon" onclick="VacationsModule.rejectRequest(${r.id})" title="Rechazar">✗</button>`;
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
          <td>${utils.formatDate(r.start_date)}</td>
          <td>${utils.formatDate(r.end_date)}</td>
          <td><strong>${r.days_count} día${r.days_count !== 1 ? 's' : ''}</strong></td>
          <td>${r.vacation_days_available} días</td>
          <td><span style="font-size:13px;display:inline-block;max-width:200px" class="truncate" title="${r.reason || ''}">${r.reason || '—'}</span></td>
          <td>${approvedByCol}</td>
          <td>${utils.statusBadge(r.status)}</td>
          <td>${actionsHtml}</td>
        </tr>
      `;
    }).join('');
  },

  openRequestModal() {
    const form = document.getElementById('vacForm');
    if (form) form.reset();
    document.getElementById('vacDaysCount').textContent = '0 días';
    const isColab = utils.getUser().role === 'Colaborador';
    document.getElementById('vacFormAvailableLabel').textContent = isColab 
      ? `Saldos disponibles: ${this.availableDays} d`
      : 'Seleccione colaborador';
    utils.openModal('vacModal');
  },

  async saveRequest() {
    const form = document.getElementById('vacForm');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const user = utils.getUser();
    const isColab = user.role === 'Colaborador';
    const employee_id = isColab ? null : document.getElementById('vacFormEmpId').value;
    const start_date = document.getElementById('vacFormStartDate').value;
    const end_date = document.getElementById('vacFormEndDate').value;
    const reason = document.getElementById('vacFormReason').value;

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

    // Verify day balance
    let currentBalance = this.availableDays;
    if (!isColab) {
      try {
        const emp = await api.employees.get(employee_id);
        currentBalance = emp.vacation_days_available;
      } catch {
        utils.toast('No se pudo verificar el saldo del colaborador', 'error');
        return;
      }
    }

    if (currentBalance < requested) {
      utils.toast(`Días insuficientes. Solicitados: ${requested}, disponibles: ${currentBalance}`, 'warning');
      return;
    }

    try {
      const payload = {
        employee_id: employee_id ? parseInt(employee_id) : undefined,
        start_date,
        end_date,
        reason
      };

      await api.vacations.create(payload);
      utils.closeModal('vacModal');
      utils.toast('Solicitud de vacaciones enviada con éxito');
      
      // Update local available days if self-request
      if (isColab) {
        this.availableDays -= requested;
        const availableEl = document.querySelector('.kpi-value');
        if (availableEl) availableEl.textContent = this.availableDays;
      }

      this.loadData();
    } catch (err) {
      utils.toast('Error al solicitar vacaciones: ' + err.message, 'error');
    }
  },

  async approveRequest(id) {
    const confirmed = await utils.confirm('¿Está seguro de aprobar esta solicitud de vacaciones? Los días se descontarán del saldo del colaborador.');
    if (!confirmed) return;

    try {
      await api.vacations.updateStatus(id, 'approve');
      utils.toast('Vacaciones aprobadas con éxito');
      this.loadData();
      
      // Reload logged-in user balance if their request was approved
      const user = utils.getUser();
      if (user.employee_id) {
        const emp = await api.employees.get(user.employee_id);
        this.availableDays = emp.vacation_days_available;
        const availableEl = document.querySelector('.kpi-value');
        if (availableEl) availableEl.textContent = this.availableDays;
      }
    } catch (err) {
      utils.toast('Error al aprobar: ' + err.message, 'error');
    }
  },

  async rejectRequest(id) {
    const reason = await this.promptRejection();
    if (reason === null) return;

    try {
      await api.vacations.updateStatus(id, 'reject', reason);
      utils.toast('Solicitud de vacaciones rechazada');
      this.loadData();
    } catch (err) {
      utils.toast('Error al rechazar: ' + err.message, 'error');
    }
  },

  async promptRejection() {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay active';
      overlay.innerHTML = `
        <div class="modal modal-sm scale-in">
          <div class="modal-header">
            <div class="modal-title">Rechazar Vacaciones</div>
            <button class="modal-close" id="rejectClose">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Motivo del Rechazo <span class="required">*</span></label>
              <textarea class="form-control" id="rejectReasonInput" placeholder="Escriba el motivo aquí..." required></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="rejectCancel">Cancelar</button>
            <button class="btn btn-danger" id="rejectConfirm">Rechazar</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const cleanUp = () => { overlay.remove(); };

      overlay.querySelector('#rejectClose').onclick = () => { cleanUp(); resolve(null); };
      overlay.querySelector('#rejectCancel').onclick = () => { cleanUp(); resolve(null); };
      overlay.querySelector('#rejectConfirm').onclick = () => {
        const reason = overlay.querySelector('#rejectReasonInput').value.trim();
        if (!reason) {
          utils.toast('Debe ingresar un motivo para rechazar', 'warning');
          return;
        }
        cleanUp();
        resolve(reason);
      };
      
      overlay.onclick = (e) => { if (e.target === overlay) { cleanUp(); resolve(null); } };
    });
  }
};
