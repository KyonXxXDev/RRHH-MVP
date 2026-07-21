/* =============================================
   Permissions Module — Solicitudes y Flujo
   ============================================= */

const PermissionsModule = {
  records: [],
  page: 1,
  limit: 10,
  total: 0,
  filters: { status: '', employee_id: '' },

  async render(container) {
    const user = utils.getUser();
    const isColab = user.role === 'Colaborador';

    container.innerHTML = `
      <div class="page-enter">
        <div class="page-header">
          <div>
            <h1 class="page-title">
              <div class="page-title-icon" style="background:var(--primary)">📋</div>
              Gestión de Permisos
            </h1>
            <p class="page-subtitle">Solicitudes de permisos y flujo de aprobación</p>
          </div>
          <button class="btn btn-primary" onclick="PermissionsModule.openRequestModal()">➕ Solicitar Permiso</button>
        </div>

        <!-- Filters -->
        <div class="filter-bar">
          ${!isColab ? `
            <select class="filter-select" id="permEmpFilter" style="flex:1;min-width:200px">
              <option value="">Todos los colaboradores</option>
            </select>
          ` : ''}
          <select class="filter-select" id="permStatusFilter">
            <option value="">Todos los estados</option>
            <option value="Pendiente">Pendiente</option>
            <option value="Aprobado por Jefe">Aprobado por Jefe</option>
            <option value="Aprobado">Aprobado</option>
            <option value="Rechazado">Rechazado</option>
          </select>
          <button class="btn btn-secondary" onclick="PermissionsModule.applyFilters()">🔍 Filtrar</button>
        </div>

        <!-- Table -->
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Tipo</th>
                <th>Fecha Inicio</th>
                <th>Fecha Fin</th>
                <th>Horario</th>
                <th>Motivo</th>
                <th>Aprobadores</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody id="permTbody">
              <tr><td colspan="9">${utils.loadingState()}</td></tr>
            </tbody>
          </table>
          <div id="permPagination"></div>
        </div>
      </div>

      <!-- Request Modal -->
      <div class="modal-overlay" id="permModal">
        <div class="modal modal-md">
          <div class="modal-header">
            <h2 class="modal-title">Nueva Solicitud de Permiso</h2>
            <button class="modal-close" onclick="utils.closeModal('permModal')">✕</button>
          </div>
          <div class="modal-body">
            <form id="permForm" novalidate>
              ${!isColab ? `
                <div class="form-group">
                  <label class="form-label">Colaborador <span class="required">*</span></label>
                  <select class="form-control" id="permFormEmpId" required>
                    <option value="">Seleccionar colaborador...</option>
                  </select>
                </div>
              ` : ''}
              
              <div class="form-group">
                <label class="form-label">Tipo de Permiso <span class="required">*</span></label>
                <select class="form-control" id="permFormType" required>
                  <option value="">Seleccionar tipo...</option>
                  <option value="Personal">Personal</option>
                  <option value="Médico">Médico</option>
                  <option value="Familiar">Familiar</option>
                  <option value="Capacitación">Capacitación</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Fecha de Inicio <span class="required">*</span></label>
                  <input type="date" class="form-control" id="permFormStartDate" required />
                </div>
                <div class="form-group">
                  <label class="form-label">Fecha de Fin <span class="required">*</span></label>
                  <input type="date" class="form-control" id="permFormEndDate" required />
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Hora de Inicio (Opcional)</label>
                  <input type="time" class="form-control" id="permFormStartTime" />
                </div>
                <div class="form-group">
                  <label class="form-label">Hora de Fin (Opcional)</label>
                  <input type="time" class="form-control" id="permFormEndTime" />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Motivo <span class="required">*</span></label>
                <textarea class="form-control" id="permFormReason" placeholder="Justificación de la solicitud..." required></textarea>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="utils.closeModal('permModal')">Cancelar</button>
            <button class="btn btn-primary" onclick="PermissionsModule.saveRequest()">💾 Enviar Solicitud</button>
          </div>
        </div>
      </div>
    `;

    // Populate collaborators dropdown for filters and form
    if (!isColab) {
      try {
        const employees = await api.employees.simpleList();
        const activeEmployees = employees.filter(e => e.status === 'Activo');
        
        utils.populateSelect('permEmpFilter', activeEmployees, 'id', 'name', 'Todos los colaboradores');
        utils.populateSelect('permFormEmpId', activeEmployees, 'id', 'name', 'Seleccionar colaborador...');
      } catch (err) {
        console.warn('Error loading employees for permission list filters:', err);
      }
    }

    await this.loadData();
  },

  applyFilters() {
    this.page = 1;
    const empFilter = document.getElementById('permEmpFilter');
    this.filters.employee_id = empFilter ? empFilter.value : '';
    this.filters.status = document.getElementById('permStatusFilter').value;
    this.loadData();
  },

  async loadData() {
    const tbody = document.getElementById('permTbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:40px"><div class="spinner"></div></td></tr>`;

    try {
      const params = {
        page: this.page,
        limit: this.limit,
        ...this.filters
      };
      
      // Clean empty keys
      Object.keys(params).forEach(k => !params[k] && delete params[k]);

      const res = await api.permissions.list(params);
      this.records = res.data;
      this.total = res.total;

      this.renderTable();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="9">${utils.emptyState('⚠️', 'Error al cargar permisos', err.message)}</td></tr>`;
    }
  },

  renderTable() {
    const tbody = document.getElementById('permTbody');
    const pagContainer = document.getElementById('permPagination');
    const user = utils.getUser();

    if (!this.records.length) {
      tbody.innerHTML = `<tr><td colspan="9">${utils.emptyState('📋', 'Sin solicitudes', 'No se encontraron solicitudes de permisos.')}</td></tr>`;
      pagContainer.innerHTML = '';
      return;
    }

    tbody.innerHTML = this.records.map(r => {
      const hasTime = r.start_time && r.end_time;
      const timeStr = hasTime ? `${r.start_time} - ${r.end_time}` : '—';
      const colabName = `${r.first_name} ${r.last_name}`;

      // Aprobadores status representation
      const jefeSign = r.manager_approver_name 
        ? `<div class="cell-sub" style="color:var(--success)">✓ Jefe: ${r.manager_approver_name}</div>` 
        : `<div class="cell-sub" style="color:var(--gray-400)">· Jefe: Pendiente</div>`;

      const hrSign = r.hr_approver_name 
        ? `<div class="cell-sub" style="color:var(--success)">✓ RRHH: ${r.hr_approver_name}</div>` 
        : `<div class="cell-sub" style="color:var(--gray-400)">· RRHH: Pendiente</div>`;

      const rejectionInfo = r.rejection_reason 
        ? `<div class="cell-sub" style="color:var(--danger);font-style:italic">Motivo: ${r.rejection_reason}</div>`
        : '';

      const approversCol = `<div class="flex flex-col gap-1">${jefeSign}${hrSign}${rejectionInfo}</div>`;

      // Actions logic based on roles
      let actionsHtml = '<div class="flex gap-1">';
      
      // Cancel button for self-request if still pending
      const isOwnRequest = r.employee_id === user.employee_id;
      if (isOwnRequest && r.status === 'Pendiente') {
        actionsHtml += `<button class="btn btn-sm btn-outline" onclick="PermissionsModule.cancelRequest(${r.id})" title="Cancelar solicitud" style="color:var(--danger)">🗑️ Cancelar</button>`;
      }

      // Approval/Rejection buttons for management roles
      const isPending = r.status === 'Pendiente';
      const isApprovedByJefe = r.status === 'Aprobado por Jefe';

      // Jefe can approve/reject when status is Pendiente
      const isUserJefe = user.role === 'Jefe';
      const isUserHR = user.role === 'RRHH';
      const isUserAdmin = user.role === 'Administrador';

      if (isPending && (isUserJefe || isUserAdmin)) {
        actionsHtml += `<button class="btn btn-sm btn-success btn-icon" onclick="PermissionsModule.approveRequest(${r.id})" title="Aprobar">✓</button>`;
        actionsHtml += `<button class="btn btn-sm btn-danger btn-icon" onclick="PermissionsModule.rejectRequest(${r.id})" title="Rechazar">✗</button>`;
      }
      // RRHH or Admin can approve/reject when status is Aprobado por Jefe (or Pendiente for admin override)
      else if (isApprovedByJefe && (isUserHR || isUserAdmin)) {
        actionsHtml += `<button class="btn btn-sm btn-success btn-icon" onclick="PermissionsModule.approveRequest(${r.id})" title="Aprobar">✓</button>`;
        actionsHtml += `<button class="btn btn-sm btn-danger btn-icon" onclick="PermissionsModule.rejectRequest(${r.id})" title="Rechazar">✗</button>`;
      }
      else if (isPending && isUserHR) {
        // RRHH can also reject directly even if not approved by jefe yet
        actionsHtml += `<button class="btn btn-sm btn-danger btn-icon" onclick="PermissionsModule.rejectRequest(${r.id})" title="Rechazar">✗</button>`;
      }

      actionsHtml += '</div>';

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
          <td><span class="badge badge-blue">${r.type}</span></td>
          <td>${utils.formatDate(r.start_date)}</td>
          <td>${utils.formatDate(r.end_date)}</td>
          <td>${timeStr}</td>
          <td><span style="font-size:13px;display:inline-block;max-width:200px" class="truncate" title="${r.reason}">${r.reason}</span></td>
          <td>${approversCol}</td>
          <td>${utils.statusBadge(r.status)}</td>
          <td>${actionsHtml}</td>
        </tr>
      `;
    }).join('');

    utils.renderPagination(pagContainer, this.total, this.page, this.limit, 'PermissionsModule.changePage');
  },

  changePage(p) {
    PermissionsModule.page = p;
    PermissionsModule.loadData();
  },

  openRequestModal() {
    const form = document.getElementById('permForm');
    if (form) form.reset();
    utils.openModal('permModal');
  },

  async saveRequest() {
    const form = document.getElementById('permForm');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const isColab = utils.getUser().role === 'Colaborador';
    const employee_id = isColab ? null : document.getElementById('permFormEmpId').value;
    const type = document.getElementById('permFormType').value;
    const start_date = document.getElementById('permFormStartDate').value;
    const end_date = document.getElementById('permFormEndDate').value;
    const start_time = document.getElementById('permFormStartTime').value;
    const end_time = document.getElementById('permFormEndTime').value;
    const reason = document.getElementById('permFormReason').value;

    if (!isColab && !employee_id) {
      utils.toast('Debe seleccionar un colaborador', 'warning');
      return;
    }

    if (new Date(start_date) > new Date(end_date)) {
      utils.toast('La fecha de fin no puede ser anterior a la fecha de inicio', 'warning');
      return;
    }

    try {
      const payload = {
        employee_id: employee_id ? parseInt(employee_id) : undefined,
        type,
        start_date,
        end_date,
        start_time: start_time || null,
        end_time: end_time || null,
        reason
      };

      await api.permissions.create(payload);
      utils.closeModal('permModal');
      utils.toast('Solicitud de permiso registrada con éxito');
      this.loadData();
      if (typeof App !== 'undefined' && App.loadPendingBadges) {
        App.loadPendingBadges();
      }
    } catch (err) {
      utils.toast('Error al guardar solicitud: ' + err.message, 'error');
    }
  },

  async approveRequest(id) {
    const confirmed = await utils.confirm('¿Está seguro de aprobar esta solicitud de permiso?');
    if (!confirmed) return;

    try {
      await api.permissions.updateStatus(id, 'approve');
      utils.toast('Solicitud aprobada correctamente');
      this.loadData();
      if (typeof App !== 'undefined' && App.loadPendingBadges) {
        App.loadPendingBadges();
      }
    } catch (err) {
      utils.toast('Error al aprobar: ' + err.message, 'error');
    }
  },

  async rejectRequest(id) {
    const reason = await this.promptRejection();
    if (reason === null) return; // Cancelled

    try {
      await api.permissions.updateStatus(id, 'reject', reason);
      utils.toast('Solicitud rechazada');
      this.loadData();
      if (typeof App !== 'undefined' && App.loadPendingBadges) {
        App.loadPendingBadges();
      }
    } catch (err) {
      utils.toast('Error al rechazar: ' + err.message, 'error');
    }
  },

  async cancelRequest(id) {
    const confirmed = await utils.confirm('¿Está seguro de cancelar esta solicitud? Esta acción la eliminará de forma permanente.');
    if (!confirmed) return;

    try {
      await api.permissions.delete(id);
      utils.toast('Solicitud cancelada con éxito');
      this.loadData();
      if (typeof App !== 'undefined' && App.loadPendingBadges) {
        App.loadPendingBadges();
      }
    } catch (err) {
      utils.toast('Error al cancelar: ' + err.message, 'error');
    }
  },

  async promptRejection() {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay active';
      overlay.innerHTML = `
        <div class="modal modal-sm scale-in">
          <div class="modal-header">
            <div class="modal-title">Rechazar Solicitud</div>
            <button class="modal-close" id="rejectClose">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Motivo del Rechazo <span class="required">*</span></label>
              <textarea class="form-control" id="rejectReasonInput" placeholder="Escriba el motivo del rechazo aquí..." required></textarea>
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
