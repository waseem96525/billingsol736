import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-analytics.js";
import { getDatabase, ref, set, get, child } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCBi6GCigBZx5yRTTTW8SXHzSkA1uTAvpM",
    authDomain: "billingsol-e9a83.firebaseapp.com",
    databaseURL: "https://billingsol-e9a83-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "billingsol-e9a83",
    storageBucket: "billingsol-e9a83.firebasestorage.app",
    messagingSenderId: "436716611232",
    appId: "1:436716611232:web:e185ad817d4a67d0f94bc5",
    measurementId: "G-7RG9H1C0BM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getDatabase(app);
const auth = getAuth(app);

document.addEventListener('DOMContentLoaded', () => {
    // Register Service Worker for Offline Support
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js')
            .then(registration => {
                console.log('Service Worker registered:', registration);
                
                // Listen for updates
                registration.addEventListener('updatefound', () => {
                    console.log('Service Worker update found');
                });
            })
            .catch(error => {
                console.log('Service Worker registration failed:', error);
            });
        
        // Listen for sync messages from service worker
        navigator.serviceWorker.addEventListener('message', event => {
            if (event.data.type === 'SYNC_REQUIRED') {
                syncPendingChanges();
            }
        });
    }
    
    // Offline/Online Detection
    const offlineIndicator = document.getElementById('offline-indicator');
    let isOnline = navigator.onLine;
    
    // Offline Sync Queue (declare early before use)
    let syncQueue = [];
    let lastSyncTime = null;
    
    // Load sync queue from localStorage
    function loadSyncQueue() {
        try {
            const saved = localStorage.getItem('bs_sync_queue');
            if (saved) {
                syncQueue = JSON.parse(saved);
            }
        } catch (e) {
            console.warn('Failed to load sync queue:', e);
        }
    }
    
    function saveSyncQueue() {
        try {
            localStorage.setItem('bs_sync_queue', JSON.stringify(syncQueue));
        } catch (e) {
            console.warn('Failed to save sync queue:', e);
        }
    }
    
    // Load sync queue immediately
    loadSyncQueue();
    
    function updateOnlineStatus() {
        isOnline = navigator.onLine;
        if (offlineIndicator) {
            offlineIndicator.style.display = isOnline ? 'none' : 'block';
        }
        
        updateSyncStatus();
        
        if (isOnline) {
            console.log('Connection restored');
            syncPendingChanges();
        } else {
            console.log('Connection lost - working offline');
        }
    }
    
    function updateSyncStatus() {
        const syncStatus = document.getElementById('sync-status');
        if (!syncStatus) return;
        
        if (!navigator.onLine) {
            syncStatus.textContent = '● Offline';
            syncStatus.style.background = '#e74c3c';
        } else if (syncQueue.length > 0) {
            syncStatus.textContent = `● Pending (${syncQueue.length})`;
            syncStatus.style.background = '#f39c12';
        } else {
            syncStatus.textContent = '● Synced';
            syncStatus.style.background = '#2ecc71';
        }
    }
    
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    // Delay initial call until after all variables are initialized
    setTimeout(() => updateOnlineStatus(), 100);
    
    // PWA Install Prompt
    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        
        // Show install button/prompt (optional)
        console.log('PWA install available');
    });
    
    window.addEventListener('appinstalled', () => {
        console.log('PWA installed successfully');
        deferredPrompt = null;
    });
    
    // Auth Elements
    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');
    const authForm = document.getElementById('auth-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const authBtn = document.getElementById('auth-btn');
    const authSwitchBtn = document.getElementById('auth-switch-btn');
    const authSwitchText = document.getElementById('auth-switch-text');
    const authError = document.getElementById('auth-error');

    let isLogin = true;
    let currentUser = null;

    // Inventory Elements
    const inventoryForm = document.getElementById('inventory-form');
    const inventoryTableBody = document.querySelector('#inventory-table tbody');
    
    // Billing Elements
    const billingForm = document.getElementById('billing-form');
    const billingTableBody = document.querySelector('#billing-table tbody');
    const billTotalElement = document.getElementById('billTotalAmount');
    const inventoryDatalist = document.getElementById('inventory-datalist');

    // State
    let inventory = [];
    let transactions = [];
    let settings = {
        storeName: 'My Retail Store',
        storeAddress: '',
        storePhone: '',
        defaultTax: 0,
        lowStockThreshold: 5
    };
    let categories = ['General', 'Grocery', 'Electronics', 'Clothing', 'Pharmacy', 'Other'];
    // Default Owner with hashed PIN (original PIN: 0000)
    let appUsers = [{name: 'Owner', role: 'Owner', pin: 'ry89yk'}];
    let currentAppUser = null;
    let currentBill = [];
    let editIndex = -1;
    let activityLogs = [];
    
    // Sync queue functions (declarations moved earlier)
    function addToSyncQueue(operation, data) {
        syncQueue.push({
            id: Date.now() + Math.random(),
            operation,
            data,
            timestamp: new Date().toISOString()
        });
        saveSyncQueue();
        updateSyncStatus();
    }
    
    function syncPendingChanges() {
        if (!navigator.onLine || !currentUser || syncQueue.length === 0) {
            return;
        }
        
        console.log(`Syncing ${syncQueue.length} pending changes...`);
        
        // Process queue
        const itemsToSync = [...syncQueue];
        syncQueue = [];
        saveSyncQueue();
        updateSyncStatus();
        
        // Sync to Firebase
        itemsToSync.forEach(item => {
            try {
                switch (item.operation) {
                    case 'inventory':
                        set(ref(db, `users/${currentUser.uid}/inventory`), item.data);
                        break;
                    case 'transactions':
                        set(ref(db, `users/${currentUser.uid}/transactions`), item.data);
                        break;
                    case 'settings':
                        set(ref(db, `users/${currentUser.uid}/settings`), item.data);
                        break;
                    case 'categories':
                        set(ref(db, `users/${currentUser.uid}/categories`), item.data);
                        break;
                    case 'appUsers':
                        set(ref(db, `users/${currentUser.uid}/appUsers`), item.data);
                        break;
                    case 'activityLogs':
                        set(ref(db, `users/${currentUser.uid}/activityLogs`), item.data);
                        break;
                }
            } catch (error) {
                console.error('Sync error:', error);
                // Add back to queue if failed
                syncQueue.push(item);
            }
        });
        
        saveSyncQueue();
        updateSyncStatus();
        lastSyncTime = new Date();
        if (syncQueue.length === 0) {
            showSuccessPopup('✓ Data synced successfully!');
        }
    }
    
    window.manualSync = function() {
        if (!navigator.onLine) {
            alert('No internet connection. Please check your network.');
            return;
        }
        syncPendingChanges();
    };
    
    // --- Activity Logging ---
    function logActivity(action, details = '') {
        if (!currentAppUser) return;
        
        const log = {
            timestamp: new Date().toISOString(),
            user: currentAppUser.name,
            role: currentAppUser.role,
            action: action,
            details: details
        };
        
        activityLogs.unshift(log); // Add to beginning
        
        // Keep only last 500 logs to prevent memory issues
        if (activityLogs.length > 500) {
            activityLogs = activityLogs.slice(0, 500);
        }
        
        // Save to localStorage
        try {
            localStorage.setItem('bs_activity_logs', JSON.stringify(activityLogs));
        } catch (e) {
            console.warn('Failed to save activity logs:', e);
        }
        
        // Sync to Firebase if online
        if (currentUser && navigator.onLine) {
            set(ref(db, `users/${currentUser.uid}/activityLogs`), activityLogs)
                .catch(() => addToSyncQueue('activityLogs', activityLogs));
        } else if (currentUser) {
            addToSyncQueue('activityLogs', activityLogs);
        }
    }
    
    window.renderActivityLogs = function() {
        const tbody = document.querySelector('#activity-logs-table tbody');
        if (!tbody) return;
        
        const filter = document.getElementById('activityLogFilter')?.value || 'all';
        const filteredLogs = filter === 'all' 
            ? activityLogs 
            : activityLogs.filter(log => log.user === filter);
        
        tbody.innerHTML = '';
        
        if (filteredLogs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px; color: #999;">No activity logs</td></tr>';
            return;
        }
        
        filteredLogs.slice(0, 100).forEach(log => {
            const row = document.createElement('tr');
            const date = new Date(log.timestamp);
            row.innerHTML = `
                <td>${date.toLocaleString()}</td>
                <td><strong>${log.user}</strong> <span style="font-size: 11px; color: #666;">(${log.role})</span></td>
                <td>${log.action}</td>
                <td style="font-size: 12px;">${log.details}</td>
            `;
            tbody.appendChild(row);
        });
    };
    
    function updateActivityLogFilter() {
        const filter = document.getElementById('activityLogFilter');
        if (!filter) return;
        
        filter.innerHTML = '<option value="all">All Users</option>';
        const uniqueUsers = [...new Set(activityLogs.map(log => log.user))];
        uniqueUsers.forEach(user => {
            const option = document.createElement('option');
            option.value = user;
            option.textContent = user;
            filter.appendChild(option);
        });
    }
    
    window.exportActivityLogs = function() {
        if (activityLogs.length === 0) {
            alert('No activity logs to export.');
            return;
        }
        
        const headers = ['Timestamp', 'User', 'Role', 'Action', 'Details'];
        const csvContent = [
            headers.join(','),
            ...activityLogs.map(log => [
                log.timestamp,
                `"${log.user}"`,
                log.role,
                `"${log.action}"`,
                `"${log.details}"`
            ].join(','))
        ].join('\n');
        
        downloadCSV(csvContent, 'activity_logs.csv');
    };
    
    window.clearActivityLogs = function() {
        if (!currentAppUser || (currentAppUser.role !== 'Owner' && currentAppUser.role !== 'Admin')) {
            alert('Access Denied: Only Owner/Admin can clear logs.');
            return;
        }
        
        if (confirm('Are you sure you want to clear all activity logs?')) {
            activityLogs = [];
            localStorage.setItem('bs_activity_logs', JSON.stringify(activityLogs));
            if (currentUser) {
                set(ref(db, `users/${currentUser.uid}/activityLogs`), []);
            }
            renderActivityLogs();
            logActivity('SYSTEM', 'Activity logs cleared');
        }
    };

    // --- Auth Logic ---
    // Utility: debounce
    function debounce(fn, delay) {
        let t;
        return function(...args) {
            clearTimeout(t);
            t = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    // Animation functions
    function createSparkles(x, y) {
        for (let i = 0; i < 5; i++) {
            const sparkle = document.createElement('div');
            sparkle.className = 'sparkle';
            sparkle.style.left = (x + (Math.random() - 0.5) * 100) + 'px';
            sparkle.style.top = (y + (Math.random() - 0.5) * 100) + 'px';
            document.body.appendChild(sparkle);
            setTimeout(() => sparkle.remove(), 600);
        }
    }

    function createBoomEffect(x, y) {
        const boom = document.createElement('div');
        boom.className = 'boom-effect';
        boom.textContent = '💥';
        boom.style.left = (x - 50) + 'px';
        boom.style.top = (y - 50) + 'px';
        document.body.appendChild(boom);
        setTimeout(() => boom.remove(), 500);
    }

    function createConfetti() {
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#fdcb6e', '#6c5ce7', '#a29bfe'];
        for (let i = 0; i < 50; i++) {
            setTimeout(() => {
                const confetti = document.createElement('div');
                confetti.className = 'confetti-piece';
                confetti.style.left = Math.random() * window.innerWidth + 'px';
                confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
                confetti.style.animationDelay = (Math.random() * 0.5) + 's';
                document.body.appendChild(confetti);
                setTimeout(() => confetti.remove(), 3000);
            }, i * 30);
        }
    }

    function showSuccessPopup(message) {
        const popup = document.createElement('div');
        popup.className = 'success-popup';
        popup.innerHTML = `✓ ${message}`;
        document.body.appendChild(popup);
        setTimeout(() => {
            popup.classList.add('hide');
            setTimeout(() => popup.remove(), 500);
        }, 2500);
    }

    // Cartoon animation functions
    function createCoinDrop(x, y) {
        const coin = document.createElement('div');
        coin.className = 'coin-drop';
        coin.textContent = '💰';
        coin.style.left = (x - 20) + 'px';
        coin.style.top = (y - 100) + 'px';
        document.body.appendChild(coin);
        setTimeout(() => coin.remove(), 800);
    }

    function addCartoonEffect(element, animationType) {
        if (!element) return;
        element.classList.add(animationType);
        element.addEventListener('animationend', () => {
            element.classList.remove(animationType);
        }, { once: true });
    }

    function createFloatingEmoji(emoji, x, y) {
        const el = document.createElement('div');
        el.textContent = emoji;
        el.style.position = 'fixed';
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        el.style.fontSize = '50px';
        el.style.pointerEvents = 'none';
        el.style.zIndex = '9999';
        el.classList.add('zoom-in-bounce');
        document.body.appendChild(el);
        setTimeout(() => {
            el.style.transition = 'all 1s ease-out';
            el.style.transform = 'translateY(-100px)';
            el.style.opacity = '0';
            setTimeout(() => el.remove(), 1000);
        }, 600);
    }

    authSwitchBtn.addEventListener('click', (e) => {
        e.preventDefault();
        isLogin = !isLogin;
        if (isLogin) {
            document.querySelector('#auth-container h1').textContent = 'Login';
            authBtn.textContent = 'Login';
            authSwitchText.textContent = "Don't have an account?";
            authSwitchBtn.textContent = 'Register';
        } else {
            document.querySelector('#auth-container h1').textContent = 'Register';
            authBtn.textContent = 'Register';
            authSwitchText.textContent = "Already have an account?";
            authSwitchBtn.textContent = 'Login';
        }
        authError.style.display = 'none';
    });

    authForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = emailInput.value;
        const password = passwordInput.value;
        authError.style.display = 'none';

        if (isLogin) {
            signInWithEmailAndPassword(auth, email, password)
                .then((userCredential) => {
                    // Signed in 
                    console.log("Logged in");
                })
                .catch((error) => {
                    console.error("Login Error:", error.code, error.message);
                    let msg = "Login failed: " + error.message;
                    if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                        msg = "Invalid email or password.";
                    } else if (error.code === 'auth/invalid-email') {
                        msg = "Invalid email address.";
                    }
                    authError.textContent = msg;
                    authError.style.display = 'block';
                });
        } else {
            createUserWithEmailAndPassword(auth, email, password)
                .then((userCredential) => {
                    // Signed up 
                    console.log("Registered");
                })
                .catch((error) => {
                    console.error("Register Error:", error.code, error.message);
                    let msg = "Registration failed: " + error.message;
                    if (error.code === 'auth/email-already-in-use') {
                        msg = "Email is already registered. Please login.";
                    } else if (error.code === 'auth/weak-password') {
                        msg = "Password should be at least 6 characters.";
                    } else if (error.code === 'auth/invalid-email') {
                        msg = "Invalid email address.";
                    }
                    authError.textContent = msg;
                    authError.style.display = 'block';
                });
        }
    });

    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            authContainer.style.display = 'none';
            // appContainer.style.display = 'block'; // Don't show app yet
            loadUserData(user.uid);
        } else {
            currentUser = null;
            currentAppUser = null;
            authContainer.style.display = 'block';
            appContainer.style.display = 'none';
            // Clear data from UI
            inventory = [];
            transactions = [];
            renderInventory();
        }
    });

    // Staff Login Logic Removed


    // Full Logout (Sign out from Firebase)
    document.getElementById('full-logout-btn').addEventListener('click', () => {
        if (currentAppUser) {
            logActivity('Logout', `User logged out`);
        }
        signOut(auth).then(() => {
            location.reload();
        }).catch((error) => {
            console.error(error);
        });
    });

    function getActiveTabName() {
        const activeBtn = document.querySelector('.nav-btn.active');
        if (!activeBtn || !activeBtn.id) return null;
        return activeBtn.id.startsWith('nav-') ? activeBtn.id.slice(4) : null;
    }

    function applyPermissions() {
        if (!currentAppUser) return;
        
        const role = currentAppUser.role;
        const isOwnerOrAdmin = role === 'Owner' || role === 'Admin';
        const isManager = role === 'Manager';
        const isCashier = role === 'Cashier';
        
        // Tab visibility based on roles:
        // Cashier: Billing only
        // Manager: Billing + Reports + Inventory
        // Owner/Admin: All tabs
        
        const inventoryTab = document.getElementById('nav-inventory');
        const billingTab = document.getElementById('nav-billing');
        const reportsTab = document.getElementById('nav-reports');
        const settingsTab = document.getElementById('nav-settings');
        
        if (inventoryTab) {
            inventoryTab.style.display = (isOwnerOrAdmin || isManager) ? 'inline-block' : 'none';
        }
        if (billingTab) {
            billingTab.style.display = 'inline-block'; // All roles can access billing
        }
        if (reportsTab) {
            reportsTab.style.display = (isOwnerOrAdmin || isManager) ? 'inline-block' : 'none';
        }
        if (settingsTab) {
            settingsTab.style.display = isOwnerOrAdmin ? 'inline-block' : 'none';
        }
        
        // Delete buttons only for Owner/Admin
        const deleteBtns = document.querySelectorAll('.delete-item-btn');
        deleteBtns.forEach(btn => {
            btn.style.display = isOwnerOrAdmin ? 'inline-block' : 'none';
        });
        
        // Edit functionality based on roles
        const editBtns = document.querySelectorAll('.edit-item-btn');
        editBtns.forEach(btn => {
            // Manager can edit inventory, Cashier cannot
            if (isCashier) {
                btn.style.display = 'none';
            }
        });
        
        // Redirect based on role
        const currentTab = getActiveTabName();
        if (isCashier && currentTab !== 'billing') {
            switchTab('billing');
            return;
        }
        if (isManager && currentTab === 'settings') {
            switchTab('inventory');
            return;
        }

        // If nothing is active yet, default to Billing
        if (!currentTab) {
            switchTab('billing');
        }
    }

    function loadUserData(uid) {
        const dbRef = ref(db);
        
        // Try to load from localStorage first for immediate display
        try {
            const localInv = localStorage.getItem('bs_inventory');
            const localTx = localStorage.getItem('bs_transactions');
            const localSettings = localStorage.getItem('bs_settings');
            const localCategories = localStorage.getItem('bs_categories');
            const localUsers = localStorage.getItem('bs_appUsers');
            const localLogs = localStorage.getItem('bs_activity_logs');
            
            if (localInv) inventory = JSON.parse(localInv);
            if (localTx) transactions = JSON.parse(localTx);
            if (localSettings) settings = JSON.parse(localSettings);
            if (localCategories) categories = JSON.parse(localCategories);
            if (localUsers) appUsers = JSON.parse(localUsers);
            if (localLogs) activityLogs = JSON.parse(localLogs);
            
            // Render immediately with local data
            if (localInv || localTx) {
                renderInventory();
                renderReports();
                renderCategoryOptions();
                renderAppUsers();
                updateSalesPersonDropdown();
                renderActivityLogs();
                updateActivityLogFilter();
            }
        } catch (e) {
            console.warn('Failed to load local data:', e);
        }
        
        // If online, fetch from Firebase and update
        if (navigator.onLine) {
            get(child(dbRef, `users/${uid}`)).then((snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    inventory = data.inventory || [];
                    transactions = data.transactions || [];
                    settings = data.settings || settings;
                    if (data.categories) {
                        categories = data.categories;
                    }
                    if (data.appUsers) {
                        appUsers = data.appUsers;
                    }
                    if (data.activityLogs) {
                        activityLogs = data.activityLogs;
                    }
                    
                    // Save to localStorage
                    try {
                        localStorage.setItem('bs_inventory', JSON.stringify(inventory));
                        localStorage.setItem('bs_transactions', JSON.stringify(transactions));
                        localStorage.setItem('bs_settings', JSON.stringify(settings));
                        localStorage.setItem('bs_categories', JSON.stringify(categories));
                        localStorage.setItem('bs_appUsers', JSON.stringify(appUsers));
                        localStorage.setItem('bs_activity_logs', JSON.stringify(activityLogs));
                    } catch (e) {
                        console.warn('Failed to cache data locally:', e);
                    }
                } else {
                    // New user or no data
                    inventory = [];
                    transactions = [];
                }
                
                // Re-render with fresh data
                renderInventory();
                loadSettingsForm();
                renderReports();
                renderCategoryOptions();
                renderAppUsers();
                updateSalesPersonDropdown();
                renderActivityLogs();
                updateActivityLogFilter();
                
                // Auto-login as Owner/Admin
                const adminUser = appUsers.find(u => u.role === 'Owner' || u.role === 'Admin') || appUsers[0];
                if (adminUser) {
                    currentAppUser = adminUser;
                    appContainer.style.display = 'block';
                    document.getElementById('loggedInStaffName').textContent = adminUser.name + ' (' + adminUser.role + ')';
                    applyPermissions();
                    
                    logActivity('Login', `User logged in`);
                    
                    // Show low stock notification
                    setTimeout(() => {
                        const lowStockCount = inventory.filter(i => isLowStockItem(i)).length;
                        if (lowStockCount > 0) {
                            showLowStockNotification();
                        }
                    }, 1500);
                }
                
                // Sync any pending changes
                syncPendingChanges();
            }).catch((error) => {
                console.error('Firebase load error:', error);
                // Continue with local data if Firebase fails
                console.log('Working offline with cached data');
            });
        } else {
            // Offline mode - use local data
            console.log('Offline mode - using cached data');
            
            // Auto-login with local data
            const adminUser = appUsers.find(u => u.role === 'Owner' || u.role === 'Admin') || appUsers[0];
            if (adminUser) {
                currentAppUser = adminUser;
                appContainer.style.display = 'block';
                document.getElementById('loggedInStaffName').textContent = adminUser.name + ' (' + adminUser.role + ') - OFFLINE';
                applyPermissions();
                logActivity('Login', 'User logged in (Offline mode)');
            }
        }
    }

    function renderCategoryOptions() {
        const datalist = document.getElementById('category-list');
        if (datalist) {
            datalist.innerHTML = '';
            categories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat;
                datalist.appendChild(option);
            });
        }
    }

    function renderAppUsers() {
        const tbody = document.querySelector('#users-table tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        appUsers.forEach((user, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${user.name}</td>
                <td><span style="padding: 2px 8px; background: ${user.role === 'Owner' ? '#e74c3c' : user.role === 'Admin' ? '#e67e22' : user.role === 'Manager' ? '#3498db' : '#95a5a6'}; color: white; border-radius: 3px; font-size: 11px;">${user.role}</span></td>
                <td><span style="color: #999; font-family: monospace;">****</span> <small style="color: #bbb;">(secured)</small></td>
                <td>
                    ${index > 0 ? `<button class="delete-btn" onclick="deleteAppUser(${index})" style="padding: 5px 10px; font-size: 12px;">Delete</button>` : '<span style="color: gray; font-size: 12px;">Default Owner</span>'}
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    function updateSalesPersonDropdown() {
        const select = document.getElementById('billSalesPerson');
        if (!select) return;
        select.innerHTML = '';
        appUsers.forEach(user => {
            const option = document.createElement('option');
            option.value = user.name;
            option.textContent = user.name;
            select.appendChild(option);
        });
    }

    document.getElementById('user-form').addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Security Check: Only Owner/Admin can add users
        if (!currentAppUser || (currentAppUser.role !== 'Owner' && currentAppUser.role !== 'Admin')) {
            alert('Access Denied: Only Owner/Admin can add users.');
            return;
        }
        
        const name = document.getElementById('userName').value.trim();
        const role = document.getElementById('userRole').value;
        const pin = document.getElementById('userPin').value;
        
        // Validation
        if (!name || !pin) {
            alert('Please enter both name and PIN.');
            return;
        }
        
        if (pin.length < 4) {
            alert('PIN must be at least 4 digits.');
            return;
        }
        
        if (!/^\d+$/.test(pin)) {
            alert('PIN must contain only numbers.');
            return;
        }
        
        // Check if name already exists
        if (appUsers.some(u => u.name.toLowerCase() === name.toLowerCase())) {
            alert('A user with this name already exists!');
            return;
        }
        
        // Hash the PIN for security
        const hashedPin = hashPin(pin);
        
        // Check if hashed PIN already exists (prevents same PIN reuse)
        if (appUsers.some(u => u.pin === hashedPin)) {
            alert('This PIN is already in use. Please choose a different PIN.');
            return;
        }
        
        // Validation: Prevent creating multiple Owners
        if (role === 'Owner' && appUsers.some(u => u.role === 'Owner')) {
            if (!confirm('An Owner already exists. Are you sure you want to create another Owner account?')) {
                return;
            }
        }

        appUsers.push({ name, role, pin: hashedPin });
        
        logActivity('Add User', `Created user "${name}" with role ${role}`);
        
        try {
            localStorage.setItem('bs_appUsers', JSON.stringify(appUsers));
        } catch (e) {
            console.warn('Failed to save users locally:', e);
        }
        
        if (currentUser) {
            if (navigator.onLine) {
                set(ref(db, `users/${currentUser.uid}/appUsers`), appUsers)
                    .then(() => {
                        alert(`✓ User "${name}" (${role}) added successfully!`);
                    })
                    .catch(() => {
                        addToSyncQueue('appUsers', appUsers);
                        alert(`User "${name}" added (will sync when online)`);
                    });
            } else {
                addToSyncQueue('appUsers', appUsers);
                alert(`User "${name}" added (will sync when online)`);
            }
        } else {
            alert(`User "${name}" added successfully!`);
        }
        
        renderAppUsers();
        updateSalesPersonDropdown();
        updateActivityLogFilter();
        document.getElementById('user-form').reset();
    });

    window.deleteAppUser = function(index) {
        // Security Check: Only Owner/Admin can delete users
        if (!currentAppUser || (currentAppUser.role !== 'Owner' && currentAppUser.role !== 'Admin')) {
            alert('Access Denied: Only Owner/Admin can delete users.');
            return;
        }
        
        const userToDelete = appUsers[index];
        
        // Prevent deleting yourself
        if (currentAppUser.name === userToDelete.name) {
            alert('Cannot delete your own account while logged in!');
            return;
        }
        
        // Prevent deleting the last Owner
        if (userToDelete.role === 'Owner') {
            const ownerCount = appUsers.filter(u => u.role === 'Owner').length;
            if (ownerCount <= 1) {
                alert('Cannot delete the last Owner account! Create another Owner first.');
                return;
            }
        }
        
        if (confirm(`⚠️ DELETE USER\n\nName: ${userToDelete.name}\nRole: ${userToDelete.role}\n\nThis action cannot be undone. Continue?`)) {
            const userName = userToDelete.name;
            const userRole = userToDelete.role;
            
            appUsers.splice(index, 1);
            
            logActivity('Delete User', `Removed user "${userName}" (${userRole})`);
            
            try {
                localStorage.setItem('bs_appUsers', JSON.stringify(appUsers));
            } catch (e) {
                console.warn('Failed to save users locally:', e);
            }
            if (currentUser) {
                if (navigator.onLine) {
                    set(ref(db, `users/${currentUser.uid}/appUsers`), appUsers)
                        .catch(() => addToSyncQueue('appUsers', appUsers));
                } else {
                    addToSyncQueue('appUsers', appUsers);
                }
            }
            renderAppUsers();
            updateSalesPersonDropdown();
        }
    };

    // --- Secure PIN Hashing ---
    function hashPin(pin) {
        // Simple hash function for PIN security
        let hash = 0;
        const str = pin + 'BILLING_SALT_2025';
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }
    
    function verifyPin(inputPin, hashedPin) {
        return hashPin(inputPin) === hashedPin;
    }

    // --- Navigation ---
    window.switchTab = function(tab) {
        try {
            // Permission Check based on roles
            if (currentAppUser) {
                const role = currentAppUser.role;
                const isOwnerOrAdmin = role === 'Owner' || role === 'Admin';
                const isCashier = role === 'Cashier';
                
                // Enforce permissions
                if (tab === 'settings' && !isOwnerOrAdmin) {
                    alert('Access Denied: Settings are only accessible to Owner/Admin.');
                    return;
                }
                if ((tab === 'inventory' || tab === 'reports') && isCashier) {
                    alert('Access Denied: Cashiers can only access Billing.');
                    return;
                }
            }

            // Update nav active state (guard in case an element is missing)
            document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
            document.getElementById(`nav-${tab}`)?.classList.add('active');

            // Hide all sections (guard in case an element is missing)
            document.getElementById('inventory-section')?.style && (document.getElementById('inventory-section').style.display = 'none');
            document.getElementById('billing-section')?.style && (document.getElementById('billing-section').style.display = 'none');
            document.getElementById('reports-section')?.style && (document.getElementById('reports-section').style.display = 'none');
            document.getElementById('settings-section')?.style && (document.getElementById('settings-section').style.display = 'none');

            // Show the selected section FIRST (so a later error can't leave the UI stuck)
            if (tab === 'inventory') {
                document.getElementById('inventory-section')?.style && (document.getElementById('inventory-section').style.display = 'block');
            } else if (tab === 'billing') {
                document.getElementById('billing-section')?.style && (document.getElementById('billing-section').style.display = 'block');
                try {
                    updateBillingDatalist();
                    // Apply default tax
                    const taxInput = document.getElementById('billTaxRate');
                    if (taxInput && (parseFloat(taxInput.value) || 0) === 0) {
                        taxInput.value = settings.defaultTax;
                    }
                } catch (err) {
                    console.error('Billing tab initialization failed:', err);
                }
            } else if (tab === 'reports') {
                document.getElementById('reports-section')?.style && (document.getElementById('reports-section').style.display = 'block');
                try {
                    renderReports();
                    // Show notification if there are low stock items
                    const lowStockCount = inventory.filter(i => isLowStockItem(i)).length;
                    if (lowStockCount > 0) {
                        setTimeout(() => showLowStockNotification(), 500);
                    }
                } catch (err) {
                    console.error('Reports tab initialization failed:', err);
                }
            } else if (tab === 'settings') {
                document.getElementById('settings-section')?.style && (document.getElementById('settings-section').style.display = 'block');
                try {
                    loadSettingsForm();
                } catch (err) {
                    console.error('Settings tab initialization failed:', err);
                }
            }
        } catch (err) {
            console.error('switchTab failed:', err);
        }
    };

    // Fallback: bind nav button clicks in JS as well (in addition to inline onclick)
    document.getElementById('nav-inventory')?.addEventListener('click', () => window.switchTab('inventory'));
    document.getElementById('nav-billing')?.addEventListener('click', () => window.switchTab('billing'));
    document.getElementById('nav-reports')?.addEventListener('click', () => window.switchTab('reports'));
    document.getElementById('nav-settings')?.addEventListener('click', () => window.switchTab('settings'));

    // --- Inventory Management ---

    function getEffectiveMinQty(item) {
        const globalThreshold = settings.lowStockThreshold || 5;
        const raw = item ? item.minQty : undefined;

        // Treat explicit 0 as valid (means only out-of-stock triggers, no low-stock)
        if (raw === 0) return 0;

        const parsed = parseInt(raw);
        if (!Number.isNaN(parsed)) return parsed;
        return globalThreshold;
    }

    function getReorderQty(item) {
        const qty = parseInt(item?.quantity) || 0;
        const minQty = getEffectiveMinQty(item);
        if (minQty <= 0) return 0;
        return Math.max(0, minQty - qty);
    }

    function isLowStockItem(item) {
        const qty = parseInt(item?.quantity) || 0;
        if (qty === 0) return true;
        const minQty = getEffectiveMinQty(item);
        if (minQty <= 0) return false;
        return qty > 0 && qty <= minQty;
    }

    function renderInventory(itemsToRender = inventory) {
        // Use DocumentFragment to minimize reflows when rendering many items
        const fragment = document.createDocumentFragment();
        const isAdmin = currentAppUser && currentAppUser.role === 'Admin';
        const deleteStyle = isAdmin ? '' : 'display:none;';
        const globalThreshold = settings.lowStockThreshold || 5;

        itemsToRender.forEach((item) => {
            const originalIndex = inventory.indexOf(item);
            const qty = parseInt(item.quantity);

            const hasCustomMin = item.minQty !== undefined && item.minQty !== null && item.minQty !== '' && !Number.isNaN(parseInt(item.minQty));
            const effectiveMin = hasCustomMin ? parseInt(item.minQty) : globalThreshold;
            
            // Determine color based on stock level
            let qtyColor = '#2ecc71'; // Green - Good stock
            let qtyBg = '#d4edda';
            if (qty === 0) {
                qtyColor = '#e74c3c'; // Red - Out of stock
                qtyBg = '#f8d7da';
            } else if (effectiveMin > 0 && qty <= effectiveMin) {
                qtyColor = '#e74c3c'; // Red - Low stock
                qtyBg = '#f8d7da';
            } else if (effectiveMin > 0 && qty <= effectiveMin * 2) {
                qtyColor = '#f39c12'; // Yellow/Orange - Medium stock
                qtyBg = '#fff3cd';
            }
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${originalIndex + 1}</td>
                <td>${item.barcode || '-'}</td>
                <td>${item.name}</td>
                <td>${item.category || 'General'}</td>
                <td style="background-color: ${qtyBg}; color: ${qtyColor}; font-weight: bold; text-align: center;">
                    ${item.quantity}
                    ${qty === 0 ? ' <span style="font-size: 10px;">⚠️</span>' : (effectiveMin > 0 && qty <= effectiveMin) ? ' <span style="font-size: 10px;">🔔</span>' : ''}
                </td>
                <td style="text-align:center; font-weight: ${hasCustomMin ? 'bold' : 'normal'}; color: ${hasCustomMin ? '#6c5ce7' : '#666'};">
                    ${hasCustomMin ? effectiveMin : '-'}
                </td>
                <td>₹${item.mrp ? parseFloat(item.mrp).toFixed(2) : '-'}</td>
                <td>₹${item.costPrice ? parseFloat(item.costPrice).toFixed(2) : '-'}</td>
                <td>₹${parseFloat(item.sellingPrice || item.price || 0).toFixed(2)}</td>
                <td style="text-align: center;">
                    ${item.barcode ? `<button class="secondary-btn" onclick="printSingleBarcode(${originalIndex}, 'barcode')" style="padding: 4px 8px; font-size: 11px; margin: 2px;">📊</button>` : '<span style="color: #999;">-</span>'}
                    <button class="secondary-btn" onclick="printSingleBarcode(${originalIndex}, 'qr')" style="padding: 4px 8px; font-size: 11px; margin: 2px;">📱</button>
                </td>
                <td>
                    <button class="edit-btn" onclick="editItem(${originalIndex})">Edit</button>
                    <button class="delete-btn delete-item-btn" onclick="deleteItem(${originalIndex})" style="${deleteStyle}">Delete</button>
                </td>
            `;
            fragment.appendChild(row);
        });
        inventoryTableBody.innerHTML = '';
        inventoryTableBody.appendChild(fragment);
        updateBillingDatalist();
        
        // Update low stock badge
        updateLowStockBadge();
    }

    window.filterInventory = function() {
        const query = document.getElementById('inventorySearch').value.toLowerCase();
        const filtered = inventory.filter(item => 
            item.name.toLowerCase().includes(query) || 
            (item.barcode && item.barcode.toLowerCase().includes(query))
        );
        renderInventory(filtered);
    };

    // Debounced event listeners for search inputs to improve responsiveness
    const inventorySearchEl = document.getElementById('inventorySearch');
    if (inventorySearchEl) {
        inventorySearchEl.addEventListener('input', debounce(window.filterInventory, 200));
    }

    // Event delegation for transaction table buttons (set up once)
    const transactionsTableBody = document.querySelector('#transactions-table tbody');
    if (transactionsTableBody) {
        transactionsTableBody.addEventListener('click', (e) => {
            const target = e.target;
            if (target.dataset.action === 'reprint') {
                reprintBill(target.dataset.invoice);
            } else if (target.dataset.action === 'return') {
                openReturnModal(target.dataset.invoice);
            }
        });
    }


    window.exportInventory = function() {
        const headers = ['Barcode', 'Name', 'Quantity', 'Min Qty', 'MRP', 'Cost Price', 'Selling Price'];
        const csvContent = [
            headers.join(','),
            ...inventory.map(item => [
                item.barcode || '',
                `"${item.name}"`,
                item.quantity,
                (item.minQty ?? ''),
                item.mrp || 0,
                item.costPrice || 0,
                item.sellingPrice || 0
            ].join(','))
        ].join('\n');
        
        downloadCSV(csvContent, 'inventory.csv');
    };

    // Import CSV handler (Inventory)
    const importFileInput = document.getElementById('importInventoryFile');
    if (importFileInput) {
        importFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(ev) {
                const text = ev.target.result;
                const lines = text.split(/\r?\n/).filter(l => l.trim());
                if (lines.length <= 1) {
                    alert('No data found in CSV');
                    return;
                }
                const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
                let added = 0;
                for (let i = 1; i < lines.length; i++) {
                    const cols = lines[i].split(',');
                    if (cols.length < 2) continue;
                    const barcode = cols[0].trim();
                    const name = cols[1].replace(/^"|"$/g, '').trim();
                    const quantity = parseInt(cols[2]) || 0;
                    // Backward compatible CSV parsing:
                    // Old format: Barcode,Name,Quantity,MRP,Cost,Selling
                    // New format: Barcode,Name,Quantity,MinQty,MRP,Cost,Selling
                    const possibleMin = cols[3];
                    const minQty = (cols.length >= 7) ? (parseInt(possibleMin) || 0) : undefined;
                    const mrp = parseFloat(cols.length >= 7 ? cols[4] : cols[3]) || 0;
                    const costPrice = parseFloat(cols.length >= 7 ? cols[5] : cols[4]) || 0;
                    const sellingPrice = parseFloat(cols.length >= 7 ? cols[6] : cols[5]) || 0;
                    if (!name) continue;
                    const item = { barcode, name, quantity, mrp, costPrice, sellingPrice };
                    if (minQty !== undefined) item.minQty = minQty;
                    inventory.push(item);
                    added++;
                }
                saveInventory();
                renderInventory();
                alert('Imported ' + added + ' items');
                importFileInput.value = '';
            };
            reader.readAsText(file);
        });
    }

    inventoryForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const wasEditing = editIndex !== -1;
        
        const barcode = document.getElementById('itemBarcode').value;
        const name = document.getElementById('itemName').value;
        const category = document.getElementById('itemCategory').value;
        const quantity = document.getElementById('itemQuantity').value;
        const minQtyRaw = document.getElementById('itemMinQty')?.value;
        const mrp = document.getElementById('itemMRP').value;
        const costPrice = document.getElementById('itemCostPrice').value;
        const sellingPrice = document.getElementById('itemSellingPrice').value;

        if(name && quantity && sellingPrice) {
            const parsedMinQty = minQtyRaw === '' || minQtyRaw === undefined ? null : (parseInt(minQtyRaw) || 0);
            const itemData = {
                barcode,
                name,
                category,
                quantity: parseInt(quantity),
                minQty: parsedMinQty,
                mrp: parseFloat(mrp),
                costPrice: parseFloat(costPrice),
                sellingPrice: parseFloat(sellingPrice)
            };

            // Attach image if provided (base64). Preserve existing image on edit if none selected.
            const imageData = window.pendingItemImage || (wasEditing ? (inventory[editIndex]?.image || null) : null);
            if (imageData) {
                itemData.image = imageData;
            }

            if (editIndex === -1) {
                inventory.push(itemData);
                logActivity('Add Item', `Added "${name}" - Qty: ${quantity}, Price: ₹${sellingPrice}`);
            } else {
                inventory[editIndex] = itemData;
                editIndex = -1;
                document.querySelector('#inventory-form button[type="submit"]').textContent = 'Add Item';
                logActivity('Edit Item', `Updated "${name}" - Qty: ${quantity}, Price: ₹${sellingPrice}`);
            }

            // Check and save new category
            if (category && !categories.includes(category)) {
                categories.push(category);
                try {
                    localStorage.setItem('bs_categories', JSON.stringify(categories));
                } catch (e) {
                    console.warn('Failed to save categories locally:', e);
                }
                if (currentUser) {
                    if (navigator.onLine) {
                        set(ref(db, `users/${currentUser.uid}/categories`), categories)
                            .catch(() => addToSyncQueue('categories', categories));
                    } else {
                        addToSyncQueue('categories', categories);
                    }
                }
                renderCategoryOptions();
            }

            saveInventory();
            renderInventory();
            inventoryForm.reset();

            // Clear pending image + file input after save
            window.pendingItemImage = null;
            const itemImageInput = document.getElementById('itemImage');
            if (itemImageInput) itemImageInput.value = '';
            
            // Cartoon animations
            const formRect = inventoryForm.getBoundingClientRect();
            createSparkles(formRect.left + formRect.width / 2, formRect.top + formRect.height / 2);
            addCartoonEffect(inventoryForm, 'rubber-band');
            createCoinDrop(formRect.left + formRect.width / 2, formRect.top + formRect.height / 2);
            showSuccessPopup(wasEditing ? 'Item Updated!' : 'Item Added!');
        }
    });

    window.editItem = function(index) {
        const item = inventory[index];
        document.getElementById('itemBarcode').value = item.barcode || '';
        document.getElementById('itemName').value = item.name;
        document.getElementById('itemCategory').value = item.category || 'General';
        document.getElementById('itemQuantity').value = item.quantity;
        const minEl = document.getElementById('itemMinQty');
        if (minEl) minEl.value = (item.minQty === null || item.minQty === undefined) ? '' : item.minQty;
        document.getElementById('itemMRP').value = item.mrp || '';
        document.getElementById('itemCostPrice').value = item.costPrice || '';
        document.getElementById('itemSellingPrice').value = item.sellingPrice || item.price || '';
        
        editIndex = index;
        document.querySelector('#inventory-form button[type="submit"]').textContent = 'Update Item';
        window.scrollTo(0, 0);
        switchTab('inventory'); // Ensure we are on the inventory tab
    };

    window.deleteItem = function(index) {
        if(confirm('Are you sure you want to delete this item?')) {
            // Cartoon deletion effects
            createBoomEffect(window.innerWidth / 2, window.innerHeight / 2);
            createFloatingEmoji('🗑️', window.innerWidth / 2 - 25, window.innerHeight / 2);
            const itemName = inventory[index].name;
            const itemQty = inventory[index].quantity;
            
            inventory.splice(index, 1);
            saveInventory();
            renderInventory();
            
            logActivity('Delete Item', `Deleted "${itemName}" (Qty: ${itemQty})`);
            
            const invTable = document.querySelector('#inventory-table');
            if (invTable) addCartoonEffect(invTable, 'wiggle');
            showSuccessPopup('Item Deleted!');
        }
    };

    function saveInventory() {
        // Always save locally first
        try {
            localStorage.setItem('bs_inventory', JSON.stringify(inventory));
        } catch (e) {
            console.warn('Local save failed', e);
        }
        
        // Queue for Firebase sync if online
        if (currentUser) {
            if (navigator.onLine) {
                set(ref(db, `users/${currentUser.uid}/inventory`), inventory)
                    .catch(err => {
                        console.error('Firebase save failed:', err);
                        addToSyncQueue('inventory', inventory);
                    });
            } else {
                addToSyncQueue('inventory', inventory);
            }
        }
    }

    function saveTransactionsLocal() {
        try {
            localStorage.setItem('bs_transactions', JSON.stringify(transactions));
        } catch (e) {
            console.warn('Saving transactions locally failed', e);
        }
        
        // Queue for Firebase sync
        if (currentUser) {
            if (navigator.onLine) {
                set(ref(db, `users/${currentUser.uid}/transactions`), transactions)
                    .catch(err => {
                        console.error('Firebase save failed:', err);
                        addToSyncQueue('transactions', transactions);
                    });
            } else {
                addToSyncQueue('transactions', transactions);
            }
        }
    }

    // --- Billing System ---

    // Initialize Billing Info
    function initBillingInfo() {
        const date = new Date();
        document.getElementById('invoiceDate').textContent = date.toLocaleDateString();
        document.getElementById('invoiceNumber').textContent = 'INV-' + Math.floor(1000 + Math.random() * 9000);
    }
    
    // Call on load
    initBillingInfo();

    // Scanner Mode Toggle Logic
    document.getElementById('scannerMode').addEventListener('change', (e) => {
        const isScannerMode = e.target.checked;
        document.getElementById('billItemQuantity').disabled = isScannerMode;
        document.getElementById('billItemDiscount').disabled = isScannerMode;
        document.getElementById('billItemDiscountType').disabled = isScannerMode;
        
        if (isScannerMode) {
            document.getElementById('billItemSearch').focus();
            document.getElementById('billItemSearch').placeholder = "Scan Barcode...";
        } else {
            document.getElementById('billItemSearch').placeholder = "Name or Barcode";
        }
    });

    // Debounced billing search to reduce UI updates while typing
    const billSearchEl = document.getElementById('billItemSearch');
    if (billSearchEl) {
        billSearchEl.addEventListener('input', debounce(() => {
            // don't do heavy work here; we keep datalist updated
            updateBillingDatalist();
        }, 150));
    }

    function updateBillingDatalist() {
        inventoryDatalist.innerHTML = '';
        inventory.forEach(item => {
            const option = document.createElement('option');
            option.value = item.name; // Use name as the value for simplicity
            option.textContent = `${item.barcode ? item.barcode + ' - ' : ''}${item.name} (Qty: ${item.quantity}, Price: ₹${item.sellingPrice})`;
            inventoryDatalist.appendChild(option);
        });
    }

    billingForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const searchInput = document.getElementById('billItemSearch').value;
        const scannerMode = document.getElementById('scannerMode').checked;
        
        let quantity = parseInt(document.getElementById('billItemQuantity').value);
        let discountInput = parseFloat(document.getElementById('billItemDiscount').value) || 0;
        let discountType = document.getElementById('billItemDiscountType').value;

        // Scanner Mode Overrides
        if (scannerMode) {
            quantity = 1;
            discountInput = 0;
        }

        // Find item by name or barcode
        const item = inventory.find(i => i.name === searchInput || i.barcode === searchInput);

        if (item) {
            // Check stock (considering items already in current bill)
            const currentQtyInBill = currentBill
                .filter(b => b.name === item.name)
                .reduce((sum, b) => sum + b.quantity, 0);

            if (item.quantity >= (currentQtyInBill + quantity)) {
                const price = parseFloat(item.sellingPrice);
                const lineTotal = price * quantity;
                
                let discountAmount = 0;
                if (discountType === 'percent') {
                    discountAmount = (lineTotal * discountInput) / 100;
                } else {
                    discountAmount = discountInput;
                }

                if (discountAmount > lineTotal) {
                    alert('Discount cannot be greater than the total amount!');
                    return;
                }

                const total = lineTotal - discountAmount;

                // Check if we should merge with existing line item (Scanner Mode Optimization)
                const existingItemIndex = currentBill.findIndex(b => b.name === item.name && b.discountValue === discountInput && b.discountType === discountType);
                
                if (scannerMode && existingItemIndex > -1) {
                    // Update existing line item
                    currentBill[existingItemIndex].quantity += quantity;
                    currentBill[existingItemIndex].total += total;
                } else {
                    // Add new line item
                    currentBill.push({
                        name: item.name,
                        price: price,
                        quantity: quantity,
                        discountType: discountType,
                        discountValue: discountInput,
                        discountAmount: discountAmount,
                        total: total,
                        originalItem: item
                    });
                }
                
                renderBill();
                billingForm.reset();
                document.getElementById('billItemQuantity').value = 1;
                document.getElementById('billItemDiscount').value = 0;
                document.getElementById('billItemSearch').focus();
                
                // Cartoon animations for billing
                createSparkles(window.innerWidth / 2, window.innerHeight / 3);
                const billTable = document.querySelector('#billing-table');
                if (billTable) addCartoonEffect(billTable, 'bounce');
                createFloatingEmoji('🛒', window.innerWidth / 2 - 25, window.innerHeight / 3);
            } else {
                alert(`Insufficient stock! Only ${item.quantity} available.`);
                // If scanner mode, clear input anyway to prevent blocking
                if (scannerMode) {
                    document.getElementById('billItemSearch').value = '';
                    document.getElementById('billItemSearch').focus();
                }
            }
        } else {
            alert('Item not found!');
            // If scanner mode, clear input anyway
            if (scannerMode) {
                document.getElementById('billItemSearch').value = '';
                document.getElementById('billItemSearch').focus();
            }
        }
    });

    document.getElementById('billTaxRate').addEventListener('input', renderBill);

    function renderBill() {
        billingTableBody.innerHTML = '';
        let subtotal = 0;
        let totalDiscount = 0;

        currentBill.forEach((item, index) => {
            subtotal += item.price * item.quantity;
            totalDiscount += item.discountAmount;
            
            const discountDisplay = item.discountType === 'percent' 
                ? `${item.discountValue}%` 
                : `₹${item.discountValue}`;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.name}</td>
                <td>₹${item.price.toFixed(2)}</td>
                <td>${item.quantity}</td>
                <td>${discountDisplay} (-₹${item.discountAmount.toFixed(2)})</td>
                <td>₹${item.total.toFixed(2)}</td>
                <td>
                    <button class="delete-btn" onclick="removeFromBill(${index})">Remove</button>
                </td>
            `;
            billingTableBody.appendChild(row);
        });

        const taxRate = parseFloat(document.getElementById('billTaxRate').value) || 0;
        const taxableAmount = subtotal - totalDiscount;
        const taxAmount = (taxableAmount * taxRate) / 100;
        const grandTotal = taxableAmount + taxAmount;

        document.getElementById('billSubtotal').textContent = subtotal.toFixed(2);
        document.getElementById('billTotalDiscount').textContent = totalDiscount.toFixed(2);
        document.getElementById('billTotalTax').textContent = taxAmount.toFixed(2);
        document.getElementById('billGrandTotal').textContent = grandTotal.toFixed(2);
        
        calculateChange();
    }

    window.removeFromBill = function(index) {
        // Small boom and swing for removing item
        const billTable = document.getElementById('billing-table');
        if (billTable) {
            const rect = billTable.getBoundingClientRect();
            createBoomEffect(rect.left + rect.width / 2, rect.top + 100);
            addCartoonEffect(billTable, 'swing');
        }
        currentBill.splice(index, 1);
        renderBill();
    };

    window.calculateChange = function() {
        const grandTotal = parseFloat(document.getElementById('billGrandTotal').textContent) || 0;
        const received = parseFloat(document.getElementById('amountReceived').value) || 0;
        const change = received - grandTotal;
        const changeElement = document.getElementById('changeToReturn');
        
        if(document.getElementById('amountReceived').value !== '') {
            changeElement.value = change.toFixed(2);
            changeElement.style.color = change >= 0 ? 'green' : 'red';
        } else {
            changeElement.value = '';
        }
    };

    window.clearCurrentBill = function() {
        if(currentBill.length > 0 && confirm('Clear current bill items?')) {
            // Cartoon clear effects
            createBoomEffect(window.innerWidth / 2, window.innerHeight / 2);
            createFloatingEmoji('🧹', window.innerWidth / 2 - 25, window.innerHeight / 2);
            
            currentBill = [];
            renderBill();
            
            const billSection = document.getElementById('billing-section');
            if (billSection) addCartoonEffect(billSection, 'jello');
            
            document.getElementById('amountReceived').value = '';
            document.getElementById('changeToReturn').value = '';
        }
    };

    window.printBill = function() {
        if (currentBill.length === 0) {
            alert('Bill is empty!');
            return;
        }

        const customerName = document.getElementById('customerName').value || 'Walk-in Customer';
        const customerPhone = document.getElementById('customerPhone').value || '-';
        const paymentMode = document.getElementById('paymentMode').value;
        const salesPerson = document.getElementById('billSalesPerson').value;
        const invoiceNo = document.getElementById('invoiceNumber').textContent;
        const date = document.getElementById('invoiceDate').textContent;
        const subtotal = document.getElementById('billSubtotal').textContent;
        const totalDiscount = document.getElementById('billTotalDiscount').textContent;
        const taxAmount = document.getElementById('billTotalTax').textContent;
        const grandTotal = document.getElementById('billGrandTotal').textContent;

        if (confirm(`Generate Invoice for ${customerName}? Total: ₹${grandTotal}`)) {
            // Update inventory quantities
            currentBill.forEach(billItem => {
                const inventoryItem = inventory.find(i => i.name === billItem.name);
                if (inventoryItem) {
                    inventoryItem.quantity -= billItem.quantity;
                }
            });

            // Save Transaction
            const transaction = {
                invoiceNo,
                date,
                customerName,
                customerPhone,
                salesPerson,
                items: [...currentBill],
                subtotal,
                totalDiscount,
                taxAmount,
                grandTotal,
                paymentMode
            };
            transactions.push(transaction);
            
            // Log activity
            logActivity('Sale Completed', `Invoice ${invoiceNo} - ${customerName} - ₹${grandTotal} (${paymentMode})`);
            
            // Save both inventory and transactions to Firebase
            if (currentUser) {
                set(ref(db, `users/${currentUser.uid}/inventory`), inventory)
                    .then(() => {
                        return set(ref(db, `users/${currentUser.uid}/transactions`), transactions);
                    })
                    .then(() => {
                        console.log('Inventory and transactions saved successfully');
                        renderInventory();
                    })
                    .catch(error => {
                        console.error('Error saving to Firebase:', error);
                        alert('Warning: Data may not have been saved to cloud. Please check your connection.');
                        renderInventory();
                    });
            } else {
                renderInventory();
            }
            
            // Always update local backup
            saveTransactionsLocal();
            try {
                localStorage.setItem('bs_inventory', JSON.stringify(inventory));
            } catch (e) {
                console.warn('Local backup failed', e);
            }
            
            // Generate Printable Invoice
            generateInvoiceHTML(transaction);
            
            // Checkout celebration with cartoon animations
            createConfetti();
            createFloatingEmoji('💰', window.innerWidth / 2 - 25, window.innerHeight / 2);
            createFloatingEmoji('🎉', window.innerWidth / 2 + 25, window.innerHeight / 2);
            createFloatingEmoji('✨', window.innerWidth / 2 - 50, window.innerHeight / 2 + 30);
            showSuccessPopup('Sale Completed! ₹' + grandTotal);
            const printBtn = document.getElementById('print-bill-btn');
            if (printBtn) {
                printBtn.classList.add('pulse-success');
                addCartoonEffect(printBtn, 'heart-beat');
            }
            const billSection = document.getElementById('billing-section');
            if (billSection) addCartoonEffect(billSection, 'tada');
            setTimeout(() => {
                if (printBtn) printBtn.classList.remove('pulse-success');
            }, 800);

            // Reset Bill
            currentBill = [];
            document.getElementById('customerName').value = '';
            document.getElementById('customerPhone').value = '';
            document.getElementById('billTaxRate').value = 0;
            document.getElementById('amountReceived').value = '';
            document.getElementById('changeToReturn').value = '';
            initBillingInfo(); // New Invoice Number
            renderBill();
            switchTab('inventory'); 
        }
    };

    window.reprintBill = function(invoiceNo) {
        const transaction = transactions.find(t => t.invoiceNo === invoiceNo);
        if (transaction) {
            generateInvoiceHTML(transaction);
        } else {
            alert('Invoice not found!');
        }
    };

    function generateInvoiceHTML(transaction) {
        const printWindow = window.open('', '', 'height=600,width=800');
        printWindow.document.write('<html><head><title>Invoice ' + transaction.invoiceNo + '</title>');
        printWindow.document.write('<style>');
        printWindow.document.write('body { font-family: sans-serif; padding: 20px; }');
        printWindow.document.write('.header { text-align: center; margin-bottom: 20px; }');
        printWindow.document.write('.details { margin-bottom: 20px; }');
        printWindow.document.write('table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }');
        printWindow.document.write('th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }');
        printWindow.document.write('.totals { text-align: right; }');
        printWindow.document.write('</style>');
        printWindow.document.write('</head><body>');
        
        printWindow.document.write('<div class="header"><h1>' + settings.storeName + '</h1><p>' + settings.storeAddress + '</p><p>Phone: ' + settings.storePhone + '</p><h3>Retail Invoice</h3><p>Invoice #: ' + transaction.invoiceNo + '</p><p>Date: ' + transaction.date + '</p></div>');
        printWindow.document.write('<div class="details"><p><strong>Customer:</strong> ' + transaction.customerName + '</p><p><strong>Phone:</strong> ' + transaction.customerPhone + '</p><p><strong>Served By:</strong> ' + (transaction.salesPerson || 'Owner') + '</p></div>');
        
        printWindow.document.write('<table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>');
        transaction.items.forEach(item => {
            printWindow.document.write('<tr><td>' + item.name + '</td><td>' + item.quantity + '</td><td>₹' + item.price.toFixed(2) + '</td><td>₹' + item.total.toFixed(2) + '</td></tr>');
        });
        printWindow.document.write('</tbody></table>');
        
        printWindow.document.write('<div class="totals">');
        printWindow.document.write('<p>Subtotal: ₹' + transaction.subtotal + '</p>');
        printWindow.document.write('<p>Discount: -₹' + transaction.totalDiscount + '</p>');
        printWindow.document.write('<p>Tax: +₹' + transaction.taxAmount + '</p>');
        printWindow.document.write('<h3>Grand Total: ₹' + transaction.grandTotal + '</h3>');
        printWindow.document.write('<p>Payment Mode: ' + transaction.paymentMode + '</p>');
        printWindow.document.write('</div>');
        
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.print();
    }

    // --- Reports System ---
    let salesChartInstance = null;
    let categoryChartInstance = null;

    function renderReports() {
        const totalSalesElement = document.getElementById('totalSales');
        const totalOrdersElement = document.getElementById('totalOrders');
        const transTableBody = document.querySelector('#transactions-table tbody');
        
        // New Elements
        const totalInventoryValueElement = document.getElementById('totalInventoryValue');
        const totalStockCountElement = document.getElementById('totalStockCount');
        const salesTodayElement = document.getElementById('salesToday');
        const salesMonthElement = document.getElementById('salesMonth');
        const totalInventoryCostElement = document.getElementById('totalInventoryCost');
        const lowStockTableBody = document.querySelector('#low-stock-table tbody');

        // Calculate Sales Stats
        let totalSales = 0;
        let salesToday = 0;
        let salesMonth = 0;
        let categorySales = {};
        let employeeSales = {};
        let dailySales = {}; // For Chart
        
        const todayStr = new Date().toLocaleDateString();
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();

        // Initialize last 30 days for chart
        for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            dailySales[d.toLocaleDateString()] = 0;
        }

        transactions.forEach(t => {
            const amount = parseFloat(t.grandTotal);
            totalSales += amount;
            
            if (t.date === todayStr) {
                salesToday += amount;
            }
            
            // Daily Sales for Chart
            if (dailySales.hasOwnProperty(t.date)) {
                dailySales[t.date] += amount;
            }
            
            // Simple month check - try to parse date
            const d = new Date(t.date);
            if(!isNaN(d.getTime())) {
                if(d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
                    salesMonth += amount;
                }
            }

            // Employee Sales Calculation
            const salesPerson = t.salesPerson || 'Owner';
            if (!employeeSales[salesPerson]) {
                employeeSales[salesPerson] = 0;
            }
            employeeSales[salesPerson] += amount;

            // Category Sales Calculation
            if (t.items && Array.isArray(t.items)) {
                t.items.forEach(item => {
                    // Find category from current inventory if not stored in transaction
                    // Ideally transaction should store category, but for backward compatibility:
                    let cat = 'General';
                    if (item.originalItem && item.originalItem.category) {
                        cat = item.originalItem.category;
                    } else {
                        const invItem = inventory.find(i => i.name === item.name);
                        if (invItem && invItem.category) {
                            cat = invItem.category;
                        }
                    }
                    
                    if (!categorySales[cat]) {
                        categorySales[cat] = 0;
                    }
                    categorySales[cat] += parseFloat(item.total);
                });
            }
        });
        
        // Calculate Inventory Stats
        let inventoryCost = 0;
        let inventoryValue = 0;
        let stockCount = 0;
        let lowStockItems = [];
        let outOfStockItems = [];
        const threshold = settings.lowStockThreshold || 5;

        inventory.forEach(i => {
            const qty = parseInt(i.quantity);
            inventoryCost += (parseFloat(i.costPrice) || 0) * qty;
            inventoryValue += (parseFloat(i.sellingPrice) || 0) * qty;
            stockCount += qty;

            const effectiveMin = getEffectiveMinQty(i);

            if(qty === 0) {
                outOfStockItems.push(i);
            } else if(effectiveMin > 0 && qty <= effectiveMin) {
                lowStockItems.push(i);
            }
        });

        // Update UI
        totalSalesElement.textContent = totalSales.toFixed(2);
        totalOrdersElement.textContent = transactions.length;
        
        if(totalInventoryValueElement) totalInventoryValueElement.textContent = inventoryValue.toFixed(2);
        if(totalStockCountElement) totalStockCountElement.textContent = stockCount;
        if(salesTodayElement) salesTodayElement.textContent = salesToday.toFixed(2);
        if(salesMonthElement) salesMonthElement.textContent = salesMonth.toFixed(2);
        if(totalInventoryCostElement) totalInventoryCostElement.textContent = inventoryCost.toFixed(2);

        // Render daily sales summary (default to today)
        const dateInput = document.getElementById('dailyReportDate');
        if (dateInput) {
            // Set default value to today in YYYY-MM-DD for the date input
            const today = new Date();
            const pad = (n) => n.toString().padStart(2, '0');
            dateInput.value = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;
            // Render today's sales
            renderDailySales(dateInput.value);
        }

        // Render Category Sales
        const categorySalesTableBody = document.querySelector('#category-sales-table tbody');
        if (categorySalesTableBody) {
            categorySalesTableBody.innerHTML = '';
            const sortedCategories = Object.entries(categorySales).sort((a, b) => b[1] - a[1]);
            
            if (sortedCategories.length === 0) {
                categorySalesTableBody.innerHTML = '<tr><td colspan="2" style="text-align:center;">No sales data</td></tr>';
            } else {
                sortedCategories.forEach(([cat, amount]) => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${cat}</td>
                        <td>₹${amount.toFixed(2)}</td>
                    `;
                    categorySalesTableBody.appendChild(row);
                });
            }
        }

        // Render Employee Sales
        const employeeSalesTableBody = document.querySelector('#employee-sales-table tbody');
        if (employeeSalesTableBody) {
            employeeSalesTableBody.innerHTML = '';
            const sortedEmployees = Object.entries(employeeSales).sort((a, b) => b[1] - a[1]);
            
            if (sortedEmployees.length === 0) {
                employeeSalesTableBody.innerHTML = '<tr><td colspan="2" style="text-align:center;">No sales data</td></tr>';
            } else {
                sortedEmployees.forEach(([name, amount]) => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${name}</td>
                        <td>₹${amount.toFixed(2)}</td>
                    `;
                    employeeSalesTableBody.appendChild(row);
                });
            }
        }

        // Render Low Stock Table
        if(lowStockTableBody) {
            lowStockTableBody.innerHTML = '';
            const allLowStock = [...outOfStockItems, ...lowStockItems];
            
            if(allLowStock.length === 0) {
                lowStockTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; color: #2ecc71; padding: 20px;">✅ All items are well stocked!</td></tr>';
            } else {
                // Sort by quantity (lowest first)
                allLowStock.sort((a, b) => parseInt(a.quantity) - parseInt(b.quantity));
                
                allLowStock.forEach(item => {
                    const qty = parseInt(item.quantity);
                    const minQty = getEffectiveMinQty(item);
                    const reorderQty = getReorderQty(item);
                    const isOutOfStock = qty === 0;
                    const statusText = isOutOfStock ? 'OUT OF STOCK' : 'LOW STOCK';
                    const statusColor = isOutOfStock ? '#e74c3c' : '#f39c12';
                    const statusBg = isOutOfStock ? '#f8d7da' : '#fff3cd';
                    
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td style="font-weight: bold;">${item.name}</td>
                        <td>${item.category || 'General'}</td>
                        <td style="text-align: center; font-weight: bold; color: ${statusColor};">${qty}</td>
                        <td style="text-align:center;">${minQty > 0 ? minQty : '-'}</td>
                        <td style="text-align:center; font-weight:bold; color:${reorderQty > 0 ? '#6c5ce7' : '#999'};">${reorderQty > 0 ? reorderQty : '-'}</td>
                        <td style="background-color: ${statusBg}; color: ${statusColor}; font-weight: bold; text-align: center; font-size: 11px;">
                            ${statusText}
                        </td>
                        <td>
                            <button class="edit-btn" onclick="editItem(${inventory.indexOf(item)})" style="font-size: 12px; padding: 4px 8px;">Restock</button>
                        </td>
                    `;
                    lowStockTableBody.appendChild(row);
                });
            }
            
            // Update summary text
            const summaryEl = document.getElementById('low-stock-summary');
            if (summaryEl) {
                if (allLowStock.length === 0) {
                    summaryEl.textContent = 'No items need restocking.';
                    summaryEl.style.color = '#2ecc71';
                } else {
                    const outMsg = outOfStockItems.length > 0 ? `${outOfStockItems.length} out of stock` : '';
                    const lowMsg = lowStockItems.length > 0 ? `${lowStockItems.length} low stock` : '';
                    const parts = [outMsg, lowMsg].filter(p => p);
                    summaryEl.textContent = `⚠️ ${parts.join(', ')} - Min Qty: per-item (fallback ${threshold})`;
                    summaryEl.style.color = outOfStockItems.length > 0 ? '#e74c3c' : '#f39c12';
                    summaryEl.style.fontWeight = 'bold';
                }
            }
        }

        // Render Transactions Table
        if (transTableBody) {
            transTableBody.innerHTML = '';
            // Show last 10 transactions reversed
            transactions.slice().reverse().slice(0, 10).forEach(t => {
                const row = document.createElement('tr');
                const isRefund = t.type === 'Refund';
                const amountStyle = isRefund ? 'color: red;' : '';
                
                row.innerHTML = `
                    <td>${t.date}</td>
                    <td>${t.invoiceNo}</td>
                    <td>${t.customerName}</td>
                    <td style="${amountStyle}">₹${parseFloat(t.grandTotal).toFixed(2)}</td>
                    <td>${t.paymentMode}</td>
                    <td>
                        <button class="view-btn" data-invoice="${t.invoiceNo}" data-action="reprint">Reprint</button>
                        ${!isRefund ? `<button class="delete-btn" style="padding: 5px 10px; font-size: 14px; background-color: #e67e22;" data-invoice="${t.invoiceNo}" data-action="return">Return</button>` : ''}
                    </td>
                `;
                transTableBody.appendChild(row);
            });
        }

        // --- Render Charts ---
        
        // 1. Sales Trend Chart
        const salesCtx = document.getElementById('salesChart');
        if (salesCtx && typeof Chart !== 'undefined') {
            if (salesChartInstance) {
                salesChartInstance.destroy();
            }
            
            const dates = Object.keys(dailySales);
            const salesData = Object.values(dailySales);

            try {
                salesChartInstance = new Chart(salesCtx, {
                type: 'line',
                data: {
                    labels: dates,
                    datasets: [{
                        label: 'Daily Sales (₹)',
                        data: salesData,
                        borderColor: '#3498db',
                        backgroundColor: 'rgba(52, 152, 219, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
            } catch (error) {
                console.warn('Failed to render sales chart:', error);
            }
        }

        // 2. Category Chart
        const categoryCtx = document.getElementById('categoryChart');
        if (categoryCtx && typeof Chart !== 'undefined') {
            if (categoryChartInstance) {
                categoryChartInstance.destroy();
            }

            const catLabels = Object.keys(categorySales);
            const catData = Object.values(categorySales);
            
            // Generate random colors
            const backgroundColors = catLabels.map(() => 
                `hsl(${Math.floor(Math.random() * 360)}, 70%, 60%)`
            );

            try {
                categoryChartInstance = new Chart(categoryCtx, {
                type: 'doughnut',
                data: {
                    labels: catLabels,
                    datasets: [{
                        data: catData,
                        backgroundColor: backgroundColors,
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
            } catch (error) {
                console.warn('Failed to render category chart:', error);
            }
        }
    }

    // --- Daily Sales Report ---
    // Accepts a date string in YYYY-MM-DD (from <input type="date">) or locale date string
    window.getDailySales = function(dateStr) {
        if (!dateStr) return { total: 0, transactions: [] };
        // Normalize dateStr to locale date string used in transactions
        let dt;
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            dt = new Date(dateStr + 'T00:00:00');
        } else {
            dt = new Date(dateStr);
        }
        if (isNaN(dt.getTime())) return { total: 0, transactions: [] };
        const localeDate = dt.toLocaleDateString();
        const dailyTx = transactions.filter(t => t.date === localeDate);
        const total = dailyTx.reduce((s, t) => s + (parseFloat(t.grandTotal) || 0), 0);
        return { total, transactions: dailyTx };
    };

    window.renderDailySales = function(dateInputValue) {
        const outTotalElId = 'dailySalesTotal';
        const outTableId = 'daily-sales-table';

        // Ensure UI elements exist; create them if first time
        let container = document.getElementById('daily-sales-container');
        if (!container) {
            const reportsSection = document.querySelector('#reports-section .card');
            container = document.createElement('div');
            container.id = 'daily-sales-container';
            container.className = 'card';
            container.style.marginTop = '15px';
            container.innerHTML = `
                <h3>Daily Sales Details</h3>
                <p style="margin:6px 0;">Date: <strong id="dailySalesDate"></strong></p>
                <p style="margin:6px 0;">Total Sales: ₹<span id="dailySalesTotal">0.00</span></p>
                <div class="table-responsive">
                    <table id="daily-sales-table">
                        <thead>
                            <tr><th>Invoice</th><th>Customer</th><th>Amount</th><th>Items</th></tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            `;
            // Place it at the end of reports section
            const reportsContainer = document.querySelector('#reports-section');
            if (reportsContainer) {
                reportsContainer.appendChild(container);
            }
        }

        const parsed = window.getDailySales(dateInputValue);
        // Update header values
        const dateDisplayEl = document.getElementById('dailySalesDate');
        const totalEl = document.getElementById('dailySalesTotal');
        const tbody = document.querySelector('#daily-sales-table tbody');
        let displayDate = dateInputValue;
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateInputValue)) {
            const d = new Date(dateInputValue + 'T00:00:00');
            displayDate = d.toLocaleDateString();
        }
        if (dateDisplayEl) dateDisplayEl.textContent = displayDate;
        if (totalEl) totalEl.textContent = (parsed.total || 0).toFixed(2);
        if (tbody) {
            tbody.innerHTML = '';
            if (parsed.transactions.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No transactions for this date</td></tr>';
            } else {
                parsed.transactions.forEach(t => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${t.invoiceNo}</td>
                        <td>${t.customerName || '-'}</td>
                        <td>₹${parseFloat(t.grandTotal).toFixed(2)}</td>
                        <td>${(t.items || []).map(it => `${it.name} x${it.quantity}`).join(', ')}</td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        }
    };

    window.openReturnModal = function(invoiceNo) {
        const transaction = transactions.find(t => t.invoiceNo === invoiceNo);
        if (!transaction) return;
        
        document.getElementById('returnInvoiceNo').textContent = invoiceNo;
        const tbody = document.querySelector('#return-items-table tbody');
        tbody.innerHTML = '';
        
        transaction.items.forEach((item, index) => {
            // Calculate effective unit price (total / quantity) to account for discounts
            const effectiveUnitPrice = item.total / item.quantity;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.name}</td>
                <td>${item.quantity}</td>
                <td>₹${effectiveUnitPrice.toFixed(2)}</td>
                <td>
                    <input type="number" class="return-qty" data-index="${index}" 
                           min="0" max="${item.quantity}" value="0" 
                           oninput="calculateRefundTotal()" style="width: 80px; padding: 5px;">
                </td>
            `;
            tbody.appendChild(row);
        });
        
        document.getElementById('returnTotalAmount').textContent = '0.00';
        document.getElementById('return-modal').style.display = 'block';
        window.currentReturnTransaction = transaction;
    };

    window.closeReturnModal = function() {
        document.getElementById('return-modal').style.display = 'none';
        window.currentReturnTransaction = null;
    };

    window.calculateRefundTotal = function() {
        let total = 0;
        const inputs = document.querySelectorAll('.return-qty');
        inputs.forEach(input => {
            const qty = parseInt(input.value) || 0;
            const index = input.dataset.index;
            const item = window.currentReturnTransaction.items[index];
            const effectiveUnitPrice = item.total / item.quantity; 
            
            // Validate max quantity
            if (qty > item.quantity) {
                input.value = item.quantity;
                total += item.quantity * effectiveUnitPrice;
            } else if (qty < 0) {
                input.value = 0;
            } else {
                total += qty * effectiveUnitPrice;
            }
        });
        document.getElementById('returnTotalAmount').textContent = total.toFixed(2);
    };

    window.processReturn = function() {
        if (!window.currentReturnTransaction) return;
        
        const inputs = document.querySelectorAll('.return-qty');
        let returnItems = [];
        let totalRefund = 0;
        
        inputs.forEach(input => {
            const qty = parseInt(input.value) || 0;
            if (qty > 0) {
                const index = input.dataset.index;
                const originalItem = window.currentReturnTransaction.items[index];
                const effectiveUnitPrice = originalItem.total / originalItem.quantity;
                const refundAmount = qty * effectiveUnitPrice;
                
                returnItems.push({
                    name: originalItem.name,
                    quantity: qty,
                    price: effectiveUnitPrice, // Store the refund unit price
                    total: refundAmount,
                    originalItem: originalItem
                });
                totalRefund += refundAmount;
            }
        });

        if (returnItems.length === 0) {
            alert('Please select items to return.');
            return;
        }

        if (confirm(`Process refund of ₹${totalRefund.toFixed(2)}? This will update inventory.`)) {
            // Update Inventory
            returnItems.forEach(rItem => {
                const invItem = inventory.find(i => i.name === rItem.name);
                if (invItem) {
                    invItem.quantity = parseInt(invItem.quantity) + parseInt(rItem.quantity);
                }
            });

            // Create Refund Transaction
            const refundTransaction = {
                invoiceNo: 'RET-' + Math.floor(1000 + Math.random() * 9000),
                date: new Date().toLocaleDateString(),
                customerName: window.currentReturnTransaction.customerName,
                customerPhone: window.currentReturnTransaction.customerPhone,
                items: returnItems,
                grandTotal: -totalRefund, // Negative for refund
                paymentMode: 'Refund',
                type: 'Refund',
                originalInvoice: window.currentReturnTransaction.invoiceNo
            };

            transactions.push(refundTransaction);
            
            if (currentUser) {
                set(ref(db, `users/${currentUser.uid}/transactions`), transactions);
                set(ref(db, `users/${currentUser.uid}/inventory`), inventory);
            }

            saveInventory(); 
            renderInventory();
            renderReports();
            closeReturnModal();
            alert('Refund processed successfully.');
        }
    };

    window.exportTransactions = function() {
        const headers = ['Date', 'Invoice No', 'Customer', 'Phone', 'Amount', 'Payment Mode'];
        const csvContent = [
            headers.join(','),
            ...transactions.map(t => [
                t.date,
                t.invoiceNo,
                `"${t.customerName}"`,
                t.customerPhone,
                t.grandTotal,
                t.paymentMode
            ].join(','))
        ].join('\n');
        
        downloadCSV(csvContent, 'transactions.csv');
    };

    function downloadCSV(content, fileName) {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', fileName);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    // Keyboard shortcuts: Ctrl+I -> focus item name, Ctrl+B -> focus billing search, Ctrl+Shift+C -> clear bill
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'i') {
            e.preventDefault();
            const el = document.getElementById('itemName');
            if (el) el.focus();
        }
        if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'b') {
            e.preventDefault();
            const el = document.getElementById('billItemSearch');
            if (el) el.focus();
        }
        if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'c') {
            e.preventDefault();
            if (currentBill.length > 0) {
                if (confirm('Clear current bill items?')) {
                    currentBill = [];
                    renderBill();
                }
            }
        }
    });

    // --- Settings Management ---
    function loadSettingsForm() {
        document.getElementById('storeName').value = settings.storeName;
        document.getElementById('storeAddress').value = settings.storeAddress;
        document.getElementById('storePhone').value = settings.storePhone;
        document.getElementById('defaultTax').value = settings.defaultTax;
        document.getElementById('lowStockThreshold').value = settings.lowStockThreshold || 5;
    }

    document.getElementById('settings-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const oldThreshold = settings.lowStockThreshold;
        settings = {
            storeName: document.getElementById('storeName').value,
            storeAddress: document.getElementById('storeAddress').value,
            storePhone: document.getElementById('storePhone').value,
            defaultTax: parseFloat(document.getElementById('defaultTax').value) || 0,
            lowStockThreshold: parseInt(document.getElementById('lowStockThreshold').value) || 5
        };
        
        // Save locally
        try {
            localStorage.setItem('bs_settings', JSON.stringify(settings));
        } catch (e) {
            console.warn('Failed to save settings locally:', e);
        }
        
        // Sync to Firebase
        if (currentUser) {
            if (navigator.onLine) {
                set(ref(db, `users/${currentUser.uid}/settings`), settings)
                    .catch(err => {
                        addToSyncQueue('settings', settings);
                    });
            } else {
                addToSyncQueue('settings', settings);
            }
        }
        
        alert('Settings Saved!');
        
        logActivity('Update Settings', `Store: ${settings.storeName}, Tax: ${settings.defaultTax}%, Low Stock: ${settings.lowStockThreshold}`);
        
        // Re-render inventory if threshold changed to update colors
        if (oldThreshold !== settings.lowStockThreshold) {
            renderInventory();
            renderReports();
        }
    });

    window.clearAllData = function() {
        if (currentAppUser && currentAppUser.role !== 'Admin') {
            alert('Access Denied: Admin only.');
            return;
        }
        if(confirm('WARNING: This will delete ALL inventory and transaction data permanently from the database. Are you sure?')) {
            if (currentUser) {
                set(ref(db, `users/${currentUser.uid}`), null).then(() => {
                    location.reload();
                });
            }
        }
    };

    // --- Low Stock Alert Functions ---
    function updateLowStockBadge() {
        const lowStockCount = inventory.filter(i => isLowStockItem(i)).length;
        const badge = document.getElementById('low-stock-badge');
        
        if (badge) {
            if (lowStockCount > 0) {
                badge.textContent = lowStockCount;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        }
    }

    function showLowStockNotification() {
        const lowStockItems = inventory.filter(i => {
            const qty = parseInt(i.quantity) || 0;
            const minQty = getEffectiveMinQty(i);
            return qty > 0 && minQty > 0 && qty <= minQty;
        });
        const outOfStockItems = inventory.filter(i => (parseInt(i.quantity) || 0) === 0);
        
        // Remove any existing notification
        const existingNotification = document.querySelector('.low-stock-notification');
        if (existingNotification) {
            existingNotification.remove();
        }
        
        if (outOfStockItems.length > 0 || lowStockItems.length > 0) {
            let message = '🔔 Stock Alert:\n\n';
            
            if (outOfStockItems.length > 0) {
                message += `⚠️ ${outOfStockItems.length} item(s) OUT OF STOCK:\n`;
                outOfStockItems.slice(0, 3).forEach(item => {
                    message += `  • ${item.name}\n`;
                });
                if (outOfStockItems.length > 3) {
                    message += `  ... and ${outOfStockItems.length - 3} more\n`;
                }
                message += '\n';
            }
            
            if (lowStockItems.length > 0) {
                message += `🟡 ${lowStockItems.length} item(s) LOW STOCK:\n`;
                lowStockItems.slice(0, 3).forEach(item => {
                    const minQty = getEffectiveMinQty(item);
                    const reorder = getReorderQty(item);
                    message += `  • ${item.name} (${item.quantity} left, min ${minQty}, reorder ${reorder})\n`;
                });
                if (lowStockItems.length > 3) {
                    message += `  ... and ${lowStockItems.length - 3} more\n`;
                }
            }
            
            // Show custom notification popup
            const popup = document.createElement('div');
            popup.className = 'low-stock-notification';
            popup.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                    <strong style="font-size: 16px;">🔔 Stock Alert</strong>
                    <span onclick="this.parentElement.parentElement.remove()" style="cursor: pointer; font-size: 20px; line-height: 1;">&times;</span>
                </div>
                <div style="white-space: pre-line; font-size: 13px;">${message}</div>
                <button id="view-low-stock-btn" style="margin-top: 10px; width: 100%; padding: 8px; background: white; color: #e74c3c; border: 1px solid white; border-radius: 4px; cursor: pointer; font-weight: bold;">View Details</button>
            `;
            document.body.appendChild(popup);
            
            // Add event listener to button
            document.getElementById('view-low-stock-btn').addEventListener('click', function() {
                switchTab('reports');
                popup.remove();
            });
            
            // Auto-remove after 10 seconds
            setTimeout(() => {
                if (popup.parentElement) popup.remove();
            }, 10000);
        }
    }

    window.exportLowStock = function() {
        const lowStockItems = inventory.filter(i => isLowStockItem(i));
        
        if (lowStockItems.length === 0) {
            alert('No low stock items to export.');
            return;
        }
        
        const headers = ['Item Name', 'Category', 'Current Quantity', 'Min Qty', 'Reorder Suggest', 'Selling Price', 'Status'];
        const csvContent = [
            headers.join(','),
            ...lowStockItems.map(item => {
                const qty = parseInt(item.quantity);
                const minQty = getEffectiveMinQty(item);
                const reorderQty = getReorderQty(item);
                const status = qty === 0 ? 'OUT OF STOCK' : 'LOW STOCK';
                return [
                    `"${item.name}"`,
                    item.category || 'General',
                    qty,
                    minQty > 0 ? minQty : '',
                    reorderQty > 0 ? reorderQty : '',
                    item.sellingPrice || 0,
                    status
                ].join(',');
            })
        ].join('\n');
        
        downloadCSV(csvContent, 'low_stock_alert.csv');
    };

    // --- Barcode & QR Code Generation Functions ---
    
    // Generate a unique barcode for an item if it doesn't have one
    function generateBarcodeNumber() {
        const timestamp = Date.now().toString().slice(-8);
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        return timestamp + random;
    }

    window.generateMissingBarcodes = function() {
        let count = 0;
        inventory.forEach(item => {
            if (!item.barcode || item.barcode.trim() === '') {
                item.barcode = generateBarcodeNumber();
                count++;
            }
        });
        
        if (count > 0) {
            saveInventory();
            renderInventory();
            showSuccessPopup(`✅ Generated ${count} barcode(s)!`);
        } else {
            alert('All items already have barcodes!');
        }
    };

    window.printSingleBarcode = function(index, type = 'barcode') {
        const item = inventory[index];
        if (!item) return;
        
        if (type === 'barcode' && !item.barcode) {
            alert('This item has no barcode. Generate one first!');
            return;
        }
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Print ${type === 'qr' ? 'QR Code' : 'Barcode'} - ${item.name}</title>
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        display: flex; 
                        justify-content: center; 
                        align-items: center; 
                        min-height: 100vh;
                        margin: 0;
                        flex-direction: column;
                    }
                    .label {
                        text-align: center;
                        padding: 10px;
                        border: 1px dashed #ccc;
                        margin: 10px;
                    }
                    .label h3 { margin: 5px 0; font-size: 14px; }
                    .label p { margin: 3px 0; font-size: 11px; color: #666; }
                    canvas, svg { margin: 10px auto; display: block; }
                    @media print {
                        body { margin: 0; }
                        .label { border: none; page-break-after: always; }
                    }
                </style>
                ${type === 'qr' ? '<script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"><\\/script>' : '<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\\/script>'}
            </head>
            <body>
                <div class="label">
                    <h3>${item.name}</h3>
                    ${type === 'barcode' ? '<svg id="barcode"></svg>' : '<canvas id="qrcode"></canvas>'}
                    <p>${type === 'barcode' ? item.barcode : 'Item: ' + item.name}</p>
                    <p>Price: ₹${item.sellingPrice || 0}</p>
                </div>
                <script>
                    ${type === 'barcode' 
                        ? `JsBarcode("#barcode", "${item.barcode}", { width: 2, height: 60, displayValue: true });` 
                        : `QRCode.toCanvas(document.getElementById('qrcode'), '${JSON.stringify({name: item.name, price: item.sellingPrice, barcode: item.barcode || ''})}', { width: 150 });`
                    }
                    setTimeout(() => { window.print(); }, 500);
                <\\/script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    let barcodeModalType = 'barcode';
    let selectedBarcodeItems = new Set();

    window.openBulkBarcodePrint = function() {
        barcodeModalType = 'barcode';
        const itemsWithBarcodes = inventory.filter(i => i.barcode && i.barcode.trim() !== '');
        
        if (itemsWithBarcodes.length === 0) {
            alert('No items with barcodes found! Generate barcodes first.');
            return;
        }
        
        openBarcodeModal(itemsWithBarcodes, 'Print Barcodes');
    };

    window.openBulkQRPrint = function() {
        barcodeModalType = 'qr';
        openBarcodeModal(inventory, 'Print QR Codes');
    };

    function openBarcodeModal(items, title) {
        selectedBarcodeItems.clear();
        document.getElementById('barcode-modal-title').textContent = title;
        document.getElementById('barcode-modal').style.display = 'block';
        
        // Populate selection list
        const selectionList = document.getElementById('barcode-selection-list');
        selectionList.innerHTML = '';
        
        items.forEach((item, index) => {
            const actualIndex = inventory.indexOf(item);
            const label = document.createElement('label');
            label.style.display = 'block';
            label.style.marginBottom = '5px';
            label.innerHTML = `
                <input type="checkbox" class="barcode-item-checkbox" data-index="${actualIndex}" onchange="updateBarcodePreview()">
                ${item.name} ${item.barcode ? '(' + item.barcode + ')' : ''}
            `;
            selectionList.appendChild(label);
        });
        
        updateBarcodePreview();
    }

    window.closeBarcodeModal = function() {
        document.getElementById('barcode-modal').style.display = 'none';
        selectedBarcodeItems.clear();
    };

    window.toggleAllBarcodes = function() {
        const checkboxes = document.querySelectorAll('.barcode-item-checkbox');
        const selectAll = document.getElementById('selectAllBarcodes').checked;
        
        checkboxes.forEach(cb => {
            cb.checked = selectAll;
        });
        
        updateBarcodePreview();
    };

    window.updateBarcodePreview = function() {
        selectedBarcodeItems.clear();
        const checkboxes = document.querySelectorAll('.barcode-item-checkbox:checked');
        
        checkboxes.forEach(cb => {
            selectedBarcodeItems.add(parseInt(cb.dataset.index));
        });
        
        const previewContainer = document.getElementById('barcode-preview-container');
        previewContainer.innerHTML = '';
        
        if (selectedBarcodeItems.size === 0) {
            previewContainer.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #999;">Select items to preview</p>';
            return;
        }
        
        selectedBarcodeItems.forEach(index => {
            const item = inventory[index];
            if (!item) return;
            
            if (barcodeModalType === 'barcode' && (!item.barcode || item.barcode.trim() === '')) {
                return; // Skip items without barcode
            }
            
            const labelDiv = document.createElement('div');
            labelDiv.className = 'barcode-label-preview';
            labelDiv.innerHTML = `
                <h4 style="margin: 5px 0; font-size: 12px;">${item.name}</h4>
                ${barcodeModalType === 'barcode' 
                    ? `<svg class="barcode-svg" data-barcode="${item.barcode}"></svg>` 
                    : `<canvas class="qr-canvas" data-item="${index}" width="150" height="150"></canvas>`
                }
                <p style="margin: 3px 0; font-size: 10px; color: #666;">₹${item.sellingPrice || 0}</p>
            `;
            previewContainer.appendChild(labelDiv);
        });
        
        // Render barcodes/QR codes
        if (typeof JsBarcode !== 'undefined' && barcodeModalType === 'barcode') {
            document.querySelectorAll('.barcode-svg').forEach(svg => {
                try {
                    JsBarcode(svg, svg.dataset.barcode, {
                        width: 1.5,
                        height: 40,
                        displayValue: true,
                        fontSize: 10
                    });
                } catch (e) {
                    console.error('Barcode generation error:', e);
                }
            });
        }
        
        if (typeof QRCode !== 'undefined' && barcodeModalType === 'qr') {
            document.querySelectorAll('.qr-canvas').forEach(canvas => {
                const index = parseInt(canvas.dataset.item);
                const item = inventory[index];
                try {
                    QRCode.toCanvas(canvas, JSON.stringify({
                        name: item.name,
                        price: item.sellingPrice,
                        barcode: item.barcode || ''
                    }), { width: 150 });
                } catch (e) {
                    console.error('QR code generation error:', e);
                }
            });
        }
    };

    window.printSelectedBarcodes = function() {
        if (selectedBarcodeItems.size === 0) {
            alert('Please select at least one item to print.');
            return;
        }
        
        const copies = parseInt(document.getElementById('barcodeCopies').value) || 1;
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Print ${barcodeModalType === 'qr' ? 'QR Codes' : 'Barcodes'}</title>
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        margin: 10px;
                    }
                    .label-grid {
                        display: grid;
                        grid-template-columns: repeat(3, 1fr);
                        gap: 10px;
                        padding: 10px;
                    }
                    .label {
                        text-align: center;
                        padding: 8px;
                        border: 1px dashed #ccc;
                        page-break-inside: avoid;
                    }
                    .label h3 { margin: 5px 0; font-size: 13px; }
                    .label p { margin: 3px 0; font-size: 10px; color: #666; }
                    canvas, svg { margin: 5px auto; display: block; }
                    @media print {
                        body { margin: 0; }
                        .label-grid { gap: 5px; }
                    }
                </style>
                ${barcodeModalType === 'qr' 
                    ? '<script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"><\\/script>' 
                    : '<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\\/script>'}
            </head>
            <body>
                <div class="label-grid" id="labels"></div>
                <script>
                    const items = ${JSON.stringify(Array.from(selectedBarcodeItems).map(i => inventory[i]))};
                    const copies = ${copies};
                    const type = '${barcodeModalType}';
                    const container = document.getElementById('labels');
                    
                    items.forEach((item, idx) => {
                        for (let c = 0; c < copies; c++) {
                            const label = document.createElement('div');
                            label.className = 'label';
                            label.innerHTML = \`
                                <h3>\${item.name}</h3>
                                \${type === 'barcode' 
                                    ? '<svg class="barcode" data-code="' + item.barcode + '"></svg>' 
                                    : '<canvas class="qr" data-idx="' + idx + '" width="120" height="120"></canvas>'}
                                <p>\${type === 'barcode' ? item.barcode : 'Price: ₹' + item.sellingPrice}</p>
                            \`;
                            container.appendChild(label);
                        }
                    });
                    
                    setTimeout(() => {
                        if (type === 'barcode' && typeof JsBarcode !== 'undefined') {
                            document.querySelectorAll('.barcode').forEach(svg => {
                                JsBarcode(svg, svg.dataset.code, { width: 1.5, height: 40, displayValue: false });
                            });
                        }
                        
                        if (type === 'qr' && typeof QRCode !== 'undefined') {
                            document.querySelectorAll('.qr').forEach(canvas => {
                                const item = items[parseInt(canvas.dataset.idx)];
                                QRCode.toCanvas(canvas, JSON.stringify({ name: item.name, price: item.sellingPrice, barcode: item.barcode || '' }), { width: 120 });
                            });
                        }
                        
                        setTimeout(() => window.print(), 500);
                    }, 300);
                <\\/script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    // Initial render
    // renderInventory(); // Moved to auth state change
    
    // Activity Log Filter Event Listener
    const activityLogFilter = document.getElementById('activityLogFilter');
    if (activityLogFilter) {
        activityLogFilter.addEventListener('change', () => {
            renderActivityLogs();
        });
    }
    
    // === QUICK WINS FEATURES ===
    
    // 1. Dark Mode Toggle
    window.toggleDarkMode = function() {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        const btn = document.getElementById('dark-mode-toggle');
        if (btn) {
            btn.textContent = isDark ? '☀️ Light' : '🌙 Dark';
            btn.style.background = isDark ? '#f39c12' : '#34495e';
        }
        localStorage.setItem('bs_dark_mode', isDark);
        logActivity('Settings', `Switched to ${isDark ? 'Dark' : 'Light'} mode`);
    };
    
    // Load dark mode preference
    if (localStorage.getItem('bs_dark_mode') === 'true') {
        toggleDarkMode();
    }
    
    // 2. Calculator Widget
    let calcExpression = '';
    
    window.toggleCalculator = function() {
        const calc = document.getElementById('calculator-widget');
        calc.style.display = calc.style.display === 'none' ? 'block' : 'none';
        if (calc.style.display === 'block') {
            calcClear();
        }
    };
    
    window.calcInput = function(value) {
        calcExpression += value;
        document.getElementById('calc-display').value = calcExpression;
    };
    
    window.calcClear = function() {
        calcExpression = '';
        document.getElementById('calc-display').value = '';
    };
    
    window.calcEqual = function() {
        try {
            const result = eval(calcExpression.replace('×', '*'));
            document.getElementById('calc-display').value = result;
            calcExpression = result.toString();
        } catch (e) {
            document.getElementById('calc-display').value = 'Error';
            calcExpression = '';
        }
    };
    
    // 3. Voice Search
    window.startVoiceSearch = function() {
        if (!('webkitSpeechRecognition' in window)) {
            alert('Voice search is not supported in your browser. Please use Chrome.');
            return;
        }
        
        const recognition = new webkitSpeechRecognition();
        recognition.lang = 'en-IN';
        recognition.continuous = false;
        recognition.interimResults = false;
        
        recognition.onstart = function() {
            document.getElementById('billItemSearch').placeholder = '🎤 Listening...';
            document.getElementById('billItemSearch').style.borderColor = '#e74c3c';
        };
        
        recognition.onresult = function(event) {
            const transcript = event.results[0][0].transcript;
            document.getElementById('billItemSearch').value = transcript;
            document.getElementById('billItemSearch').style.borderColor = '#27ae60';
            setTimeout(() => {
                document.getElementById('billItemSearch').style.borderColor = '#ddd';
                document.getElementById('billItemSearch').placeholder = 'Name or Barcode';
            }, 2000);
        };
        
        recognition.onerror = function(event) {
            console.error('Voice recognition error:', event.error);
            document.getElementById('billItemSearch').placeholder = 'Name or Barcode';
            document.getElementById('billItemSearch').style.borderColor = '#ddd';
        };
        
        recognition.start();
    };
    
    // 4. Backup/Restore Database
    window.backupDatabase = function() {
        const backupData = {
            inventory: inventory,
            transactions: transactions,
            settings: settings,
            categories: categories,
            appUsers: appUsers,
            activityLogs: activityLogs,
            backupDate: new Date().toISOString(),
            version: '1.0'
        };
        
        const dataStr = JSON.stringify(backupData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `billing_backup_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
        
        logActivity('Backup', 'Database backed up successfully');
        alert('✅ Database backup downloaded successfully!');
    };
    
    window.restoreDatabase = function(event) {
        if (!confirm('⚠️ WARNING: This will replace all current data with the backup. Continue?')) {
            event.target.value = '';
            return;
        }
        
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const backupData = JSON.parse(e.target.result);
                
                // Validate backup structure
                if (!backupData.inventory || !backupData.version) {
                    alert('❌ Invalid backup file format!');
                    return;
                }
                
                // Restore data
                inventory = backupData.inventory || [];
                transactions = backupData.transactions || [];
                settings = backupData.settings || settings;
                categories = backupData.categories || categories;
                appUsers = backupData.appUsers || appUsers;
                activityLogs = backupData.activityLogs || [];
                
                // Save to localStorage
                localStorage.setItem('bs_inventory', JSON.stringify(inventory));
                localStorage.setItem('bs_transactions', JSON.stringify(transactions));
                localStorage.setItem('bs_settings', JSON.stringify(settings));
                localStorage.setItem('bs_categories', JSON.stringify(categories));
                localStorage.setItem('bs_appUsers', JSON.stringify(appUsers));
                localStorage.setItem('bs_activity_logs', JSON.stringify(activityLogs));
                
                // Sync to Firebase
                if (currentUser) {
                    set(ref(db, `users/${currentUser.uid}`), {
                        inventory, transactions, settings, categories, appUsers, activityLogs
                    });
                }
                
                // Re-render
                renderInventory();
                renderReports();
                renderAppUsers();
                renderActivityLogs();
                loadSettingsForm();
                
                logActivity('Restore', `Database restored from backup (${backupData.backupDate})`);
                alert(`✅ Database restored successfully!\\nBackup from: ${new Date(backupData.backupDate).toLocaleString()}`);
            } catch (error) {
                console.error('Restore error:', error);
                alert('❌ Failed to restore backup: ' + error.message);
            }
            event.target.value = '';
        };
        reader.readAsText(file);
    };
    
    // 5. Keyboard Shortcuts
    let shortcutsVisible = false;
    
    document.addEventListener('keydown', (e) => {
        // F2 - New Bill
        if (e.key === 'F2') {
            e.preventDefault();
            if (confirm('Start a new bill? Current bill will be cleared.')) {
                currentBill = [];
                renderBill();
                switchTab('billing');
                document.getElementById('billItemSearch').focus();
            }
        }
        
        // F3 - Search Inventory
        if (e.key === 'F3') {
            e.preventDefault();
            switchTab('inventory');
            document.getElementById('inventorySearch').focus();
        }
        
        // F4 - Add to Bill Focus
        if (e.key === 'F4') {
            e.preventDefault();
            switchTab('billing');
            document.getElementById('billItemSearch').focus();
        }
        
        // F9 - Toggle Calculator
        if (e.key === 'F9') {
            e.preventDefault();
            toggleCalculator();
        }
        
        // Ctrl+P - Print Invoice
        if (e.ctrlKey && e.key === 'p') {
            e.preventDefault();
            if (currentBill.length > 0) {
                printBill();
            } else {
                alert('No items in current bill to print.');
            }
        }
        
        // Ctrl+S - Save/Add Item (prevent default save)
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            const activeTab = getActiveTabName();
            if (activeTab === 'inventory') {
                document.getElementById('inventory-form').dispatchEvent(new Event('submit'));
            } else if (activeTab === 'billing') {
                document.getElementById('billing-form').dispatchEvent(new Event('submit'));
            }
        }
        
        // Ctrl+? - Toggle shortcuts help
        if (e.ctrlKey && e.key === '/') {
            e.preventDefault();
            shortcutsVisible = !shortcutsVisible;
            document.getElementById('shortcuts-help').style.display = shortcutsVisible ? 'block' : 'none';
        }
    });
    
    // 6. Image Upload Handler
    document.getElementById('itemImage')?.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                // Store image as base64 in item data (will be added in form submit)
                window.pendingItemImage = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    });
});
