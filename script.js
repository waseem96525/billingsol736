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
        defaultTax: 0
    };
    let categories = ['General', 'Grocery', 'Electronics', 'Clothing', 'Pharmacy', 'Other'];
    let appUsers = [{name: 'Owner', role: 'Admin', pin: '0000'}];
    let currentAppUser = null;
    let currentBill = [];
    let editIndex = -1;

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
        signOut(auth).then(() => {
            location.reload();
        }).catch((error) => {
            console.error(error);
        });
    });

    function applyPermissions() {
        const isAdmin = currentAppUser.role === 'Admin';
        
        // Inventory Tab & Delete Buttons
        const inventoryTab = document.getElementById('nav-inventory');
        if (inventoryTab) {
            inventoryTab.style.display = isAdmin ? 'inline-block' : 'none';
        }
        
        const deleteBtns = document.querySelectorAll('.delete-item-btn');
        deleteBtns.forEach(btn => {
            btn.style.display = isAdmin ? 'inline-block' : 'none';
        });

        // Settings Tab
        const settingsTab = document.getElementById('nav-settings');
        if (settingsTab) {
            settingsTab.style.display = isAdmin ? 'inline-block' : 'none';
        }
        
        // Redirect if needed
        if (!isAdmin) {
            switchTab('billing');
        } else {
            // If admin, stay on current or go to inventory
            // For now, let's just default to inventory for admin on login
            if (document.getElementById('app-container').style.display !== 'none') {
                 switchTab('inventory');
            }
        }
    }

    function loadUserData(uid) {
        const dbRef = ref(db);
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
            } else {
                // New user or no data
                inventory = [];
                transactions = [];
            }
            // Initial Render after data load
            renderInventory();
            loadSettingsForm();
            renderReports(); // Update reports with loaded data
            renderCategoryOptions();
            renderAppUsers();
            updateSalesPersonDropdown();
            
            // Auto-login as Admin/Owner
            const adminUser = appUsers.find(u => u.role === 'Admin') || appUsers[0];
            if (adminUser) {
                currentAppUser = adminUser;
                appContainer.style.display = 'block';
                document.getElementById('loggedInStaffName').textContent = adminUser.name + ' (' + adminUser.role + ')';
                applyPermissions();
            }
        }).catch((error) => {
            console.error(error);
            // If Firebase read failed, try loading local backup
            try {
                const localInv = localStorage.getItem('bs_inventory');
                const localTx = localStorage.getItem('bs_transactions');
                if (localInv) inventory = JSON.parse(localInv);
                if (localTx) transactions = JSON.parse(localTx);
                renderInventory();
                renderReports();
                renderCategoryOptions();
            } catch (e) {
                console.warn('Failed to load local backup', e);
            }
        });
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
                <td>${user.role}</td>
                <td>${user.pin || 'N/A'}</td>
                <td>
                    ${index > 0 ? `<button class="delete-btn" onclick="deleteAppUser(${index})">Delete</button>` : '<span style="color: gray;">Default</span>'}
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
        const name = document.getElementById('userName').value;
        const role = document.getElementById('userRole').value;
        const pin = document.getElementById('userPin').value;
        
        if (name && pin) {
            // Check if PIN is unique
            if (appUsers.some(u => u.pin === pin)) {
                alert('PIN already exists! Please choose another.');
                return;
            }

            appUsers.push({ name, role, pin });
            if (currentUser) {
                set(ref(db, `users/${currentUser.uid}/appUsers`), appUsers);
            }
            renderAppUsers();
            updateSalesPersonDropdown();
            document.getElementById('user-form').reset();
        }
    });

    window.deleteAppUser = function(index) {
        if (confirm('Delete this user?')) {
            appUsers.splice(index, 1);
            if (currentUser) {
                set(ref(db, `users/${currentUser.uid}/appUsers`), appUsers);
            }
            renderAppUsers();
            updateSalesPersonDropdown();
        }
    };

    // --- Navigation ---
    window.switchTab = function(tab) {
        // Permission Check
        if ((tab === 'settings' || tab === 'inventory') && currentAppUser && currentAppUser.role !== 'Admin') {
            // alert('Access Denied: Admin only.'); // Optional: Silent redirect or alert
            return;
        }

        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`nav-${tab}`).classList.add('active');

        document.getElementById('inventory-section').style.display = 'none';
        document.getElementById('billing-section').style.display = 'none';
        document.getElementById('reports-section').style.display = 'none';
        document.getElementById('settings-section').style.display = 'none';

        if (tab === 'inventory') {
            document.getElementById('inventory-section').style.display = 'block';
        } else if (tab === 'billing') {
            document.getElementById('billing-section').style.display = 'block';
            updateBillingDatalist();
            // Apply default tax
            if(document.getElementById('billTaxRate').value == 0) {
                document.getElementById('billTaxRate').value = settings.defaultTax;
            }
        } else if (tab === 'reports') {
            document.getElementById('reports-section').style.display = 'block';
            renderReports();
        } else if (tab === 'settings') {
            document.getElementById('settings-section').style.display = 'block';
            loadSettingsForm();
        }
    };

    // --- Inventory Management ---

    function renderInventory(itemsToRender = inventory) {
        // Use DocumentFragment to minimize reflows when rendering many items
        const fragment = document.createDocumentFragment();
        const isAdmin = currentAppUser && currentAppUser.role === 'Admin';
        const deleteStyle = isAdmin ? '' : 'display:none;';

        itemsToRender.forEach((item) => {
            const originalIndex = inventory.indexOf(item);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${originalIndex + 1}</td>
                <td>${item.barcode || '-'}</td>
                <td>${item.name}</td>
                <td>${item.category || 'General'}</td>
                <td>${item.quantity}</td>
                <td>₹${item.mrp ? parseFloat(item.mrp).toFixed(2) : '-'}</td>
                <td>₹${item.costPrice ? parseFloat(item.costPrice).toFixed(2) : '-'}</td>
                <td>₹${parseFloat(item.sellingPrice || item.price || 0).toFixed(2)}</td>
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


    window.exportInventory = function() {
        const headers = ['Barcode', 'Name', 'Quantity', 'MRP', 'Cost Price', 'Selling Price'];
        const csvContent = [
            headers.join(','),
            ...inventory.map(item => [
                item.barcode || '',
                `"${item.name}"`,
                item.quantity,
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
                    const mrp = parseFloat(cols[3]) || 0;
                    const costPrice = parseFloat(cols[4]) || 0;
                    const sellingPrice = parseFloat(cols[5]) || 0;
                    if (!name) continue;
                    inventory.push({ barcode, name, quantity, mrp, costPrice, sellingPrice });
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
        
        const barcode = document.getElementById('itemBarcode').value;
        const name = document.getElementById('itemName').value;
        const category = document.getElementById('itemCategory').value;
        const quantity = document.getElementById('itemQuantity').value;
        const mrp = document.getElementById('itemMRP').value;
        const costPrice = document.getElementById('itemCostPrice').value;
        const sellingPrice = document.getElementById('itemSellingPrice').value;

        if(name && quantity && sellingPrice) {
            const itemData = {
                barcode,
                name,
                category,
                quantity: parseInt(quantity),
                mrp: parseFloat(mrp),
                costPrice: parseFloat(costPrice),
                sellingPrice: parseFloat(sellingPrice)
            };

            if (editIndex === -1) {
                inventory.push(itemData);
            } else {
                inventory[editIndex] = itemData;
                editIndex = -1;
                document.querySelector('#inventory-form button[type="submit"]').textContent = 'Add Item';
            }

            // Check and save new category
            if (category && !categories.includes(category)) {
                categories.push(category);
                if (currentUser) {
                    set(ref(db, `users/${currentUser.uid}/categories`), categories);
                }
                renderCategoryOptions();
            }

            saveInventory();
            renderInventory();
            inventoryForm.reset();
            
            // Cartoon animations
            const formRect = inventoryForm.getBoundingClientRect();
            createSparkles(formRect.left + formRect.width / 2, formRect.top + formRect.height / 2);
            addCartoonEffect(inventoryForm, 'rubber-band');
            createCoinDrop(formRect.left + formRect.width / 2, formRect.top + formRect.height / 2);
            showSuccessPopup(editIndex === -1 ? 'Item Added!' : 'Item Updated!');
        }
    });

    window.editItem = function(index) {
        const item = inventory[index];
        document.getElementById('itemBarcode').value = item.barcode || '';
        document.getElementById('itemName').value = item.name;
        document.getElementById('itemCategory').value = item.category || 'General';
        document.getElementById('itemQuantity').value = item.quantity;
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
            
            inventory.splice(index, 1);
            saveInventory();
            renderInventory();
            
            const invTable = document.querySelector('#inventory-table');
            if (invTable) addCartoonEffect(invTable, 'wiggle');
            showSuccessPopup('Item Deleted!');
        }
    };

    function saveInventory() {
        if (currentUser) {
            set(ref(db, `users/${currentUser.uid}/inventory`), inventory);
        }
        // Always keep a local backup for offline/fallback
        try {
            localStorage.setItem('bs_inventory', JSON.stringify(inventory));
        } catch (e) {
            console.warn('Local backup failed', e);
        }
    }

    function saveTransactionsLocal() {
        try {
            localStorage.setItem('bs_transactions', JSON.stringify(transactions));
        } catch (e) {
            console.warn('Saving transactions locally failed', e);
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
        const transactionsTableBody = document.querySelector('#transactions-table tbody');
        
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

        inventory.forEach(i => {
            const qty = parseInt(i.quantity);
            inventoryCost += (parseFloat(i.costPrice) || 0) * qty;
            inventoryValue += (parseFloat(i.sellingPrice) || 0) * qty;
            stockCount += qty;

            if(qty < 5) {
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
            if(lowStockItems.length === 0) {
                lowStockTableBody.innerHTML = '<tr><td colspan="2" style="text-align:center;">No low stock items</td></tr>';
            } else {
                lowStockItems.forEach(item => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${item.name}</td>
                        <td style="color: red; font-weight: bold;">${item.quantity}</td>
                    `;
                    lowStockTableBody.appendChild(row);
                });
            }
        }

        // Render Transactions Table
        transactionsTableBody.innerHTML = '';
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
                    <button class="view-btn" onclick="reprintBill('${t.invoiceNo}')">Reprint</button>
                    ${!isRefund ? `<button class="delete-btn" style="padding: 5px 10px; font-size: 14px; background-color: #e67e22;" onclick="openReturnModal('${t.invoiceNo}')">Return</button>` : ''}
                </td>
            `;
            transactionsTableBody.appendChild(row);
        });

        // --- Render Charts ---
        
        // 1. Sales Trend Chart
        const salesCtx = document.getElementById('salesChart');
        if (salesCtx) {
            if (salesChartInstance) {
                salesChartInstance.destroy();
            }
            
            const dates = Object.keys(dailySales);
            const salesData = Object.values(dailySales);

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
        }

        // 2. Category Chart
        const categoryCtx = document.getElementById('categoryChart');
        if (categoryCtx) {
            if (categoryChartInstance) {
                categoryChartInstance.destroy();
            }

            const catLabels = Object.keys(categorySales);
            const catData = Object.values(categorySales);
            
            // Generate random colors
            const backgroundColors = catLabels.map(() => 
                `hsl(${Math.floor(Math.random() * 360)}, 70%, 60%)`
            );

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
    }

    document.getElementById('settings-form').addEventListener('submit', (e) => {
        e.preventDefault();
        settings = {
            storeName: document.getElementById('storeName').value,
            storeAddress: document.getElementById('storeAddress').value,
            storePhone: document.getElementById('storePhone').value,
            defaultTax: parseFloat(document.getElementById('defaultTax').value) || 0
        };
        if (currentUser) {
            set(ref(db, `users/${currentUser.uid}/settings`), settings);
        }
        alert('Settings Saved!');
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

    // Initial render
    // renderInventory(); // Moved to auth state change
});