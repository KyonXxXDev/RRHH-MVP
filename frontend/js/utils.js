/* =============================================
   HRMS Utilities — Formatters, Helpers, Toast
   ============================================= */

// ---------- Date Formatting ----------
const utils = {
  formatDate(dateStr, opts = {}) {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''));
      return d.toLocaleDateString('es-PE', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        ...opts
      });
    } catch { return dateStr; }
  },

  formatDateTime(dateStr) {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('es-PE', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch { return dateStr; }
  },

  formatTime(dateStr) {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    } catch { return dateStr; }
  },

  formatMinutes(mins) {
    if (!mins || mins <= 0) return '0 min';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}min`;
  },

  formatCurrency(amount) {
    return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(amount || 0);
  },

  today() {
    return new Date().toISOString().split('T')[0];
  },

  todayLong() {
    return new Date().toLocaleDateString('es-PE', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  },

  // ---------- Avatar Initials ----------
  initials(name) {
    if (!name) return '??';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  },

  // ---------- Badge HTML ----------
  badge(text, extraClass = '') {
    const cls = text ? text.replace(/\s+/g, '-') : 'gray';
    return `<span class="badge badge-${cls} ${extraClass}">${text || '—'}</span>`;
  },

  statusBadge(status) {
    return utils.badge(status);
  },

  // ---------- Action Buttons ----------
  actionBtns(id, options = {}) {
    const { edit = true, del = true, view = false, approve = false, reject = false } = options;
    let html = '<div class="flex gap-1">';
    if (view) html += `<button class="btn btn-sm btn-outline btn-icon" onclick="${view}(${id})" title="Ver">👁️</button>`;
    if (edit) html += `<button class="btn btn-sm btn-outline btn-icon" onclick="${edit}(${id})" title="Editar">✏️</button>`;
    if (approve) html += `<button class="btn btn-sm btn-success btn-icon" onclick="${approve}(${id})" title="Aprobar">✓</button>`;
    if (reject) html += `<button class="btn btn-sm btn-danger btn-icon" onclick="${reject}(${id})" title="Rechazar">✗</button>`;
    if (del) html += `<button class="btn btn-sm btn-outline btn-icon" onclick="${del}(${id})" title="Eliminar" style="color:var(--danger)">🗑️</button>`;
    html += '</div>';
    return html;
  },

  // ---------- Toast Notifications ----------
  toast(message, type = 'success', duration = 4000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span style="flex-shrink:0; font-size:18px">${icons[type] || '📢'}</span>
      <span style="flex:1">${message}</span>
      <button onclick="this.parentElement.remove()" style="background:none;border:none;cursor:pointer;font-size:16px;color:inherit;padding:0;margin-left:8px">✕</button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  // ---------- Confirm Dialog ----------
  async confirm(message, title = '¿Confirmar acción?') {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay active';
      overlay.innerHTML = `
        <div class="modal modal-sm scale-in">
          <div class="modal-header">
            <div class="modal-title">⚠️ ${title}</div>
          </div>
          <div class="modal-body">
            <p style="color:var(--gray-600);font-size:15px;line-height:1.6">${message}</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="confirmNo">Cancelar</button>
            <button class="btn btn-danger" id="confirmYes">Confirmar</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      overlay.querySelector('#confirmNo').onclick = () => { overlay.remove(); resolve(false); };
      overlay.querySelector('#confirmYes').onclick = () => { overlay.remove(); resolve(true); };
      overlay.onclick = (e) => { if (e.target === overlay) { overlay.remove(); resolve(false); } };
    });
  },

  // ---------- Modal Helpers ----------
  openModal(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.add('active'); document.body.style.overflow = 'hidden'; }
  },

  closeModal(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.remove('active'); document.body.style.overflow = ''; }
  },

  closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(el => {
      el.classList.remove('active');
    });
    document.body.style.overflow = '';
  },

  // ---------- Empty State ----------
  emptyState(icon, title, desc = '') {
    return `
      <div class="empty-state fade-in">
        <div class="empty-state-icon">${icon}</div>
        <h3>${title}</h3>
        ${desc ? `<p>${desc}</p>` : ''}
      </div>
    `;
  },

  // ---------- Loading State ----------
  loadingState() {
    return `<div class="loading-overlay"><div class="spinner"></div><span>Cargando datos...</span></div>`;
  },

  // ---------- Pagination ----------
  renderPagination(container, total, page, limit, onPage) {
    const totalPages = Math.ceil(total / limit);
    if (totalPages <= 1) { container.innerHTML = ''; return; }
    const showing = Math.min(page * limit, total);
    const from = (page - 1) * limit + 1;
    container.innerHTML = `
      <div class="pagination">
        <span>Mostrando ${from}–${showing} de ${total}</span>
        <div class="pagination-buttons">
          <button class="page-btn" ${page === 1 ? 'disabled' : ''} onclick="(${onPage})(${page-1})">‹</button>
          ${Array.from({length: Math.min(totalPages, 5)}, (_, i) => i + 1).map(p => `
            <button class="page-btn ${p === page ? 'active' : ''}" onclick="(${onPage})(${p})">${p}</button>
          `).join('')}
          <button class="page-btn" ${page === totalPages ? 'disabled' : ''} onclick="(${onPage})(${page+1})">›</button>
        </div>
      </div>
    `;
  },

  // ---------- Export to CSV ----------
  exportCSV(data, filename, headers) {
    const rows = [headers.map(h => h.label).join(',')];
    for (const row of data) {
      rows.push(headers.map(h => {
        const val = h.key ? row[h.key] : (h.fn ? h.fn(row) : '');
        return `"${String(val || '').replace(/"/g, '""')}"`;
      }).join(','));
    }
    const blob = new Blob(['\ufeff' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${filename}_${utils.today()}.csv`;
    a.click();
    utils.toast(`Exportado: ${filename}.csv`, 'success');
  },

  // ---------- Debounce ----------
  debounce(fn, delay = 300) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
  },

  // ---------- Get Current User ----------
  getUser() {
    try { return JSON.parse(localStorage.getItem('hrms_user')) || {}; }
    catch { return {}; }
  },

  hasRole(...roles) {
    return roles.includes(utils.getUser().role);
  },

  canApprove() {
    return utils.hasRole('Administrador', 'RRHH', 'Jefe');
  },

  // ---------- Populate Select ----------
  async populateSelect(selectId, items, valueKey = 'id', labelKey = 'name', placeholder = 'Seleccionar...') {
    const el = document.getElementById(selectId);
    if (!el) return;
    el.innerHTML = `<option value="">${placeholder}</option>` +
      items.map(i => `<option value="${i[valueKey]}">${i[labelKey]}</option>`).join('');
  },
};

// Auto-update date in topbar
function updateTopbarDate() {
  const el = document.getElementById('topbarDate');
  if (el) el.textContent = utils.todayLong();
}
setInterval(updateTopbarDate, 60000);
updateTopbarDate();
