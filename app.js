// --- CẤU HÌNH SUPABASE ---
const SUPABASE_URL = 'https://akgrmxazfgwbnpqupmor.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_L6pJkJPwbOoEDDbNXhL_PQ_oq2nm-rC';

if (!window.supabase) {
  alert("Không thể tải thư viện Supabase. Vui lòng kiểm tra.");
}
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

let currentUser = null;
let currentAdminType = 'approvals';
let currentReportTimeframe = 'this_week';
let currentReportTab = 'tasks';

// --- TIỆN ÍCH UI ---
function showLoading(show) { document.getElementById('loading-overlay').style.display = show ? 'flex' : 'none'; }
function showToast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 transform translate-y-[-20px] opacity-0 transition-all duration-300 ${type === 'success' ? 'bg-success text-white' : 'bg-red-500 text-white border-red-400'}`;
  toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check text-white' : 'fa-circle-exclamation text-white'}"></i> <span>${msg}</span>`;
  
  if (type === 'mega-success') {
    toast.className = `toast px-5 py-4 rounded-xl shadow-2xl text-md font-bold flex items-center gap-3 transform translate-y-[-20px] opacity-0 transition-all duration-300 bg-gradient-to-r from-yellow-400 to-amber-500 text-white`;
    toast.innerHTML = `<i class="fa-solid fa-star text-white text-xl animate-spin-slow"></i> <span>${msg}</span>`;
  }
  
  container.appendChild(toast);
  setTimeout(() => { toast.classList.remove('translate-y-[-20px]', 'opacity-0'); toast.classList.add('translate-y-0', 'opacity-100'); }, 10);
  setTimeout(() => { toast.classList.remove('translate-y-0', 'opacity-100'); toast.classList.add('translate-y-[-20px]', 'opacity-0'); setTimeout(() => toast.remove(), 300); }, type==='mega-success'? 5000 : 3000);
}

// Cập nhật điểm topbar
async function refreshUserPoints() {
  if (!currentUser) return;
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
  } catch (e) { console.warn('Lỗi refresh điểm:', e); }
}

// Kích hoạt Realtime Notification cho việc tự động hiển thị thông báo khi User được Admin gắn 'Approved' (Yêu cầu bật Replication ở DB)
function setupRealtimeListener() {
  if(!currentUser || !supabaseClient) return;
  
  supabaseClient.channel('custom-user-channel')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'task_logs', filter: `username=eq.${currentUser.username}` }, 
    (payload) => {
      if (payload.new.status === 'Approved' && payload.old.status !== 'Approved') {
         showToast(`Wao! Công việc vừa được duyệt. Bạn được cộng điểm!`, 'mega-success');
         if (typeof confetti === 'function') confetti({ particleCount: 200, spread: 80, origin: { y: 0.3 }, zIndex: 9999 });
         refreshUserPoints();
      }
    }).subscribe();
}

// --- ĐĂNG NHẬP & AVATAR ---
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
  if (!supabaseClient) return showToast('Lỗi kết nối máy chủ!', 'error');
  
  const userInp = document.getElementById('login-username').value.trim().toLowerCase();
  const passInp = document.getElementById('login-password').value.trim();
  const errorBox = document.getElementById('login-error');
  
  errorBox.classList.add('hidden');

  if (!userInp || !passInp) {
    errorBox.innerText = 'Vui lòng nhập đủ tên đăng nhập và mật khẩu!';
    errorBox.classList.remove('hidden');
    return showToast('Vui lòng nhập đủ thông tin!', 'error');
  }

  showLoading(true);
  try {
    const { data, error } = await supabaseClient.from('users').select('*').eq('username', userInp).eq('password', passInp);
    showLoading(false);

    if (error || !data || data.length === 0) {
      errorBox.innerText = 'Tên đăng nhập hoặc mật khẩu không chính xác!';
      errorBox.classList.remove('hidden');
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
    errorBox.innerText = 'Có lỗi xảy ra kết nối mạng. Thử lại sau!';
    errorBox.classList.remove('hidden');
  }
}

function handleLogout() {
  localStorage.removeItem('housework_user');
  currentUser = null;
  supabaseClient.removeAllChannels(); // Clear realtime
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('login-screen').style.display = 'flex';
}

function updateAvatarHeader() {
  const imgEL = document.getElementById('user-avatar-img');
  const txtEL = document.getElementById('user-avatar-text');
  
  if (currentUser.avatar && currentUser.avatar.trim() !== '') {
    imgEL.src = currentUser.avatar;
    imgEL.classList.remove('hidden');
    txtEL.classList.add('hidden');
  } else {
    imgEL.classList.add('hidden');
    txtEL.classList.remove('hidden');
    txtEL.innerText = currentUser.name.charAt(0).toUpperCase();
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
  
  if(error) return showToast('Có lỗi: Bạn đã thêm cột "avatar" vào bảng users ở Supabase chưa?', 'error');
  
  currentUser.avatar = url;
  localStorage.setItem('housework_user', JSON.stringify(currentUser));
  updateAvatarHeader();
  closeAvatarModal();
  showToast('Cập nhật avatar thành công!');
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

// --- TRANG CHỦ ---
async function loadHomeData() {
  showLoading(true);
  await refreshUserPoints();
  
  const { data: tasksData } = await supabaseClient.from('tasks').select('*');
  const { data: logsData } = await supabaseClient.from('task_logs').select('*, users(name)').neq('status', 'Rejected');
  
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
          if (log) { logStatus = log.status; completedBy = log.username; completedByName = log.users?.name || log.username; }
        }
        tasks.push({ id: t.id, name: t.task_name, points: t.points, penalty: t.penalty, status: logStatus, completedByName, periodId, icon: t.icon || 'fa-solid fa-clipboard-list' });
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
    container.innerHTML = '<div class="text-center text-muted py-8 text-sm">Hôm nay không có việc gì! 🎉</div>';
    reminderBox.classList.add('hidden');
    return;
  }

  let hasPendingTask = false;
  tasks.forEach(t => {
    if (t.status === 'Not Done') hasPendingTask = true;
    let statusHtml = ''; let actionHtml = '';

    if (t.status === 'Not Done') {
      actionHtml = `<button onclick="submitTask('${t.id}', '${t.periodId}')" class="w-full mt-3 py-2.5 rounded-xl bg-[#2D323E] text-white text-xs font-bold active-scale hover:bg-primary transition-colors hover:shadow-lg">Đã làm xong</button>`;
    } else if (t.status === 'Pending Approval') {
      statusHtml = `<span class="badge-pending"><i class="fa-solid fa-clock mr-1"></i>Chờ duyệt</span>`;
      actionHtml = `<div class="mt-3 text-[11px] text-muted text-center">Người nhận kèo: <span class="text-white font-medium">${t.completedByName}</span></div>`;
    } else if (t.status === 'Approved') {
      statusHtml = `<span class="badge-approved"><i class="fa-solid fa-check mr-1"></i>Hoàn thành</span>`;
      actionHtml = `<div class="mt-3 text-[11px] text-muted text-center">Hoàn thành bởi: <span class="text-success font-medium">${t.completedByName}</span></div>`;
    }

    container.innerHTML += `
      <div class="bg-card border border-borderline rounded-2xl p-4 shadow-sm relative overflow-hidden">
        ${t.status === 'Approved' ? '<div class="absolute inset-0 bg-success/5 pointer-events-none"></div>' : ''}
        <div class="flex justify-between items-start mb-2 relative z-10">
          <div class="flex items-center gap-3">
             <div class="w-9 h-9 rounded-xl flex items-center justify-center bg-[#2D323E] text-[#9CA3AF]"><i class="${t.icon}"></i></div>
             <h3 class="font-bold text-white text-sm max-w-[150px] leading-tight">${t.name}</h3>
          </div>
          ${statusHtml}
        </div>
        <div class="flex items-center gap-3 text-xs text-muted mt-2 relative z-10">
          <span class="flex items-center gap-1 bg-[#16181D] px-2 py-1 rounded border border-borderline"><i class="fa-solid fa-coins text-yellow-500"></i> <b class="text-white">+${t.points}</b></span>
          <span class="flex items-center gap-1 bg-[#16181D] px-2 py-1 rounded border border-borderline text-red-400"><i class="fa-solid fa-arrow-trend-down"></i> <b class="text-red-400">-${t.penalty}</b></span>
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
  const { data: existing } = await supabaseClient.from('task_logs').select('id').eq('task_id', taskId).eq('period_id', periodId).neq('status', 'Rejected');
  if (existing && existing.length > 0) {
    showLoading(false);
    return showToast('Công việc này đã có người xí rồi!', 'error');
  }

  const { error } = await supabaseClient.from('task_logs').insert([{ task_id: taskId, period_id: periodId, username: currentUser.username, status: 'Pending Approval' }]);
  showLoading(false);
  
  if (error) showToast('Lỗi gửi: ' + error.message, 'error');
  else { 
    showToast('Đã gửi yêu cầu, đợi Duyệt nha!', 'success'); 
    loadHomeData(); 
  }
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
      </div>
    `;
  });
}

async function redeemReward(rewardId, cost, name) {
  if(!confirm(`Xác nhận dùng ${cost} điểm để đổi [ ${name} ] ?`)) return;
  if (currentUser.points < cost) return showToast('Không đủ điểm rùi!', 'error');

  showLoading(true);
  const newPoints = currentUser.points - cost;
  
  const { error: err1 } = await supabaseClient.from('users').update({ points: newPoints }).eq('username', currentUser.username);
  if (err1) { showLoading(false); return showToast('Lỗi Database: ' + err1.message, 'error'); }

  await supabaseClient.from('transactions').insert([{ username: currentUser.username, type: 'Spend', amount: cost, description: `Đổi quà: ${name}` }]);
  
  refreshUserPoints(); 
  
  showLoading(false);
  showToast(`Quá đỉnh! Nhớ đòi [ ${name} ] nha!`, 'mega-success');
  
  if (typeof confetti === 'function') {
    confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 }, colors: ['#ffc107', '#28a745', '#007bff'], zIndex: 9999 });
  }

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

// Báo cáo chia ra: Hoàn thành / Chưa làm phạt / Chưa làm (Miễn)
async function loadReportData(startDate, endDate) {
  document.getElementById('report-period').innerText = 'Đang tải dữ liệu...';
  showLoading(true);

  const { data: users } = await supabaseClient.from('users').select('*');
  const { data: trans } = await supabaseClient.from('transactions').select('*').gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString());
  const { data: tasks } = await supabaseClient.from('tasks').select('*');
  const { data: logs } = await supabaseClient.from('task_logs').select('*'); 

  showLoading(false);

  const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);
  const actualEndDate = endDate > todayEnd ? todayEnd : endDate;
  let actualStartDate = new Date(startDate);

  // Giới hạn bắt đầu từ ngày có log khởi thủy
  if (logs && logs.length > 0) {
    let minDate = new Date(logs[0].created_at);
    logs.forEach(l => {
      const d = new Date(l.created_at);
      if (d < minDate) minDate = d;
    });
    minDate.setHours(0,0,0,0);
    if (minDate > actualStartDate) {
       actualStartDate = new Date(minDate);
       startDate = new Date(actualStartDate);
    }
  } else {
    actualStartDate = new Date(actualEndDate);
    actualStartDate.setHours(0,0,0,0);
    startDate = new Date(actualStartDate);
  }

  if (actualStartDate > actualEndDate) actualStartDate = new Date(actualEndDate);

  // Tính Leaderboard (tính gộp thông thường) 
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

  const logMap = {}; 
  if (logs) logs.forEach(l => { if (l.status !== 'Rejected') logMap[l.task_id + '_' + l.period_id] = true; });

  let completedTasks = 0, missedPenaltyTasks = 0, missedFreeTasks = 0;
  const taskBreakdown = {};
  // Bây giờ Breakdown gom 3 biến
  if (tasks) tasks.forEach(t => taskBreakdown[t.id] = { name: t.task_name, completed: 0, missedPen: 0, missedFree: 0, penaltyAmount: t.penalty });

  const uniqueWeeks = new Set();
  
  // Quét vòng lặp từ ngày bắt đầu báo cáo -> Ngày cuối/Hôm nay
  for (let d = new Date(actualStartDate); d <= actualEndDate; d.setDate(d.getDate() + 1)) {
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
        if (logMap[t.id + '_' + pId]) { 
          completedTasks++; 
          taskBreakdown[t.id].completed++; 
        } else {
          // Xếp loại "Miss"
          if (t.penalty > 0) {
            missedPenaltyTasks++;
            taskBreakdown[t.id].missedPen++;
          } else {
            missedFreeTasks++;
            taskBreakdown[t.id].missedFree++;
          }
        }
      }
    });
  }

  // Quét vòng lặp Tháng tương tự
  uniqueWeeks.forEach(weekStr => {
    const wNum = Number(weekStr.split('-W')[1]);
    if (tasks) tasks.forEach(t => {
      if (t.frequency === 'Monthly' && t.schedule === wNum) {
        if (logMap[t.id + '_' + weekStr]) { 
          completedTasks++; 
          taskBreakdown[t.id].completed++; 
        } else { 
          if (t.penalty > 0) {
            missedPenaltyTasks++;
            taskBreakdown[t.id].missedPen++;
          } else {
            missedFreeTasks++;
            taskBreakdown[t.id].missedFree++;
          }
        }
      }
    });
  });

  const taskStats = {
    completed: completedTasks, missedPen: missedPenaltyTasks, missedFree: missedFreeTasks,
    breakdown: Object.values(taskBreakdown).filter(t => t.completed > 0 || t.missedPen > 0 || t.missedFree > 0)
  };

  document.getElementById('report-period').innerText = `Kỳ này: ${startDate.toLocaleDateString('vi-VN')} - ${endDate.toLocaleDateString('vi-VN')}`;
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
    container.innerHTML = '<div class="text-center text-muted text-xs py-4">Chưa phát sinh việc nào.</div>';
    return;
  }

  // Xếp thứ tự dựa theo tổng số việc
  taskStats.breakdown.sort((a,b) => (b.completed + b.missedPen + b.missedFree) - (a.completed + a.missedPen + a.missedFree)).forEach(t => {
    const total = t.completed + t.missedPen + t.missedFree;
    const percent = total === 0 ? 0 : Math.round((t.completed / total) * 100);
    container.innerHTML += `
      <div class="bg-[#16181D] rounded-xl p-3 border border-borderline relative overflow-hidden">
        <div class="flex justify-between items-center mb-2">
          <span class="text-xs font-bold text-white">${t.name}</span>
          <span class="text-[10px] text-muted">${percent}% hoàn thành</span>
        </div>
        <div class="w-full bg-[#2D323E] rounded-full h-1.5 mb-2">
          <div class="bg-primary h-1.5 rounded-full" style="width: ${percent}%"></div>
        </div>
        <div class="flex justify-between text-[10px] items-center">
          <span class="text-success flex items-center gap-1"><i class="fa-solid fa-check"></i> Xong ${t.completed}</span>
          <div class="flex gap-2">
            ${t.missedPen > 0 ? `<span class="text-red-400 bg-red-500/10 px-1 rounded flex items-center gap-1"><i class="fa-solid fa-heart-crack"></i> Phạt ${t.missedPen}</span>` : ''}
            ${t.missedFree > 0 ? `<span class="text-amber-500 bg-amber-500/10 px-1 rounded flex items-center gap-1"><i class="fa-solid fa-clock-rotate-left"></i> Miễn ${t.missedFree}</span>` : ''}
            ${(t.missedPen === 0 && t.missedFree === 0) ? `<span class="text-muted"><i class="fa-solid fa-star"></i> Không bỏ lỡ</span>` : ''}
          </div>
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
    if (index === 0) rankIcon = `<i class="fa-solid fa-crown text-yellow-500 text-xl drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]"></i>`;
    else if (index === 1) rankIcon = `<i class="fa-solid fa-medal text-gray-300 text-lg"></i>`;
    else if (index === 2) rankIcon = `<i class="fa-solid fa-medal text-amber-600 text-lg"></i>`;

    container.innerHTML += `
      <div class="bg-card border border-borderline rounded-2xl p-4 flex items-center gap-4 hover:bg-[#1a1d24] transition-colors">
        <div class="w-8 flex justify-center">${rankIcon}</div>
        <div class="flex-1">
          <div class="font-bold text-white text-sm">${user.name}</div>
          <div class="text-[11px] text-muted">Hiện có: <span class="text-primary font-bold">${user.currentPoints}</span> pts</div>
        </div>
        <div class="text-right space-y-1">
          <div class="text-xs text-success font-medium"><i class="fa-solid fa-arrow-trend-up mr-1 text-[10px]"></i>+${user.earned}</div>
          <div class="text-[10px] text-red-400"><i class="fa-solid fa-arrow-trend-down mr-1 text-[10px]"></i>-${user.penalty}</div>
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
      const res = await supabaseClient.from('users').select('*');
      data = res.data || [];
      if (currentUser.role === 'Moderator') data = data.filter(u => u.role === 'User');
    } else if (type === 'tasks') {
      const res = await supabaseClient.from('tasks').select('*');
      data = res.data || [];
    } else if (type === 'rewards') {
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
  if (!data || data.length === 0) return container.innerHTML = '<div class="text-center text-muted py-8 text-sm">Quá mượt! Không có việc nào chờ duyệt.</div>';
  
  data.forEach(item => {
    container.innerHTML += `
      <div class="bg-card border border-borderline rounded-2xl p-4 shadow-sm">
        <div class="flex justify-between items-start mb-2">
          <div class="flex items-start gap-2">
             <i class="${item.tasks?.icon || 'fa-solid fa-clipboard-list'} text-[#9CA3AF] mt-1 text-sm bg-[#2D323E] w-6 h-6 rounded flex items-center justify-center"></i>
            <div><h4 class="font-bold text-white text-sm max-w-[150px] leading-tight">${item.tasks?.task_name}</h4><div class="text-[11px] text-muted mt-1">Người làm: <span class="text-white">${item.users?.name || item.username}</span></div></div>
          </div>
          <div class="text-primary font-bold text-sm bg-[#16181D] px-2 py-1 rounded">+${item.tasks?.points}</div>
        </div>
        <div class="flex gap-2 mt-4">
          <button onclick="approveTask('${item.id}', false, '${item.username}', ${item.tasks?.points}, '${item.tasks?.task_name}')" class="flex-1 py-2 rounded-xl bg-red-500/10 text-red-500 text-xs font-bold active-scale hover:bg-red-500 hover:text-white transition-colors">Từ chối</button>
          <button onclick="approveTask('${item.id}', true, '${item.username}', ${item.tasks?.points}, '${item.tasks?.task_name}')" class="flex-1 py-2 rounded-xl bg-success text-white text-xs font-bold active-scale shadow-lg shadow-success/30">Duyệt & +Điểm</button>
        </div>
      </div>
    `;
  });
}

// Bổ sung: Hàm cập nhật phê duyệt task logic được điều chỉnh lại xíu 
async function approveTask(logId, isApproved, username, points, taskName) {
  showLoading(true);
  
  const status = isApproved ? 'Approved' : 'Rejected';
  await supabaseClient.from('task_logs').update({ status: status, approved_by: currentUser.username }).eq('id', logId);
  
  if (isApproved) {
    const { data: uData } = await supabaseClient.from('users').select('points').eq('username', username).single();
    if (uData) {
      // Cập nhật điểm cho user
      await supabaseClient.from('users').update({ points: uData.points + points }).eq('username', username);
      await supabaseClient.from('transactions').insert([{ username: username, type: 'Earn', amount: points, description: `Được duyệt: ${taskName}` }]);
    }
  }
  
  refreshUserPoints();
  
  showLoading(false);
  showToast(isApproved ? 'Đã thông báo cộng điểm tới user!' : 'Đã từ chối.', isApproved ? 'success' : 'error');
  loadApprovals();
}

function renderAdminList(type, data) {
  const container = document.getElementById('admin-list-container');
  container.innerHTML = '';
  if (data.length === 0) return container.innerHTML = '<div class="text-center text-muted py-8 text-sm">Chưa thiết lập dữ liệu.</div>';
  
  data.forEach(item => {
    let title = '', subtitle = '', id = '', prefixHTML = '';
    if (type === 'users') { 
        id = item.username; title = item.name; subtitle = `${item.username} - ${item.role} - <span class="text-yellow-500">${item.points} pts</span>`;
        prefixHTML = `<div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white overflow-hidden bg-[#2D323E]">${item.avatar ? `<img src="${item.avatar}" class="w-full h-full object-cover">` : item.name.charAt(0).toUpperCase()}</div>`;
    }
    else if (type === 'tasks') { 
        id = item.id; title = item.task_name; subtitle = `${item.frequency} | Thuộc tính: <span class="text-primary">+${item.points}</span> / <span class="text-red-400">-${item.penalty}</span>`; 
        prefixHTML = `<div class="w-8 h-8 rounded bg-[#2D323E] flex items-center justify-center"><i class="${item.icon || 'fa-solid fa-clipboard-list'} text-[#9CA3AF] text-xs"></i></div>`;
    }
    else if (type === 'rewards') { 
        id = item.id; title = item.reward_name; subtitle = `<span class="text-yellow-500">${item.cost} pts</span>`; 
        prefixHTML = `<div class="w-8 h-8 rounded bg-[#2D323E] flex items-center justify-center"><i class="${item.icon || 'fa-solid fa-gift'} text-amber-500 text-xs"></i></div>`;
    }
    
    container.innerHTML += `
      <div class="bg-card border border-borderline rounded-2xl p-4 flex justify-between items-center shadow-sm">
        <div class="flex gap-3 items-center">
            ${prefixHTML}
            <div><h4 class="font-bold text-white text-sm">${title}</h4><div class="text-[10px] text-muted mt-0.5">${subtitle}</div></div>
        </div>
        <div class="flex gap-2">
          <button onclick='openModal("${type}", ${JSON.stringify(item).replace(/'/g, "&#39;")})' class="w-8 h-8 rounded-lg bg-[#2D323E] text-white flex items-center justify-center active-scale"><i class="fa-solid fa-pen text-xs"></i></button>
          <button onclick="deleteData('${type}', '${id}')" class="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center active-scale hover:bg-red-500 hover:text-white transition-colors"><i class="fa-solid fa-trash text-xs"></i></button>
        </div>
      </div>
    `;
  });
}

// Bổ sung: Thêm dòng input nhập chuỗi iCon class từ FontAwesome vào modal
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
          <option value="User" ${item && item.role === '