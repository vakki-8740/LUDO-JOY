if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('service-worker.js'));
}

let allUsers = [], allTrx = [], allBets = [], allGames = [], allReferrals = [];

function showToast(msg, bg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.style.background = bg || 'rgba(28,28,30,0.95)'; t.style.display = 'block';
    setTimeout(() => t.style.display = 'none', 3000);
}

function loading(btn, state) {
    if (state) { btn.disabled = true; btn.querySelector('.btn-text').style.display = 'none'; btn.querySelector('.spinner').style.display = 'inline-block'; }
    else { btn.disabled = false; btn.querySelector('.btn-text').style.display = 'inline'; btn.querySelector('.spinner').style.display = 'none'; }
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('mobile-open');
    document.querySelector('.sidebar-overlay').classList.toggle('mobile-open');
}

function switchTab(tab, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(tab).classList.add('active');
    if (el) el.classList.add('active');
    document.getElementById('sidebar').classList.remove('mobile-open');
    document.querySelector('.sidebar-overlay').classList.remove('mobile-open');
}

function closeModal(e, id) { if (e.target === e.currentTarget) document.getElementById(id).style.display = 'none'; }
function forceCloseModal(id) { document.getElementById(id).style.display = 'none'; }

function switchUdTab(tab, el) {
    document.querySelectorAll('.ud-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    const uid = document.getElementById('edit-u-id').value;
    if (tab === 'profile') showUserProfile(uid);
    else if (tab === 'wallet') showUserWallet(uid);
    else if (tab === 'referral') showUserReferral(uid);
}

// ==================== LOGIN ====================
async function handleLogin(btn) {
    loading(btn, true);
    const email = document.getElementById('admin-email').value.trim();
    const pass = document.getElementById('admin-pass').value.trim();
    if (email === 'vakki@admin.com' && pass === 'vakkiboss861402') {
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('admin-layout').style.display = 'flex';
        loadAllData();
    } else {
        try {
            await firebase.auth().signInWithEmailAndPassword(email, pass);
            document.getElementById('login-section').style.display = 'none';
            document.getElementById('admin-layout').style.display = 'flex';
            loadAllData();
        } catch (e) {
            showToast('Login failed: ' + e.message, 'var(--danger)');
        }
    }
    loading(btn, false);
}

function logout() {
    firebase.auth().signOut().catch(() => {});
    document.getElementById('login-section').style.display = 'flex';
    document.getElementById('admin-layout').style.display = 'none';
}

// ==================== LOAD DATA ====================
function loadAllData() {
    loadUsers();
    loadTransactions();
    loadBets();
    loadGames();
    loadReferrals();
    loadSettings();
    loadKYC();
}

// ==================== USERS ====================
function loadUsers() {
    db.collection('users').onSnapshot(snap => {
        allUsers = [];
        snap.forEach(doc => allUsers.push({ id: doc.id, ...doc.data() }));
        renderUsers();
        updateStats();
    });
}

function renderUsers() {
    const list = document.getElementById('user-list');
    if (!allUsers.length) { list.innerHTML = '<tr><td colspan="5" style="text-align:center;">No users found</td></tr>'; return; }
    list.innerHTML = allUsers.map(u => `
        <tr>
            <td><strong>${u.name || 'Unknown'}</strong></td>
            <td>${u.userId || u.id}</td>
            <td>₹${u.balance || 0}</td>
            <td><span style="color:${u.status === 'blocked' ? 'var(--danger)' : 'var(--success)'}">${u.status || 'Active'}</span></td>
            <td class="action-btns">
                <button class="btn" style="padding:6px 12px;font-size:12px;" onclick="viewUser('${u.id}')"><i class="fas fa-eye"></i></button>
                <button class="btn btn-warning" style="padding:6px 12px;font-size:12px;" onclick="openBalanceModal('${u.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn ${u.status === 'blocked' ? 'btn-success' : 'btn-danger'}" style="padding:6px 12px;font-size:12px;" onclick="toggleUserStatus('${u.id}')">${u.status === 'blocked' ? 'Unblock' : 'Block'}</button>
            </td>
        </tr>
    `).join('');
}

function filterUsers() {
    const q = document.getElementById('search-users').value.toLowerCase();
    const filtered = allUsers.filter(u => (u.name || '').toLowerCase().includes(q) || (u.userId || u.id).includes(q));
    const list = document.getElementById('user-list');
    if (!filtered.length) { list.innerHTML = '<tr><td colspan="5" style="text-align:center;">No matching users</td></tr>'; return; }
    list.innerHTML = filtered.map(u => `
        <tr>
            <td><strong>${u.name || 'Unknown'}</strong></td>
            <td>${u.userId || u.id}</td>
            <td>₹${u.balance || 0}</td>
            <td><span style="color:${u.status === 'blocked' ? 'var(--danger)' : 'var(--success)'}">${u.status || 'Active'}</span></td>
            <td class="action-btns">
                <button class="btn" style="padding:6px 12px;font-size:12px;" onclick="viewUser('${u.id}')"><i class="fas fa-eye"></i></button>
                <button class="btn btn-warning" style="padding:6px 12px;font-size:12px;" onclick="openBalanceModal('${u.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn ${u.status === 'blocked' ? 'btn-success' : 'btn-danger'}" style="padding:6px 12px;font-size:12px;" onclick="toggleUserStatus('${u.id}')">${u.status === 'blocked' ? 'Unblock' : 'Block'}</button>
            </td>
        </tr>
    `).join('');
}

async function toggleUserStatus(uid) {
    const user = allUsers.find(u => u.id === uid);
    if (!user) return;
    const newStatus = user.status === 'blocked' ? 'active' : 'blocked';
    await db.collection('users').doc(uid).update({ status: newStatus });
    showToast(`User ${newStatus === 'blocked' ? 'blocked' : 'unblocked'}`, newStatus === 'blocked' ? 'var(--danger)' : 'var(--success)');
}

function viewUser(uid) {
    document.getElementById('edit-u-id').value = uid;
    document.getElementById('user-detail-modal').style.display = 'flex';
    showUserProfile(uid);
}

function showUserProfile(uid) {
    const user = allUsers.find(u => u.id === uid);
    if (!user) return;
    document.getElementById('ud-avatar').textContent = (user.name || '?')[0].toUpperCase();
    document.getElementById('ud-user-name').textContent = user.name || 'Unknown';
    document.getElementById('ud-user-id').textContent = 'ID: ' + (user.userId || uid);
    document.getElementById('ud-status-badge').textContent = user.status === 'blocked' ? 'Blocked' : 'Active';
    document.getElementById('ud-status-badge').style.color = user.status === 'blocked' ? 'var(--danger)' : 'var(--success)';
    document.getElementById('ud-body').innerHTML = `
        <div style="margin-bottom:15px;"><strong>Email:</strong> ${user.email || 'N/A'}</div>
        <div style="margin-bottom:15px;"><strong>Joined:</strong> ${user.createdAt ? new Date(user.createdAt.toDate()).toLocaleDateString() : 'N/A'}</div>
        <div style="margin-bottom:15px;"><strong>Total Deposit:</strong> ₹${user.totalDeposit || 0}</div>
        <div style="margin-bottom:15px;"><strong>Total Withdraw:</strong> ₹${user.totalWithdraw || 0}</div>
        <div style="margin-bottom:15px;"><strong>Total Win:</strong> ₹${user.totalWin || 0}</div>
    `;
}

function showUserWallet(uid) {
    const user = allUsers.find(u => u.id === uid);
    if (!user) return;
    document.getElementById('ud-body').innerHTML = `
        <div style="margin-bottom:15px;"><strong>Current Balance:</strong> ₹${user.balance || 0}</div>
        <div style="margin-bottom:15px;"><strong>Deposit History:</strong></div>
        <div style="max-height:200px;overflow-y:auto;">
            ${(user.depositHistory || []).slice(-10).reverse().map(d => `<div style="padding:8px;border-bottom:1px solid #f2f2f7;font-size:13px;">₹${d.amount} - ${d.date || ''} <span style="color:${d.status === 'Success' ? 'var(--success)' : 'var(--warning)'}">${d.status || ''}</span></div>`).join('') || 'No deposits'}
        </div>
    `;
}

function showUserReferral(uid) {
    const user = allUsers.find(u => u.id === uid);
    if (!user) return;
    const refUsers = allUsers.filter(u => u.referredBy === user.userId || u.referredBy === uid);
    document.getElementById('ud-body').innerHTML = `
        <div style="margin-bottom:15px;"><strong>Referral Code:</strong> ${user.referralCode || user.userId || uid}</div>
        <div style="margin-bottom:15px;"><strong>Referred Users:</strong> ${refUsers.length}</div>
        <div style="margin-bottom:15px;"><strong>Total Commission:</strong> ₹${user.referralCommission || 0}</div>
        ${refUsers.length ? `<div style="max-height:200px;overflow-y:auto;">${refUsers.map(u => `<div style="padding:8px;border-bottom:1px solid #f2f2f7;font-size:13px;">${u.name || 'Unknown'} (${u.userId || u.id})</div>`).join('')}</div>` : ''}
    `;
}

function openBalanceModal(uid) {
    const user = allUsers.find(u => u.id === uid);
    if (!user) return;
    document.getElementById('edit-u-id').value = uid;
    document.getElementById('edit-u-name').textContent = user.name || 'Unknown';
    document.getElementById('edit-u-bal').value = user.balance || 0;
    document.getElementById('edit-balance-modal').style.display = 'flex';
}

async function saveBalance(btn) {
    loading(btn, true);
    const uid = document.getElementById('edit-u-id').value;
    const bal = parseFloat(document.getElementById('edit-u-bal').value);
    if (isNaN(bal) || bal < 0) { showToast('Invalid balance', 'var(--danger)'); loading(btn, false); return; }
    await db.collection('users').doc(uid).update({ balance: bal });
    showToast('Balance updated', 'var(--success)');
    document.getElementById('edit-balance-modal').style.display = 'none';
    loading(btn, false);
}

// ==================== TRANSACTIONS ====================
function loadTransactions() {
    db.collection('transactions').orderBy('timestamp', 'desc').onSnapshot(snap => {
        allTrx = [];
        snap.forEach(doc => allTrx.push({ id: doc.id, ...doc.data() }));
        renderTrx();
        updateStats();
    });
}

function renderTrx() {
    const list = document.getElementById('trx-list');
    if (!allTrx.length) { list.innerHTML = '<tr><td colspan="6" style="text-align:center;">No transactions</td></tr>'; return; }
    list.innerHTML = allTrx.map(t => `
        <tr>
            <td>${t.userName || t.userId || 'Unknown'}</td>
            <td>${t.type || 'N/A'}</td>
            <td>₹${t.amount || 0}</td>
            <td>${t.date || (t.timestamp ? new Date(t.timestamp.toDate()).toLocaleDateString() : 'N/A')}</td>
            <td><span style="color:${t.status === 'Success' ? 'var(--success)' : t.status === 'Pending' ? 'var(--warning)' : 'var(--danger)'}">${t.status || 'Pending'}</span></td>
            <td class="action-btns">
                ${t.status === 'Pending' ? `
                    <button class="btn btn-success" style="padding:6px 12px;font-size:12px;" onclick="approveTrx('${t.id}')">Approve</button>
                    <button class="btn btn-danger" style="padding:6px 12px;font-size:12px;" onclick="rejectTrx('${t.id}')">Reject</button>
                ` : '<span style="color:var(--text-muted);font-size:12px;">--</span>'}
            </td>
        </tr>
    `).join('');
}

function filterTrx() {
    const q = document.getElementById('search-trx').value.toLowerCase();
    const type = document.getElementById('filter-trx-type').value;
    const status = document.getElementById('filter-trx-status').value;
    const filtered = allTrx.filter(t => {
        if (q && !(t.userName || '').toLowerCase().includes(q) && !(t.userId || '').includes(q)) return false;
        if (type && t.type !== type) return false;
        if (status && t.status !== status) return false;
        return true;
    });
    const list = document.getElementById('trx-list');
    if (!filtered.length) { list.innerHTML = '<tr><td colspan="6" style="text-align:center;">No matching transactions</td></tr>'; return; }
    list.innerHTML = filtered.map(t => `
        <tr>
            <td>${t.userName || t.userId || 'Unknown'}</td>
            <td>${t.type || 'N/A'}</td>
            <td>₹${t.amount || 0}</td>
            <td>${t.date || (t.timestamp ? new Date(t.timestamp.toDate()).toLocaleDateString() : 'N/A')}</td>
            <td><span style="color:${t.status === 'Success' ? 'var(--success)' : t.status === 'Pending' ? 'var(--warning)' : 'var(--danger)'}">${t.status || 'Pending'}</span></td>
            <td class="action-btns">
                ${t.status === 'Pending' ? `
                    <button class="btn btn-success" style="padding:6px 12px;font-size:12px;" onclick="approveTrx('${t.id}')">Approve</button>
                    <button class="btn btn-danger" style="padding:6px 12px;font-size:12px;" onclick="rejectTrx('${t.id}')">Reject</button>
                ` : '<span style="color:var(--text-muted);font-size:12px;">--</span>'}
            </td>
        </tr>
    `).join('');
}

async function approveTrx(id) {
    await db.collection('transactions').doc(id).update({ status: 'Success' });
    const trx = allTrx.find(t => t.id === id);
    if (trx && trx.type === 'Withdraw') {
        const user = allUsers.find(u => u.id === trx.userId || u.userId === trx.userId);
        if (user) {
            const newBal = (user.balance || 0) - (trx.amount || 0);
            await db.collection('users').doc(user.id).update({ balance: Math.max(0, newBal), totalWithdraw: (user.totalWithdraw || 0) + (trx.amount || 0) });
        }
    }
    showToast('Transaction approved', 'var(--success)');
}

async function rejectTrx(id) {
    await db.collection('transactions').doc(id).update({ status: 'Rejected' });
    const trx = allTrx.find(t => t.id === id);
    if (trx && trx.type === 'Deposit') {
        const user = allUsers.find(u => u.id === trx.userId || u.userId === trx.userId);
        if (user) {
            await db.collection('users').doc(user.id).update({ balance: (user.balance || 0) - (trx.amount || 0) });
        }
    }
    showToast('Transaction rejected', 'var(--danger)');
}

// ==================== KYC ====================
function loadKYC() {
    db.collection('kyc_requests').orderBy('timestamp', 'desc').onSnapshot(snap => {
        const list = document.getElementById('kyc-list');
        const requests = [];
        snap.forEach(doc => requests.push({ id: doc.id, ...doc.data() }));
        if (!requests.length) { list.innerHTML = '<tr><td colspan="5" style="text-align:center;">No KYC requests</td></tr>'; return; }
        list.innerHTML = requests.map(r => `
            <tr>
                <td>${r.userName || r.userId || 'Unknown'}</td>
                <td>${r.aadharName || '--'}</td>
                <td>${r.aadharNumber || '--'}</td>
                <td><span style="color:${r.status === 'approved' ? 'var(--success)' : r.status === 'rejected' ? 'var(--danger)' : 'var(--warning)'}">${r.status || 'pending'}</span></td>
                <td class="action-btns">
                    ${r.status === 'pending' ? `
                        <button class="btn btn-success" style="padding:6px 12px;font-size:12px;" onclick="approveKYC('${r.id}','${r.userId}')">Approve</button>
                        <button class="btn btn-danger" style="padding:6px 12px;font-size:12px;" onclick="rejectKYC('${r.id}')">Reject</button>
                    ` : '<span style="color:var(--text-muted);font-size:12px;">--</span>'}
                </td>
            </tr>
        `).join('');
    });
}

async function approveKYC(reqId, userId) {
    await db.collection('kyc_requests').doc(reqId).update({ status: 'approved' });
    await db.collection('users').doc(userId).update({ kycStatus: 'approved' });
    showToast('KYC approved', 'var(--success)');
}

async function rejectKYC(reqId) {
    await db.collection('kyc_requests').doc(reqId).update({ status: 'rejected' });
    showToast('KYC rejected', 'var(--danger)');
}

// ==================== BETS ====================
function loadBets() {
    db.collection('bets').orderBy('timestamp', 'desc').onSnapshot(snap => {
        allBets = [];
        snap.forEach(doc => allBets.push({ id: doc.id, ...doc.data() }));
        renderBets();
        updateStats();
    });
}

function renderBets() {
    const list = document.getElementById('bets-list');
    if (!allBets.length) { list.innerHTML = '<tr><td colspan="5" style="text-align:center;">No bets</td></tr>'; return; }
    list.innerHTML = allBets.map(b => `
        <tr>
            <td>${b.creatorName || b.creatorId || 'Unknown'}</td>
            <td>${b.joinerName || b.joinerId || '--'}</td>
            <td>₹${b.amount || 0}</td>
            <td>${b.roomCode || '--'}</td>
            <td><span style="color:${b.status === 'completed' ? 'var(--success)' : b.status === 'playing' ? 'var(--primary)' : 'var(--warning)'}">${b.status || 'Waiting'}</span></td>
        </tr>
    `).join('');
}

// ==================== GAMES ====================
function loadGames() {
    db.collection('games').onSnapshot(snap => {
        allGames = [];
        snap.forEach(doc => allGames.push({ id: doc.id, ...doc.data() }));
        renderGames();
    });
}

function renderGames() {
    const list = document.getElementById('games-list');
    if (!allGames.length) { list.innerHTML = '<tr><td colspan="4" style="text-align:center;">No games added</td></tr>'; return; }
    list.innerHTML = allGames.map(g => `
        <tr>
            <td>${g.logo ? `<img src="${g.logo}" style="width:40px;height:40px;border-radius:8px;">` : '<i class="fas fa-gamepad" style="font-size:30px;color:var(--text-muted);"></i>'}</td>
            <td>${g.name || 'Unnamed'}</td>
            <td><span style="color:${g.status === 'active' ? 'var(--success)' : 'var(--danger)'}">${g.status || 'disabled'}</span></td>
            <td class="action-btns">
                <button class="btn btn-warning" style="padding:6px 12px;font-size:12px;" onclick="editGame('${g.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn btn-danger" style="padding:6px 12px;font-size:12px;" onclick="deleteGame('${g.id}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

async function saveGame(btn) {
    loading(btn, true);
    const name = document.getElementById('g-name').value.trim();
    const logo = document.getElementById('g-logo').value.trim();
    const status = document.getElementById('g-status').value;
    if (!name) { showToast('Game name required', 'var(--danger)'); loading(btn, false); return; }
    await db.collection('games').add({ name, logo, status, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    document.getElementById('g-name').value = '';
    document.getElementById('g-logo').value = '';
    showToast('Game saved', 'var(--success)');
    loading(btn, false);
}

async function editGame(id) {
    const game = allGames.find(g => g.id === id);
    if (!game) return;
    document.getElementById('g-name').value = game.name || '';
    document.getElementById('g-logo').value = game.logo || '';
    document.getElementById('g-status').value = game.status || 'active';
    await db.collection('games').doc(id).delete();
    showToast('Edit mode: Re-submit to save', 'var(--warning)');
}

async function deleteGame(id) {
    if (!confirm('Delete this game?')) return;
    await db.collection('games').doc(id).delete();
    showToast('Game deleted', 'var(--danger)');
}

// ==================== REFERRALS ====================
function loadReferrals() {
    db.collection('referrals').onSnapshot(snap => {
        allReferrals = [];
        snap.forEach(doc => allReferrals.push({ id: doc.id, ...doc.data() }));
        renderReferrals();
    });
}

function renderReferrals() {
    const list = document.getElementById('referral-list');
    if (!allReferrals.length) { list.innerHTML = '<tr><td colspan="3" style="text-align:center;">No referral data</td></tr>'; return; }
    list.innerHTML = allReferrals.map(r => `
        <tr>
            <td>${r.userName || r.userId || 'Unknown'}</td>
            <td>${r.referredCount || 0}</td>
            <td>₹${r.totalCommission || 0}</td>
        </tr>
    `).join('');
}

async function saveReferralSettings(btn) {
    loading(btn, true);
    const commission = parseFloat(document.getElementById('r-commission').value);
    if (isNaN(commission) || commission < 0) { showToast('Invalid commission', 'var(--danger)'); loading(btn, false); return; }
    await db.collection('settings').doc('referral').set({ commission }, { merge: true });
    showToast('Referral commission updated', 'var(--success)');
    loading(btn, false);
}

// ==================== MAIL ====================
async function sendMail(btn) {
    loading(btn, true);
    const subject = document.getElementById('m-subject').value.trim();
    const body = document.getElementById('m-body').value.trim();
    const type = document.getElementById('m-recipients').value;
    const userId = document.getElementById('m-user-id').value.trim();
    if (!subject || !body) { showToast('Subject and body required', 'var(--danger)'); loading(btn, false); return; }
    if (type === 'single' && !userId) { showToast('User ID required', 'var(--danger)'); loading(btn, false); return; }
    const recipients = type === 'all' ? allUsers.map(u => ({ userId: u.userId || u.id, name: u.name || 'User' })) : [{ userId, name: 'User' }];
    for (const r of recipients) {
        await db.collection('users').doc(r.userId).collection('mails').add({ subject, body, from: 'Admin', timestamp: firebase.firestore.FieldValue.serverTimestamp(), read: false });
    }
    showToast(`Mail sent to ${recipients.length} user(s)`, 'var(--success)');
    document.getElementById('m-subject').value = '';
    document.getElementById('m-body').value = '';
    loading(btn, false);
}

document.getElementById('m-recipients').addEventListener('change', function() {
    document.getElementById('m-user-id').style.display = this.value === 'single' ? 'block' : 'none';
});

async function saveWelcomeMsg(btn) {
    loading(btn, true);
    const msg = document.getElementById('m-welcome').value.trim();
    if (!msg) { showToast('Welcome message required', 'var(--danger)'); loading(btn, false); return; }
    await db.collection('settings').doc('welcome').set({ message: msg }, { merge: true });
    showToast('Welcome message saved', 'var(--success)');
    loading(btn, false);
}

// ==================== SUPPORT ====================
async function saveSupport(btn) {
    loading(btn, true);
    const data = {
        whatsapp: document.getElementById('s-whatsapp').value.trim(),
        telegram: document.getElementById('s-telegram').value.trim(),
        chat: document.getElementById('s-chat').value.trim(),
        logo: document.getElementById('s-support-logo').value.trim()
    };
    await db.collection('settings').doc('support').set(data, { merge: true });
    showToast('Support settings saved', 'var(--success)');
    loading(btn, false);
}

// ==================== SETTINGS ====================
function loadSettings() {
    db.collection('settings').doc('app').get().then(doc => {
        if (doc.exists) {
            const d = doc.data();
            document.getElementById('s-deposit-opts').value = d.depositOptions || '100,200,300,400,500,1000,2000,5000';
            document.getElementById('s-min-deposit').value = d.minDeposit || 100;
            document.getElementById('s-min-withdraw').value = d.minWithdraw || 100;
            document.getElementById('s-privacy').value = d.privacy || '';
            document.getElementById('s-terms').value = d.terms || '';
            document.getElementById('s-about').value = d.about || '';
            document.getElementById('s-rules').value = d.rules || '';
        }
    }).catch(() => {});
}

async function saveAppSettings(btn) {
    loading(btn, true);
    const data = {
        depositOptions: document.getElementById('s-deposit-opts').value,
        minDeposit: parseFloat(document.getElementById('s-min-deposit').value) || 100,
        minWithdraw: parseFloat(document.getElementById('s-min-withdraw').value) || 100,
        privacy: document.getElementById('s-privacy').value.trim(),
        terms: document.getElementById('s-terms').value.trim(),
        about: document.getElementById('s-about').value.trim(),
        rules: document.getElementById('s-rules').value.trim()
    };
    await db.collection('settings').doc('app').set(data, { merge: true });
    showToast('Settings saved', 'var(--success)');
    loading(btn, false);
}

// ==================== STATS ====================
function updateStats() {
    document.getElementById('stat-users').textContent = allUsers.length || 0;
    const totalDep = allTrx.filter(t => t.type === 'Deposit' && t.status === 'Success').reduce((s, t) => s + (t.amount || 0), 0);
    const totalWit = allTrx.filter(t => t.type === 'Withdraw' && t.status === 'Success').reduce((s, t) => s + (t.amount || 0), 0);
    document.getElementById('stat-deposit').textContent = '₹' + totalDep;
    document.getElementById('stat-withdraw').textContent = '₹' + totalWit;
    document.getElementById('stat-bets').textContent = allBets.filter(b => b.status === 'waiting' || b.status === 'playing').length;

    db.collection('kyc_requests').where('status', '==', 'pending').get().then(snap => {
        document.getElementById('stat-pending-kyc').textContent = snap.size || 0;
    }).catch(() => {});

    const recent = allBets.slice(0, 10);
    const rList = document.getElementById('recent-bets-list');
    if (!recent.length) { rList.innerHTML = '<tr><td colspan="4" style="text-align:center;">No recent bets</td></tr>'; return; }
    rList.innerHTML = recent.map(b => `
        <tr>
            <td>${b.creatorName || '?'} ${b.joinerName ? 'vs ' + b.joinerName : '(waiting)'}</td>
            <td>₹${b.amount || 0}</td>
            <td><span style="color:${b.status === 'completed' ? 'var(--success)' : b.status === 'playing' ? 'var(--primary)' : 'var(--warning)'}">${b.status || 'Waiting'}</span></td>
            <td>${b.timestamp ? new Date(b.timestamp.toDate()).toLocaleString() : 'N/A'}</td>
        </tr>
    `).join('');
}
