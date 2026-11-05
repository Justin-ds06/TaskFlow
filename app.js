// ---------- 1. DATA (the single source of truth) ----------
const STORAGE_KEY = "taskflow.tasks";
const THEME_KEY = "taskflow.theme";
let tasks = [];                                   // array of task objects

// ---------- 2. SHORTCUTS TO PAGE ELEMENTS ----------
const $ = (id) => document.getElementById(id);
const searchInput = $("searchInput"), taskList = $("taskList"), emptyMessage = $("emptyMessage");
const dialog = $("taskDialog"), form = $("taskForm");
const fields = { title: $("title"), description: $("description"), dueDate: $("dueDate"), category: $("category") };

// ---------- 3. SMALL HELPERS ----------
function today() {                                // today as "YYYY-MM-DD"
  return new Date().toLocaleDateString("en-CA");
}
function isOverdue(task) {                        // not done, has a date, date is before today
  return !task.completed && task.dueDate && task.dueDate < today();
}
function escapeHtml(text) {                       // stops typed text from being run as HTML
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ---------- 4. STORAGE: saveData() and loadData() ----------
function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}
function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    tasks = Array.isArray(saved) ? saved : [];
  } catch (error) {
    tasks = [];                                   // corrupted data -> start with an empty list
  }
  renderTasks();
}

// ---------- 5. VALIDATION ----------
function showError(name, message) {
  $(name + "Error").textContent = message;
  fields[name].classList.toggle("invalid", message !== "");
}
function validateField(name) {                    // checks ONE field, returns true if OK
  const value = fields[name].value.trim();
  let message = "";

  if (name === "title") {
    if (value === "") message = "Enter a title.";
    else if (value.length > 80) message = "Title must be 80 characters or fewer.";
  }
  if (name === "description" && value.length > 300) {
    message = "Description must be 300 characters or fewer.";
  }
  if (name === "category" && value === "") {
    message = "Choose a category.";
  }
  if (name === "dueDate" && value !== "") {
    const isNewTask = $("taskId").value === "";
    if (isNaN(new Date(value))) message = "Enter a valid date.";
    else if (isNewTask && value < today()) message = "Due date cannot be in the past.";
  }
  showError(name, message);
  return message === "";
}
function validateForm() {                         // checks ALL fields
  const results = Object.keys(fields).map(validateField);   // run every check
  return results.every(Boolean);                            // true only if all passed
}

// ---------- 6. FORM DIALOG: addTask(), editTask(), closeForm() ----------
function addTask() {                              // opens an empty form
  form.reset();
  $("taskId").value = "";
  $("dialogTitle").textContent = "Add task";
  Object.keys(fields).forEach((name) => showError(name, ""));
  dialog.showModal();
  fields.title.focus();
}
function editTask(id) {                           // opens the form filled with a task
  const task = tasks.find((t) => t.id === id);
  addTask();
  $("dialogTitle").textContent = "Edit task";
  $("taskId").value = task.id;
  fields.title.value = task.title;
  fields.description.value = task.description;
  fields.dueDate.value = task.dueDate;
  $("priority").value = task.priority;
  $("category").value = task.category;
}
function closeForm() {
  dialog.close();
}

// Runs when the form is submitted: validate first, then save
function handleSubmit(event) {
  event.preventDefault();
  if (!validateForm()) return;                    // errors stay on screen, form stays open

  const id = $("taskId").value;
  const data = {
    title: fields.title.value.trim(),
    description: fields.description.value.trim(),
    dueDate: fields.dueDate.value,
    priority: $("priority").value,
    category: $("category").value,
  };

  if (id) {
    Object.assign(tasks.find((t) => t.id === id), data);        // update existing task
  } else {
    const now = Date.now();
    tasks.push({ id: "t_" + now, completed: false, createdAt: now, ...data });  // new task
  }
  saveData();
  renderTasks();
  closeForm();
}

// ---------- 7. TASK ACTIONS: toggleComplete(), deleteTask() ----------
function toggleComplete(id) {
  const task = tasks.find((t) => t.id === id);
  task.completed = !task.completed;
  saveData();
  renderTasks();
}
function deleteTask(id) {
  if (!confirm("Delete this task?")) return;
  tasks = tasks.filter((t) => t.id !== id);
  saveData();
  renderTasks();
}

// ---------- 8. SEARCH, FILTER, SORT ----------
const filterChoices = {
  status:   { label: "Status",   values: ["All", "Active", "Completed"] },
  priority: { label: "Priority", values: ["All", "High", "Medium", "Low"] },
  category: { label: "Category", values: ["All", "School", "Work", "Personal", "Home"] },
  sort:     { label: "Sort",     values: ["Due date", "Priority", "Newest"] },
};
const filterPosition = { status: 0, priority: 0, category: 0, sort: 0 };   // which choice is selected

function currentFilter(name) {                    // e.g. currentFilter("status") -> "All"
  return filterChoices[name].values[filterPosition[name]];
}
function cycleFilter(button) {                    // runs when a chip is clicked
  const name = button.dataset.filter;
  filterPosition[name] = (filterPosition[name] + 1) % filterChoices[name].values.length;
  button.textContent = filterChoices[name].label + ": " + currentFilter(name);
  button.classList.toggle("active", name !== "sort" && filterPosition[name] !== 0);
  renderTasks();
}

function searchTasks() {                          // runs on every keystroke in the search box
  renderTasks();
}
function applyFilters() {                         // returns the tasks that should be shown
  const text = searchInput.value.trim().toLowerCase();
  const status = currentFilter("status");
  const category = currentFilter("category");
  const priority = currentFilter("priority");
  const sortBy = currentFilter("sort");

  const result = tasks.filter((t) => {
    const matchesText = (t.title + " " + t.description).toLowerCase().includes(text);
    const matchesStatus = status === "All" || (status === "Completed") === t.completed;
    const matchesCategory = category === "All" || t.category === category;
    const matchesPriority = priority === "All" || t.priority === priority;
    return matchesText && matchesStatus && matchesCategory && matchesPriority;
  });

  const rank = { High: 0, Medium: 1, Low: 2 };
  result.sort((a, b) => {
    if (sortBy === "Priority") return rank[a.priority] - rank[b.priority];
    if (sortBy === "Due date") return (a.dueDate || "9999").localeCompare(b.dueDate || "9999");
    return b.createdAt - a.createdAt;             // default: newest first
  });
  return result;
}

// ---------- 9. DRAWING THE SCREEN: renderTasks(), updateStats() ----------
function renderTasks() {
  const visible = applyFilters();

  taskList.innerHTML = visible.map((t) => `
    <li class="task ${t.completed ? "done" : ""} ${isOverdue(t) ? "overdue" : ""}">
      <input type="checkbox" data-id="${t.id}" ${t.completed ? "checked" : ""} aria-label="Mark done">
      <div class="task-body">
        <div class="task-title">${escapeHtml(t.title)}</div>
        ${t.description ? `<p class="task-desc">${escapeHtml(t.description)}</p>` : ""}
        <p class="task-meta">${t.category}
          ${t.dueDate ? `· <span class="due">${isOverdue(t) ? "Overdue " : "Due "}${t.dueDate}</span>` : ""}
        </p>
      </div>
      <span class="badge ${t.priority}">${t.priority}</span>
      <div class="task-buttons">
        <button class="btn" data-action="edit" data-id="${t.id}">Edit</button>
        <button class="btn" data-action="delete" data-id="${t.id}">Del</button>
      </div>
    </li>`).join("");

  // Friendly message when nothing is shown
  emptyMessage.hidden = visible.length > 0;
  emptyMessage.textContent = tasks.length === 0
    ? "No tasks yet. Click “Add task” to create your first one."
    : "No tasks match your search or filters.";

  updateStats();
}
function updateStats() {
  const total = tasks.length;
  const done = tasks.filter((t) => t.completed).length;
  const overdue = tasks.filter(isOverdue).length;
  $("statTotal").textContent = total;
  $("statDone").textContent = done;
  $("statOverdue").textContent = overdue;
  $("progressBar").style.width = (total ? (done / total) * 100 : 0) + "%";
}

// ---------- 10. BACKUP: exportData(), importData() ----------
function exportData() {
  const file = new Blob([JSON.stringify(tasks, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(file);
  link.download = "taskflow-backup.json";
  link.click();
  URL.revokeObjectURL(link.href);
}
function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!Array.isArray(imported)) throw new Error("Not a list");
      const valid = imported.filter((t) => t && typeof t.title === "string" && t.title.trim() && t.id);
      const known = new Set(tasks.map((t) => t.id));
      const fresh = valid.filter((t) => !known.has(t.id));      // skip tasks we already have
      tasks = tasks.concat(fresh);
      saveData();
      renderTasks();
      alert(fresh.length + " task(s) imported.");
    } catch (error) {
      alert("This file is not a valid TaskFlow backup.");
    }
  };
  reader.readAsText(file);
  event.target.value = "";                        // lets the same file be chosen again
}

// ---------- 11. THEME AND MOBILE MENU ----------
function toggleTheme() {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem(THEME_KEY, next);          // remembered for the next visit
}
function loadTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  document.documentElement.dataset.theme = saved || "dark";
}

// ---------- 12. EVENT LISTENERS (see the Event Map, Appendix C) ----------
$("addBtn").addEventListener("click", addTask);                 // row 1
searchInput.addEventListener("input", searchTasks);             // row 2
form.addEventListener("submit", handleSubmit);                  // rows 3-4
$("cancelBtn").addEventListener("click", closeForm);            // row 13
dialog.addEventListener("cancel", (e) => { e.preventDefault(); closeForm(); });  // Esc key
Object.keys(fields).forEach((name) =>                           // row 12
  fields[name].addEventListener("input", () => validateField(name)));

// Filter and sort buttons: each click picks the next choice and re-draws the list (row 8)
document.querySelectorAll(".chip").forEach((chip) =>
  chip.addEventListener("click", () => cycleFilter(chip)));

// One listener for the whole list (works for tasks added later)
taskList.addEventListener("change", (e) => {                    // row 5
  if (e.target.type === "checkbox") toggleComplete(e.target.dataset.id);
});
taskList.addEventListener("click", (e) => {                     // rows 6-7
  const { action, id } = e.target.dataset;
  if (action === "edit") editTask(id);
  if (action === "delete") deleteTask(id);
});

$("exportBtn").addEventListener("click", exportData);           // row 10
$("importBtn").addEventListener("click", () => $("importFile").click());
$("importFile").addEventListener("change", importData);         // row 14
$("themeBtn").addEventListener("click", toggleTheme);           // row 11

// Start the app when the page is ready (row 9)
document.addEventListener("DOMContentLoaded", () => {
  loadTheme();
  loadData();
});
