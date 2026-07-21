/* =============================================
   Legajo Digital Module — Carpeta Única de Empleado
   ============================================= */

const LegajoModule = {
  currentEmployeeId: null,
  employeeData: null,
  historyData: [],
  activeTab: 'info', // 'info', 'history', 'docs'

  async render(container) {
    const user = utils.getUser();
    const isColab = user.role === 'Colaborador';

    container.innerHTML = `
      <div class="page-enter">
        <div class="page-header">
          <div>
            <h1 class="page-title">
              <div class="page-title-icon" style="background:var(--primary)">📁</div>
              Legajo Digital
            </h1>
            <p class="page-subtitle">Expediente laboral, documentos y trayectoria del colaborador</p>
          </div>
        </div>

        <!-- Selector for Managers/HR -->
        ${!isColab ? `
          <div class="card" style="margin-bottom:24px">
            <div class="card-body" style="padding:16px">
              <div class="flex items-center gap-3">
                <span style="font-weight:600;color:var(--gray-600);white-space:nowrap">Seleccionar Colaborador:</span>
                <select class="filter-select" id="legajoEmpSelector" style="flex:1" onchange="LegajoModule.onEmployeeChange()">
                  <option value="">Seleccionar colaborador...</option>
                </select>
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Legajo Content Wrapper -->
        <div id="legajoContent">
          ${isColab ? `<div style="text-align:center;padding:40px"><div class="spinner"></div></div>` : `
            <div class="empty-state">
              <div class="empty-state-icon">🔍</div>
              <h3>Selecciona un colaborador</h3>
              <p>Selecciona un colaborador del menú desplegable superior para cargar su expediente digital.</p>
            </div>
          `}
        </div>
      </div>
    `;

    // Populate selector for management roles
    if (!isColab) {
      try {
        const employees = await api.employees.simpleList();
        // Include both active and inactive employees in history folder
        utils.populateSelect('legajoEmpSelector', employees, 'id', 'name', 'Seleccionar colaborador...');
      } catch (err) {
        console.warn('Error loading employees for selector:', err);
      }
    } else if (user.employee_id) {
      // Common employee: directly load their own record
      this.currentEmployeeId = user.employee_id;
      await this.loadEmployeeData(user.employee_id);
    }
  },

  async onEmployeeChange() {
    const selector = document.getElementById('legajoEmpSelector');
    if (!selector) return;
    const empId = selector.value;
    
    const container = document.getElementById('legajoContent');
    if (!empId) {
      this.currentEmployeeId = null;
      this.employeeData = null;
      this.historyData = [];
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <h3>Selecciona un colaborador</h3>
          <p>Selecciona un colaborador del menú desplegable superior para cargar su expediente digital.</p>
        </div>
      `;
      return;
    }

    this.currentEmployeeId = parseInt(empId);
    container.innerHTML = `<div style="text-align:center;padding:40px"><div class="spinner"></div></div>`;
    await this.loadEmployeeData(this.currentEmployeeId);
  },

  async loadEmployeeData(empId) {
    try {
      const [emp, history] = await Promise.all([
        api.employees.get(empId),
        api.employees.history(empId)
      ]);

      this.employeeData = emp;
      this.historyData = history;

      this.renderLegajoShell();
    } catch (err) {
      const container = document.getElementById('legajoContent');
      if (container) {
        container.innerHTML = utils.emptyState('⚠️', 'Error al cargar expediente', err.message);
      }
    }
  },

  renderLegajoShell() {
    const container = document.getElementById('legajoContent');
    if (!container || !this.employeeData) return;

    const emp = this.employeeData;
    const colabName = `${emp.first_name} ${emp.last_name}`;
    const initials = utils.initials(colabName);

    container.innerHTML = `
      <div class="grid" style="grid-template-columns: 280px 1fr; gap: 24px; align-items: start;">
        
        <!-- Left Column: Profile Card -->
        <div class="card flex flex-col items-center p-6 text-center" style="position: sticky; top: 80px;">
          <div class="avatar" style="width:96px; height:96px; font-size:36px; border-radius:50%; margin-bottom:16px;">
            ${initials}
          </div>
          <h2 class="font-bold text-lg text-primary" style="margin-bottom:4px">${colabName}</h2>
          <span class="badge badge-blue" style="margin-bottom:16px">${emp.position_name || 'Sin Cargo'}</span>
          
          <div style="width:100%; text-align:left; border-top:1px solid var(--gray-150); padding-top:16px; font-size:13px" class="flex flex-col gap-2">
            <div class="flex justify-between">
              <span class="text-muted">Código:</span>
              <span class="font-semibold text-primary">${emp.code}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">Área:</span>
              <span class="font-semibold">${emp.area_name || '—'}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">Ingreso:</span>
              <span class="font-semibold">${utils.formatDate(emp.hire_date)}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">Estado:</span>
              <span>${utils.statusBadge(emp.status)}</span>
            </div>
          </div>
        </div>

        <!-- Right Column: Tabs and content -->
        <div class="card">
          <!-- Tab Headers -->
          <div class="card-header" style="padding: 0; justify-content: flex-start; gap: 0; border-bottom:1px solid var(--gray-200)">
            <button class="legajo-tab-btn ${this.activeTab === 'info' ? 'active' : ''}" onclick="LegajoModule.switchTab('info')">
              📝 Información General
            </button>
            <button class="legajo-tab-btn ${this.activeTab === 'history' ? 'active' : ''}" onclick="LegajoModule.switchTab('history')">
              🔄 Historial Laboral
            </button>
            <button class="legajo-tab-btn ${this.activeTab === 'docs' ? 'active' : ''}" onclick="LegajoModule.switchTab('docs')">
              📁 Documentos Legales
            </button>
          </div>

          <!-- Tab Content Body -->
          <div class="card-body" id="legajoTabContent" style="padding: 24px;">
            ${this.getTabContentHTML()}
          </div>
        </div>

      </div>
    `;

    // Inject custom inline CSS for legajo tabs if not already present
    if (!document.getElementById('legajo-custom-styles')) {
      const styles = document.createElement('style');
      styles.id = 'legajo-custom-styles';
      styles.textContent = `
        .legajo-tab-btn {
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
        .legajo-tab-btn:hover {
          color: var(--primary-light);
          background: var(--gray-50);
        }
        .legajo-tab-btn.active {
          color: var(--primary);
          border-bottom-color: var(--primary);
          background: var(--white);
        }
        .doc-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 18px;
          background: var(--white);
          border: 1.5px solid var(--gray-150);
          border-radius: var(--radius-md);
          margin-bottom: 12px;
          transition: all var(--transition-fast);
        }
        .doc-item:hover {
          border-color: var(--accent);
          background: var(--gray-50);
          transform: translateY(-1px);
        }
      `;
      document.head.appendChild(styles);
    }
  },

  switchTab(tab) {
    this.activeTab = tab;
    
    // Update headers active state
    document.querySelectorAll('.legajo-tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    // Update body content
    const container = document.getElementById('legajoTabContent');
    if (container) {
      container.innerHTML = this.getTabContentHTML();
    }
  },

  getTabContentHTML() {
    const emp = this.employeeData;
    if (!emp) return '';

    if (this.activeTab === 'info') {
      return `
        <div class="flex flex-col gap-6 fade-in">
          <h3 class="font-bold text-primary text-base" style="border-bottom:1.5px solid var(--gray-100);padding-bottom:8px">Ficha de Datos de Contacto y Personales</h3>
          <div class="grid" style="grid-template-columns: 1fr 1fr; gap: 20px;">
            <div>
              <span class="text-xs font-semibold text-muted" style="display:block;margin-bottom:4px">Nombres y Apellidos</span>
              <span class="font-semibold text-gray-800 text-base">${emp.first_name} ${emp.last_name}</span>
            </div>
            <div>
              <span class="text-xs font-semibold text-muted" style="display:block;margin-bottom:4px">DNI / Documento de Identidad</span>
              <span class="font-semibold text-gray-800 text-base">${emp.dni || '—'}</span>
            </div>
            <div>
              <span class="text-xs font-semibold text-muted" style="display:block;margin-bottom:4px">Correo Electrónico</span>
              <span class="font-semibold text-gray-800 text-base">${emp.email}</span>
            </div>
            <div>
              <span class="text-xs font-semibold text-muted" style="display:block;margin-bottom:4px">Teléfono de Contacto</span>
              <span class="font-semibold text-gray-800 text-base">${emp.phone || '—'}</span>
            </div>
            <div>
              <span class="text-xs font-semibold text-muted" style="display:block;margin-bottom:4px">Fecha de Nacimiento</span>
              <span class="font-semibold text-gray-800 text-base">${utils.formatDate(emp.birth_date)}</span>
            </div>
            <div>
              <span class="text-xs font-semibold text-muted" style="display:block;margin-bottom:4px">Dirección Domiciliaria</span>
              <span class="font-semibold text-gray-800 text-base">${emp.address || '—'}</span>
            </div>
          </div>

          <h3 class="font-bold text-primary text-base" style="border-bottom:1.5px solid var(--gray-100);padding-bottom:8px;margin-top:12px">Datos de Organización</h3>
          <div class="grid" style="grid-template-columns: 1fr 1fr; gap: 20px;">
            <div>
              <span class="text-xs font-semibold text-muted" style="display:block;margin-bottom:4px">Jefe Directo / Supervisor</span>
              <span class="font-semibold text-gray-800 text-base">${emp.manager_name || 'Sin Jefe Directo'}</span>
            </div>
            <div>
              <span class="text-xs font-semibold text-muted" style="display:block;margin-bottom:4px">Fecha de Ingreso</span>
              <span class="font-semibold text-gray-800 text-base">${utils.formatDate(emp.hire_date)}</span>
            </div>
          </div>
        </div>
      `;
    }

    if (this.activeTab === 'history') {
      if (!this.historyData || !this.historyData.length) {
        return utils.emptyState('🔄', 'Sin cambios registrados', 'Aún no se registran movimientos en el historial del colaborador.');
      }

      // Convert history changes into visual timeline
      return `
        <div class="timeline fade-in">
          ${this.historyData.map(h => {
            let dot = '💼';
            if (h.change_type === 'Ingreso') dot = '📝';
            if (h.change_type === 'Cambio de Estado' || h.change_type === 'Estado') dot = '⚡';
            if (h.change_type === 'Cambio de Cargo' || h.change_type === 'Cargo') dot = '🎖️';
            if (h.change_type === 'Cambio de Área' || h.change_type === 'Área') dot = '🏢';

            let changeText = '';
            if (h.old_value && h.new_value) {
              changeText = `Modificado de <strong style="color:var(--gray-800)">${h.old_value}</strong> a <strong style="color:var(--primary)">${h.new_value}</strong>`;
            } else if (h.new_value) {
              changeText = h.new_value;
            } else {
              changeText = h.notes || 'Cambio registrado en el expediente';
            }

            const notesSection = h.notes && h.notes !== changeText 
              ? `<div class="cell-sub" style="margin-top:6px;font-style:italic">"${h.notes}"</div>` 
              : '';

            return `
              <div class="timeline-item">
                <div class="timeline-dot" style="color:white">${dot}</div>
                <div class="timeline-content">
                  <div class="timeline-date">${utils.formatDateTime(h.created_at)}</div>
                  <div class="timeline-title">${h.change_type}</div>
                  <div class="timeline-desc">${changeText}</div>
                  ${notesSection}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    if (this.activeTab === 'docs') {
      const colabName = `${emp.first_name} ${emp.last_name}`;
      const documents = [
        { name: 'Contrato de Trabajo e Incorporación', ext: 'PDF', icon: '📝', size: '1.2 MB' },
        { name: 'Documento Nacional de Identidad (DNI) escaneado', ext: 'PDF', icon: '🪪', size: '540 KB' },
        { name: 'Currículum Vitae (CV) - Postulación', ext: 'PDF', icon: '📄', size: '820 KB' },
        { name: 'Certificados de Estudios y Diplomas académicos', ext: 'PDF', icon: '🎓', size: '2.4 MB' },
        { name: 'Certificado de Antecedentes Penales y Policiales', ext: 'PDF', icon: '👮', size: '420 KB' },
      ];

      return `
        <div class="flex flex-col fade-in">
          <p style="color:var(--gray-500);font-size:13px;margin-bottom:16px">Documentos digitales almacenados en el expediente laboral. Haz clic en descargar para obtener una copia simulada.</p>
          <div>
            ${documents.map(d => `
              <div class="doc-item">
                <div class="flex items-center gap-3">
                  <div class="kpi-icon" style="width:36px;height:36px;font-size:16px;background:var(--gray-100)">${d.icon}</div>
                  <div>
                    <div style="font-weight:600;color:var(--gray-800);font-size:14px">${d.name}</div>
                    <div class="cell-sub">${d.ext} · ${d.size}</div>
                  </div>
                </div>
                <button class="btn btn-sm btn-outline" onclick="LegajoModule.downloadSimulatedDoc('${d.name}', '${colabName}')">
                  📥 Descargar
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    return '';
  },

  downloadSimulatedDoc(docName, employeeName) {
    utils.toast(`Descargando: ${docName} - ${employeeName}`, 'info');
    
    // Simulate dynamic file download
    setTimeout(() => {
      const blob = new Blob([`Contenido simulado de: ${docName}\nColaborador: ${employeeName}\nGenerado el: ${new Date().toLocaleString()}`], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${docName.replace(/\s+/g, '_')}_${employeeName.replace(/\s+/g, '_')}.txt`;
      a.click();
      utils.toast('Descarga completada', 'success');
    }, 800);
  }
};
