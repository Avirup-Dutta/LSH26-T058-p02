/**
 * PharmCheck BD - Bangladeshi Pharmacy Expiry & Inventory Engine
 * Benchmark Suite Integration (P02_pharmacy_expiry_public.json) with dynamic case switching & custom JSON upload.
 */

const API_BASE = '/api';
const STORAGE_KEY_MEDS = 'pharmcheck_bd_inventory_v4';
const STORAGE_KEY_RETS = 'pharmcheck_bd_returned_v4';
const STORAGE_KEY_CASE = 'pharmcheck_bd_active_case_v4';

// ==========================================================================
// 1. Date & Formatting Helpers (Supports Reference 'Today' Date)
// ==========================================================================

function parseDate(dateStr) {
  if (!dateStr) return new Date();
  const parts = dateStr.split('-');
  return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    const d = parseDate(dateStr);
    return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (e) {
    return dateStr;
  }
}

function getDaysRemaining(expiryStr, todayStr) {
  try {
    const today = parseDate(todayStr);
    today.setHours(0, 0, 0, 0);
    const expiry = parseDate(expiryStr);
    expiry.setHours(0, 0, 0, 0);
    const diffTime = expiry.getTime() - today.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  } catch (e) {
    return 0;
  }
}

function getExpiryStatus(daysRemaining) {
  if (daysRemaining < 0) {
    return {
      key: 'expired',
      label: 'Expired',
      pillClass: 'pill-danger',
      rowClass: 'row-danger',
      daysText: `${Math.abs(daysRemaining)}d ago`,
      groupName: '🔴 Expired'
    };
  } else if (daysRemaining <= 30) {
    return {
      key: 'within30',
      label: '≤ 30 Days',
      pillClass: 'pill-warning',
      rowClass: 'row-warning',
      daysText: daysRemaining === 0 ? 'Expires today' : `${daysRemaining}d left`,
      groupName: '🟠 Within 30 Days'
    };
  } else if (daysRemaining <= 90) {
    return {
      key: 'within90',
      label: '31–90 Days',
      pillClass: 'pill-caution',
      rowClass: 'row-caution',
      daysText: `${daysRemaining}d left`,
      groupName: '🟡 Within 90 Days'
    };
  } else {
    return {
      key: 'safe',
      label: 'Safe',
      pillClass: 'pill-success',
      rowClass: 'row-safe',
      daysText: `${daysRemaining}d left`,
      groupName: '🟢 Safe (>90d)'
    };
  }
}

function formatTaka(amount) {
  const num = parseFloat(amount) || 0;
  return `৳ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Auto-assign clinical category if not specified
function detectCategory(name) {
  const lname = (name || '').toLowerCase();
  if (lname.includes('napa') || lname.includes('ace') || lname.includes('clofenac') || lname.includes('rolac') || lname.includes('fexo') || lname.includes('paracetamol')) return 'Analgesics / Pain';
  if (lname.includes('seclo') || lname.includes('maxpro') || lname.includes('losectil') || lname.includes('pantonix') || lname.includes('sergel') || lname.includes('anset')) return 'Gastrointestinal';
  if (lname.includes('cef') || lname.includes('zimax') || lname.includes('ciprocin') || lname.includes('moxacil') || lname.includes('doxicap') || lname.includes('ceftron')) return 'Antibiotics';
  if (lname.includes('monas') || lname.includes('tofen') || lname.includes('bexitrol') || lname.includes('alatrol') || lname.includes('flixonase')) return 'Respiratory';
  if (lname.includes('comet') || lname.includes('insulatard') || lname.includes('linaglip') || lname.includes('gluconor') || lname.includes('thyrox')) return 'Antidiabetic';
  if (lname.includes('anclog') || lname.includes('cardizem') || lname.includes('osartil') || lname.includes('rosuva') || lname.includes('camlodin') || lname.includes('bizoran')) return 'Cardiovascular';
  if (lname.includes('dermasol') || lname.includes('burnsil') || lname.includes('fucicort') || lname.includes('cream')) return 'Dermatology';
  if (lname.includes('saline') || lname.includes('hartman') || lname.includes('epinephrine')) return 'Emergency / Critical';
  if (lname.includes('calbo') || lname.includes('d-rise') || lname.includes('filwel') || lname.includes('vitamin')) return 'Vitamins / Supplements';
  return 'General';
}

// ==========================================================================
// 2. Application Controller
// ==========================================================================

class PharmacyExpiryApp {
  constructor() {
    this.currentCaseId = 'PUB-01';
    this.todayDate = '2026-08-16'; // Dynamic reference today date from case
    this.allCasesData = null;
    this.medicines = [];
    this.returnedMedicines = [];
    this.currentTab = 'all';
    this.selectedCategory = 'all';
    this.searchTerm = '';
    this.sortOption = 'expiry-asc';
    this.selectedIds = new Set();
    this.activeReturnTarget = null;
    this.chartInstance = null;

    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.loadBenchmarkSuite();
  }

  async loadBenchmarkSuite() {
    try {
      const res = await fetch('P02_pharmacy_expiry_public.json');
      if (res.ok) {
        this.allCasesData = await res.json();
        const savedCase = localStorage.getItem(STORAGE_KEY_CASE) || 'PUB-01';
        this.loadCase(savedCase);
        return;
      }
    } catch (e) {
      console.warn('Direct JSON fetch failed, loading via API/embedded fallback');
    }

    // Fallback load via API
    try {
      const res = await fetch(`${API_BASE}/load-case`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: 'PUB-01' })
      });
      if (res.ok) {
        const d = await res.json();
        this.todayDate = d.today || '2026-08-16';
        await this.syncFromAPI();
        return;
      }
    } catch (e) {}

    // Embedded Fallback
    this.updateDashboard();
  }

  loadCase(caseId) {
    if (!this.allCasesData || !this.allCasesData.cases) return;

    const targetCase = this.allCasesData.cases.find(c => c.case_id === caseId) || this.allCasesData.cases[0];
    if (!targetCase) return;

    this.currentCaseId = targetCase.case_id;
    this.todayDate = targetCase.today;
    localStorage.setItem(STORAGE_KEY_CASE, this.currentCaseId);

    const markReturned = new Set(targetCase.mark_returned || []);
    this.medicines = [];
    this.returnedMedicines = [];
    this.selectedIds.clear();

    (targetCase.items || []).forEach(it => {
      const med = {
        id: it.id,
        name: it.name,
        batch: it.batch,
        category: it.category || detectCategory(it.name),
        distributor: it.company || 'General Pharma',
        qty: parseInt(it.quantity, 10) || 1,
        price: parseFloat(it.unit_price_bdt) || 0.0,
        expiry: it.expiry
      };

      if (markReturned.has(it.id)) {
        this.returnedMedicines.push({
          ...med,
          returnedDate: this.todayDate,
          returnReason: 'Distributor Expiry Return (DGDA Protocol)',
          returnRef: `RMA-${this.currentCaseId}`,
          returnNotes: 'Benchmarked return item'
        });
      } else {
        this.medicines.push(med);
      }
    });

    const selectEl = document.getElementById('test-case-select');
    if (selectEl) selectEl.value = this.currentCaseId;

    this.renderHeaderDate();
    this.updateDashboard();
    this.syncToServer();
  }

  loadCustomJSON(jsonContent) {
    try {
      const data = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;
      if (data.cases && Array.isArray(data.cases)) {
        this.allCasesData = data;
        this.loadCase(data.cases[0].case_id);
      } else if (data.items && Array.isArray(data.items)) {
        this.allCasesData = { cases: [data] };
        this.loadCase(data.case_id || 'CUSTOM-01');
      }
    } catch (e) {}
  }

  async syncToServer() {
    try {
      await fetch(`${API_BASE}/load-case`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: this.currentCaseId })
      });
    } catch (e) {}
  }

  async syncFromAPI() {
    try {
      const res = await fetch(`${API_BASE}/inventory`);
      if (res.ok) {
        const d = await res.json();
        if (d.activeMedicines && d.activeMedicines.length > 0) {
          this.medicines = d.activeMedicines;
          this.returnedMedicines = d.returnedMedicines || [];
          this.updateDashboard();
        }
      }
    } catch (e) {}
  }

  renderHeaderDate() {
    const today = parseDate(this.todayDate);
    const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
    const dateEl = document.getElementById('current-date-display');
    if (dateEl) {
      dateEl.textContent = today.toLocaleDateString('en-GB', options);
    }
  }

  // ==========================================================================
  // 3. Calculations & Metrics Engine
  // ==========================================================================

  calculateMetrics() {
    const metrics = {
      expired: { count: 0, units: 0, totalValue: 0 },
      within30: { count: 0, units: 0, totalValue: 0 },
      within90: { count: 0, units: 0, totalValue: 0 },
      safe: { count: 0, units: 0, totalValue: 0 },
      activeTotalValue: 0,
      activeTotalCount: this.medicines.length,
      moneyAtRisk: 0,
      returnedTotalValue: 0,
      returnedCount: this.returnedMedicines.length
    };

    this.medicines.forEach(item => {
      const days = getDaysRemaining(item.expiry, this.todayDate);
      const status = getExpiryStatus(days);
      const value = (item.qty || 0) * (item.price || 0);

      metrics.activeTotalValue += value;

      const group = metrics[status.key];
      if (group) {
        group.count += 1;
        group.units += (item.qty || 0);
        group.totalValue += value;
      }
    });

    metrics.moneyAtRisk = metrics.expired.totalValue + metrics.within30.totalValue;

    this.returnedMedicines.forEach(item => {
      metrics.returnedTotalValue += ((item.qty || 0) * (item.price || 0));
    });

    return metrics;
  }

  updateDashboard() {
    const metrics = this.calculateMetrics();
    this.renderKPICards(metrics);
    this.renderSpotlight(metrics);
    this.renderTableTabs(metrics);
    this.renderTableRows();
    this.renderChart(metrics);
    this.updateBulkActionBar();

    try {
      if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
    } catch (e) {}
  }

  renderKPICards(m) {
    const setSafe = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setSafe('kpi-expired-val', formatTaka(m.expired.totalValue));
    setSafe('kpi-expired-count', m.expired.count);
    setSafe('kpi-expired-units', m.expired.units.toLocaleString());

    setSafe('kpi-30-val', formatTaka(m.within30.totalValue));
    setSafe('kpi-30-count', m.within30.count);
    setSafe('kpi-30-units', m.within30.units.toLocaleString());

    setSafe('kpi-90-val', formatTaka(m.within90.totalValue));
    setSafe('kpi-90-count', m.within90.count);
    setSafe('kpi-90-units', m.within90.units.toLocaleString());

    setSafe('kpi-safe-val', formatTaka(m.safe.totalValue));
    setSafe('kpi-safe-count', m.safe.count);
    setSafe('kpi-safe-units', m.safe.units.toLocaleString());
  }

  renderSpotlight(m) {
    const setSafe = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setSafe('total-risk-val', formatTaka(m.moneyAtRisk));
    setSafe('spotlight-exp-part', m.expired.totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    setSafe('spotlight-30-part', m.within30.totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    setSafe('total-active-val', formatTaka(m.activeTotalValue));

    const riskPct = m.activeTotalValue > 0 ? ((m.moneyAtRisk / m.activeTotalValue) * 100) : 0;
    setSafe('total-risk-pct', `${riskPct.toFixed(1)}%`);

    const progressFill = document.getElementById('risk-progress-fill');
    if (progressFill) {
      progressFill.style.width = `${Math.min(riskPct, 100)}%`;
    }

    setSafe('total-returned-val', formatTaka(m.returnedTotalValue));
  }

  renderTableTabs(m) {
    const setSafe = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setSafe('count-tab-all', m.activeTotalCount);
    setSafe('count-tab-expired', m.expired.count);
    setSafe('count-tab-within30', m.within30.count);
    setSafe('count-tab-within90', m.within90.count);
    setSafe('count-tab-safe', m.safe.count);
    setSafe('count-tab-returned', m.returnedCount);

    const printBtn = document.getElementById('btn-print-manifest');
    if (printBtn) {
      printBtn.style.display = this.currentTab === 'returned' && this.returnedMedicines.length > 0 ? 'inline-flex' : 'none';
    }
  }

  getFilteredMedicines() {
    let list = [];
    const isReturnedTab = this.currentTab === 'returned';

    if (isReturnedTab) {
      list = [...this.returnedMedicines];
    } else {
      list = this.medicines.map(item => {
        const days = getDaysRemaining(item.expiry, this.todayDate);
        const status = getExpiryStatus(days);
        return { ...item, daysRemaining: days, statusInfo: status };
      });

      if (this.currentTab !== 'all') {
        list = list.filter(item => item.statusInfo.key === this.currentTab);
      }
    }

    if (this.selectedCategory && this.selectedCategory !== 'all') {
      list = list.filter(item => item.category === this.selectedCategory);
    }

    if (this.searchTerm.trim()) {
      const q = this.searchTerm.toLowerCase().trim();
      list = list.filter(item => 
        (item.name && item.name.toLowerCase().includes(q)) ||
        (item.batch && item.batch.toLowerCase().includes(q)) ||
        (item.distributor && item.distributor.toLowerCase().includes(q)) ||
        (item.category && item.category.toLowerCase().includes(q)) ||
        (item.returnRef && item.returnRef.toLowerCase().includes(q))
      );
    }

    list.sort((a, b) => {
      try {
        if (this.sortOption === 'expiry-asc') {
          return parseDate(a.expiry) - parseDate(b.expiry);
        } else if (this.sortOption === 'expiry-desc') {
          return parseDate(b.expiry) - parseDate(a.expiry);
        } else if (this.sortOption === 'value-desc') {
          return ((b.qty || 0) * (b.price || 0)) - ((a.qty || 0) * (a.price || 0));
        } else if (this.sortOption === 'value-asc') {
          return ((a.qty || 0) * (a.price || 0)) - ((b.qty || 0) * (b.price || 0));
        } else if (this.sortOption === 'name-asc') {
          return (a.name || '').localeCompare(b.name || '');
        } else if (this.sortOption === 'qty-desc') {
          return (b.qty || 0) - (a.qty || 0);
        }
      } catch (e) {}
      return 0;
    });

    return list;
  }

  renderTableRows() {
    const tbody = document.getElementById('inventory-tbody');
    const emptyState = document.getElementById('empty-state');
    if (!tbody) return;

    const filtered = this.getFilteredMedicines();
    const isReturnedTab = this.currentTab === 'returned';

    tbody.innerHTML = '';

    const visEl = document.getElementById('visible-count');
    const totEl = document.getElementById('total-count');
    if (visEl) visEl.textContent = filtered.length;
    if (totEl) totEl.textContent = isReturnedTab ? this.returnedMedicines.length : this.medicines.length;

    if (filtered.length === 0) {
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    filtered.forEach(item => {
      const tr = document.createElement('tr');
      const itemValue = (item.qty || 0) * (item.price || 0);
      const isSelected = this.selectedIds.has(item.id);

      if (isSelected) tr.classList.add('row-selected');

      if (isReturnedTab) {
        tr.classList.add('row-returned');
        tr.innerHTML = `
          <td class="th-checkbox">
            <input type="checkbox" class="row-checkbox" data-id="${item.id}" disabled>
          </td>
          <td>
            <div class="med-main-cell">
              <span class="med-name-text">${item.name || 'Unknown'}</span>
              <span class="med-meta-text">
                <span class="med-cat-tag">${item.category || 'General'}</span>
                <span>• ${item.distributor || 'General'}</span>
                <span>• RMA: <strong>${item.returnRef || 'Standard'}</strong></span>
              </span>
            </div>
          </td>
          <td><span class="batch-code">${item.batch || '-'}</span></td>
          <td><span class="qty-val">${item.qty || 0}</span></td>
          <td><span class="price-val">${formatTaka(item.price)}</span></td>
          <td><span class="total-val val-returned">${formatTaka(itemValue)}</span></td>
          <td><span class="date-val">${formatDate(item.expiry)}</span></td>
          <td>
            <span class="status-pill pill-purple">
              <i data-lucide="truck" style="width:12px;height:12px;"></i> Returned (${formatDate(item.returnedDate ? item.returnedDate.split('T')[0] : '')})
            </span>
          </td>
          <td class="cell-actions">
            <button class="btn-action-restore" data-restore-id="${item.id}" title="Restore back to active shelf">
              <i data-lucide="rotate-ccw" style="width:13px;height:13px;"></i> Restore
            </button>
          </td>
        `;
      } else {
        const days = getDaysRemaining(item.expiry, this.todayDate);
        const status = getExpiryStatus(days);
        tr.classList.add(status.rowClass);

        let valColorClass = 'val-success';
        if (status.key === 'expired') valColorClass = 'val-danger';
        else if (status.key === 'within30') valColorClass = 'val-warning';
        else if (status.key === 'within90') valColorClass = 'val-caution';

        tr.innerHTML = `
          <td class="th-checkbox">
            <input type="checkbox" class="row-checkbox" data-id="${item.id}" ${isSelected ? 'checked' : ''}>
          </td>
          <td>
            <div class="med-main-cell">
              <span class="med-name-text">${item.name || 'Unknown'}</span>
              <span class="med-meta-text">
                <span class="med-cat-tag">${item.category || 'General'}</span>
                <span>• ${item.distributor || 'Square / Beximco / Incepta'}</span>
              </span>
            </div>
          </td>
          <td><span class="batch-code">${item.batch || '-'}</span></td>
          <td><span class="qty-val">${item.qty || 0}</span></td>
          <td><span class="price-val">${formatTaka(item.price)}</span></td>
          <td><span class="total-val ${valColorClass}">${formatTaka(itemValue)}</span></td>
          <td><span class="date-val">${formatDate(item.expiry)}</span></td>
          <td>
            <span class="status-pill ${status.pillClass}">
              ${status.daysText}
            </span>
          </td>
          <td class="cell-actions">
            <button class="btn-action-return" data-return-id="${item.id}" title="Return to distributor for credit claim">
              <i data-lucide="truck" style="width:13px;height:13px;"></i> Return
            </button>
            <button class="btn-action-delete" data-delete-id="${item.id}" title="Delete medicine">
              <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
            </button>
          </td>
        `;
      }

      tbody.appendChild(tr);
    });

    this.updateSelectAllCheckboxState();
  }

  // ==========================================================================
  // 4. Interactive 6-Month Chart
  // ==========================================================================

  renderChart(metrics) {
    if (typeof Chart === 'undefined') return;
    const ctx = document.getElementById('expiryRiskChart');
    if (!ctx) return;

    try {
      const buckets = [0, 0, 0, 0, 0, 0, 0];
      const today = parseDate(this.todayDate);

      this.medicines.forEach(item => {
        const days = getDaysRemaining(item.expiry, this.todayDate);
        const val = (item.qty || 0) * (item.price || 0);

        if (days < 0) buckets[0] += val;
        else if (days <= 30) buckets[1] += val;
        else if (days <= 60) buckets[2] += val;
        else if (days <= 90) buckets[3] += val;
        else if (days <= 120) buckets[4] += val;
        else if (days <= 150) buckets[5] += val;
        else buckets[6] += val;
      });

      const getMonthName = (offset) => {
        const d = new Date(today.getFullYear(), today.getMonth() + offset, 1);
        return d.toLocaleDateString('en-GB', { month: 'short' });
      };

      const labels = [
        'Expired',
        `M1 (${getMonthName(0)})`,
        `M2 (${getMonthName(1)})`,
        `M3 (${getMonthName(2)})`,
        `M4 (${getMonthName(3)})`,
        `M5 (${getMonthName(4)})`,
        `M6+ (${getMonthName(5)}+)`
      ];

      if (this.chartInstance) {
        this.chartInstance.destroy();
      }

      this.chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'Expiring Value (৳ BDT)',
            data: buckets,
            backgroundColor: [
              'rgba(239, 68, 68, 0.85)',
              'rgba(249, 115, 22, 0.85)',
              'rgba(234, 179, 8, 0.85)',
              'rgba(234, 179, 8, 0.6)',
              'rgba(16, 185, 129, 0.75)',
              'rgba(16, 185, 129, 0.65)',
              'rgba(56, 189, 248, 0.65)'
            ],
            borderColor: ['#ef4444', '#f97316', '#eab308', '#ca8a04', '#10b981', '#059669', '#38bdf8'],
            borderWidth: 1.5,
            borderRadius: 6,
            barPercentage: 0.65
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#151d30',
              titleColor: '#f8fafc',
              bodyColor: '#94a3b8',
              borderColor: '#33446b',
              borderWidth: 1,
              padding: 10,
              callbacks: {
                label: (context) => ` Expiring Value: ৳ ${context.raw.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 11 } }
            },
            y: {
              grid: { color: 'rgba(255,255,255,0.06)' },
              ticks: {
                color: '#94a3b8',
                font: { family: 'JetBrains Mono', size: 11 },
                callback: (value) => `৳${value}`
              }
            }
          }
        }
      });
    } catch (e) {
      console.warn('Chart render error:', e);
    }
  }

  // ==========================================================================
  // 5. Actions & Modals
  // ==========================================================================

  openReturnModal(item) {
    this.activeReturnTarget = item;
    const summaryContainer = document.getElementById('return-item-summary');
    const totalVal = (item.qty || 0) * (item.price || 0);
    const days = getDaysRemaining(item.expiry, this.todayDate);
    const status = getExpiryStatus(days);

    if (summaryContainer) {
      summaryContainer.innerHTML = `
        <div class="return-med-title">${item.name}</div>
        <div class="return-meta-row">
          <span>Batch: <strong>${item.batch}</strong></span>
          <span>Qty: <strong>${item.qty} units</strong></span>
          <span>Claim Value: <strong style="color:var(--warning-base);">${formatTaka(totalVal)}</strong></span>
        </div>
        <div class="return-meta-row">
          <span>Status: <strong class="${status.pillClass}">${status.groupName} (${formatDate(item.expiry)})</strong></span>
          <span>Distributor: <strong>${item.distributor || 'General'}</strong></span>
        </div>
      `;
    }

    const refInput = document.getElementById('return-ref');
    if (refInput) refInput.value = `RET-DHK-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const modal = document.getElementById('return-modal');
    if (modal) modal.style.display = 'flex';
  }

  closeReturnModal() {
    this.activeReturnTarget = null;
    const modal = document.getElementById('return-modal');
    if (modal) modal.style.display = 'none';
    const form = document.getElementById('return-medicine-form');
    if (form) form.reset();
  }

  confirmReturn(reason, returnRef, notes) {
    if (!this.activeReturnTarget) return;

    const item = this.activeReturnTarget;
    this.medicines = this.medicines.filter(m => m.id !== item.id);
    this.selectedIds.delete(item.id);

    const returnedRecord = {
      ...item,
      returnedDate: this.todayDate,
      returnReason: reason,
      returnRef: returnRef || `RET-DHK-${Date.now().toString().slice(-4)}`,
      returnNotes: notes
    };

    this.returnedMedicines.unshift(returnedRecord);
    this.closeReturnModal();
    this.updateDashboard();
    this.showToast(`Returned "${item.name}" (${formatTaka((item.qty || 0) * (item.price || 0))}) to distributor.`, 'warning');
  }

  restoreReturnedMedicine(id) {
    const item = this.returnedMedicines.find(m => m.id === id);
    if (!item) return;

    this.returnedMedicines = this.returnedMedicines.filter(m => m.id !== id);
    const { returnedDate, returnReason, returnRef, returnNotes, ...cleanItem } = item;
    this.medicines.unshift(cleanItem);

    this.updateDashboard();
    this.showToast(`Restored "${cleanItem.name}" to active stock.`, 'success');
  }

  executeBulkReturn() {
    if (this.selectedIds.size === 0) return;

    const count = this.selectedIds.size;
    if (!confirm(`Are you sure you want to return ${count} selected medicines to distributors?`)) {
      return;
    }

    let returnedTotalVal = 0;
    const bulkRef = `BULK-RET-DHK-${Math.floor(1000 + Math.random() * 9000)}`;

    for (const item of [...this.medicines]) {
      if (this.selectedIds.has(item.id)) {
        returnedTotalVal += ((item.qty || 0) * (item.price || 0));
        this.returnedMedicines.unshift({
          ...item,
          returnedDate: this.todayDate,
          returnReason: 'Bulk Expiry Return (DGDA)',
          returnRef: bulkRef,
          returnNotes: 'Batch dispatch'
        });
      }
    }

    this.medicines = this.medicines.filter(m => !this.selectedIds.has(m.id));
    this.selectedIds.clear();

    this.updateDashboard();
    this.showToast(`Returned ${count} items (Value: ${formatTaka(returnedTotalVal)}) to distributor.`, 'warning');
  }

  openAddModal() {
    const modal = document.getElementById('add-modal');
    if (modal) modal.style.display = 'flex';
    const expInput = document.getElementById('med-expiry');
    if (expInput) {
      const d = parseDate(this.todayDate);
      d.setDate(d.getDate() + 60);
      expInput.value = d.toISOString().split('T')[0];
    }
    this.updateAddFormPreview();
    setTimeout(() => {
      const nameInput = document.getElementById('med-name');
      if (nameInput) nameInput.focus();
    }, 100);
  }

  closeAddModal() {
    const modal = document.getElementById('add-modal');
    if (modal) modal.style.display = 'none';
    const form = document.getElementById('add-medicine-form');
    if (form) form.reset();
  }

  updateAddFormPreview() {
    const qty = parseFloat(document.getElementById('med-qty')?.value) || 0;
    const price = parseFloat(document.getElementById('med-price')?.value) || 0;
    const expiryDate = document.getElementById('med-expiry')?.value;

    const total = qty * price;
    const totalEl = document.getElementById('preview-total-val');
    if (totalEl) totalEl.textContent = formatTaka(total);

    const previewPill = document.getElementById('preview-status-pill');
    if (previewPill) {
      if (expiryDate) {
        const days = getDaysRemaining(expiryDate, this.todayDate);
        const status = getExpiryStatus(days);
        previewPill.className = `preview-status status-pill ${status.pillClass}`;
        previewPill.textContent = `${status.groupName} (${status.daysText})`;
      } else {
        previewPill.className = 'preview-status';
        previewPill.textContent = 'Select date';
      }
    }
  }

  addMedicine(data) {
    const newMed = {
      id: `M${Date.now().toString().slice(-4)}`,
      name: data.name,
      batch: (data.batch || '').toUpperCase(),
      category: data.category,
      distributor: data.distributor || 'Square Pharmaceuticals PLC',
      qty: parseInt(data.qty, 10) || 1,
      price: parseFloat(data.price) || 0,
      expiry: data.expiry
    };

    this.medicines.unshift(newMed);
    this.closeAddModal();
    this.updateDashboard();

    const days = getDaysRemaining(newMed.expiry, this.todayDate);
    const status = getExpiryStatus(days);
    this.showToast(`Added "${newMed.name}" (${status.groupName}) to inventory.`, 'success');
  }

  deleteMedicine(id) {
    const item = this.medicines.find(m => m.id === id);
    if (!item) return;

    if (confirm(`Remove "${item.name}" (Batch ${item.batch}) from inventory?`)) {
      this.medicines = this.medicines.filter(m => m.id !== id);
      this.selectedIds.delete(id);
      this.updateDashboard();
      this.showToast(`Medicine deleted from inventory.`, 'info');
    }
  }

  updateBulkActionBar() {
    const bar = document.getElementById('bulk-action-bar');
    const countEl = document.getElementById('selected-count');
    const valEl = document.getElementById('selected-value');
    if (!bar) return;

    if (this.selectedIds.size > 0 && this.currentTab !== 'returned') {
      let totalVal = 0;
      this.medicines.forEach(m => {
        if (this.selectedIds.has(m.id)) {
          totalVal += ((m.qty || 0) * (m.price || 0));
        }
      });

      if (countEl) countEl.textContent = this.selectedIds.size;
      if (valEl) valEl.textContent = totalVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      bar.style.display = 'flex';
    } else {
      bar.style.display = 'none';
    }
  }

  updateSelectAllCheckboxState() {
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    if (!selectAllCheckbox) return;

    const filtered = this.getFilteredMedicines();
    if (this.currentTab === 'returned' || filtered.length === 0) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.disabled = true;
      return;
    }

    selectAllCheckbox.disabled = false;
    const allVisibleSelected = filtered.every(item => this.selectedIds.has(item.id));
    const someVisibleSelected = filtered.some(item => this.selectedIds.has(item.id));

    selectAllCheckbox.checked = allVisibleSelected;
    selectAllCheckbox.indeterminate = !allVisibleSelected && someVisibleSelected;
  }

  exportCSV() {
    let csv = 'Type,ID,Name,Category,Batch,Quantity,UnitPrice_BDT,TotalValue_BDT,ExpiryDate,DaysRemaining,Status,Distributor,ReturnRef\n';

    this.medicines.forEach(m => {
      const days = getDaysRemaining(m.expiry, this.todayDate);
      const status = getExpiryStatus(days);
      const val = ((m.qty || 0) * (m.price || 0)).toFixed(2);
      csv += `"ACTIVE","${m.id}","${(m.name || '').replace(/"/g, '""')}","${m.category || ''}","${m.batch || ''}",${m.qty || 0},${(m.price || 0).toFixed(2)},${val},"${m.expiry}",${days},"${status.label}","${(m.distributor || '').replace(/"/g, '""')}",""\n`;
    });

    this.returnedMedicines.forEach(m => {
      const val = ((m.qty || 0) * (m.price || 0)).toFixed(2);
      csv += `"RETURNED","${m.id}","${(m.name || '').replace(/"/g, '""')}","${m.category || ''}","${m.batch || ''}",${m.qty || 0},${(m.price || 0).toFixed(2)},${val},"${m.expiry}","N/A","RETURNED","${(m.distributor || '').replace(/"/g, '""')}","${m.returnRef || ''}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pharmacy_expiry_case_${this.currentCaseId}_${this.todayDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.showToast('CSV inventory exported successfully.', 'success');
  }

  openManifestModal() {
    if (this.returnedMedicines.length === 0) {
      this.showToast('No returned medicines found to generate a manifest.', 'info');
      return;
    }

    const container = document.getElementById('manifest-printable-area');
    if (!container) return;

    const todayStr = formatDate(this.todayDate);
    let totalUnits = 0;
    let totalClaimValue = 0;

    let rowsHtml = '';
    this.returnedMedicines.forEach((m, idx) => {
      const val = (m.qty || 0) * (m.price || 0);
      totalUnits += (m.qty || 0);
      totalClaimValue += val;
      rowsHtml += `
        <tr>
          <td>${idx + 1}</td>
          <td><strong>${m.name || ''}</strong><br><small>${m.distributor || 'General'}</small></td>
          <td><code>${m.batch || '-'}</code></td>
          <td>${m.qty || 0}</td>
          <td>${formatTaka(m.price)}</td>
          <td><strong>${formatTaka(val)}</strong></td>
          <td>${formatDate(m.expiry)}</td>
          <td>${m.returnReason || 'Expiry return'}</td>
          <td><code>${m.returnRef || '-'}</code></td>
        </tr>
      `;
    });

    container.innerHTML = `
      <div class="manifest-header">
        <div>
          <div class="manifest-logo">Green Life Model Pharmacy Ltd</div>
          <div>House #42, Road #9/A, Dhanmondi, Dhaka-1209, Bangladesh</div>
          <div>DGDA Drug License No: <strong>DGDA/DHK-88921/2024</strong> | Case Ref: <strong>${this.currentCaseId}</strong></div>
        </div>
        <div class="manifest-doc-title">
          <h2>DGDA PHARMACEUTICAL RETURN DISPATCH MANIFEST</h2>
          <div>Date: <strong>${todayStr}</strong></div>
          <div>Manifest Ref: <strong>MAN-DHK-${Date.now().toString().slice(-6)}</strong></div>
        </div>
      </div>

      <div class="manifest-meta">
        <div>
          <strong>Pharmacy Details:</strong><br>
          Green Life Model Pharmacy Ltd (Dhanmondi Branch)<br>
          VAT / BIN: 002910481-0101 | Dhaka, Bangladesh
        </div>
        <div>
          <strong>Claim Purpose:</strong><br>
          Distributor Expiry Shelf Return &amp; Credit Note Claim (DGDA Protocol)<br>
          Total Dispatched Batches: <strong>${this.returnedMedicines.length}</strong>
        </div>
      </div>

      <table class="manifest-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Medicine Name &amp; Manufacturer</th>
            <th>Batch #</th>
            <th>Qty</th>
            <th>Unit Price (৳)</th>
            <th>Claim Value (৳)</th>
            <th>Expiry Date</th>
            <th>Return Reason</th>
            <th>Challan / RMA #</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div class="manifest-totals">
        <div class="manifest-totals-box">
          <div class="manifest-totals-row">
            <span>Total Units Dispatched:</span>
            <strong>${totalUnits.toLocaleString()} units</strong>
          </div>
          <div class="manifest-totals-row">
            <span>Total Credit Claim Value:</span>
            <strong style="color:#0369a1; font-size:1.15rem;">${formatTaka(totalClaimValue)}</strong>
          </div>
        </div>
      </div>

      <div class="manifest-signatures">
        <div>
          <div>Authorized Registered Pharmacist (A-Grade):</div>
          <div class="sig-line">Pharmacist Reg No: BPC-9812 | Signature &amp; Stamp: ________________</div>
        </div>
        <div>
          <div>Pharmaceutical Distributor Delivery Representative:</div>
          <div class="sig-line">Received By (Print Name &amp; Signature): _________________________</div>
        </div>
      </div>
    `;

    const modal = document.getElementById('manifest-modal');
    if (modal) modal.style.display = 'flex';
  }

  closeManifestModal() {
    const modal = document.getElementById('manifest-modal');
    if (modal) modal.style.display = 'none';
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle';
    else if (type === 'warning') iconName = 'alert-triangle';
    else if (type === 'danger') iconName = 'alert-octagon';

    toast.innerHTML = `
      <i data-lucide="${iconName}"></i>
      <span>${message}</span>
    `;

    container.appendChild(toast);
    try {
      if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
    } catch (e) {}

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // ==========================================================================
  // 6. Event Listeners Wiring
  // ==========================================================================

  setupEventListeners() {
    const bindClick = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', fn);
    };

    // Test Case Selector Dropdown
    const caseSelect = document.getElementById('test-case-select');
    if (caseSelect) {
      caseSelect.addEventListener('change', (e) => {
        this.loadCase(e.target.value);
      });
    }

    // Load JSON File Input
    const loadJsonInput = document.getElementById('input-load-json');
    if (loadJsonInput) {
      loadJsonInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            this.loadCustomJSON(ev.target.result);
          };
          reader.readAsText(e.target.files[0]);
        }
      });
    }

    bindClick('btn-open-add-modal', () => this.openAddModal());
    bindClick('btn-close-add-modal', () => this.closeAddModal());
    bindClick('btn-cancel-add-modal', () => this.closeAddModal());
    bindClick('btn-empty-add', () => this.openAddModal());

    ['med-qty', 'med-price', 'med-expiry'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => this.updateAddFormPreview());
    });

    document.querySelectorAll('.btn-preset').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const days = parseInt(e.target.dataset.days, 10);
        const d = parseDate(this.todayDate);
        d.setDate(d.getDate() + days);
        const expInput = document.getElementById('med-expiry');
        if (expInput) expInput.value = d.toISOString().split('T')[0];
        this.updateAddFormPreview();
      });
    });

    const addForm = document.getElementById('add-medicine-form');
    if (addForm) {
      addForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('med-name')?.value?.trim();
        const batch = document.getElementById('med-batch')?.value?.trim();
        const category = document.getElementById('med-category')?.value;
        const distributor = document.getElementById('med-distributor')?.value?.trim();
        const qty = document.getElementById('med-qty')?.value;
        const price = document.getElementById('med-price')?.value;
        const expiry = document.getElementById('med-expiry')?.value;

        if (!name || !batch || !qty || !price || !expiry) {
          alert('Please fill out all required fields.');
          return;
        }

        this.addMedicine({ name, batch, category, distributor, qty, price, expiry });
      });
    }

    bindClick('btn-close-return-modal', () => this.closeReturnModal());
    bindClick('btn-cancel-return-modal', () => this.closeReturnModal());

    const returnForm = document.getElementById('return-medicine-form');
    if (returnForm) {
      returnForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const reason = document.getElementById('return-reason')?.value;
        const ref = document.getElementById('return-ref')?.value?.trim();
        const notes = document.getElementById('return-notes')?.value?.trim();
        this.confirmReturn(reason, ref, notes);
      });
    }

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabBtn = e.target.closest('.tab-btn');
        if (!tabBtn) return;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        tabBtn.classList.add('active');
        this.currentTab = tabBtn.dataset.tab;
        this.selectedIds.clear();
        this.renderTableRows();
        this.updateBulkActionBar();
        try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch (err) {}
      });
    });

    document.querySelectorAll('.kpi-card').forEach(card => {
      card.addEventListener('click', () => {
        const filterKey = card.dataset.filterTrigger;
        if (!filterKey) return;
        const targetTab = document.querySelector(`.tab-btn[data-tab="${filterKey}"]`);
        if (targetTab) {
          targetTab.click();
          const tableSection = document.querySelector('.table-section');
          if (tableSection) tableSection.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });

    const catFilter = document.getElementById('category-filter');
    if (catFilter) {
      catFilter.addEventListener('change', (e) => {
        this.selectedCategory = e.target.value;
        this.renderTableRows();
        try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch (err) {}
      });
    }

    const searchInput = document.getElementById('inventory-search');
    const clearBtn = document.getElementById('btn-clear-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchTerm = e.target.value;
        if (clearBtn) clearBtn.style.display = this.searchTerm ? 'block' : 'none';
        this.renderTableRows();
        try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch (err) {}
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        this.searchTerm = '';
        clearBtn.style.display = 'none';
        this.renderTableRows();
        try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch (err) {}
      });
    }

    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.sortOption = e.target.value;
        this.renderTableRows();
        try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch (err) {}
      });
    }

    const tbody = document.getElementById('inventory-tbody');
    if (tbody) {
      tbody.addEventListener('click', (e) => {
        const returnBtn = e.target.closest('[data-return-id]');
        if (returnBtn) {
          const id = returnBtn.dataset.returnId;
          const item = this.medicines.find(m => m.id === id);
          if (item) this.openReturnModal(item);
          return;
        }

        const deleteBtn = e.target.closest('[data-delete-id]');
        if (deleteBtn) {
          const id = deleteBtn.dataset.deleteId;
          this.deleteMedicine(id);
          return;
        }

        const restoreBtn = e.target.closest('[data-restore-id]');
        if (restoreBtn) {
          const id = restoreBtn.dataset.restoreId;
          this.restoreReturnedMedicine(id);
          return;
        }

        if (e.target.classList.contains('row-checkbox')) {
          const id = e.target.dataset.id;
          if (e.target.checked) {
            this.selectedIds.add(id);
          } else {
            this.selectedIds.delete(id);
          }
          this.renderTableRows();
          this.updateBulkActionBar();
          try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch (err) {}
        }
      });
    }

    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        const filtered = this.getFilteredMedicines();
        if (isChecked) {
          filtered.forEach(item => this.selectedIds.add(item.id));
        } else {
          filtered.forEach(item => this.selectedIds.delete(item.id));
        }
        this.renderTableRows();
        this.updateBulkActionBar();
        try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch (err) {}
      });
    }

    bindClick('btn-bulk-return', () => this.executeBulkReturn());
    bindClick('btn-clear-selection', () => {
      this.selectedIds.clear();
      this.renderTableRows();
      this.updateBulkActionBar();
      try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch (err) {}
    });

    bindClick('btn-export-csv', () => this.exportCSV());
    bindClick('btn-print-manifest', () => this.openManifestModal());
    bindClick('btn-close-manifest-modal', () => this.closeManifestModal());
    bindClick('btn-close-manifest', () => this.closeManifestModal());
    bindClick('btn-trigger-print', () => window.print());

    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.style.display = 'none';
        }
      });
    });
  }
}

// Instantiate immediately on DOM readiness or script execution
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.app = new PharmacyExpiryApp();
  });
} else {
  window.app = new PharmacyExpiryApp();
}
