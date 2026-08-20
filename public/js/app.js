// ---------- State ----------
const state = {
  token: localStorage.getItem('wp_token'),
  user: JSON.parse(localStorage.getItem('wp_user') || 'null'),
  pickups: [],
  theme: localStorage.getItem('wp_theme') || 'light',
};

let currentPickupId = null;
let selectedRating = 0;
let feedbackPickupId = null;

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

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
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
  $('theme-toggle').textContent = theme === 'dark' ? '☀️' : '🌙';
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

// ---------- Avatar ----------
function renderAvatar() {
  const initial = (state.user.name || '?').trim().charAt(0).toUpperCase();
  $('user-menu-btn').textContent = initial || '?';
  $('user-dropdown-name').textContent = state.user.name;
}

// ---------- Pickups ----------
function buildQuery() {
  const params = new URLSearchParams();
  const status = $('filter-status').value;
  const wasteType = $('filter-waste-type').value;
  if (status) params.set('status', status);
  if (wasteType) params.set('waste_type', wasteType);
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

const RECURRENCE_LABELS = { weekly: '🔁 Weekly', biweekly: '🔁 Every 2 weeks', monthly: '🔁 Monthly' };
const TIME_WINDOW_LABELS = { morning: 'Morning (8am–12pm)', afternoon: 'Afternoon (12pm–4pm)', evening: 'Evening (4pm–8pm)' };

function pickupCardHtml(p) {
  const today = todayStr();
  const overdueScheduled = p.status === 'scheduled' && p.scheduled_date < today;
  const statusClass = overdueScheduled ? 'status-overdue' : `status-${p.status}`;
  const statusLabel = overdueScheduled ? 'Awaiting confirmation' : capitalize(p.status);

  let actionsHtml = '';
  if (p.status === 'scheduled') {
    actionsHtml = `
      <button class="btn btn-sm btn-primary" data-action="collected">Mark collected</button>
      <button class="btn btn-sm btn-outline" data-action="missed">Report missed</button>
      <button class="btn btn-sm btn-ghost" data-action="edit">Edit</button>
      <button class="btn btn-sm btn-danger-outline" data-action="cancel">Cancel</button>
    `;
  } else if (p.status === 'cancelled') {
    actionsHtml = `<button class="btn btn-sm btn-danger-outline" data-action="delete">Delete</button>`;
  } else if (['collected', 'missed'].includes(p.status) && p.feedback_rating === null) {
    actionsHtml = `<button class="btn btn-sm btn-outline" data-action="feedback">Leave feedback</button>
      <button class="btn btn-sm btn-danger-outline" data-action="delete">Delete</button>`;
  } else {
    actionsHtml = `<button class="btn btn-sm btn-danger-outline" data-action="delete">Delete</button>`;
  }

  const feedbackHtml =
    p.feedback_rating !== null
      ? `<div class="feedback-display">
          <span class="feedback-stars">${'★'.repeat(p.feedback_rating)}${'☆'.repeat(5 - p.feedback_rating)}</span>
          ${p.feedback_comment ? `<div class="feedback-comment">${escapeHtml(p.feedback_comment)}</div>` : ''}
        </div>`
      : '';

  return `
    <li class="pickup-card waste-${p.waste_type}" data-id="${p.id}">
      <div class="pickup-top">
        <div>
          <div class="pickup-title">${escapeHtml(p.waste_type)} waste pickup</div>
          <div class="pickup-address">📍 ${escapeHtml(p.address)}</div>
        </div>
        <span class="badge ${statusClass}">${statusLabel}</span>
      </div>
      ${p.notes ? `<div class="pickup-notes">${escapeHtml(p.notes)}</div>` : ''}
      <div class="pickup-meta">
        <span class="badge waste-${p.waste_type}">${escapeHtml(p.waste_type)}</span>
        <span class="badge neutral">📅 ${formatDate(p.scheduled_date)}</span>
        <span class="badge neutral">${TIME_WINDOW_LABELS[p.time_window]}</span>
        ${p.recurrence !== 'none' ? `<span class="badge recurrence">${RECURRENCE_LABELS[p.recurrence]}</span>` : ''}
      </div>
      <div class="pickup-actions">${actionsHtml}</div>
      ${feedbackHtml}
    </li>
  `;
}

function renderPickups() {
  $('empty-state').classList.toggle('hidden', state.pickups.length > 0);
  $('pickup-list').innerHTML = state.pickups.map(pickupCardHtml).join('');
  attachCardHandlers();
}

function attachCardHandlers() {
  document.querySelectorAll('.pickup-card').forEach((card) => {
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
      await loadPickups();
      await loadReminders();
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
      await loadPickups();
      await loadReminders();
    } catch (err) {
      alert(err.message);
    }
    return;
  }

  if (action === 'delete') {
    if (!confirm('Delete this pickup permanently?')) return;
    try {
      await api(`/pickups/${id}`, { method: 'DELETE' });
      await loadPickups();
    } catch (err) {
      alert(err.message);
    }
  }
}

$('filter-status').addEventListener('change', loadPickups);
$('filter-waste-type').addEventListener('change', loadPickups);

// ---------- Pickup modal ----------
function clearModalError() {
  $('modal-error').classList.add('hidden');
}

function showModalError(msg) {
  const el = $('modal-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

async function openPickupModal(id) {
  clearModalError();
  const form = $('pickup-form');
  form.reset();
  currentPickupId = id || null;

  if (!id) {
    $('modal-title').textContent = 'Schedule a pickup';
    form.elements.id.value = '';
    form.elements.address.value = state.user.address || '';
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
    await loadPickups();
    await loadReminders();
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
    await loadPickups();
  } catch (err) {
    const el = $('feedback-error');
    el.textContent = err.message;
    el.classList.remove('hidden');
  }
});

// ---------- Reminders ----------
async function loadReminders() {
  try {
    const list = await api('/pickups?due_soon=1');
    renderReminders(list);
  } catch (err) {
    console.error(err);
  }
}

function renderReminders(list) {
  const badge = $('notif-badge');
  badge.textContent = list.length;
  badge.classList.toggle('hidden', list.length === 0);

  const banner = $('reminder-banner');
  if (list.length === 0) {
    banner.classList.add('hidden');
  } else {
    banner.classList.remove('hidden');
    $('reminder-text').textContent =
      list.length === 1
        ? `You have 1 pickup coming up: ${list[0].waste_type} waste on ${formatDate(list[0].scheduled_date)}.`
        : `You have ${list.length} pickups coming up in the next 2 days.`;
  }

  if (list.length === 0) {
    $('notif-list').innerHTML = '<li class="hint-text">No pickups due soon 🎉</li>';
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

// ---------- Profile ----------
$('profile-btn').addEventListener('click', () => {
  const form = $('profile-form');
  form.elements.name.value = state.user.name;
  form.elements.email.value = state.user.email;
  form.elements.address.value = state.user.address || '';
  $('profile-error').classList.add('hidden');
  $('profile-success').classList.add('hidden');
  $('password-form').reset();
  $('password-error').classList.add('hidden');
  $('password-success').classList.add('hidden');
  closeAllDropdowns();
  showModal('profile-modal');
});
$('profile-modal-close').addEventListener('click', () => hideModal('profile-modal'));
$('profile-modal').addEventListener('click', (e) => {
  if (e.target.id === 'profile-modal') hideModal('profile-modal');
});

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
  await loadPickups();
  await loadReminders();
}

applyTheme(state.theme);

if (state.token && state.user) {
  initApp();
} else {
  showAuth();
}
