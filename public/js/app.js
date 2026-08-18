// ---------- State ----------
const state = {
  token: localStorage.getItem('tf_token'),
  user: JSON.parse(localStorage.getItem('tf_user') || 'null'),
  tasks: [],
  projects: [],
  tags: [],
  view: 'list', // 'list' | 'kanban' | 'analytics'
  projectId: null,
  tagId: null,
  theme: localStorage.getItem('tf_theme') || 'light',
};

let currentTaskId = null;

// ---------- Helpers ----------
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(`${isoStr.replace(' ', 'T')}Z`);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
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
  localStorage.setItem('tf_token', data.token);
  localStorage.setItem('tf_user', JSON.stringify(data.user));
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
  state.tasks = [];
  state.projects = [];
  state.tags = [];
  state.projectId = null;
  state.tagId = null;
  localStorage.removeItem('tf_token');
  localStorage.removeItem('tf_user');
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
      body: JSON.stringify({ name: form.get('name'), email: form.get('email'), password: form.get('password') }),
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
  localStorage.setItem('tf_theme', state.theme);
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

// ---------- Projects ----------
async function loadProjects() {
  state.projects = await api('/projects');
  renderProjectList();
}

function renderProjectList() {
  const allActive = !state.projectId;
  let html = `<li class="side-item ${allActive ? 'active' : ''}" data-id="">
    <span class="dot" style="background:#9aa39d"></span><span class="side-item-label">All projects</span>
  </li>`;
  html += state.projects
    .map(
      (p) => `<li class="side-item ${String(state.projectId) === String(p.id) ? 'active' : ''}" data-id="${p.id}">
        <span class="dot" style="background:${p.color}"></span>
        <span class="side-item-label">${escapeHtml(p.name)}</span>
        <span class="side-item-count">${p.open_count}</span>
        <button class="side-item-delete" data-id="${p.id}" title="Delete project" type="button">×</button>
      </li>`
    )
    .join('');
  $('project-list').innerHTML = html;
}

async function deleteProject(id) {
  if (!confirm('Delete this project? Its tasks will be kept but unassigned.')) return;
  try {
    await api(`/projects/${id}`, { method: 'DELETE' });
    if (String(state.projectId) === String(id)) state.projectId = null;
    await loadProjects();
    await loadTasks();
  } catch (err) {
    alert(err.message);
  }
}

$('project-list').addEventListener('click', (e) => {
  const delBtn = e.target.closest('.side-item-delete');
  if (delBtn) {
    e.stopPropagation();
    deleteProject(delBtn.dataset.id);
    return;
  }
  const item = e.target.closest('.side-item');
  if (!item) return;
  state.projectId = item.dataset.id || null;
  renderProjectList();
  updateViewTitle();
  loadTasks();
  $('sidebar').classList.remove('open');
});

$('new-project-btn').addEventListener('click', () => {
  $('project-form').reset();
  $('project-modal-error').classList.add('hidden');
  showModal('project-modal');
});
['project-modal-close', 'project-modal-cancel'].forEach((id) =>
  $(id).addEventListener('click', () => hideModal('project-modal'))
);
$('project-modal').addEventListener('click', (e) => {
  if (e.target.id === 'project-modal') hideModal('project-modal');
});
$('project-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  try {
    await api('/projects', {
      method: 'POST',
      body: JSON.stringify({ name: form.elements.name.value, color: form.elements.color.value }),
    });
    hideModal('project-modal');
    await loadProjects();
  } catch (err) {
    const p = $('project-modal-error');
    p.textContent = err.message;
    p.classList.remove('hidden');
  }
});

function renderProjectOptions(selectedId) {
  const select = $('task-project-select');
  select.innerHTML =
    '<option value="">No project</option>' +
    state.projects
      .map((p) => `<option value="${p.id}" ${String(p.id) === String(selectedId) ? 'selected' : ''}>${escapeHtml(p.name)}</option>`)
      .join('');
}

// ---------- Tags ----------
async function loadTags() {
  state.tags = await api('/tags');
  renderTagList();
}

function renderTagList() {
  if (state.tags.length === 0) {
    $('tag-list').innerHTML = '<li class="hint-text">No tags yet.</li>';
    return;
  }
  $('tag-list').innerHTML = state.tags
    .map(
      (t) => `<li class="side-item ${String(state.tagId) === String(t.id) ? 'active' : ''}" data-id="${t.id}">
        <span class="dot" style="background:${t.color}"></span>
        <span class="side-item-label">${escapeHtml(t.name)}</span>
        <button class="side-item-delete" data-id="${t.id}" title="Delete tag" type="button">×</button>
      </li>`
    )
    .join('');
}

async function deleteTag(id) {
  if (!confirm('Delete this tag?')) return;
  try {
    await api(`/tags/${id}`, { method: 'DELETE' });
    if (String(state.tagId) === String(id)) state.tagId = null;
    await loadTags();
    await loadTasks();
  } catch (err) {
    alert(err.message);
  }
}

$('tag-list').addEventListener('click', (e) => {
  const delBtn = e.target.closest('.side-item-delete');
  if (delBtn) {
    e.stopPropagation();
    deleteTag(delBtn.dataset.id);
    return;
  }
  const item = e.target.closest('.side-item');
  if (!item || !item.dataset.id) return;
  state.tagId = String(state.tagId) === String(item.dataset.id) ? null : item.dataset.id;
  renderTagList();
  loadTasks();
});

$('new-tag-btn').addEventListener('click', () => {
  $('tag-form').reset();
  $('tag-modal-error').classList.add('hidden');
  showModal('tag-modal');
});
['tag-modal-close', 'tag-modal-cancel'].forEach((id) => $(id).addEventListener('click', () => hideModal('tag-modal')));
$('tag-modal').addEventListener('click', (e) => {
  if (e.target.id === 'tag-modal') hideModal('tag-modal');
});
$('tag-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  try {
    await api('/tags', {
      method: 'POST',
      body: JSON.stringify({ name: form.elements.name.value, color: form.elements.color.value }),
    });
    hideModal('tag-modal');
    await loadTags();
  } catch (err) {
    const p = $('tag-modal-error');
    p.textContent = err.message;
    p.classList.remove('hidden');
  }
});

function renderTagPicker(selectedIds) {
  const picker = $('tag-picker');
  if (state.tags.length === 0) {
    picker.innerHTML = '<p class="hint-text">No tags yet — create one from the sidebar.</p>';
    return;
  }
  const selected = selectedIds.map(String);
  picker.innerHTML = state.tags
    .map(
      (t) => `<label class="tag-chip-option" style="--chip-color:${t.color}">
        <input type="checkbox" value="${t.id}" ${selected.includes(String(t.id)) ? 'checked' : ''} />
        <span>${escapeHtml(t.name)}</span>
      </label>`
    )
    .join('');
}

// ---------- Task rendering ----------
function taskCardHtml(task, { draggable }) {
  const overdue = task.due_date && task.due_date < todayStr() && task.status !== 'completed';
  const subtaskPct = task.subtask_count ? Math.round((task.subtask_done / task.subtask_count) * 100) : null;

  return `
    <div class="task-card priority-${task.priority}${task.status === 'completed' ? ' done' : ''}" data-id="${task.id}" ${draggable ? 'draggable="true"' : ''}>
      <input type="checkbox" class="task-check" ${task.status === 'completed' ? 'checked' : ''} title="Mark complete" />
      <div class="task-body">
        <div class="task-title">${escapeHtml(task.title)}</div>
        ${task.description ? `<div class="task-desc">${escapeHtml(task.description)}</div>` : ''}
        ${subtaskPct !== null ? `<div class="subtask-mini"><div class="subtask-mini-bar"><div class="subtask-mini-fill" style="width:${subtaskPct}%"></div></div><span>${task.subtask_done}/${task.subtask_count}</span></div>` : ''}
        <div class="task-meta">
          ${task.project_name ? `<span class="badge project-badge" style="background:${task.project_color}22;color:${task.project_color}"><span class="dot" style="background:${task.project_color}"></span>${escapeHtml(task.project_name)}</span>` : ''}
          <span class="badge priority-${task.priority}">${task.priority}</span>
          ${!draggable ? `<span class="badge status">${task.status.replace('-', ' ')}</span>` : ''}
          ${task.due_date ? `<span class="badge due${overdue ? ' overdue' : ''}">${overdue ? 'Overdue ' : 'Due '}${task.due_date}</span>` : ''}
          ${(task.tags || []).map((t) => `<span class="badge tag-badge" style="background:${t.color}22;color:${t.color}">${escapeHtml(t.name)}</span>`).join('')}
          ${task.comment_count ? `<span class="badge comment-count">💬 ${task.comment_count}</span>` : ''}
        </div>
      </div>
      <div class="task-actions">
        <button class="icon-btn edit-btn" type="button" title="Edit">✏️</button>
        <button class="icon-btn delete-btn" type="button" title="Delete">🗑️</button>
      </div>
    </div>
  `;
}

function attachCardHandlers(container) {
  container.querySelectorAll('.task-card').forEach((card) => {
    const id = card.dataset.id;
    card.querySelector('.task-check').addEventListener('change', (e) => quickToggleStatus(id, e.target.checked));
    card.querySelector('.edit-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      openTaskModal(id);
    });
    card.querySelector('.delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteTask(id);
    });
    card.querySelector('.task-body').addEventListener('click', () => openTaskModal(id));
  });
}

function attachCardDragHandlers(container) {
  container.querySelectorAll('.task-card[draggable="true"]').forEach((card) => {
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', card.dataset.id);
      e.dataTransfer.effectAllowed = 'move';
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  });
}

function setupKanbanColumns() {
  document.querySelectorAll('.kanban-cards').forEach((container) => {
    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      container.classList.add('drag-over');
    });
    container.addEventListener('dragleave', () => container.classList.remove('drag-over'));
    container.addEventListener('drop', async (e) => {
      e.preventDefault();
      container.classList.remove('drag-over');
      const taskId = e.dataTransfer.getData('text/plain');
      const status = container.dataset.status;
      if (!taskId) return;
      try {
        await api(`/tasks/${taskId}`, { method: 'PUT', body: JSON.stringify({ status }) });
        await loadTasks();
        await loadNotifications();
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

async function quickToggleStatus(id, checked) {
  try {
    await api(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify({ status: checked ? 'completed' : 'pending' }) });
    await loadTasks();
    await loadNotifications();
  } catch (err) {
    alert(err.message);
  }
}

async function deleteTask(id) {
  if (!confirm('Delete this task?')) return;
  try {
    await api(`/tasks/${id}`, { method: 'DELETE' });
    await loadTasks();
    await loadNotifications();
  } catch (err) {
    alert(err.message);
  }
}

function renderStats(tasks) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'completed').length;
  const inProgress = tasks.filter((t) => t.status === 'in-progress').length;
  const pending = tasks.filter((t) => t.status === 'pending').length;

  $('stats').innerHTML = `
    <div class="stat-card"><div class="num">${total}</div><div class="lbl">Total tasks</div></div>
    <div class="stat-card"><div class="num">${pending}</div><div class="lbl">Pending</div></div>
    <div class="stat-card"><div class="num">${inProgress}</div><div class="lbl">In progress</div></div>
    <div class="stat-card"><div class="num">${done}</div><div class="lbl">Completed</div></div>
  `;
}

function renderListView() {
  const listEl = $('task-list');
  $('empty-state').classList.toggle('hidden', state.tasks.length > 0);
  listEl.innerHTML = state.tasks.map((t) => taskCardHtml(t, { draggable: false })).join('');
  attachCardHandlers(listEl);
  renderStats(state.tasks);
}

function renderKanbanView() {
  const columns = { pending: [], 'in-progress': [], completed: [] };
  for (const t of state.tasks) {
    (columns[t.status] || columns.pending).push(t);
  }
  for (const status of Object.keys(columns)) {
    const el = $(`kanban-${status}`);
    el.innerHTML = columns[status].map((t) => taskCardHtml(t, { draggable: true })).join('');
    attachCardHandlers(el);
    attachCardDragHandlers(el);
    $(`count-${status}`).textContent = columns[status].length;
  }
  renderStats(state.tasks);
}

function buildTaskQuery() {
  const params = new URLSearchParams();
  if (state.view === 'list' && $('filter-status').value) {
    params.set('status', $('filter-status').value);
  }
  const priority = $('filter-priority').value;
  if (priority) params.set('priority', priority);
  const search = $('search-input').value.trim();
  if (search) params.set('search', search);
  if (state.projectId) params.set('project_id', state.projectId);
  if (state.tagId) params.set('tag_id', state.tagId);
  return params;
}

async function loadTasks() {
  if (state.view === 'analytics') return;
  try {
    state.tasks = await api(`/tasks?${buildTaskQuery()}`);
    renderCurrentView();
  } catch (err) {
    console.error(err);
  }
}

function renderCurrentView() {
  updateViewVisibility();
  if (state.view === 'list') renderListView();
  else if (state.view === 'kanban') renderKanbanView();
}

function updateViewTitle() {
  if (state.view === 'analytics') {
    $('view-title').textContent = 'Analytics';
    return;
  }
  const project = state.projects.find((p) => String(p.id) === String(state.projectId));
  $('view-title').textContent = project ? project.name : 'All Tasks';
}

function updateViewVisibility() {
  $('list-view').classList.toggle('hidden', state.view !== 'list');
  $('kanban-view').classList.toggle('hidden', state.view !== 'kanban');
  $('analytics-view').classList.toggle('hidden', state.view !== 'analytics');
  $('stats').classList.toggle('hidden', state.view === 'analytics');
  $('filter-status').classList.toggle('hidden', state.view !== 'list');
  updateViewTitle();
}

document.querySelectorAll('.nav-item').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.view = btn.dataset.view;
    if (state.view === 'analytics') loadAnalytics();
    else loadTasks();
    $('sidebar').classList.remove('open');
  });
});

$('search-input').addEventListener('input', () => {
  clearTimeout(window.__tfSearchTimer);
  window.__tfSearchTimer = setTimeout(loadTasks, 300);
});
$('filter-status').addEventListener('change', loadTasks);
$('filter-priority').addEventListener('change', loadTasks);

// ---------- Task modal ----------
function clearModalError() {
  $('modal-error').classList.add('hidden');
}

function showModalError(msg) {
  const el = $('modal-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

async function openTaskModal(taskId) {
  clearModalError();
  $('task-form').reset();
  currentTaskId = taskId || null;

  if (!taskId) {
    $('modal-title').textContent = 'New task';
    $('task-form').elements.id.value = '';
    renderProjectOptions(state.projectId || '');
    renderTagPicker([]);
    $('task-extra').classList.add('hidden');
    showModal('task-modal');
    $('task-form').elements.title.focus();
    return;
  }

  try {
    const task = await api(`/tasks/${taskId}`);
    $('modal-title').textContent = 'Edit task';
    const form = $('task-form');
    form.elements.id.value = task.id;
    form.elements.title.value = task.title;
    form.elements.description.value = task.description || '';
    renderProjectOptions(task.project_id || '');
    form.elements.priority.value = task.priority;
    form.elements.status.value = task.status;
    form.elements.due_date.value = task.due_date || '';
    renderTagPicker((task.tags || []).map((t) => t.id));
    $('task-extra').classList.remove('hidden');
    renderSubtasks(task.subtasks || []);
    renderComments(task.comments || []);
    showModal('task-modal');
  } catch (err) {
    alert(err.message);
  }
}

function closeTaskModal() {
  hideModal('task-modal');
  currentTaskId = null;
  loadTasks();
  loadNotifications();
}

$('new-task-btn').addEventListener('click', () => openTaskModal(null));
$('modal-close').addEventListener('click', closeTaskModal);
$('modal-cancel').addEventListener('click', closeTaskModal);
$('task-modal').addEventListener('click', (e) => {
  if (e.target.id === 'task-modal') closeTaskModal();
});

$('task-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const id = form.elements.id.value;
  const tagIds = Array.from(document.querySelectorAll('#tag-picker input[type=checkbox]:checked')).map((el) =>
    Number(el.value)
  );
  const payload = {
    title: form.elements.title.value,
    description: form.elements.description.value,
    project_id: form.elements.project_id.value || null,
    priority: form.elements.priority.value,
    status: form.elements.status.value,
    due_date: form.elements.due_date.value || null,
    tag_ids: tagIds,
  };

  try {
    if (id) {
      await api(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      await api('/tasks', { method: 'POST', body: JSON.stringify(payload) });
    }
    closeTaskModal();
  } catch (err) {
    showModalError(err.message);
  }
});

// ---------- Subtasks ----------
function renderSubtasks(subtasks) {
  const total = subtasks.length;
  const done = subtasks.filter((s) => s.completed).length;
  $('subtask-progress').textContent = total ? `${done}/${total}` : '';
  $('subtask-list').innerHTML = subtasks
    .map(
      (s) => `<li class="subtask-item ${s.completed ? 'done' : ''}" data-id="${s.id}">
        <input type="checkbox" class="subtask-check" ${s.completed ? 'checked' : ''} />
        <span class="subtask-title">${escapeHtml(s.title)}</span>
        <button class="icon-btn subtask-delete" type="button" title="Delete">×</button>
      </li>`
    )
    .join('');
}

$('subtask-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentTaskId) return;
  const form = e.target;
  try {
    await api(`/tasks/${currentTaskId}/subtasks`, {
      method: 'POST',
      body: JSON.stringify({ title: form.elements.title.value }),
    });
    form.reset();
    renderSubtasks(await api(`/tasks/${currentTaskId}/subtasks`));
  } catch (err) {
    alert(err.message);
  }
});

$('subtask-list').addEventListener('click', async (e) => {
  const item = e.target.closest('.subtask-item');
  if (!item || !currentTaskId) return;
  const id = item.dataset.id;

  if (e.target.classList.contains('subtask-check')) {
    try {
      await api(`/tasks/${currentTaskId}/subtasks/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ completed: e.target.checked }),
      });
      renderSubtasks(await api(`/tasks/${currentTaskId}/subtasks`));
    } catch (err) {
      alert(err.message);
    }
  } else if (e.target.classList.contains('subtask-delete')) {
    if (!confirm('Delete this subtask?')) return;
    try {
      await api(`/tasks/${currentTaskId}/subtasks/${id}`, { method: 'DELETE' });
      renderSubtasks(await api(`/tasks/${currentTaskId}/subtasks`));
    } catch (err) {
      alert(err.message);
    }
  }
});

// ---------- Comments ----------
function renderComments(comments) {
  if (comments.length === 0) {
    $('comment-list').innerHTML = '<li class="hint-text">No comments yet.</li>';
    return;
  }
  $('comment-list').innerHTML = comments
    .map(
      (c) => `<li class="comment-item" data-id="${c.id}">
        <div class="comment-head"><strong>${escapeHtml(c.author_name)}</strong><span class="comment-time">${formatDateTime(c.created_at)}</span></div>
        <div class="comment-body">${escapeHtml(c.body)}</div>
        <button class="icon-btn comment-delete" type="button" title="Delete">×</button>
      </li>`
    )
    .join('');
}

$('comment-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentTaskId) return;
  const form = e.target;
  try {
    await api(`/tasks/${currentTaskId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body: form.elements.body.value }),
    });
    form.reset();
    renderComments(await api(`/tasks/${currentTaskId}/comments`));
  } catch (err) {
    alert(err.message);
  }
});

$('comment-list').addEventListener('click', async (e) => {
  if (!e.target.classList.contains('comment-delete') || !currentTaskId) return;
  const item = e.target.closest('.comment-item');
  if (!confirm('Delete this comment?')) return;
  try {
    await api(`/tasks/${currentTaskId}/comments/${item.dataset.id}`, { method: 'DELETE' });
    renderComments(await api(`/tasks/${currentTaskId}/comments`));
  } catch (err) {
    alert(err.message);
  }
});

// ---------- Notifications ----------
function renderNotifications(list) {
  const badge = $('notif-badge');
  badge.textContent = list.length;
  badge.classList.toggle('hidden', list.length === 0);

  if (list.length === 0) {
    $('notif-list').innerHTML = '<li class="hint-text">Nothing due soon 🎉</li>';
    return;
  }
  $('notif-list').innerHTML = list
    .map((t) => {
      const overdue = t.due_date < todayStr();
      return `<li class="notif-item" data-id="${t.id}">
        <span class="notif-title">${escapeHtml(t.title)}</span>
        <span class="badge due${overdue ? ' overdue' : ''}">${overdue ? 'Overdue ' : 'Due '}${t.due_date}</span>
      </li>`;
    })
    .join('');
}

$('notif-list').addEventListener('click', (e) => {
  const item = e.target.closest('.notif-item');
  if (!item) return;
  closeAllDropdowns();
  openTaskModal(item.dataset.id);
});

async function loadNotifications() {
  try {
    renderNotifications(await api('/tasks?due_soon=1'));
  } catch (err) {
    console.error(err);
  }
}

// ---------- Analytics ----------
async function loadAnalytics() {
  updateViewVisibility();
  try {
    renderAnalytics(await api('/analytics'));
  } catch (err) {
    console.error(err);
  }
}

function renderAnalytics(data) {
  $('analytics-tiles').innerHTML = `
    <div class="stat-card"><div class="num">${data.total}</div><div class="lbl">Total tasks</div></div>
    <div class="stat-card"><div class="num">${data.completed}</div><div class="lbl">Completed</div></div>
    <div class="stat-card"><div class="num">${data.completionRate}%</div><div class="lbl">Completion rate</div></div>
    <div class="stat-card"><div class="num">${data.overdue}</div><div class="lbl">Overdue</div></div>
  `;

  const statusOrder = ['pending', 'in-progress', 'completed'];
  const statusData = statusOrder.map((s) => ({
    label: s,
    count: (data.byStatus.find((r) => r.status === s) || { count: 0 }).count,
  }));
  $('chart-status').innerHTML = Charts.donutChart(statusData, Charts.STATUS_COLORS);
  $('legend-status').innerHTML = statusData
    .map((d) => `<div class="legend-item"><span class="dot" style="background:${Charts.STATUS_COLORS[d.label]}"></span>${Charts.STATUS_LABELS[d.label]} (${d.count})</div>`)
    .join('');

  const priorityOrder = ['high', 'medium', 'low'];
  const priorityData = priorityOrder.map((p) => ({
    label: p,
    count: (data.byPriority.find((r) => r.priority === p) || { count: 0 }).count,
  }));
  $('chart-priority').innerHTML = Charts.barChart(priorityData, Charts.PRIORITY_COLORS);

  $('chart-trend').innerHTML = Charts.lineChart(data.trend);
}

// ---------- Profile ----------
$('profile-btn').addEventListener('click', () => {
  const form = $('profile-form');
  form.elements.name.value = state.user.name;
  form.elements.email.value = state.user.email;
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
    const updated = await api('/users/me', { method: 'PUT', body: JSON.stringify({ name: form.elements.name.value }) });
    state.user.name = updated.name;
    localStorage.setItem('tf_user', JSON.stringify(state.user));
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
  setupKanbanColumns();
  await loadProjects();
  await loadTags();
  await loadTasks();
  await loadNotifications();
}

applyTheme(state.theme);

if (state.token && state.user) {
  initApp();
} else {
  showAuth();
}
