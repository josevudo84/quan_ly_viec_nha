const SUPABASE_URL = 'https://akgrmxazfgwbnpqupmor.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_L6pJkJPwbOoEDDbNXhL_PQ_oq2nm-rC';
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

let currentUser = null; 
let currentAdminType = 'approvals'; 
let currentReportTimeframe = 'this_week'; 
let currentReportTab = 'tasks';

const ICONS = ['fa-solid fa-clipboard-list', 'fa-solid fa-broom', 'fa-solid fa-trash', 'fa-solid fa-shirt', 'fa-solid fa-utensils', 'fa-solid fa-droplet', 'fa-solid fa-leaf', 'fa-solid fa-cart-shopping', 'fa-solid fa-book', 'fa-solid fa-sink', 'fa-solid fa-bath', 'fa-solid fa-dog', 'fa-solid fa-cat', 'fa-solid fa-box', 'fa-solid fa-gamepad', 'fa-solid fa-ticket', 'fa-solid fa-tv', 'fa-solid fa-mug-hot', 'fa-solid fa-star', 'fa-solid fa-gift', 'fa-solid fa-medal', 'fa-solid fa-motorcycle', 'fa-solid fa-car', 'fa-solid fa-money-bill'];

function showLoading(show) { 
    document.getElementById('loading-overlay').style.display = show ? 'flex' : 'none'; 
}

function showToast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white flex items-center gap-2 ${type === 'success' ? 'bg-success' : 'bg-red-500'}`;
    
    if (type === 'mega-success') {
        toast.className = `toast px-5 py-4 rounded-xl shadow-2xl text-md font-bold flex items-center gap-3 bg-gradient-to-r from-yellow-400 to-amber-500 text-white`;
        toast.innerHTML = `<i class="fa-solid fa-star text-white text-xl animate-spin-slow"></i> <span>${msg}</span>`;
    } else {
        toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i> ${msg}`;
    }
    
    container.appendChild(toast);
    setTimeout(() => { 
        toast.style.opacity = '0'; 
        setTimeout(() => toast.remove(), 300); 
    }, type === 'mega-success' ? 5000 : 3000);
}

async function refreshUserPoints() {
    if (!currentUser || !supabaseClient) return;
    try {
        const { data, error } = await supabaseClient.from('users').select('points').eq('username', currentUser.username).single();
        if (data) {
            const ptEl = document.getElementById('user-points');
            if (currentUser.points !== data.points || ptEl.innerText === "0") {
                currentUser.points = data.points; 
                localStorage.setItem('housework_user', JSON.stringify(currentUser)); 
                ptEl.innerText = data.points;
                ptEl.classList.add('scale-150', 'text-success'); 
                setTimeout(() => ptEl.classList.remove('scale-150', 'text-success'), 500);
            }
        }
    } catch (e) {
        console.error('Lỗi khi lấy điểm:', e);
    }
}

function setupRealtimeListener() {
    if (!currentUser || !supabaseClient) return;
    
    supabaseClient.channel('custom-user-channel')
    .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'task_logs', 
        filter: `username=eq.${currentUser.username}` 
    }, 
    (payload) => {
        if (payload.new.status === 'Approved' && payload.old.status !== 'Approved') {
            showToast('Wao! Công việc đã được duyệt nha. Điểm vô kìa!', 'mega-success');
            if (typeof confetti === 'function') confetti({ particleCount: 200, spread: 80, origin: { y: 0.3 }, zIndex: 9999 });
            refreshUserPoints();
        }
    }).subscribe();
}

function checkLoginStatus() {
    console.log("Checking login status...");
    const savedUser = localStorage.getItem('housework_user');
    if (savedUser) { 
        try {
            currentUser = JSON.parse(savedUser); 
            document.getElementById('login-screen').style.display = 'none'; 
            initApp(); 
        } catch(e) {
            localStorage.removeItem('housework_user');
            document.getElementById('login-screen').style.display = 'flex';
        }
    } else { 
        document.getElementById('login-screen').style.display = 'flex'; 
    }
}

async function handleLogin() {
    if (!supabaseClient) {
        showToast('Trình duyệt chưa tải được Supabase! Vui lòng tải lại trang.', 'error');
        return;
    }
    
    const userInp = document.getElementById('login-username').value.trim();
    const passInp = document.getElementById('login-password').value.trim();
    const errorBox = document.getElementById('login-error');
    
    if (errorBox) errorBox.classList.add('hidden');
    
    if (!userInp || !passInp) {
        showToast('Vui lòng nhập đủ thông tin!', 'error');
        return;
    }

    showLoading(true);
    try {
        const { data, error } = await supabaseClient.from('users').select('*').eq('username', userInp).eq('password', passInp);
        showLoading(false);
        
        if (error) {
            console.error("Supabase Error:", error);
            if (errorBox) { errorBox.innerText = 'Lỗi truy vấn cơ sở dữ liệu (Database Error)!'; errorBox.classList.remove('hidden'); }
            return;
        }

        if (!data || data.length === 0) {
            if (errorBox) { errorBox.innerText = 'Sai tên đăng nhập hoặc mật khẩu!'; errorBox.classList.remove('hidden'); }
            showToast('Sai tên đăng nhập hoặc mật khẩu!', 'error');
        } else {
            currentUser = data[0]; 
            localStorage.setItem('housework_user', JSON.stringify(currentUser)); 
            document.getElementById('login-screen').style.display = 'none';
            showToast(`Chào mừng ${currentUser.name}!`); 
            initApp();
        }
    } catch (err) {
        showLoading(false);
        console.error("Lỗi:", err);
        if (errorBox) { errorBox.innerText = 'Lỗi kết nối mạng!'; errorBox.classList.remove('hidden'); }
    }
}

function handleLogout() {
    localStorage.removeItem('housework_user'); 
    currentUser = null; 
    if (supabaseClient) supabaseClient.removeAllChannels();
    document.getElementById('login-username').value = ''; 
    document.getElementById('login-password').value = ''; 
    document.getElementById('login-screen').style.display = 'flex';
}

function updateAvatarHeader() {
    const imgEL = document.getElementById('user-avatar-img'); 
    const txtEL = document.getElementById('user-avatar-text');
    if (currentUser.avatar && currentUser.avatar.trim() !== '') {
        if (imgEL) { imgEL.src = currentUser.avatar; imgEL.classList.remove('hidden'); }
        if (txtEL) txtEL.classList.add('hidden');
    } else {
        if (imgEL) imgEL.classList.add('hidden');
        if (txtEL) { txtEL.classList.remove('hidden'); txtEL.innerText = currentUser.name.charAt(0).toUpperCase(); }
    }
}

function openAvatarModal() { 
    document.getElementById('inp-avatar-url').value = currentUser.avatar || ''; 
    document.getElementById('avatar-modal').classList.remove('hidden'); 
    document.getElementById('avatar-modal').classList.add('flex'); 
}

function closeAvatarModal() { 
    document.getElementById('avatar-modal').classList.add('hidden'); 
    document.getElementById('avatar-modal').classList.remove('flex'); 
}

async function saveAvatar() {
    const url = document.getElementById('inp-avatar-url').value.trim();
    showLoading(true);
    const { error } = await supabaseClient.from('users').update({ avatar: url }).eq('username', currentUser.username);
    showLoading(false);
    
    if (error) return showToast('Lỗi cập nhật DB!', 'error');
    
    currentUser.avatar = url; 
    localStorage.setItem('housework_user', JSON.stringify(currentUser));
    updateAvatarHeader(); 
    closeAvatarModal(); 
    showToast('Cập nhật avatar xịn xò thành công!');
}

function initApp() {
    document.getElementById('user-name').innerText = currentUser.name; 
    document.getElementById('user-role').innerText = currentUser.role || 'User'; 
    document.getElementById('user-points').innerText = currentUser.points;
    
    updateAvatarHeader(); 
    setupRealtimeListener();
    
    if (currentUser.role === 'Admin' || currentUser.role === 'Moderator') { 
        document.getElementById('nav-admin').classList.remove('hidden'); 
        document.getElementById('nav-admin').classList.add('flex'); 
    } else { 
        document.getElementById('nav-admin').classList.add('hidden'); 
        document.getElementById('nav-admin').classList.remove('flex'); 
    }
    
    switchTab('home');
}

function switchTab(tabId) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden')); 
    document.getElementById(`view-${tabId}`).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(el => { el.classList.remove('text-primary'); el.classList.add('text-[#4B5563]'); });
    document.getElementById(`nav-${tabId}`).classList.remove('text-[#4B5563]'); 
    document.getElementById(`nav-${tabId}`).classList.add('text-primary');
    
    if (tabId === 'home') loadHomeData(); 
    if (tabId === 'reports') loadReport(currentReportTimeframe); 
    if (tabId === 'admin') loadAdminData('approvals');
}

async function loadHomeData() {
    showLoading(true); 
    await refreshUserPoints();
    
    const { data: tasksData } = await supabaseClient.from('tasks').select('*');
    const { data: logsData } = await supabaseClient.from('task_logs').select('*, users(name)').neq('status', 'Rejected');
    
    const today = new Date(); 
    const dayOfWeek = today.getDay(); // 0 = Sun, 1 = Mon
    const dayOfWeekAdjusted = dayOfWeek === 0 ? 7 : dayOfWeek; // 1 = Mon ... 7 = Sun
    
    const weekOfMonth = Math.ceil(today.getDate() / 7);
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const weekStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-W${weekOfMonth}`;
    
    const tasks = [];
    if (tasksData) {
        tasksData.forEach(t => {
            let isDue = false, periodId = '';
            if (t.frequency === 'Daily') { isDue = true; periodId = todayStr; }
            else if (t.frequency === 'Weekly' && t.schedule == dayOfWeekAdjusted) { isDue = true; periodId = todayStr; }
            else if (t.frequency === 'Monthly' && t.schedule == weekOfMonth) { isDue = true; periodId = weekStr; }
            
            if (isDue) {
                let logStatus = 'Not Done', completedBy = '', completedByName = '';
                if (logsData) {
                    const log = logsData.find(l => l.task_id === t.id && l.period_id === periodId);
                    if (log) { 
                        logStatus = log.status; 
                        completedBy = log.username; 
                        completedByName = log.users?.name || log.username; 
                    }
                }
                tasks.push({ 
                    id: t.id, 
                    name: t.task_name, 
                    points: t.points, 
                    penalty: t.penalty, 
                    status: logStatus, 
                    completedByName, 
                    periodId, 
                    icon: t.icon || 'fa-solid fa-clipboard-list' 
                });
            }
        });
    }
    
    const { data: rewardsData } = await supabaseClient.from('rewards').select('*');
    showLoading(false); 
    renderTasks(tasks); 
    renderRewards(rewardsData || []);
}

function renderTasks(tasks) {
    const container = document.getElementById('home-tasks-container'); 
    const reminderBox = document.getElementById('reminder-box');
    container.innerHTML = '';
    
    if (tasks.length === 0) { 
        container.innerHTML = '<div class="text-center text-muted py-8 text-sm">Hôm nay rảnh rỗi! 🎉</div>'; 
        reminderBox.classList.add('hidden'); 
        return; 
    }
    
    let hasPending = false;
    tasks.forEach(t => {
        if (t.status === 'Not Done') hasPending = true;
        let statHtml = '', actHtml = '';
        
        if (t.status === 'Not Done') { 
            actHtml = `<button onclick="submitTask('${t.id}', '${t.periodId}')" class="w-full mt-3 py-2.5 rounded-xl bg-[#2D323E] text-white text-xs font-bold active-scale hover:bg-primary transition-colors hover:shadow-lg">Đã làm xong</button>`; 
        } else if (t.status === 'Pending Approval') { 
            statHtml = `<span class="badge-pending"><i class="fa-solid fa-clock mr-1"></i>Chờ duyệt</span>`; 
            actHtml = `<div class="mt-3 text-[11px] text-muted text-center">Xí bởi: <span class="text-white font-medium">${t.completedByName}</span></div>`; 
        } else if (t.status === 'Approved') { 
            statHtml = `<span class="badge-approved"><i class="fa-solid fa-check mr-1"></i>Hoàn thành</span>`; 
            actHtml = `<div class="mt-3 text-[11px] text-muted text-center">Hoàn thành bởi: <span class="text-success font-medium">${t.completedByName}</span></div>`; 
        }

        container.innerHTML += `
        <div class="bg-card border border-borderline rounded-2xl p-4 shadow-sm relative overflow-hidden">
            ${t.status === 'Approved' ? '<div class="absolute inset-0 bg-success/5 pointer-events-none"></div>' : ''}
            <div class="flex justify-between items-start mb-2 relative z-10">
                <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-xl flex items-center justify-center bg-[#2D323E] text-[#9CA3AF]"><i class="${t.icon}"></i></div>
                    <h3 class="font-bold text-white text-sm max-w-[150px] leading-tight">${t.name}</h3>
                </div>
                ${statHtml}
            </div>
            <div class="flex items-center gap-3 text-xs text-muted mt-2 relative z-10">
                <span class="flex items-center gap-1 bg-[#16181D] px-2 py-1 rounded border border-borderline"><i class="fa-solid fa-coins text-yellow-500"></i> <b class="text-white">+${t.points}</b></span>
                <span class="flex items-center gap-1 bg-[#16181D] px-2 py-1 rounded border border-borderline text-red-400"><i class="fa-solid fa-arrow-trend-down"></i> <b class="text-red-400">-${t.penalty}</b></span>
            </div>
            ${actHtml}
        </div>`;
    });
    
    if (hasPending) reminderBox.classList.remove('hidden'); 
    else reminderBox.classList.add('hidden');
}

async function submitTask(taskId, periodId) {
    showLoading(true);
    const { data: existing } = await supabaseClient.from('task_logs').select('id').eq('task_id', taskId).eq('period_id', periodId).neq('status', 'Rejected');
    if (existing && existing.length > 0) { 
        showLoading(false); 
        return showToast('Việc này đã có người xí rồi!', 'error'); 
    }
    
    const { error } = await supabaseClient.from('task_logs').insert([{ 
        task_id: taskId, 
        period_id: periodId, 
        username: currentUser.username, 
        status: 'Pending Approval' 
    }]);
    
    showLoading(false);
    if (error) showToast('Lỗi: ' + error.message, 'error'); 
    else { showToast('Đã gửi, chờ duyệt nhé!', 'success'); loadHomeData(); }
}

function renderRewards(rewards) {
    const container = document.getElementById('home-rewards-container'); 
    container.innerHTML = '';
    
    rewards.forEach(r => {
        const canAfford = currentUser.points >= r.cost; 
        const rIcon = r.icon || 'fa-solid fa-gift text-amber-500';
        container.innerHTML += `
        <div class="bg-card border border-borderline rounded-2xl p-4 flex flex-col items-center text-center shadow-sm">
            <div class="w-12 h-12 rounded-full bg-[#2D323E] flex items-center justify-center mb-3 text-xl"><i class="${rIcon}"></i></div>
            <h3 class="font-bold text-white text-sm mb-1 line-clamp-1">${r.reward_name}</h3>
            <div class="text-primary font-bold text-xs mb-3 flex items-center gap-1"><i class="fa-solid fa-coins text-yellow-500"></i> ${r.cost}</div>
            <button onclick="redeemReward('${r.id}', ${r.cost}, '${r.reward_name}')" class="w-full py-2 rounded-xl text-xs font-bold active-scale transition-all duration-300 ${canAfford ? 'bg-primary text-white shadow-lg shadow-primary/30 hover:scale-105' : 'bg-[#2D323E] text-muted opacity-50 cursor-not-allowed'}" ${!canAfford ? 'disabled' : ''}>Đổi quà</button>
        </div>`;
    });
}

async function redeemReward(rewardId, cost, name) {
    if(!confirm(`Dùng ${cost} điểm đổi [ ${name} ] ?`)) return;
    
    showLoading(true); 
    const newPts = currentUser.points - cost;
    
    const { error } = await supabaseClient.from('users').update({ points: newPts }).eq('username', currentUser.username);
    if (error) { showLoading(false); return showToast('Lỗi DB', 'error'); }
    
    await supabaseClient.from('transactions').insert([{ 
        username: currentUser.username, 
        type: 'Spend', 
        amount: cost, 
        description: `Đổi quà: ${name}` 
    }]);
    
    refreshUserPoints(); 
    showLoading(false); 
    showToast(`Tuyệt vời! Đừng quên đòi nha!`, 'mega-success');
    if (typeof confetti === 'function') confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 }, zIndex: 9999 }); 
    
    loadHomeData();
}

// --- BÁO CÁO ---
function toggleCustomDate() {
    const picker = document.getElementById('custom-date-picker'); 
    picker.classList.toggle('hidden');
    document.querySelectorAll('.report-filter').forEach(el => { el.classList.remove('bg-primary', 'text-white'); el.classList.add('bg-card', 'text-muted'); });
    document.getElementById('filter-custom').classList.remove('bg-card', 'text-muted'); 
    document.getElementById('filter-custom').classList.add('bg-primary', 'text-white');
}

async function loadCustomReport() {
    const start = document.getElementById('custom-start').value; 
    const end = document.getElementById('custom-end').value;
    if(!start || !end) return showToast('Chọn đủ ngày!', 'error'); 
    loadReportData(new Date(start), new Date(end + 'T23:59:59'));
}

function switchReportTab(tab) {
    currentReportTab = tab;
    document.getElementById('rtab-tasks').className = `flex-1 py-2 text-sm font-bold ${tab === 'tasks' ? 'text-primary border-b-2 border-primary' : 'text-muted border-b-2 border-transparent'}`;
    document.getElementById('rtab-leaderboard').className = `flex-1 py-2 text-sm font-bold ${tab === 'leaderboard' ? 'text-primary border-b-2 border-primary' : 'text-muted border-b-2 border-transparent'}`;
    document.getElementById('report-content-tasks').style.display = tab === 'tasks' ? 'block' : 'none'; 
    document.getElementById('report-content-leaderboard').style.display = tab === 'leaderboard' ? 'block' : 'none';
}

async function loadReport(timeframe) {
    if (timeframe === 'custom') return toggleCustomDate(); 
    document.getElementById('custom-date-picker').classList.add('hidden'); 
    currentReportTimeframe = timeframe;
    
    document.querySelectorAll('.report-filter').forEach(el => { el.classList.remove('bg-primary', 'text-white'); el.classList.add('bg-card', 'text-muted'); });
    document.getElementById(`filter-${timeframe}`).classList.remove('bg-card', 'text-muted'); 
    document.getElementById(`filter-${timeframe}`).classList.add('bg-primary', 'text-white');
    
    const now = new Date(); 
    let startDate = new Date(0), endDate = new Date('2099-01-01');
    if (timeframe === 'this_week') { 
        const day = now.getDay(); 
        const diff = now.getDate() - day + (day == 0 ? -6:1); 
        startDate = new Date(now.setDate(diff)); 
        startDate.setHours(0,0,0,0); 
        endDate = new Date(startDate); 
        endDate.setDate(startDate.getDate() + 6); 
        endDate.setHours(23,59,59,999); 
    } 
    else if (timeframe === 'last_week') { 
        const day = now.getDay(); 
        const diff = now.getDate() - day + (day == 0 ? -6:1) - 7; 
        startDate = new Date(now.setDate(diff)); 
        startDate.setHours(0,0,0,0); 
        endDate = new Date(startDate); 
        endDate.setDate(startDate.getDate() + 6); 
        endDate.setHours(23,59,59,999); 
    } 
    else if (timeframe === 'this_month') { 
        startDate = new Date(now.getFullYear(), now.getMonth(), 1); 
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59); 
    }
    
    loadReportData(startDate, endDate);
}

async function loadReportData(startDate, endDate) {
    document.getElementById('report-period').innerText = 'Đang tải...'; 
    showLoading(true);
    
    const { data: users } = await supabaseClient.from('users').select('*'); 
    const { data: trans } = await supabaseClient.from('transactions').select('*').gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString()); 
    const { data: tasks } = await supabaseClient.from('tasks').select('*'); 
    const { data: logs } = await supabaseClient.from('task_logs').select('*'); 
    
    showLoading(false);
    
    const todayEnd = new Date(); 
    todayEnd.setHours(23,59,59,999); 
    const actualEndDate = endDate > todayEnd ? todayEnd : endDate; 
    let actualStartDate = new Date(startDate);
    
    if (logs && logs.length > 0) { 
        let minDate = new Date(logs[0].created_at); 
        logs.forEach(l => { const d = new Date(l.created_at); if (d < minDate) minDate = d; }); 
        minDate.setHours(0,0,0,0); 
        if (minDate > actualStartDate) actualStartDate = new Date(minDate); 
    } 
    else { 
        actualStartDate = new Date(actualEndDate); 
        actualStartDate.setHours(0,0,0,0); 
    }
    
    startDate = new Date(actualStartDate); 
    if (actualStartDate > actualEndDate) actualStartDate = new Date(actualEndDate);

    const reportData = {}; 
    if(users) users.forEach(u => reportData[u.username] = { name: u.name, earned: 0, spent: 0, penalty: 0, currentPoints: u.points });
    
    if (trans) trans.forEach(t => { 
        if (reportData[t.username]) { 
            if (t.type === 'Earn') reportData[t.username].earned += t.amount; 
            if (t.type === 'Spend') reportData[t.username].spent += t.amount; 
            if (t.type === 'Penalty') reportData[t.username].penalty += t.amount; 
        } 
    });
    const leaderboard = Object.keys(reportData).map(k => ({ username: k, ...reportData[k] })).sort((a, b) => b.earned - a.earned);

    const logMap = {}; 
    if (logs) logs.forEach(l => { if (l.status !== 'Rejected') logMap[l.task_id + '_' + l.period_id] = true; });
    
    let completedTasks = 0, missedPenaltyTasks = 0, missedFreeTasks = 0; 
    const taskBreakdown = {};
    if (tasks) tasks.forEach(t => taskBreakdown[t.id] = { name: t.task_name, completed: 0, missedPen: 0, missedFree: 0, penaltyAmount: t.penalty });
    
    const uniqueWeeks = new Set();
    for (let d = new Date(actualStartDate); d <= actualEndDate; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay(); 
        const dayOfWeekAdjusted = dayOfWeek === 0 ? 7 : dayOfWeek;
        const weekOfMonth = Math.ceil(d.getDate() / 7); 
        const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; 
        const weekStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-W${weekOfMonth}`; 
        uniqueWeeks.add(weekStr);
        
        if (tasks) tasks.forEach(t => { 
            let isDue = false, pId = ''; 
            if (t.frequency === 'Daily') { isDue = true; pId = dateStr; } 
            else if (t.frequency === 'Weekly' && t.schedule == dayOfWeekAdjusted) { isDue = true; pId = dateStr; } 
            
            if (isDue) { 
                if (logMap[t.id + '_' + pId]) { 
                    completedTasks++; taskBreakdown[t.id].completed++; 
                } else { 
                    if (t.penalty > 0) { missedPenaltyTasks++; taskBreakdown[t.id].missedPen++; } 
                    else { missedFreeTasks++; taskBreakdown[t.id].missedFree++; } 
                } 
            } 
        });
    }
    
    uniqueWeeks.forEach(weekStr => { 
        const wNum = Number(weekStr.split('-W')[1]); 
        if (tasks) tasks.forEach(t => { 
            if (t.frequency === 'Monthly' && t.schedule == wNum) { 
                if (logMap[t.id + '_' + weekStr]) { 
                    completedTasks++; taskBreakdown[t.id].completed++; 
                } else { 
                    if (t.penalty > 0) { missedPenaltyTasks++; taskBreakdown[t.id].missedPen++; } 
                    else { missedFreeTasks++; taskBreakdown[t.id].missedFree++; } 
                } 
            } 
        }); 
    });
    
    const taskStats = { 
        completed: completedTasks, 
        missedPen: missedPenaltyTasks, 
        missedFree: missedFreeTasks, 
        breakdown: Object.values(taskBreakdown).filter(t => t.completed > 0 || t.missedPen > 0 || t.missedFree > 0) 
    };
    
    document.getElementById('report-period').innerText = `${startDate.toLocaleDateString('vi-VN')} - ${endDate.toLocaleDateString('vi-VN')}`; 
    renderLeaderboard(leaderboard); 
    renderTaskStats(taskStats);
}

function renderTaskStats(taskStats) {
    document.getElementById('stat-completed').innerText = taskStats.completed; 
    document.getElementById('stat-missed-pen').innerText = taskStats.missedPen; 
    document.getElementById('stat-missed-free').innerText = taskStats.missedFree;
    
    const container = document.getElementById('stat-breakdown'); 
    container.innerHTML = '';
    
    if(taskStats.breakdown.length === 0) { 
        container.innerHTML = '<div class="text-center text-muted text-xs py-4">Trống trơn.</div>'; 
        return; 
    }
    
    taskStats.breakdown.sort((a,b) => (b.completed + b.missedPen + b.missedFree) - (a.completed + a.missedPen + a.missedFree)).forEach(t => {
        const total = t.completed + t.missedPen + t.missedFree; 
        const percent = total === 0 ? 0 : Math.round((t.completed / total) * 100);
        
        container.innerHTML += `
        <div class="bg-[#16181D] rounded-xl p-3 border border-borderline relative overflow-hidden">
            <div class="flex justify-between items-center mb-2">
                <span class="text-xs font-bold text-white">${t.name}</span>
                <span class="text-[10px] text-muted">${percent}% Done</span>
            </div>
            <div class="w-full bg-[#2D323E] rounded-full h-1.5 mb-2">
                <div class="bg-primary h-1.5 rounded-full" style="width: ${percent}%"></div>
            </div>
            <div class="flex justify-between text-[10px] items-center">
                <span class="text-success flex items-center gap-1"><i class="fa-solid fa-check"></i> Xong ${t.completed}</span>
                <div class="flex gap-2">
                    ${t.missedPen > 0 ? `<span class="text-red-400 bg-red-500/10 px-1 rounded flex items-center gap-1"><i class="fa-solid fa-heart-crack"></i> Phạt ${t.missedPen}</span>` : ''}
                    ${t.missedFree > 0 ? `<span class="text-amber-500 bg-amber-500/10 px-1 rounded flex items-center gap-1"><i class="fa-solid fa-clock-rotate-left"></i> Miễn ${t.missedFree}</span>` : ''}
                </div>
            </div>
        </div>`;
    });
}

function renderLeaderboard(data) {
    const container = document.getElementById('report-content-leaderboard'); 
    container.innerHTML = '';
    if(data.length === 0) return container.innerHTML = '<div class="text-center text-muted py-4 text-sm">Chưa có dữ liệu.</div>';
    
    data.forEach((user, index) => {
        let rankIcon = `<div class="w-6 h-6 rounded-full bg-[#2D323E] text-muted flex items-center justify-center text-xs font-bold">${index + 1}</div>`;
        if (index === 0) rankIcon = `<i class="fa-solid fa-crown text-yellow-500 text-xl drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]"></i>`; 
        else if (index === 1) rankIcon = `<i class="fa-solid fa-medal text-gray-300 text-lg"></i>`; 
        else if (index === 2) rankIcon = `<i class="fa-solid fa-medal text-amber-600 text-lg"></i>`;
        
        container.innerHTML += `
        <div class="bg-card border border-borderline rounded-2xl p-4 flex items-center gap-4">
            <div class="w-8 flex justify-center">${rankIcon}</div>
            <div class="flex-1">
                <div class="font-bold text-white text-sm">${user.name}</div>
                <div class="text-[11px] text-muted">Hiện có: <span class="text-primary font-bold">${user.currentPoints}</span> pts</div>
            </div>
            <div class="text-right space-y-1">
                <div class="text-xs text-success font-medium"><i class="fa-solid fa-arrow-trend-up mr-1 text-[10px]"></i>+${user.earned}</div>
                <div class="text-[10px] text-red-400"><i class="fa-solid fa-arrow-trend-down mr-1 text-[10px]"></i>-${user.penalty}</div>
            </div>
        </div>`;
    });
}

// --- ADMIN ---
async function loadAdminData(type) {
    currentAdminType = type; 
    document.querySelectorAll('#view-admin button[id^="admin-tab-"]').forEach(el => { el.classList.remove('bg-[#2D323E]', 'text-white'); el.classList.add('text-muted'); });
    document.getElementById(`admin-tab-${type}`).classList.add('bg-[#2D323E]', 'text-white'); 
    document.getElementById(`admin-tab-${type}`).classList.remove('text-muted');
    
    const addBtn = document.getElementById('admin-add-btn');
    if (type === 'approvals') { 
        addBtn.style.display = 'none'; 
        loadApprovals(); 
    } else {
        addBtn.style.display = 'block'; 
        addBtn.onclick = () => openModal(type); 
        showLoading(true); 
        let data = [];
        
        if (type === 'users') { 
            const res = await supabaseClient.from('users').select('*'); 
            data = res.data || []; 
            if (currentUser.role === 'Moderator') data = data.filter(u => u.role === 'User'); 
        } 
        else if (type === 'tasks') { 
            const res = await supabaseClient.from('tasks').select('*'); 
            data = res.data || []; 
        } 
        else if (type === 'rewards') { 
            const res = await supabaseClient.from('rewards').select('*'); 
            data = res.data || []; 
        }
        
        showLoading(false); 
        renderAdminList(type, data);
    }
}

async function loadApprovals() {
    showLoading(true); 
    const { data, error } = await supabaseClient.from('task_logs').select('*, tasks(task_name, points, icon), users(name)').eq('status', 'Pending Approval'); 
    showLoading(false);
    
    const container = document.getElementById('admin-list-container'); 
    container.innerHTML = '';
    
    if (error) return showToast(error.message, 'error'); 
    if (!data || data.length === 0) return container.innerHTML = '<div class="text-center text-muted py-8 text-sm">Quá mượt! Không có việc chờ duyệt.</div>';
    
    data.forEach(item => {
        container.innerHTML += `
        <div class="bg-card border border-borderline rounded-2xl p-4 shadow-sm">
            <div class="flex justify-between items-start mb-2">
                <div class="flex items-start gap-2">
                    <i class="${item.tasks?.icon || 'fa-solid fa-clipboard-list'} text-[#9CA3AF] mt-1 text-sm bg-[#2D323E] w-6 h-6 rounded flex items-center justify-center"></i>
                    <div>
                        <h4 class="font-bold text-white text-sm max-w-[150px] leading-tight">${item.tasks?.task_name}</h4>
                        <div class="text-[11px] text-muted mt-1">Người làm: <span class="text-white">${item.users?.name || item.username}</span></div>
                    </div>
                </div>
                <div class="text-primary font-bold text-sm bg-[#16181D] px-2 py-1 rounded">+${item.tasks?.points}</div>
            </div>
            <div class="flex gap-2 mt-4">
                <button onclick="approveTask('${item.id}', false, '${item.username}', ${item.tasks?.points}, '${item.tasks?.task_name}')" class="flex-1 py-2 rounded-xl bg-red-500/10 text-red-500 text-xs font-bold active-scale">Từ chối</button>
                <button onclick="approveTask('${item.id}', true, '${item.username}', ${item.tasks?.points}, '${item.tasks?.task_name}')" class="flex-1 py-2 rounded-xl bg-success text-white text-xs font-bold active-scale">Duyệt & Cộng Điểm</button>
            </div>
        </div>`;
    });
}

async function approveTask(logId, isApproved, username, points, taskName) {
    showLoading(true); 
    const status = isApproved ? 'Approved' : 'Rejected';
    
    await supabaseClient.from('task_logs').update({ status: status, approved_by: currentUser.username }).eq('id', logId);
    
    if (isApproved) {
        const { data: uData } = await supabaseClient.from('users').select('points').eq('username', username).single();
        if (uData) { 
            await supabaseClient.from('users').update({ points: uData.points + points }).eq('username', username); 
            await supabaseClient.from('transactions').insert([{ username: username, type: 'Earn', amount: points, description: `Duyệt việc: ${taskName}` }]); 
        }
    }
    
    refreshUserPoints(); 
    showLoading(false); 
    showToast(isApproved ? 'Đã duyệt, user đã có điểm!' : 'Đã từ chối.', isApproved ? 'success' : 'error'); 
    loadApprovals();
}

function renderAdminList(type, data) {
    const container = document.getElementById('admin-list-container'); 
    container.innerHTML = '';
    if (data.length === 0) return container.innerHTML = '<div class="text-center text-muted py-8 text-sm">Chưa có dữ liệu.</div>';
    
    data.forEach(item => {
        let title = '', subtitle = '', id = '', prefixHTML = '';
        if (type === 'users') { 
            id = item.username; 
            title = item.name; 
            subtitle = `${item.role} - <span class="text-yellow-500">${item.points} pts</span>`; 
            prefixHTML = `<div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white overflow-hidden bg-[#2D323E]">${item.avatar && item.avatar.trim() !== '' ? `<img src="${item.avatar}" class="w-full h-full object-cover">` : item.name.charAt(0)}</div>`; 
        }
        else if (type === 'tasks') { 
            id = item.id; 
            title = item.task_name; 
            subtitle = `${item.frequency} | Thuộc tính: <span class="text-primary">+${item.points}</span> / <span class="text-red-400">-${item.penalty}</span>`; 
            prefixHTML = `<div class="w-8 h-8 rounded bg-[#2D323E] flex items-center justify-center"><i class="${item.icon || 'fa-solid fa-clipboard-list'} text-[#9CA3AF] text-xs"></i></div>`; 
        }
        else if (type === 'rewards') { 
            id = item.id; 
            title = item.reward_name; 
            subtitle = `<span class="text-yellow-500">${item.cost} pts</span>`; 
            prefixHTML = `<div class="w-8 h-8 rounded bg-[#2D323E] flex items-center justify-center"><i class="${item.icon || 'fa-solid fa-gift'} text-amber-500 text-xs"></i></div>`; 
        }
        
        window[`editData_${id}`] = item;
        
        container.innerHTML += `
        <div class="bg-card border border-borderline rounded-2xl p-4 flex justify-between items-center shadow-sm">
            <div class="flex gap-3 items-center">
                ${prefixHTML}
                <div>
                    <h4 class="font-bold text-white text-sm">${title}</h4>
                    <div class="text-[10px] text-muted mt-0.5">${subtitle}</div>
                </div>
            </div>
            <div class="flex gap-2">
                <button onclick="openModal('${type}', window['editData_${id}'])" class="w-8 h-8 rounded-lg bg-[#2D323E] text-white flex items-center justify-center active-scale"><i class="fa-solid fa-pen text-xs"></i></button>
                <button onclick="deleteData('${type}', '${id}')" class="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center active-scale"><i class="fa-solid fa-trash text-xs"></i></button>
            </div>
        </div>`;
    });
}

function handleFreqChange() {
    const freq = document.getElementById('inp-tfreq').value;
    const schedContainer = document.getElementById('sched-container');
    if (freq === 'Daily') {
        schedContainer.innerHTML = '';
    } else if (freq === 'Weekly') {
        schedContainer.innerHTML = `
            <select id="inp-tsched" class="w-full bg-[#16181D] border border-borderline rounded-xl px-4 py-3 text-white text-sm outline-none mb-3">
                <option value="1">Thứ 2</option>
                <option value="2">Thứ 3</option>
                <option value="3">Thứ 4</option>
                <option value="4">Thứ 5</option>
                <option value="5">Thứ 6</option>
                <option value="6">Thứ 7</option>
                <option value="7">Chủ Nhật</option>
            </select>
        `;
    } else if (freq === 'Monthly') {
        schedContainer.innerHTML = `
            <select id="inp-tsched" class="w-full bg-[#16181D] border border-borderline rounded-xl px-4 py-3 text-white text-sm outline-none mb-3">
                <option value="1">Tuần 1</option>
                <option value="2">Tuần 2</option>
                <option value="3">Tuần 3</option>
                <option value="4">Tuần 4</option>
            </select>
        `;
    }
}

function selectIcon(iconClass) {
    document.getElementById('inp-icon').value = iconClass;
    document.querySelectorAll('.icon-option').forEach(el => {
        el.classList.remove('bg-primary', 'text-white', 'ring-2', 'ring-primary');
        el.classList.add('bg-[#2D323E]', 'text-[#9CA3AF]');
    });
    const formattedId = iconClass.replace(/ /g, '-');
    const selectedEl = document.getElementById('icon-' + formattedId);
    if(selectedEl) {
        selectedEl.classList.remove('bg-[#2D323E]', 'text-[#9CA3AF]');
        selectedEl.classList.add('bg-primary', 'text-white', 'ring-2', 'ring-primary');
    }
}

function openModal(type, item = null) {
    const modal = document.getElementById('admin-modal'); 
    document.getElementById('modal-title').innerText = item ? 'Chỉnh sửa' : 'Thêm mới';
    const body = document.getElementById('modal-body'); 
    const saveBtn = document.getElementById('modal-save-btn'); 
    body.innerHTML = '';
    
    let iconGridHtml = '';
    if (type === 'tasks' || type === 'rewards') {
        iconGridHtml = `
            <label class="block text-[10px] text-muted mb-1 font-bold tracking-wider">CHỌN ICON</label>
            <div class="grid grid-cols-6 gap-2 mb-4" id="icon-picker">
                ${ICONS.map(i => `<div onclick="selectIcon('${i}')" id="icon-${i.replace(/ /g, '-')}" class="icon-option w-full aspect-square flex items-center justify-center rounded-xl bg-[#2D323E] cursor-pointer active-scale text-[#9CA3AF]"><i class="${i}"></i></div>`).join('')}
            </div>
            <input type="hidden" id="inp-icon" value="${item && item.icon ? item.icon : ICONS[0]}">
        `;
    }

    if (type === 'users') {
        let roleOpts = currentUser.role === 'Admin' ? 
            `<option value="User" ${item && item.role === 'User' ? 'selected' : ''}>User</option>
             <option value="Moderator" ${item && item.role === 'Moderator' ? 'selected' : ''}>Moderator</option>
             <option value="Admin" ${item && item.role === 'Admin' ? 'selected' : ''}>Admin</option>` 
            : `<option value="User" selected>User</option>`;
            
        body.innerHTML = `
            <input id="inp-username" type="text" placeholder="Tên user" class="w-full bg-[#16181D] border border-borderline rounded-xl px-4 py-3 text-white text-sm outline-none mb-3" value="${item ? item.username : ''}" ${item ? 'disabled' : ''}>
            <input id="inp-name" type="text" placeholder="Tên đẹp" class="w-full bg-[#16181D] border border-borderline rounded-xl px-4 py-3 text-white text-sm outline-none mb-3" value="${item ? item.name : ''}">
            <input id="inp-points" type="number" placeholder="Điểm" class="w-full bg-[#16181D] border border-borderline rounded-xl px-4 py-3 text-white text-sm outline-none mb-3" value="${item ? item.points : '0'}">
            <select id="inp-role" class="w-full bg-[#16181D] border border-borderline rounded-xl px-4 py-3 text-white text-sm outline-none mb-3">${roleOpts}</select>
            <input id="inp-password" type="text" placeholder="Pass (không mã hoá)" class="w-full bg-[#16181D] border border-borderline rounded-xl px-4 py-3 text-white text-sm outline-none mb-3" value="${item ? item.password : ''}">
            <input id="inp-avatar" type="text" placeholder="URL Hình Avatar" class="w-full bg-[#16181D] border border-borderline rounded-xl px-4 py-3 text-white text-sm outline-none" value="${item && item.avatar ? item.avatar : ''}">
        `;
    } else if (type === 'tasks') {
        const isWeekly = item && item.frequency === 'Weekly';
        const isMonthly = item && item.frequency === 'Monthly';
        
        body.innerHTML = `
            <input id="inp-tname" type="text" placeholder="Tên việc" class="w-full bg-[#16181D] border border-borderline rounded-xl px-4 py-3 text-white text-sm outline-none mb-3" value="${item ? item.task_name : ''}">
            ${iconGridHtml}
            <select id="inp-tfreq" onchange="handleFreqChange()" class="w-full bg-[#16181D] border border-borderline rounded-xl px-4 py-3 text-white text-sm outline-none mb-3">
                <option value="Daily" ${item && item.frequency === 'Daily' ? 'selected' : ''}>Hàng ngày</option>
                <option value="Weekly" ${isWeekly ? 'selected' : ''}>Hàng tuần</option>
                <option value="Monthly" ${isMonthly ? 'selected' : ''}>Hàng tháng</option>
            </select>
            <div id="sched-container"></div>
            <div class="grid grid-cols-2 gap-2 mt-3">
                <input id="inp-tpoints" type="number" placeholder="Thưởng pts" class="w-full bg-[#16181D] border border-borderline rounded-xl px-4 py-3 text-white text-sm outline-none" value="${item ? item.points : ''}">
                <input id="inp-tpenalty" type="number" placeholder="Phạt pts" class="w-full bg-[#16181D] border border-borderline rounded-xl px-4 py-3 text-white text-sm outline-none" value="${item ? item.penalty : ''}">
            </div>
        `;
        
        setTimeout(() => {
            handleFreqChange();
            if (item && item.schedule && document.getElementById('inp-tsched')) {
                document.getElementById('inp-tsched').value = item.schedule;
            }
            selectIcon(item && item.icon ? item.icon : ICONS[0]);
        }, 10);

    } else if (type === 'rewards') {
        body.innerHTML = `
            <input id="inp-rname" type="text" placeholder="Tên quà" class="w-full bg-[#16181D] border border-borderline rounded-xl px-4 py-3 text-white text-sm outline-none mb-3" value="${item ? item.reward_name : ''}">
            ${iconGridHtml}
            <input id="inp-rcost" type="number" placeholder="Giá pts" class="w-full bg-[#16181D] border border-borderline rounded-xl px-4 py-3 text-white text-sm outline-none mt-3" value="${item ? item.cost : ''}">
        `;
        
        setTimeout(() => {
            selectIcon(item && item.icon ? item.icon : ICONS[19]);
        }, 10);
    }
    
    modal.classList.remove('hidden'); 
    saveBtn.onclick = () => saveData(type, item ? (type==='users' ? item.username : item.id) : null);
}

function closeModal() { 
    document.getElementById('admin-modal').classList.add('hidden'); 
}

async function saveData(type, id) {
    showLoading(true); 
    let error = null;
    
    try {
        if (type === 'users') { 
            const data = { 
                username: document.getElementById('inp-username').value.trim(), 
                name: document.getElementById('inp-name').value, 
                points: document.getElementById('inp-points').value, 
                role: document.getElementById('inp-role').value, 
                password: document.getElementById('inp-password').value, 
                avatar: document.getElementById('inp-avatar').value 
            }; 
            if (id) { 
                const res = await supabaseClient.from('users').update(data).eq('username', id); 
                error = res.error; 
            } else { 
                const res = await supabaseClient.from('users').insert([data]); 
                error = res.error; 
            } 
        } 
        else if (type === 'tasks') { 
            const data = { 
                task_name: document.getElementById('inp-tname').value, 
                icon: document.getElementById('inp-icon').value, 
                frequency: document.getElementById('inp-tfreq').value, 
                schedule: document.getElementById('inp-tsched') ? document.getElementById('inp-tsched').value : null, 
                points: document.getElementById('inp-tpoints').value, 
                penalty: document.getElementById('inp-tpenalty').value || 0 
            }; 
            if (id) { 
                const res = await supabaseClient.from('tasks').update(data).eq('id', id); 
                error = res.error; 
            } else { 
                const res = await supabaseClient.from('tasks').insert([data]); 
                error = res.error; 
            } 
        } 
        else if (type === 'rewards') { 
            const data = { 
                reward_name: document.getElementById('inp-rname').value, 
                icon: document.getElementById('inp-icon').value, 
                cost: document.getElementById('inp-rcost').value 
            }; 
            if (id) { 
                const res = await supabaseClient.from('rewards').update(data).eq('id', id); 
                error = res.error; 
            } else { 
                const res = await supabaseClient.from('rewards').insert([data]); 
                error = res.error; 
            } 
        }
    } catch (err) { error = err; }
    
    showLoading(false); 
    if (error) return showToast(error.message, 'error');
    
    showToast('Lưu thành công!'); 
    closeModal(); 
    loadAdminData(type);
}

async function deleteData(type, id) {
    if (!confirm('Chắc chắn xoá luôn ?')) return;
    
    showLoading(true); 
    let error = null;
    if (type === 'users') { const res = await supabaseClient.from('users').delete().eq('username', id); error = res.error; }
    else if (type === 'tasks') { const res = await supabaseClient.from('tasks').delete().eq('id', id); error = res.error; }
    else if (type === 'rewards') { const res = await supabaseClient.from('rewards').delete().eq('id', id); error = res.error; }
    
    showLoading(false); 
    if (error) return showToast(error.message, 'error');
    
    showToast('Đã xoá!'); 
    loadAdminData(type);
}

window.onload = () => { 
    setTimeout(checkLoginStatus, 500); 
};
