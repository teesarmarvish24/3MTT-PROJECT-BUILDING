// ---------- State ----------
const state = {
  token: localStorage.getItem('wp_token'),
  user: JSON.parse(localStorage.getItem('wp_user') || 'null'),
  pickups: [],
  allPickups: [],
  locations: [],
  view: 'dashboard',
  calendarMonth: startOfMonth(new Date()),
  theme: localStorage.getItem('wp_theme') || 'light',
};

let currentPickupId = null;
let selectedRating = 0;
let feedbackPickupId = null;
let selectedCalendarDate = null;

// ---------- Icons ----------
const ICONS = {
  mapPin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s7-7.58 7-12.5A7 7 0 0 0 5 9.5C5 14.42 12 22 12 22Z"/><circle cx="12" cy="9.5" r="2.3"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg>',
  repeat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h13l-3-3M20 17H7l3 3"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>',
  checkCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/></svg>',
  alertTriangle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5 21.5 20h-19L12 3.5Z"/><path d="M12 10v4M12 17h.01"/></svg>',
  xCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5l5 5M14.5 9.5l-5 5"/></svg>',
  leaf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 4C10 4 4 10 4 18c8 0 14-6 14-14Z"/><path d="M6 18c3-3 8-8 12-12"/></svg>',
  recycle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 0 1 13.9-5.4M20 12a8 8 0 0 1-13.9 5.4"/><path d="M16 4.5v3h-3M8 19.5v-3h3"/></svg>',
  bin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M7 7l1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13"/></svg>',
  pencil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l1-4.2L15.5 5.3a1.5 1.5 0 0 1 2.1 0l1.1 1.1a1.5 1.5 0 0 1 0 2.1L8.2 19 4 20Z"/></svg>',
};

const WASTE_ICONS = { general: ICONS.bin, recyclable: ICONS.recycle, organic: ICONS.leaf, hazardous: ICONS.alertTriangle };
const WASTE_COLOR_VARS = { general: '--muted', recyclable: '--info', organic: '--primary', hazardous: '--danger' };
const STATUS_COLOR_VARS = { scheduled: '--info', collected: '--primary', missed: '--danger', cancelled: '--muted' };

function icon(name) {
  return `<span class="icon">${ICONS[name]}</span>`;
}

// ---------- Helpers ----------
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatDateLong(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function toIsoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function $(id) {
  return document.getElementById(id);
}

function showModal(id) {
  $(id).classList.remove('hidden');
}

function hideModal(id) {
  $(id).classList.add('hidden');
}

let toastTimer;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3500);
}

// ---------- API ----------
async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (res.status === 401 && state.token) {
    logout();
    throw new Error('Session expired. Please log in again.');
  }
  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

// ---------- Auth ----------
function saveSession(data) {
  state.token = data.token;
  state.user = data.user;
  localStorage.setItem('wp_token', data.token);
  localStorage.setItem('wp_user', JSON.stringify(data.user));
}

function showApp() {
  $('auth-screen').classList.add('hidden');
  $('app-screen').classList.remove('hidden');
}

function showAuth() {
  $('app-screen').classList.add('hidden');
  $('auth-screen').classList.remove('hidden');
}

function logout() {
  state.token = null;
  state.user = null;
  state.pickups = [];
  state.allPickups = [];
  state.locations = [];
  localStorage.removeItem('wp_token');
  localStorage.removeItem('wp_user');
  showAuth();
}

function switchAuthTab(which) {
  $('auth-error').classList.add('hidden');
  $('tab-login').classList.toggle('active', which === 'login');
  $('tab-register').classList.toggle('active', which === 'register');
  $('login-form').classList.toggle('hidden', which !== 'login');
  $('register-form').classList.toggle('hidden', which !== 'register');
}

$('tab-login').addEventListener('click', () => switchAuthTab('login'));
$('tab-register').addEventListener('click', () => switchAuthTab('register'));

$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  try {
    saveSession(await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
    }));
    e.target.reset();
    await initApp();
  } catch (err) {
    showAuthError(err.message);
  }
});

$('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  try {
    saveSession(await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: form.get('name'),
        email: form.get('email'),
        password: form.get('password'),
        address: form.get('address'),
      }),
    }));
    e.target.reset();
    await initApp();
  } catch (err) {
    showAuthError(err.message);
  }
});

function showAuthError(msg) {
  const el = $('auth-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

$('logout-btn').addEventListener('click', logout);

// ---------- Theme ----------
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

$('theme-toggle').addEventListener('click', () => {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('wp_theme', state.theme);
  applyTheme(state.theme);
});

// ---------- Dropdowns ----------
function closeAllDropdowns() {
  document.querySelectorAll('.dropdown').forEach((d) => d.classList.add('hidden'));
}

function wireDropdown(btnId, dropdownId) {
  const btn = $(btnId);
  const dropdown = $(dropdownId);
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const wasOpen = !dropdown.classList.contains('hidden');
    closeAllDropdowns();
    if (!wasOpen) dropdown.classList.remove('hidden');
  });
  dropdown.addEventListener('click', (e) => e.stopPropagation());
}

wireDropdown('notif-btn', 'notif-dropdown');
wireDropdown('user-menu-btn', 'user-dropdown');
document.addEventListener('click', closeAllDropdowns);

// ---------- Sidebar (mobile) ----------
$('sidebar-toggle').addEventListener('click', () => {
  $('sidebar').classList.toggle('open');
});

// ---------- Avatar ----------
function renderAvatar() {
  const initial = (state.user.name || '?').trim().charAt(0).toUpperCase();
  $('user-menu-btn').textContent = initial || '?';
  $('user-dropdown-name').textContent = state.user.name;
}

// ---------- View routing ----------
const VIEW_TITLES = { dashboard: 'Dashboard', pickups: 'Your Pickups', calendar: 'Calendar', analytics: 'Analytics', settings: 'Settings' };

function updateViewVisibility() {
  Object.keys(VIEW_TITLES).forEach((v) => {
    $(`${v}-view`).classList.toggle('hidden', state.view !== v);
  });
  $('view-title').textContent = VIEW_TITLES[state.view];
}

async function switchView(view) {
  state.view = view;
  document.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  updateViewVisibility();
  $('sidebar').classList.remove('open');
  await loadViewData(view);
  renderReminders(lastReminderList);
}

async function loadViewData(view) {
  if (view === 'dashboard') {
    await loadAllPickups();
    renderDashboard();
  } else if (view === 'pickups') {
    await loadPickups();
  } else if (view === 'calendar') {
    await loadAllPickups();
    renderCalendar();
  } else if (view === 'analytics') {
    await loadAnalytics();
  }
}

document.querySelectorAll('.nav-item').forEach((btn) => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});
document.querySelectorAll('.link-btn[data-goto]').forEach((btn) => {
  btn.addEventListener('click', () => switchView(btn.dataset.goto));
});

async function afterPickupChange() {
  if (state.view === 'pickups') await loadPickups();
  if (state.view === 'dashboard') {
    await loadAllPickups();
    renderDashboard();
  }
  if (state.view === 'calendar') {
    await loadAllPickups();
    renderCalendar();
    if (selectedCalendarDate && !$('calendar-day-panel').classList.contains('hidden')) {
      renderCalendarDayPanel(selectedCalendarDate);
    }
  }
  if (state.view === 'analytics') await loadAnalytics();
  await loadReminders();
}

// ---------- Locations ----------
async function loadLocations() {
  state.locations = await api('/locations');
  renderLocationList();
}

function renderLocationList() {
  if (state.locations.length === 0) {
    $('location-list').innerHTML = '<li class="hint-text">No saved locations.</li>';
    return;
  }
  $('location-list').innerHTML = state.locations
    .map(
      (loc) => `<li class="side-item" data-id="${loc.id}" title="${escapeHtml(loc.address)}">
        <span class="icon">${ICONS.mapPin}</span>
        <span class="side-item-label">${escapeHtml(loc.label)}</span>
        <button class="side-item-delete" data-id="${loc.id}" title="Delete location" type="button">×</button>
      </li>`
    )
    .join('');
}

$('location-list').addEventListener('click', (e) => {
  const delBtn = e.target.closest('.side-item-delete');
  if (delBtn) {
    e.stopPropagation();
    deleteLocation(delBtn.dataset.id);
    return;
  }
  const item = e.target.closest('.side-item');
  if (!item) return;
  const loc = state.locations.find((l) => String(l.id) === item.dataset.id);
  if (loc) openPickupModal(null, { prefillAddress: loc.address });
});

async function deleteLocation(id) {
  if (!confirm('Delete this saved location?')) return;
  try {
    await api(`/locations/${id}`, { method: 'DELETE' });
    await loadLocations();
  } catch (err) {
    alert(err.message);
  }
}

$('new-location-btn').addEventListener('click', () => {
  $('location-form').reset();
  $('location-modal-error').classList.add('hidden');
  showModal('location-modal');
});
['location-modal-close', 'location-modal-cancel'].forEach((id) => $(id).addEventListener('click', () => hideModal('location-modal')));
$('location-modal').addEventListener('click', (e) => {
  if (e.target.id === 'location-modal') hideModal('location-modal');
});
$('location-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  try {
    await api('/locations', {
      method: 'POST',
      body: JSON.stringify({ label: form.elements.label.value, address: form.elements.address.value }),
    });
    hideModal('location-modal');
    await loadLocations();
  } catch (err) {
    const p = $('location-modal-error');
    p.textContent = err.message;
    p.classList.remove('hidden');
  }
});

function renderLocationQuickPicks() {
  const el = $('location-quick-picks');
  if (state.locations.length === 0) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = state.locations
    .map((loc) => `<button type="button" class="location-chip" data-address="${escapeHtml(loc.address)}">${escapeHtml(loc.label)}</button>`)
    .join('');
}

$('location-quick-picks').addEventListener('click', (e) => {
  const chip = e.target.closest('.location-chip');
  if (!chip) return;
  $('pickup-form').elements.address.value = chip.dataset.address;
});

// ---------- Pickups (list view) ----------
function buildQuery() {
  const params = new URLSearchParams();
  const status = $('filter-status').value;
  const wasteType = $('filter-waste-type').value;
  const search = $('search-input').value.trim();
  if (status) params.set('status', status);
  if (wasteType) params.set('waste_type', wasteType);
  if (search) params.set('search', search);
  return params;
}

async function loadPickups() {
  try {
    state.pickups = await api(`/pickups?${buildQuery()}`);
    renderPickups();
    renderStats();
  } catch (err) {
    console.error(err);
  }
}

async function loadAllPickups() {
  try {
    state.allPickups = await api('/pickups');
  } catch (err) {
    console.error(err);
  }
}

function renderStats() {
  const total = state.pickups.length;
  const scheduled = state.pickups.filter((p) => p.status === 'scheduled').length;
  const collected = state.pickups.filter((p) => p.status === 'collected').length;
  const missed = state.pickups.filter((p) => p.status === 'missed').length;

  $('stats').innerHTML = `
    <div class="stat-card"><div class="num">${total}</div><div class="lbl">Total pickups</div></div>
    <div class="stat-card"><div class="num">${scheduled}</div><div class="lbl">Scheduled</div></div>
    <div class="stat-card"><div class="num">${collected}</div><div class="lbl">Collected</div></div>
    <div class="stat-card"><div class="num">${missed}</div><div class="lbl">Missed</div></div>
  `;
}

const RECURRENCE_LABELS = { weekly: 'Weekly', biweekly: 'Every 2 weeks', monthly: 'Monthly' };
const TIME_WINDOW_LABELS = { morning: 'Morning (8am–12pm)', afternoon: 'Afternoon (12pm–4pm)', evening: 'Evening (4pm–8pm)' };

function pickupCardHtml(p) {
  const today = todayStr();
  const overdueScheduled = p.status === 'scheduled' && p.scheduled_date < today;
  const statusKey = overdueScheduled ? 'overdue' : p.status;
  const statusLabel = overdueScheduled ? 'Awaiting confirmation' : capitalize(p.status);

  let actionsHtml = '';
  if (p.status === 'scheduled') {
    actionsHtml = `
      <button class="btn btn-sm btn-primary" data-action="collected">${icon('checkCircle')} Mark collected</button>
      <button class="btn btn-sm btn-outline" data-action="missed">${icon('alertTriangle')} Report missed</button>
      <button class="btn btn-sm btn-ghost" data-action="edit">${icon('pencil')} Edit</button>
      <button class="btn btn-sm btn-danger-outline" data-action="cancel">Cancel</button>
    `;
  } else if (p.status === 'cancelled') {
    actionsHtml = `<button class="btn btn-sm btn-danger-outline" data-action="delete">${icon('bin')} Delete</button>`;
  } else if (['collected', 'missed'].includes(p.status) && p.feedback_rating === null) {
    actionsHtml = `<button class="btn btn-sm btn-outline" data-action="feedback">Leave feedback</button>
      <button class="btn btn-sm btn-danger-outline" data-action="delete">${icon('bin')} Delete</button>`;
  } else {
    actionsHtml = `<button class="btn btn-sm btn-danger-outline" data-action="delete">${icon('bin')} Delete</button>`;
  }

  const feedbackHtml =
    p.feedback_rating !== null
      ? `<div class="feedback-display">
          <span class="feedback-stars">${'★'.repeat(p.feedback_rating)}${'☆'.repeat(5 - p.feedback_rating)}</span>
          ${p.feedback_comment ? `<div class="feedback-comment">${escapeHtml(p.feedback_comment)}</div>` : ''}
        </div>`
      : '';

  return `
    <li class="pickup-card" data-id="${p.id}">
      <div class="waste-icon-chip waste-${p.waste_type}"><span class="icon">${WASTE_ICONS[p.waste_type]}</span></div>
      <div class="pickup-body">
        <div class="pickup-top">
          <div>
            <div class="pickup-title">${escapeHtml(p.waste_type)} waste pickup</div>
            <div class="pickup-address">${icon('mapPin')} ${escapeHtml(p.address)}</div>
          </div>
          <span class="status-pill status-${statusKey}">${statusLabel}</span>
        </div>
        ${p.notes ? `<div class="pickup-notes">${escapeHtml(p.notes)}</div>` : ''}
        <div class="pickup-meta">
          <span class="badge">${icon('calendar')} ${formatDate(p.scheduled_date)}</span>
          <span class="badge">${TIME_WINDOW_LABELS[p.time_window]}</span>
          ${p.recurrence !== 'none' ? `<span class="badge">${icon('repeat')} ${RECURRENCE_LABELS[p.recurrence]}</span>` : ''}
        </div>
        <div class="pickup-actions">${actionsHtml}</div>
        ${feedbackHtml}
      </div>
    </li>
  `;
}

function renderPickups() {
  $('empty-state').classList.toggle('hidden', state.pickups.length > 0);
  $('pickup-list').innerHTML = state.pickups.map(pickupCardHtml).join('');
  attachCardHandlers($('pickup-list'));
}

function attachCardHandlers(container) {
  container.querySelectorAll('.pickup-card').forEach((card) => {
    const id = card.dataset.id;
    card.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => handleCardAction(id, btn.dataset.action));
    });
  });
}

async function handleCardAction(id, action) {
  if (action === 'edit') return openPickupModal(id);
  if (action === 'feedback') return openFeedbackModal(id);

  if (action === 'collected' || action === 'missed') {
    try {
      const result = await api(`/pickups/${id}`, { method: 'PUT', body: JSON.stringify({ status: action }) });
      await afterPickupChange();
      if (result.next_pickup) {
        toast(`Next pickup automatically scheduled for ${formatDate(result.next_pickup.scheduled_date)}.`);
      } else {
        toast(action === 'collected' ? 'Pickup marked as collected.' : 'Pickup marked as missed.');
      }
    } catch (err) {
      alert(err.message);
    }
    return;
  }

  if (action === 'cancel') {
    if (!confirm('Cancel this pickup?')) return;
    try {
      await api(`/pickups/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'cancelled' }) });
      await afterPickupChange();
    } catch (err) {
      alert(err.message);
    }
    return;
  }

  if (action === 'delete') {
    if (!confirm('Delete this pickup permanently?')) return;
    try {
      await api(`/pickups/${id}`, { method: 'DELETE' });
      await afterPickupChange();
    } catch (err) {
      alert(err.message);
    }
  }
}

$('filter-status').addEventListener('change', loadPickups);
$('filter-waste-type').addEventListener('change', loadPickups);
$('search-input').addEventListener('input', () => {
  clearTimeout(window.__wpSearchTimer);
  window.__wpSearchTimer = setTimeout(loadPickups, 300);
});

// ---------- Pickup modal ----------
function clearModalError() {
  $('modal-error').classList.add('hidden');
}

function showModalError(msg) {
  const el = $('modal-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

async function openPickupModal(id, opts = {}) {
  clearModalError();
  const form = $('pickup-form');
  form.reset();
  currentPickupId = id || null;
  renderLocationQuickPicks();

  if (!id) {
    $('modal-title').textContent = 'Schedule a pickup';
    form.elements.id.value = '';
    form.elements.address.value = opts.prefillAddress || state.user.address || '';
    form.elements.scheduled_date.value = opts.prefillDate || '';
    form.elements.scheduled_date.min = todayStr();
    showModal('pickup-modal');
    form.elements.waste_type.focus();
    return;
  }

  try {
    const pickup = await api(`/pickups/${id}`);
    $('modal-title').textContent = 'Edit pickup';
    form.elements.id.value = pickup.id;
    form.elements.waste_type.value = pickup.waste_type;
    form.elements.address.value = pickup.address;
    form.elements.scheduled_date.value = pickup.scheduled_date;
    form.elements.time_window.value = pickup.time_window;
    form.elements.recurrence.value = pickup.recurrence;
    form.elements.notes.value = pickup.notes || '';
    showModal('pickup-modal');
  } catch (err) {
    alert(err.message);
  }
}

function closePickupModal() {
  hideModal('pickup-modal');
  currentPickupId = null;
}

$('new-pickup-btn').addEventListener('click', () => openPickupModal(null));
$('dashboard-schedule-btn').addEventListener('click', () => openPickupModal(null));
$('modal-close').addEventListener('click', closePickupModal);
$('modal-cancel').addEventListener('click', closePickupModal);
$('pickup-modal').addEventListener('click', (e) => {
  if (e.target.id === 'pickup-modal') closePickupModal();
});

$('pickup-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const id = form.elements.id.value;
  const payload = {
    waste_type: form.elements.waste_type.value,
    address: form.elements.address.value,
    scheduled_date: form.elements.scheduled_date.value,
    time_window: form.elements.time_window.value,
    recurrence: form.elements.recurrence.value,
    notes: form.elements.notes.value,
  };

  try {
    if (id) {
      await api(`/pickups/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      toast('Pickup updated.');
    } else {
      await api('/pickups', { method: 'POST', body: JSON.stringify(payload) });
      toast('Pickup scheduled.');
    }
    closePickupModal();
    await afterPickupChange();
  } catch (err) {
    showModalError(err.message);
  }
});

// ---------- Feedback modal ----------
function setRating(value) {
  selectedRating = value;
  document.querySelectorAll('#star-picker .star').forEach((star) => {
    star.classList.toggle('active', Number(star.dataset.value) <= value);
  });
  $('feedback-form').elements.rating.value = value;
}

document.querySelectorAll('#star-picker .star').forEach((star) => {
  star.addEventListener('click', () => setRating(Number(star.dataset.value)));
});

function openFeedbackModal(id) {
  feedbackPickupId = id;
  $('feedback-form').reset();
  $('feedback-error').classList.add('hidden');
  setRating(0);
  showModal('feedback-modal');
}

function closeFeedbackModal() {
  hideModal('feedback-modal');
  feedbackPickupId = null;
}

$('feedback-modal-close').addEventListener('click', closeFeedbackModal);
$('feedback-modal-cancel').addEventListener('click', closeFeedbackModal);
$('feedback-modal').addEventListener('click', (e) => {
  if (e.target.id === 'feedback-modal') closeFeedbackModal();
});

$('feedback-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!feedbackPickupId) return;
  if (!selectedRating) {
    const el = $('feedback-error');
    el.textContent = 'Please select a star rating.';
    el.classList.remove('hidden');
    return;
  }
  const form = e.target;
  try {
    await api(`/pickups/${feedbackPickupId}/feedback`, {
      method: 'POST',
      body: JSON.stringify({ rating: selectedRating, comment: form.elements.comment.value }),
    });
    closeFeedbackModal();
    toast('Thanks for your feedback!');
    await afterPickupChange();
  } catch (err) {
    const el = $('feedback-error');
    el.textContent = err.message;
    el.classList.remove('hidden');
  }
});

// ---------- Reminders ----------
let lastReminderList = [];

async function loadReminders() {
  try {
    lastReminderList = await api('/pickups?due_soon=1');
    renderReminders(lastReminderList);
  } catch (err) {
    console.error(err);
  }
}

function renderReminders(list) {
  const badge = $('notif-badge');
  badge.textContent = list.length;
  badge.classList.toggle('hidden', list.length === 0);

  const banner = $('reminder-banner');
  const showBanner = list.length > 0 && ['dashboard', 'pickups'].includes(state.view);
  if (!showBanner) {
    banner.classList.add('hidden');
  } else {
    banner.classList.remove('hidden');
    $('reminder-text').textContent =
      list.length === 1
        ? `You have 1 pickup coming up: ${list[0].waste_type} waste on ${formatDate(list[0].scheduled_date)}.`
        : `You have ${list.length} pickups coming up in the next 2 days.`;
  }

  if (list.length === 0) {
    $('notif-list').innerHTML = '<li class="hint-text">No pickups due soon.</li>';
    return;
  }
  $('notif-list').innerHTML = list
    .map(
      (p) => `<li class="notif-item">
        <strong>${escapeHtml(capitalize(p.waste_type))}</strong> — ${formatDate(p.scheduled_date)} (${TIME_WINDOW_LABELS[p.time_window]})
      </li>`
    )
    .join('');
}

// ---------- Dashboard ----------
function greetingWord() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function renderDashboard() {
  const firstName = (state.user.name || '').trim().split(' ')[0];
  $('greeting-text').textContent = `${greetingWord()}, ${firstName}`;
  $('greeting-date').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  const total = state.allPickups.length;
  const scheduled = state.allPickups.filter((p) => p.status === 'scheduled').length;
  const collected = state.allPickups.filter((p) => p.status === 'collected').length;
  const missed = state.allPickups.filter((p) => p.status === 'missed').length;

  $('dashboard-stats').innerHTML = `
    <div class="stat-card"><div class="num">${total}</div><div class="lbl">Total pickups</div></div>
    <div class="stat-card"><div class="num">${scheduled}</div><div class="lbl">Scheduled</div></div>
    <div class="stat-card"><div class="num">${collected}</div><div class="lbl">Collected</div></div>
    <div class="stat-card"><div class="num">${missed}</div><div class="lbl">Missed</div></div>
  `;

  const upcoming = state.allPickups
    .filter((p) => p.status === 'scheduled')
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
    .slice(0, 5);
  $('upcoming-empty').classList.toggle('hidden', upcoming.length > 0);
  $('upcoming-list').innerHTML = upcoming
    .map(
      (p) => `<li class="mini-item">
        <span class="waste-icon-chip small waste-${p.waste_type}"><span class="icon">${WASTE_ICONS[p.waste_type]}</span></span>
        <div class="mini-item-body">
          <div class="mini-item-title">${escapeHtml(capitalize(p.waste_type))} · ${escapeHtml(p.address)}</div>
          <div class="mini-item-sub">${formatDate(p.scheduled_date)} · ${TIME_WINDOW_LABELS[p.time_window]}</div>
        </div>
      </li>`
    )
    .join('');

  const feedbackItems = state.allPickups
    .filter((p) => p.feedback_rating !== null)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 5);
  $('feedback-empty').classList.toggle('hidden', feedbackItems.length > 0);
  $('recent-feedback-list').innerHTML = feedbackItems
    .map(
      (p) => `<li class="mini-item">
        <div class="mini-item-body">
          <div class="mini-item-title"><span class="feedback-stars">${'★'.repeat(p.feedback_rating)}${'☆'.repeat(5 - p.feedback_rating)}</span> ${escapeHtml(capitalize(p.waste_type))}</div>
          ${p.feedback_comment ? `<div class="mini-item-sub">${escapeHtml(p.feedback_comment)}</div>` : ''}
        </div>
      </li>`
    )
    .join('');
}

// ---------- Calendar ----------
function renderCalendar() {
  const month = state.calendarMonth;
  $('cal-month-label').textContent = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const year = month.getFullYear();
  const mo = month.getMonth();
  const startOffset = new Date(year, mo, 1).getDay();
  const daysInMonth = new Date(year, mo + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, mo, 0).getDate();

  const pickupsByDate = new Map();
  for (const p of state.allPickups) {
    if (p.status === 'cancelled') continue;
    if (!pickupsByDate.has(p.scheduled_date)) pickupsByDate.set(p.scheduled_date, []);
    pickupsByDate.get(p.scheduled_date).push(p);
  }

  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  const cells = [];
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startOffset + 1;
    let cellDate;
    let inMonth;
    if (dayNum < 1) {
      cellDate = new Date(year, mo - 1, daysInPrevMonth + dayNum);
      inMonth = false;
    } else if (dayNum > daysInMonth) {
      cellDate = new Date(year, mo + 1, dayNum - daysInMonth);
      inMonth = false;
    } else {
      cellDate = new Date(year, mo, dayNum);
      inMonth = true;
    }
    const iso = toIsoDate(cellDate);
    const dayPickups = pickupsByDate.get(iso) || [];
    const isToday = iso === todayStr();
    cells.push(`
      <button type="button" class="cal-cell ${inMonth ? '' : 'cal-cell-out'} ${isToday ? 'cal-cell-today' : ''}" data-date="${iso}">
        <span class="cal-cell-num">${cellDate.getDate()}</span>
        ${dayPickups.length ? `<span class="cal-cell-dots">${dayPickups.slice(0, 4).map((p) => `<span class="cal-dot waste-${p.waste_type}"></span>`).join('')}</span>` : ''}
      </button>
    `);
  }
  $('calendar-grid').innerHTML = cells.join('');
  $('calendar-grid').querySelectorAll('.cal-cell').forEach((cell) => {
    cell.addEventListener('click', () => onCalendarDayClick(cell.dataset.date));
  });
}

function renderCalendarDayPanel(iso) {
  const dayPickups = state.allPickups.filter((p) => p.scheduled_date === iso && p.status !== 'cancelled');
  $('calendar-day-title').textContent = formatDateLong(iso);
  if (dayPickups.length === 0) {
    $('calendar-day-list').innerHTML = '<li class="hint-text">No pickups scheduled.</li>';
  } else {
    $('calendar-day-list').innerHTML = dayPickups.map(pickupCardHtml).join('');
    attachCardHandlers($('calendar-day-list'));
  }
}

function onCalendarDayClick(iso) {
  const dayPickups = state.allPickups.filter((p) => p.scheduled_date === iso && p.status !== 'cancelled');
  if (dayPickups.length === 0) {
    openPickupModal(null, { prefillDate: iso });
    return;
  }
  selectedCalendarDate = iso;
  renderCalendarDayPanel(iso);
  $('calendar-day-panel').classList.remove('hidden');
}

$('calendar-day-close').addEventListener('click', () => {
  $('calendar-day-panel').classList.add('hidden');
  selectedCalendarDate = null;
});

$('cal-prev').addEventListener('click', () => {
  state.calendarMonth = new Date(state.calendarMonth.getFullYear(), state.calendarMonth.getMonth() - 1, 1);
  $('calendar-day-panel').classList.add('hidden');
  selectedCalendarDate = null;
  renderCalendar();
});
$('cal-next').addEventListener('click', () => {
  state.calendarMonth = new Date(state.calendarMonth.getFullYear(), state.calendarMonth.getMonth() + 1, 1);
  $('calendar-day-panel').classList.add('hidden');
  selectedCalendarDate = null;
  renderCalendar();
});
$('cal-today').addEventListener('click', () => {
  state.calendarMonth = startOfMonth(new Date());
  $('calendar-day-panel').classList.add('hidden');
  selectedCalendarDate = null;
  renderCalendar();
});

// ---------- Analytics ----------
async function loadAnalytics() {
  try {
    renderAnalytics(await api('/analytics'));
  } catch (err) {
    console.error(err);
  }
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function renderAnalytics(data) {
  $('analytics-tiles').innerHTML = `
    <div class="stat-card"><div class="num">${data.total}</div><div class="lbl">Total pickups</div></div>
    <div class="stat-card"><div class="num">${data.completionRate}%</div><div class="lbl">Completion rate</div></div>
    <div class="stat-card"><div class="num">${data.avgRating || '—'}</div><div class="lbl">Average rating (${data.ratingCount})</div></div>
    <div class="stat-card"><div class="num">${data.missed}</div><div class="lbl">Missed pickups</div></div>
  `;

  const statusOrder = ['scheduled', 'collected', 'missed', 'cancelled'];
  const statusColors = Object.fromEntries(statusOrder.map((s) => [s, cssVar(STATUS_COLOR_VARS[s])]));
  const statusData = statusOrder.map((s) => ({
    label: s,
    count: (data.byStatus.find((r) => r.status === s) || { count: 0 }).count,
  }));
  $('chart-status').innerHTML = Charts.donutChart(statusData, statusColors);
  $('legend-status').innerHTML = statusData
    .map((d) => `<div class="legend-item"><span class="dot" style="background:${statusColors[d.label]}"></span>${capitalize(d.label)} (${d.count})</div>`)
    .join('');

  const wasteOrder = ['general', 'recyclable', 'organic', 'hazardous'];
  const wasteColors = Object.fromEntries(wasteOrder.map((w) => [w, cssVar(WASTE_COLOR_VARS[w])]));
  const wasteData = wasteOrder.map((w) => ({
    label: w,
    count: (data.byWasteType.find((r) => r.waste_type === w) || { count: 0 }).count,
  }));
  $('chart-waste').innerHTML = Charts.barChart(wasteData, wasteColors);

  $('chart-trend').innerHTML = Charts.lineChart(data.trend);

  const ratingData = [1, 2, 3, 4, 5].map((r) => ({
    label: String(r),
    count: (data.ratingBreakdown.find((row) => row.rating === r) || { count: 0 }).count,
  }));
  const ratingColors = Object.fromEntries(ratingData.map((d) => [d.label, cssVar('--warning')]));
  $('chart-ratings').innerHTML = Charts.barChart(ratingData, ratingColors);
}

// ---------- Settings ----------
$('settings-btn').addEventListener('click', () => {
  closeAllDropdowns();
  switchView('settings');
  populateSettingsForm();
});

function populateSettingsForm() {
  const form = $('profile-form');
  form.elements.name.value = state.user.name;
  form.elements.email.value = state.user.email;
  form.elements.address.value = state.user.address || '';
  $('profile-error').classList.add('hidden');
  $('profile-success').classList.add('hidden');
  $('password-form').reset();
  $('password-error').classList.add('hidden');
  $('password-success').classList.add('hidden');
}

$('profile-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  try {
    const updated = await api('/users/me', {
      method: 'PUT',
      body: JSON.stringify({ name: form.elements.name.value, address: form.elements.address.value }),
    });
    state.user.name = updated.name;
    state.user.address = updated.address;
    localStorage.setItem('wp_user', JSON.stringify(state.user));
    renderAvatar();
    $('profile-error').classList.add('hidden');
    const s = $('profile-success');
    s.textContent = 'Profile updated.';
    s.classList.remove('hidden');
  } catch (err) {
    $('profile-success').classList.add('hidden');
    const p = $('profile-error');
    p.textContent = err.message;
    p.classList.remove('hidden');
  }
});

$('password-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  try {
    await api('/users/me/password', {
      method: 'PUT',
      body: JSON.stringify({
        current_password: form.elements.current_password.value,
        new_password: form.elements.new_password.value,
      }),
    });
    form.reset();
    $('password-error').classList.add('hidden');
    const s = $('password-success');
    s.textContent = 'Password updated.';
    s.classList.remove('hidden');
  } catch (err) {
    $('password-success').classList.add('hidden');
    const p = $('password-error');
    p.textContent = err.message;
    p.classList.remove('hidden');
  }
});

// ---------- Init ----------
async function initApp() {
  showApp();
  renderAvatar();
  await loadLocations();
  updateViewVisibility();
  await loadViewData(state.view);
  await loadReminders();
}

applyTheme(state.theme);

if (state.token && state.user) {
  initApp();
} else {
  showAuth();
}
