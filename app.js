const SUPABASE_URL = 'https://akgrmxazfgwbnpqupmor.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_L6pJkJPwbOoEDDbNXhL_PQ_oq2nm-rC';
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

let currentUser = null; 
let currentAdminType = 'approvals'; 
let currentReportTimeframe = 'this_week'; 
let currentReportTab = 'tasks';

let currentReportData = { tasks: [], logs: [], startDate: null, endDate: null, users: [] };

const ICONS = ['fa-solid fa-clipboard-list', 'fa-solid fa-broom', 'fa-solid fa-trash', 'fa-solid fa-shirt', 'fa-solid fa-utensils', 'fa-solid fa-droplet', 'fa-solid fa-leaf', 'fa-solid fa-cart-shopping', 'fa-solid fa-book', 'fa-solid fa-sink', 'fa-solid fa-bath', 'fa-solid fa-dog', 'fa-solid fa-cat', 'fa-solid fa-box', 'fa-solid fa-gamepad', 'fa-solid fa-ticket', 'fa-solid fa-tv', 'fa-solid fa-mug-hot', 'fa-solid fa-star', 'fa-solid fa-gift', 'fa-solid fa-medal', 'fa-solid fa-motorcycle', 'fa-solid fa-car', 'fa-solid fa-money-bill', 'fa-solid fa-fire', 'fa-solid fa-rocket', 'fa-solid fa-bolt'];

function showLoading(show) { document.getElementById('loading-overlay').style.display = show ? 'flex' : 'none'; }

function showToast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast px-4 py-3 rounded-xl shadow-lg text-sm font-bold text-white flex items-center gap-2 ${type === 'success' ? 'bg-success' : 'bg-red-500'}`;
    if (type === 'mega-success') {
        toast.className = `toast px-5 py-4 rounded-xl shadow-2xl text-md font-bold flex items-center gap-3 bg-gradient-to-r from-yellow-400 to-amber-500 text-white`;
        toast.innerHTML = `<i class="fa-solid fa-star text-white text-xl animate-spin-slow"></i> <span>${msg}</span>`;
    } else {
        toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i> ${msg}`;
    }
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, type === 'mega-success' ? 5000 : 3000);
}

async function refreshUserPoints() {
    if (!currentUser || !supabaseClient) return;
    try {
        const { data } = await supabaseClient.from('users').select('points').eq('username', currentUser.username).single();
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
    } catch (e) { console.error('Lỗi khi lấy điểm:', e); }
}

function setupRealtimeListener() {
    if (!currentUser || !supabaseClient) return;
    supabaseClient.channel('custom-user-channel').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'task_logs', filter: `username=eq.${currentUser.username}` }, 
    (payload) => {
        if (payload.new.status === 'Approved' && payload.old.status !== 'Approved') {
            showToast('Wao! Công việc đã được duyệt nha. Điểm vô kìa!', 'mega-success');
            if (typeof confetti === 'function') confetti({ particleCount: 200, spread: 80, origin: { y: 0.3 }, zIndex: 9999 });
            refreshUserPoints();
        }
    }).subscribe();
}

function checkLoginStatus() {
    const savedUser = localStorage.getItem('housework_user');
    if (savedUser) { 
        try { currentUser = JSON.parse(savedUser); document.getElementById('login-screen').style.display = 'none'; initApp(); } 
        catch(e) { localStorage.removeItem('housework_user'); document.getElementById('login-screen').style.display = 'flex'; }
    } else document.getElementById('login-screen').style.display = 'flex'; 
}

async function handleLogin() {
    const userInp = document.getElementById('login-username').value.trim();
    const passInp = document.getElementById('login-password').value.trim();
    const errorBox = document.getElementById('login-error');
    if (errorBox) errorBox.classList.add('hidden');
    if (!userInp || !passInp) return showToast('Vui lòng nhập đủ thông tin!', 'error');

    showLoading(true);
    try {
        const { data, error } = await supabaseClient.from('users').select('*').eq('username', userInp).eq('password', passInp);
        showLoading(false);
        if (error) { if (errorBox) { errorBox.innerText = 'Lỗi truy vấn cơ sở dữ liệu!'; errorBox.classList.remove('hidden'); } return; }
        if (!data || data.length === 0) {
            if (errorBox) { errorBox.innerText = 'Sai tên đăng nhập hoặc mật khẩu!'; errorBox.classList.remove('hidden'); }
        } else {
            currentUser = data[0]; 
            localStorage.setItem('housework_user', JSON.stringify(currentUser)); 
            document.getElementById('login-screen').style.display = 'none';
            showToast(`Chào mừng ${currentUser.name}!`); initApp();
        }
    } catch (err) { showLoading(false); if (errorBox) { errorBox.innerText = 'Lỗi mạng!'; errorBox.classList.remove('hidden'); } }
}

function handleLogout() {
    localStorage.removeItem('housework_user'); currentUser = null; 
    if (supabaseClient) supabaseClient.removeAllChannels();
    document.getElementById('login-username').value = ''; document.getElementById('login-password').value = ''; 
    document.getElementById('login-screen').style.display = 'flex';
}

function updateAvatarHeader() {
    const imgEL = document.getElementById('user-avatar-img'); const txtEL = document.getElementById('user-avatar-text');
    if (currentUser.avatar && currentUser.avatar.trim() !== '') {
        if (imgEL) { imgEL.src = currentUser.avatar; imgEL.classList.remove('hidden'); }
        if (txtEL) txtEL.classList.add('hidden');
    } else {
        if (imgEL) imgEL.classList.add('hidden');
        if (txtEL) { txtEL.classList.remove('hidden'); txtEL.innerText = currentUser.name.charAt(0).toUpperCase(); }
    }
}

function openAvatarModal() { document.getElementById('inp-avatar-url').value = currentUser.avatar || ''; document.getElementById('avatar-modal').classList.remove('hidden'); document.getElementById('avatar-modal').classList.add('flex'); }
function closeAvatarModal() { document.getElementById('avatar-modal').classList.add('hidden'); document.getElementById('avatar-modal').classList.remove('flex'); }

async function saveAvatar() {
    const url = document.getElementById('inp-avatar-url').value.trim();
    showLoading(true);
    const { error } = await supabaseClient.from('users').update({ avatar: url }).eq('username', currentUser.username);
    showLoading(false);
    if (error) return showToast('Lỗi cập nhật DB!', 'error');
    currentUser.avatar = url; localStorage.setItem('housework_user', JSON.stringify(currentUser));
    updateAvatarHeader(); closeAvatarModal(); showToast('Cập nhật avatar thành công!');
}

function initApp() {
    document.getElementById('user-name').innerText = currentUser.name; 
    document.getElementById('user-role').innerText = currentUser.role || 'User'; 
    document.getElementById('user-points').innerText = currentUser.points;
    
    updateAvatarHeader(); setupRealtimeListener();
    if (currentUser.role === 'Admin' || currentUser.role === 'Moderator') { 
        document.getElementById('nav-admin').classList.remove('hidden'); document.getElementById('nav-admin').classList.add('flex'); 
    } else { 
        document.getElementById('nav-admin').classList.add('hidden'); document.getElementById('nav-admin').classList.remove('flex'); 
    }
    switchTab('home');
}

function switchTab(tabId) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden')); 
    document.getElementById(`view-${tabId}`).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(el => { el.classList.remove('text-primary'); el.classList.add('text-muted'); });
    document.getElementById(`nav-${tabId}`).classList.remove('text-muted'); document.getElementById(`nav-${tabId}`).classList.add('text-primary');
    if (tabId === 'home') loadHomeData(); 
    if (tabId === 'reports') loadReport(currentReportTimeframe); 
    if (tabId === 'admin') loadAdminData('approvals');
}

async function loadHomeData() {
    showLoading(true); await refreshUserPoints();
    const { data: tasksData } = await supabaseClient.from('tasks').select('*');
    const { data: logsData } = await supabaseClient.from('task_logs').select('*, users(name)').neq('status', 'Rejected');
    
    const today = new Date(); 
    const dayOfWeek = today.getDay(); const dayOfWeekAdjusted = dayOfWeek === 0 ? 7 : dayOfWeek; 
    const weekOfMonth = Math.ceil(today.getDate() / 7);
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const weekStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-W${weekOfMonth}`;
    
    const dailyTasks = []; const weeklyTasks = []; const adhocTasks = [];
    
    if (tasksData) {
        tasksData.forEach(t => {
            let isDue = false, periodId = '';
            if (t.frequency === 'Daily') { isDue = true; periodId = todayStr; }
            else if (t.frequency === 'Weekly' && t.schedule == dayOfWeekAdjusted) { isDue = true; periodId = todayStr; }
            else if (t.frequency === 'Monthly' && t.schedule == weekOfMonth) { isDue = true; periodId = weekStr; }
            else if (t.frequency === 'Adhoc' && t.schedule === todayStr) { isDue = true; periodId = todayStr; }
            
            if (isDue) {
                let logStatus = 'Not Done', completedByName = '';
                if (logsData) {
                    const log = logsData.find(l => l.task_id === t.id && l.period_id === periodId);
                    if (log) { logStatus = log.status; completedByName = log.users?.name || log.username; }
                }
                const formattedTask = { id: t.id, name: t.task_name, points: t.points, penalty: t.penalty, status: logStatus, completedByName, periodId, frequency: t.frequency, icon: t.icon || 'fa-solid fa-clipboard-list' };
                if (!t.penalty || Number(t.penalty) <= 0) {
                    adhocTasks.push(formattedTask);
                } else if (t.frequency === 'Daily') {
                    dailyTasks.push(formattedTask);
                } else {
                    weeklyTasks.push(formattedTask);
                }
            }
        });
    }
    
    const { data: rewardsData } = await supabaseClient.from('rewards').select('*');
    showLoading(false); 
    
    let hasPending = false;
    hasPending = renderTaskGroup(dailyTasks, 'home-daily-container', 'Chưa có việc hàng ngày.') || hasPending;
    hasPending = renderTaskGroup(weeklyTasks, 'home-weekly-container', 'Hôm nay không có việc định kỳ.') || hasPending;
    renderTaskGroup(adhocTasks, 'home-adhoc-container', 'Tạm thời chưa có việc kiếm thêm.');
    
    if (hasPending) document.getElementById('reminder-box').classList.remove('hidden'); 
    else document.getElementById('reminder-box').classList.add('hidden');
    renderRewards(rewardsData || []);
}

function renderTaskGroup(tasks, containerId, emptyMsg) {
    const container = document.getElementById(containerId); 
    if(!container) return false;
    container.innerHTML = '';
    
    if (tasks.length === 0) { container.innerHTML = `<div class="text-center text-muted py-6 text-xs bg-card border border-borderline rounded-2xl border-dashed">${emptyMsg}</div>`; return false; }
    
    let hasPending = false;
    tasks.forEach(t => {
        if (t.status === 'Not Done' && t.penalty > 0) hasPending = true;
        let rightColHtml = '';
        if (t.status === 'Not Done') { 
            rightColHtml = `<button onclick="submitTask('${t.id}', '${t.periodId}')" class="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl active-scale hover:bg-primary hover:text-white transition-colors shadow-sm ml-2 cursor-pointer border border-primary/20"><i class="fa-solid fa-check"></i></button>`; 
        } else if (t.status === 'Pending Approval') { 
            rightColHtml = `<div class="flex flex-col items-end ml-2">
                <span class="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20"><i class="fa-solid fa-clock mr-1"></i>Chờ</span>
                <span class="text-[9px] text-muted mt-1.5 bg-surface px-1.5 rounded truncate max-w-[70px]" title="${t.completedByName}">${t.completedByName}</span>
            </div>`; 
        } else if (t.status === 'Approved') { 
            rightColHtml = `<div class="flex flex-col items-end ml-2">
                <span class="text-[10px] font-bold text-success bg-success/10 px-2 py-1 rounded border border-success/20"><i class="fa-solid fa-check mr-1"></i>Xong</span>
                <span class="text-[9px] text-success mt-1.5 bg-success/5 px-1.5 rounded truncate max-w-[70px]" title="${t.completedByName}">${t.completedByName}</span>
            </div>`; 
        }

        container.innerHTML += `
        <div class="bg-card border border-borderline rounded-2xl p-3.5 mb-3 shadow-sm relative overflow-hidden transition-all hover:border-primary/50 flex items-center justify-between">
            ${t.status === 'Approved' ? '<div class="absolute inset-0 bg-success/5 pointer-events-none"></div>' : ''}
            <div class="flex items-center gap-3.5 relative z-10 flex-1 min-w-0">
                <div class="w-14 h-14 shrink-0 rounded-[16px] bg-surface flex items-center justify-center text-primary text-2xl shadow-inner border border-white/5">
                    <i class="${t.icon}"></i>
                </div>
                <div class="flex flex-col justify-center flex-1 min-w-0">
                    <h3 class="font-bold text-main text-sm leading-snug line-clamp-2 mb-1.5">${t.name}</h3>
                    <div class="flex items-center gap-2">
                        <span class="flex items-center gap-1 text-[11px] font-black text-success bg-success/10 px-1.5 py-0.5 rounded"><i class="fa-solid fa-coins text-yellow-500"></i> +${t.points}</span>
                        ${t.penalty > 0 ? `<span class="flex items-center gap-1 text-[11px] font-black text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded"><i class="fa-solid fa-arrow-trend-down"></i> -${t.penalty}</span>` : ''}
                    </div>
                </div>
            </div>
            
            <div class="relative z-10 shrink-0">
                ${rightColHtml}
            </div>
        </div>`;
    });
    return hasPending;
}

async function submitTask(taskId, periodId) {
    showLoading(true);
    const { data: existing } = await supabaseClient.from('task_logs').select('id').eq('task_id', taskId).eq('period_id', periodId).neq('status', 'Rejected');
    if (existing && existing.length > 0) { showLoading(false); return showToast('Việc này đã có người xí rồi!', 'error'); }
    const { error } = await supabaseClient.from('task_logs').insert([{ task_id: taskId, period_id: periodId, username: currentUser.username, status: 'Pending Approval' }]);
    showLoading(false);
    if (error) showToast('Lỗi: ' + error.message, 'error'); else { showToast('Đã gửi, chờ duyệt nhé!', 'success'); loadHomeData(); }
}

function renderRewards(rewards) {
    const container = document.getElementById('home-rewards-container'); container.innerHTML = '';
    rewards.forEach(r => {
        const canAfford = currentUser.points >= r.cost; const rIcon = r.icon || 'fa-solid fa-gift text-amber-500';
        container.innerHTML += `
        <div class="bg-card border border-borderline rounded-2xl p-4 flex flex-col items-center text-center shadow-sm relative overflow-hidden transition-all hover:border-primary/50">
            <div class="w-14 h-14 rounded-full bg-surface shadow-inner flex items-center justify-center mb-3 text-2xl text-primary"><i class="${rIcon}"></i></div>
            <h3 class="font-bold text-main text-sm mb-1 line-clamp-1">${r.reward_name}</h3>
            <div class="font-black text-sm mb-3 flex items-center gap-1 ${canAfford ? 'text-yellow-500' : 'text-muted'}"><i class="fa-solid fa-coins"></i> ${r.cost}</div>
            <button onclick="redeemReward('${r.id}', ${r.cost}, '${r.reward_name}')" class="w-full py-2.5 rounded-xl text-xs font-bold active-scale transition-all duration-300 ${canAfford ? 'bg-primary text-white shadow-lg shadow-primary/30 hover:scale-105' : 'bg-surface text-muted opacity-50 cursor-not-allowed'}" ${!canAfford ? 'disabled' : ''}>Đổi quà luôn</button>
        </div>`;
    });
}

async function redeemReward(rewardId, cost, name) {
    if(!confirm(`Dùng ${cost} điểm đổi [ ${name} ] ?`)) return;
    showLoading(true); const newPts = currentUser.points - cost;
    const { error } = await supabaseClient.from('users').update({ points: newPts }).eq('username', currentUser.username);
    if (error) { showLoading(false); return showToast('Lỗi DB', 'error'); }
    await supabaseClient.from('transactions').insert([{ username: currentUser.username, type: 'Spend', amount: cost, description: `Đổi quà: ${name}` }]);
    refreshUserPoints(); showLoading(false); showToast(`Tuyệt vời! Đừng quên đòi nha!`, 'mega-success');
    if (typeof confetti === 'function') confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 }, zIndex: 9999 }); 
    loadHomeData();
}

function toggleCustomDate() {
    const picker = document.getElementById('custom-date-picker'); picker.classList.toggle('hidden');
    document.querySelectorAll('.report-filter').forEach(el => { el.classList.remove('bg-primary', 'text-main'); el.classList.add('bg-card', 'text-muted'); });
    document.getElementById('filter-custom').classList.remove('bg-card', 'text-muted'); document.getElementById('filter-custom').classList.add('bg-primary', 'text-main');
}

async function loadCustomReport() {
    const start = document.getElementById('custom-start').value; const end = document.getElementById('custom-end').value;
    if(!start || !end) return showToast('Chọn đủ ngày!', 'error'); 
    loadReportData(new Date(start), new Date(end + 'T23:59:59'));
}

function switchReportTab(tab) {
    currentReportTab = tab;
    document.getElementById('rtab-tasks').className = `flex-1 py-3 text-sm font-bold transition-colors ${tab === 'tasks' ? 'text-primary border-b-2 border-primary' : 'text-muted border-b-2 border-transparent'}`;
    document.getElementById('rtab-leaderboard').className = `flex-1 py-3 text-sm font-bold transition-colors ${tab === 'leaderboard' ? 'text-primary border-b-2 border-primary' : 'text-muted border-b-2 border-transparent'}`;
    document.getElementById('report-content-tasks').style.display = tab === 'tasks' ? 'block' : 'none'; 
    document.getElementById('report-content-leaderboard').style.display = tab === 'leaderboard' ? 'block' : 'none';
}

async function loadReport(timeframe) {
    if (timeframe === 'custom') return toggleCustomDate(); 
    document.getElementById('custom-date-picker').classList.add('hidden'); currentReportTimeframe = timeframe;
    document.querySelectorAll('.report-filter').forEach(el => { el.classList.remove('bg-primary', 'text-main'); el.classList.add('bg-card', 'text-muted'); });
    document.getElementById(`filter-${timeframe}`).classList.remove('bg-card', 'text-muted'); document.getElementById(`filter-${timeframe}`).classList.add('bg-primary', 'text-main');
    
    const now = new Date(); let startDate = new Date(0), endDate = new Date('2099-01-01');
    if (timeframe === 'this_week') { 
        const day = now.getDay(); const diff = now.getDate() - day + (day == 0 ? -6:1); 
        startDate = new Date(now.setDate(diff)); startDate.setHours(0,0,0,0); 
        endDate = new Date(startDate); endDate.setDate(startDate.getDate() + 6); endDate.setHours(23,59,59,999); 
    } 
    else if (timeframe === 'last_week') { 
        const day = now.getDay(); const diff = now.getDate() - day + (day == 0 ? -6:1) - 7; 
        startDate = new Date(now.setDate(diff)); startDate.setHours(0,0,0,0); 
        endDate = new Date(startDate); endDate.setDate(startDate.getDate() + 6); endDate.setHours(23,59,59,999); 
    } 
    else if (timeframe === 'this_month') { 
        startDate = new Date(now.getFullYear(), now.getMonth(), 1); endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59); 
    }
    loadReportData(startDate, endDate);
}

async function loadReportData(startDate, endDate) {
    document.getElementById('report-period').innerText = 'Đang tải...'; showLoading(true);
    
    const { data: users } = await supabaseClient.from('users').select('*'); 
    
    let transQuery = supabaseClient.from('transactions').select('*').gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString());
    let logsQuery = supabaseClient.from('task_logs').select('*').gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString());
    
    if (currentUser.role === 'User') {
        transQuery = transQuery.eq('username', currentUser.username);
        logsQuery = logsQuery.eq('username', currentUser.username);
    }
    
    const { data: trans } = await transQuery;
    const { data: logs } = await logsQuery;
    const { data: tasks } = await supabaseClient.from('tasks').select('*'); 
    
    showLoading(false);
    document.getElementById('report-period').innerText = `${startDate.toLocaleDateString('vi-VN')} - ${endDate.toLocaleDateString('vi-VN')}`; 
    
    currentReportData = { tasks: tasks || [], logs: logs || [], startDate, endDate, users: users || [] };

    const filterSelect = document.getElementById('report-user-filter');
    const existingVal = filterSelect.value;
    filterSelect.innerHTML = '';
    if (currentUser.role === 'User') {
        filterSelect.innerHTML = `<option value="${currentUser.username}">Việc của tôi (${currentUser.name})</option>`;
    } else {
        let html = '<option value="all">Tất cả thành viên</option>';
        (users || []).forEach(u => { html += `<option value="${u.username}">Thành viên: ${u.name}</option>`; });
        filterSelect.innerHTML = html;
        if (existingVal) filterSelect.value = existingVal;
    }
    
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
    
    renderLeaderboard(leaderboard);
    renderTaskReport();
}

function renderTaskReport() {
    const filterUser = document.getElementById('report-user-filter').value;
    const { tasks, logs, startDate, endDate } = currentReportData;
    const actualEndDate = endDate > new Date() ? new Date() : endDate;
    
    const logMap = {};
    logs.forEach(l => {
        if (l.status === 'Approved') logMap[l.task_id + '_' + l.period_id] = l;
    });

    let completedTotal = 0, missedTotal = 0;
    const completedMap = {}; 
    const missedMap = {}; 

    tasks.forEach(t => {
        completedMap[t.id] = { name: t.task_name, icon: t.icon, times: 0, pts: 0 };
        missedMap[t.id] = { name: t.task_name, icon: t.icon, times: 0, pts: 0 };
    });

    for (let d = new Date(startDate); d <= actualEndDate; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay(); const dayOfWeekAdjusted = dayOfWeek === 0 ? 7 : dayOfWeek;
        const weekOfMonth = Math.ceil(d.getDate() / 7); 
        const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; 
        const weekStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-W${weekOfMonth}`; 
        
        tasks.forEach(t => { 
            let isDue = false, pId = ''; 
            if (t.frequency === 'Daily') { isDue = true; pId = dateStr; } 
            else if (t.frequency === 'Weekly' && t.schedule == dayOfWeekAdjusted) { isDue = true; pId = dateStr; } 
            else if (t.frequency === 'Monthly' && t.schedule == weekOfMonth) { isDue = true; pId = weekStr; }
            else if (t.frequency === 'Adhoc' && t.schedule === dateStr) { isDue = true; pId = dateStr; }
            
            if (isDue) { 
                const log = logMap[t.id + '_' + pId];
                if (log) { 
                    if (filterUser === 'all' || log.username === filterUser) {
                        completedTotal++; 
                        completedMap[t.id].times++;
                        completedMap[t.id].pts += t.points;
                    }
                } else { 
                    if (t.penalty > 0) { 
                         missedTotal++; 
                         missedMap[t.id].times++;
                         missedMap[t.id].pts += t.penalty;
                    } 
                } 
            } 
        });
    }

    document.getElementById('stat-completed').innerText = completedTotal;
    document.getElementById('stat-missed-pen').innerText = missedTotal;

    const compContainer = document.getElementById('report-completed-container');
    compContainer.innerHTML = '';
    const completedArr = Object.values(completedMap).filter(x => x.times > 0).sort((a,b) => b.times - a.times);
    if (completedArr.length === 0) {
        compContainer.innerHTML = '<div class="text-center text-muted text-[11px] py-4 bg-input rounded-2xl border border-dashed border-borderline">Chưa có việc nào hoàn thành.</div>';
    } else {
        completedArr.forEach(t => {
            compContainer.innerHTML += `
            <div class="bg-card rounded-2xl p-3 border border-borderline flex items-center justify-between shadow-sm hover:border-success/30 transition-all mb-2">
                <div class="flex items-center gap-3">
                    <div class="w-11 h-11 rounded-[14px] bg-success/10 flex items-center justify-center text-success shadow-inner text-xl"><i class="${t.icon || 'fa-solid fa-check'}"></i></div>
                    <div><div class="font-bold text-main text-sm">${t.name}</div><div class="text-[11px] text-muted">Đã hoàn thành <span class="font-bold text-main">${t.times}</span> lần</div></div>
                </div>
                <div class="text-success font-black text-sm bg-success/10 px-2.5 py-1.5 rounded-lg border border-success/20">+${t.pts}</div>
            </div>`;
        });
    }

    const missContainer = document.getElementById('report-missed-container');
    missContainer.innerHTML = '';
    const missedArr = Object.values(missedMap).filter(x => x.times > 0).sort((a,b) => b.times - a.times);
    if (missedArr.length === 0) {
        missContainer.innerHTML = '<div class="text-center text-success text-[11px] py-4 bg-success/10 rounded-2xl border border-success/20 font-bold shadow-sm">Chưa có việc nào bị lỡ.</div>';
    } else {
        missedArr.forEach(t => {
            missContainer.innerHTML += `
            <div class="bg-card rounded-2xl p-3 border border-borderline flex items-center justify-between shadow-sm hover:border-red-500/30 transition-all mb-2">
                <div class="flex items-center gap-3">
                    <div class="w-11 h-11 rounded-[14px] bg-red-500/10 flex items-center justify-center text-red-500 shadow-inner text-xl"><i class="${t.icon || 'fa-solid fa-xmark'}"></i></div>
                    <div><div class="font-bold text-main text-sm">${t.name}</div><div class="text-[11px] text-muted">Bị lỡ <span class="font-bold text-red-400">${t.times}</span> lần</div></div>
                </div>
                <div class="text-red-500 font-black text-sm bg-red-500/10 px-2.5 py-1.5 rounded-lg border border-red-500/20">-${t.pts}</div>
            </div>`;
        });
    }
}

function renderLeaderboard(data) {
    const container = document.getElementById('report-content-leaderboard'); container.innerHTML = '';
    
    if (currentUser.role === 'User') {
        const myData = data.find(u => u.username === currentUser.username);
        if(!myData) return container.innerHTML = '<div class="text-center text-muted py-4 text-sm">Chưa có dữ liệu.</div>';
        return container.innerHTML = `
        <div class="bg-card border border-primary rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden">
            <div class="absolute inset-0 bg-primary/5 pointer-events-none"></div>
            <div class="flex-1 relative z-10">
                <div class="font-bold text-main text-base">${myData.name} (Tôi)</div>
                <div class="text-xs text-muted mt-1">Hiện có: <span class="text-primary font-bold text-base">${myData.currentPoints}</span> pts</div>
            </div>
            <div class="text-right space-y-1 relative z-10">
                <div class="text-sm font-bold text-success bg-success/10 px-2 py-0.5 rounded"><i class="fa-solid fa-arrow-trend-up mr-1 text-xs"></i>+${myData.earned}</div>
                <div class="text-xs font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded"><i class="fa-solid fa-arrow-trend-down mr-1 text-[10px]"></i>-${myData.penalty}</div>
            </div>
        </div>`;
    }

    if(data.length === 0) return container.innerHTML = '<div class="text-center text-muted py-4 text-sm">Chưa có dữ liệu.</div>';
    data.forEach((user, index) => {
        let rankIcon = `<div class="w-6 h-6 rounded-full bg-surface text-muted flex items-center justify-center text-xs font-bold">${index + 1}</div>`;
        if (index === 0) rankIcon = `<i class="fa-solid fa-crown text-yellow-500 text-2xl drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]"></i>`; 
        else if (index === 1) rankIcon = `<i class="fa-solid fa-medal text-gray-300 text-xl"></i>`; 
        else if (index === 2) rankIcon = `<i class="fa-solid fa-medal text-amber-600 text-xl"></i>`;
        
        container.innerHTML += `
        <div class="bg-card border border-borderline rounded-2xl p-4 flex items-center gap-4 shadow-sm hover:border-primary/30 transition-colors">
            <div class="w-8 flex justify-center">${rankIcon}</div>
            <div class="flex-1">
                <div class="font-bold text-main text-base">${user.name}</div>
                <div class="text-[11px] text-muted">Hiện có: <span class="text-primary font-bold text-sm">${user.currentPoints}</span> pts</div>
            </div>
            <div class="text-right space-y-1">
                <div class="text-xs font-bold text-success"><i class="fa-solid fa-arrow-trend-up mr-1 text-[10px]"></i>+${user.earned}</div>
                <div class="text-[10px] font-bold text-red-400"><i class="fa-solid fa-arrow-trend-down mr-1 text-[10px]"></i>-${user.penalty}</div>
            </div>
        </div>`;
    });
}

// --- ADMIN ---
async function loadAdminData(type) {
    currentAdminType = type; 
    document.querySelectorAll('#view-admin button[id^="admin-tab-"]').forEach(el => { el.classList.remove('bg-surface', 'text-main'); el.classList.add('text-muted'); });
    document.getElementById(`admin-tab-${type}`).classList.add('bg-surface', 'text-main'); 
    document.getElementById(`admin-tab-${type}`).classList.remove('text-muted');
    
    const addBtn = document.getElementById('admin-add-btn');
    const resetBtn = document.getElementById('admin-reset-btn');
    
    if (type === 'users') { resetBtn.classList.remove('hidden'); resetBtn.classList.add('flex'); } 
    else { resetBtn.classList.add('hidden'); resetBtn.classList.remove('flex'); }

    if (type === 'approvals') { 
        addBtn.classList.add('hidden'); addBtn.classList.remove('flex'); 
        loadApprovals(); 
    } else {
        addBtn.classList.remove('hidden'); addBtn.classList.add('flex');
        addBtn.onclick = () => openModal(type); 
        showLoading(true); 
        let data = [];
        if (type === 'users') { const { data: d } = await supabaseClient.from('users').select('*'); data = d; }
        if (type === 'tasks') { const { data: d } = await supabaseClient.from('tasks').select('*'); data = d; }
        if (type === 'rewards') { const { data: d } = await supabaseClient.from('rewards').select('*'); data = d; }
        showLoading(false); renderAdminList(type, data || []);
    }
}

async function loadApprovals() {
    showLoading(true);
    const { data: logs } = await supabaseClient.from('task_logs').select('*, tasks(*), users(name)').eq('status', 'Pending Approval');
    showLoading(false);
    const container = document.getElementById('admin-list-container'); container.innerHTML = '';
    if (!logs || logs.length === 0) return container.innerHTML = '<div class="text-center text-muted py-8 text-sm bg-card border border-borderline rounded-2xl border-dashed">Chẳng có gì để duyệt cả!</div>';
    
    logs.forEach(item => {
        container.innerHTML += `
        <div class="bg-card border border-borderline rounded-2xl p-4 shadow-sm relative overflow-hidden hover:border-primary/50 transition-colors">
            <div class="flex justify-between items-start mb-4">
                <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-xl bg-surface flex items-center justify-center text-primary text-lg shadow-inner"><i class="${item.tasks?.icon || 'fa-solid fa-clipboard-list'}"></i></div>
                    <div>
                        <h4 class="font-bold text-main text-sm max-w-[150px] leading-tight line-clamp-2">${item.tasks?.task_name}</h4>
                        <div class="text-[11px] text-muted mt-1.5 flex items-center gap-1"><i class="fa-solid fa-user-check"></i> <span class="text-main font-bold">${item.users?.name || item.username}</span></div>
                    </div>
                </div>
                <div class="text-success font-black text-sm bg-success/10 px-2 py-1 rounded shadow-sm border border-success/20">+${item.tasks?.points} <i class="fa-solid fa-coins text-yellow-500"></i></div>
            </div>
            <div class="flex gap-2">
                <button onclick="approveTask('${item.id}', false, '${item.username}', ${item.tasks?.points}, '${item.tasks?.task_name}')" class="flex-1 py-3 rounded-xl bg-red-500/10 text-red-500 text-xs font-bold active-scale shadow-sm border border-red-500/20 hover:bg-red-500 hover:text-white transition-colors">Yêu cầu làm lại</button>
                <button onclick="approveTask('${item.id}', true, '${item.username}', ${item.tasks?.points}, '${item.tasks?.task_name}')" class="flex-1 py-3 rounded-xl bg-primary text-white text-xs font-bold active-scale shadow-lg shadow-primary/30 hover:scale-105 transition-transform"><i class="fa-solid fa-check mr-1"></i> Duyệt luôn!</button>
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
    showLoading(false); showToast(isApproved ? 'Đã duyệt cộng điểm!' : 'Đã từ chối!'); loadApprovals();
}

function renderAdminList(type, data) {
    const container = document.getElementById('admin-list-container'); container.innerHTML = '';
    if (data.length === 0) return container.innerHTML = '<div class="text-center text-muted py-8 text-sm">Chưa có dữ liệu</div>';
    
    data.forEach(item => {
        let title = '', subtitle = '', id = item.id, iconHTML = '';
        if (type === 'users') { 
            title = item.name; subtitle = `@${item.username} - ${item.points} pts - ${item.role}`; id = item.username; 
            iconHTML = `<div class="w-10 h-10 rounded-full flex items-center justify-center bg-primary text-white shadow-inner font-bold">${item.name.charAt(0)}</div>`;
        }
        else if (type === 'tasks') { 
            title = item.task_name; subtitle = `${item.frequency}: +${item.points} | -${item.penalty}`; 
            iconHTML = `<div class="w-10 h-10 rounded-xl bg-surface flex items-center justify-center text-primary text-xl border border-borderline"><i class="${item.icon}"></i></div>`;
        }
        else if (type === 'rewards') { 
            title = item.reward_name; subtitle = `Giá: ${item.cost} pts`; 
            iconHTML = `<div class="w-10 h-10 rounded-xl bg-surface flex items-center justify-center text-amber-500 text-xl border border-borderline"><i class="${item.icon || 'fa-solid fa-gift'}"></i></div>`;
        }

        window[`editData_${id}`] = item;
        
        let actionsHtml = `
            <button onclick="openModal('${type}', window['editData_${id}'])" class="w-8 h-8 rounded-lg bg-surface text-main flex items-center justify-center active-scale border border-borderline hover:text-primary"><i class="fa-solid fa-pen text-xs"></i></button>
            <button onclick="deleteData('${type}', '${id}')" class="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center active-scale border border-red-500/20 hover:bg-red-500 hover:text-white transition-colors"><i class="fa-solid fa-trash text-xs"></i></button>
        `;

        if (type === 'users') {
            actionsHtml = `
            <button onclick="openAdjustModal('${item.username}')" class="w-8 h-8 rounded-lg bg-surface text-main flex items-center justify-center active-scale border border-borderline hover:text-yellow-500" title="Chỉnh điểm"><i class="fa-solid fa-coins text-xs"></i></button>
            ${actionsHtml}`;
        }

        container.innerHTML += `
        <div class="bg-card border border-borderline rounded-2xl p-4 flex justify-between items-center shadow-sm hover:border-primary/30 transition-colors">
            <div class="flex gap-3 items-center min-w-0">
                ${iconHTML}
                <div class="min-w-0">
                    <h4 class="font-bold text-main text-sm truncate max-w-[170px]">${title}</h4>
                    <div class="text-[10px] text-muted mt-0.5 truncate max-w-[170px]">${subtitle}</div>
                </div>
            </div>
            <div class="flex gap-2">
                ${actionsHtml}
            </div>
        </div>`;
    });
}


let adminEditId = null;
function openModal(type, editData = null) {
    adminEditId = editData ? (type === 'users' ? editData.username : editData.id) : null;
    const isEdit = !!editData; document.getElementById('modal-title').innerText = isEdit ? 'Cập nhật' : 'Thêm mới';
    
    let html = '';
    if (type === 'users') {
        html = `
        <input type="text" id="inp-uuser" placeholder="Username (viết liền, ko dấu)" value="${isEdit ? editData.username : ''}" ${isEdit ? 'disabled' : ''} class="w-full bg-input border border-borderline rounded-xl px-4 py-3 text-main text-sm mb-3 font-medium outline-none">
        <input type="text" id="inp-upass" placeholder="Mật khẩu" value="${isEdit ? editData.password : ''}" class="w-full bg-input border border-borderline rounded-xl px-4 py-3 text-main text-sm mb-3 font-medium outline-none">
        <input type="text" id="inp-uname" placeholder="Tên hiển thị" value="${isEdit ? editData.name : ''}" class="w-full bg-input border border-borderline rounded-xl px-4 py-3 text-main text-sm mb-3 font-medium outline-none">
        <select id="inp-urole" class="w-full bg-input border border-borderline rounded-xl px-4 py-3 text-main text-sm outline-none font-medium mb-3">
            <option value="User" ${isEdit && editData.role === 'User' ? 'selected' : ''}>Thành viên</option>
            <option value="Admin" ${isEdit && editData.role === 'Admin' ? 'selected' : ''}>Quản trị (Admin)</option>
            <option value="Moderator" ${isEdit && editData.role === 'Moderator' ? 'selected' : ''}>Kiểm duyệt (Reviewer)</option>
        </select>`;
    } else if (type === 'tasks') {
        let optIcons = ''; ICONS.forEach(i => { optIcons += `<option value="${i}" ${isEdit && editData.icon === i ? 'selected' : ''}>${i.split('-').pop()}</option>`; });
        html = `
        <input type="text" id="inp-tname" placeholder="Tên công việc" value="${isEdit ? editData.task_name : ''}" class="w-full bg-input border border-borderline rounded-xl px-4 py-3 text-main text-sm mb-3 font-medium outline-none">
        <div class="flex gap-2 w-full mb-3">
            <input type="number" id="inp-tpts" placeholder="Điểm (+)" value="${isEdit ? editData.points : ''}" class="w-1/2 bg-input border border-borderline rounded-xl px-4 py-3 text-main text-sm font-bold outline-none text-success">
            <input type="number" id="inp-tpen" placeholder="Phạt (-)" value="${isEdit ? editData.penalty : ''}" class="w-1/2 bg-input border border-borderline rounded-xl px-4 py-3 text-main text-sm font-bold outline-none text-red-500">
        </div>
        <select id="inp-ticon" class="w-full bg-input border border-borderline rounded-xl px-4 py-3 text-main text-sm font-medium outline-none mb-3 font-awesome">
            ${optIcons}
        </select>
        <select id="inp-tfreq" onchange="handleFreqChange()" class="w-full bg-input border border-borderline rounded-xl px-4 py-3 text-main text-sm font-medium outline-none mb-3">
            <option value="Daily" ${isEdit && editData.frequency === 'Daily' ? 'selected' : ''}>Hàng ngày</option>
            <option value="Weekly" ${isEdit && editData.frequency === 'Weekly' ? 'selected' : ''}>Hàng tuần</option>
            <option value="Adhoc" ${isEdit && editData.frequency === 'Adhoc' ? 'selected' : ''}>Sự vụ (Theo ngày)</option>
        </select>
        <div id="sched-container" class="w-full"></div>`;
    } else if (type === 'rewards') {
        let optIcons = ''; ICONS.forEach(i => { optIcons += `<option value="${i}" ${isEdit && editData.icon === i ? 'selected' : ''}>${i.split('-').pop()}</option>`; });
        html = `
        <input type="text" id="inp-rname" placeholder="Tên phần thưởng" value="${isEdit ? editData.reward_name : ''}" class="w-full bg-input border border-borderline rounded-xl px-4 py-3 text-main text-sm mb-3 font-medium outline-none">
        <input type="number" id="inp-rcost" placeholder="Giá (Điểm xu)" value="${isEdit ? editData.cost : ''}" class="w-full bg-input border border-borderline rounded-xl px-4 py-3 text-main text-sm mb-3 font-bold outline-none text-yellow-500">
        <select id="inp-ricon" class="w-full bg-input border border-borderline rounded-xl px-4 py-3 text-main text-sm font-medium outline-none mb-3 font-awesome">
            ${optIcons}
        </select>`;
    }
    
    document.getElementById('modal-body').innerHTML = html;
    document.getElementById('admin-modal').classList.remove('hidden'); document.getElementById('admin-modal').classList.add('flex');
    
    document.getElementById('modal-save-btn').onclick = () => saveData(type);
    if (type === 'tasks') { 
        handleFreqChange(); 
        if(isEdit) {
            const schedEl = document.getElementById('inp-tsched');
            if (schedEl) schedEl.value = editData.schedule;
        }
    }
}

function handleFreqChange() {
    const freq = document.getElementById('inp-tfreq').value;
    const schedContainer = document.getElementById('sched-container');
    if (freq === 'Daily') { schedContainer.innerHTML = ''; } 
    else if (freq === 'Weekly') {
        schedContainer.innerHTML = `
            <select id="inp-tsched" class="w-full bg-input border border-borderline rounded-xl px-4 py-3 text-main font-medium text-sm outline-none mb-3">
                <option value="1">Thứ 2</option><option value="2">Thứ 3</option><option value="3">Thứ 4</option><option value="4">Thứ 5</option>
                <option value="5">Thứ 6</option><option value="6">Thứ 7</option><option value="7">Chủ nhật</option>
            </select>`;
    } else if (freq === 'Adhoc') {
        schedContainer.innerHTML = `<input type="date" id="inp-tsched" class="w-full bg-input border border-borderline rounded-xl px-4 py-3 text-main text-sm font-medium outline-none mb-3">`;
    }
}

function closeModal() { document.getElementById('admin-modal').classList.add('hidden'); document.getElementById('admin-modal').classList.remove('flex'); }

async function saveData(type) {
    showLoading(true); let payload = {}, error;
    if (type === 'users') {
        payload = { username: document.getElementById('inp-uuser').value, password: document.getElementById('inp-upass').value, name: document.getElementById('inp-uname').value, role: document.getElementById('inp-urole').value };
        if (!adminEditId) payload.points = 0;
        if (adminEditId) { const { error: e } = await supabaseClient.from('users').update(payload).eq('username', adminEditId); error = e; } 
        else { const { error: e } = await supabaseClient.from('users').insert([payload]); error = e; }
    } else if (type === 'tasks') {
        const schedEl = document.getElementById('inp-tsched');
        payload = { task_name: document.getElementById('inp-tname').value, points: document.getElementById('inp-tpts').value || 0, penalty: document.getElementById('inp-tpen').value || 0, frequency: document.getElementById('inp-tfreq').value, schedule: schedEl ? schedEl.value : null, icon: document.getElementById('inp-ticon').value };
        if (adminEditId) { const { error: e } = await supabaseClient.from('tasks').update(payload).eq('id', adminEditId); error = e; } 
        else { const { error: e } = await supabaseClient.from('tasks').insert([payload]); error = e; }
    } else if (type === 'rewards') {
        payload = { reward_name: document.getElementById('inp-rname').value, cost: document.getElementById('inp-rcost').value || 0, icon: document.getElementById('inp-ricon').value };
        if (adminEditId) { const { error: e } = await supabaseClient.from('rewards').update(payload).eq('id', adminEditId); error = e; } 
        else { const { error: e } = await supabaseClient.from('rewards').insert([payload]); error = e; }
    }
    
    showLoading(false);
    if (error) showToast('Lỗi lưu Data!', 'error'); else { showToast('Lưu thành công!'); closeModal(); loadAdminData(type); }
}

async function deleteData(type, id) {
    if(!confirm('Chắc chắn muốn xoá luôn? KHÔNG THỂ CHUYỂN HOÀN ĐÂY NHÉ!')) return;
    showLoading(true);
    let error;
    if (type === 'users') { const { error: e } = await supabaseClient.from('users').delete().eq('username', id); error = e; } 
    else if (type === 'tasks') { const { error: e } = await supabaseClient.from('tasks').delete().eq('id', id); error = e; } 
    else if (type === 'rewards') { const { error: e } = await supabaseClient.from('rewards').delete().eq('id', id); error = e; }
    showLoading(false);
    if (error) showToast('Lỗi xoá Data!', 'error'); else { showToast('Đã bay màu luôn rùi!'); loadAdminData(type); }
}

async function resetAllPoints() {
    if(!confirm('⛔ CẢNH BÁO ĐỎ ⛔\nBạn sắp đưa điểm toàn bộ thành viên về Số 0 Tròn Trĩnh! Chắc chứ?')) return;
    showLoading(true);
    const { error } = await supabaseClient.rpc('reset_all_points');
    showLoading(false);
    if (error) {
        showToast('Có lỗi rồi, hãy tự cập nhật ở CSDL nếu cần!', 'error');
    } else {
        showToast('BÙM! Điểm mọi người đã về KHÔNG.', 'success');
        refreshUserPoints();
        loadAdminData('users');
    }
}

let currAdjUser = null;
function openAdjustModal(username) {
    currAdjUser = username;
    document.getElementById('adj-username').innerText = username;
    document.getElementById('adj-amount').value = '';
    document.getElementById('adj-reason').value = '';
    document.getElementById('adjust-modal').classList.remove('hidden'); document.getElementById('adjust-modal').classList.add('flex');
}

function closeAdjustModal() {
    document.getElementById('adjust-modal').classList.add('hidden'); document.getElementById('adjust-modal').classList.remove('flex');
}

async function saveAdjustPoints() {
    const amount = Number(document.getElementById('adj-amount').value);
    const type = document.getElementById('adj-type').value; 
    const reason = document.getElementById('adj-reason').value.trim();

    if (!amount || amount <= 0) return showToast('Nhập số lớn hơn 0!', 'error');
    if (!reason) return showToast('Bắt buộc nhập lý do!', 'error');

    showLoading(true);
    const { data: uData } = await supabaseClient.from('users').select('points').eq('username', currAdjUser).single();
    if (!uData) { showLoading(false); return showToast('Không tìm thấy User', 'error'); }

    let newPts = uData.points;
    const transType = type === 'add' ? 'Earn' : 'Penalty';
    
    if (type === 'add') { newPts += amount; } else { newPts -= amount; }

    const { error: updErr } = await supabaseClient.from('users').update({ points: newPts }).eq('username', currAdjUser);
    if (updErr) { showLoading(false); return showToast('Lỗi Update điểm!', 'error'); }

    await supabaseClient.from('transactions').insert([{ 
        username: currAdjUser, 
        type: transType, 
        amount: amount, 
        description: `Admin điều chỉnh: ${reason}` 
    }]);

    showLoading(false);
    showToast('Chốt điểm thành công!');
    closeAdjustModal();
    if(currentUser.username === currAdjUser) refreshUserPoints();
    loadAdminData('users');
}


function openThemeModal() {
    const container = document.getElementById('theme-options-container'); container.innerHTML = '';
    const themes = [
        { id: 'dark', name: 'Dark Mode', primary: '#3B82F6', icon: 'fa-moon' }, { id: 'light', name: 'Light Mode', primary: '#8B5CF6', icon: 'fa-sun' },
        { id: 'sakura', name: 'Màu Hường', primary: '#F43F5E', icon: 'fa-heart' }, { id: 'matcha', name: 'Matcha Trà Xanh', primary: '#10B981', icon: 'fa-leaf' },
        { id: 'cyberpunk', name: 'Hi-Tech', primary: '#EAB308', icon: 'fa-bolt' }
    ];
    
    const currTheme = localStorage.getItem('housework_theme') || 'dark';
    
    themes.forEach(t => {
        const isSelected = currTheme === t.id;
        container.innerHTML += `
        <div onclick="setAppTheme('${t.id}')" class="flex items-center justify-between p-4 rounded-xl border ${isSelected ? 'border-primary bg-primary/10' : 'border-borderline bg-input'} cursor-pointer active-scale mb-2 transition-all">
            <div class="flex items-center gap-4">
                <div class="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-md" style="background-color: ${t.primary};"><i class="fa-solid ${t.icon}"></i></div>
                <div class="font-bold text-main">${t.name}</div>
            </div>
            ${isSelected ? '<i class="fa-solid fa-circle-check text-primary text-xl"></i>' : ''}
        </div>`;
    });

    document.getElementById('theme-modal').classList.remove('hidden'); document.getElementById('theme-modal').classList.add('flex');
}

function closeThemeModal() { document.getElementById('theme-modal').classList.add('hidden'); document.getElementById('theme-modal').classList.remove('flex'); }

function setAppTheme(themeId) {
    if (themeId === 'dark') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', themeId);
    localStorage.setItem('housework_theme', themeId); openThemeModal();
}

const savedTheme = localStorage.getItem('housework_theme');
if (savedTheme && savedTheme !== 'dark') document.documentElement.setAttribute('data-theme', savedTheme);

window.onload = checkLoginStatus;