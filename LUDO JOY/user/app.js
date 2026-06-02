let currentUser = null;
let allBets = [];
let allUsers = [];
let selectedDeposit = 0;
let chatPartner = null;
let chatUnsub = null;
let userPresenceUnsub = null;

// ==================== HELPERS ====================
function showToast(msg, bg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.style.background = bg || 'rgba(28,28,30,0.95)';
    t.style.display = 'block';
    setTimeout(() => t.style.display = 'none', 3000);
}

function showLoading() { document.getElementById('loading-overlay').style.display = 'flex'; }
function hideLoading() { document.getElementById('loading-overlay').style.display = 'none'; }

function generateUserId() {
    return Math.floor(10000 + Math.random() * 90000).toString();
}

function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ==================== AUTH ====================
function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    showLoading();
    firebase.auth().signInWithPopup(provider).then(result => {
        const user = result.user;
        checkUserExists(user);
    }).catch(err => {
        hideLoading();
        showToast('Login failed: ' + err.message, '#ff3b30');
    });
}

function checkUserExists(user) {
    db.collection('users').where('email', '==', user.email).get().then(snap => {
        if (snap.empty) {
            const newUser = {
                name: user.displayName || 'User',
                email: user.email,
                photoURL: user.photoURL || '',
                userId: generateUserId(),
                balance: 0,
                totalDeposit: 0,
                totalWithdraw: 0,
                totalWin: 0,
                status: 'active',
                referralCode: generateUserId(),
                referredBy: '',
                referralCommission: 0,
                kycStatus: 'pending',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            db.collection('users').doc(user.uid).set(newUser).then(() => {
                currentUser = { id: user.uid, ...newUser };
                afterLogin();
            });
            sendWelcomeMail(user.uid, newUser.name);
        } else {
            const data = snap.docs[0].data();
            currentUser = { id: snap.docs[0].id, ...data };
            afterLogin();
        }
    });
}

function sendWelcomeMail(uid, name) {
    db.collection('settings').doc('welcome').get().then(doc => {
        if (doc.exists) {
            db.collection('users').doc(uid).collection('mails').add({
                subject: 'Welcome to Ludo Joy! 🎉',
                body: doc.data().message || `Welcome ${name}! Start playing and winning real money. Good luck! 🎲`,
                from: 'Admin',
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                read: false
            });
        }
    }).catch(() => {});
}

function afterLogin() {
    hideLoading();
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('home-page').style.display = 'flex';
    updateUI();
    loadRealtimeData();
}

function logoutUser() {
    currentUser = null;
    document.getElementById('login-page').style.display = 'flex';
    document.getElementById('home-page').style.display = 'none';
    firebase.auth().signOut().catch(() => {});
}

// ==================== REAL-TIME DATA ====================
function loadRealtimeData() {
    db.collection('users').onSnapshot(snap => {
        allUsers = [];
        snap.forEach(doc => allUsers.push({ id: doc.id, ...doc.data() }));
        const updated = allUsers.find(u => u.id === currentUser.id);
        if (updated) { currentUser = updated; updateUI(); }
        renderUserList();
    });

    db.collection('bets').orderBy('timestamp', 'desc').onSnapshot(snap => {
        allBets = [];
        snap.forEach(doc => allBets.push({ id: doc.id, ...doc.data() }));
        renderBets();
    });
}

// ==================== UI UPDATES ====================
function updateUI() {
    if (!currentUser) return;
    document.getElementById('header-balance').textContent = currentUser.balance || 0;
    document.getElementById('wallet-balance').textContent = currentUser.balance || 0;
    document.getElementById('profile-name').textContent = currentUser.name || 'User';
    document.getElementById('profile-id').textContent = 'ID: ' + (currentUser.userId || currentUser.id);
    document.getElementById('profile-avatar').textContent = (currentUser.name || '?')[0].toUpperCase();
    document.getElementById('ref-code').textContent = currentUser.referralCode || currentUser.userId;
    document.getElementById('p-total-deposit').textContent = '₹' + (currentUser.totalDeposit || 0);
    document.getElementById('p-total-withdraw').textContent = '₹' + (currentUser.totalWithdraw || 0);
    document.getElementById('p-total-win').textContent = '₹' + (currentUser.totalWin || 0);
    document.getElementById('w-total-deposit').textContent = currentUser.totalDeposit || 0;
    document.getElementById('w-total-withdraw').textContent = currentUser.totalWithdraw || 0;
    document.getElementById('w-total-win').textContent = currentUser.totalWin || 0;
    if (currentUser.photoURL) {
        document.getElementById('profile-avatar').innerHTML = `<img src="${currentUser.photoURL}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;">`;
    }
    loadDepositOptions();
    checkKYCStatus();
}

// ==================== NAVIGATION ====================
function navigateTo(sectionId) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
    document.querySelectorAll('.bn-item').forEach(b => b.classList.remove('active'));
    const navMap = { 'home-section': 0, 'lobby-section': 1, 'chat-section': 2, 'wallet-section': 3, 'profile-section': 4 };
    if (navMap[sectionId] !== undefined) document.querySelectorAll('.bn-item')[navMap[sectionId]].classList.add('active');
    document.getElementById('main-content').scrollTop = 0;
    if (sectionId === 'wallet-section') { showDepositDefault(); }
}

function toggleMenu() {
    document.getElementById('side-menu').classList.toggle('open');
    document.getElementById('menu-overlay').style.display = document.getElementById('side-menu').classList.contains('open') ? 'block' : 'none';
}

function openPage(type) {
    const titles = { privacy: 'Privacy Policy', terms: 'Terms & Conditions', about: 'About Us', gst: 'GST', rules: 'Game Rules' };
    document.getElementById('pages-title').textContent = titles[type] || 'Page';
    db.collection('settings').doc('app').get().then(doc => {
        let content = '';
        if (doc.exists) {
            const d = doc.data();
            content = d[type] || 'Content not available.';
        } else {
            content = 'Content not available.';
        }
        document.getElementById('pages-content').innerHTML = content.replace(/\n/g, '<br>');
    }).catch(() => {
        document.getElementById('pages-content').innerHTML = 'Content not available.';
    });
    navigateTo('pages-section');
}

// ==================== BETS ====================
function renderBets() {
    const container = document.getElementById('bets-container');
    if (!allBets.length) {
        container.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--text-muted);font-size:14px;">No bets available. Create one!</div>';
        return;
    }
    container.innerHTML = allBets.map(b => {
        const isCreator = b.creatorId === currentUser.id || b.creatorId === currentUser.userId;
        const isJoiner = b.joinerId === currentUser.id || b.joinerId === currentUser.userId;
        const canPlay = b.status === 'waiting' && !isCreator;
        return `
            <div class="bet-card">
                <div class="bet-players">
                    <span class="bet-player">${b.creatorName || 'Player'}</span>
                    <span class="bet-vs">${b.joinerName ? 'VS' : 'vs ?'}</span>
                    <span class="bet-player">${b.joinerName || 'Waiting...'}</span>
                </div>
                <div class="bet-info">
                    <span class="bet-amount">₹${b.amount || 0}</span>
                    ${b.roomCode && (isCreator || isJoiner) ? `<span style="font-size:12px;color:var(--primary);">Room: ${b.roomCode} <i class="fas fa-copy" style="cursor:pointer;" onclick="copyText('${b.roomCode}')"></i></span>` : ''}
                    <span class="bet-status ${b.status || 'waiting'}">${b.status || 'waiting'}</span>
                </div>
                ${canPlay ? `<button class="btn" style="width:100%;margin-top:10px;padding:10px;border:none;border-radius:10px;background:var(--primary);color:white;font-weight:600;cursor:pointer;" onclick="joinBet('${b.id}','${b.amount}')">Play ₹${b.amount}</button>` : ''}
                ${b.status === 'waiting' && isCreator ? '<span style="display:block;text-align:center;font-size:12px;color:var(--text-muted);margin-top:8px;">Waiting for opponent...</span>' : ''}
            </div>
        `;
    }).join('');
}

function filterBets() {
    const q = document.getElementById('search-bets').value.toLowerCase();
    const filtered = allBets.filter(b => (b.creatorName || '').toLowerCase().includes(q) || (b.joinerName || '').toLowerCase().includes(q));
    const container = document.getElementById('bets-container');
    if (!filtered.length) { container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">No matching bets</div>'; return; }
    container.innerHTML = filtered.map(b => {
        const isCreator = b.creatorId === currentUser.id || b.creatorId === currentUser.userId;
        const isJoiner = b.joinerId === currentUser.id || b.joinerId === currentUser.userId;
        const canPlay = b.status === 'waiting' && !isCreator;
        return `
            <div class="bet-card">
                <div class="bet-players">
                    <span class="bet-player">${b.creatorName || 'Player'}</span>
                    <span class="bet-vs">${b.joinerName ? 'VS' : 'vs ?'}</span>
                    <span class="bet-player">${b.joinerName || 'Waiting...'}</span>
                </div>
                <div class="bet-info">
                    <span class="bet-amount">₹${b.amount || 0}</span>
                    ${b.roomCode && (isCreator || isJoiner) ? `<span style="font-size:12px;color:var(--primary);">Room: ${b.roomCode} <i class="fas fa-copy" style="cursor:pointer;" onclick="copyText('${b.roomCode}')"></i></span>` : ''}
                    <span class="bet-status ${b.status || 'waiting'}">${b.status || 'waiting'}</span>
                </div>
                ${canPlay ? `<button class="btn" style="width:100%;margin-top:10px;padding:10px;border:none;border-radius:10px;background:var(--primary);color:white;font-weight:600;cursor:pointer;" onclick="joinBet('${b.id}','${b.amount}')">Play ₹${b.amount}</button>` : ''}
                ${b.status === 'waiting' && isCreator ? '<span style="display:block;text-align:center;font-size:12px;color:var(--text-muted);margin-top:8px;">Waiting for opponent...</span>' : ''}
            </div>
        `;
    }).join('');
}

function showCreateBet() {
    if (!currentUser) return;
    if ((currentUser.balance || 0) <= 0) { showToast('Add money to wallet first!', '#ff9500'); return; }
    document.getElementById('bet-amount').value = '';
    document.getElementById('bet-room').value = '';
    document.getElementById('create-bet-overlay').style.display = 'flex';
}

function closePopup(e, id) {
    if (e.target === e.currentTarget) document.getElementById(id).style.display = 'none';
}

async function submitBet() {
    const amount = parseFloat(document.getElementById('bet-amount').value);
    const roomCode = document.getElementById('bet-room').value.trim().toUpperCase();
    if (!amount || amount <= 0) { showToast('Enter valid amount', '#ff3b30'); return; }
    if (!roomCode) { showToast('Enter room code', '#ff3b30'); return; }
    if ((currentUser.balance || 0) < amount) { showToast('Insufficient balance!', '#ff3b30'); return; }

    showLoading();
    try {
        await db.collection('users').doc(currentUser.id).update({
            balance: (currentUser.balance || 0) - amount
        });
        await db.collection('bets').add({
            creatorId: currentUser.id,
            creatorName: currentUser.name || 'Unknown',
            creatorUserId: currentUser.userId,
            amount: amount,
            roomCode: roomCode,
            status: 'waiting',
            joinerId: '',
            joinerName: '',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        hideLoading();
        showToast('Bet created! Waiting for opponent...', '#34c759');
        document.getElementById('create-bet-overlay').style.display = 'none';
        navigateTo('lobby-section');
    } catch (e) {
        hideLoading();
        showToast('Error: ' + e.message, '#ff3b30');
    }
}

async function joinBet(betId, amount) {
    amount = parseFloat(amount);
    if ((currentUser.balance || 0) < amount) { showToast('Insufficient balance!', '#ff3b30'); return; }

    const bet = allBets.find(b => b.id === betId);
    if (!bet || bet.status !== 'waiting') { showToast('Bet already taken', '#ff3b30'); return; }

    showLoading();
    try {
        await db.collection('users').doc(currentUser.id).update({
            balance: (currentUser.balance || 0) - amount
        });
        const roomCode = bet.roomCode;
        await db.collection('bets').doc(betId).update({
            status: 'playing',
            joinerId: currentUser.id,
            joinerName: currentUser.name || 'Unknown'
        });
        hideLoading();
        showToast(`Room Code: ${roomCode} (copied!)`, '#007aff');
        copyText(roomCode);
    } catch (e) {
        hideLoading();
        showToast('Error: ' + e.message, '#ff3b30');
    }
}

function copyText(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).catch(() => {});
    }
}

// ==================== WALLET ====================
function switchWalletTab(tab) {
    document.getElementById('deposit-section').style.display = tab === 'deposit' ? 'block' : 'none';
    document.getElementById('withdraw-section').style.display = tab === 'withdraw' ? 'block' : 'none';
    document.getElementById('history-section').style.display = tab === 'history' ? 'block' : 'none';
    if (tab === 'history') loadHistory();
}

function showDepositDefault() {
    document.getElementById('deposit-section').style.display = 'block';
    document.getElementById('withdraw-section').style.display = 'none';
    document.getElementById('history-section').style.display = 'none';
}

function loadDepositOptions() {
    const container = document.getElementById('deposit-opts');
    const options = [100, 200, 300, 400, 500, 1000, 2000, 5000];
    container.innerHTML = options.map(o => `
        <div class="do-item" onclick="selectDeposit(${o}, this)">₹${o}</div>
    `).join('');
}

function selectDeposit(amount, el) {
    document.querySelectorAll('.do-item').forEach(d => d.classList.remove('selected'));
    el.classList.add('selected');
    selectedDeposit = amount;
    document.getElementById('custom-deposit').value = amount;
}

function depositMoney() {
    let amount = parseFloat(document.getElementById('custom-deposit').value) || selectedDeposit;
    if (amount < 100) { showToast('Minimum deposit ₹100', '#ff3b30'); return; }
    showToast('Razorpay integration - Deposit ₹' + amount, '#007aff');
    // Razorpay redirect would go here
    // For now simulate deposit
    simulateDeposit(amount);
}

function simulateDeposit(amount) {
    showLoading();
    setTimeout(async () => {
        const newBal = (currentUser.balance || 0) + amount;
        await db.collection('users').doc(currentUser.id).update({
            balance: newBal,
            totalDeposit: (currentUser.totalDeposit || 0) + amount
        });
        await db.collection('transactions').add({
            userId: currentUser.id,
            userName: currentUser.name || 'User',
            type: 'Deposit',
            amount: amount,
            status: 'Success',
            date: new Date().toLocaleDateString(),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        hideLoading();
        showToast('₹' + amount + ' deposited successfully!', '#34c759');
    }, 1000);
}

function submitKYF() {
    const name = document.getElementById('kyf-name').value.trim();
    const aadhar = document.getElementById('kyf-aadhar').value.trim();
    const front = document.getElementById('kyf-front').value.trim();
    const back = document.getElementById('kyf-back').value.trim();
    if (!name || !aadhar || !front || !back) { showToast('All KYC fields required', '#ff3b30'); return; }
    db.collection('kyc_requests').add({
        userId: currentUser.id,
        userName: currentUser.name,
        aadharName: name,
        aadharNumber: aadhar,
        frontImage: front,
        backImage: back,
        status: 'pending',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        showToast('KYC submitted! Wait for admin approval.', '#ff9500');
    }).catch(() => showToast('Error submitting KYC', '#ff3b30'));
}

function checkKYCStatus() {
    if (!currentUser) return;
    db.collection('kyc_requests').where('userId', '==', currentUser.id).orderBy('timestamp', 'desc').limit(1).get().then(snap => {
        if (!snap.empty) {
            const data = snap.docs[0].data();
            if (data.status === 'approved') {
                document.getElementById('kyf-section').style.display = 'none';
                document.getElementById('withdraw-form').style.display = 'block';
            } else if (data.status === 'pending') {
                document.getElementById('kyf-section').innerHTML = '<div style="text-align:center;padding:20px;color:var(--warning);font-weight:600;">KYC Pending Approval</div>';
            }
        }
    }).catch(() => {});
}

function toggleWithdrawFields() {
    const method = document.getElementById('withdraw-method').value;
    document.getElementById('bank-fields').style.display = method === 'bank' ? 'block' : 'none';
    document.getElementById('upi-fields').style.display = method === 'upi' ? 'block' : 'none';
}

function withdrawMoney() {
    const amount = parseFloat(document.getElementById('withdraw-amount').value);
    if (!amount || amount < 100) { showToast('Minimum withdraw ₹100', '#ff3b30'); return; }
    if ((currentUser.balance || 0) < amount) { showToast('Insufficient balance', '#ff3b30'); return; }

    const method = document.getElementById('withdraw-method').value;
    let details = {};
    if (method === 'bank') {
        const holder = document.getElementById('w-holder').value.trim();
        const ifsc = document.getElementById('w-ifsc').value.trim();
        const acc = document.getElementById('w-account').value.trim();
        const confirm = document.getElementById('w-confirm-account').value.trim();
        if (!holder || !ifsc || !acc || !confirm) { showToast('All bank fields required', '#ff3b30'); return; }
        if (acc !== confirm) { showToast('Account numbers do not match', '#ff3b30'); return; }
        details = { method: 'bank', accountHolder: holder, ifsc, accountNumber: acc };
    } else {
        const upi = document.getElementById('w-upi').value.trim();
        if (!upi) { showToast('UPI ID required', '#ff3b30'); return; }
        details = { method: 'upi', upiId: upi };
    }

    showLoading();
    setTimeout(async () => {
        await db.collection('transactions').add({
            userId: currentUser.id,
            userName: currentUser.name || 'User',
            type: 'Withdraw',
            amount: amount,
            status: 'Pending',
            details: details,
            date: new Date().toLocaleDateString(),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        hideLoading();
        showToast('Withdrawal request submitted!', '#ff9500');
    }, 1000);
}

// ==================== HISTORY ====================
function loadHistory() {
    db.collection('transactions').where('userId', '==', currentUser.id).orderBy('timestamp', 'desc').limit(50).get().then(snap => {
        const items = [];
        snap.forEach(doc => items.push(doc.data()));
        renderHistory(items, 'all');
    }).catch(() => {});
}

function filterHistory(type, el) {
    document.querySelectorAll('.hf').forEach(h => h.classList.remove('active'));
    el.classList.add('active');
    db.collection('transactions').where('userId', '==', currentUser.id).orderBy('timestamp', 'desc').limit(50).get().then(snap => {
        const items = [];
        snap.forEach(doc => items.push(doc.data()));
        renderHistory(items, type);
    }).catch(() => {});
}

function renderHistory(items, filter) {
    const container = document.getElementById('history-list');
    const filtered = filter === 'all' ? items : items.filter(i => i.type === filter);
    if (!filtered.length) {
        container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted);font-size:14px;">No history found</div>';
        return;
    }
    container.innerHTML = filtered.map(item => {
        const isDeposit = item.type === 'Deposit';
        return `
            <div class="history-item">
                <div class="hi-left">
                    <div class="hi-icon" style="background:${isDeposit ? 'rgba(52,199,89,0.15)' : 'rgba(255,59,48,0.15)'};color:${isDeposit ? 'var(--success)' : 'var(--danger)'}">
                        <i class="fas ${isDeposit ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
                    </div>
                    <div>
                        <div class="hi-detail">${item.type}</div>
                        <div class="hi-date">${item.date || ''}</div>
                    </div>
                </div>
                <div>
                    <div class="hi-amount" style="color:${isDeposit ? 'var(--success)' : 'var(--danger)'}">${isDeposit ? '+' : '-'}₹${item.amount || 0}</div>
                    <div style="font-size:11px;color:${item.status === 'Success' ? 'var(--success)' : item.status === 'Pending' ? 'var(--warning)' : 'var(--danger)'};text-align:right;">${item.status || ''}</div>
                </div>
            </div>
        `;
    }).join('');
}

// ==================== REFERRAL ====================
function copyReferral() {
    const code = currentUser.referralCode || currentUser.userId;
    copyText(code);
    showToast('Referral code copied!', '#34c759');
}

function shareWhatsApp() {
    const code = currentUser.referralCode || currentUser.userId;
    const msg = encodeURIComponent(`Join Ludo Joy and win real money! Use my referral code: ${code}`);
    window.open(`https://wa.me/?text=${msg}`, '_blank');
}

function shareTelegram() {
    const code = currentUser.referralCode || currentUser.userId;
    const msg = encodeURIComponent(`Join Ludo Joy and win real money! Use my referral code: ${code}`);
    window.open(`https://t.me/share/url?url=&text=${msg}`, '_blank');
}

// ==================== USER LIST ====================
function renderUserList() {
    const container = document.getElementById('users-list');
    if (!allUsers.length) { container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted);">No users</div>'; return; }
    container.innerHTML = allUsers.map(u => {
        if (u.id === currentUser.id) return '';
        return `
            <div class="user-list-item" data-userid="${u.id}">
                <div class="uli-avatar" style="background:linear-gradient(135deg,#007aff,#5856d6);">${(u.name || '?')[0].toUpperCase()}</div>
                <div class="uli-info">
                    <div class="uli-name">${u.name || 'Unknown'}</div>
                    <div class="uli-id">ID: ${u.userId || u.id}</div>
                </div>
                <div class="uli-status ${u.status === 'active' ? 'online' : 'offline'}"></div>
            </div>
        `;
    }).join('');
    setupChatOnUsers();
}

function filterUserList() {
    const q = document.getElementById('search-users').value.toLowerCase();
    const filtered = allUsers.filter(u => (u.name || '').toLowerCase().includes(q) || (u.userId || u.id).includes(q));
    const container = document.getElementById('users-list');
    container.innerHTML = filtered.map(u => {
        if (u.id === currentUser.id) return '';
        return `
            <div class="user-list-item" data-userid="${u.id}">
                <div class="uli-avatar" style="background:linear-gradient(135deg,#007aff,#5856d6);">${(u.name || '?')[0].toUpperCase()}</div>
                <div class="uli-info">
                    <div class="uli-name">${u.name || 'Unknown'}</div>
                    <div class="uli-id">ID: ${u.userId || u.id}</div>
                </div>
                <div class="uli-status ${u.status === 'active' ? 'online' : 'offline'}"></div>
            </div>
        `;
    }).join('');
    setupChatOnUsers();
}

// ==================== GLOBAL CHAT ====================
let chatPartnerId = null;
let chatUnsubscriber = null;

function openChat(partnerId, partnerName, partnerAvatar) {
    chatPartnerId = partnerId;
    document.getElementById('user-list-view').style.display = 'none';
    document.getElementById('chat-view').style.display = 'flex';
    document.getElementById('chat-title').textContent = partnerName;
    document.getElementById('ch-name').textContent = partnerName;
    document.getElementById('ch-avatar').textContent = (partnerName || '?')[0].toUpperCase();
    
    const partner = allUsers.find(u => u.id === partnerId);
    document.getElementById('ch-status').textContent = partner && partner.status === 'active' ? 'online' : 'offline';
    document.getElementById('ch-status').style.color = partner && partner.status === 'active' ? 'var(--success)' : 'var(--text-muted)';

    if (chatUnsubscriber) chatUnsubscriber();
    const chatId = currentUser.id < partnerId ? currentUser.id + '_' + partnerId : partnerId + '_' + currentUser.id;
    chatUnsubscriber = db.collection('chats').doc(chatId).collection('messages').orderBy('timestamp').onSnapshot(snap => {
        const container = document.getElementById('chat-messages');
        const msgs = [];
        snap.forEach(doc => msgs.push({ id: doc.id, ...doc.data() }));
        if (!msgs.length) {
            container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted);font-size:13px;">Start a conversation</div>';
            return;
        }
        container.innerHTML = msgs.map(m => {
            const sent = m.senderId === currentUser.id;
            const time = m.timestamp ? new Date(m.timestamp.toDate()).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) : '';
            return `<div class="msg ${sent ? 'sent' : 'received'}">${m.text}<div class="msg-time">${time}</div></div>`;
        }).join('');
        container.scrollTop = container.scrollHeight;
    });
}

function closeChat() {
    if (chatUnsubscriber) chatUnsubscriber();
    chatPartnerId = null;
    document.getElementById('user-list-view').style.display = 'block';
    document.getElementById('chat-view').style.display = 'none';
    document.getElementById('chat-title').textContent = 'Users';
}

function sendChatMsg() {
    const input = document.getElementById('chat-msg-input');
    const text = input.value.trim();
    if (!text || !chatPartnerId) return;
    const chatId = currentUser.id < chatPartnerId ? currentUser.id + '_' + chatPartnerId : chatPartnerId + '_' + currentUser.id;
    db.collection('chats').doc(chatId).collection('messages').add({
        senderId: currentUser.id,
        senderName: currentUser.name,
        text: text,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    input.value = '';
}

// Override renderUserList and filterUserList for chat click support
function setupChatOnUsers() {
    const container = document.getElementById('users-list');
    const items = container.querySelectorAll('.user-list-item');
    items.forEach(item => {
        const uid = item.dataset.userid;
        if (uid) {
            item.onclick = function() {
                const u = allUsers.find(x => x.id === uid);
                if (u) openChat(uid, u.name || 'User');
            };
        }
    });
}

// Watch for user list changes to attach chat click handlers
const userListObserver = new MutationObserver(() => setupChatOnUsers());
const usersListEl = document.getElementById('users-list');
if (usersListEl) userListObserver.observe(usersListEl, { childList: true, subtree: true });

// ==================== PROFILE ====================
function editProfileName() {
    const newName = prompt('Enter new name:', currentUser.name || '');
    if (newName && newName.trim()) {
        db.collection('users').doc(currentUser.id).update({ name: newName.trim() });
        showToast('Name updated!', '#34c759');
    }
}

// ==================== MAIL ====================
function loadMails() {
    db.collection('users').doc(currentUser.id).collection('mails').orderBy('timestamp', 'desc').onSnapshot(snap => {
        const container = document.getElementById('mails-container');
        const mails = [];
        snap.forEach(doc => mails.push({ id: doc.id, ...doc.data() }));
        if (!mails.length) {
            container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted);font-size:14px;">No mails yet</div>';
            return;
        }
        container.innerHTML = mails.map(m => `
            <div class="mail-item" onclick="markMailRead('${m.id}')">
                <div class="mail-subject">${m.subject || 'No Subject'}</div>
                <div class="mail-body">${m.body || ''}</div>
                <div class="mail-date">${m.timestamp ? new Date(m.timestamp.toDate()).toLocaleString() : ''}</div>
            </div>
        `).join('');
    });
}

function markMailRead(mailId) {
    db.collection('users').doc(currentUser.id).collection('mails').doc(mailId).update({ read: true }).catch(() => {});
}

// ==================== SUPPORT ====================
function loadSupport() {
    db.collection('settings').doc('support').get().then(doc => {
        const container = document.getElementById('support-content');
        if (doc.exists) {
            const d = doc.data();
            container.innerHTML = `
                ${d.logo ? `<img src="${d.logo}" style="width:80px;height:80px;border-radius:50%;margin-bottom:15px;object-fit:cover;">` : '<i class="fas fa-headset" style="font-size:60px;color:var(--primary);margin-bottom:15px;"></i>'}
                <h3 style="margin-bottom:20px;">Contact Support Team</h3>
                ${d.whatsapp ? `<a href="${d.whatsapp}" target="_blank" class="btn" style="background:#25D366;"><i class="fab fa-whatsapp"></i> WhatsApp</a>` : ''}
                ${d.telegram ? `<a href="${d.telegram}" target="_blank" class="btn" style="background:#0088cc;"><i class="fab fa-telegram"></i> Telegram</a>` : ''}
                ${d.chat ? `<a href="${d.chat}" target="_blank" class="btn" style="background:var(--primary);"><i class="fas fa-comment"></i> Live Chat</a>` : ''}
            `;
        } else {
            container.innerHTML = '<p style="color:var(--text-muted);">Support information not available.</p>';
        }
    }).catch(() => {
        document.getElementById('support-content').innerHTML = '<p style="color:var(--text-muted);">Support information not available.</p>';
    });
}

// ==================== INIT ====================
firebase.auth().onAuthStateChanged(user => {
    if (user) {
        checkUserExists(user);
    }
});

// Load support when section is shown
const supportObserver = new MutationObserver(() => {
    const supportSection = document.getElementById('support-section');
    if (supportSection.classList.contains('active')) {
        loadSupport();
    }
    const mailSection = document.getElementById('mail-section');
    if (mailSection.classList.contains('active')) {
        loadMails();
    }
});
document.querySelectorAll('.section').forEach(s => {
    supportObserver.observe(s, { attributes: true, attributeFilter: ['class'] });
});
