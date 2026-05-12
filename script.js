const STORAGE_KEYS = {
  sessions: "pomodoro.completedSessions",
  focusMinutes: "pomodoro.focusMinutes",
  durations: "pomodoro.durations",
  theme: "pomodoro.theme",
  tasks: "pomodoro.tasks",
};

const DEFAULT_DURATIONS = {
  pomodoro: 25,
  shortBreak: 5,
  longBreak: 15,
};

const MODE_LABELS = {
  pomodoro: "Pomodoro",
  shortBreak: "Short Break",
  longBreak: "Long Break",
};

const QUOTES = [
  "Focus is the art of choosing what gets your best attention.",
  "Small sessions compound into serious progress.",
  "You do not need more time. You need a clearer next step.",
  "Protect your attention and the work will start to breathe.",
  "Progress loves a quiet room and a visible timer.",
  "One focused interval can rescue an entire day.",
];

const state = {
  mode: "pomodoro",
  durations: loadJSON(STORAGE_KEYS.durations, DEFAULT_DURATIONS),
  remainingSeconds: DEFAULT_DURATIONS.pomodoro * 60,
  totalSeconds: DEFAULT_DURATIONS.pomodoro * 60,
  isRunning: false,
  timerId: null,
  completedSessions: Number(localStorage.getItem(STORAGE_KEYS.sessions)) || 0,
  focusMinutes: Number(localStorage.getItem(STORAGE_KEYS.focusMinutes)) || 0,
  tasks: loadJSON(STORAGE_KEYS.tasks, []),
};

const elements = {
  timeDisplay: document.querySelector("#timeDisplay"),
  statusText: document.querySelector("#statusText"),
  startPauseBtn: document.querySelector("#startPauseBtn"),
  resetBtn: document.querySelector("#resetBtn"),
  progressRing: document.querySelector("#progressRing"),
  modeButtons: document.querySelectorAll(".mode-btn"),
  currentModeLabel: document.querySelector("#currentModeLabel"),
  sessionCount: document.querySelector("#sessionCount"),
  focusMinutes: document.querySelector("#focusMinutes"),
  cycleCount: document.querySelector("#cycleCount"),
  quoteText: document.querySelector("#quoteText"),
  durationForm: document.querySelector("#durationForm"),
  pomodoroInput: document.querySelector("#pomodoroInput"),
  shortBreakInput: document.querySelector("#shortBreakInput"),
  longBreakInput: document.querySelector("#longBreakInput"),
  themeToggle: document.querySelector("#themeToggle"),
  themeLabel: document.querySelector(".theme-label"),
  focusModeBtn: document.querySelector("#focusModeBtn"),
  taskForm: document.querySelector("#taskForm"),
  taskInput: document.querySelector("#taskInput"),
  taskList: document.querySelector("#taskList"),
  clearTasksBtn: document.querySelector("#clearTasksBtn"),
};

const ringRadius = Number(elements.progressRing.getAttribute("r"));
const ringCircumference = 2 * Math.PI * ringRadius;
elements.progressRing.style.strokeDasharray = `${ringCircumference}`;
elements.progressRing.style.strokeDashoffset = "0";

initializeApp();

function initializeApp() {
  state.durations = { ...DEFAULT_DURATIONS, ...state.durations };
  state.remainingSeconds = state.durations[state.mode] * 60;
  state.totalSeconds = state.remainingSeconds;

  hydrateDurationInputs();
  applySavedTheme();
  renderTimer();
  renderStats();
  renderTasks();
  showRandomQuote();
  bindEvents();
}

function bindEvents() {
  elements.startPauseBtn.addEventListener("click", toggleTimer);
  elements.resetBtn.addEventListener("click", resetTimer);
  elements.durationForm.addEventListener("submit", handleDurationSubmit);
  elements.themeToggle.addEventListener("click", toggleTheme);
  elements.focusModeBtn.addEventListener("click", toggleFocusMode);
  elements.taskForm.addEventListener("submit", addTask);
  elements.clearTasksBtn.addEventListener("click", clearCompletedTasks);

  elements.modeButtons.forEach((button) => {
    button.addEventListener("click", () => switchMode(button.dataset.mode));
  });

  document.addEventListener("keydown", handleKeyboardShortcuts);
}

function toggleTimer() {
  if (state.isRunning) {
    pauseTimer();
    return;
  }

  startTimer();
}

function startTimer() {
  if (state.isRunning) return;

  state.isRunning = true;
  elements.startPauseBtn.textContent = "Pause";
  elements.statusText.textContent = "In progress";

  state.timerId = window.setInterval(() => {
    state.remainingSeconds -= 1;
    renderTimer();

    if (state.remainingSeconds <= 0) {
      completeSession();
    }
  }, 1000);
}

function pauseTimer() {
  state.isRunning = false;
  window.clearInterval(state.timerId);
  elements.startPauseBtn.textContent = "Start";
  elements.statusText.textContent = "Paused";
}

function resetTimer() {
  pauseTimer();
  state.remainingSeconds = state.totalSeconds;
  elements.statusText.textContent = "Ready to focus";
  renderTimer();
}

function completeSession() {
  pauseTimer();
  state.remainingSeconds = 0;
  renderTimer();
  playNotificationSound();
  showRandomQuote();

  if (state.mode === "pomodoro") {
    state.completedSessions += 1;
    state.focusMinutes += state.durations.pomodoro;
    localStorage.setItem(STORAGE_KEYS.sessions, String(state.completedSessions));
    localStorage.setItem(STORAGE_KEYS.focusMinutes, String(state.focusMinutes));
    renderStats();
  }

  elements.statusText.textContent = `${MODE_LABELS[state.mode]} complete`;
}

function switchMode(mode) {
  if (!MODE_LABELS[mode]) return;

  pauseTimer();
  state.mode = mode;
  state.totalSeconds = state.durations[mode] * 60;
  state.remainingSeconds = state.totalSeconds;

  elements.modeButtons.forEach((button) => {
    const isActive = button.dataset.mode === mode;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  elements.currentModeLabel.textContent = MODE_LABELS[mode];
  elements.statusText.textContent = mode === "pomodoro" ? "Ready to focus" : "Ready to recharge";
  renderTimer();
  showRandomQuote();
}

function renderTimer() {
  const formattedTime = formatTime(state.remainingSeconds);
  const progress = state.totalSeconds === 0 ? 0 : state.remainingSeconds / state.totalSeconds;
  const dashOffset = ringCircumference * (1 - progress);

  elements.timeDisplay.textContent = formattedTime;
  elements.timeDisplay.setAttribute("datetime", `PT${Math.ceil(state.remainingSeconds / 60)}M`);
  elements.progressRing.style.strokeDashoffset = `${dashOffset}`;
  document.title = `(${formattedTime}) Pomodoro Timer`;
}

function renderStats() {
  elements.sessionCount.textContent = state.completedSessions;
  elements.focusMinutes.textContent = state.focusMinutes;
  elements.cycleCount.textContent = Math.floor(state.completedSessions / 4);
}

function handleDurationSubmit(event) {
  event.preventDefault();

  state.durations = {
    pomodoro: sanitizeDuration(elements.pomodoroInput.value, 25, 1, 120),
    shortBreak: sanitizeDuration(elements.shortBreakInput.value, 5, 1, 60),
    longBreak: sanitizeDuration(elements.longBreakInput.value, 15, 1, 90),
  };

  localStorage.setItem(STORAGE_KEYS.durations, JSON.stringify(state.durations));
  pauseTimer();
  switchMode(state.mode);
  hydrateDurationInputs();
  elements.statusText.textContent = "Durations updated";
}

function hydrateDurationInputs() {
  elements.pomodoroInput.value = state.durations.pomodoro;
  elements.shortBreakInput.value = state.durations.shortBreak;
  elements.longBreakInput.value = state.durations.longBreak;
}

function handleKeyboardShortcuts(event) {
  const activeElement = document.activeElement;
  const isTyping = activeElement && ["INPUT", "TEXTAREA"].includes(activeElement.tagName);

  if (isTyping) return;

  if (event.code === "Space") {
    event.preventDefault();
    toggleTimer();
  }

  if (event.key.toLowerCase() === "r") {
    resetTimer();
  }
}

function toggleTheme() {
  const isLight = document.body.classList.toggle("light-theme");
  localStorage.setItem(STORAGE_KEYS.theme, isLight ? "light" : "dark");
  elements.themeLabel.textContent = isLight ? "Light" : "Dark";
  elements.themeToggle.setAttribute("aria-label", `Toggle ${isLight ? "dark" : "light"} mode`);
}

function applySavedTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.theme);
  const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
  const shouldUseLight = savedTheme ? savedTheme === "light" : prefersLight;

  document.body.classList.toggle("light-theme", shouldUseLight);
  elements.themeLabel.textContent = shouldUseLight ? "Light" : "Dark";
}

function toggleFocusMode() {
  document.body.classList.toggle("focus-mode");

  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
}

function addTask(event) {
  event.preventDefault();

  const title = elements.taskInput.value.trim();
  if (!title) return;

  state.tasks.unshift({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    title,
    completed: false,
  });

  elements.taskInput.value = "";
  saveTasks();
  renderTasks();
}

function renderTasks() {
  elements.taskList.innerHTML = "";

  if (state.tasks.length === 0) {
    const emptyState = document.createElement("li");
    emptyState.className = "empty-state";
    emptyState.textContent = "No tasks yet. Add one clear target for your next session.";
    elements.taskList.append(emptyState);
    return;
  }

  state.tasks.forEach((task) => {
    const item = document.createElement("li");
    item.className = `task-item${task.completed ? " completed" : ""}`;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.completed;
    checkbox.setAttribute("aria-label", `Mark ${task.title} as complete`);
    checkbox.addEventListener("change", () => toggleTask(task.id));

    const title = document.createElement("span");
    title.textContent = task.title;

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-task";
    deleteButton.type = "button";
    deleteButton.textContent = "x";
    deleteButton.setAttribute("aria-label", `Delete ${task.title}`);
    deleteButton.addEventListener("click", () => deleteTask(task.id));

    item.append(checkbox, title, deleteButton);
    elements.taskList.append(item);
  });
}

function toggleTask(taskId) {
  state.tasks = state.tasks.map((task) =>
    task.id === taskId ? { ...task, completed: !task.completed } : task
  );
  saveTasks();
  renderTasks();
}

function deleteTask(taskId) {
  state.tasks = state.tasks.filter((task) => task.id !== taskId);
  saveTasks();
  renderTasks();
}

function clearCompletedTasks() {
  state.tasks = state.tasks.filter((task) => !task.completed);
  saveTasks();
  renderTasks();
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(state.tasks));
}

function showRandomQuote() {
  const randomIndex = Math.floor(Math.random() * QUOTES.length);
  elements.quoteText.textContent = QUOTES[randomIndex];
}

function playNotificationSound() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  const audioContext = new AudioContext();
  const notes = [660, 880, 990];

  notes.forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const startTime = audioContext.currentTime + index * 0.13;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, startTime);
    gainNode.gain.setValueAtTime(0.0001, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.18, startTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.16);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + 0.18);
  });
}

function formatTime(totalSeconds) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function sanitizeDuration(value, fallback, min, max) {
  const number = Number.parseInt(value, 10);
  if (Number.isNaN(number)) return fallback;
  return Math.min(Math.max(number, min), max);
}

function loadJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}
