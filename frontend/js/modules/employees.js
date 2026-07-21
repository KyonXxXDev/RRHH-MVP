/* =============================================
   Employees Module — Full CRUD
   ============================================= */

const EmployeesModule = {
  employees: [],
  areas: [],
  positions: [],
  allPositions: [],
  page: 1,
  filters: { search: '', area_id: '', status: '' },

  async render(container) {
    const canEdit = utils.hasRole('Administrador', 'RRHH');
    container.innerHTML = `
      <div class="page-enter">
        <div class="page-header">
          <div>
            <h1 class="page-title">
              <div class="page-title-icon">👥</div>
              Gestión de Colaboradores
            </h1>
            <p class="page-subtitle">Registro y administración del personal</p>
          </div>
          ${canEdit ? `<button class="btn btn-primary" onclick="EmployeesModule.openNew()">➕ Nuevo Colaborador</button>` : ''}
        </div>

        <div class="filter-bar">
          <div class="search-wrap">
            <span class="search-icon">🔍</span>
            <input type="text" class="search-input" id="empSearch" placeholder="Buscar por nombre, código, email..." />
          </div>
          <select class="filter-select" id="empAreaFilter"><option value="">Todas las áreas</option></select>
          <select class="filter-select" id="empStatusFilter">
            <option value="">Todos los estados</option>
            <option value="Activo">Activo</option>
            <option value="Inactivo">Inactivo</option>
          </select>
        </div>

        <div class="table-wrap">
          <table id="empTable">
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Código</th>
                <th>Área</th>
                <th>Cargo</th>
                <th>Jefe Inmediato</th>
                <th>Ingreso</th>
                <th>Estado</th>
                ${canEdit ? '<th>Acciones</th>' : ''}
              </tr>
            </thead>
            <tbody id="empTbody"><tr><td colspan="8">${utils.loadingState()}</td></tr></tbody>
          </table>
          <div id="empPagination"></div>
        </div>
      </div>

      <!-- Employee Modal -->
      <div class="modal-overlay" id="empModal">
        <div class="modal modal-lg">
          <div class="modal-header">
            <h2 class="modal-title" id="empModalTitle">Nuevo Colaborador</h2>
            <button class="modal-close" onclick="utils.closeModal('empModal')">✕</button>
          </div>
          <div class="modal-body">
            <form id="empForm" novalidate>
              <input type="hidden" id="empId"/>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Nombres <span class="required">*</span></label>
                  <input type="text" class="form-control" id="empFirstName" placeholder="Nombres" required/>
                </div>
                <div class="form-group">
                  <label class="form-label">Apellidos <span class="required">*</span></label>
                  <input type="text" class="form-control" id="empLastName" placeholder="Apellidos" required/>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Correo <span class="required">*</span></label>
                  <input type="email" class="form-control" id="empEmail" placeholder="correo@empresa.com" required/>
                </div>
                <div class="form-group">
                  <label class="form-label">Teléfono</label>
                  <input type="text" class="form-control" id="empPhone" placeholder="987 654 321"/>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">DNI</label>
                  <input type="text" class="form-control" id="empDni" placeholder="12345678" maxlength="8"/>
                </div>
                <div class="form-group">
                  <label class="form-label">Fecha de Nacimiento</label>
                  <input type="date" class="form-control" id="empBirthDate"/>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Área <span class="required">*</span></label>
                  <select class="form-control" id="empArea" onchange="EmployeesModule.onAreaChange()">
                    <option value="">Seleccionar área...</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Cargo</label>
                  <select class="form-control" id="empPosition">
                    <option value="">Seleccionar cargo...</option>
                  </select>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Jefe Inmediato</label>
                  <select class="form-control" id="empManager">
                    <option value="">Sin jefe inmediato</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Fecha de Ingreso <span class="required">*</span></label>
                  <input type="date" class="form-control" id="empHireDate" required/>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Dirección</label>
                <input type="text" class="form-control" id="empAddress" placeholder="Dirección completa"/>
              </div>
              <div class="form-group" id="empStatusGroup" style="display:none">
                <label class="form-label">Estado</label>
                <select class="form-control" id="empStatus">
                  <option value="Activo">Activo</option>
                  <option value="Inactivo">Inactivo</option>
                </select>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="utils.closeModal('empModal')">Cancelar</button>
            <button class="btn btn-primary" id="empSaveBtn" onclick="EmployeesModule.save()">💾 Guardar</button>
          </div>
        </div>
      </div>

      <!-- History Modal -->
      <div class="modal-overlay" id="historyModal">
        <div class="modal modal-sm">
          <div class="modal-header">
            <h2 class="modal-title">📜 Historial del Colaborador</h2>
            <button class="modal-close" onclick="utils.closeModal('historyModal')">✕</button>
          </div>
          <div class="modal-body">
            <div id="historyContent"></div>
          </div>
        </div>
      </div>
    `;

    // Setup search debounce
    const searchInput = document.getElementById('empSearch');
    searchInput.addEventListener('input', utils.debounce(() => {
      this.filters.search = searchInput.value;
      this.page = 1;
      this.loadData();
    }, 350));

    document.getElementById('empAreaFilter').addEventListener('change', (e) => {
      this.filters.area_id = e.target.value;
      this.page = 1;
      this.loadData();
    });

    document.getElementById('empStatusFilter').addEventListener('change', (e) => {
      this.filters.status = e.target.value;
      this.page = 1;
      this.loadData();
    });

    // Load reference data
    await this.loadReferenceData();
    await this.loadData();
  },

  async loadReferenceData() {
    try {
      const [areas, allPositions, employees] = await Promise.all([
        api.areas.list(),
        api.positions.list(),
        api.employees.simpleList(),
      ]);

      this.areas = areas;
      this.allPositions = allPositions;

      // Populate filters
      const areaFilter = document.getElementById('empAreaFilter');
      areas.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a.id; opt.textContent = a.name;
        areaFilter.appendChild(opt);
      });

      // Populate modal area select
      const areaSelect = document.getElementById('empArea');
      if (areaSelect) {
        areas.forEach(a => {
          const opt = document.createElement('option');
          opt.value = a.id; opt.textContent = a.name;
          areaSelect.appendChild(opt);
        });
      }

      // Populate manager select
      const mgrSelect = document.getElementById('empManager');
      if (mgrSelect) {
        employees.filter(e => e.status === 'Activo').forEach(e => {
          const opt = document.createElement('option');
          opt.value = e.id; opt.textContent = `${e.name} — ${e.position_name || ''}`;
          mgrSelect.appendChild(opt);
        });
      }
    } catch (err) {
      console.warn('Error loading reference data:', err);
    }
  },

  onAreaChange() {
    const areaId = document.getElementById('empArea').value;
    const posSelect = document.getElementById('empPosition');
    posSelect.innerHTML = '<option value="">Seleccionar cargo...</option>';

    const filtered = areaId
      ? this.allPositions.filter(p => p.area_id == areaId)
      : this.allPositions;

    filtered.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id; opt.textContent = p.name;
      posSelect.appendChild(opt);
    });
  },

  async loadData() {
    const tbody = document.getElementById('empTbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px"><div class="spinner"></div></td></tr>`;

    try {
      const params = { page: this.page, limit: 20, ...this.filters };
      Object.keys(params).forEach(k => !params[k] && delete params[k]);
      const { data, total } = await api.employees.list(params);
      this.employees = data;
      this.renderTable(data, total);
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="8">${utils.emptyState('⚠️', 'Error al cargar', err.message)}</td></tr>`;
    }
  },

  renderTable(data, total) {
    const tbody = document.getElementById('empTbody');
    const canEdit = utils.hasRole('Administrador', 'RRHH');

    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="8">${utils.emptyState('👥', 'Sin colaboradores', 'Ajusta los filtros o agrega un nuevo colaborador.')}</td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(e => `
      <tr>
        <td>
          <div class="employee-cell">
            <div class="avatar">${utils.initials(e.first_name + ' ' + e.last_name)}</div>
            <div>
              <div class="cell-name">${e.first_name} ${e.last_name}</div>
              <div class="cell-sub">${e.email}</div>
            </div>
          </div>
        </td>
        <td><code style="background:var(--gray-100);padding:2px 6px;border-radius:4px;font-size:12px">${e.code}</code></td>
        <td>${e.area_name || '—'}</td>
        <td>${e.position_name || '—'}</td>
        <td>${e.manager_name || '—'}</td>
        <td>${utils.formatDate(e.hire_date)}</td>
        <td>${utils.badge(e.status)}</td>
        ${canEdit ? `
        <td>
          <div class="flex gap-1">
            <button class="btn btn-sm btn-outline btn-icon" onclick="EmployeesModule.viewHistory(${e.id})" title="Historial">📜</button>
            <button class="btn btn-sm btn-outline btn-icon" onclick="EmployeesModule.openEdit(${e.id})" title="Editar">✏️</button>
            <button class="btn btn-sm btn-outline btn-icon" onclick="EmployeesModule.delete(${e.id})" title="Desactivar" style="color:var(--danger)">🗑️</button>
          </div>
        </td>` : ''}
      </tr>
    `).join('');

    // Pagination
    const paginationEl = document.getElementById('empPagination');
    utils.renderPagination(paginationEl, total, this.page, 20, (p) => {
      this.page = p;
      this.loadData();
    });
  },

  openNew() {
    document.getElementById('empId').value = '';
    document.getElementById('empForm').reset();
    document.getElementById('empModalTitle').textContent = 'Nuevo Colaborador';
    document.getElementById('empStatusGroup').style.display = 'none';
    utils.openModal('empModal');
  },

  async openEdit(id) {
    try {
      const emp = await api.employees.get(id);
      document.getElementById('empId').value = emp.id;
      document.getElementById('empFirstName').value = emp.first_name || '';
      document.getElementById('empLastName').value = emp.last_name || '';
      document.getElementById('empEmail').value = emp.email || '';
      document.getElementById('empPhone').value = emp.phone || '';
      document.getElementById('empDni').value = emp.dni || '';
      document.getElementById('empBirthDate').value = emp.birth_date || '';
      document.getElementById('empHireDate').value = emp.hire_date || '';
      document.getElementById('empAddress').value = emp.address || '';
      document.getElementById('empStatus').value = emp.status || 'Activo';
      document.getElementById('empArea').value = emp.area_id || '';
      this.onAreaChange();
      setTimeout(() => { document.getElementById('empPosition').value = emp.position_id || ''; }, 50);
      document.getElementById('empManager').value = emp.manager_id || '';
      document.getElementById('empModalTitle').textContent = 'Editar Colaborador';
      document.getElementById('empStatusGroup').style.display = 'block';
      utils.openModal('empModal');
    } catch (err) {
      utils.toast('Error al cargar colaborador: ' + err.message, 'error');
    }
  },

  async save() {
    const id = document.getElementById('empId').value;
    const payload = {
      first_name: document.getElementById('empFirstName').value.trim(),
      last_name: document.getElementById('empLastName').value.trim(),
      email: document.getElementById('empEmail').value.trim(),
      phone: document.getElementById('empPhone').value.trim(),
      dni: document.getElementById('empDni').value.trim(),
      birth_date: document.getElementById('empBirthDate').value,
      hire_date: document.getElementById('empHireDate').value,
      address: document.getElementById('empAddress').value.trim(),
      area_id: document.getElementById('empArea').value || null,
      position_id: document.getElementById('empPosition').value || null,
      manager_id: document.getElementById('empManager').value || null,
      status: document.getElementById('empStatus').value,
    };

    if (!payload.first_name || !payload.last_name || !payload.email || !payload.hire_date) {
      utils.toast('Completa los campos obligatorios (Nombres, Apellidos, Email, Fecha de Ingreso)', 'warning');
      return;
    }

    const btn = document.getElementById('empSaveBtn');
    btn.disabled = true; btn.textContent = 'Guardando...';

    try {
      if (id) {
        await api.employees.update(id, payload);
        utils.toast('Colaborador actualizado correctamente', 'success');
      } else {
        await api.employees.create(payload);
        utils.toast('Colaborador registrado correctamente', 'success');
      }
      utils.closeModal('empModal');
      this.loadData();
    } catch (err) {
      utils.toast('Error: ' + err.message, 'error');
    } finally {
      btn.disabled = false; btn.innerHTML = '💾 Guardar';
    }
  },

  async delete(id) {
    const confirmed = await utils.confirm('¿Estás seguro de desactivar este colaborador?', 'Desactivar colaborador');
    if (!confirmed) return;
    try {
      await api.employees.delete(id);
      utils.toast('Colaborador desactivado', 'success');
      this.loadData();
    } catch (err) {
      utils.toast('Error: ' + err.message, 'error');
    }
  },

  async viewHistory(id) {
    const container = document.getElementById('historyContent');
    container.innerHTML = utils.loadingState();
    utils.openModal('historyModal');

    try {
      const history = await api.employees.history(id);
      if (!history.length) {
        container.innerHTML = utils.emptyState('📜', 'Sin historial', 'No hay cambios registrados aún.');
        return;
      }

      container.innerHTML = `<div class="timeline">` + history.map(h => `
        <div class="timeline-item">
          <div class="timeline-dot">📝</div>
          <div class="timeline-content">
            <div class="timeline-date">${utils.formatDateTime(h.created_at)} · ${h.changed_by_name}</div>
            <div class="timeline-title">${h.change_type}</div>
            ${h.old_value ? `<div class="timeline-desc">De: ${h.old_value} → A: ${h.new_value}</div>` : `<div class="timeline-desc">${h.new_value || h.notes || ''}</div>`}
          </div>
        </div>
      `).join('') + `</div>`;
    } catch (err) {
      container.innerHTML = utils.emptyState('⚠️', 'Error', err.message);
    }
  },
};
