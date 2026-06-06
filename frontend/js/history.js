/* ============================================
   GREENHOUSE DASHBOARD — history.js
   Clean Modular Vanilla JS + Chart.js
   ============================================ */

// ---- Configuration ----
const CONFIG = {
  API_BASE: '/api',               // Flask API base URL
  REFRESH_INTERVAL: 30000,        // Auto refresh every 30s
  PAGE_SIZE: 20,                  // Rows per page
  CHART_ANIMATION_DURATION: 600,
  TOAST_DURATION: 3500,
  DATE_FORMAT: 'id-ID',
};

// ---- App State ----
const state = {
  data: [],
  filteredData: [],
  currentPage: 1,
  totalPages: 1,
  filterRange: 'today',
  filterDateStart: null,
  filterDateEnd: null,
  filterSensor: 'all',
  chartMode: 'realtime',    // realtime | daily | weekly | monthly
  isLoading: false,
  hasError: false,
  refreshTimer: null,
  charts: {},
  fabOpen: false,
};

// ---- DOM Cache ----
const dom = {};

function cacheDom() {
  dom.summaryCards = {
    temp: document.getElementById('summary-temp'),
    soilTemp: document.getElementById('summary-soil-temp'),
    humidity: document.getElementById('summary-humidity'),
    soil: document.getElementById('summary-soil'),
  };
  dom.statusPump = document.getElementById('status-pump');
  dom.statusWeather = document.getElementById('status-weather');
  dom.statusRain = document.getElementById('status-rain');
  dom.filterChips = document.querySelectorAll('.filter-chip');
  dom.dateStart = document.getElementById('filter-date-start');
  dom.dateEnd = document.getElementById('filter-date-end');
  dom.applyDateBtn = document.getElementById('filter-apply-btn');
  dom.sensorSelect = document.getElementById('filter-sensor');
  dom.chartTabs = document.querySelectorAll('.chart-tab');
  dom.chartCanvas = document.getElementById('main-chart');
  dom.chartContainer = document.getElementById('chart-container');
  dom.chartLoading = document.getElementById('chart-loading');
  dom.tableBody = document.getElementById('table-body');
  dom.tableWrapper = document.getElementById('table-wrapper');
  dom.tableLoading = document.getElementById('table-loading');
  dom.tableEmpty = document.getElementById('table-empty');
  dom.tableError = document.getElementById('table-error');
  dom.pagination = document.getElementById('pagination');
  dom.lastUpdated = document.getElementById('last-updated-time');
  dom.refreshBtn = document.getElementById('btn-refresh');
  dom.fab = document.getElementById('fab');
  dom.fabMenu = document.getElementById('fab-menu');
  dom.toastContainer = document.getElementById('toast-container');
  dom.backToTop = document.getElementById('back-to-top');

  // Stats
  dom.statAvgTemp = document.getElementById('stat-avg-temp');
  dom.statAvgSoilTemp = document.getElementById('stat-avg-soil-temp');
  dom.statAvgHumidity = document.getElementById('stat-avg-humidity');
  dom.statAvgSoil = document.getElementById('stat-avg-soil');
  dom.statTotalRecords = document.getElementById('stat-total-records');
  dom.statPumpOnCount = document.getElementById('stat-pump-on');
  dom.statRainCount = document.getElementById('stat-rain-count');
  dom.statLastTime = document.getElementById('stat-last-time');
}

// ---- Initialize ----
document.addEventListener('DOMContentLoaded', () => {
  cacheDom();
  setDefaultDates();
  bindEvents();
  loadData();
  startAutoRefresh();
});

// ---- Date Defaults ----
function setDefaultDates() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;
  dom.dateStart.value = todayStr;
  dom.dateEnd.value = todayStr;
  state.filterDateStart = todayStr;
  state.filterDateEnd = todayStr;
}

// ---- Event Binding ----
function bindEvents() {
  // Quick filter chips
  dom.filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      dom.filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.filterRange = chip.dataset.range;
      setDateRangeFromFilter(state.filterRange);
      state.currentPage = 1;
      loadData();
    });
  });

  // Date apply
  dom.applyDateBtn.addEventListener('click', () => {
    state.filterDateStart = dom.dateStart.value;
    state.filterDateEnd = dom.dateEnd.value;
    // Deactivate quick filter chips
    dom.filterChips.forEach(c => c.classList.remove('active'));
    state.filterRange = 'custom';
    state.currentPage = 1;
    loadData();
  });

  // Sensor filter
  dom.sensorSelect.addEventListener('change', () => {
    state.filterSensor = dom.sensorSelect.value;
    updateChart();
  });

  // Chart tabs
  dom.chartTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      dom.chartTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.chartMode = tab.dataset.mode;
      updateChart();
    });
  });

  // Refresh button
  dom.refreshBtn.addEventListener('click', () => {
    dom.refreshBtn.querySelector('.icon').classList.add('refresh-spin');
    loadData().finally(() => {
      setTimeout(() => {
        dom.refreshBtn.querySelector('.icon').classList.remove('refresh-spin');
      }, 600);
    });
  });

  // FAB
  dom.fab.addEventListener('click', toggleFab);

  // Back to top
  dom.backToTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Scroll listener
  window.addEventListener('scroll', () => {
    if (window.scrollY > 400) {
      dom.backToTop.classList.add('show');
    } else {
      dom.backToTop.classList.remove('show');
    }
  });

  // Close fab menu on outside click
  document.addEventListener('click', (e) => {
    if (state.fabOpen && !dom.fab.contains(e.target) && !dom.fabMenu.contains(e.target)) {
      closeFab();
    }
  });
}

// ---- Date Range Calc ----
function setDateRangeFromFilter(range) {
  const today = new Date();
  let start = new Date(today);

  switch (range) {
    case 'today':
      break;
    case '3days':
      start.setDate(today.getDate() - 2);
      break;
    case '7days':
      start.setDate(today.getDate() - 6);
      break;
    case '30days':
      start.setDate(today.getDate() - 29);
      break;
    default:
      break;
  }

  const fmt = d => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };

  state.filterDateStart = fmt(start);
  state.filterDateEnd = fmt(today);
  dom.dateStart.value = state.filterDateStart;
  dom.dateEnd.value = state.filterDateEnd;
}

// ---- Data Fetching ----
async function loadData() {
  if (state.isLoading) return;

  state.isLoading = true;
  state.hasError = false;
  showLoading(true);

  try {
    const params = new URLSearchParams({
      start: state.filterDateStart,
      end: state.filterDateEnd,
    });

    const response = await fetch(`${CONFIG.API_BASE}/history?${params}`);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const json = await response.json();
    state.data = Array.isArray(json) ? json : (json.data || []);

    processData();
    showToast('Data berhasil dimuat', 'success');
  } catch (err) {
    console.error('Fetch error:', err);
    state.hasError = true;

    // Use demo data in development
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      state.data = generateDemoData();
      processData();
      showToast('Mode demo — menggunakan data contoh', 'info');
    } else {
      showError();
      showToast('Gagal memuat data', 'error');
    }
  } finally {
    state.isLoading = false;
    showLoading(false);
    updateLastUpdated();
  }
}

function processData() {
  state.filteredData = [...state.data];
  updateSummary();
  updateStats();
  updateStatusChips();
  updateChart();
  updateTable();
}

// ---- Demo Data Generator ----
function generateDemoData() {
  const data = [];
  const now = new Date();
  const start = new Date(state.filterDateStart);
  const end = new Date(state.filterDateEnd);
  end.setHours(23, 59, 59);

  const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  const totalRecords = Math.min(diffDays * 48, 500); // ~48 readings/day (every 30min)

  for (let i = 0; i < totalRecords; i++) {
    const t = new Date(start.getTime() + (i / totalRecords) * (end - start));
    const hour = t.getHours();

    // Realistic sensor patterns
    const baseTemp = 26 + 6 * Math.sin((hour - 6) * Math.PI / 12);
    const temp = +(baseTemp + (Math.random() - 0.5) * 3).toFixed(1);
    const baseSoilTemp = 22 + 4 * Math.sin((hour - 8) * Math.PI / 14);
    const soilTemp = +(baseSoilTemp + (Math.random() - 0.5) * 2).toFixed(1);
    const humidity = +(65 + 20 * Math.cos((hour - 14) * Math.PI / 12) + (Math.random() - 0.5) * 8).toFixed(1);
    const soil = +(50 + 15 * Math.sin((hour - 8) * Math.PI / 18) + (Math.random() - 0.5) * 10).toFixed(1);

    data.push({
      id: i + 1,
      timestamp: t.toISOString(),
      temperature: temp,
      soil_temperature: soilTemp,
      humidity: Math.max(30, Math.min(99, humidity)),
      soil_moisture: Math.max(10, Math.min(95, soil)),
      pump_status: soil < 40 ? 1 : 0,
      rain_status: humidity > 80 && Math.random() > 0.6 ? 1 : 0,
      weather: humidity > 80 ? 'Berawan' : (hour >= 6 && hour <= 17 ? 'Cerah' : 'Malam'),
    });
  }

  return data.reverse(); // Newest first
}

// ---- Summary Cards ----
function updateSummary() {
  const d = state.data;
  if (!d.length) {
    ['temp', 'soilTemp', 'humidity', 'soil'].forEach(k => {
      if (dom.summaryCards[k]) {
        dom.summaryCards[k].querySelector('.card-value').innerHTML = '--<span class="unit"></span>';
        dom.summaryCards[k].querySelector('.card-sub').textContent = 'Tidak ada data';
      }
    });
    return;
  }

  const latest = d[0];

  setCardValue(dom.summaryCards.temp, latest.temperature, '°C', `Min ${getMin(d, 'temperature')}° • Max ${getMax(d, 'temperature')}°`);
  setCardValue(dom.summaryCards.soilTemp, latest.soil_temperature, '°C', `Min ${getMin(d, 'soil_temperature')}° • Max ${getMax(d, 'soil_temperature')}°`);
  setCardValue(dom.summaryCards.humidity, latest.humidity, '%', `Min ${getMin(d, 'humidity')}% • Max ${getMax(d, 'humidity')}%`);
  setCardValue(dom.summaryCards.soil, latest.soil_moisture, '%', `Rata-rata ${getAvg(d, 'soil_moisture')}%`);
}

function setCardValue(card, value, unit, sub) {
  if (!card) return;
  card.querySelector('.card-value').innerHTML = `${value}<span class="unit">${unit}</span>`;
  card.querySelector('.card-sub').textContent = sub;
}

// ---- Statistics ----
function updateStats() {
  const d = state.data;
  if (!d.length) return;

  setText(dom.statAvgTemp, getAvg(d, 'temperature') + '°C');
  setText(dom.statAvgSoilTemp, getAvg(d, 'soil_temperature') + '°C');
  setText(dom.statAvgHumidity, getAvg(d, 'humidity') + '%');
  setText(dom.statAvgSoil, getAvg(d, 'soil_moisture') + '%');
  setText(dom.statTotalRecords, d.length + ' data');
  setText(dom.statPumpOnCount, d.filter(r => r.pump_status === 1).length + 'x');
  setText(dom.statRainCount, d.filter(r => r.rain_status === 1).length + 'x');

  const latestTime = new Date(d[0].timestamp);
  setText(dom.statLastTime, latestTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
}

// ---- Status Chips ----
function updateStatusChips() {
  const d = state.data;
  if (!d.length) return;

  const latest = d[0];

  // Pump
  const pumpOn = latest.pump_status === 1;
  dom.statusPump.className = `status-chip ${pumpOn ? 'pump-on' : 'pump-off'}`;
  dom.statusPump.querySelector('.chip-icon').textContent = pumpOn ? '💧' : '🚫';
  dom.statusPump.querySelector('.chip-value').textContent = pumpOn ? 'Aktif' : 'Mati';

  // Weather
  dom.statusWeather.querySelector('.chip-icon').textContent = getWeatherEmoji(latest.weather);
  dom.statusWeather.querySelector('.chip-value').textContent = latest.weather || 'N/A';

  // Rain
  const raining = latest.rain_status === 1;
  dom.statusRain.className = `status-chip ${raining ? 'rain-yes' : 'rain-no'}`;
  dom.statusRain.querySelector('.chip-icon').textContent = raining ? '🌧️' : '☀️';
  dom.statusRain.querySelector('.chip-value').textContent = raining ? 'Hujan' : 'Tidak Hujan';
}

function getWeatherEmoji(weather) {
  if (!weather) return '🌤️';
  const w = weather.toLowerCase();
  if (w.includes('cerah')) return '☀️';
  if (w.includes('berawan')) return '☁️';
  if (w.includes('hujan')) return '🌧️';
  if (w.includes('malam')) return '🌙';
  return '🌤️';
}

// ---- Charts ----
function updateChart() {
  const d = state.data;
  if (!d.length) return;

  showChartLoading(true);

  // Destroy existing chart
  if (state.charts.main) {
    state.charts.main.destroy();
  }

  const ctx = dom.chartCanvas.getContext('2d');
  let chartData;

  switch (state.chartMode) {
    case 'realtime':
      chartData = prepareRealtimeData(d);
      break;
    case 'daily':
      chartData = prepareDailyData(d);
      break;
    case 'weekly':
      chartData = prepareWeeklyData(d);
      break;
    case 'monthly':
      chartData = prepareMonthlyData(d);
      break;
    default:
      chartData = prepareRealtimeData(d);
  }

  const datasets = buildDatasets(chartData);

  state.charts.main = new Chart(ctx, {
    type: 'line',
    data: {
      labels: chartData.labels,
      datasets: datasets,
    },
    options: getChartOptions(),
  });

  setTimeout(() => showChartLoading(false), 300);
}

function prepareRealtimeData(data) {
  const sliced = data.slice(0, 50).reverse();
  return {
    labels: sliced.map(r => {
      const t = new Date(r.timestamp);
      return t.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }),
    temperature: sliced.map(r => r.temperature),
    soil_temperature: sliced.map(r => r.soil_temperature),
    humidity: sliced.map(r => r.humidity),
    soil_moisture: sliced.map(r => r.soil_moisture),
  };
}

function prepareDailyData(data) {
  const grouped = groupBy(data, r => {
    const t = new Date(r.timestamp);
    return `${t.getHours().toString().padStart(2, '0')}:00`;
  });

  const labels = Object.keys(grouped).sort();
  return {
    labels,
    temperature: labels.map(l => avg(grouped[l], 'temperature')),
    soil_temperature: labels.map(l => avg(grouped[l], 'soil_temperature')),
    humidity: labels.map(l => avg(grouped[l], 'humidity')),
    soil_moisture: labels.map(l => avg(grouped[l], 'soil_moisture')),
  };
}

function prepareWeeklyData(data) {
  const grouped = groupBy(data, r => {
    const t = new Date(r.timestamp);
    return t.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' });
  });

  const labels = Object.keys(grouped);
  return {
    labels,
    temperature: labels.map(l => avg(grouped[l], 'temperature')),
    soil_temperature: labels.map(l => avg(grouped[l], 'soil_temperature')),
    humidity: labels.map(l => avg(grouped[l], 'humidity')),
    soil_moisture: labels.map(l => avg(grouped[l], 'soil_moisture')),
  };
}

function prepareMonthlyData(data) {
  const grouped = groupBy(data, r => {
    const t = new Date(r.timestamp);
    return t.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  });

  const labels = Object.keys(grouped);
  return {
    labels,
    temperature: labels.map(l => avg(grouped[l], 'temperature')),
    soil_temperature: labels.map(l => avg(grouped[l], 'soil_temperature')),
    humidity: labels.map(l => avg(grouped[l], 'humidity')),
    soil_moisture: labels.map(l => avg(grouped[l], 'soil_moisture')),
  };
}

function buildDatasets(chartData) {
  const sensor = state.filterSensor;
  const allSets = [
    {
      key: 'temperature',
      label: 'Suhu Udara (°C)',
      borderColor: '#ff5e62',
      backgroundColor: 'rgba(255,94,98,0.08)',
      data: chartData.temperature,
    },
    {
      key: 'soil_temperature',
      label: 'Suhu Tanah (°C)',
      borderColor: '#795548',
      backgroundColor: 'rgba(121,85,72,0.08)',
      data: chartData.soil_temperature,
    },
    {
      key: 'humidity',
      label: 'Kelembapan Udara (%)',
      borderColor: '#3cc5d9',
      backgroundColor: 'rgba(60,197,217,0.08)',
      data: chartData.humidity,
    },
    {
      key: 'soil_moisture',
      label: 'Kelembapan Tanah (%)',
      borderColor: '#34c68a',
      backgroundColor: 'rgba(52,198,138,0.08)',
      data: chartData.soil_moisture,
    },
  ];

  const filtered = sensor === 'all'
    ? allSets
    : allSets.filter(s => s.key === sensor).map(s => ({ ...s, hidden: false }));

  return filtered.map(s => ({
    label: s.label,
    data: s.data,
    borderColor: s.borderColor,
    backgroundColor: s.backgroundColor,
    borderWidth: 2.5,
    pointRadius: 0,
    pointHoverRadius: 5,
    pointHoverBackgroundColor: s.borderColor,
    pointHoverBorderColor: '#fff',
    pointHoverBorderWidth: 2,
    tension: 0.4,
    fill: true,
    hidden: s.hidden || false,
  }));
}

function getChartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: CONFIG.CHART_ANIMATION_DURATION },
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 16,
          font: { family: "'Inter', sans-serif", size: 11, weight: '600' },
          color: '#7a8a9e',
        },
      },
      tooltip: {
        backgroundColor: 'rgba(30,41,59,0.92)',
        titleFont: { family: "'Inter', sans-serif", size: 12, weight: '600' },
        bodyFont: { family: "'Inter', sans-serif", size: 11 },
        padding: 12,
        cornerRadius: 10,
        displayColors: true,
        boxPadding: 4,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          font: { family: "'Inter', sans-serif", size: 10 },
          color: '#a3b1c2',
          maxTicksLimit: 8,
          maxRotation: 0,
        },
        border: { display: false },
      },
      y: {
        grid: {
          color: 'rgba(229,233,239,0.5)',
          drawBorder: false,
        },
        ticks: {
          font: { family: "'Inter', sans-serif", size: 10 },
          color: '#a3b1c2',
          padding: 8,
        },
        border: { display: false },
      },
    },
  };
}

// ---- Table ----
function updateTable() {
  const d = state.data;

  if (state.hasError) {
    dom.tableWrapper.classList.add('hidden');
    dom.tableEmpty.classList.add('hidden');
    dom.tableError.classList.remove('hidden');
    dom.pagination.classList.add('hidden');
    return;
  }

  if (!d.length) {
    dom.tableWrapper.classList.add('hidden');
    dom.tableError.classList.add('hidden');
    dom.tableEmpty.classList.remove('hidden');
    dom.pagination.classList.add('hidden');
    return;
  }

  dom.tableWrapper.classList.remove('hidden');
  dom.tableEmpty.classList.add('hidden');
  dom.tableError.classList.add('hidden');

  // Pagination calc
  state.totalPages = Math.ceil(d.length / CONFIG.PAGE_SIZE);
  const startIdx = (state.currentPage - 1) * CONFIG.PAGE_SIZE;
  const pageData = d.slice(startIdx, startIdx + CONFIG.PAGE_SIZE);

  // Build rows
  dom.tableBody.innerHTML = pageData.map((r, i) => {
    const t = new Date(r.timestamp);
    const dateStr = t.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
    const timeStr = t.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const pumpBadge = r.pump_status === 1
      ? '<span class="badge badge-on">● ON</span>'
      : '<span class="badge badge-off">● OFF</span>';
    const rainBadge = r.rain_status === 1
      ? '<span class="badge badge-rain">🌧 Hujan</span>'
      : '<span class="badge badge-dry">☀ Cerah</span>';

    return `<tr>
      <td>${dateStr}<br><small style="color:var(--color-text-muted)">${timeStr}</small></td>
      <td><strong>${r.temperature}</strong>°C</td>
      <td><strong>${parseFloat(r.soil_temperature).toFixed(1)}</strong>°C</td>
      <td>${r.humidity}%</td>
      <td>${r.soil_moisture}%</td>
      <td>${pumpBadge}</td>
      <td>${rainBadge}</td>
    </tr>`;
  }).join('');

  renderPagination();
}

function renderPagination() {
  if (state.totalPages <= 1) {
    dom.pagination.classList.add('hidden');
    return;
  }

  dom.pagination.classList.remove('hidden');

  let html = '';

  // Prev button
  html += `<button class="page-btn" ${state.currentPage === 1 ? 'disabled' : ''} onclick="goPage(${state.currentPage - 1})">‹</button>`;

  // Page numbers
  const maxVisible = 5;
  let startPage = Math.max(1, state.currentPage - Math.floor(maxVisible / 2));
  let endPage = Math.min(state.totalPages, startPage + maxVisible - 1);
  if (endPage - startPage < maxVisible - 1) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  if (startPage > 1) {
    html += `<button class="page-btn" onclick="goPage(1)">1</button>`;
    if (startPage > 2) html += `<span class="page-info">…</span>`;
  }

  for (let p = startPage; p <= endPage; p++) {
    html += `<button class="page-btn ${p === state.currentPage ? 'active' : ''}" onclick="goPage(${p})">${p}</button>`;
  }

  if (endPage < state.totalPages) {
    if (endPage < state.totalPages - 1) html += `<span class="page-info">…</span>`;
    html += `<button class="page-btn" onclick="goPage(${state.totalPages})">${state.totalPages}</button>`;
  }

  // Next button
  html += `<button class="page-btn" ${state.currentPage === state.totalPages ? 'disabled' : ''} onclick="goPage(${state.currentPage + 1})">›</button>`;

  // Info
  html += `<span class="page-info">${state.currentPage}/${state.totalPages}</span>`;

  dom.pagination.innerHTML = html;
}

// Global for inline onclick
window.goPage = function(p) {
  if (p < 1 || p > state.totalPages) return;
  state.currentPage = p;
  updateTable();
  // Scroll to table
  dom.tableWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// ---- Loading & States ----
function showLoading(show) {
  if (show) {
    dom.tableLoading?.classList.add('show');
    dom.chartLoading?.classList.add('show');
  } else {
    dom.tableLoading?.classList.remove('show');
    dom.chartLoading?.classList.remove('show');
  }
}

function showChartLoading(show) {
  if (show) dom.chartLoading?.classList.add('show');
  else dom.chartLoading?.classList.remove('show');
}

function showError() {
  dom.tableWrapper?.classList.add('hidden');
  dom.tableEmpty?.classList.add('hidden');
  dom.tableError?.classList.remove('hidden');
}

// ---- Auto Refresh ----
function startAutoRefresh() {
  stopAutoRefresh();
  state.refreshTimer = setInterval(() => {
    loadData();
  }, CONFIG.REFRESH_INTERVAL);
}

function stopAutoRefresh() {
  if (state.refreshTimer) {
    clearInterval(state.refreshTimer);
    state.refreshTimer = null;
  }
}

// ---- Last Updated ----
function updateLastUpdated() {
  const now = new Date();
  dom.lastUpdated.textContent = now.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// ---- FAB ----
function toggleFab() {
  state.fabOpen = !state.fabOpen;
  dom.fabMenu.classList.toggle('open', state.fabOpen);
  dom.fab.innerHTML = state.fabOpen ? '✕' : '☰';
}

function closeFab() {
  state.fabOpen = false;
  dom.fabMenu.classList.remove('open');
  dom.fab.innerHTML = '☰';
}

// FAB Actions (global)
window.fabScrollTop = function() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
  closeFab();
};

window.fabRefresh = function() {
  closeFab();
  dom.refreshBtn.click();
};

window.fabExport = function() {
  closeFab();
  exportCSV();
};

// ---- Export CSV ----
function exportCSV() {
  if (!state.data.length) {
    showToast('Tidak ada data untuk diekspor', 'error');
    return;
  }

  const headers = ['Tanggal', 'Waktu', 'Suhu Udara (°C)', 'Suhu Tanah (°C)', 'Kelembapan Udara (%)', 'Kelembapan Tanah (%)', 'Pompa', 'Hujan'];
  const rows = state.data.map(r => {
    const t = new Date(r.timestamp);
    return [
      t.toLocaleDateString('id-ID'),
      t.toLocaleTimeString('id-ID'),
      r.temperature,
      r.soil_temperature,
      r.humidity,
      r.soil_moisture,
      r.pump_status ? 'ON' : 'OFF',
      r.rain_status ? 'Hujan' : 'Cerah',
    ].join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `greenhouse_history_${state.filterDateStart}_${state.filterDateEnd}.csv`;
  a.click();
  URL.revokeObjectURL(url);

  showToast('Data berhasil diekspor ke CSV', 'success');
}

// ---- Toast ----
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icons = { success: '✓', error: '✗', info: 'ℹ' };
  toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span> ${message}`;

  dom.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => toast.remove(), 300);
  }, CONFIG.TOAST_DURATION);
}

// ---- Utility Functions ----
function getMin(arr, key) {
  return Math.min(...arr.map(r => r[key])).toFixed(1);
}

function getMax(arr, key) {
  return Math.max(...arr.map(r => r[key])).toFixed(1);
}

function getAvg(arr, key) {
  if (!arr.length) return '0';
  const sum = arr.reduce((a, r) => a + (r[key] || 0), 0);
  return (sum / arr.length).toFixed(1);
}

function avg(arr, key) {
  if (!arr.length) return 0;
  return +(arr.reduce((a, r) => a + (r[key] || 0), 0) / arr.length).toFixed(1);
}

function groupBy(arr, fn) {
  return arr.reduce((acc, item) => {
    const key = fn(item);
    (acc[key] = acc[key] || []).push(item);
    return acc;
  }, {});
}

function setText(el, text) {
  if (el) el.textContent = text;
}

// Retry function for error state
window.retryLoad = function() {
  loadData();
};
