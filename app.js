import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, orderBy, writeBatch, serverTimestamp, enableIndexedDbPersistence, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
const auth = getAuth(app);

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
let currentUser = null;
let unsubTasks = null;
let unsubCats = null;

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

const authModal = document.getElementById('auth-modal');
const userInfo = document.getElementById('user-info');
const userEmailDisplay = document.getElementById('user-email');
const userRoleBadge = document.getElementById('user-role-badge');
const logoutBtn = document.getElementById('logout-btn');
const themeIcon = document.getElementById('theme-icon');

// Task Detail & AI Elements
const taskDetailModal = document.getElementById('task-detail-modal');
const detailTaskName = document.getElementById('detail-task-name');
const detailTaskCheckbox = document.getElementById('detail-task-checkbox');
const detailTaskPriority = document.getElementById('detail-task-priority');
const detailTaskStatus = document.getElementById('detail-task-status');
const detailTaskCategory = document.getElementById('detail-task-category');
const detailTaskDescription = document.getElementById('detail-task-description');
const closeDetailBtn = document.getElementById('close-detail-btn');
const geminiChatHistory = document.getElementById('gemini-chat-history');
const geminiInput = document.getElementById('gemini-input');
const geminiSendBtn = document.getElementById('gemini-send-btn');
const aiProviderSelect = document.getElementById('ai-provider-select');
const chatMicBtn = document.getElementById('chat-mic-btn');
const chatAttachBtn = document.getElementById('chat-attach-btn');
const chatFileInput = document.getElementById('chat-file-input');
let currentAttachment = null;


// API Keys are now loaded from config.js (which is gitignored)
// For GitHub Pages or if config.js is missing, prompt user for API key
const GEMINI_API_KEY = window.API_CONFIG?.GEMINI_API_KEY ||
    localStorage.getItem('zenGeminiKey') ||
    "YOUR_GEMINI_API_KEY";
const CLAUDE_API_KEY = window.API_CONFIG?.CLAUDE_API_KEY ||
    localStorage.getItem('zenClaudeKey') ||
    "YOUR_CLAUDE_API_KEY";
const GEMINI_MODEL = 'gemini-1.5-flash-latest';
let selectedAIProvider = localStorage.getItem('zenAIProvider') || 'gemini'; // 'gemini' or 'claude'

// Debug: Check if API keys are loaded
console.log('API Config loaded:', window.API_CONFIG ? 'Yes' : 'No');
console.log('Gemini API Key:', GEMINI_API_KEY ? (GEMINI_API_KEY.substring(0, 10) + '...') : 'Not set');

// If no API key is set, prompt user (useful for GitHub Pages)
if (!window.API_CONFIG && GEMINI_API_KEY === "YOUR_GEMINI_API_KEY") {
    const savedKey = localStorage.getItem('zenGeminiKey');
    if (!savedKey) {
        console.log('No API key found. User will need to add it via settings or config.js');
    }
}

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
const migrateDataIfNeeded = async (userId) => {
    const localTasks = JSON.parse(localStorage.getItem('zenTasks'));
    const localCats = JSON.parse(localStorage.getItem('zenCategories'));

    if (tasks.length === 0 && localTasks && localTasks.length > 0) {
        console.log("Migrating tasks to Firebase...");
        const batch = writeBatch(db);
        localTasks.forEach(t => {
            const ref = doc(collection(db, "tasks"));
            batch.set(ref, {
                ...t,
                userId,
                createdAt: t.createdAt || new Date().toISOString(),
                order: t.order || Date.now()
            });
        });
        await batch.commit();
        localStorage.removeItem('zenTasks');
    }

    if (customCategories.length === 0 && localCats && localCats.length > 0) {
        console.log("Migrating categories...");
        const batch = writeBatch(db);
        localCats.forEach(c => {
            const ref = doc(collection(db, "categories"));
            batch.set(ref, { name: c, userId, createdAt: new Date().toISOString() });
        });
        await batch.commit();
        localStorage.removeItem('zenCategories');
    }
};

// --- Firebase Listeners ---

const setupListeners = (user, role) => {
    // Unsubscribe existing listeners if any
    if (unsubTasks) unsubTasks();
    if (unsubCats) unsubCats();

    if (!user) {
        tasks = [];
        customCategories = [];
        renderTasks();
        renderFilters();
        return;
    }

    const userId = user.uid;
    const isAdmin = role === 'admin';

    // 1. Tasks Listener
    let qTasks;
    if (isAdmin) {
        // Admin sees all tasks
        console.log("Admin mode: Fetching all tasks");
        qTasks = query(collection(db, "tasks"), orderBy("order", "desc"));
    } else {
        qTasks = query(collection(db, "tasks"), where("userId", "==", userId), orderBy("order", "desc"));
    }

    unsubTasks = onSnapshot(qTasks, (snapshot) => {
        tasks = [];
        snapshot.forEach((doc) => {
            tasks.push({ id: doc.id, ...doc.data() });
        });
        migrateDataIfNeeded(userId);
        renderTasks();
    }, (error) => {
        console.error("Firestore Tasks Error:", error);
        if (error.code === 'permission-denied' || error.message.includes("disabled")) {
            console.error("Cloud Sync Error: Firestore is either uninitialized or restricted by rules.");
            if (!window.firestoreWarned) {
                alert("Cloud Sync is not active. Please ensure you have clicked 'Create Database' in the Firebase Console (Firestore Database tab). Until then, tasks are only saved in your browser's local cache.");
                window.firestoreWarned = true;
            }
        }
    });

    // 2. Categories Listener
    // Note: Categories are still scoped to user for now, but we could make them global for Admin too if needed.
    const qCats = query(collection(db, "categories"), where("userId", "==", userId), orderBy("createdAt", "asc"));
    unsubCats = onSnapshot(qCats, (snapshot) => {
        customCategories = [];
        snapshot.forEach((doc) => {
            customCategories.push({ id: doc.id, ...doc.data() });
        });
        migrateDataIfNeeded(userId);
        renderFilters();
    }, (error) => {
        console.error("Firestore Categories Error:", error);
    });
};

// --- App Logic ---

const fetchUserRole = async (uid) => {
    try {
        const userDoc = await getDoc(doc(db, "users", uid));
        if (userDoc.exists()) {
            return userDoc.data().role;
        }
        return 'member'; // Default
    } catch (e) {
        console.error("Error fetching role:", e);
        return 'member';
    }
};

onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
        // Logged in
        if (userInfo) userInfo.classList.remove('hidden');
        if (userEmailDisplay) userEmailDisplay.textContent = user.email;

        // Fetch and display role
        const role = await fetchUserRole(user.uid);
        if (userRoleBadge) {
            userRoleBadge.textContent = role;
            userRoleBadge.className = `user-role-badge ${role.toLowerCase()}`;
        }

        setupListeners(user, role);
    } else {
        // Not logged in -> Redirect to login page
        window.location.href = 'login.html';
    }
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
    li.querySelector('.task-content').addEventListener('click', (e) => {
        if (!e.target.classList.contains('priority-dot')) {
            openTaskDetail(task);
        }
    });

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
        const isTop = e.clientY < midY;

        if (isTop) {
            if (!li.classList.contains('drag-over-top')) {
                li.classList.remove('drag-over-bottom');
                li.classList.add('drag-over-top');
            }
        } else {
            if (!li.classList.contains('drag-over-bottom')) {
                li.classList.remove('drag-over-top');
                li.classList.add('drag-over-bottom');
            }
        }
    });

    li.addEventListener('dragleave', () => {
        li.classList.remove('drag-over-top', 'drag-over-bottom');
    });

    li.addEventListener('drop', (e) => {
        e.preventDefault();
        li.classList.remove('drag-over-top', 'drag-over-bottom');

        const draggingId = e.dataTransfer.getData('text/plain');
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
        // 1. Bin Filter (Deleted tasks)
        if (currentFilter.value === 'bin') {
            return task.deleted === true;
        }

        // 2. Hide deleted tasks in all other views
        if (task.deleted === true) return false;

        let matchesFilter = true;
        if (currentFilter.type === 'status') {
            if (currentFilter.value === 'all') matchesFilter = !task.completed;
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
        if (currentFilter.type === 'status') {
            // Group by category
            const validCatNames = customCategories.map(c => c.name);
            const ungrouped = filteredTasks.filter(t => !t.category || !validCatNames.includes(t.category));

            // Ungrouped Tasks at the top
            ungrouped.forEach(task => taskList.appendChild(createTaskElement(task)));

            // Tasks grouped by category in sidebar order
            customCategories.forEach(cat => {
                const catTasks = filteredTasks.filter(t => t.category === cat.name);
                if (catTasks.length > 0) {
                    const header = document.createElement('div');
                    header.className = 'group-title';
                    header.textContent = cat.name;
                    taskList.appendChild(header);
                    catTasks.forEach(task => taskList.appendChild(createTaskElement(task)));
                }
            });
        } else {
            // Specific category filter - just list tasks
            filteredTasks.forEach(task => taskList.appendChild(createTaskElement(task)));
        }
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
    const text = taskInput.value.trim();
    if (!text) return;

    if (!currentUser) return; // Silent return as onAuthStateChanged handles redirect

    try {
        // Optimistically clear input
        taskInput.value = '';

        let category = currentFilter.type === 'category' ? currentFilter.value : null;
        let status = 'today';
        if (currentFilter.type === 'status' && currentFilter.value === 'upcoming') status = 'upcoming';

        await addDoc(collection(db, "tasks"), {
            text,
            completed: false,
            deleted: false,
            priority: 'medium',
            status,
            category,
            userId: currentUser.uid,
            createdAt: new Date().toISOString(),
            order: tasks.length > 0 ? Math.max(...tasks.map(t => t.order || 0)) + 1 : Date.now()
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
    if (confirm('Move this task to the Bin?')) {
        await updateDoc(doc(db, "tasks", id), { deleted: true });
    }
};

const cyclePriority = async (id, currentPriority) => {
    const priorities = ['low', 'medium', 'high'];
    let idx = priorities.indexOf(currentPriority);
    let next = priorities[(idx + 1) % priorities.length];
    await updateDoc(doc(db, "tasks", id), { priority: next });
};

// Modal Helpers
const closeCategoryModal = () => {
    console.log("Closing category modal...");
    if (categoryModal) categoryModal.classList.remove('active');
    if (modalCategoryInput) modalCategoryInput.value = '';
};

const addCategory = async () => {
    console.log("addCategory called");
    const name = modalCategoryInput.value.trim().toLowerCase();
    const errorMsg = document.getElementById('modal-error-msg');

    // Reset error state
    if (errorMsg) errorMsg.classList.remove('visible');
    modalCategoryInput.classList.remove('input-error');

    if (!name) {
        showError("Group name cannot be empty.");
        return;
    }

    // Check local duplicate (from firebase sync state)
    if (customCategories.some(c => c.name === name)) {
        showError("Group already exists.");
        return;
    }

    try {
        console.log("Saving category to DB...");
        addDoc(collection(db, "categories"), {
            name,
            userId: currentUser.uid,
            createdAt: new Date().toISOString()
        });
        closeCategoryModal();
    } catch (e) {
        console.error(e);
        showError("Error creating group.");
    }
};

const showError = (message) => {
    const errorMsg = document.getElementById('modal-error-msg');
    if (errorMsg) {
        errorMsg.textContent = message;
        errorMsg.classList.add('visible');
    } else {
        alert(message);
    }
    modalCategoryInput.classList.add('input-error');
    setTimeout(() => {
        modalCategoryInput.classList.remove('input-error');
    }, 500);
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

    // Get the visual list of IDs to find real neighbors in the current view
    const visualCards = Array.from(taskList.querySelectorAll('.task-item'));
    const visualIds = visualCards.map(c => c.dataset.id);

    const targetIndex = visualIds.indexOf(targetId);
    let neighborPrevId, neighborNextId;

    if (position === 'before') {
        neighborPrevId = visualIds[targetIndex - 1];
        neighborNextId = targetId;
    } else {
        neighborPrevId = targetId;
        neighborNextId = visualIds[targetIndex + 1];
    }

    const neighborPrev = tasks.find(t => t.id === neighborPrevId);
    const neighborNext = tasks.find(t => t.id === neighborNextId);

    let newOrder;
    if (!neighborPrev) {
        newOrder = (neighborNext ? neighborNext.order : Date.now()) + 100000;
    } else if (!neighborNext) {
        newOrder = neighborPrev.order - 100000;
    } else {
        newOrder = (neighborPrev.order + neighborNext.order) / 2;
    }

    const updates = { order: newOrder };

    // Update category if it moved to a different group
    if (draggedTask.category !== targetTask.category) {
        updates.category = targetTask.category || null;
    }

    await updateDoc(doc(db, "tasks", draggedId), updates);
};


// --- UI Helpers ---
taskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addTask(); }
});
searchInput.addEventListener('input', (e) => { searchQuery = e.target.value; renderTasks(); });
const toggleTheme = (isLight) => {
    document.body.classList.toggle('light-theme', isLight);
    if (themeIcon) {
        themeIcon.textContent = isLight ? 'light_mode' : 'dark_mode';
    }
    localStorage.setItem('zenTheme', isLight ? 'light' : 'dark');
};

themeBtn.addEventListener('click', () => {
    const isCurrentlyLight = document.body.classList.contains('light-theme');
    toggleTheme(!isCurrentlyLight);
});

// Event Listeners for Modal Logic are handled below

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
const savedTheme = localStorage.getItem('zenTheme');
const shouldBeLight = savedTheme === 'light' || (!savedTheme && !isDarkMode);
toggleTheme(shouldBeLight);

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
            } else if (value === 'bin') {
                await updateDoc(doc(db, "tasks", taskId), { deleted: true });
            } else if (value === 'all') {
                // Dragging to 'All' generally implies resetting to a default 'active' state
                await updateDoc(doc(db, "tasks", taskId), { completed: false });
            }
        });
    });
};

// --- AI Response Formatting & Chat History Utilities ---

// Formats AI responses by removing quotes, asterisks, and converting markdown to HTML
const formatAIResponse = (text) => {
    // Remove leading/trailing quotes
    text = text.replace(/^["']|["']$/g, '');


    // 1. Handle Code Blocks (pre-processing to protect them)
    const codeBlocks = [];
    text = text.replace(/```(\w+)?\n?([\s\S]*?)```/g, (match, lang, code) => {
        const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
        codeBlocks.push({ lang: lang || 'text', code: code.trim() });
        return placeholder;
    });

    // 2. Handle Inline Code
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

    // 3. Handle Bold Text
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*([a-zA-Z0-9][^*]+)\*/g, '<strong>$1</strong>'); // Handle single asterisks too, but more carefully

    // 4. Handle Lists (Numbered)
    text = text.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

    // 5. Handle Lists (Bullet) - dash, asterisk, bullet
    text = text.replace(/^[-*•]\s+(.+)$/gm, '<li>$1</li>');

    // 6. Wrap lists in ul/ol (simplified to ul for consistency)
    text = text.replace(/(<li>.*?<\/li>\n?)+/g, (match) => {
        return '<ul>' + match + '</ul>';
    });

    // 7. Handle Line Breaks & Paragraphs
    const paragraphs = text.split('\n\n').filter(p => p.trim());
    text = paragraphs.map(p => {
        // Restore code blocks first to check if paragraph is JUST a code block
        if (p.trim().startsWith('__CODE_BLOCK_')) {
            return p;
        }
        // Don't wrap if already has HTML tags like lists
        if (p.includes('<ul>') || p.includes('<ol>') || p.includes('<li>')) {
            return p;
        }
        return '<p>' + p.replace(/\n/g, '<br>') + '</p>';
    }).join('');

    // 8. Restore Code Blocks
    codeBlocks.forEach((block, index) => {
        const placeholder = `__CODE_BLOCK_${index}__`;
        const html = `<pre><code class="language-${block.lang}">${block.code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`;
        text = text.replace(placeholder, html);
    });

    return text;
};

// Save chat history to Firestore
const saveChatHistory = async (taskId, chatHistory) => {
    if (!currentUser || !taskId) return;

    try {
        await updateDoc(doc(db, "tasks", taskId), {
            chatHistory: chatHistory,
            lastChatUpdate: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error saving chat history:", error);
    }
};

// Load chat history from task
const loadChatHistory = (task) => {
    if (task.chatHistory && Array.isArray(task.chatHistory)) {
        return task.chatHistory;
    }
    return [];
};

// --- Task Detail & AI Logic ---
let activeTaskForDetail = null;
let currentChatHistory = [];

const addChatMessage = (role, text, saveToHistory = true) => {
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${role}`;

    const msgContent = document.createElement('div');
    msgContent.className = 'message-content';

    // Format AI responses
    if (role === 'ai') {
        // Ensure formatAIResponse exists, fallback if not
        if (typeof formatAIResponse === 'function') {
            msgContent.innerHTML = formatAIResponse(text);
        } else {
            msgContent.textContent = text;
            msgContent.style.whiteSpace = 'pre-wrap';
        }
    } else {
        msgContent.textContent = text;
    }

    msgDiv.appendChild(msgContent);

    // Text to Speech for AI
    if (role === 'ai') {
        const speakBtn = document.createElement('button');
        speakBtn.className = 'chat-speak-btn';
        speakBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 14px;">volume_up</span>';
        speakBtn.title = "Read Aloud";
        speakBtn.style.cssText = "background:none; border:none; color:var(--text-secondary); cursor:pointer; margin-top:4px; opacity:0.6; display: block;";
        speakBtn.onclick = () => {
            const utterance = new SpeechSynthesisUtterance(text);
            speechSynthesis.speak(utterance);
        };
        msgDiv.appendChild(speakBtn);
    }

    geminiChatHistory.appendChild(msgDiv);
    geminiChatHistory.scrollTop = geminiChatHistory.scrollHeight;

    // Save to current chat history
    if (saveToHistory) {
        currentChatHistory.push({
            role,
            text,
            timestamp: new Date().toISOString()
        });

        // Save to database if we have an active task
        if (activeTaskForDetail) {
            saveChatHistory(activeTaskForDetail.id, currentChatHistory);
        }
    }
};


const showGeminiLoading = () => {
    const loading = document.createElement('div');
    loading.className = 'loading-indicator ai';
    loading.id = 'gemini-loading';
    loading.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
    geminiChatHistory.appendChild(loading);
    geminiChatHistory.scrollTop = geminiChatHistory.scrollHeight;
};

const hideGeminiLoading = () => {
    const loading = document.getElementById('gemini-loading');
    if (loading) loading.remove();
};

const askGemini = async (prompt, attachment = null) => {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_GEMINI_API_KEY") {
        setTimeout(() => {
            hideGeminiLoading();
            addChatMessage('ai', "I'm ready to help! To activate Gemini, please add your Google Gemini API Key via the Settings button (⚙️). (Simulated: I suggest prioritizing this task and breaking it down into smaller steps.)");
        }, 1500);
        return;
    }

    try {
        const parts = [{ text: prompt }];
        if (attachment) {
            parts.push({
                inline_data: {
                    mime_type: attachment.mime,
                    data: attachment.data
                }
            });
        }

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: parts }]
            })
        });

        const data = await response.json();

        // Check for API errors
        if (!response.ok) {
            const errorMsg = data.error?.message || `HTTP ${response.status}: ${response.statusText}`;
            console.error("Gemini API Error:", data);
            hideGeminiLoading();
            addChatMessage('ai', `❌ API Error: ${errorMsg}\n\nPlease check your API key in Settings (⚙️). Make sure it's valid and has the Generative Language API enabled.`);
            return;
        }

        hideGeminiLoading();
        if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
            const aiResponse = data.candidates[0].content.parts[0].text;
            addChatMessage('ai', aiResponse);
        } else if (data.error) {
            addChatMessage('ai', `❌ Error: ${data.error.message || 'Unknown error'}`);
        } else {
            console.error("Unexpected response format:", data);
            addChatMessage('ai', "❌ Received an unexpected response format. Check console for details.");
        }
    } catch (error) {
        console.error("Gemini Error:", error);
        hideGeminiLoading();
        addChatMessage('ai', `❌ Connection Error: ${error.message}\n\nPlease check your internet connection and API key in Settings (⚙️).`);
    }
};

const askClaude = async (prompt) => {
    if (!CLAUDE_API_KEY || CLAUDE_API_KEY === "YOUR_CLAUDE_API_KEY") {
        setTimeout(() => {
            hideGeminiLoading();
            addChatMessage('ai', "I'm ready to help! To activate Claude, please add your Claude API Key via the Settings button (⚙️). (Simulated: I suggest prioritizing this task and breaking it down into smaller steps.)");
        }, 1500);
        return;
    }

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': CLAUDE_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 1024,
                messages: [{
                    role: 'user',
                    content: prompt
                }]
            })
        });

        const data = await response.json();

        // Check for API errors
        if (!response.ok) {
            const errorMsg = data.error?.message || `HTTP ${response.status}: ${response.statusText}`;
            console.error("Claude API Error:", data);
            hideGeminiLoading();
            addChatMessage('ai', `❌ API Error: ${errorMsg}\n\nPlease check your API key in Settings (⚙️).`);
            return;
        }

        hideGeminiLoading();
        if (data.content && data.content[0]?.text) {
            const aiResponse = data.content[0].text;
            addChatMessage('ai', aiResponse);
        } else if (data.error) {
            addChatMessage('ai', `❌ Error: ${data.error.message || 'Unknown error'}`);
        } else {
            console.error("Unexpected response format:", data);
            addChatMessage('ai', "❌ Received an unexpected response format. Check console for details.");
        }
    } catch (error) {
        console.error("Claude Error:", error);
        hideGeminiLoading();
        addChatMessage('ai', `❌ Connection Error: ${error.message}\n\nPlease check your internet connection and API key in Settings (⚙️).`);
    }
};

// Unified AI function that routes to the selected provider
const askAI = async (prompt, attachment = null) => {
    if (selectedAIProvider === 'claude') {
        await askClaude(prompt); // Claude attachment support pending
    } else {
        await askGemini(prompt, attachment);
    }
};

const openTaskDetail = (task) => {
    activeTaskForDetail = task;

    // Set task name and checkbox
    // Set task name and checkbox
    detailTaskName.value = task.text;
    detailTaskName.readOnly = true;
    detailTaskCheckbox.checked = task.completed;

    // Set priority dropdown
    detailTaskPriority.value = task.priority || 'medium';

    // Set status dropdown
    detailTaskStatus.value = task.status || 'today';

    // Populate category dropdown with current categories
    detailTaskCategory.innerHTML = '<option value="">None</option>';
    customCategories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.name;
        option.textContent = cat.name;
        if (task.category === cat.name) {
            option.selected = true;
        }
        detailTaskCategory.appendChild(option);
    });

    // Set description
    detailTaskDescription.value = task.description || '';

    // Set AI provider dropdown
    aiProviderSelect.value = selectedAIProvider;

    // Load chat history
    currentChatHistory = loadChatHistory(task);
    geminiChatHistory.innerHTML = '';

    if (currentChatHistory.length > 0) {
        // Restore previous chat messages
        currentChatHistory.forEach(msg => {
            addChatMessage(msg.role, msg.text, false); // Don't save again
        });
    } else {
        // Initial greeting if no history
        addChatMessage('ai', `Hello! I see you want to: "${task.text}". How can I help you complete this efficiently?`);
    }

    taskDetailModal.classList.add('active');

    // Scroll to bottom after layout update
    setTimeout(() => {
        geminiChatHistory.scrollTop = geminiChatHistory.scrollHeight;
    }, 0);
};



const closeTaskDetail = () => {
    taskDetailModal.classList.remove('active');
    activeTaskForDetail = null;
};

geminiSendBtn.addEventListener('click', () => {
    const text = geminiInput.value.trim();
    if (!text && !currentAttachment) return;

    // Visual for attachment
    const userText = text + (currentAttachment ? ' [Attached File]' : '');
    addChatMessage('user', userText);

    // Clear Input
    geminiInput.value = '';

    // Send
    showGeminiLoading();
    askAI(text, currentAttachment);

    // Reset Attachment
    currentAttachment = null;
    chatAttachBtn.style.color = 'var(--text-secondary)';
});

geminiInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        geminiSendBtn.click();
    }
});

// Chat Tool Listeners
chatAttachBtn.addEventListener('click', () => chatFileInput.click());
chatFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
        const base64 = evt.target.result.split(',')[1];
        currentAttachment = { mime: file.type, data: base64 };
        chatAttachBtn.style.color = 'var(--accent-primary)';
        // Optional: Show preview toast
    };
    reader.readAsDataURL(file);
});

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => { chatMicBtn.style.color = 'red'; };
    recognition.onend = () => { chatMicBtn.style.color = 'var(--text-secondary)'; };

    recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        geminiInput.value += (geminiInput.value ? ' ' : '') + text;
    };

    chatMicBtn.addEventListener('click', () => recognition.start());
} else {
    chatMicBtn.style.display = 'none'; // Hide if not supported
}

closeDetailBtn.addEventListener('click', closeTaskDetail);
taskDetailModal.addEventListener('click', (e) => {
    if (e.target === taskDetailModal) closeTaskDetail();
});

detailTaskCheckbox.addEventListener('change', () => {
    if (activeTaskForDetail) toggleTask(activeTaskForDetail);
});

// Task Name Edit Logic (Click to Edit)
detailTaskName.addEventListener('click', () => {
    detailTaskName.readOnly = false;
});

detailTaskName.addEventListener('blur', async () => {
    detailTaskName.readOnly = true;
    // Save on blur
    if (activeTaskForDetail && detailTaskName.value.trim() && detailTaskName.value.trim() !== activeTaskForDetail.text) {
        await updateDoc(doc(db, "tasks", activeTaskForDetail.id), { text: detailTaskName.value.trim() });
        activeTaskForDetail.text = detailTaskName.value.trim();
    }
});

detailTaskName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') detailTaskName.blur();
});

// Task detail field changes - auto-save
detailTaskPriority.addEventListener('change', async () => {
    if (activeTaskForDetail) {
        await updateDoc(doc(db, "tasks", activeTaskForDetail.id), {
            priority: detailTaskPriority.value
        });
        activeTaskForDetail.priority = detailTaskPriority.value;
    }
});

detailTaskStatus.addEventListener('change', async () => {
    if (activeTaskForDetail) {
        await updateDoc(doc(db, "tasks", activeTaskForDetail.id), {
            status: detailTaskStatus.value
        });
        activeTaskForDetail.status = detailTaskStatus.value;
    }
});

detailTaskCategory.addEventListener('change', async () => {
    if (activeTaskForDetail) {
        const category = detailTaskCategory.value || null;
        await updateDoc(doc(db, "tasks", activeTaskForDetail.id), { category });
        activeTaskForDetail.category = category;
    }
});

// Description auto-save with debounce
let descriptionSaveTimeout;
detailTaskDescription.addEventListener('input', () => {
    if (!activeTaskForDetail) return;

    clearTimeout(descriptionSaveTimeout);
    descriptionSaveTimeout = setTimeout(async () => {
        await updateDoc(doc(db, "tasks", activeTaskForDetail.id), {
            description: detailTaskDescription.value
        });
        activeTaskForDetail.description = detailTaskDescription.value;
    }, 1000); // Save 1 second after user stops typing
});

// AI Provider Selection from dropdown
aiProviderSelect.addEventListener('change', () => {
    selectedAIProvider = aiProviderSelect.value;
    localStorage.setItem('zenAIProvider', selectedAIProvider);
    console.log(`AI Provider switched to: ${selectedAIProvider}`);
});


// Expose for debugging/tests
window.ZenTask = {
    addTask,
    tasks: () => tasks,
    db,
    auth,
    openTaskDetail
};

// Auth Event Listeners
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        try {
            await signOut(auth);
            // Redirection is handled by onAuthStateChanged
        } catch (error) {
            console.error("Logout error:", error);
        }
    });
}

// Settings Modal Logic
const settingsModal = document.getElementById('settings-modal');
const settingsBtn = document.getElementById('settings-btn');
const settingsCancelBtn = document.getElementById('settings-cancel-btn');
const settingsSaveBtn = document.getElementById('settings-save-btn');
const settingsGeminiInput = document.getElementById('settings-gemini-key');
const settingsClaudeInput = document.getElementById('settings-claude-key');
const toggleGeminiVisibility = document.getElementById('toggle-gemini-visibility');
const toggleClaudeVisibility = document.getElementById('toggle-claude-visibility');

// Open settings modal
if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
        settingsModal.classList.add('active');
        // Load current keys (masked)
        const geminiKey = localStorage.getItem('zenGeminiKey') || '';
        const claudeKey = localStorage.getItem('zenClaudeKey') || '';
        settingsGeminiInput.value = geminiKey;
        settingsClaudeInput.value = claudeKey;
    });
}

// Close settings modal
const closeSettingsModal = () => {
    settingsModal.classList.remove('active');
};

if (settingsCancelBtn) {
    settingsCancelBtn.addEventListener('click', closeSettingsModal);
}

// Click outside to close
settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) closeSettingsModal();
});

// Toggle password visibility
if (toggleGeminiVisibility) {
    toggleGeminiVisibility.addEventListener('click', () => {
        const type = settingsGeminiInput.type === 'password' ? 'text' : 'password';
        settingsGeminiInput.type = type;
        toggleGeminiVisibility.textContent = type === 'password' ? '👁️' : '🙈';
    });
}

if (toggleClaudeVisibility) {
    toggleClaudeVisibility.addEventListener('click', () => {
        const type = settingsClaudeInput.type === 'password' ? 'text' : 'password';
        settingsClaudeInput.type = type;
        toggleClaudeVisibility.textContent = type === 'password' ? '👁️' : '🙈';
    });
}

// Save API keys
if (settingsSaveBtn) {
    settingsSaveBtn.addEventListener('click', () => {
        const geminiKey = settingsGeminiInput.value.trim();
        const claudeKey = settingsClaudeInput.value.trim();

        // Save to localStorage
        if (geminiKey) {
            localStorage.setItem('zenGeminiKey', geminiKey);
            console.log('✅ Gemini API key saved');
        }
        if (claudeKey) {
            localStorage.setItem('zenClaudeKey', claudeKey);
            console.log('✅ Claude API key saved');
        }

        closeSettingsModal();

        // Show success message and reload
        alert('API keys saved successfully! The page will reload to apply changes.');
        window.location.reload();
    });
}

updateDate();
renderFilters();
initStatusFilters();
