// --- CẤU HÌNH SUPABASE ---
const SUPABASE_URL = 'https://akgrmxazfgwbnpqupmor.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_L6pJkJPwbOoEDDbNXhL_PQ_oq2nm-rC';

if (!window.supabase) {
  alert("Không thể tải thư viện Supabase. Vui lòng kiểm tra kết nối mạng hoặc tắt trình chặn quảng cáo (Adblock).");
}
const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

let currentUser = null;
let currentAdminType = 'approvals';
let currentReportTimeframe = 'this_week';
let currentReportTab = 'tasks';

// --- TIỆN ÍCH UI ---
function showLoading(show) { document.getElementById('loading-overlay').style.display = show ? 'flex' : 'none'; }
function showToast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white flex items-center gap-2 ${type === 'success' ? 'bg-success' : 'bg-red-500'}`;
  toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i> ${msg}`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

// --- ĐĂNG NHẬP ---
function checkLoginStatus() {
  const savedUser = localStorage.getItem('housework_user');
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    document.getElementById('login-screen').style.display = 'none';
    initApp();
  } else {
    document.getElementById('login-screen').style.display = 'flex';
  }
}

async function handleLogin() {
  if (!supabase) return showToast('Lỗi kết nối máy chủ Supabase!', 'error');
  
  const userInp = document.getElementById('login-username').value.trim().toLowerCase();
  const passInp = document.getElementById('login-password').value.trim();
  if (!userInp || !passInp) return showToast('Vui lòng nhập đủ thông tin!', 'error');

  showLoading(true);
  try {
    const { data, error } = await supabase.from('users').select('*').eq('username', userInp).eq('password', passInp);
    showLoading(false);

    if (error || !data || data.length === 0) {
      console.error("Lỗi đăng nhập:", error);
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
    console.error(err);
    showToast('Có lỗi xảy ra khi đăng nhập!', 'error');
  }
}

function handleLogout() {
  localStorage.removeItem('housework_user');
  currentUser = null;
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('login-screen').style.display = 'flex';
}

function initApp() {
  document.getElementById('user-name').innerText = currentUser.name;
  document.getElementById('user-role').innerText = currentUser.role || 'User';
  document.getElementById('user-points').innerText = currentUser.points;
  document.getElementById('user-avatar').innerText = currentUser.name.charAt(0).toUpperCase();

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

// --- TRANG CHỦ ---
async function loadHomeData() {
  showLoading(true);
  
  // Lấy Tasks
  const { data: tasksData } = await supabase.from('tasks').select('*');
  const { data: logsData } = await supabase.from('task_logs').select('*, users(name)').neq('status', 'Rejected');
  
  const today = new Date(); const dayOfWeek = today.getDay(); const weekOfMonth = Math.ceil(today.getDate() / 7);
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const weekStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-W${weekOfMonth}`;
  
  const tasks = [];
  if (tasksData) {
    tasksData.forEach(t => {
      let isDueToday = false, periodId = '';
      if (t.frequency === 'Daily') { isDueToday = true; periodId = todayStr; }
      else if (t.frequency === 'Weekly' && t.schedule === dayOfWeek) { isDueToday = true; periodId = todayStr; }
      else if (t.frequency === 'Monthly' && t.schedule === weekOfMonth) { isDueToday = true; periodId = weekStr; }
      
      if (isDueToday) {
        let logStatus = 'Not Done', completedBy = '', completedByName = '';
        if (logsData) {
          const log = logsData.find(l => l.task_id === t.id && l.period_id === periodId);
          if (log) {
            logStatus = log.status; completedBy = log.username; completedByName = log.users?.name || log.username;
          }
        }
        tasks.push({ id: t.id, name: t.task_name, points: t.points, penalty: t.penalty, status: logStatus, completedByName, periodId });
      }
    });
  }

  // Lấy Rewards
  const { data: rewardsData } = await supabase.from('rewards').select('*');
  
  showLoading(false);
  renderTasks(tasks);
  renderRewards(rewardsData || []);
}

function renderTasks(tasks) {
  const container = document.getElementById('home-tasks-container');
  const reminderBox = document.getElementById('reminder-box');
  container.innerHTML = '';
  
  if (tasks.length === 0) {
    container.innerHTML = '<div class="text-center text-muted py-8 text-sm">Hôm nay không có việc gì! 🎉</div>';
    reminderBox.classList.add('hidden');
    return;
  }

  let hasPendingTask = false;
  tasks.forEach(t => {
    if (t.status === 'Not Done') hasPendingTask = true;
    let statusHtml = ''; let actionHtml = '';

    if (t.status === 'Not Done') {
      actionHtml = `<button onclick="submitTask('${t.id}', '${t.periodId}')" class="w-full mt-3 py-2 rounded-xl bg-[#2D323E] text-white text-xs font-bold active-scale hover:bg-[#3E4451] transition-colors">Đã làm xong</button>`;
    } else if (t.status === 'Pending Approval') {
      statusHtml = `<span class="badge-pending"><i class="fa-solid fa-clock mr-1"></i>Chờ duyệt</span>`;
      actionHtml = `<div class="mt-3 text-[11px] text-muted text-center">Người làm: <span class="text-white font-medium">${t.completedByName}</span></div>`;
    } else if (t.status === 'Approved') {
      statusHtml = `<span class="badge-approved"><i class="fa-solid fa-check mr-1"></i>Hoàn thành</span>`;
      actionHtml = `<div class="mt-3 text-[11px] text-muted text-center">Người làm: <span class="text-success font-medium">${t.completedByName}</span></div>`;
    }

    container.innerHTML += `
      <div class="bg-card border border-borderline rounded-2xl p-4 shadow-sm">
        <div class="flex justify-between items-start mb-1">
          <h3 class="font-bold text-white text-sm">${t.name}</h3>
          ${statusHtml}
        </div>
        <div class="flex items-center gap-3 text-xs text-muted">
          <span class="flex items-center gap-1"><i class="fa-solid fa-coins text-yellow-500"></i> +${t.points}</span>
          <span class="flex items-center gap-1 text-red-400"><i class="fa-solid fa-arrow-trend-down"></i> -${t.penalty}</span>
        </div>
        ${actionHtml}
      </div>
    `;
  });

  if (hasPendingTask) reminderBox.classList.remove('hidden');
  else reminderBox.classList.add('hidden');
}

async function submitTask(taskId, periodId) {
  showLoading(true);
  // Kiểm tra xem đã có ai làm chưa
  const { data: existing } = await supabase.from('task_logs').select('id').eq('task_id', taskId).eq('period_id', periodId).neq('status', 'Rejected');
  if (existing && existing.length > 0) {
    showLoading(false);
    return showToast('Việc này đã có người làm!', 'error');
  }

  const { error } = await supabase.from('task_logs').insert([{ task_id: taskId, period_id: periodId, username: currentUser.username, status: 'Pending Approval' }]);
  showLoading(false);
  
  if (error) showToast('Lỗi: ' + error.message, 'error');
  else { showToast('Đã gửi yêu cầu phê duyệt!'); loadHomeData(); }
}

function renderRewards(rewards) {
  const container = document.getElementById('home-rewards-container');
  container.innerHTML = '';
  rewards.forEach(r => {
    const canAfford = currentUser.points >= r.cost;
    container.innerHTML += `
      <div class="bg-card border border-borderline rounded-2xl p-4 flex flex-col items-center text-center shadow-sm">
        <div class="w-12 h-12 rounded-full bg-[#2D323E] flex items-center justify-center mb-3"><i class="fa-solid fa-gift text-secondary text-xl"></i></div>
        <h3 class="font-bold text-white text-sm mb-1 line-clamp-1">${r.reward_name}</h3>
        <div class="text-primary font-bold text-xs mb-3">${r.cost} pts</div>
        <button onclick="redeemReward('${r.id}', ${r.cost}, '${r.reward_name}')" class="w-full py-2 rounded-xl text-xs font-bold active-scale transition-colors ${canAfford ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-[#2D323E] text-muted opacity-50 cursor-not-allowed'}" ${!canAfford ? 'disabled' : ''}>Đổi quà</button>
      </div>
    `;
  });
}

async function redeemReward(rewardId, cost, name) {
  if(!confirm('Bạn chắc chắn muốn đổi quà này?')) return;
  if (currentUser.points < cost) return showToast('Không đủ điểm!', 'error');

  showLoading(true);
  const newPoints = currentUser.points - cost;
  
  // Cập nhật điểm
  const { error: err1 } = await supabase.from('users').update({ points: newPoints }).eq('username', currentUser.username);
  if (err1) { showLoading(false); return showToast('Lỗi: ' + err1.message, 'error'); }

  // Ghi log giao dịch
  await supabase.from('transactions').insert([{ username: currentUser.username, type: 'Spend', amount: cost, description: `Đổi quà: ${name}` }]);
  
  currentUser.points = newPoints;
  localStorage.setItem('housework_user', JSON.stringify(currentUser));
  document.getElementById('user-points').innerText = currentUser.points;
  
  showLoading(false);
  showToast(`Đổi thành công ${name}!`);
  loadHomeData();
}

// --- BÁO CÁO NÂNG CAO ---
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
  if(!start || !end) return showToast('Vui lòng chọn đủ ngày!', 'error');
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
    const day = now.getDay(); const diff = now.getDate() - day + (day == 0 ? -6:1);
    startDate = new Date(now.setDate(diff)); startDate.setHours(0,0,0,0);
    endDate = new Date(startDate); endDate.setDate(startDate.getDate() + 6); endDate.setHours(23,59,59,999);
  } else if (timeframe === 'last_week') {
    const day = now.getDay(); const diff = now.getDate() - day + (day == 0 ? -6:1) - 7;
    startDate = new Date(now.setDate(diff)); startDate.setHours(0,0,0,0);
    endDate = new Date(startDate); endDate.setDate(startDate.getDate() + 6); endDate.setHours(23,59,59,999);
  } else if (timeframe === 'this_month') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  }
  
  loadReportData(startDate, endDate);
}

async function loadReportData(startDate, endDate) {
  document.getElementById('report-period').innerText = 'Đang tải dữ liệu...';
  showLoading(true);

  const { data: users } = await supabase.from('users').select('*');
  const { data: trans } = await supabase.from('transactions').select('*').gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString());
  const { data: tasks } = await supabase.from('tasks').select('*');
  const { data: logs } = await supabase.from('task_logs').select('*');

  showLoading(false);

  // Tính Leaderboard
  const reportData = {};
  users.forEach(u => reportData[u.username] = { name: u.name, earned: 0, spent: 0, penalty: 0, currentPoints: u.points });
  
  if (trans) {
    trans.forEach(t => {
      if (reportData[t.username]) {
        if (t.type === 'Earn') reportData[t.username].earned += t.amount;
        if (t.type === 'Spend') reportData[t.username].spent += t.amount;
        if (t.type === 'Penalty') reportData[t.username].penalty += t.amount;
      }
    });
  }
  const leaderboard = Object.keys(reportData).map(k => ({ username: k, ...reportData[k] })).sort((a, b) => b.earned - a.earned);

  // Tính Task Stats
  const logMap = {}; 
  if (logs) logs.forEach(l => { if (l.status !== 'Rejected') logMap[l.task_id + '_' + l.period_id] = true; });

  let totalTasks = 0, completedTasks = 0, missedTasks = 0;
  const taskBreakdown = {};
  if (tasks) tasks.forEach(t => taskBreakdown[t.id] = { name: t.task_name, completed: 0, missed: 0 });

  const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);
  const actualEndDate = endDate > todayEnd ? todayEnd : endDate;
  const uniqueWeeks = new Set();

  for (let d = new Date(startDate); d <= actualEndDate; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    const weekOfMonth = Math.ceil(d.getDate() / 7);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const weekStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-W${weekOfMonth}`;
    uniqueWeeks.add(weekStr);

    if (tasks) tasks.forEach(t => {
      let isDue = false, pId = '';
      if (t.frequency === 'Daily') { isDue = true; pId = dateStr; }
      else if (t.frequency === 'Weekly' && t.schedule === dayOfWeek) { isDue = true; pId = dateStr; }
      
      if (isDue) {
        totalTasks++;
        if (logMap[t.id + '_' + pId]) { completedTasks++; taskBreakdown[t.id].completed++; } 
        else { missedTasks++; taskBreakdown[t.id].missed++; }
      }
    });
  }

  uniqueWeeks.forEach(weekStr => {
    const wNum = Number(weekStr.split('-W')[1]);
    if (tasks) tasks.forEach(t => {
      if (t.frequency === 'Monthly' && t.schedule === wNum) {
        totalTasks++;
        if (logMap[t.id + '_' + weekStr]) { completedTasks++; taskBreakdown[t.id].completed++; } 
        else { missedTasks++; taskBreakdown[t.id].missed++; }
      }
    });
  });

  const taskStats = {
    completed: completedTasks, missed: missedTasks,
    breakdown: Object.values(taskBreakdown).filter(t => t.completed > 0 || t.missed > 0)
  };

  document.getElementById('report-period').innerText = `Thời gian: ${startDate.toLocaleDateString('vi-VN')} - ${endDate.toLocaleDateString('vi-VN')}`;
  renderLeaderboard(leaderboard);
  renderTaskStats(taskStats);
}

function renderTaskStats(taskStats) {
  document.getElementById('stat-completed').innerText = taskStats.completed;
  document.getElementById('stat-missed').innerText = taskStats.missed;

  const container = document.getElementById('stat-breakdown');
  container.innerHTML = '';
  if(taskStats.breakdown.length === 0) {
    container.innerHTML = '<div class="text-center text-muted text-xs py-4">Không có công việc nào trong thời gian này.</div>';
    return;
  }

  taskStats.breakdown.sort((a,b) => (b.completed + b.missed) - (a.completed + a.missed)).forEach(t => {
    const total = t.completed + t.missed;
    const percent = total === 0 ? 0 : Math.round((t.completed / total) * 100);
    container.innerHTML += `
      <div class="bg-[#16181D] rounded-xl p-3 border border-borderline">
        <div class="flex justify-between items-center mb-2">
          <span class="text-sm font-bold text-white">${t.name}</span>
          <span class="text-xs text-muted">${percent}% hoàn thành</span>
        </div>
        <div class="w-full bg-[#2D323E] rounded-full h-1.5 mb-2">
          <div class="bg-primary h-1.5 rounded-full" style="width: ${percent}%"></div>
        </div>
        <div class="flex justify-between text-[10px]">
          <span class="text-success"><i class="fa-solid fa-check mr-1"></i>${t.completed} lần xong</span>
          <span class="text-red-400"><i class="fa-solid fa-xmark mr-1"></i>${t.missed} lần bỏ lỡ</span>
        </div>
      </div>
    `;
  });
}

function renderLeaderboard(data) {
  const container = document.getElementById('report-content-leaderboard');
  container.innerHTML = '';
  if(data.length === 0) return container.innerHTML = '<div class="text-center text-muted py-4 text-sm">Chưa có dữ liệu.</div>';

  data.forEach((user, index) => {
    let rankIcon = `<div class="w-6 h-6 rounded-full bg-[#2D323E] text-muted flex items-center justify-center text-xs font-bold">${index + 1}</div>`;
    if (index === 0) rankIcon = `<i class="fa-solid fa-crown text-yellow-400 text-xl"></i>`;
    else if (index === 1) rankIcon = `<i class="fa-solid fa-medal text-gray-300 text-xl"></i>`;
    else if (index === 2) rankIcon = `<i class="fa-solid fa-medal text-amber-600 text-xl"></i>`;

    container.innerHTML += `
      <div class="bg-card border border-borderline rounded-2xl p-4 flex items-center gap-4">
        <div class="w-8 flex justify-center">${rankIcon}</div>
        <div class="flex-1">
          <div class="font-bold text-white text-sm">${user.name}</div>
          <div class="text-[11px] text-muted">Hiện có: <span class="text-primary font-bold">${user.currentPoints}</span> pts</div>
        </div>
        <div class="text-right space-y-1">
          <div class="text-xs text-success font-medium"><i class="fa-solid fa-arrow-trend-up mr-1"></i>+${user.earned}</div>
          <div class="text-[10px] text-red-400"><i class="fa-solid fa-arrow-trend-down mr-1"></i>-${user.penalty}</div>
        </div>
      </div>
    `;
  });
}

// --- ADMIN & MODERATOR ---
async function loadAdminData(type) {
  currentAdminType = type;
  document.querySelectorAll('#view-admin button[id^="admin-tab-"]').forEach(el => {
    el.classList.remove('bg-[#2D323E]', 'text-white'); el.classList.add('text-muted');
  });
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
      const res = await supabase.from('users').select('*');
      data = res.data || [];
      if (currentUser.role === 'Moderator') data = data.filter(u => u.role === 'User');
    } else if (type === 'tasks') {
      const res = await supabase.from('tasks').select('*');
      data = res.data || [];
    } else if (type === 'rewards') {
      const res = await supabase.from('rewards').select('*');
      data = res.data || [];
    }
    
    showLoading(false);
    renderAdminList(type, data);
  }
}

async function loadApprovals() {
  showLoading(true);
  const { data, error } = await supabase.from('task_logs').select('*, tasks(task_name, points), users(name)').eq('status', 'Pending Approval');
  showLoading(false);
  
  const container = document.getElementById('admin-list-container');
  container.innerHTML = '';
  
  if (error) return showToast(error.message, 'error');
  if (!data || data.length === 0) return container.innerHTML = '<div class="text-center text-muted py-8 text-sm">Không có việc nào chờ duyệt.</div>';
  
  data.forEach(item => {
    container.innerHTML += `
      <div class="bg-card border border-borderline rounded-2xl p-4">
        <div class="flex justify-between items-start mb-2">
          <div><h4 class="font-bold text-white text-sm">${item.tasks?.task_name}</h4><div class="text-xs text-muted mt-1">Người làm: <span class="text-white">${item.users?.name || item.username}</span></div></div>
          <div class="text-primary font-bold text-sm">+${item.tasks?.points}</div>
        </div>
        <div class="flex gap-2 mt-4">
          <button onclick="approveTask('${item.id}', false, '${item.username}', ${item.tasks?.points}, '${item.tasks?.task_name}')" class="flex-1 py-2 rounded-xl bg-red-500/10 text-red-500 text-xs font-bold active-scale">Từ chối</button>
          <button onclick="approveTask('${item.id}', true, '${item.username}', ${item.tasks?.points}, '${item.tasks?.task_name}')" class="flex-1 py-2 rounded-xl bg-success/10 text-success text-xs font-bold active-scale">Duyệt</button>
        </div>
      </div>
    `;
  });
}

async function approveTask(logId, isApproved, username, points, taskName) {
  showLoading(true);
  
  const status = isApproved ? 'Approved' : 'Rejected';
  await supabase.from('task_logs').update({ status: status, approved_by: currentUser.username }).eq('id', logId);
  
  if (isApproved) {
    // Lấy điểm hiện tại
    const { data: uData } = await supabase.from('users').select('points').eq('username', username).single();
    if (uData) {
      await supabase.from('users').update({ points: uData.points + points }).eq('username', username);
      await supabase.from('transactions').insert([{ username: username, type: 'Earn', amount: points, description: `Được duyệt: ${taskName}` }]);
    }
  }
  
  showLoading(false);
  showToast(isApproved ? 'Đã duyệt và cộng điểm!' : 'Đã từ chối.');
  loadApprovals();
}

function renderAdminList(type, data) {
  const container = document.getElementById('admin-list-container');
  container.innerHTML = '';
  if (data.length === 0) return container.innerHTML = '<div class="text-center text-muted py-8 text-sm">Chưa có dữ liệu.</div>';
  
  data.forEach(item => {
    let title = '', subtitle = '', id = '';
    if (type === 'users') { id = item.username; title = item.name; subtitle = `${item.username} - ${item.role} - ${item.points} pts`; }
    else if (type === 'tasks') { id = item.id; title = item.task_name; subtitle = `${item.frequency} - +${item.points} / -${item.penalty}`; }
    else if (type === 'rewards') { id = item.id; title = item.reward_name; subtitle = `${item.cost} pts`; }
    
    container.innerHTML += `
      <div class="bg-card border border-borderline rounded-2xl p-4 flex justify-between items-center">
        <div><h4 class="font-bold text-white text-sm">${title}</h4><div class="text-xs text-muted mt-1">${subtitle}</div></div>
        <div class="flex gap-2">
          <button onclick='openModal("${type}", ${JSON.stringify(item).replace(/'/g, "&#39;")})' class="w-8 h-8 rounded-lg bg-[#2D323E] text-white flex items-center justify-center active-scale"><i class="fa-solid fa-pen text-xs"></i></button>
          <button onclick="deleteData('${type}', '${id}')" class="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center active-scale"><i class="fa-solid fa-trash text-xs"></i></button>
        </div>
      </div>
    `;
  });
}

// --- MODAL CRUD ---
function openModal(type, item = null) {
  const modal = document.getElementById('admin-modal');
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');
  const saveBtn = document.getElementById('modal-save-btn');
  
  title.innerText = item ? 'Chỉnh sửa' : 'Thêm mới';
  body.innerHTML = '';
  
  if (type === 'users') {
    let roleSelect = '';
    if (currentUser.role === 'Admin') {
      roleSelect = `
        <select id="inp-role" class="w-full bg-[#16181D] border border-borderline rounded-xl px-4 py-3 text-white text-sm outline-none mb-3">
          <option value="User" ${item && item.role === 'User' ? 'selected' : ''}>User (Thành viên)</option>
          <option value="Moderator" ${item && item.role === 'Moderator' ? 'selected' : ''}>Moderator (Quản trị viên)</option>
          <option value="Admin" ${item && item.role === 'Admin' ? 'selected' : ''}>Admin (Chủ nhà)</option>
        </select>
      `;
    } else {
      roleSelect = `<select id="inp-role" class="w-full bg-[#16181D] border border-borderline rounded-xl px-4 py-3 text-white text-sm outline-none mb-3"><option value="User" selected>User (Thành viên)</option></select>`;
    }

    body.innerHTML = `
      <input id="inp-username" type="text" placeholder="Tên đăng nhập (VD: bi)" class="w-full bg-[#16181D] border border-borderline rounded-xl px-4 py-3 text-white text-sm outline-none mb-3" value="${item ? item.username : ''}" ${item ? 'disabled' : ''}>
      <input id="inp-name" type="text" placeholder="Tên hiển thị (VD: Bé Bi)" class="w-full bg-[#16181D] border border-borderline rounded-xl px-4 py-3 text-white text-sm outline-none mb-3" value="${item ? item.name : ''}">
      <input id="inp-points" type="number" placeholder="Điểm hiện tại" class="w-full bg-[#16181D] border border-borderline rounded-xl px-4 py-3 text-white text-sm outline-none mb-3" value="${item ? item.points : '0'}">
      ${roleSelect}
      <input id="inp-password" type="text" placeholder="Mật khẩu" class="w-full bg-[#16181D] border border-borderline rounded-xl px-4 py-3 text-white text-sm outline-none" value="${item ? item.password : ''}">
    `;
  } else if (type === 'tasks') {
    body.innerHTML = `
      <input id="inp-tname" type="text" placeholder="Tên công việc" class="w-full bg-[#16181D] border border-borderline rounded-xl px-4 py-3 text-white text-sm outline-none mb-3" value="${item ? item.task_name : ''}">
      <select id="inp-tfreq" class="w-full bg-[#16181D] border border-borderline rounded-xl px-4 py-3 text-white text-sm outline-none mb-3">
        <option value="Daily" ${item && item.frequency === 'Daily' ? 'selected' : ''}>Hàng ngày</option>
        <option value="Weekly" ${item && item.frequency === 'Weekly' ? 'selected' : ''}>Hàng tuần</option>
        <option value="Monthly" ${item && item.frequency === 'Monthly' ? 'selected' : ''}>Hàng tháng</option>
      </select>
      <input id="inp-tsched" type="number" placeholder="Lịch (Thứ 0-6 hoặc Tuần 1-4)" class="w-full bg-[#16181D] border border-borderline rounded-xl px-4 py-3 text-white text-sm outline-none mb-3" value="${item ? item.schedule : ''}">
      <input id="inp-tpoints" type="number" placeholder="Điểm thưởng" class="w-full bg-[#16181D] border border-borderline rounded-xl px-4 py-3 text-white text-sm outline-none mb-3" value="${item ? item.points : ''}">
      <input id="inp-tpenalty" type="number" placeholder="Điểm phạt" class="w-full bg-[#16181D] border border-borderline rounded-xl px-4 py-3 text-white text-sm outline-none" value="${item ? item.penalty : ''}">
    `;
  } else if (type === 'rewards') {
    body.innerHTML = `
      <input id="inp-rname" type="text" placeholder="Tên phần thưởng" class="w-full bg-[#16181D] border border-borderline rounded-xl px-4 py-3 text-white text-sm outline-none mb-3" value="${item ? item.reward_name : ''}">
      <input id="inp-rcost" type="number" placeholder="Giá (Điểm)" class="w-full bg-[#16181D] border border-borderline rounded-xl px-4 py-3 text-white text-sm outline-none" value="${item ? item.cost : ''}">
    `;
  }
  
  modal.classList.remove('hidden');
  saveBtn.onclick = () => saveData(type, item ? (type==='users' ? item.username : item.id) : null);
}

function closeModal() { document.getElementById('admin-modal').classList.add('hidden'); }

async function saveData(type, id) {
  showLoading(true);
  let error = null;

  if (type === 'users') {
    const data = { username: document.getElementById('inp-username').value.toLowerCase(), name: document.getElementById('inp-name').value, points: document.getElementById('inp-points').value, role: document.getElementById('inp-role').value, password: document.getElementById('inp-password').value };
    if (id) { const res = await supabase.from('users').update(data).eq('username', id); error = res.error; } 
    else { const res = await supabase.from('users').insert([data]); error = res.error; }
  } else if (type === 'tasks') {
    const data = { task_name: document.getElementById('inp-tname').value, frequency: document.getElementById('inp-tfreq').value, schedule: document.getElementById('inp-tsched').value || null, points: document.getElementById('inp-tpoints').value, penalty: document.getElementById('inp-tpenalty').value };
    if (id) { const res = await supabase.from('tasks').update(data).eq('id', id); error = res.error; } 
    else { const res = await supabase.from('tasks').insert([data]); error = res.error; }
  } else if (type === 'rewards') {
    const data = { reward_name: document.getElementById('inp-rname').value, cost: document.getElementById('inp-rcost').value };
    if (id) { const res = await supabase.from('rewards').update(data).eq('id', id); error = res.error; } 
    else { const res = await supabase.from('rewards').insert([data]); error = res.error; }
  }
  
  showLoading(false);
  if (error) showToast('Lỗi: ' + error.message, 'error');
  else { showToast('Lưu thành công!'); closeModal(); loadAdminData(type); }
}

async function deleteData(type, id) {
  if (!confirm('Bạn có chắc chắn muốn xóa?')) return;
  showLoading(true);
  
  let error = null;
  if (type === 'users') { const res = await supabase.from('users').delete().eq('username', id); error = res.error; }
  else if (type === 'tasks') { const res = await supabase.from('tasks').delete().eq('id', id); error = res.error; }
  else if (type === 'rewards') { const res = await supabase.from('rewards').delete().eq('id', id); error = res.error; }
  
  showLoading(false);
  if (error) showToast('Lỗi: ' + error.message, 'error');
  else { showToast('Xóa thành công!'); loadAdminData(type); }
}

window.onload = checkLoginStatus;
