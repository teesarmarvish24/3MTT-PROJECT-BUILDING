// ---------- State ----------
let token = localStorage.getItem('tf_token');
let currentUser = JSON.parse(localStorage.getItem('tf_user') || 'null');
let tasks = [];

// ---------- Elements ----------
const $ = (sel) => document.querySelector(sel);
const authScreen = $('#auth-screen');
const appScreen = $('#app-screen');
const loginForm = $('#login-form');
const registerForm = $('#register-form');
const authError = $('#auth-error');
const taskList = $('#task-list');
const emptyState = $('#empty-state');
const modal = $('#task-modal');
const taskForm = $('#task-form');
const modalError = $('#modal-error');

// ---------- API helper ----------
async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (res.status === 401 && token) {
    logout();
    throw new Error('Session expired. Please log in again.');
  }
  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

// ---------- Auth ----------
function showApp() {
  authScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');
  $('#user-greeting').textContent = `Hi, ${currentUser.name.split(' ')[0]}`;
  loadTasks();
}

function showAuth() {
  appScreen.classList.add('hidden');
  authScreen.classList.remove('hidden');
}

function saveSession(data) {
  token = data.token;
  currentUser = data.user;
  localStorage.setItem('tf_token', token);
  localStorage.setItem('tf_user', JSON.stringify(currentUser));
}

function logout() {
  token = null;
  currentUser = null;
  tasks = [];
  localStorage.removeItem('tf_token');
  localStorage.removeItem('tf_user');
  showAuth();
}

$('#tab-login').addEventListener('click', () => switchTab('login'));
$('#tab-register').addEventListener('click', () => switchTab('register'));

function switchTab(which) {
  authError.classList.add('hidden');
  $('#tab-login').classList.toggle('active', which === 'login');
  $('#tab-register').classList.toggle('active', which === 'register');
  loginForm.classList.toggle('hidden', which !== 'login');
  registerForm.classList.toggle('hidden', which !== 'register');
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(loginForm);
  try {
    saveSession(await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
    }));
    loginForm.reset();
    showApp();
  } catch (err) {
    showAuthError(err.message);
  }
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(registerForm);
  try {
    saveSession(await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: form.get('name'),
        email: form.get('email'),
        password: form.get('password'),
      }),
    }));
    registerForm.reset();
    showApp();
  } catch (err) {
    showAuthError(err.message);
  }
});

function showAuthError(msg) {
  authError.textContent = msg;
  authError.classList.remove('hidden');
}

$('#logout-btn').addEventListener('click', logout);

// ---------- Tasks ----------
async function loadTasks() {
  const params = new URLSearchParams();
  const status = $('#filter-status').value;
  const priority = $('#filter-priority').value;
  const search = $('#search-input').value.trim();
  if (status) params.set('status', status);
  if (priority) params.set('priority', priority);
  if (search) params.set('search', search);

  try {
    tasks = await api(`/api/tasks?${params}`);
    renderTasks();
    renderStats();
  } catch (err) {
    console.error(err);
  }
}

function renderStats() {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'completed').length;
  const inProgress = tasks.filter((t) => t.status === 'in-progress').length;
  const pending = tasks.filter((t) => t.status === 'pending').length;

  $('#stats').innerHTML = `
    <div class="stat-card"><div class="num">${total}</div><div class="lbl">Total tasks</div></div>
    <div class="stat-card"><div class="num">${pending}</div><div class="lbl">Pending</div></div>
    <div class="stat-card"><div class="num">${inProgress}</div><div class="lbl">In progress</div></div>
    <div class="stat-card"><div class="num">${done}</div><div class="lbl">Completed</div></div>
  `;
}

function renderTasks() {
  taskList.innerHTML = '';
  emptyState.classList.toggle('hidden', tasks.length > 0);

  const today = new Date().toISOString().slice(0, 10);

  for (const task of tasks) {
    const li = document.createElement('li');
    li.className = `task-card priority-${task.priority}${task.status === 'completed' ? ' done' : ''}`;

    const overdue = task.due_date && task.due_date < today && task.status !== 'completed';

    li.innerHTML = `
      <input type="checkbox" class="task-check" ${task.status === 'completed' ? 'checked' : ''} title="Mark complete" />
      <div class="task-body">
        <div class="task-title"></div>
        <div class="task-desc"></div>
        <div class="task-meta">
          <span class="badge priority-${task.priority}">${task.priority}</span>
          <span class="badge status">${task.status.replace('-', ' ')}</span>
          ${task.due_date ? `<span class="badge due${overdue ? ' overdue' : ''}">Due ${task.due_date}${overdue ? ' (overdue)' : ''}</span>` : ''}
        </div>
      </div>
      <div class="task-actions">
        <button class="icon-btn edit-btn" title="Edit">✏️</button>
        <button class="icon-btn delete-btn" title="Delete">🗑️</button>
      </div>
    `;

    // Set text via textContent to avoid HTML injection
    li.querySelector('.task-title').textContent = task.title;
    const desc = li.querySelector('.task-desc');
    if (task.description) desc.textContent = task.description;
    else desc.remove();

    li.querySelector('.task-check').addEventListener('change', (e) => {
      updateTask(task.id, { status: e.target.checked ? 'completed' : 'pending' });
    });
    li.querySelector('.edit-btn').addEventListener('click', () => openModal(task));
    li.querySelector('.delete-btn').addEventListener('click', () => deleteTask(task));

    taskList.appendChild(li);
  }
}

async function updateTask(id, changes) {
  try {
    await api(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(changes) });
    loadTasks();
  } catch (err) {
    alert(err.message);
  }
}

async function deleteTask(task) {
  if (!confirm(`Delete "${task.title}"?`)) return;
  try {
    await api(`/api/tasks/${task.id}`, { method: 'DELETE' });
    loadTasks();
  } catch (err) {
    alert(err.message);
  }
}

// ---------- Modal ----------
function openModal(task = null) {
  modalError.classList.add('hidden');
  taskForm.reset();
  $('#modal-title').textContent = task ? 'Edit task' : 'New task';
  taskForm.elements.id.value = task ? task.id : '';
  if (task) {
    taskForm.elements.title.value = task.title;
    taskForm.elements.description.value = task.description || '';
    taskForm.elements.priority.value = task.priority;
    taskForm.elements.status.value = task.status;
    taskForm.elements.due_date.value = task.due_date || '';
  }
  modal.classList.remove('hidden');
  taskForm.elements.title.focus();
}

function closeModal() {
  modal.classList.add('hidden');
}

$('#new-task-btn').addEventListener('click', () => openModal());
$('#modal-cancel').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => {
  if (e.target === modal) closeModal();
});

taskForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = taskForm.elements.id.value;
  const payload = {
    title: taskForm.elements.title.value,
    description: taskForm.elements.description.value,
    priority: taskForm.elements.priority.value,
    status: taskForm.elements.status.value,
    due_date: taskForm.elements.due_date.value || null,
  };

  try {
    if (id) {
      await api(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      await api('/api/tasks', { method: 'POST', body: JSON.stringify(payload) });
    }
    closeModal();
    loadTasks();
  } catch (err) {
    modalError.textContent = err.message;
    modalError.classList.remove('hidden');
  }
});

// ---------- Filters ----------
let searchTimer;
$('#search-input').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadTasks, 300);
});
$('#filter-status').addEventListener('change', loadTasks);
$('#filter-priority').addEventListener('change', loadTasks);

// ---------- Init ----------
if (token && currentUser) {
  showApp();
} else {
  showAuth();
}
