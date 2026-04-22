const SUPABASE_URL = 'https://akgrmxazfgwbnpqupmor.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_L6pJkJPwbOoEDDbNXhL_PQ_oq2nm-rC';
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

let currentUser = null;
let currentAdminType = 'approvals';
let currentReportTimeframe = 'this_week';
let currentReportTab = 'tasks';

const ICONS = ['fa-solid fa-clipboard-list', 'fa-solid fa-broom', 'fa-solid fa-trash', 'fa-solid fa-shirt', 'fa-solid fa-utensils', 'fa-solid fa-droplet', 'fa-solid fa-leaf', 'fa-solid fa-cart-shopping', 'fa-solid fa-book', 'fa-solid fa-sink', 'fa-solid fa-bath', 'fa-solid fa-dog', 'fa-solid fa-cat', 'fa-solid fa-box', 'fa-solid fa-gamepad', 'fa-solid fa-ticket', 'fa-solid fa-tv', 'fa-solid fa-mug-hot', 'fa-solid fa-star', 'fa-solid fa-gift', 'fa-solid fa-medal', 'fa-solid fa-motorcycle', 'fa-solid fa-car', 'fa-solid fa-money-bill', 'fa-solid fa-fire', 'fa-solid fa-rocket', 'fa-solid fa-bolt'];

function showLoading(show) { document.getElementById('loading-overlay').style.display = show ? 'flex' : 'none'; }

function checkIfHoliday(dateObj, tasks) {
  if (!tasks) return false;
  const dStr = typeof dateObj === 'string' ? dateObj : `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
  const holidays = tasks.filter(t => t.frequency === 'Holiday');
  for (let h of holidays) {
    if (h.schedule) {
      const [start, end] = h.schedule.split('_');
      if (dStr >= start && dStr <= end) return true;
    }
  }
  return false;
}

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
    try {
      currentUser = JSON.parse(savedUser); document.getElementById('login-screen').style.display = 'none'; initApp();
    } catch (e) { localStorage.removeItem('housework_user'); document.getElementById('login-screen').style.display = 'flex'; }
  } else document.getElementById('login-screen').style.display = 'flex';

  const passInp = document.getElementById('login-password');
  if (passInp) {
    passInp.addEventListener('keypress', function (e) {
      if (e.key === 'Enter') handleLogin();
    });
  }
}

async function handleLogin() {
  const userInp = document.getElementById('login-username').value.trim();
  const passInp = document.getElementById('login-password').value.trim();
  const errorBox = document.getElementById('login-error');
  if (errorBox) { errorBox.classList.add('hidden'); errorBox.innerText = ''; }

  if (!userInp || !passInp) {
    if (errorBox) { errorBox.innerText = 'Vui lòng điền đầy đủ Tên đăng nhập và Mật khẩu!'; errorBox.classList.remove('hidden'); }
    return showToast('Thiếu thông tin!', 'error');
  }

  if (!supabaseClient) {
    if (errorBox) { errorBox.innerText = 'Chưa thể kết nối CSDL (Lỗi mạng hoặc tải thư viện). Gợi ý: Hãy bấm F5 để tải lại.'; errorBox.classList.remove('hidden'); }
    return showToast('Lỗi Database!', 'error');
  }

  showLoading(true);
  try {
    const { data, error } = await supabaseClient.from('users').select('*').eq('username', userInp).eq('password', passInp);
    showLoading(false);
    if (error) {
      if (errorBox) { errorBox.innerText = 'Lỗi truy vấn: ' + error.message; errorBox.classList.remove('hidden'); }
      return;
    }
    if (!data || data.length === 0) {
      if (errorBox) { errorBox.innerText = 'Sai tên đăng nhập hoặc mật khẩu, bạn check lại xem!'; errorBox.classList.remove('hidden'); }
    } else {
      currentUser = data[0];
      localStorage.setItem('housework_user', JSON.stringify(currentUser));
      document.getElementById('login-screen').style.display = 'none';
      showToast(`Chào mừng ${currentUser.name}!`); initApp();
    }
  } catch (err) {
    showLoading(false);
    if (errorBox) { errorBox.innerText = 'Lỗi mạng: ' + err.message; errorBox.classList.remove('hidden'); }
  }
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

function openAvatarModal() {
  const prev = document.getElementById('avatar-preview');
  const pl = document.getElementById('avatar-placeholder');
  const bInput = document.getElementById('hidden-avatar-base64');

  document.getElementById('inp-avatar-upload').value = '';
  if (currentUser.avatar && currentUser.avatar.trim() !== '') {
    prev.src = currentUser.avatar;
    bInput.value = currentUser.avatar;
    prev.classList.remove('hidden');
    pl.classList.add('hidden');
  } else {
    prev.classList.add('hidden');
    pl.classList.remove('hidden');
    pl.innerText = currentUser.name.charAt(0).toUpperCase();
    bInput.value = '';
  }
  document.getElementById('avatar-modal').classList.remove('hidden');
  document.getElementById('avatar-modal').classList.add('flex');
}

function closeAvatarModal() {
  document.getElementById('avatar-modal').classList.add('hidden');
  document.getElementById('avatar-modal').classList.remove('flex');
}

function previewAvatar(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Validate size (let's say 5MB max before compression)
  if (file.size > 5 * 1024 * 1024) {
    return showToast('Ảnh quá lớn (tối đa 5MB)!', 'error');
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    const img = new Image();
    img.onload = function () {
      // Compress using Canvas
      const canvas = document.createElement('canvas');
      const MAX_SIZE = 150;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_SIZE) {
          height *= MAX_SIZE / width;
          width = MAX_SIZE;
        }
      } else {
        if (height > MAX_SIZE) {
          width *= MAX_SIZE / height;
          height = MAX_SIZE;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

      document.getElementById('avatar-preview').src = dataUrl;
      document.getElementById('avatar-preview').classList.remove('hidden');
      document.getElementById('avatar-placeholder').classList.add('hidden');
      document.getElementById('hidden-avatar-base64').value = dataUrl;
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

async function saveAvatarUpload() {
  const b64 = document.getElementById('hidden-avatar-base64').value;
  if (!b64 || b64.trim() === '') return showToast('Bạn chưa chọn ảnh nào!', 'error');

  showLoading(true);
  const { error } = await supabaseClient.from('users').update({ avatar: b64 }).eq('username', currentUser.username);
  showLoading(false);

  if (error) return showToast('Lỗi cập nhật server!', 'error');

  currentUser.avatar = b64;
  localStorage.setItem('housework_user', JSON.stringify(currentUser));
  updateAvatarHeader();
  closeAvatarModal();
  showToast('Ăn mặc đẹp đấy! Đã cập nhật ảnh!', 'success');
}

let currentReportData = { tasks: [], logs: [], startDate: null, endDate: null, users: [] };

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
  if (tabId === 'history') loadHistoryData();
  if (tabId === 'admin') loadAdminData('approvals');
}

function unpackTasks(tasks) {
  if (!tasks) return tasks;
  return tasks.map(t => {
    let newT = { ...t };
    if (newT.icon && newT.icon.includes('|')) {
      const parts = newT.icon.split('|');
      newT.icon = parts[0];
      newT.schedule = parts[1];
    }
    return newT;
  });
}

async function loadHomeData() {
  showLoading(true); await refreshUserPoints();
  const { data: rawTasksData } = await supabaseClient.from('tasks').select('*');
  const tasksData = unpackTasks(rawTasksData);
  const { data: logsData } = await supabaseClient.from('task_logs').select('*, users(name)').neq('status', 'Rejected');

  const today = new Date();
  const dayOfWeek = today.getDay(); const dayOfWeekAdjusted = dayOfWeek === 0 ? 7 : dayOfWeek;
  const weekOfMonth = Math.ceil(today.getDate() / 7);
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const weekStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-W${weekOfMonth}`;

  const dailyTasks = []; const weeklyTasks = []; const adhocTasks = [];

  if (tasksData) {
    tasksData.forEach(t => {
      let isDue = false, periodId = '';
      if (t.frequency === 'Daily') { isDue = true; periodId = todayStr; }
      else if (t.frequency === 'Weekly' && t.schedule == dayOfWeekAdjusted) { isDue = true; periodId = todayStr; }
      else if (t.frequency === 'Monthly' && t.schedule == weekOfMonth) { isDue = true; periodId = weekStr; }
      else if (t.frequency === 'Adhoc') {
        if (!t.schedule || t.schedule === todayStr) { isDue = true; periodId = todayStr; }
      }

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

  const isTodayHoliday = checkIfHoliday(today, tasksData);

  if (isTodayHoliday) {
    document.getElementById('reminder-box').classList.add('hidden');
    document.getElementById('home-daily-container').innerHTML = '';
    document.getElementById('home-weekly-container').innerHTML = '';
    document.getElementById('home-adhoc-container').innerHTML = '';

    const bannerHtml = `
            <div class="bg-gradient-to-r from-teal-400 to-emerald-500 rounded-3xl p-6 text-white text-center shadow-xl shadow-teal-500/20 mb-6 relative overflow-hidden">
                <i class="fa-solid fa-umbrella-beach absolute -right-6 -bottom-6 text-9xl opacity-20 rotate-[-15deg]"></i>
                <div class="text-4xl mb-3"><i class="fa-solid fa-mug-hot animate-bounce"></i></div>
                <h3 class="font-black text-2xl mb-1">CHẾ ĐỘ NGHỈ LỄ</h3>
                <p class="text-sm font-medium opacity-90 relative z-10">Hôm nay không cần làm việc nhà. Tận hưởng ngày nghỉ vui vẻ nhé!</p>
            </div>
        `;
    document.getElementById('home-daily-container').innerHTML = bannerHtml;

    document.getElementById('home-daily-container').parentElement.querySelector('h2').classList.add('hidden');
    document.getElementById('home-weekly-container').parentElement.classList.add('hidden');
    document.getElementById('home-adhoc-container').parentElement.classList.add('hidden');
  } else {
    document.getElementById('home-daily-container').parentElement.querySelector('h2').classList.remove('hidden');
    document.getElementById('home-weekly-container').parentElement.classList.remove('hidden');
    document.getElementById('home-adhoc-container').parentElement.classList.remove('hidden');

    let hasPending = false;
    hasPending = renderTaskGroup(dailyTasks, 'home-daily-container', 'Chưa có việc hàng ngày.') || hasPending;
    hasPending = renderTaskGroup(weeklyTasks, 'home-weekly-container', 'Hôm nay không có việc định kỳ.') || hasPending;
    renderTaskGroup(adhocTasks, 'home-adhoc-container', 'Tạm thời chưa có việc kiếm thêm.');

    if (hasPending) document.getElementById('reminder-box').classList.remove('hidden');
    else document.getElementById('reminder-box').classList.add('hidden');
  }

  renderRewards(rewardsData || []);
}

function renderTaskGroup(tasks, containerId, emptyMsg) {
  const container = document.getElementById(containerId); container.innerHTML = '';
  if (tasks.length === 0) { container.innerHTML = `<div class="text-center text-muted py-6 text-xs bg-card border border-borderline rounded-2xl border-dashed">${emptyMsg}</div>`; return false; }

  let hasPending = false;
  tasks.forEach(t => {
    if (t.status === 'Not Done' && t.penalty > 0) hasPending = true;
    let rightColHtml = '';
    if (t.status === 'Not Done') {
      rightColHtml = `<button onclick="submitTask('${t.id}', '${t.periodId}')" class="w-12 h-12 rounded-[16px] bg-primary/10 text-primary flex items-center justify-center text-xl active-scale hover:bg-primary hover:text-white hover:rotate-12 transition-all shadow-sm ml-2 cursor-pointer border border-primary/20"><i class="fa-solid fa-hand-pointer"></i></button>`;
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
  if (error) showToast('Lỗi: ' + error.message, 'error'); else {
    showToast('Hay quá! Chờ Admin duyệt để nhận thưởng liền tay!', 'mega-success');
    if (typeof confetti === 'function') confetti({ particleCount: 150, spread: 80, origin: { y: 0.5 }, zIndex: 9999, colors: ['#10B981', '#3B82F6', '#F59E0B', '#EAB308'] });
    loadHomeData();
  }
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
  if (!confirm(`Dùng ${cost} điểm đổi [ ${name} ] ?`)) return;
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
  if (!start || !end) return showToast('Chọn đủ ngày!', 'error');
  loadReportData(new Date(start), new Date(end + 'T23:59:59'));
}

let currentHistoryTab = 'points';
function switchHistoryTab(tab) {
  currentHistoryTab = tab;
  document.getElementById('htab-points').className = `flex-1 py-2 text-sm font-bold transition-colors ${tab === 'points' ? 'text-primary border-b-2 border-primary' : 'text-muted border-b-2 border-transparent'}`;
  document.getElementById('htab-rewards').className = `flex-1 py-2 text-sm font-bold transition-colors ${tab === 'rewards' ? 'text-primary border-b-2 border-primary' : 'text-muted border-b-2 border-transparent'}`;
  document.getElementById('history-content-points').style.display = tab === 'points' ? 'block' : 'none';
  document.getElementById('history-content-rewards').style.display = tab === 'rewards' ? 'block' : 'none';
}

async function loadHistoryData() {
  showLoading(true);

  const filterSelect = document.getElementById('history-user-filter');
  const existingVal = filterSelect.value;
  filterSelect.innerHTML = '';

  let usersList = [];
  if (currentUser.role === 'User') {
    filterSelect.innerHTML = `<option value="${currentUser.username}">Việc của tôi (${currentUser.name})</option>`;
    filterSelect.classList.remove('hidden');
  } else {
    const { data: usersData } = await supabaseClient.from('users').select('*');
    usersList = usersData || [];
    filterSelect.classList.remove('hidden');
    let html = '<option value="all">Tất cả thành viên</option>';
    usersList.forEach(u => { html += `<option value="${u.username}">${u.name}</option>`; });
    filterSelect.innerHTML = html;
    if (existingVal) filterSelect.value = existingVal;
  }

  const filterUser = filterSelect.value || (currentUser.role === 'User' ? currentUser.username : 'all');

  // Fetch user transactions
  let transQuery = supabaseClient.from('transactions').select('*').order('created_at', { ascending: false });
  if (filterUser !== 'all') transQuery = transQuery.eq('username', filterUser);
  const { data: trans } = await transQuery;

  // Try to calculate missed tasks dynamically to mix into history
  const { data: rawTasks } = await supabaseClient.from('tasks').select('*');
  const tasks = unpackTasks(rawTasks);
  const { data: firstLog } = await supabaseClient.from('task_logs').select('created_at').eq('status', 'Approved').order('created_at', { ascending: true }).limit(1);

  let appStartDate = null;
  if (firstLog && firstLog.length > 0) {
    appStartDate = new Date(firstLog[0].created_at);
    appStartDate.setHours(0, 0, 0, 0);
  }

  const { data: logs } = await supabaseClient.from('task_logs').select('*').eq('status', 'Approved');

  const logMap = {};
  if (logs) logs.forEach(l => logMap[l.task_id + '_' + l.period_id] = true);

  let historyItems = [];

  // Prepare transaction items
  if (trans) {
    trans.forEach(t => {
      let actType = 'Earn';
      let actionText = 'Cộng điểm';
      let taskName = t.description;

      if (t.type === 'Spend') { 
          actType = 'Spend'; 
          actionText = 'Đổi quà'; 
          taskName = t.description.replace('Đổi quà: ', '').trim(); 
      }
      else if (t.type === 'Penalty') { 
          actType = 'Penalty'; 
          actionText = 'Bị trừ';
          taskName = t.description;
          if (taskName.startsWith('Chưa xong: ')) {
              actionText = 'Chưa xong';
              taskName = taskName.replace('Chưa xong: ', '').trim();
          } else if (taskName.startsWith('Bị trừ điểm: ')) {
              taskName = taskName.replace('Bị trừ điểm: ', '').trim();
          }
      }
      else { 
          actType = 'Earn'; 
          if (taskName.startsWith('Được duyệt: ')) {
              actionText = 'Được duyệt';
              taskName = taskName.replace('Được duyệt: ', '').trim();
          } else if (taskName.startsWith('Duyệt việc: ')) {
              actionText = 'Được duyệt';
              taskName = taskName.replace('Duyệt việc: ', '').trim();
          }
      }

      let fullName = t.username;
      if (typeof usersList !== 'undefined' && usersList) {
        const u = usersList.find(x => x.username === t.username);
        if (u && u.name) fullName = u.name;
      }

      historyItems.push({
        date: new Date(t.created_at),
        type: actType,
        actionText: actionText,
        taskName: taskName,
        userName: fullName,
        amount: t.amount
      });
    });
  }

  // Prepare missed tasks items
  if (appStartDate && tasks) {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    for (let d = new Date(appStartDate); d <= today; d.setDate(d.getDate() + 1)) {
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (dateStr >= todayStr) continue; // Only count past days

      if (checkIfHoliday(d, tasks)) continue; // Skip holidays!

      const dayOfWeek = d.getDay(); const dayOfWeekAdjusted = dayOfWeek === 0 ? 7 : dayOfWeek;
      const weekOfMonth = Math.ceil(d.getDate() / 7);
      const weekStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-W${weekOfMonth}`;

      tasks.forEach(t => {
        let isDue = false, pId = '';
        if (t.frequency === 'Daily') { isDue = true; pId = dateStr; }
        else if (t.frequency === 'Weekly' && t.schedule == dayOfWeekAdjusted) { isDue = true; pId = dateStr; }
        else if (t.frequency === 'Monthly' && t.schedule == weekOfMonth) { isDue = true; pId = weekStr; }
        else if (t.frequency === 'Adhoc' && t.schedule === dateStr) { isDue = true; pId = dateStr; }

        if (isDue && t.penalty > 0) {
          if (!logMap[t.id + '_' + pId]) {
            let shouldAdd = true;
            if (filterUser !== 'all' && t.calc_admin === false) {
              let userObj = usersList.find(u => u.username === filterUser) || currentUser;
              if (userObj.role === 'Admin' || userObj.role === 'Moderator') shouldAdd = false;
            }

            if (shouldAdd) {
              let fullName = 'Toàn Đội';
              if (filterUser !== 'all') {
                if (typeof usersList !== 'undefined' && usersList) {
                  const u = usersList.find(x => x.username === filterUser);
                  if (u && u.name) fullName = u.name;
                } else {
                  fullName = filterUser;
                }
              }

              historyItems.push({
                date: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59),
                type: 'Missed',
                actionText: 'Chưa xong',
                taskName: t.task_name,
                userName: fullName,
                amount: t.penalty
              });
            }
          }
        }
      });
    }
  }

  historyItems.sort((a, b) => b.date - a.date);
  showLoading(false);

  // Render Points (Mix of Earn, Missed, adjusted, spend...)
  const pContainer = document.getElementById('history-points-list'); pContainer.innerHTML = '';
  if (historyItems.length === 0) {
    pContainer.innerHTML = '<div class="text-center text-muted py-8 text-sm">Chưa có lịch sử nào.</div>';
  } else {
    historyItems.forEach(item => {
      const h = String(item.date.getHours()).padStart(2, '0');
      const m = String(item.date.getMinutes()).padStart(2, '0');
      const dateStr = item.type === 'Missed' ? item.date.toLocaleDateString('vi-VN') : `${h}:${m} ${item.date.toLocaleDateString('vi-VN')}`;

      let icon = 'fa-circle-check', valClass = 'text-success', sign = '+', bgAcc = 'bg-success', iconBg = 'bg-success/10 text-success', pillClass = 'bg-success/10 text-success border-success/20';
      
      if (item.type === 'Spend') { 
          icon = 'fa-gift'; valClass = 'text-yellow-500'; sign = '-'; 
          bgAcc = 'bg-amber-500'; iconBg = 'bg-amber-500/10 text-amber-500'; pillClass = 'bg-amber-500/10 text-yellow-500 border-yellow-500/20';
      }
      else if (item.type === 'Missed' || item.type === 'Penalty') { 
          icon = 'fa-triangle-exclamation'; valClass = 'text-red-500'; sign = '-'; 
          bgAcc = 'bg-red-500'; iconBg = 'bg-red-500/10 text-red-500'; pillClass = 'bg-red-500/10 text-red-500 border-red-500/20';
      }

      pContainer.innerHTML += `
            <div class="bg-card border border-borderline rounded-2xl p-0 shadow-sm flex items-stretch justify-between gap-0 hover:border-primary/30 transition-all hover:shadow-md group relative overflow-hidden">
                <div class="absolute inset-y-0 left-0 w-1 ${bgAcc} opacity-50"></div>
                
                <div class="flex flex-col items-center justify-center w-[76px] shrink-0 border-r border-borderline/50 pr-2 pl-3 py-3">
                    <div class="w-10 h-10 rounded-2xl ${iconBg} flex items-center justify-center text-xl shadow-inner group-hover:scale-110 transition-transform mb-1.5"><i class="fa-solid ${icon}"></i></div>
                    <div class="text-[9px] font-black text-center leading-tight ${valClass} uppercase tracking-wider">${item.actionText}</div>
                </div>
                
                <div class="flex-1 min-w-0 pl-3 pr-2 py-3 flex flex-col justify-center">
                    ${filterUser === 'all' || item.userName === 'Toàn Đội' ? `<div class="text-[11px] font-bold text-muted mb-0.5"><i class="fa-solid fa-user text-[9px] mr-1"></i>${item.userName}</div>` : ''}
                    <div class="font-bold text-main text-sm break-words whitespace-normal leading-snug">${item.taskName}</div>
                    <div class="text-[10px] text-muted mt-1.5 flex items-center gap-1.5"><i class="fa-regular fa-clock"></i> ${dateStr}</div>
                </div>
                
                <div class="pr-3.5 py-3 flex items-center justify-end shrink-0">
                    <div class="font-black text-sm px-2.5 py-1.5 rounded-xl ${pillClass} border">${sign}${item.amount}</div>
                </div>
            </div>`;
    });

    if (filterUser !== 'all') {
      let uPt = currentUser.points;
      if (filterUser !== currentUser.username) {
        let uObj = usersList.find(u => u.username === filterUser);
        if (uObj) uPt = uObj.points;
      }
      pContainer.innerHTML += `<div class="bg-primary/10 border border-primary/20 rounded-2xl p-4 shadow-sm flex justify-between mt-2">
                <span class="font-bold text-main text-sm">Tổng điểm của ${filterUser === currentUser.username ? 'bạn' : filterUser}:</span>
                <span class="font-black text-primary text-base">${uPt}</span>
            </div>`;
    }
  }

  // Render Rewards History
  const rContainer = document.getElementById('history-rewards-list'); rContainer.innerHTML = '';
  const rewardItems = historyItems.filter(i => i.type === 'Spend');
  if (rewardItems.length === 0) {
    rContainer.innerHTML = '<div class="text-center text-muted py-8 text-sm">Chưa đổi món quà nào.</div>';
  } else {
    rewardItems.forEach(item => {
      const dateStr = item.date.toLocaleDateString('vi-VN');
      rContainer.innerHTML += `
            <div class="bg-card border border-borderline rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3 hover:border-amber-500/30 transition-all hover:shadow-md group">
                <div class="w-12 h-12 shrink-0 rounded-2xl bg-amber-500/10 flex items-center justify-center text-2xl text-amber-500 shadow-inner group-hover:scale-110 transition-transform"><i class="fa-solid fa-gift"></i></div>
                <div class="flex-1 min-w-0 ml-1">
                    ${filterUser === 'all' ? `<div class="text-[11px] font-bold text-muted mb-0.5"><i class="fa-solid fa-user text-[9px] mr-1"></i>${item.userName}</div>` : ''}
                    <div class="font-bold text-main text-sm break-words whitespace-normal leading-snug mb-1">${item.taskName}</div>
                    <span class="text-[10px] text-muted flex items-center gap-1.5"><i class="fa-regular fa-clock"></i> ${dateStr}</span>
                </div>
                <div class="font-black text-sm text-yellow-500 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-yellow-500/20 shadow-inner">-${item.amount}</div>
            </div>`;
    });
  }
}

function switchReportTab(tab) {
  currentReportTab = tab;

  const rTTasks = document.getElementById('rtab-tasks');
  const rTLeaderboard = document.getElementById('rtab-leaderboard');
  if (tab === 'tasks') {
    rTTasks.className = 'flex-1 py-2 text-sm font-bold text-primary border-b-2 border-primary transition-colors';
    rTLeaderboard.className = 'flex-1 py-2 text-sm font-bold text-muted border-b-2 border-transparent transition-colors';
  } else {
    rTTasks.className = 'flex-1 py-2 text-sm font-bold text-muted border-b-2 border-transparent transition-colors';
    rTLeaderboard.className = 'flex-1 py-2 text-sm font-bold text-primary border-b-2 border-primary transition-colors';
  }

  const rcTasks = document.getElementById('report-content-tasks');
  const rcLeaderboard = document.getElementById('report-content-leaderboard');

  if (tab === 'tasks') {
    rcTasks.classList.remove('hidden');
    rcLeaderboard.classList.add('hidden');
  } else {
    rcTasks.classList.add('hidden');
    rcLeaderboard.classList.remove('hidden');
  }
}


async function loadReport(timeframe) {
  if (timeframe === 'custom') return toggleCustomDate();
  document.getElementById('custom-date-picker').classList.add('hidden'); currentReportTimeframe = timeframe;
  document.querySelectorAll('.report-filter').forEach(el => { el.classList.remove('bg-primary', 'text-main'); el.classList.add('bg-card', 'text-muted'); });
  document.getElementById(`filter-${timeframe}`).classList.remove('bg-card', 'text-muted'); document.getElementById(`filter-${timeframe}`).classList.add('bg-primary', 'text-main');

  const now = new Date(); let startDate = new Date(0), endDate = new Date('2099-01-01');
  if (timeframe === 'this_week') {
    const day = now.getDay(); const diff = now.getDate() - day + (day == 0 ? -6 : 1);
    startDate = new Date(now.setDate(diff)); startDate.setHours(0, 0, 0, 0);
    endDate = new Date(startDate); endDate.setDate(startDate.getDate() + 6); endDate.setHours(23, 59, 59, 999);
  }
  else if (timeframe === 'last_week') {
    const day = now.getDay(); const diff = now.getDate() - day + (day == 0 ? -6 : 1) - 7;
    startDate = new Date(now.setDate(diff)); startDate.setHours(0, 0, 0, 0);
    endDate = new Date(startDate); endDate.setDate(startDate.getDate() + 6); endDate.setHours(23, 59, 59, 999);
  }
  else if (timeframe === 'this_month') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1); endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  }
  loadReportData(startDate, endDate);
}

async function loadReportData(startDate, endDate) {
  document.getElementById('report-period').innerText = 'Đang tải...'; showLoading(true);

  const { data: users } = await supabaseClient.from('users').select('*');

  // Always fetch all data over the period to calculate the true leaderboard for everyone.
  let transQuery = supabaseClient.from('transactions').select('*').gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString());
  let logsQuery = supabaseClient.from('task_logs').select('*').gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString());

  const { data: trans } = await transQuery;
  const { data: logs } = await logsQuery;
  const { data: rawTasks } = await supabaseClient.from('tasks').select('*');
  const tasks = unpackTasks(rawTasks);

  showLoading(false);
  document.getElementById('report-period').innerText = `${startDate.toLocaleDateString('vi-VN')} - ${endDate.toLocaleDateString('vi-VN')}`;

  const { data: firstLog } = await supabaseClient.from('task_logs').select('created_at').eq('status', 'Approved').order('created_at', { ascending: true }).limit(1);
  let appStartDate = null;
  if (firstLog && firstLog.length > 0) {
    appStartDate = new Date(firstLog[0].created_at);
    appStartDate.setHours(0, 0, 0, 0);
  }

  currentReportData = { tasks: tasks || [], logs: logs || [], startDate, endDate, users: users || [], appStartDate, trans: trans || [] };

  // Set up filter dropdown
  const filterSelect = document.getElementById('report-user-filter');
  const existingVal = filterSelect.value;
  filterSelect.innerHTML = '';
  if (currentUser.role === 'User') {
    filterSelect.innerHTML = `<option value="${currentUser.username}">Việc của tôi (${currentUser.name})</option>`;
  } else {
    let html = '<option value="all">Tất cả thành viên</option>';
    (users || []).forEach(u => { html += `<option value="${u.username}">${u.name}</option>`; });
    filterSelect.innerHTML = html;
    if (existingVal) filterSelect.value = existingVal;
  }

  const reportData = {};
  if (users) users.forEach(u => reportData[u.username] = { name: u.name, earned: 0, spent: 0, penalty: 0, currentPoints: u.points, role: u.role });

  if (trans) trans.forEach(t => {
    if (reportData[t.username]) {
      if (t.type === 'Earn') reportData[t.username].earned += t.amount;
      if (t.type === 'Spend') reportData[t.username].spent += t.amount;
      if (t.type === 'Penalty') reportData[t.username].penalty += t.amount;
    }
  });

  // Dynamic penalty calculation for Leaderboard
  const actualEndDate = endDate > new Date() ? new Date() : endDate;
  let effectiveStartDate = new Date(startDate);
  if (appStartDate && effectiveStartDate < appStartDate) effectiveStartDate = new Date(appStartDate);

  const logMap = {};
  if (logs) logs.forEach(l => { if (l.status === 'Approved') logMap[l.task_id + '_' + l.period_id] = true; });

  const todayStrGlobal = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;

  for (let d = new Date(effectiveStartDate); d <= actualEndDate; d.setDate(d.getDate() + 1)) {
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    // Skip future and today for penalty
    if (dateStr >= todayStrGlobal) continue;

    // Also skip holidays! (Assume holidays computation applies later, let's ensure we can patch it in)
    if (checkIfHoliday(d, tasks)) continue;

    const dayOfWeek = d.getDay(); const dayOfWeekAdjusted = dayOfWeek === 0 ? 7 : dayOfWeek;
    const weekOfMonth = Math.ceil(d.getDate() / 7);
    const weekStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-W${weekOfMonth}`;

    if (tasks) tasks.forEach(t => {
      let isDue = false, pId = '';
      if (t.frequency === 'Daily') { isDue = true; pId = dateStr; }
      else if (t.frequency === 'Weekly' && t.schedule == dayOfWeekAdjusted) { isDue = true; pId = dateStr; }
      else if (t.frequency === 'Monthly' && t.schedule == weekOfMonth) { isDue = true; pId = weekStr; }
      else if (t.frequency === 'Adhoc' && t.schedule === dateStr) { isDue = true; pId = dateStr; }

      if (isDue && t.penalty > 0) {
        if (!logMap[t.id + '_' + pId]) {
          // Missed task, apply penalty to everyone legally liable
          Object.keys(reportData).forEach(username => {
            let shouldPenalize = true;
            if (t.calc_admin === false) {
              const role = reportData[username].role;
              if (role === 'Admin' || role === 'Moderator') shouldPenalize = false;
            }
            if (shouldPenalize) {
              reportData[username].penalty += Number(t.penalty || 0);
            }
          });
        }
      }
    });
  }

  const leaderboard = Object.keys(reportData).map(k => ({ username: k, ...reportData[k] })).sort((a, b) => {
    const scoreA = a.earned - a.penalty;
    const scoreB = b.earned - b.penalty;
    return scoreB - scoreA;
  });

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

  let effectiveStartDate = new Date(startDate);
  if (currentReportData.appStartDate && effectiveStartDate < currentReportData.appStartDate) {
    effectiveStartDate = new Date(currentReportData.appStartDate);
  }

  for (let d = new Date(effectiveStartDate); d <= actualEndDate; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay(); const dayOfWeekAdjusted = dayOfWeek === 0 ? 7 : dayOfWeek;
    const weekOfMonth = Math.ceil(d.getDate() / 7);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const weekStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-W${weekOfMonth}`;

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
          const todayStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
          if (t.penalty > 0 && filterUser === 'all' && dateStr < todayStr) {
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
  const completedArr = Object.values(completedMap).filter(x => x.times > 0).sort((a, b) => b.times - a.times);
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
  const missedArr = Object.values(missedMap).filter(x => x.times > 0).sort((a, b) => b.times - a.times);
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

  if (data.length === 0) return container.innerHTML = '<div class="text-center text-muted py-4 text-sm">Chưa có dữ liệu.</div>';
  data.forEach((user, index) => {
    let rankIcon = `<div class="w-6 h-6 rounded-full bg-surface text-muted flex items-center justify-center text-xs font-bold">${index + 1}</div>`;
    if (index === 0) rankIcon = `<i class="fa-solid fa-crown text-yellow-500 text-2xl drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]"></i>`;
    else if (index === 1) rankIcon = `<i class="fa-solid fa-medal text-gray-300 text-xl"></i>`;
    else if (index === 2) rankIcon = `<i class="fa-solid fa-medal text-amber-600 text-xl"></i>`;

    container.innerHTML += `
        <div class="bg-card border ${user.username === currentUser.username ? 'border-primary shadow-md bg-primary/5' : 'border-borderline shadow-sm'} rounded-2xl p-4 flex items-center gap-4 hover:border-primary/30 transition-all">
            <div class="w-8 flex justify-center">${rankIcon}</div>
            <div class="flex-1">
                <div class="font-bold text-main text-sm">${user.name} ${user.username === currentUser.username ? '<span class="text-primary text-[10px] ml-1 bg-primary/10 px-1 rounded font-black border border-primary/20">(Bạn)</span>' : ''}</div>
                <div class="text-[11px] text-muted">Hiện có: <span class="text-primary font-bold">${user.currentPoints}</span> pts</div>
            </div>
            <div class="text-right space-y-1 bg-input px-3 py-1.5 rounded-lg border border-borderline">
                <div class="text-xs text-success font-bold"><i class="fa-solid fa-arrow-trend-up mr-1 text-[10px]"></i>+${user.earned}</div>
                <div class="text-[10px] font-bold text-red-500"><i class="fa-solid fa-arrow-trend-down mr-1 text-[10px]"></i>-${user.penalty}</div>
            </div>
        </div>`;
  });
}

async function loadAdminData(type) {
  currentAdminType = type;
  document.querySelectorAll('#view-admin button[id^="admin-tab-"]').forEach(el => { el.classList.remove('bg-surface', 'text-main'); el.classList.add('text-muted'); });
  document.getElementById(`admin-tab-${type}`).classList.add('bg-surface', 'text-main'); document.getElementById(`admin-tab-${type}`).classList.remove('text-muted');

  const addBtn = document.getElementById('admin-add-btn');
  const resetBtn = document.getElementById('admin-reset-btn');

  if (type === 'approvals') {
    addBtn.style.display = 'none'; resetBtn.style.display = 'none'; loadApprovals();
  } else {
    addBtn.style.display = 'flex';
    resetBtn.style.display = (type === 'users' && currentUser.role === 'Admin') ? 'flex' : 'none';

    addBtn.onclick = () => openModal(type);
    showLoading(true); let data = [];
    if (type === 'users') {
      const res = await supabaseClient.from('users').select('*'); data = res.data || [];
      if (currentUser.role === 'Moderator') data = data.filter(u => u.role === 'User');
    }
    else if (type === 'tasks') { const res = await supabaseClient.from('tasks').select('*'); data = unpackTasks(res.data || []).filter(t => t.frequency !== 'Holiday'); }
    else if (type === 'holidays') { const res = await supabaseClient.from('tasks').select('*'); data = unpackTasks(res.data || []).filter(t => t.frequency === 'Holiday'); }
    else if (type === 'rewards') { const res = await supabaseClient.from('rewards').select('*'); data = res.data || []; }
    showLoading(false); renderAdminList(type, data);
  }
}

async function loadApprovals() {
  showLoading(true); const { data, error } = await supabaseClient.from('task_logs').select('*, tasks(*), users(*)').eq('status', 'Pending Approval'); showLoading(false);
  if (data) {
    data.forEach(item => {
      if (item.tasks && item.tasks.icon && item.tasks.icon.includes('|')) {
        const parts = item.tasks.icon.split('|');
        item.tasks.icon = parts[0];
        item.tasks.schedule = parts[1];
      }
    });
  }
  const container = document.getElementById('admin-list-container'); container.innerHTML = '';

  if (error) return showToast(error.message, 'error');
  if (!data || data.length === 0) return container.innerHTML = '<div class="text-center text-muted py-8 text-sm">Quá mượt! Không có việc chờ duyệt.</div>';

  data.forEach(item => {
    container.innerHTML += `
        <div class="bg-card border border-borderline rounded-2xl p-4 shadow-sm hover:border-primary/50 transition-all mb-3">
            <div class="flex justify-between items-start mb-2">
                <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-xl bg-surface flex items-center justify-center text-primary shadow-inner text-base"><i class="${item.tasks?.icon || 'fa-solid fa-clipboard-list'}"></i></div>
                    <div>
                        <h4 class="font-bold text-main text-sm max-w-[150px] leading-tight mb-1">${item.tasks?.task_name}</h4>
                        <div class="text-xs text-muted">Bởi: <span class="text-main font-bold">${item.users?.name || item.username}</span></div>
                    </div>
                </div>
                <div class="text-success font-black text-sm bg-success/10 px-2 py-1 rounded border border-success/20">+${item.tasks?.points}</div>
            </div>
            <div class="flex gap-2 mt-4">
                <button onclick="approveTask('${item.id}', false, '${item.username}', ${item.tasks?.points}, '${item.tasks?.task_name}')" class="flex-1 py-2 rounded-xl bg-red-500/10 text-red-500 text-xs font-bold active-scale">Từ chối</button>
                <button onclick="approveTask('${item.id}', true, '${item.username}', ${item.tasks?.points}, '${item.tasks?.task_name}', ${item.tasks?.calc_admin ?? true})" class="flex-1 py-2 rounded-xl bg-success text-white text-xs font-bold active-scale shadow-lg shadow-success/30">Duyệt & Cộng Điểm</button>
            </div>
        </div>`;
  });
}

async function approveTask(logId, isApproved, username, points, taskName, calcAdmin = true) {
  showLoading(true); const status = isApproved ? 'Approved' : 'Rejected';
  await supabaseClient.from('task_logs').update({ status: status, approved_by: currentUser.username }).eq('id', logId);
  if (isApproved) {
    const { data: uData } = await supabaseClient.from('users').select('points, role').eq('username', username).single();
    if (uData) {
      let finalPoints = points;
      if (calcAdmin === false && (uData.role === 'Admin' || uData.role === 'Moderator')) {
        finalPoints = 0;
      }
      if (finalPoints > 0) {
        await supabaseClient.from('users').update({ points: uData.points + finalPoints }).eq('username', username);
        await supabaseClient.from('transactions').insert([{ username: username, type: 'Earn', amount: finalPoints, description: `Được duyệt: ${taskName}` }]);
      }
    }
  }
  refreshUserPoints(); showLoading(false); showToast(isApproved ? 'Đã xử lý!' : 'Đã từ chối.', isApproved ? 'success' : 'error'); loadApprovals();
}

function renderAdminList(type, data) {
  const container = document.getElementById('admin-list-container'); container.innerHTML = '';
  if (data.length === 0) return container.innerHTML = '<div class="text-center text-muted py-8 text-sm bg-card border border-dashed border-borderline rounded-2xl">Chưa có dữ liệu.</div>';

  data.forEach(item => {
    let title = '', subtitle = '', id = '', prefixHTML = '', actionHTML = '';
    if (type === 'users') {
      id = item.username; title = item.name;
      subtitle = `<span class="bg-surface px-1.5 rounded items-center mr-1">${item.role}</span> <span class="text-yellow-500 font-bold">${item.points} pts</span>`;
      prefixHTML = `<div class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-inner overflow-hidden ${item.avatar ? 'bg-surface' : 'bg-gradient-to-tr from-primary to-purple-500'}">${item.avatar && item.avatar.trim() !== '' ? `<img src="${item.avatar}" class="w-full h-full object-cover">` : item.name.charAt(0)}</div>`;
      actionHTML = `<button onclick="openAdjustModal('${item.username}', '${item.name}')" class="w-8 h-8 rounded-lg bg-success/10 text-success flex items-center justify-center active-scale mr-1"><i class="fa-solid fa-coins text-xs"></i></button>`;
    }
    else if (type === 'tasks') {
      id = item.id; title = item.task_name;
      let freqBadge = item.frequency === 'Daily' ? 'Hàng ngày' : (item.frequency === 'Weekly' ? 'Hàng tuần' : (item.frequency === 'Monthly' ? 'Hàng tháng' : 'Sự vụ'));
      subtitle = `<span class="bg-surface px-1.5 rounded">${freqBadge}</span> | <span class="text-success font-bold">+${item.points}</span> / <span class="text-red-400 font-bold">-${item.penalty}</span>`;
      prefixHTML = `<div class="w-10 h-10 rounded-xl bg-surface flex items-center justify-center text-primary shadow-inner text-base"><i class="${item.icon || 'fa-solid fa-clipboard-list'}"></i></div>`;
    }
    else if (type === 'holidays') {
      id = item.id; title = item.task_name || 'Nghỉ lễ';
      let dateRange = '';
      if (item.schedule) {
        let parts = item.schedule.split('_');
        let startD = parts[0] ? parts[0].split('-').reverse().join('-') : '';
        let endD = parts[1] ? parts[1].split('-').reverse().join('-') : '';
        dateRange = `${startD} đến ${endD}`;
      }
      subtitle = `<span class="bg-teal-500/10 text-teal-500 px-1.5 rounded font-bold">${dateRange}</span>`;
      prefixHTML = `<div class="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-500 shadow-inner text-base"><i class="fa-solid fa-umbrella-beach"></i></div>`;
    }
    else if (type === 'rewards') {
      id = item.id; title = item.reward_name;
      subtitle = `<span class="text-yellow-500 font-bold">${item.cost} pts</span>`;
      prefixHTML = `<div class="w-10 h-10 rounded-xl bg-surface flex items-center justify-center text-amber-500 shadow-inner text-base"><i class="${item.icon || 'fa-solid fa-gift'}"></i></div>`;
    }

    window[`editData_${id}`] = item;
    container.innerHTML += `
        <div class="bg-card border border-borderline rounded-2xl p-4 flex justify-between items-center shadow-sm">
            <div class="flex gap-3 items-center">
                ${prefixHTML}
                <div><h4 class="font-bold text-main text-sm mb-1">${title}</h4><div class="text-[10px] text-muted flex items-center">${subtitle}</div></div>
            </div>
            <div class="flex gap-1.5">
                ${actionHTML}
                <button onclick="openModal('${type}', window['editData_${id}'])" class="w-8 h-8 rounded-lg bg-surface text-main flex items-center justify-center active-scale"><i class="fa-solid fa-pen text-xs"></i></button>
                <button onclick="deleteData('${type}', '${id}')" class="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center active-scale"><i class="fa-solid fa-trash text-xs"></i></button>
            </div>
        </div>`;
  });
}

function handleFreqChange() {
  const freq = document.getElementById('inp-tfreq').value;
  const schedContainer = document.getElementById('sched-container');
  if (freq === 'Daily') schedContainer.innerHTML = '';
  else if (freq === 'Weekly') {
    schedContainer.innerHTML = `
            <select id="inp-tsched" class="w-full bg-input border border-borderline rounded-xl px-4 py-3.5 text-main text-sm font-medium outline-none mb-3">
                <option value="1">Thứ 2</option><option value="2">Thứ 3</option><option value="3">Thứ 4</option>
                <option value="4">Thứ 5</option><option value="5">Thứ 6</option><option value="6">Thứ 7</option><option value="7">Chủ Nhật</option>
            </select>`;
  } else if (freq === 'Monthly') {
    schedContainer.innerHTML = `
            <select id="inp-tsched" class="w-full bg-input border border-borderline rounded-xl px-4 py-3.5 text-main text-sm font-medium outline-none mb-3">
                <option value="1">Tuần 1</option><option value="2">Tuần 2</option><option value="3">Tuần 3</option><option value="4">Tuần 4</option>
            </select>`;
  } else if (freq === 'Adhoc') {
    schedContainer.innerHTML = `
            <input id="inp-tsched" type="date" class="w-full bg-input border border-borderline rounded-xl px-4 py-3.5 text-main text-sm font-medium outline-none mb-3">
        `;
  }
}

function selectIcon(iconClass) {
  document.getElementById('inp-icon').value = iconClass;
  document.querySelectorAll('.icon-option').forEach(el => { el.classList.remove('bg-primary', 'text-main', 'ring-2', 'ring-primary'); el.classList.add('bg-surface', 'text-muted'); });
  const formattedId = iconClass.replace(/ /g, '-');
  const selectedEl = document.getElementById('icon-' + formattedId);
  if (selectedEl) { selectedEl.classList.remove('bg-surface', 'text-muted'); selectedEl.classList.add('bg-primary', 'text-main', 'ring-2', 'ring-primary'); }
}

function openModal(type, item = null) {
  const modal = document.getElementById('admin-modal'); document.getElementById('modal-title').innerText = item ? 'Chỉnh sửa' : 'Thêm mới';
  const body = document.getElementById('modal-body'); const saveBtn = document.getElementById('modal-save-btn'); body.innerHTML = '';

  let iconGridHtml = '';
  if (type === 'tasks' || type === 'rewards') {
    iconGridHtml = `
            <label class="block text-[10px] text-muted mb-2 font-bold tracking-wider">CHỌN THẾ TÂN (ICON)</label>
            <div class="grid grid-cols-6 gap-2 mb-4" id="icon-picker">
                ${ICONS.map(i => `<div onclick="selectIcon('${i}')" id="icon-${i.replace(/ /g, '-')}" class="icon-option w-full aspect-square flex items-center justify-center rounded-xl bg-surface cursor-pointer active-scale text-muted shadow-sm text-base"><i class="${i}"></i></div>`).join('')}
            </div>
            <input type="hidden" id="inp-icon" value="${item && item.icon ? item.icon : ICONS[0]}">
        `;
  }

  if (type === 'users') {
    let roleOpts = currentUser.role === 'Admin' ?
      `<option value="User" ${item && item.role === 'User' ? 'selected' : ''}>User</option>
             <option value="Moderator" ${item && item.role === 'Moderator' ? 'selected' : ''}>Moderator</option>
             <option value="Admin" ${item && item.role === 'Admin' ? 'selected' : ''}>Admin</option>` : `<option value="User" selected>User</option>`;

    body.innerHTML = `
            <input id="inp-username" type="text" placeholder="Tên user" class="w-full bg-input border border-borderline rounded-xl px-4 py-3.5 text-main text-sm font-medium outline-none mb-3" value="${item ? item.username : ''}" ${item ? 'disabled' : ''}>
            <input id="inp-name" type="text" placeholder="Tên hiển thị" class="w-full bg-input border border-borderline rounded-xl px-4 py-3.5 text-main text-sm font-medium outline-none mb-3" value="${item ? item.name : ''}">
            <select id="inp-role" class="w-full bg-input border border-borderline rounded-xl px-4 py-3.5 text-main text-sm font-medium outline-none mb-3">${roleOpts}</select>
            <input id="inp-password" type="text" placeholder="Mật khẩu" class="w-full bg-input border border-borderline rounded-xl px-4 py-3.5 text-main text-sm font-medium outline-none mb-3" value="${item ? item.password : ''}">
            <input id="inp-avatar" type="text" placeholder="URL Hình Avatar" class="w-full bg-input border border-borderline rounded-xl px-4 py-3.5 text-main text-sm font-medium outline-none" value="${item && item.avatar ? item.avatar : ''}">
        `;
  } else if (type === 'tasks') {
    body.innerHTML = `
            <input id="inp-tname" type="text" placeholder="Tên việc" class="w-full bg-input border border-borderline rounded-xl px-4 py-3.5 text-main text-sm font-medium outline-none mb-3" value="${item ? item.task_name : ''}">
            ${iconGridHtml}
            <select id="inp-tfreq" onchange="handleFreqChange()" class="w-full bg-input border border-borderline rounded-xl px-4 py-3.5 text-main text-sm font-medium outline-none mb-3">
                <option value="Daily" ${item && item.frequency === 'Daily' ? 'selected' : ''}>Hàng ngày</option>
                <option value="Weekly" ${item && item.frequency === 'Weekly' ? 'selected' : ''}>Hàng tuần</option>
                <option value="Monthly" ${item && item.frequency === 'Monthly' ? 'selected' : ''}>Hàng tháng</option>
                <option value="Adhoc" ${item && item.frequency === 'Adhoc' ? 'selected' : ''}>Sự vụ / Làm thêm</option>
            </select>
            <div id="sched-container"></div>
            <div class="grid grid-cols-2 gap-3 mt-4">
                <div><label class="block text-[10px] text-muted mb-1 font-bold">THƯỞNG (+)</label><input id="inp-tpoints" type="number" placeholder="Điểm" class="w-full bg-input border border-borderline rounded-xl px-4 py-3.5 text-main text-sm font-black outline-none text-success" value="${item ? item.points : ''}"></div>
                <div><label class="block text-[10px] text-muted mb-1 font-bold">PHẠT (-)</label><input id="inp-tpenalty" type="number" placeholder="Điểm" class="w-full bg-input border border-borderline rounded-xl px-4 py-3.5 text-main text-sm font-black outline-none text-red-500" value="${item ? item.penalty : '0'}"></div>
            </div>
            <div class="mt-4">
                <label class="block text-[10px] text-muted mb-1 font-bold uppercase">Tính điểm cho Admin & Moderator</label>
                <select id="inp-tcalcadmin" class="w-full bg-input border border-borderline rounded-xl px-4 py-3 text-main text-sm font-medium outline-none">
                    <option value="true" ${!item || item.calc_admin !== false ? 'selected' : ''}>Có cộng/trừ bình thường</option>
                    <option value="false" ${item && item.calc_admin === false ? 'selected' : ''}>Không tính điểm</option>
                </select>
            </div>
        `;
    setTimeout(() => { handleFreqChange(); if (item && item.schedule && document.getElementById('inp-tsched')) document.getElementById('inp-tsched').value = item.schedule; selectIcon(item && item.icon ? item.icon : ICONS[0]); }, 10);
  } else if (type === 'rewards') {
    body.innerHTML = `
            <input id="inp-rname" type="text" placeholder="Tên quà" class="w-full bg-input border border-borderline rounded-xl px-4 py-3.5 text-main text-sm font-medium outline-none mb-3" value="${item ? item.reward_name : ''}">
            ${iconGridHtml}
            <label class="block text-[10px] text-muted mb-1 mt-3 font-bold">GIÁ ĐỔI QUÀ</label>
            <input id="inp-rcost" type="number" placeholder="Pts" class="w-full bg-input border border-borderline rounded-xl px-4 py-3.5 text-main text-sm font-black outline-none text-yellow-500" value="${item ? item.cost : ''}">
        `;
    setTimeout(() => { selectIcon(item && item.icon ? item.icon : ICONS[19]); }, 10);
  } else if (type === 'holidays') {
    let scheduleVal = item ? item.schedule : '';
    let startVal = scheduleVal ? scheduleVal.split('_')[0] : '';
    let endVal = scheduleVal ? scheduleVal.split('_')[1] : '';
    body.innerHTML = `
            <input id="inp-hname" type="text" placeholder="Tên kỳ nghỉ (vd: Tết Nguyên Đán)" class="w-full bg-input border border-borderline rounded-xl px-4 py-3.5 text-main text-sm font-medium outline-none mb-3" value="${item ? item.task_name : ''}">
            <div class="flex gap-3 mb-3">
                <div class="flex-1"><label class="block text-[10px] text-muted mb-1 font-bold">TỪ NGÀY</label><input type="date" id="inp-hstart" class="w-full bg-input border border-borderline rounded-xl px-3 py-2 text-main text-xs outline-none" value="${startVal}"></div>
                <div class="flex-1"><label class="block text-[10px] text-muted mb-1 font-bold">ĐẾN NGÀY</label><input type="date" id="inp-hend" class="w-full bg-input border border-borderline rounded-xl px-3 py-2 text-main text-xs outline-none" value="${endVal}"></div>
            </div>
            <input type="hidden" id="inp-icon" value="fa-solid fa-umbrella-beach">
            <input type="hidden" id="inp-tfreq" value="Holiday">
        `;
  }

  modal.classList.remove('hidden'); saveBtn.onclick = () => saveData(type, item ? (type === 'users' ? item.username : item.id) : null);
}

function closeModal() { document.getElementById('admin-modal').classList.add('hidden'); }

async function saveData(type, id) {
  showLoading(true); let error = null;
  try {
    if (type === 'users') {
      const data = { username: document.getElementById('inp-username').value.trim(), name: document.getElementById('inp-name').value, role: document.getElementById('inp-role').value, password: document.getElementById('inp-password').value, avatar: document.getElementById('inp-avatar').value };
      if (id) { const res = await supabaseClient.from('users').update(data).eq('username', id); error = res.error; }
      else { const res = await supabaseClient.from('users').insert([data]); error = res.error; }
    } else if (type === 'tasks' || type === 'holidays') {
      const name = type === 'tasks' ? document.getElementById('inp-tname').value : document.getElementById('inp-hname').value;
      const freq = type === 'tasks' ? document.getElementById('inp-tfreq').value : 'Holiday';
      const icon = type === 'tasks' ? document.getElementById('inp-icon').value : 'fa-solid fa-umbrella-beach';
      const pts = type === 'tasks' ? document.getElementById('inp-tpoints').value : 0;
      const pen = type === 'tasks' ? (document.getElementById('inp-tpenalty').value || 0) : 0;
      const calc_admin = type === 'tasks' ? document.getElementById('inp-tcalcadmin').value === 'true' : false;
      let sched = null;
      if (type === 'tasks') {
        sched = document.getElementById('inp-tsched') ? document.getElementById('inp-tsched').value : null;
      } else {
        const sDate = document.getElementById('inp-hstart').value;
        const eDate = document.getElementById('inp-hend').value;
        if (!sDate || !eDate || eDate < sDate) { showLoading(false); return showToast('Vui lòng chọn ngày hợp lệ.', 'error'); }
        sched = `${sDate}_${eDate}`;
      }

      let finalSched = sched;
      let finalIcon = icon;
      if (freq === 'Daily') { finalSched = null; }
      else if (freq === 'Weekly' || freq === 'Monthly') { finalSched = sched ? parseInt(sched) : null; }
      else if (freq === 'Adhoc' || freq === 'Holiday') { finalSched = null; finalIcon = `${icon}|${sched}`; }

      const data = { task_name: name, icon: finalIcon, frequency: freq, schedule: finalSched, points: pts, penalty: pen, calc_admin: calc_admin };
      if (id) { const res = await supabaseClient.from('tasks').update(data).eq('id', id); error = res.error; }
      else { const res = await supabaseClient.from('tasks').insert([data]); error = res.error; }
    } else if (type === 'rewards') {
      const data = { reward_name: document.getElementById('inp-rname').value, icon: document.getElementById('inp-icon').value, cost: document.getElementById('inp-rcost').value };
      if (id) { const res = await supabaseClient.from('rewards').update(data).eq('id', id); error = res.error; }
      else { const res = await supabaseClient.from('rewards').insert([data]); error = res.error; }
    }
  } catch (err) { error = err; }
  showLoading(false); if (error) return showToast(error.message, 'error');
  showToast('Lưu thành công!', 'mega-success'); closeModal(); loadAdminData(type);
}

async function deleteData(type, id) {
  if (!confirm('Chắc chắn xoá luôn ?')) return;
  showLoading(true); let error = null;
  if (type === 'users') { const res = await supabaseClient.from('users').delete().eq('username', id); error = res.error; }
  else if (type === 'tasks' || type === 'holidays') { const res = await supabaseClient.from('tasks').delete().eq('id', id); error = res.error; }
  else if (type === 'rewards') { const res = await supabaseClient.from('rewards').delete().eq('id', id); error = res.error; }
  showLoading(false); if (error) return showToast(error.message, 'error');
  showToast('Đã xoá!'); loadAdminData(type);
}

// ------ TÍNH NĂNG ADMIN MỚI -------
function openAdjustModal(username, name) {
  window.currentAdjustUser = username;
  document.getElementById('adj-username').innerText = name;
  document.getElementById('adj-amount').value = '';
  document.getElementById('adj-reason').value = '';
  document.getElementById('adjust-modal').classList.remove('hidden');
  document.getElementById('adjust-modal').classList.add('flex');
}

function closeAdjustModal() {
  document.getElementById('adjust-modal').classList.add('hidden');
  document.getElementById('adjust-modal').classList.remove('flex');
}

async function saveAdjustPoints() {
  const amount = parseInt(document.getElementById('adj-amount').value);
  const type = document.getElementById('adj-type').value;
  const reason = document.getElementById('adj-reason').value.trim();
  if (!amount || amount <= 0) return showToast('Nhập số điểm hợp lệ!', 'error');
  if (!reason) return showToast('Vui lòng nhập lý do!', 'error');

  showLoading(true);
  const { data: uData } = await supabaseClient.from('users').select('points').eq('username', window.currentAdjustUser).single();
  if (uData) {
    const newPoints = type === 'add' ? uData.points + amount : Math.max(0, uData.points - amount);
    const logType = type === 'add' ? 'Earn' : 'Penalty';
    await supabaseClient.from('users').update({ points: newPoints }).eq('username', window.currentAdjustUser);
    await supabaseClient.from('transactions').insert([{ username: window.currentAdjustUser, type: logType, amount: amount, description: `[Admin/Mod] ${reason}` }]);
  }
  showLoading(false);
  showToast('Cập nhật điểm cái rẹt thành công!', 'mega-success');
  closeAdjustModal(); loadAdminData('users');
}

async function resetAllPoints() {
  if (!confirm('CẢNH BÁO: Hành động này sẽ đưa ĐIỂM CỦA TẤT CẢ USER VỀ 0. Dữ liệu giao dịch cũ vẫn được giữ nhưng điểm hiện tại sẽ mất. Bạn chắc chắn chứ?')) return;
  showLoading(true);
  const { data: users } = await supabaseClient.from('users').select('username');
  if (users) {
    for (let u of users) {
      await supabaseClient.from('users').update({ points: 0 }).eq('username', u.username);
      await supabaseClient.from('transactions').insert([{ username: u.username, type: 'Penalty', amount: 0, description: `HỆ THỐNG RESET ĐIỂM VÀO ĐẦU KỲ` }]);
    }
  }
  showLoading(false);
  showToast('Boom! Đã reset điểm toàn hệ thống về 0.', 'mega-success');
  loadAdminData('users');
}

window.onload = () => { setTimeout(checkLoginStatus, 500); };

// --- THEMES ---
const THEMES = [
  { id: 'dark', name: 'Đêm sâu', icon: 'fa-moon', bg: '#1A1D24', primary: '#3B82F6' },
  { id: 'light', name: 'Sáng sủa', icon: 'fa-sun', bg: '#FFFFFF', primary: '#8B5CF6' },
  { id: 'sakura', name: 'Hoa anh đào', icon: 'fa-spa', bg: '#FFE4E6', primary: '#F43F5E' },
  { id: 'matcha', name: 'Trà xanh mộc', icon: 'fa-leaf', bg: '#D1FAE5', primary: '#10B981' },
  { id: 'cyberpunk', name: 'Neon Cyber', icon: 'fa-bolt', bg: '#1E1B4B', primary: '#EAB308' }
];

function openThemeModal() {
  const container = document.getElementById('theme-options-container'); container.innerHTML = '';
  const currentMode = localStorage.getItem('housework_theme') || 'dark';
  THEMES.forEach(t => {
    const isSelected = currentMode === t.id;
    container.innerHTML += `
        <div onclick="setAppTheme('${t.id}')" class="flex items-center justify-between p-4 rounded-xl border ${isSelected ? 'border-primary bg-primary/10' : 'border-borderline bg-input'} cursor-pointer active-scale mb-2 transition-all shadow-sm">
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
  if (themeId === 'dark') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', themeId);
  localStorage.setItem('housework_theme', themeId); openThemeModal();
}
