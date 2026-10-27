const form = document.getElementById('task-form');
const titleInput = document.getElementById('task-title');
const titleError = document.getElementById('title-error');
const searchInput = document.getElementById('search');
const list = document.getElementById('task-list');
const countEl = document.getElementById('task-count');
const emptyEl = document.getElementById('empty-state');

let tasks = JSON.parse(localStorage.getItem('tasks') || '[]');

function save() {
  localStorage.setItem('tasks', JSON.stringify(tasks));
}

function escapeText(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function render() {
  const query = searchInput.value.trim().toLowerCase();
  const visible = tasks.map((title, index) => ({ title, index }))
    .filter(task => task.title.toLowerCase().includes(query));
  list.innerHTML = visible.map(({ title: t, index: i }) => {
    return '<li>' +
      '<span class="title">' + escapeText(t) + '</span>' +
      '<input type="text" class="edit-input" id="edit-input-' + i + '" data-testid="edit-input-' + i + '" aria-label="Edit task title" hidden>' +
      '<button data-testid="edit-' + i + '" data-action="edit" data-index="' + i + '">Edit</button>' +
      '<button data-testid="save-' + i + '" data-action="save" data-index="' + i + '" hidden>Save</button>' +
      '<button data-testid="delete-' + i + '" data-action="delete" data-index="' + i + '">Delete</button>' +
      '</li>';
  }).join('');
  countEl.textContent = 'Tasks: ' + tasks.length;
  emptyEl.hidden = !(query && visible.length === 0);
}

form.addEventListener('submit', e => {
  e.preventDefault();
  const value = titleInput.value.trim();
  if (!value) {
    titleError.hidden = false;
    return;
  }
  titleError.hidden = true;
  tasks.push(value);
  titleInput.value = '';
  save();
  render();
});

list.addEventListener('click', e => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const i = Number(btn.dataset.index);
  const li = btn.closest('li');
  if (action === 'edit') {
    li.querySelector('.edit-input').hidden = false;
    li.querySelector('.edit-input').value = tasks[i];
    li.querySelector('[data-action="save"]').hidden = false;
    btn.hidden = true;
  } else if (action === 'save') {
    const input = li.querySelector('.edit-input');
    const value = input.value.trim();
    if (value) tasks[i] = value;
    save();
    render();
  } else if (action === 'delete') {
    if (confirm('Delete this task?')) {
      tasks.splice(i, 1);
      save();
      render();
    }
  }
});

searchInput.addEventListener('input', render);

render();
