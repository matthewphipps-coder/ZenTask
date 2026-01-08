import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, writeBatch, serverTimestamp, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAUJwnbz_fwtNF1i2NSbLyjYOg9GdbTZAk",
    authDomain: "zentask-bee2a.firebaseapp.com",
    projectId: "zentask-bee2a",
    storageBucket: "zentask-bee2a.firebasestorage.app",
    messagingSenderId: "699307516136",
    appId: "1:699307516136:web:43cb29051706e23395695d",
    measurementId: "G-2QF43C996F"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
enableIndexedDbPersistence(db).catch(err => {
    if (err.code == 'failed-precondition') {
        console.warn('Persistence failed: Multiple tabs open');
    } else if (err.code == 'unimplemented') {
        console.warn('Persistence not supported by browser');
    }
});

// State management
let tasks = []; // Synced with Firebase
let customCategories = []; // Synced with Firebase
let currentFilter = { type: 'status', value: 'all' }; // Default filter
let searchQuery = '';
let isDarkMode = localStorage.getItem('zenTheme') !== 'light';

// Initialize Confetti
const confetti = new window.Confetti('confetti-canvas');

// DOM Elements
const taskInput = document.getElementById('task-input');
const searchInput = document.getElementById('search-input');
const taskList = document.getElementById('task-list');
const countTodo = document.getElementById('count-todo');
const statsAll = document.getElementById('stats-all');
const statsCompleted = document.getElementById('stats-completed');
const currentDateEl = document.getElementById('current-date');
const themeBtn = document.getElementById('theme-btn');
const customFilters = document.getElementById('custom-filters');
const statusFiltersList = document.getElementById('status-filters');
const addCategoryBtn = document.getElementById('add-category-btn');

// Modal Elements
const categoryModal = document.getElementById('category-modal');
const modalCategoryInput = document.getElementById('modal-category-input');
const modalCreateBtn = document.getElementById('modal-create-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');

// Mobile Menu Logic
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const sidebar = document.querySelector('.sidebar');
const mainContent = document.querySelector('.main-content');

if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sidebar.classList.toggle('active');
    });

    // Close sidebar when clicking outside
    document.addEventListener('click', (e) => {
        if (sidebar.classList.contains('active') &&
            !sidebar.contains(e.target) &&
            e.target !== mobileMenuBtn) {
            sidebar.classList.remove('active');
        }
    });

    sidebar.addEventListener('click', (e) => {
        if (window.innerWidth <= 900) {
            if (e.target.closest('button')) {
                sidebar.classList.remove('active');
            }
        }
    });
}

// Initialize date
const updateDate = () => {
    const options = { weekday: 'long', month: 'short', day: 'numeric' };
    currentDateEl.textContent = new Date().toLocaleDateString('en-US', options);
};

// --- Statistics Update ---
const updateStats = () => {
    const activeTasksCount = tasks.filter(t => !t.completed).length;
    const completedTasksCount = tasks.filter(t => t.completed).length;

    if (countTodo) countTodo.textContent = activeTasksCount;
    if (statsAll) statsAll.textContent = tasks.length;
    if (statsCompleted) statsCompleted.textContent = completedTasksCount;
};

// --- Data Migration (Events) ---
const migrateDataIfNeeded = async () => {
    const localTasks = JSON.parse(localStorage.getItem('zenTasks'));
    const localCats = JSON.parse(localStorage.getItem('zenCategories'));

    // If we have local data but DB is empty, let's migrate
    // Note: This is a simple check. Robust apps might need more complex logic.
    if (tasks.length === 0 && localTasks && localTasks.length > 0) {
        console.log("Migrating tasks to Firebase...");
        const batch = writeBatch(db);

        localTasks.forEach(t => {
            const ref = doc(collection(db, "tasks"));
            batch.set(ref, {
                text: t.text,
                completed: t.completed || false,
                priority: t.priority || 'medium',
                status: t.status || 'today',
                category: t.category || null,
                createdAt: t.createdAt || new Date().toISOString(),
                order: t.order || Date.now() // Ensure order exists
            });
        });

        await batch.commit();
        console.log("Migration complete. Clearing local storage.");
        localStorage.removeItem('zenTasks');
    }

    if (customCategories.length === 0 && localCats && localCats.length > 0) {
        console.log("Migrating categories...");
        const batch = writeBatch(db);
        localCats.forEach(c => {
            const ref = doc(collection(db, "categories"));
            batch.set(ref, { name: c, createdAt: new Date().toISOString() });
        });
        await batch.commit();
        localStorage.removeItem('zenCategories');
    }
};

// --- Firebase Listeners ---

// 1. Tasks Listener
const q = query(collection(db, "tasks"), orderBy("order", "desc"));
onSnapshot(q, (snapshot) => {
    tasks = [];
    snapshot.forEach((doc) => {
        tasks.push({ id: doc.id, ...doc.data() });
    });
    // Attempt migration once we know state of DB
    migrateDataIfNeeded();
    renderTasks();
});

// 2. Categories Listener
const catQuery = query(collection(db, "categories"), orderBy("createdAt"));
onSnapshot(catQuery, (snapshot) => {
    customCategories = [];
    snapshot.forEach((doc) => {
        customCategories.push({ id: doc.id, ...doc.data() });
    });
    renderFilters();
});


// --- DOM Creation ---

const createTaskElement = (task) => {
    const li = document.createElement('li');
    li.className = `task-item ${task.completed ? 'completed' : ''} priority-${task.priority}`;
    li.dataset.id = task.id;
    li.draggable = true;

    li.innerHTML = `
        <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
        <div class="task-content">
            <span class="task-text">${task.text}</span>
            <div class="task-metadata">
                <button class="priority-dot priority-${task.priority}" title="Change Priority"></button>
                ${task.status !== currentFilter.value ? `<span class="status-indicator">${task.status}</span>` : ''}
                ${task.category && task.category !== currentFilter.value ? `<span class="category-indicator">${task.category}</span>` : ''}
            </div>
        </div>
        <button class="delete-task" title="Delete">×</button>
    `;

    // Events
    li.querySelector('.priority-dot').addEventListener('click', (e) => {
        e.stopPropagation();
        cyclePriority(task.id, task.priority);
    });

    li.querySelector('.task-checkbox').addEventListener('change', () => toggleTask(task));
    li.querySelector('.delete-task').addEventListener('click', () => deleteTask(task.id));

    // Drag & Drop
    li.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', task.id);
        li.classList.add('dragging');
    });

    li.addEventListener('dragend', () => {
        li.classList.remove('dragging');
        document.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(el => el.classList.remove('drag-over-top', 'drag-over-bottom'));
    });

    li.addEventListener('dragover', (e) => {
        e.preventDefault();
        const draggingTask = document.querySelector('.dragging');
        if (draggingTask === li) return;

        const rect = li.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;

        li.classList.remove('drag-over-top', 'drag-over-bottom');
        if (e.clientY < midY) li.classList.add('drag-over-top');
        else li.classList.add('drag-over-bottom');
    });

    li.addEventListener('dragleave', () => li.classList.remove('drag-over-top', 'drag-over-bottom'));

    li.addEventListener('drop', (e) => {
        e.preventDefault();
        const draggingId = e.dataTransfer.getData('text/plain'); // Firebase IDs are strings
        li.classList.remove('drag-over-top', 'drag-over-bottom');

        if (draggingId && draggingId !== task.id) {
            const rect = li.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            const position = e.clientY < midY ? 'before' : 'after';
            reorderTasks(draggingId, task.id, position);
        }
    });

    return li;
};

// --- Render Logic ---
const renderTasks = () => {
    taskList.innerHTML = '';

    // Client-side filtering
    const filteredTasks = tasks.filter(task => {
        let matchesFilter = true;
        if (currentFilter.type === 'status') {
            if (currentFilter.value === 'all') matchesFilter = true;
            else if (currentFilter.value === 'completed') matchesFilter = task.completed;
            else if (currentFilter.value === 'today') matchesFilter = !task.completed && (task.status === 'today' || !task.status);
            else if (currentFilter.value === 'upcoming') matchesFilter = !task.completed && task.status === 'upcoming';
        } else if (currentFilter.type === 'category') {
            matchesFilter = task.category === currentFilter.value;
        }
        const matchesSearch = task.text.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    if (filteredTasks.length === 0) {
        taskList.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">✨</span>
                <p>No tasks found.</p>
            </div>`;
    } else {
        filteredTasks.forEach(task => taskList.appendChild(createTaskElement(task)));
    }
    updateStats();
};

const renderFilters = () => {
    customFilters.innerHTML = '';
    customCategories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = `filter-btn ${currentFilter.type === 'category' && currentFilter.value === cat.name ? 'active' : ''}`;
        btn.innerHTML = `<span class="delete-cat" title="Delete Group">✕</span> ${cat.name}`;

        btn.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-cat')) deleteCategory(cat.id);
            else setFilter('category', cat.name);
        });

        // Drop zone for categorizing tasks
        btn.addEventListener('dragover', (e) => {
            e.preventDefault();
            btn.classList.add('drag-over');
        });
        btn.addEventListener('dragleave', () => btn.classList.remove('drag-over'));
        btn.addEventListener('drop', (e) => {
            e.preventDefault();
            btn.classList.remove('drag-over');
            const taskId = e.dataTransfer.getData('text/plain');
            updateDoc(doc(db, "tasks", taskId), { category: cat.name });
        });

        customFilters.appendChild(btn);
    });
};

const setFilter = (type, value) => {
    currentFilter = { type, value };
    document.querySelectorAll('.filter-btn').forEach(b => {
        // Handle both static and dynamic filter buttons
        const bValue = b.dataset.filterValue || b.textContent.trim().replace('✕', '').trim();
        const bType = b.dataset.filterType || 'category';

        // Simple check
        if (type === 'category') {
            b.classList.toggle('active', b.innerHTML.includes(value));
        } else {
            b.classList.toggle('active', b.dataset.filterType === type && b.dataset.filterValue === value);
        }
    });
    renderTasks();
};


// --- Actions (Firebase Writes) ---

const addTask = async () => {
    try {
        const text = taskInput.value.trim();
        if (!text) return;

        // Optimistically clear input
        taskInput.value = '';

        let category = currentFilter.type === 'category' ? currentFilter.value : null;
        let status = 'today';
        if (currentFilter.type === 'status' && currentFilter.value === 'upcoming') status = 'upcoming';

        await addDoc(collection(db, "tasks"), {
            text,
            completed: false,
            priority: 'medium',
            status,
            category,
            createdAt: new Date().toISOString(),
            order: Date.now() // Simple timestamp ordering (Higher = newer, so we sort DESC)
        });
    } catch (err) {
        console.error("Error adding task:", err);
        // Restore input on failure
        taskInput.value = text;
        alert("Error saving to cloud.");
    }
};

const toggleTask = async (task) => {
    const newVal = !task.completed;
    if (newVal) confetti.shoot();
    await updateDoc(doc(db, "tasks", task.id), { completed: newVal });
};

const deleteTask = async (id) => {
    if (confirm('Delete this task?')) {
        await deleteDoc(doc(db, "tasks", id));
    }
};

const cyclePriority = async (id, currentPriority) => {
    const priorities = ['low', 'medium', 'high'];
    let idx = priorities.indexOf(currentPriority);
    let next = priorities[(idx + 1) % priorities.length];
    await updateDoc(doc(db, "tasks", id), { priority: next });
};

const addCategory = async () => {
    const name = modalCategoryInput.value.trim().toLowerCase();
    if (!name) return;

    // Check local duplicate (from firebase sync state)
    if (customCategories.some(c => c.name === name)) {
        alert('Group exists');
        return;
    }

    try {
        await addDoc(collection(db, "categories"), { name, createdAt: new Date().toISOString() });
        closeCategoryModal();
    } catch (e) {
        console.error(e);
        alert("Error creating group");
    }
};

const deleteCategory = async (id) => {
    if (confirm('Delete this group?')) {
        await deleteDoc(doc(db, "categories", id));
        if (currentFilter.type === 'category') setFilter('status', 'all');
    }
};

// --- Reorder Logic (Hardest part with DB) ---
// We use 'order' field.
// If inserting between A (order 500) and B (order 400), new order is 450.
const reorderTasks = async (draggedId, targetId, position) => {
    const draggedTask = tasks.find(t => t.id === draggedId);
    const targetTask = tasks.find(t => t.id === targetId);

    if (!draggedTask || !targetTask) return;

    // We only reorder physically in the list, then calculate order value
    // Current tasks array is sorted by 'order' DESC.
    // Index 0 has highest order value.
    const targetIndex = tasks.findIndex(t => t.id === targetId);

    let newOrder;

    // NOTE: tasks list is sorted DESC (newest/highest first)
    // "Before" visually means "Higher Index"?? No.
    // Visual: Top -> Bottom.
    // List: [Item 0 (Order 100), Item 1 (Order 90)]
    // Drop "Before" Item 1 means put it between 0 and 1. Order ~ 95.

    // Let's get the neighbors based on Visual Position
    // We already have the sorted 'tasks' array which mirrors visual.
    let neighborPrev, neighborNext;

    if (position === 'before') {
        // Putting it above Target.
        // Target is the "lower bound" of our slot in terms of visual index (it moves down).
        // Actually: New visual index = targetIndex.
        // We need order between targetIndex-1 and targetIndex.
        neighborPrev = tasks[targetIndex - 1]; // Task above
        neighborNext = tasks[targetIndex];     // Task below (the target)

    } else {
        // Putting it after Target.
        // New visual index = targetIndex + 1.
        neighborPrev = tasks[targetIndex];     // Task above (the target)
        neighborNext = tasks[targetIndex + 1]; // Task below
    }

    // Edge Cases
    if (!neighborPrev) {
        // We are at the very top. New order = neighborNext.order + 1000?
        // Or if both null?
        newOrder = (neighborNext ? neighborNext.order : Date.now()) + 100000;
    } else if (!neighborNext) {
        // We are at the very bottom.
        newOrder = neighborPrev.order - 100000;
    } else {
        // Between two
        newOrder = (neighborPrev.order + neighborNext.order) / 2;
    }

    updateDoc(doc(db, "tasks", draggedId), { order: newOrder });
};


// --- UI Helpers ---
taskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addTask(); }
});
searchInput.addEventListener('input', (e) => { searchQuery = e.target.value; renderTasks(); });
themeBtn.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const isLight = document.body.classList.contains('light-theme');
    themeBtn.textContent = isLight ? '☀️ Light Mode' : '🌙 Dark Mode';
    localStorage.setItem('zenTheme', isLight ? 'light' : 'dark');
});

// Modal
function closeCategoryModal() {
    categoryModal.classList.remove('active');
    modalCategoryInput.value = '';
}

addCategoryBtn.addEventListener('click', () => { categoryModal.classList.add('active'); modalCategoryInput.focus(); });
modalCancelBtn.addEventListener('click', closeCategoryModal);
modalCreateBtn.addEventListener('click', addCategory);
modalCategoryInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        addCategory();
    }
});


// Init
if (!isDarkMode) {
    document.body.classList.add('light-theme');
    themeBtn.textContent = '☀️ Light Mode';
} else {
    themeBtn.textContent = '🌙 Dark Mode';
}

const initStatusFilters = () => {
    document.querySelectorAll('#status-filters .filter-btn').forEach(btn => {
        const type = btn.dataset.filterType;
        const value = btn.dataset.filterValue;

        btn.addEventListener('click', () => setFilter(type, value));

        // Drop zone for Status changing
        btn.addEventListener('dragover', (e) => {
            e.preventDefault();
            btn.classList.add('drag-over');
        });
        btn.addEventListener('dragleave', () => btn.classList.remove('drag-over'));
        btn.addEventListener('drop', async (e) => {
            e.preventDefault();
            btn.classList.remove('drag-over');
            const taskId = e.dataTransfer.getData('text/plain');

            if (!taskId) return;

            if (value === 'completed') {
                await updateDoc(doc(db, "tasks", taskId), { completed: true });
                confetti.shoot();
            } else if (['today', 'upcoming'].includes(value)) {
                await updateDoc(doc(db, "tasks", taskId), { status: value, completed: false });
            } else if (value === 'all') {
                // Dragging to 'All' generally implies resetting to a default 'active' state
                await updateDoc(doc(db, "tasks", taskId), { completed: false });
            }
        });
    });
};

// Expose for debugging/tests
window.ZenTask = {
    addTask,
    tasks: () => tasks,
    db
};

updateDate();
renderFilters();
initStatusFilters();
