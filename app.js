// --- CẤU HÌNH API ---
// THAY THẾ ĐƯỜNG LINK NÀY BẰNG WEB APP URL CỦA BẠN
const API_URL = 'https://script.google.com/macros/s/AKfycbzi4utii2QjIf6vc5kNM_qPmgdm7fBa5Xc03zhqHjFBNTXXjIgYPiW1Gjx1iiTyIw22/exec';

let currentUser = null;
let currentAdminType = 'approvals';
let currentReportTimeframe = 'this_week';
let currentReportTab = 'tasks';

// --- HÀM GỌI API (THAY THẾ CHO google.script.run) ---
async function callAPI(action, params = {}) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({ action: action, ...params })
    });
    const result = await response.json();
    return result;
  } catch (error) {
    console.error("API Error:", error);
    return { status: 'error', message: 'Lỗi kết nối máy chủ!' };
  }
}

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
  const userInp = document.getElementById('login-username').value.trim();
  const passInp = document.getElementById('login-password').value.trim();
  if (!userInp || !passInp) return showToast('Vui lòng nhập đủ thông tin!', 'error');

  showLoading(true);
  const res = await callAPI('login', { username: userInp, password: passInp });
  showLoading(false);

  if (res.status === 'success') {
    currentUser = res.data;
    localStorage.setItem('housework_user', JSON.stringify(currentUser));
    document.getElementById('login-screen').style.display = 'none';
    showToast(`Chào mừng ${currentUser.name}!`);
    initApp();
  } else {
    showToast(res.message, 'error');
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
  const tasksRes = await callAPI('getTodayTasks', { username: currentUser.username });
  
  if (tasksRes.status === 'success') {
    renderTasks(tasksRes.data);
  } else {
    showToast(tasksRes.message, 'error');
  }
  
  const rewardsRes = await callAPI('getRewards');
  showLoading(false);

  if (rewardsRes.status === 'success') {
    renderRewards(rewardsRes.data);
  }
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
    let statusHtml = '';
    let actionHtml = '';

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
  const res = await callAPI('submitTask', { username: currentUser.username, taskId: taskId, periodId: periodId });
  showLoading(false);
  
  showToast(res.message, res.status);
  if (res.status === 'success') loadHomeData();
}

function renderRewards(rewards) {
  const container = document.getElementById('home-rewards-container');
  container.innerHTML = '';
  rewards.forEach(r => {
    const canAfford = currentUser.points >= r.cost;
    container.innerHTML += `
      <div class="bg-card border border-borderline rounded-2xl p-4 flex flex-col items-center text-center shadow-sm">
        <div class="w-12 h-12 rounded-full bg-[#2D323E] flex items-center justify-center mb-3"><i class="fa-solid fa-gift text-secondary text-xl"></i></div>
        <h3 class="font-bold text-white text-sm mb-1 line-clamp-1">${r.name}</h3>
        <div class="text-primary font-bold text-xs mb-3">${r.cost} pts</div>
        <button onclick="redeemReward('${r.id}')" class="w-full py-2 rounded-xl text-xs font-bold active-scale transition-colors ${canAfford ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-[#2D323E] text-muted opacity-50 cursor-not-allowed'}" ${!canAfford ? 'disabled' : ''}>Đổi quà</button>
      </div>
    `;
  });
}

async function redeemReward(rewardId) {
  if(!confirm('Bạn chắc chắn muốn đổi quà này?')) return;
  showLoading(true);
  const res = await callAPI('redeemReward', { username: currentUser.username, rewardId: rewardId });
  
  showToast(res.message, res.status);
  if (res.status === 'success') {
    const uRes = await callAPI('getUserData', { username: currentUser.username });
    if(uRes.status === 'success') {
      currentUser = uRes.data;
      localStorage.setItem('housework_user', JSON.stringify(currentUser));
      document.getElementById('user-points').innerText = currentUser.points;
      loadHomeData();
    }
  }
  showLoading(false);
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
  
  currentReportTimeframe = 'custom';
  document.getElementById('report-period').innerText = 'Đang tải dữ liệu...';
  showLoading(true);

  const res = await callAPI('getAdvancedReport', { username: currentUser.username, timeframe: 'custom', customStart: start, customEnd: end });
  showLoading(false);

  if (res.status === 'success') {
    document.getElementById('report-period').innerText = `Thời gian: ${res.data.period}`;
    renderLeaderboard(res.data.leaderboard);
    renderTaskStats(res.data.taskStats);
  } else {
    showToast(res.message, 'error');
  }
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

  document.getElementById('report-period').innerText = 'Đang tải dữ liệu...';
  showLoading(true);

  const res = await callAPI('getAdvancedReport', { username: currentUser.username, timeframe: timeframe });
  showLoading(false);

  if (res.status === 'success') {
    document.getElementById('report-period').innerText = `Thời gian: ${res.data.period}`;
    renderLeaderboard(res.data.leaderboard);
    renderTaskStats(res.data.taskStats);
  } else {
    showToast(res.message, 'error');
  }
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
    const res = await callAPI('adminGetData', { username: currentUser.username, type: type });
    showLoading(false);
    
    if (res.status === 'success') {
      renderAdminList(type, res.data);
    } else {
      showToast(res.message, 'error');
    }
  }
}

async function loadApprovals() {
  showLoading(true);
  const res = await callAPI('getPendingApprovals', { username: currentUser.username });
  showLoading(false);
  
  const container = document.getElementById('admin-list-container');
  container.innerHTML = '';
  
  if (res.status !== 'success') return showToast(res.message, 'error');
  if (res.data.length === 0) return container.innerHTML = '<div class="text-center text-muted py-8 text-sm">Không có việc nào chờ duyệt.</div>';
  
  res.data.forEach(item => {
    container.innerHTML += `
      <div class="bg-card border border-borderline rounded-2xl p-4">
        <div class="flex justify-between items-start mb-2">
          <div><h4 class="font-bold text-white text-sm">${item.taskName}</h4><div class="text-xs text-muted mt-1">Người làm: <span class="text-white">${item.completedByName}</span></div></div>
          <div class="text-primary font-bold text-sm">+${item.points}</div>
        </div>
        <div class="flex gap-2 mt-4">
          <button onclick="approveTask(${item.row}, false)" class="flex-1 py-2 rounded-xl bg-red-500/10 text-red-500 text-xs font-bold active-scale">Từ chối</button>
          <button onclick="approveTask(${item.row}, true)" class="flex-1 py-2 rounded-xl bg-success/10 text-success text-xs font-bold active-scale">Duyệt</button>
        </div>
      </div>
    `;
  });
}

async function approveTask(row, isApproved) {
  showLoading(true);
  const res = await callAPI('approveTask', { username: currentUser.username, logRow: row, isApproved: isApproved });
  showLoading(false);
  
  showToast(res.message, res.status);
  if(res.status === 'success') loadApprovals();
}

function renderAdminList(type, data) {
  const container = document.getElementById('admin-list-container');
  container.innerHTML = '';
  if (data.length === 0) return container.innerHTML = '<div class="text-center text-muted py-8 text-sm">Chưa có dữ liệu.</div>';
  
  data.forEach(item => {
    let title = '', subtitle = '';
    if (type === 'users') { title = item.Name; subtitle = `${item.Username} - ${item.Role} - ${item.Points} pts`; }
    else if (type === 'tasks') { title = item.TaskName; subtitle = `${item.Frequency} - +${item.Points} / -${item.Penalty}`; }
    else if (type === 'rewards') { title = item.RewardName; subtitle = `${item.Cost} pts`; }
    
    container.innerHTML += `
      <div class="bg-card border border-borderline rounded-2xl p-4 flex justify-between items-center">
        <div><h4 class="font-bold text-white text-sm">${title}</h4><div class="text-xs text-muted mt-1">${subtitle}</div></div>
        <div class="flex gap-2">
          <button onclick='openModal("${type}", ${JSON.stringify(item).replace(/'/g, "&#39;")})' class="w-8 h-8 rounded-lg bg-[#2D323E] text-white flex items-center justify-center active-scale"><i class="fa-solid fa-pen text-xs"></i></button>
          <button onclick="deleteData('${type}', ${item._row})" class="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center active-scale"><i class="fa-solid fa-trash text-xs"></i></button>
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
          <option value="User" ${item && item.Role === 'User' ? 'selected' : ''}>User (Thành viên)</option>
          <option value="Moderator" ${item && item.Role === 'Moderator' ? 'selected' : ''}>Moderator (Quản trị viên)</option>
          <option value="Admin" ${item && item.Role === 'Admin' ? 'selected' : ''}>Admin (Chủ nhà)</option>
        </select>
      `;
    } else {
      roleSelect = `
        <select id="inp-role" class="w-full bg-[#16181D] border border-borderline rounded-xl px-4 py-3 text-white text-sm outline-none mb-3">
          <option value="User" selected>User (Thành viên)</option>
        </select>
      `;
    }

    body.innerHTML = `
      <input id="inp-username" type="text" placeholder="Tên đăng nhập (VD: bi)" class="w-full bg-[#16181D] border border-borderline rounded-xl px-4 py-3 text-white text-sm outline-none mb-3" value="${item ? item.Username : ''}" ${item ? 'disabled' : ''}>
      <input id="inp-name" type="text" placeholder="Tên hiển thị (VD: Bé Bi)" class="w-full bg-[#16181D] border border-borderline rounded-xl px-4 py-3 text-white text-sm outline-none mb-3" value="${item ? item.Name : ''}">
      <input id="inp-points" type="number" placeholder="Điểm hiện tại" class="w-full bg-[#16181D] border border-borderline rounded-xl px-4 py-3 text-white text-sm outline-none mb-3" value="${item ? item.Points : '0'}">
      ${roleSelect}
      <input id="inp-password" type="text" placeholder="Mật khẩu" class="w-full bg-[#16181D] border border-borderline rounded-xl px-4 py-3 text-white text-sm outline-none" value="${item ? item.Password : ''}">
    `;
  } else if (type === 'tasks') {
    body.innerHTML = `
      <input id="inp-tname" type="text" placeholder="Tên công việc" class="w-full bg-[#16181D] border border-borderline rounded-xl px-4 py-3 text-white text-sm outline-none mb-3" value="${item ? item.TaskName : ''}">
      <select id="inp-tfreq" class="w-full bg-[#16181D] border border-borderline rounded-xl px-4 py-3 text-white text-sm outline-none mb-3">
        <option value="Daily" ${item && item.Frequency === 'Daily' ? 'selected' : ''}>Hàng ngày</option>
        <option value="Weekly" ${item && item.Frequency === 'Weekly' ? 'selected' : ''}>Hàng tuần</option>
        <option value="Monthly" ${item && item.Frequency === 'Monthly' ? 'selected' : ''}>Hàng tháng</option>
      </select>
      <input id="inp-tsched" type="number" placeholder="Lịch (Thứ 0-6 hoặc Tuần 1-4)" class="w-full bg-[#16181D] border border-borderline rounded-xl px-4 py-3 text-white text-sm outline-none mb-3" value="${item ? item.Schedule : ''}">
      <input id="inp-tpoints" type="number" placeholder="Điểm thưởng" class="w-full bg-[#16181D] border border-borderline rounded-xl px-4 py-3 text-white text-sm outline-none mb-3" value="${item ? item.Points : ''}">
      <input id="inp-tpenalty" type="number" placeholder="Điểm phạt" class="w-full bg-[#16181D] border border-borderline rounded-xl px-4 py-3 text-white text-sm outline-none" value="${item ? item.Penalty : ''}">
    `;
  } else if (type === 'rewards') {
    body.innerHTML = `
      <input id="inp-rname" type="text" placeholder="Tên phần thưởng" class="w-full bg-[#16181D] border border-borderline rounded-xl px-4 py-3 text-white text-sm outline-none mb-3" value="${item ? item.RewardName : ''}">
      <input id="inp-rcost" type="number" placeholder="Giá (Điểm)" class="w-full bg-[#16181D] border border-borderline rounded-xl px-4 py-3 text-white text-sm outline-none" value="${item ? item.Cost : ''}">
    `;
  }
  
  modal.classList.remove('hidden');
  saveBtn.onclick = () => saveData(type, item ? item._row : null, item ? (type === 'tasks' ? item.TaskID : type === 'rewards' ? item.RewardID : null) : null);
}

function closeModal() { document.getElementById('admin-modal').classList.add('hidden'); }

async function saveData(type, row, id) {
  let rowData = [];
  if (type === 'users') rowData = [document.getElementById('inp-username').value, document.getElementById('inp-name').value, document.getElementById('inp-points').value, document.getElementById('inp-role').value, document.getElementById('inp-password').value];
  else if (type === 'tasks') rowData = [id || '', document.getElementById('inp-tname').value, document.getElementById('inp-tfreq').value, document.getElementById('inp-tsched').value, document.getElementById('inp-tpoints').value, document.getElementById('inp-tpenalty').value];
  else if (type === 'rewards') rowData = [id || '', document.getElementById('inp-rname').value, document.getElementById('inp-rcost').value];
  
  showLoading(true);
  const res = await callAPI('adminSaveData', { username: currentUser.username, type: type, row: row, rowData: rowData });
  showLoading(false);
  
  showToast(res.message, res.status);
  if (res.status === 'success') { closeModal(); loadAdminData(type); }
}

async function deleteData(type, row) {
  if (!confirm('Bạn có chắc chắn muốn xóa?')) return;
  showLoading(true);
  const res = await callAPI('adminDeleteData', { username: currentUser.username, type: type, row: row });
  showLoading(false);
  
  showToast(res.message, res.status);
  if (res.status === 'success') loadAdminData(type);
}

window.onload = checkLoginStatus;
