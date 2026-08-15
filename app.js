const SUPABASE_URL = 'https://akgrmxazfgwbnpqupmor.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_L6pJkJPwbOoEDDbNXhL_PQ_oq2nm-rC';
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

let currentUser = null;
let currentAdminType = 'approvals';
let currentReportTimeframe = 'this_week';
let currentReportTab = 'tasks';
let currentApprovalFilter = 'Pending Approval';
let currentHistoryTab = 'points';
let _cachedAppStartDate = null;
let _historyCache = null;
let _historyCacheFilter = null;
let _reportDataCache = null;
let _reportCacheKey = null;
let _leaderboardRendered = false;
let _rewardsTabRendered = false;
let _redeemInFlight = false;

let familySettings = {
    claim_max_days: 2,
    claim_points_percent: 50,
    schedule_enabled: true,
    schedule_register_days: '6,7'
};

const ICONS = ['fa-solid fa-clipboard-list', 'fa-solid fa-broom', 'fa-solid fa-trash', 'fa-solid fa-shirt', 'fa-solid fa-utensils', 'fa-solid fa-droplet', 'fa-solid fa-leaf', 'fa-solid fa-cart-shopping', 'fa-solid fa-book', 'fa-solid fa-sink', 'fa-solid fa-bath', 'fa-solid fa-dog', 'fa-solid fa-cat', 'fa-solid fa-box', 'fa-solid fa-gamepad', 'fa-solid fa-ticket', 'fa-solid fa-tv', 'fa-solid fa-mug-hot', 'fa-solid fa-star', 'fa-solid fa-gift', 'fa-solid fa-medal', 'fa-solid fa-motorcycle', 'fa-solid fa-car', 'fa-solid fa-money-bill', 'fa-solid fa-fire', 'fa-solid fa-rocket', 'fa-solid fa-bolt'];

// === ROLE HELPERS ===
function isSuperAdmin() { return currentUser && currentUser.role === 'Super Admin'; }
function isAdmin() { return currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Super Admin'); }
function isAdminOrMod() { return currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Super Admin' || currentUser.role === 'Moderator'); }
function getFamilyId() { return currentUser ? currentUser.family_id : null; }

function showLoading(show) { document.getElementById('loading-overlay').style.display = show ? 'flex' : 'none'; }

// === ESCAPING ===
// Text hiển thị trong HTML.
function escHtml(v) {
  return String(v === null || v === undefined ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
// Chuỗi nằm trong nháy đơn của JS, bên trong thuộc tính onclick="..." (2 lớp escape).
function escJsAttr(v) {
  return String(v === null || v === undefined ? '' : v)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/[\r\n]+/g, ' ');
}

// === ĐIỂM: cộng/trừ an toàn ===
// Đọc điểm mới nhất rồi ghi kèm điều kiện "điểm chưa đổi" (optimistic lock).
// Nếu có thiết bị khác vừa ghi, thử lại thay vì ghi đè mất dữ liệu.
async function adjustUserPoints(username, delta, opts = {}) {
  const floorAtZero = opts.floorAtZero !== false; // mặc định không cho âm
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data: u, error: readErr } = await supabaseClient.from('users').select('points').eq('username', username).single();
    if (readErr || !u) return { error: 'Không tìm thấy thành viên.' };
    const cur = u.points === null || u.points === undefined ? 0 : Number(u.points);
    let next = cur + delta;
    if (floorAtZero && next < 0) next = 0;
    let q = supabaseClient.from('users').update({ points: next }).eq('username', username);
    q = (u.points === null || u.points === undefined) ? q.is('points', null) : q.eq('points', u.points);
    const { data: rows, error: writeErr } = await q.select('points');
    if (writeErr) return { error: writeErr.message };
    if (rows && rows.length > 0) return { points: rows[0].points, previous: cur };
    // Không nhận được dòng trả về: có thể do người khác vừa ghi, cũng có thể do
    // server không trả representation. Đọc lại để không cộng/trừ lần thứ hai.
    const { data: after } = await supabaseClient.from('users').select('points').eq('username', username).single();
    if (after && Number(after.points) === next) return { points: next, previous: cur };
  }
  return { error: 'Điểm đang được cập nhật ở nơi khác, bạn thử lại sau vài giây nhé!' };
}

// === BADGE & NHẮC VIỆC ===
// Đếm số việc đang chờ để chấm đỏ / con số hiện ngay trên nav và menu quản trị,
// thay vì bắt người dùng tự mò vào từng tab kiểm tra.
let pendingCounts = { myRewards: 0, orders: 0, grants: 0, approvals: 0 };

async function refreshPendingBadges() {
  if (!currentUser || !supabaseClient) return;
  try {
    // Việc của chính mình: quà đã trao chờ mình xác nhận + điểm thưởng chờ mình nhận.
    const mineQuery = supabaseClient.from('reward_redemptions').select('id, kind, status')
      .eq('username', currentUser.username).in('status', ['delivered', 'pending_claim']);

    const jobs = [mineQuery];
    if (isAdminOrMod()) {
      let usersQuery = supabaseClient.from('users').select('username');
      if (getFamilyId()) usersQuery = usersQuery.eq('family_id', getFamilyId());
      const { data: fam } = await usersQuery;
      const usernames = (fam || []).map(u => u.username);

      let openQuery = supabaseClient.from('reward_redemptions').select('id, kind, status')
        .in('status', ['pending_delivery', 'delivered', 'pending_claim']);
      if (usernames.length > 0) openQuery = openQuery.in('username', usernames);

      let apprQuery = supabaseClient.from('task_logs').select('id, tasks!inner(family_id)').eq('status', 'Pending Approval');
      if (getFamilyId()) apprQuery = apprQuery.eq('tasks.family_id', getFamilyId());

      jobs.push(openQuery, apprQuery);
    }

    const results = await Promise.all(jobs);
    const mine = results[0].data || [];
    pendingCounts.myRewards = mine.length;

    if (isAdminOrMod()) {
      const open = results[1].data || [];
      pendingCounts.orders = open.filter(r => r.kind === 'spend').length;
      pendingCounts.grants = open.filter(r => r.kind === 'grant').length;
      pendingCounts.approvals = (results[2].data || []).length;
    }
    renderPendingBadges();
  } catch (e) {
    // Badge chỉ là tiện ích - hỏng thì im lặng, không chặn luồng chính.
    console.warn('Không lấy được số liệu badge:', e);
  }
}

function setNavDot(navId, show) {
  const btn = document.getElementById(navId);
  if (!btn) return;
  btn.classList.add('relative');
  let dot = btn.querySelector('.nav-dot');
  if (show && !dot) {
    dot = document.createElement('span');
    dot.className = 'nav-dot absolute top-1 right-1/2 translate-x-4 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-[var(--bg-dark)]';
    btn.appendChild(dot);
  } else if (!show && dot) {
    dot.remove();
  }
}

function setTileBadge(tileId, count) {
  const tile = document.getElementById(tileId);
  if (!tile) return;
  tile.classList.add('relative');
  let b = tile.querySelector('.tile-badge');
  if (count > 0) {
    if (!b) {
      b = document.createElement('span');
      b.className = 'tile-badge absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center shadow-lg';
      tile.appendChild(b);
    }
    b.innerText = count > 99 ? '99+' : String(count);
  } else if (b) {
    b.remove();
  }
}

function renderPendingBadges() {
  setNavDot('nav-history', pendingCounts.myRewards > 0);
  setNavDot('nav-admin', (pendingCounts.orders + pendingCounts.grants + pendingCounts.approvals) > 0);
  setTileBadge('admin-tab-reward_approvals', pendingCounts.orders + pendingCounts.grants);
  setTileBadge('admin-tab-approvals', pendingCounts.approvals);
  renderHomeRewardBanner();
}

// Banner trên Home: user không phải tự mò vào Lịch sử mới biết mình có quà.
function renderHomeRewardBanner() {
  const box = document.getElementById('reward-alert-box');
  if (!box) return;
  const n = pendingCounts.myRewards;
  if (n <= 0) { box.classList.add('hidden'); box.innerHTML = ''; return; }
  box.classList.remove('hidden');
  box.innerHTML = `
    <button onclick="goToMyRewards()" class="w-full bg-gradient-to-r from-primary/10 to-purple-500/10 border border-primary/30 rounded-2xl p-4 flex items-center gap-3 text-left active-scale hover:border-primary/60 transition-all">
      <div class="w-11 h-11 rounded-2xl bg-primary/20 flex items-center justify-center text-primary text-xl shrink-0"><i class="fa-solid fa-gift animate-bounce"></i></div>
      <div class="flex-1 min-w-0">
        <div class="font-bold text-primary text-sm">Bạn có ${n} phần thưởng cần xử lý!</div>
        <p class="text-[11px] text-muted mt-0.5">Bấm vào đây để nhận điểm thưởng hoặc xác nhận đã nhận quà.</p>
      </div>
      <i class="fa-solid fa-chevron-right text-muted text-sm shrink-0"></i>
    </button>`;
}

function goToMyRewards() {
  switchTab('history');
  switchHistoryTab('rewards');
}

// Mọi thao tác làm thay đổi điểm/giao dịch đều phải gọi hàm này, nếu không
// tab Lịch sử và Báo cáo sẽ hiển thị dữ liệu cũ cho tới khi tải lại trang.
function invalidateDataCaches() {
  _historyCache = null;
  _historyCacheFilter = null;
  _reportDataCache = null;
  _reportCacheKey = null;
}

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

async function getCachedAppStartDate() {
  if (_cachedAppStartDate) return _cachedAppStartDate;
  const { data: firstLog } = await supabaseClient.from('task_logs').select('created_at').eq('status', 'Approved').order('created_at', { ascending: true }).limit(1);
  if (firstLog && firstLog.length > 0) {
    _cachedAppStartDate = new Date(firstLog[0].created_at);
    _cachedAppStartDate.setHours(0, 0, 0, 0);
  }
  return _cachedAppStartDate;
}

function friendlyError(error) {
  if (!error) return 'Có lỗi xảy ra. Vui lòng thử lại sau.';
  const msg = error.message || String(error);
  const map = {
    'JWT expired': 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    'Failed to fetch': 'Không có kết nối mạng. Kiểm tra WiFi/4G và thử lại.',
    'NetworkError': 'Không có kết nối mạng. Kiểm tra WiFi/4G và thử lại.',
    'violates foreign key': 'Dữ liệu liên quan đã bị xoá. Hãy tải lại trang.',
    'row-level security': 'Bạn không có quyền thực hiện thao tác này.',
    'duplicate key': 'Dữ liệu đã tồn tại. Không thể thêm trùng.',
    'PGRST116': 'Không tìm thấy dữ liệu phù hợp.',
    'rate limit': 'Bạn thao tác quá nhanh. Vui lòng đợi một chút.',
  };
  for (const [key, friendlyMsg] of Object.entries(map)) {
    if (msg.includes(key)) return friendlyMsg;
  }
  return 'Có lỗi xảy ra. Vui lòng thử lại sau.';
}

function setButtonLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn.disabled = true;
    btn.dataset.originalHtml = btn.dataset.originalHtml || btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>Đang xử lý...';
    btn.style.opacity = '0.7';
  } else {
    btn.disabled = false;
    if (btn.dataset.originalHtml) btn.innerHTML = btn.dataset.originalHtml;
    btn.style.opacity = '1';
    delete btn.dataset.originalHtml;
  }
}

window.addEventListener('offline', () => showToast('📡 Mất kết nối mạng. Một số tính năng sẽ không hoạt động.', 'error'));
window.addEventListener('online', () => showToast('✅ Đã kết nối lại mạng!', 'success'));

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

function showHistorySkeleton() {
  const cPoints = document.getElementById('history-points-list');
  const cRewards = document.getElementById('history-rewards-list');
  const skel = Array(5).fill(`
    <div class="bg-card border border-borderline rounded-2xl p-0 flex flex-col gap-0 mb-2 skeleton overflow-hidden">
      <div class="flex items-stretch justify-between w-full">
        <div class="w-[76px] shrink-0 border-r border-borderline/50 p-3 flex flex-col items-center"><div class="w-10 h-10 rounded-2xl bg-borderline/30 mb-1.5"></div><div class="h-2 w-10 bg-borderline/30 rounded"></div></div>
        <div class="flex-1 p-3 flex flex-col justify-center"><div class="h-4 w-3/4 bg-borderline/30 rounded mb-2"></div><div class="h-3 w-1/2 bg-borderline/30 rounded"></div></div>
        <div class="p-3 flex items-center justify-end"><div class="h-6 w-12 bg-borderline/30 rounded-xl"></div></div>
      </div>
    </div>`).join('');
  if (currentHistoryTab === 'points') cPoints.innerHTML = skel; else cRewards.innerHTML = skel;
}

function showReportSkeleton() {
  document.getElementById('report-content-leaderboard').innerHTML = Array(3).fill(`
    <div class="bg-card border border-borderline rounded-2xl p-4 flex items-center gap-4 mb-2 skeleton">
      <div class="w-8 h-8 rounded-full bg-borderline/30"></div>
      <div class="flex-1"><div class="h-4 w-1/2 bg-borderline/30 rounded mb-2"></div><div class="h-3 w-1/4 bg-borderline/30 rounded"></div></div>
      <div class="w-16 h-8 rounded-lg bg-borderline/30"></div>
    </div>`).join('');
  document.getElementById('report-completed-container').innerHTML = '';
  document.getElementById('report-missed-container').innerHTML = '';
}

// Styled replacement for window.confirm() so confirmation prompts match the app's UI
// instead of the jarring native browser dialog. Resolves true/false like confirm().
function customConfirm(message, title = 'Xác nhận', okText = 'Xác nhận') {
  return new Promise((resolve) => {
    const overlay = document.getElementById('custom-confirm');
    const dialog = overlay.querySelector('.confirm-dialog');
    const okBtn = document.getElementById('confirm-ok');
    const cancelBtn = document.getElementById('confirm-cancel');

    document.getElementById('confirm-title').innerText = title;
    document.getElementById('confirm-message').innerText = message;
    okBtn.innerText = okText;

    overlay.classList.remove('hidden');
    overlay.classList.add('flex');
    requestAnimationFrame(() => dialog.classList.add('show'));

    const cleanup = (result) => {
      dialog.classList.remove('show');
      setTimeout(() => { overlay.classList.add('hidden'); overlay.classList.remove('flex'); }, 200);
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      overlay.removeEventListener('click', onOverlayClick);
      resolve(result);
    };
    const onOk = () => cleanup(true);
    const onCancel = () => cleanup(false);
    const onOverlayClick = (e) => { if (e.target === overlay) cleanup(false); };

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    overlay.addEventListener('click', onOverlayClick);
  });
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

function toggleHeaderMenu() {
  const dropdown = document.getElementById('header-menu-dropdown');
  const btn = document.getElementById('header-menu-btn');
  const willShow = dropdown.classList.contains('hidden');
  dropdown.classList.toggle('hidden', !willShow);
  btn.setAttribute('aria-expanded', String(willShow));
}

function closeHeaderMenu() {
  document.getElementById('header-menu-dropdown').classList.add('hidden');
  document.getElementById('header-menu-btn').setAttribute('aria-expanded', 'false');
}

document.addEventListener('click', function (e) {
  const dropdown = document.getElementById('header-menu-dropdown');
  const btn = document.getElementById('header-menu-btn');
  if (!dropdown || dropdown.classList.contains('hidden')) return;
  if (!dropdown.contains(e.target) && !btn.contains(e.target)) closeHeaderMenu();
});

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

async function initApp() {
  document.getElementById('user-name').innerText = currentUser.name;
  document.getElementById('user-role').innerText = currentUser.role || 'User';
  document.getElementById('user-points').innerText = currentUser.points;

  updateAvatarHeader(); setupRealtimeListener();
  if (isAdminOrMod()) {
    document.getElementById('nav-admin').classList.remove('hidden'); document.getElementById('nav-admin').classList.add('flex');
  } else {
    document.getElementById('nav-admin').classList.add('hidden'); document.getElementById('nav-admin').classList.remove('flex');
  }
  // Show/hide families tab for Super Admin
  const famTab = document.getElementById('admin-tab-families');
  if (famTab) {
    if (isSuperAdmin()) { famTab.classList.remove('hidden'); } else { famTab.classList.add('hidden'); }
  }
  // Show/hide themes tab for Super Admin
  const themesTab = document.getElementById('admin-tab-themes');
  if (themesTab) {
    if (isSuperAdmin()) { themesTab.classList.remove('hidden'); } else { themesTab.classList.add('hidden'); }
  }
  
  await loadFamilySettings();
  switchTab('home');
  refreshPendingBadges();
}

async function loadFamilySettings() {
    const fid = getFamilyId();
    if (!fid) return;
    try {
        const { data, error } = await supabaseClient.from('family_settings').select('*').eq('family_id', fid).single();
        if (data) {
            familySettings.claim_max_days = data.claim_max_days ?? 2;
            familySettings.claim_points_percent = data.claim_points_percent ?? 50;
            familySettings.schedule_enabled = data.schedule_enabled ?? true;
            familySettings.schedule_register_days = data.schedule_register_days ?? '6,7';
            
            if (familySettings.schedule_enabled) {
                document.getElementById('nav-schedule').classList.remove('hidden');
                document.getElementById('nav-schedule').classList.add('flex');
            } else {
                document.getElementById('nav-schedule').classList.add('hidden');
                document.getElementById('nav-schedule').classList.remove('flex');
            }
        }
    } catch(e) {
        console.log('No family settings found, using defaults.');
    }
}

function switchTab(tabId) {
  document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
  var viewEl = document.getElementById('view-' + tabId);
  if (viewEl) viewEl.classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach(el => { el.classList.remove('text-primary'); el.classList.add('text-muted'); });
  var navEl = document.getElementById('nav-' + tabId);
  if (navEl) { navEl.classList.remove('text-muted'); navEl.classList.add('text-primary'); }
  if (tabId === 'home') loadHomeData();
  if (tabId === 'reports') loadReport(currentReportTimeframe);
  if (tabId === 'history') loadHistoryData();
  if (tabId === 'admin') loadAdminData(null);
  if (tabId === 'schedule') loadScheduleView();
  if (tabId === 'home' || tabId === 'admin' || tabId === 'history') refreshPendingBadges();
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

// === CONDITION TASK HELPERS ===
function getConditionStatusForPeriod(periodId, allTasks, allLogs) {
  const isWeekPeriod = periodId && periodId.includes('-W');
  let dueConditionTasks = [];

  if (isWeekPeriod) {
    const weekNum = parseInt(periodId.split('-W')[1]);
    dueConditionTasks = (allTasks || []).filter(t => t.is_condition && t.frequency === 'Monthly' && t.schedule == weekNum);
  } else {
    const date = new Date(periodId + 'T00:00:00');
    const dayOfWeek = date.getDay();
    const dayOfWeekAdjusted = dayOfWeek === 0 ? 7 : dayOfWeek;
    dueConditionTasks = (allTasks || []).filter(t => {
      if (!t.is_condition) return false;
      if (t.frequency === 'Daily') return true;
      if (t.frequency === 'Weekly' && t.schedule == dayOfWeekAdjusted) return true;
      if (t.frequency === 'Adhoc' && (!t.schedule || t.schedule === periodId)) return true;
      return false;
    });
  }

  if (dueConditionTasks.length === 0) return { hasConditions: false, allMet: true, conditionTasks: [] };

  const allMet = dueConditionTasks.every(ct => {
    return (allLogs || []).some(l => l.task_id === ct.id && l.period_id === periodId && l.status === 'Approved');
  });

  return { hasConditions: true, allMet, conditionTasks: dueConditionTasks };
}

async function awardDeferredPoints(periodId) {
  const { data: deferredLogs } = await supabaseClient.from('task_logs')
    .select('*, tasks!inner(points, task_name, calc_admin, family_id)')
    .eq('period_id', periodId)
    .eq('status', 'Approved')
    .eq('points_awarded', false);

  if (!deferredLogs || deferredLogs.length === 0) return;

  for (const log of deferredLogs) {
    const task = log.tasks;
    if (!task || task.points <= 0) {
      await supabaseClient.from('task_logs').update({ points_awarded: true }).eq('id', log.id);
      continue;
    }
    const { data: uData } = await supabaseClient.from('users')
      .select('points, role').eq('username', log.username).single();
    if (!uData) continue;

    let finalPoints = task.points;
    if (task.calc_admin === false && (uData.role === 'Admin' || uData.role === 'Moderator' || uData.role === 'Super Admin')) {
      finalPoints = 0;
    }
    if (finalPoints > 0) {
      await adjustUserPoints(log.username, finalPoints);
      await supabaseClient.from('transactions').insert([{ username: log.username, type: 'Earn', amount: finalPoints, description: `Được duyệt: ${task.task_name}` }]);
    }
    await supabaseClient.from('task_logs').update({ points_awarded: true }).eq('id', log.id);
  }
}
// === END CONDITION TASK HELPERS ===

async function loadHomeData() {
  showLoading(true); await refreshUserPoints();
  let tasksQuery = supabaseClient.from('tasks').select('*');
  if (getFamilyId()) tasksQuery = tasksQuery.eq('family_id', getFamilyId());
  const { data: rawTasksData } = await tasksQuery;
  const tasksData = unpackTasks(rawTasksData);

  const today = new Date();
  const dayOfWeek = today.getDay(); const dayOfWeekAdjusted = dayOfWeek === 0 ? 7 : dayOfWeek;
  const weekOfMonth = Math.ceil(today.getDate() / 7);
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const weekStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-W${weekOfMonth}`;

  // Trang chủ chỉ cần 2 nhóm log: log của kỳ hôm nay/tuần này, và mọi log còn
  // chờ duyệt (để việc quá hạn vẫn nằm lại danh sách). Trước đây hàm này nạp
  // TOÀN BỘ bảng task_logs - PostgREST cắt ở 1000 dòng và query không có
  // ORDER BY, nên khi bảng vượt ngưỡng sẽ âm thầm mất log và báo sai "chưa làm".
  const [{ data: periodLogs }, { data: pendingLogs }] = await Promise.all([
    supabaseClient.from('task_logs').select('*, users(name)').neq('status', 'Rejected').in('period_id', [todayStr, weekStr]),
    supabaseClient.from('task_logs').select('*, users(name)').eq('status', 'Pending Approval')
  ]);
  const logsData = [];
  const seenLogIds = new Set();
  [...(periodLogs || []), ...(pendingLogs || [])].forEach(l => {
    if (seenLogIds.has(l.id)) return;
    seenLogIds.add(l.id);
    logsData.push(l);
  });

  // Fetch schedules for today
  let scheduleData = [];
  if (familySettings.schedule_enabled) {
      const { data } = await supabaseClient.from('weekly_schedules').select('*').eq('assigned_date', todayStr);
      if (data) scheduleData = data;
  }

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
        let assignedUser = null;
        if (familySettings.schedule_enabled) {
            const sched = scheduleData.find(s => s.task_id === t.id);
            if (sched) assignedUser = sched.username;
        }
        
        if (assignedUser && assignedUser !== currentUser.username && currentUser.role === 'User') {
            return; // Skip rendering for other users if it's assigned to someone else
        }

        const pType = t.penalty_type || 'all';
        let logStatus = 'Not Done', completedByName = '';
        if (logsData) {
          if (pType === 'individual') {
            // Individual: each user sees their own log status only
            const myLog = logsData.find(l => l.task_id === t.id && l.period_id === periodId && l.username === currentUser.username);
            if (myLog) { logStatus = myLog.status; completedByName = myLog.users?.name || myLog.username; }
          } else {
            // All: any user's log applies to everyone
            const log = logsData.find(l => l.task_id === t.id && l.period_id === periodId);
            if (log) { logStatus = log.status; completedByName = log.users?.name || log.username; }
          }
        }
        const formattedTask = { id: t.id, name: t.task_name, points: t.points, penalty: t.penalty, penaltyType: pType, status: logStatus, completedByName, periodId, frequency: t.frequency, icon: t.icon || 'fa-solid fa-clipboard-list', isCondition: !!t.is_condition, assignedUser };
        if (!t.penalty || Number(t.penalty) <= 0) {
          adhocTasks.push(formattedTask);
        } else if (t.frequency === 'Daily') {
          dailyTasks.push(formattedTask);
        } else {
          weeklyTasks.push(formattedTask);
        }
      }
    });

    // Add past pending tasks to the homepage lists so they remain until actioned
    if (logsData) {
      logsData.forEach(l => {
        if (l.status === 'Pending Approval') {
          const t = tasksData.find(x => x.id === l.task_id);
          if (t) {
            const pType = t.penalty_type || 'all';
            const isMyPending = (pType === 'individual') ? (l.username === currentUser.username) : true;
            if (isMyPending) {
              let isPast = false;
              if (t.frequency === 'Daily' || t.frequency === 'Weekly' || t.frequency === 'Adhoc') {
                isPast = (l.period_id !== todayStr);
              } else if (t.frequency === 'Monthly') {
                isPast = (l.period_id !== weekStr);
              }
              if (isPast) {
                const completedByName = l.users?.name || l.username;
                const formattedTask = {
                  id: t.id,
                  name: t.task_name,
                  points: t.points,
                  penalty: t.penalty,
                  penaltyType: pType,
                  status: 'Pending Approval',
                  completedByName,
                  periodId: l.period_id,
                  frequency: t.frequency,
                  icon: t.icon || 'fa-solid fa-clipboard-list',
                  isCondition: !!t.is_condition
                };
                if (!t.penalty || Number(t.penalty) <= 0) {
                  adhocTasks.push(formattedTask);
                } else if (t.frequency === 'Daily') {
                  dailyTasks.push(formattedTask);
                } else {
                  weeklyTasks.push(formattedTask);
                }
              }
            }
          }
        }
      });
    }
  }

  let rewardsQuery = supabaseClient.from('rewards').select('*');
  if (getFamilyId()) rewardsQuery = rewardsQuery.eq('family_id', getFamilyId());
  rewardsQuery = rewardsQuery.is('is_point_reward', false).not('active', 'is', false);
  const { data: rewardsData } = await rewardsQuery;
  showLoading(false);

  const isTodayHoliday = checkIfHoliday(today, tasksData);

  if (isTodayHoliday) {
    dailyTasks.forEach(t => t.penalty = 0);
    weeklyTasks.forEach(t => t.penalty = 0);
    adhocTasks.forEach(t => t.penalty = 0);
  }

  document.getElementById('home-daily-container').parentElement.querySelector('h2').classList.remove('hidden');
  document.getElementById('home-weekly-container').parentElement.classList.remove('hidden');
  document.getElementById('home-adhoc-container').parentElement.classList.remove('hidden');

  let hasPending = false;
  hasPending = renderTaskGroup(dailyTasks, 'home-daily-container', 'Chưa có việc hàng ngày.') || hasPending;
  hasPending = renderTaskGroup(weeklyTasks, 'home-weekly-container', 'Hôm nay không có việc định kỳ.') || hasPending;
  renderTaskGroup(adhocTasks, 'home-adhoc-container', 'Tạm thời chưa có việc kiếm thêm.');

  if (isTodayHoliday) {
    document.getElementById('reminder-box').classList.add('hidden');
    const bannerHtml = `
            <div class="bg-gradient-to-r from-teal-400 to-emerald-500 rounded-3xl p-6 text-white text-center shadow-xl shadow-teal-500/20 mb-6 relative overflow-hidden">
                <i class="fa-solid fa-umbrella-beach absolute -right-6 -bottom-6 text-9xl opacity-20 rotate-[-15deg]"></i>
                <div class="text-4xl mb-3"><i class="fa-solid fa-mug-hot animate-bounce"></i></div>
                <h3 class="font-black text-2xl mb-1">CHẾ ĐỘ NGHỈ LỄ</h3>
                <p class="text-sm font-medium opacity-90 relative z-10">Hôm nay không bắt buộc làm việc nhà, nhưng làm thì vẫn có thưởng nhé!</p>
            </div>
        `;
    document.getElementById('home-daily-container').innerHTML = bannerHtml + document.getElementById('home-daily-container').innerHTML;
  } else {
    if (hasPending) document.getElementById('reminder-box').classList.remove('hidden');
    else document.getElementById('reminder-box').classList.add('hidden');
  }

  // Condition status banner
  const allDueTasks = [...dailyTasks, ...weeklyTasks, ...adhocTasks];
  const conditionTasksToday = allDueTasks.filter(t => t.isCondition);
  if (conditionTasksToday.length > 0) {
    const condDone = conditionTasksToday.filter(t => t.status === 'Approved').length;
    const condTotal = conditionTasksToday.length;
    const allCondMet = condDone === condTotal;
    const condBannerHtml = allCondMet ? `
      <div class="bg-gradient-to-r from-emerald-500/10 to-green-500/10 border border-emerald-500/30 rounded-2xl p-4 mb-4 flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-500 text-lg shrink-0"><i class="fa-solid fa-key"></i></div>
        <div><div class="font-bold text-emerald-500 text-sm mb-0.5">Đã đủ Điều kiện ✓</div><p class="text-[10px] text-muted">Tất cả ${condTotal} điều kiện đã hoàn thành. Điểm thưởng được tính!</p></div>
      </div>` : `
      <div class="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-2xl p-4 mb-4 flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-500 text-lg shrink-0"><i class="fa-solid fa-key"></i></div>
        <div><div class="font-bold text-amber-500 text-sm mb-0.5">Điều kiện: ${condDone}/${condTotal}</div><p class="text-[10px] text-muted">Hoàn thành tất cả việc Điều kiện (⚡) mới được tính thưởng.</p></div>
      </div>`;
    document.getElementById('home-daily-container').innerHTML = condBannerHtml + document.getElementById('home-daily-container').innerHTML;
  }

  renderRewards(rewardsData || []);

  // Premium Summary Rendering
  const premiumContainer = document.getElementById('premium-summary-container');
  if (isPremiumTheme()) {
    const totalTasks = dailyTasks.length + weeklyTasks.length + adhocTasks.length;
    const completedTasks = [...dailyTasks, ...weeklyTasks, ...adhocTasks].filter(t => t.status === 'Approved').length;
    const percent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 314) : 0;
    const displayPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    premiumContainer.innerHTML = `
      <div class="premium-card flex items-center justify-between gap-6">
        <div class="flex-1">
          <div class="premium-badge bg-primary/20 text-primary mb-2 inline-block">Daily Progress</div>
          <h3 class="text-xl font-black text-main leading-tight mb-1">Tình hình hôm nay</h3>
          <p class="text-xs text-muted">Bạn đã hoàn thành ${completedTasks}/${totalTasks} công việc. ${displayPercent === 100 ? 'Tuyệt vời!' : 'Cố lên nhé!'}</p>
        </div>
        <div class="premium-progress-ring">
          <svg viewBox="0 0 100 100">
            <circle class="track" cx="50" cy="50" r="46"></circle>
            <circle class="progress" cx="50" cy="50" r="46" style="stroke-dashoffset: ${314 - percent};"></circle>
          </svg>
          <div class="premium-progress-text">
            <div class="text-2xl font-black text-main">${displayPercent}%</div>
          </div>
        </div>
      </div>
    `;
    premiumContainer.classList.remove('hidden');
  } else {
    premiumContainer.classList.add('hidden');
  }
}

function formatPeriodId(periodId) {
  if (!periodId) return '';
  if (periodId.includes('-W')) {
    const parts = periodId.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const month = parts[1];
      const week = parts[2].replace('W', 'Tuần ');
      return `${week} (${month}/${year})`;
    }
  }
  if (periodId.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const parts = periodId.split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return periodId;
}

function renderTaskGroup(tasks, containerId, emptyMsg) {
  const container = document.getElementById(containerId);
  if (tasks.length === 0) { container.innerHTML = `<div class="text-center text-muted py-6 text-xs bg-card border border-borderline rounded-2xl border-dashed">${emptyMsg}</div>`; return false; }

  let hasPending = false;
  const cardsHtml = tasks.map(t => {
    if (t.status === 'Not Done' && t.penalty > 0) hasPending = true;
    let rightColHtml = '';
    const isPremium = isPremiumTheme();
    const cardClass = isPremium ? 'premium-card' : 'bg-card border border-borderline rounded-2xl p-3.5 mb-3 shadow-sm relative overflow-hidden transition-all hover:border-primary/50 flex items-center justify-between';

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

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const weekOfMonth = Math.ceil(today.getDate() / 7);
    const weekStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-W${weekOfMonth}`;
    let periodLabel = '';
    const isPastPeriod = t.periodId && (t.periodId !== todayStr && t.periodId !== weekStr);
    if (isPastPeriod) {
      periodLabel = `<span class="text-[9px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 ml-1.5 inline-block shrink-0">Lịch cũ: ${formatPeriodId(t.periodId)}</span>`;
    }

    return `
        <div class="${cardClass} ${!isPremium ? '' : 'flex items-center justify-between'}">
            ${t.status === 'Approved' && !isPremium ? '<div class="absolute inset-0 bg-success/5 pointer-events-none"></div>' : ''}
            <div class="flex items-center gap-3.5 relative z-10 flex-1 min-w-0">
                <div class="w-14 h-14 shrink-0 ${isPremium ? 'rounded-2xl bg-primary/10' : 'rounded-[16px] bg-surface shadow-inner border border-white/5'} flex items-center justify-center text-primary text-2xl">
                    <i class="${t.icon}"></i>
                </div>
                <div class="flex flex-col justify-center flex-1 min-w-0">
                    <h3 class="font-bold text-main text-sm leading-snug line-clamp-2 mb-1.5">${t.name}${periodLabel}</h3>
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="flex items-center gap-1 text-[11px] font-black text-success ${isPremium ? 'bg-success/5' : 'bg-success/10'} px-1.5 py-0.5 rounded"><i class="fa-solid fa-coins text-yellow-500"></i> +${t.points}</span>
                        ${t.penalty > 0 ? `<span class="flex items-center gap-1 text-[11px] font-black text-red-500 ${isPremium ? 'bg-red-500/5' : 'bg-red-500/10'} px-1.5 py-0.5 rounded"><i class="fa-solid fa-arrow-trend-down"></i> -${t.penalty}</span>` : ''}
                        ${t.isCondition ? `<span class="flex items-center gap-1 text-[11px] font-black text-cyan-500 ${isPremium ? 'bg-cyan-500/5' : 'bg-cyan-500/10'} px-1.5 py-0.5 rounded"><i class="fa-solid fa-key"></i> ĐK</span>` : ''}
                        ${t.assignedUser ? `<span class="flex items-center gap-1 text-[10px] font-bold text-purple-500 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20"><i class="fa-solid fa-user-check"></i> ${t.assignedUser}</span>` : ''}
                    </div>
                </div>
            </div>

            <div class="relative z-10 shrink-0">
                ${rightColHtml}
            </div>
        </div>`;
  });
  container.innerHTML = cardsHtml.join('');
  return hasPending;
}

async function submitTask(taskId, periodId) {
  showLoading(true);

  // Fetch the task to check penalty_type
  const { data: taskData } = await supabaseClient.from('tasks').select('penalty_type').eq('id', taskId).single();
  const pType = (taskData && taskData.penalty_type) || 'all';

  let existingQuery = supabaseClient.from('task_logs').select('id').eq('task_id', taskId).eq('period_id', periodId).neq('status', 'Rejected');
  
  if (pType === 'individual') {
    // Individual: only block if THIS user already submitted
    existingQuery = existingQuery.eq('username', currentUser.username);
  }
  // else (all): block if ANY user already submitted (original behavior)

  const { data: existing } = await existingQuery;
  if (existing && existing.length > 0) {
    showLoading(false);
    return showToast(pType === 'individual' ? 'Bạn đã nộp việc này rồi!' : 'Việc này đã có người xí rồi!', 'error');
  }

  const { error } = await supabaseClient.from('task_logs').insert([{ task_id: taskId, period_id: periodId, username: currentUser.username, status: 'Pending Approval' }]);
  showLoading(false);
  if (error) showToast('Lỗi: ' + error.message, 'error'); else {
    showToast('Hay quá! Chờ Admin duyệt để nhận thưởng liền tay!', 'mega-success');
    if (typeof confetti === 'function') confetti({ particleCount: 150, spread: 80, origin: { y: 0.5 }, zIndex: 9999, colors: ['#10B981', '#3B82F6', '#F59E0B', '#EAB308'] });
    loadHomeData();
  }
}

function renderRewards(rewards) {
  const container = document.getElementById('home-rewards-container');
  if (!rewards || rewards.length === 0) {
    container.innerHTML = '<div class="col-span-2 text-center text-muted py-8 text-sm bg-card border border-dashed border-borderline rounded-2xl">Chưa có phần thưởng nào. Nhắc Bố Mẹ thêm quà nhé!</div>';
    return;
  }
  const myPoints = Number(currentUser.points) || 0;
  // Món sắp đổi được đẩy lên trước để tạo động lực, món hết hàng xuống cuối.
  const sorted = rewards.slice().sort((a, b) => {
    const outA = a.stock !== null && a.stock !== undefined && a.stock <= 0;
    const outB = b.stock !== null && b.stock !== undefined && b.stock <= 0;
    if (outA !== outB) return outA ? 1 : -1;
    const affA = myPoints >= (Number(a.cost) || 0), affB = myPoints >= (Number(b.cost) || 0);
    if (affA !== affB) return affA ? -1 : 1;
    return (Number(a.cost) || 0) - (Number(b.cost) || 0);
  });

  container.innerHTML = sorted.map(r => {
    const cost = Number(r.cost) || 0;
    const hasStock = r.stock !== null && r.stock !== undefined;
    const outOfStock = hasStock && Number(r.stock) <= 0;
    const canAfford = myPoints >= cost;
    const usable = canAfford && !outOfStock;
    const rIcon = r.icon || 'fa-solid fa-gift text-amber-500';
    const missing = cost - myPoints;
    const pct = cost > 0 ? Math.min(100, Math.round((myPoints / cost) * 100)) : 100;

    let label = 'Đổi quà luôn';
    if (outOfStock) label = 'Tạm hết';
    else if (!canAfford) label = `Còn thiếu ${missing}`;

    return `
        <div class="bg-card border border-borderline rounded-2xl p-4 flex flex-col items-center text-center shadow-sm relative overflow-hidden transition-all hover:border-primary/50 ${outOfStock ? 'opacity-60' : ''}">
            ${hasStock && !outOfStock ? `<span class="absolute top-2 right-2 text-[9px] font-bold text-muted bg-surface border border-borderline px-1.5 py-0.5 rounded">Còn ${r.stock}</span>` : ''}
            ${outOfStock ? '<span class="absolute top-2 right-2 text-[9px] font-bold text-red-500 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded">Hết</span>' : ''}
            <div class="w-14 h-14 rounded-full bg-surface shadow-inner flex items-center justify-center mb-3 text-2xl text-primary"><i class="${escHtml(rIcon)}"></i></div>
            <h3 class="font-bold text-main text-sm mb-1 line-clamp-1">${escHtml(r.reward_name)}</h3>
            <div class="font-black text-sm mb-2 flex items-center gap-1 ${canAfford ? 'text-yellow-500' : 'text-muted'}"><i class="fa-solid fa-coins"></i> ${cost}</div>
            ${!canAfford ? `<div class="w-full h-1.5 rounded-full bg-surface overflow-hidden mb-2"><div class="h-full bg-gradient-to-r from-primary to-purple-500 rounded-full" style="width:${pct}%"></div></div>` : ''}
            <button onclick="redeemReward('${escJsAttr(r.id)}', ${cost}, '${escJsAttr(r.reward_name)}')" class="w-full py-2.5 rounded-xl text-xs font-bold active-scale transition-all duration-300 ${usable ? 'bg-primary text-white shadow-lg shadow-primary/30 hover:scale-105' : 'bg-surface text-muted opacity-50 cursor-not-allowed'}" ${!usable ? 'disabled' : ''}>${label}</button>
        </div>`;
  }).join('');
}

// Trạng thái đơn -> nhãn hiển thị. Một chỗ duy nhất để đổi chữ.
const REDEMPTION_STATUS = {
  pending_delivery: { text: 'Chờ trao', cls: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  delivered:        { text: 'Đã trao, chờ xác nhận', cls: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  completed:        { text: 'Hoàn tất', cls: 'bg-success/10 text-success border-success/20' },
  cancelled:        { text: 'Đã huỷ · hoàn điểm', cls: 'bg-surface text-muted border-borderline' },
  pending_claim:    { text: 'Chờ bạn nhận', cls: 'bg-primary/10 text-primary border-primary/20' },
  claimed:          { text: 'Đã nhận', cls: 'bg-success/10 text-success border-success/20' },
  revoked:          { text: 'Đã thu hồi', cls: 'bg-surface text-muted border-borderline' }
};

// Dịch mã lỗi do các hàm RPC ném ra sang tiếng Việt dễ hiểu.
function rewardError(error) {
  const m = (error && error.message) || '';
  const num = (key) => parseInt((m.split(key + ':')[1] || '').match(/\d+/), 10) || 0;
  if (m.includes('NOT_ENOUGH_POINTS')) return `Chưa đủ điểm rồi! Bạn còn thiếu ${num('NOT_ENOUGH_POINTS')} điểm.`;
  if (m.includes('WEEKLY_LIMIT')) return `Món này chỉ được đổi ${num('WEEKLY_LIMIT')} lần mỗi tuần thôi.`;
  if (m.includes('OUT_OF_STOCK')) return 'Món này vừa hết mất rồi!';
  if (m.includes('REWARD_INACTIVE')) return 'Món quà này đang tạm ngưng.';
  if (m.includes('REWARD_NOT_FOUND')) return 'Không tìm thấy phần thưởng này.';
  if (m.includes('NOT_REDEEMABLE')) return 'Đây là gói thưởng điểm, không đổi được.';
  if (m.includes('INVALID_COST')) return 'Phần thưởng này chưa có giá hợp lệ.';
  if (m.includes('ALREADY_CLOSED')) return 'Đơn này đã hoàn tất hoặc đã huỷ trước đó.';
  if (m.includes('ALREADY_CLAIMED')) return 'Phần thưởng này đã được nhận trước đó rồi.';
  if (m.includes('NOT_YOURS')) return 'Đây là phần thưởng của người khác nha!';
  if (m.includes('USER_NOT_FOUND')) return 'Không tìm thấy thành viên.';
  if (m.includes('NOT_FOUND')) return 'Không tìm thấy đơn này.';
  if (/does not exist|schema cache|relation .* does not exist/i.test(m)) {
    return 'Chưa chạy migration_reward_flow.sql trên Supabase!';
  }
  return m || 'Có lỗi xảy ra, thử lại giúp mình nhé.';
}

async function redeemReward(rewardId, cost, name) {
  if (_redeemInFlight) return;
  cost = Number(cost) || 0;
  if (cost <= 0) return showToast('Phần thưởng này chưa có giá hợp lệ.', 'error');

  _redeemInFlight = true;
  try {
    // Lấy số dư mới nhất từ server để hộp xác nhận nói đúng con số.
    showLoading(true);
    const { data: fresh } = await supabaseClient.from('users').select('points').eq('username', currentUser.username).single();
    showLoading(false);
    const balance = fresh ? Number(fresh.points) || 0 : 0;
    if (balance !== currentUser.points) await refreshUserPoints();
    if (balance < cost) {
      return showToast(`Chưa đủ điểm rồi! Bạn còn thiếu ${cost - balance} điểm.`, 'error');
    }

    const ok = await customConfirm(
      `Đổi [ ${name} ] với giá ${cost} điểm?\n\nĐiểm của bạn: ${balance} → ${balance - cost}\nBạn vẫn có thể huỷ đơn để lấy lại điểm khi quà chưa được trao.`,
      'Xác nhận đổi quà', 'Đổi ngay');
    if (!ok) return;

    const note = (document.getElementById('redeem-note-value') || {}).value || null;

    showLoading(true);
    // Toàn bộ việc kiểm tra số dư, tồn kho, giới hạn tuần, trừ điểm và tạo đơn
    // nằm trong MỘT transaction dưới DB -> không còn cảnh trừ điểm mà mất đơn.
    const { error } = await supabaseClient.rpc('redeem_reward', {
      p_username: currentUser.username, p_reward_id: rewardId, p_note: note
    });
    showLoading(false);
    if (error) return showToast(rewardError(error), 'error');

    invalidateDataCaches();
    refreshUserPoints();
    showToast('Đổi quà thành công! Chờ Bố Mẹ trao nha!', 'mega-success');
    if (typeof confetti === 'function') confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 }, zIndex: 9999 });
    loadHomeData();
    refreshPendingBadges();
  } finally {
    _redeemInFlight = false;
  }
}

// Sau khi thao tác xong thì làm tươi đúng màn hình đang mở.
function refreshRewardViews() {
  invalidateDataCaches();
  refreshPendingBadges();
  const adminOpen = !document.getElementById('view-admin').classList.contains('hidden');
  if (adminOpen && currentAdminType === 'reward_approvals') loadAdminData('reward_approvals');
  else if (!document.getElementById('view-history').classList.contains('hidden')) loadHistoryData(true);
}

// Huỷ đơn đổi quà và hoàn lại điểm. User huỷ được đơn của mình khi chưa trao,
// Admin/Mod huỷ được mọi đơn chưa hoàn tất.
async function cancelRedemption(redemptionId) {
  const { data: r } = await supabaseClient.from('reward_redemptions').select('*').eq('id', redemptionId).single();
  if (!r) return showToast('Không tìm thấy đơn này!', 'error');
  if (r.status !== 'pending_delivery' && r.status !== 'delivered') {
    refreshRewardViews();
    return showToast('Đơn này đã hoàn tất hoặc đã huỷ trước đó.', 'error');
  }
  const isOwner = r.username === currentUser.username;
  if (!isOwner && !isAdminOrMod()) return showToast('Bạn không có quyền huỷ đơn này.', 'error');
  if (r.status === 'delivered' && !isAdminOrMod()) return showToast('Quà đã được trao, nhờ Bố Mẹ huỷ giúp nhé.', 'error');

  const ok = await customConfirm(
    `Huỷ đơn đổi [ ${r.reward_name} ]?\n\n${r.cost} điểm sẽ được hoàn lại cho ${isOwner ? 'bạn' : r.username}.`,
    'Huỷ đơn & hoàn điểm', 'Huỷ đơn');
  if (!ok) return;

  showLoading(true);
  // Đổi trạng thái + hoàn điểm + trả tồn kho nằm chung một transaction DB.
  const { error } = await supabaseClient.rpc('cancel_redemption', {
    p_id: Number(redemptionId), p_actor: currentUser.username, p_reason: null
  });
  showLoading(false);
  if (error) { refreshRewardViews(); return showToast(rewardError(error), 'error'); }

  showToast(`Đã huỷ đơn và hoàn ${r.cost} điểm.`, 'success');
  if (isOwner) refreshUserPoints();
  refreshRewardViews();
}

// Admin đánh dấu đã trao quà tận tay. Không dịch chuyển điểm nên dùng
// compare-and-swap trên status là đủ.
async function markRedemptionDelivered(redemptionId) {
  if (!isAdminOrMod()) return showToast('Bạn không có quyền thao tác này.', 'error');
  showLoading(true);
  const { data: rows, error } = await supabaseClient.from('reward_redemptions')
    .update({ status: 'delivered', delivered_at: new Date().toISOString(), handled_by: currentUser.username })
    .eq('id', redemptionId).eq('status', 'pending_delivery')
    .select('id');
  showLoading(false);
  if (error) return showToast(rewardError(error), 'error');
  if (!rows || rows.length === 0) {
    refreshRewardViews();
    return showToast('Đơn vừa được xử lý ở nơi khác, đã tải lại danh sách.', 'error');
  }
  showToast('Đã ghi nhận trao quà. Chờ bạn ấy xác nhận nhé!', 'success');
  refreshRewardViews();
}

// Chốt đơn. Đường chính là chính chủ bấm; Admin đóng hộ được nhưng phải xác nhận rõ.
async function completeRedemption(redemptionId) {
  const { data: r } = await supabaseClient.from('reward_redemptions').select('*').eq('id', redemptionId).single();
  if (!r) return showToast('Không tìm thấy đơn này!', 'error');
  if (r.status !== 'delivered') { refreshRewardViews(); return showToast('Đơn này không ở trạng thái chờ xác nhận.', 'error'); }

  const isOwner = r.username === currentUser.username;
  if (!isOwner) {
    if (!isAdminOrMod()) return showToast('Chỉ người nhận mới xác nhận được bước này.', 'error');
    const ok = await customConfirm(
      `Đóng đơn [ ${r.reward_name} ] thay cho ${r.username}?\n\nBình thường nên để chính bạn ấy bấm "Mình đã nhận quà" để hai bên cùng xác nhận.`,
      'Đóng đơn thay người nhận', 'Đóng đơn');
    if (!ok) return;
  }

  showLoading(true);
  const { data: rows, error } = await supabaseClient.from('reward_redemptions')
    .update({ status: 'completed', completed_at: new Date().toISOString(), handled_by: currentUser.username })
    .eq('id', redemptionId).eq('status', 'delivered')
    .select('id');
  showLoading(false);
  if (error) return showToast(rewardError(error), 'error');
  if (!rows || rows.length === 0) {
    refreshRewardViews();
    return showToast('Đơn vừa được xử lý ở nơi khác, đã tải lại danh sách.', 'error');
  }
  showToast('Xong đơn quà rồi, chúc mừng!', 'mega-success');
  if (isOwner && typeof confetti === 'function') confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 } });
  refreshRewardViews();
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

function switchHistoryTab(tab) {
  currentHistoryTab = tab;
  document.getElementById('htab-points').className = `flex-1 py-2 text-sm font-bold transition-colors ${tab === 'points' ? 'text-primary border-b-2 border-primary' : 'text-muted border-b-2 border-transparent'}`;
  document.getElementById('htab-rewards').className = `flex-1 py-2 text-sm font-bold transition-colors ${tab === 'rewards' ? 'text-primary border-b-2 border-primary' : 'text-muted border-b-2 border-transparent'}`;
  document.getElementById('history-content-points').style.display = tab === 'points' ? 'block' : 'none';
  document.getElementById('history-content-rewards').style.display = tab === 'rewards' ? 'block' : 'none';
}

const HISTORY_WINDOW_DAYS = 30;

async function loadHistoryData(force = false) {
  const filterSelect = document.getElementById('history-user-filter');
  const existingVal = filterSelect.value;
  const filterUser = filterSelect.value || (currentUser.role === 'User' ? currentUser.username : 'all');

  if (!force && _historyCache && _historyCacheFilter === filterUser) {
    return renderHistoryTabItems();
  }

  showHistorySkeleton();

  // Fetch everything that doesn't depend on the selected filter in one round-trip.
  let usersPromise = Promise.resolve({ data: null });
  if (currentUser.role !== 'User') {
    let usersQuery = supabaseClient.from('users').select('*');
    if (getFamilyId()) usersQuery = usersQuery.eq('family_id', getFamilyId());
    usersPromise = usersQuery;
  }
  
  const [usersDataResponse, appStartDate] = await Promise.all([
    usersPromise, 
    getCachedAppStartDate()
  ]);
  const usersData = usersDataResponse.data;

  let usersList = [];
  if (currentUser.role === 'User') {
    filterSelect.innerHTML = `<option value="${currentUser.username}">Việc của tôi (${currentUser.name})</option>`;
    filterSelect.classList.remove('hidden');
  } else {
    usersList = usersData || [];
    filterSelect.classList.remove('hidden');
    let html = '<option value="all">Tất cả thành viên</option>';
    usersList.forEach(u => { html += `<option value="${u.username}">${u.name}</option>`; });
    filterSelect.innerHTML = html;
    if (existingVal) filterSelect.value = existingVal;
  }

  const familyUsernames = usersList.length > 0 ? usersList.map(u => u.username) : [currentUser.username];

  // Bound history to a recent rolling window so it stays fast no matter how long
  // the family has been using the app. Items older than this (and past the claim
  // window) aren't actionable anyway.
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - HISTORY_WINDOW_DAYS);
  windowStart.setHours(0, 0, 0, 0);
  const effectiveStart = (appStartDate && appStartDate > windowStart) ? appStartDate : windowStart;

  // Fetch transactions/tasks/logs (all bounded by the window) in parallel.
  let transQuery = supabaseClient.from('transactions').select('*').gte('created_at', effectiveStart.toISOString()).order('created_at', { ascending: false });
  if (filterUser !== 'all') transQuery = transQuery.eq('username', filterUser);
  else transQuery = transQuery.in('username', familyUsernames);

  let rawTasksQuery = supabaseClient.from('tasks').select('*');
  if (getFamilyId()) rawTasksQuery = rawTasksQuery.eq('family_id', getFamilyId());

  let logsQuery = supabaseClient.from('task_logs').select('*').neq('status', 'Rejected').gte('created_at', effectiveStart.toISOString());

  // Đơn quà đọc từ bảng trạng thái riêng, không giới hạn 30 ngày: đơn còn treo
  // phải luôn thao tác được, và lịch sử quà vốn ít bản ghi nên không nặng.
  let redemptionQuery = supabaseClient.from('reward_redemptions').select('*').order('created_at', { ascending: false }).limit(200);
  if (filterUser !== 'all') redemptionQuery = redemptionQuery.eq('username', filterUser);
  else redemptionQuery = redemptionQuery.in('username', familyUsernames);

  const [{ data: trans }, { data: rawTasks }, { data: logs }, { data: redemptions, error: redErr }] =
    await Promise.all([transQuery, rawTasksQuery, logsQuery, redemptionQuery]);
  const tasks = unpackTasks(rawTasks);
  if (redErr) showToast(rewardError(redErr), 'error');
  window._lastRedemptions = redemptions || [];

  const logMap = {};
  // Việc loại "trừ tất cả thành viên" chỉ cần BẤT KỲ AI làm là cả nhà thoát phạt.
  // Phải tra bằng map task+kỳ, không được duyệt qua usersList: tài khoản role User
  // không được nạp danh sách thành viên nên usersList rỗng, khiến mọi việc anh chị
  // em đã làm vẫn bị hiện "Chưa xong" kèm nút Claim.
  const anyLogMap = {};
  if (logs) logs.forEach(l => {
    logMap[l.task_id + '_' + l.period_id + '_' + l.username] = l.status;
    anyLogMap[l.task_id + '_' + l.period_id] = true;
  });

  let historyItems = [];

  // Prepare transaction items
  if (trans) {
    trans.forEach(t => {
      let actType = 'Earn';
      let actionText = 'Cộng điểm';
      let taskName = t.description;

      let rStatus = 'Đã nhận';
      if (t.type === 'Spend') {
          actType = 'Spend';
          actionText = 'Đổi quà';
          taskName = t.description;
          if (taskName.startsWith('[Chờ trao] ')) {
              rStatus = 'Chờ trao';
              taskName = taskName.replace('[Chờ trao] Đổi quà: ', '').trim();
          } else if (taskName.startsWith('[Đã trao] ')) {
              rStatus = 'Đã trao';
              taskName = taskName.replace('[Đã trao] Đổi quà: ', '').trim();
          } else {
              taskName = taskName.replace('Đổi quà: ', '').trim();
          }
      }
      else if (t.type === 'Refund') {
          actType = 'Refund';
          actionText = 'Hoàn điểm';
          taskName = (t.description || '').replace('Hoàn điểm: ', '').trim();
      }
      // 'Cancelled' là dữ liệu của bản vá trước khi có bảng reward_redemptions.
      else if (t.type === 'Cancelled') {
          actType = 'Cancelled';
          actionText = 'Đã huỷ';
          rStatus = 'Đã huỷ';
          taskName = (t.description || '').replace('[Đã huỷ] Đổi quà: ', '').trim();
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
          } else if (taskName.startsWith('Bị phạt lỗi: ')) {
              actionText = 'Vi phạm';
              taskName = taskName.replace('Bị phạt lỗi: ', '').trim();
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
          } else if (taskName.startsWith('Thưởng điểm: ')) {
              // Quà tặng điểm đã được nhận -> vẫn thuộc lịch sử phần thưởng.
              actionText = 'Quà điểm';
                  rStatus = 'Đã nhận';
              taskName = taskName.replace('Thưởng điểm: ', '').trim();
          }
      }

      let fullName = t.username;
      if (typeof usersList !== 'undefined' && usersList) {
        const u = usersList.find(x => x.username === t.username);
        if (u && u.name) fullName = u.name;
      }

      historyItems.push({
        id: t.id,
        date: new Date(t.created_at),
        type: actType,
        actionText: actionText,
        taskName: taskName,
        userName: fullName,
        username_raw: t.username,
        amount: t.amount,
        rStatus: rStatus
      });
    });
  }

  // Prepare missed tasks items (bounded to the same rolling window as the queries above)
  if (tasks) {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    for (let d = new Date(effectiveStart); d <= today; d.setDate(d.getDate() + 1)) {
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
          const pType = t.penalty_type || 'all';
          const usernamesToCheck = filterUser === 'all' ? (usersList.map(u => u.username)) : [filterUser];
          
          usernamesToCheck.forEach(uName => {
            if (!logMap[t.id + '_' + pId + '_' + uName]) {
              let shouldAdd = true;
              
              // Handle 'all' penalty: if someone did it, no one is penalized
              if (pType === 'all' && anyLogMap[t.id + '_' + pId]) shouldAdd = false;

              if (shouldAdd && t.calc_admin === false) {
                let userObj = usersList.find(u => u.username === uName) || currentUser;
                if (userObj.role === 'Admin' || userObj.role === 'Moderator' || userObj.role === 'Super Admin') shouldAdd = false;
              }

              if (shouldAdd) {
                let fullName = 'Toàn Đội';
                if (filterUser !== 'all' || pType === 'individual') {
                  const u = usersList.find(x => x.username === uName);
                  if (u && u.name) fullName = u.name;
                  else fullName = uName;
                }
                
                // Avoid duplicates for 'all' penalty when viewing 'all' users
                if (filterUser === 'all' && pType === 'all') {
                   const alreadyAdded = historyItems.some(h => h.type === 'Missed' && h.taskName === t.task_name && h.date.getTime() === new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59).getTime());
                   if (alreadyAdded) shouldAdd = false;
                }

                if (shouldAdd) {
                  historyItems.push({
                    date: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59),
                    type: 'Missed',
                    actionText: 'Chưa xong',
                    taskName: t.task_name,
                    userName: fullName,
                    amount: t.penalty,
                    taskId: t.id,
                    periodId: pId,
                    username_raw: uName
                  });
                }
              }
            }
          });
        }
      });
    }
  }

  historyItems.sort((a, b) => b.date - a.date);
  
  _historyCache = historyItems;
  _historyCacheFilter = filterUser;
  window._lastHistoryUsersList = usersList; // cache for render
  renderHistoryTabItems();
}

function renderHistoryTabItems() {
  const filterSelect = document.getElementById('history-user-filter');
  const filterUser = filterSelect.value || (currentUser.role === 'User' ? currentUser.username : 'all');
  const usersList = window._lastHistoryUsersList || [];
  const historyItems = _historyCache || [];
  
  // Render Points (Mix of Earn, Missed, adjusted, spend...)
  const pContainer = document.getElementById('history-points-list');
  if (historyItems.length === 0) {
    pContainer.innerHTML = '<div class="text-center text-muted py-8 text-sm">Chưa có lịch sử nào.</div>';
  } else {
    const pHtml = [];
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
      else if (item.type === 'Cancelled' || item.type === 'Refund') {
          icon = 'fa-rotate-left'; valClass = 'text-muted'; sign = '+';
          bgAcc = 'bg-gray-500'; iconBg = 'bg-gray-500/10 text-muted'; pillClass = 'bg-surface text-muted border-borderline';
      }

      let claimBtn = '';
      if (item.type === 'Missed' && item.taskId) {
         // Check if within claim max days
         const now = new Date();
         const diffTime = Math.abs(now - item.date);
         const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
         if (diffDays <= familySettings.claim_max_days && (item.username_raw === currentUser.username || currentUser.role !== 'User')) {
             claimBtn = `<button onclick="openClaimModal('${item.taskId}', '${item.taskName.replace(/'/g, "\\'")}', '${item.periodId}', '${dateStr}')" class="mt-2 w-full bg-orange-500/10 text-orange-500 border border-orange-500/20 py-1.5 rounded-lg text-xs font-bold active-scale hover:bg-orange-500 hover:text-white transition-colors flex items-center justify-center gap-1.5"><i class="fa-solid fa-rotate-left"></i> Claim ngay</button>`;
         }
      }

      pHtml.push(`
            <div class="bg-card border border-borderline rounded-2xl p-0 shadow-sm flex flex-col gap-0 hover:border-primary/30 transition-all hover:shadow-md group relative overflow-hidden mb-2">
                <div class="absolute inset-y-0 left-0 w-1 ${bgAcc} opacity-50"></div>

                <div class="flex items-stretch justify-between w-full">
                    <div class="flex flex-col items-center justify-center w-[76px] shrink-0 border-r border-borderline/50 pr-2 pl-3 py-3">
                        <div class="w-10 h-10 rounded-2xl ${iconBg} flex items-center justify-center text-xl shadow-inner group-hover:scale-110 transition-transform mb-1.5"><i class="fa-solid ${icon}"></i></div>
                        <div class="text-[9px] font-black text-center leading-tight ${valClass} uppercase tracking-wider">${item.actionText}</div>
                    </div>

                    <div class="flex-1 min-w-0 pl-3 pr-2 py-3 flex flex-col justify-center">
                        ${filterUser === 'all' || item.userName === 'Toàn Đội' ? `<div class="text-[11px] font-bold text-muted mb-0.5"><i class="fa-solid fa-user text-[9px] mr-1"></i>${item.userName}</div>` : ''}
                        <div class="font-bold text-main text-sm break-words whitespace-normal leading-snug">${item.taskName}</div>
                        <div class="text-[10px] text-muted mt-1.5 flex items-center gap-1.5"><i class="fa-regular fa-clock"></i> ${dateStr}</div>
                        ${claimBtn}
                    </div>

                    <div class="pr-3.5 py-3 flex items-center justify-end shrink-0">
                        <div class="font-black text-sm px-2.5 py-1.5 rounded-xl ${pillClass} border">${sign}${item.amount}</div>
                    </div>
                </div>
            </div>`);
    });

    if (filterUser !== 'all') {
      let uPt = currentUser.points;
      if (filterUser !== currentUser.username) {
        let uObj = usersList.find(u => u.username === filterUser);
        if (uObj) uPt = uObj.points;
      }
      pHtml.push(`<div class="bg-primary/10 border border-primary/20 rounded-2xl p-4 shadow-sm flex justify-between mt-2">
                <span class="font-bold text-main text-sm">Tổng điểm của ${filterUser === currentUser.username ? 'bạn' : filterUser}:</span>
                <span class="font-black text-primary text-base">${uPt}</span>
            </div>`);
    }
    pContainer.innerHTML = pHtml.join('');
  }

  // Render Rewards History - đọc từ bảng trạng thái, không suy ra từ mô tả giao dịch.
  const rContainer = document.getElementById('history-rewards-list');
  const redemptions = (window._lastRedemptions || []).filter(r => filterUser === 'all' || r.username === filterUser);
  if (redemptions.length === 0) {
    rContainer.innerHTML = '<div class="text-center text-muted py-8 text-sm">Chưa có phần thưởng nào.</div>';
  } else {
    rContainer.innerHTML = redemptions.map(r => renderRedemptionCard(r, { showUser: filterUser === 'all' })).join('');
  }
}

// Một thẻ đơn quà, dùng chung cho tab Lịch sử và tab Trao quà của admin.
function renderRedemptionCard(r, opts = {}) {
  const showUser = !!opts.showUser;
  const isOwner = r.username === currentUser.username;
  const isGrant = r.kind === 'grant';
  const meta = REDEMPTION_STATUS[r.status] || { text: r.status, cls: 'bg-surface text-muted border-borderline' };
  const dateStr = new Date(r.created_at).toLocaleDateString('vi-VN');
  const userLabel = (window._lastHistoryUsersList || []).concat(window._lastAdminUsersList || [])
      .reduce((acc, u) => (u.username === r.username && u.name) ? u.name : acc, r.username);

  let iconWrap = 'bg-amber-500/10 text-amber-500', iconName = 'fa-gift';
  let amountWrap = 'text-yellow-500 bg-amber-500/10 border-yellow-500/20', amountText = `-${r.cost}`;
  if (isGrant) {
    iconWrap = 'bg-primary/10 text-primary';
    amountWrap = 'text-primary bg-primary/10 border-primary/20';
    amountText = `+${r.cost}`;
  }
  if (r.status === 'cancelled' || r.status === 'revoked') {
    iconWrap = 'bg-gray-500/10 text-muted'; iconName = 'fa-rotate-left';
    amountWrap = 'text-muted bg-surface border-borderline';
    amountText = r.status === 'cancelled' ? `+${r.cost}` : `${r.cost}`;
  }

  const btn = (label, fn, cls) =>
    `<button onclick="${fn}(${Number(r.id)})" class="flex-1 text-xs px-3 py-1.5 rounded-lg font-bold active-scale text-center ${cls}">${label}</button>`;
  const ghost = 'bg-surface text-muted border border-borderline hover:border-red-500/40 hover:text-red-500 transition-colors';

  const actions = [];
  if (r.status === 'pending_delivery') {
    if (isAdminOrMod()) actions.push(btn('Đã trao quà', 'markRedemptionDelivered', 'bg-primary text-white shadow'));
    // Chưa trao thì cả chính chủ lẫn Admin đều huỷ được để lấy lại điểm.
    if (isOwner || isAdminOrMod()) actions.push(btn('Huỷ &amp; hoàn điểm', 'cancelRedemption', ghost));
  } else if (r.status === 'delivered') {
    // Chính chủ xác nhận là đường chính; Admin đóng hộ để đơn không treo mãi.
    if (isOwner) actions.push(btn('Mình đã nhận quà', 'completeRedemption', 'bg-success text-white shadow'));
    else if (isAdminOrMod()) actions.push(btn('Đóng đơn hộ', 'completeRedemption', 'bg-surface text-main border border-borderline hover:border-success/40 hover:text-success transition-colors'));
    if (isAdminOrMod()) actions.push(btn('Huỷ &amp; hoàn điểm', 'cancelRedemption', ghost));
  } else if (r.status === 'pending_claim') {
    if (isOwner) actions.push(btn('Nhận ngay', 'claimPointGrant', 'bg-primary text-white shadow'));
    else if (isAdminOrMod()) actions.push(btn('Thu hồi', 'revokePointGrant', ghost));
  }

  const waitedDays = Math.floor((Date.now() - new Date(r.created_at).getTime()) / 86400000);
  const openStatus = (r.status === 'pending_delivery' || r.status === 'delivered' || r.status === 'pending_claim');
  const waitBadge = (openStatus && waitedDays >= 3)
    ? `<span class="text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20 whitespace-nowrap">Đã chờ ${waitedDays} ngày</span>` : '';

  // Bố cục 3 tầng. Badge trạng thái nằm ở TẦNG RIÊNG chứ không chèn vào cuối
  // dòng tên quà - tên dài bao nhiêu cũng không đẩy được badge vỡ dòng.
  //   tầng 1: [icon] [tên quà, tối đa 2 dòng]            [số điểm]
  //   tầng 2:        [badge trạng thái] [ngày] [đã chờ]
  //   tầng 3:        [ghi chú] rồi [nút hành động] full-width
  return `
        <div class="bg-card border border-borderline rounded-2xl p-4 shadow-sm hover:border-amber-500/30 transition-all hover:shadow-md group mb-3">
            <div class="flex items-start gap-3">
                <div class="w-11 h-11 shrink-0 rounded-2xl ${iconWrap} flex items-center justify-center text-xl shadow-inner group-hover:scale-110 transition-transform"><i class="fa-solid ${iconName}"></i></div>
                <div class="flex-1 min-w-0">
                    ${showUser ? `<div class="text-[11px] font-bold text-muted mb-0.5 truncate"><i class="fa-solid fa-user text-[9px] mr-1"></i>${escHtml(userLabel)}</div>` : ''}
                    <div class="font-bold text-main text-sm leading-snug break-words line-clamp-2" title="${escHtml(r.reward_name)}">${escHtml(r.reward_name)}</div>
                </div>
                <div class="font-black text-sm px-2.5 py-1 rounded-xl border shadow-inner shrink-0 ${amountWrap}">${amountText}</div>
            </div>
            <div class="flex flex-wrap items-center gap-x-2 gap-y-1.5 mt-2 pl-14">
                <span class="text-[10px] px-2 py-0.5 rounded-full border font-bold whitespace-nowrap ${meta.cls}">${escHtml(meta.text)}</span>
                <span class="text-[10px] text-muted flex items-center gap-1 whitespace-nowrap"><i class="fa-regular fa-clock"></i>${dateStr}</span>
                ${waitBadge}
            </div>
            ${r.user_note ? `<div class="text-[10px] text-muted italic bg-surface rounded-lg px-2.5 py-1.5 mt-2 ml-14 break-words">Ghi chú: ${escHtml(r.user_note)}</div>` : ''}
            ${actions.length ? `<div class="flex gap-2 mt-3">${actions.join('')}</div>` : ''}
        </div>`;
}

function switchReportTab(tab) {
  // Leaderboard is now always visible on top, no tab switching needed
  currentReportTab = tab;
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
  const cacheKey = `${startDate.toISOString()}_${endDate.toISOString()}`;
  if (_reportCacheKey === cacheKey && _reportDataCache) {
    currentReportData = _reportDataCache;
    renderReportFromCache();
    return;
  }

  document.getElementById('report-period').innerText = 'Đang tải...'; 
  showReportSkeleton();

  let usersQuery = supabaseClient.from('users').select('*');
  if (getFamilyId()) usersQuery = usersQuery.eq('family_id', getFamilyId());

  // Users must be known first to scope trans/logs by family username — but tasks
  // and the app-start marker don't depend on it, so fetch those in parallel too,
  // then fire the family-scoped queries in a second parallel batch.
  let rawTasksQuery = supabaseClient.from('tasks').select('*');
  if (getFamilyId()) rawTasksQuery = rawTasksQuery.eq('family_id', getFamilyId());

  const [{ data: users }, { data: rawTasks }, appStartDate] = await Promise.all([
    usersQuery, 
    rawTasksQuery, 
    getCachedAppStartDate()
  ]);
  const tasks = unpackTasks(rawTasks);

  const familyUsernames = (users || []).map(u => u.username);

  // Always fetch all data over the period to calculate the true leaderboard for everyone.
  let transQuery = supabaseClient.from('transactions').select('*').gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString());
  if (familyUsernames.length > 0) transQuery = transQuery.in('username', familyUsernames);
  // Báo cáo duyệt theo period_id chứ không theo created_at, nên KHÔNG được chặn
  // bằng đúng mép cửa sổ - kỳ tuần/tháng có thể bắt đầu trước startDate, và log
  // duyệt/claim muộn có created_at sau endDate.
  // Nhưng để hẳn không chặn thì query sẽ phình tới ngưỡng cắt 1000 dòng của
  // PostgREST rồi âm thầm mất log. Nên chặn dưới với biên rộng 45 ngày: log luôn
  // được nộp SAU khi kỳ bắt đầu, biên này thừa sức phủ mọi kỳ vắt qua mép.
  // Không chặn trên, để log duyệt muộn vẫn vào.
  const logFloor = new Date(startDate);
  logFloor.setDate(logFloor.getDate() - 45);
  let logsQuery = supabaseClient.from('task_logs').select('*').gte('created_at', logFloor.toISOString());
  if (familyUsernames.length > 0) logsQuery = logsQuery.in('username', familyUsernames);

  const [{ data: trans }, { data: logs }] = await Promise.all([transQuery, logsQuery]);

  document.getElementById('report-period').innerText = `${startDate.toLocaleDateString('vi-VN')} - ${endDate.toLocaleDateString('vi-VN')}`;

  currentReportData = { tasks: tasks || [], logs: logs || [], startDate, endDate, users: users || [], appStartDate, trans: trans || [] };
  
  _reportDataCache = currentReportData;
  _reportCacheKey = cacheKey;
  
  renderReportFromCache();
}

function renderReportFromCache() {
  if (!currentReportData) return;
  const { tasks, logs, startDate, endDate, users, appStartDate, trans } = currentReportData;

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
      // Đơn bị huỷ đã hoàn điểm -> không tính là đã tiêu nữa.
      if (t.type === 'Refund') reportData[t.username].spent -= t.amount;
      if (t.type === 'Penalty') reportData[t.username].penalty += t.amount;
    }
  });

  // Dynamic penalty calculation for Leaderboard
  const actualEndDate = endDate > new Date() ? new Date() : endDate;
  let effectiveStartDate = new Date(startDate);
  if (appStartDate && effectiveStartDate < appStartDate) effectiveStartDate = new Date(appStartDate);

  const logMap = {};
  if (logs) logs.forEach(l => { if (l.status === 'Approved' || l.status === 'Pending Approval') logMap[l.task_id + '_' + l.period_id + '_' + l.username] = l.status; });

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
        const pType = t.penalty_type || 'all';
        Object.keys(reportData).forEach(username => {
          let hasLog = logMap[t.id + '_' + pId + '_' + username];
          let shouldPenalize = false;

          if (pType === 'all') {
            const anyoneDidIt = Object.keys(reportData).some(uname => logMap[t.id + '_' + pId + '_' + uname]);
            if (!anyoneDidIt) shouldPenalize = true;
          } else {
            if (!hasLog) shouldPenalize = true;
          }

          if (shouldPenalize && t.calc_admin === false) {
            const role = reportData[username].role;
            if (role === 'Admin' || role === 'Moderator' || role === 'Super Admin') shouldPenalize = false;
          }

          if (shouldPenalize) {
            reportData[username].penalty += Number(t.penalty || 0);
          }
        });
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
    if (l.status === 'Approved' || l.status === 'Pending Approval') {
        const key = l.task_id + '_' + l.period_id + '_' + l.username;
        logMap[key] = l;
        // Also keep a general key for 'all' logic
        if (!logMap[l.task_id + '_' + l.period_id] || logMap[l.task_id + '_' + l.period_id].status === 'Pending Approval') {
            logMap[l.task_id + '_' + l.period_id] = l;
        }
    }
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

  const todayStrReport = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;

  for (let d = new Date(effectiveStartDate); d <= actualEndDate; d.setDate(d.getDate() + 1)) {
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    // Determine if today is a holiday (to skip missed task penalties, but still count completions)
    const isHoliday = checkIfHoliday(d, tasks);

    const dayOfWeek = d.getDay(); const dayOfWeekAdjusted = dayOfWeek === 0 ? 7 : dayOfWeek;
    const weekOfMonth = Math.ceil(d.getDate() / 7);
    const weekStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-W${weekOfMonth}`;

    tasks.forEach(t => {
      let isDue = false, pId = '';
      if (t.frequency === 'Daily') { isDue = true; pId = dateStr; }
      else if (t.frequency === 'Weekly' && t.schedule == dayOfWeekAdjusted) { isDue = true; pId = dateStr; }
      else if (t.frequency === 'Monthly' && t.schedule == weekOfMonth) { isDue = true; pId = weekStr; }
      else if (t.frequency === 'Adhoc' && t.schedule === dateStr) { isDue = true; pId = dateStr; }

      if (isDue) {
        const pType = t.penalty_type || 'all';
        const usernamesToCheck = filterUser === 'all' ? (currentReportData.users || []).map(u => u.username) : [filterUser];
        
        // Handle completions
        usernamesToCheck.forEach(uName => {
           const log = logMap[t.id + '_' + pId + '_' + uName];
           if (log && log.status === 'Approved') {
              completedTotal++;
              completedMap[t.id].times++;
              completedMap[t.id].pts += t.points;
           }
        });

        // Handle misses
        if (!isHoliday && t.penalty > 0 && dateStr < todayStrReport) {
           if (filterUser === 'all') {
              if (pType === 'all') {
                 // Shared task, missed by family if no one did it
                 const anyoneDidIt = (currentReportData.users || []).some(u => {
                    const log = logMap[t.id + '_' + pId + '_' + u.username];
                    return log && (log.status === 'Approved' || log.status === 'Pending Approval');
                 });
                 if (!anyoneDidIt) {
                    // Check if AT LEAST ONE user is liable to be penalized
                    const someoneLiable = (currentReportData.users || []).some(u => {
                       if (t.calc_admin === false && (u.role === 'Admin' || u.role === 'Moderator' || u.role === 'Super Admin')) return false;
                       return true;
                    });
                    if (someoneLiable) {
                       missedTotal++;
                       missedMap[t.id].times++;
                       missedMap[t.id].pts += t.penalty;
                    }
                 }
              } else {
                 // Individual task, count each user who missed it and is liable
                 (currentReportData.users || []).forEach(u => {
                    const log = logMap[t.id + '_' + pId + '_' + u.username];
                    const isDoneOrPending = log && (log.status === 'Approved' || log.status === 'Pending Approval');
                    if (!isDoneOrPending) {
                       let shouldCount = true;
                       if (t.calc_admin === false && (u.role === 'Admin' || u.role === 'Moderator' || u.role === 'Super Admin')) shouldCount = false;
                       if (shouldCount) {
                          missedTotal++;
                          missedMap[t.id].times++;
                          missedMap[t.id].pts += t.penalty;
                       }
                    }
                 });
              }
           } else {
              // Specific user view
              const uName = filterUser;
              const log = logMap[t.id + '_' + pId + '_' + uName];
              const hasLog = log && (log.status === 'Approved' || log.status === 'Pending Approval');
              let isMissed = false;

              if (pType === 'all') {
                 const anyoneDidIt = (currentReportData.users || []).some(u => {
                    const l2 = logMap[t.id + '_' + pId + '_' + u.username];
                    return l2 && (l2.status === 'Approved' || l2.status === 'Pending Approval');
                 });
                 if (!anyoneDidIt) isMissed = true;
              } else {
                 if (!hasLog) isMissed = true;
              }

              if (isMissed) {
                 let shouldCount = true;
                 if (t.calc_admin === false) {
                    const userObj = (currentReportData.users || []).find(u => u.username === uName) || currentUser;
                    if (userObj.role === 'Admin' || userObj.role === 'Moderator' || userObj.role === 'Super Admin') shouldCount = false;
                 }
                 if (shouldCount) {
                    missedTotal++;
                    missedMap[t.id].times++;
                    missedMap[t.id].pts += t.penalty;
                 }
              }
           }
        }
      }
    });
  }

  document.getElementById('stat-completed').innerText = completedTotal;
  document.getElementById('stat-missed-pen').innerText = missedTotal;

  const compContainer = document.getElementById('report-completed-container');
  const completedArr = Object.values(completedMap).filter(x => x.times > 0).sort((a, b) => b.times - a.times);
  if (completedArr.length === 0) {
    compContainer.innerHTML = '<div class="text-center text-muted text-[11px] py-4 bg-input rounded-2xl border border-dashed border-borderline">Chưa có việc nào hoàn thành.</div>';
  } else {
    compContainer.innerHTML = completedArr.map(t => `
            <div class="bg-card rounded-2xl p-3 border border-borderline flex items-center justify-between shadow-sm hover:border-success/30 transition-all mb-2">
                <div class="flex items-center gap-3">
                    <div class="w-11 h-11 rounded-[14px] bg-success/10 flex items-center justify-center text-success shadow-inner text-xl"><i class="${t.icon || 'fa-solid fa-check'}"></i></div>
                    <div><div class="font-bold text-main text-sm">${t.name}</div><div class="text-[11px] text-muted">Đã hoàn thành <span class="font-bold text-main">${t.times}</span> lần</div></div>
                </div>
                <div class="text-success font-black text-sm bg-success/10 px-2.5 py-1.5 rounded-lg border border-success/20">+${t.pts}</div>
            </div>`).join('');
  }

  const missContainer = document.getElementById('report-missed-container');
  const missedArr = Object.values(missedMap).filter(x => x.times > 0).sort((a, b) => b.times - a.times);
  if (missedArr.length === 0) {
    missContainer.innerHTML = '<div class="text-center text-success text-[11px] py-4 bg-success/10 rounded-2xl border border-success/20 font-bold shadow-sm">Chưa có việc nào bị lỡ.</div>';
  } else {
    missContainer.innerHTML = missedArr.map(t => `
            <div class="bg-card rounded-2xl p-3 border border-borderline flex items-center justify-between shadow-sm hover:border-red-500/30 transition-all mb-2">
                <div class="flex items-center gap-3">
                    <div class="w-11 h-11 rounded-[14px] bg-red-500/10 flex items-center justify-center text-red-500 shadow-inner text-xl"><i class="${t.icon || 'fa-solid fa-xmark'}"></i></div>
                    <div><div class="font-bold text-main text-sm">${t.name}</div><div class="text-[11px] text-muted">Bị lỡ <span class="font-bold text-red-400">${t.times}</span> lần</div></div>
                </div>
                <div class="text-red-500 font-black text-sm bg-red-500/10 px-2.5 py-1.5 rounded-lg border border-red-500/20">-${t.pts}</div>
            </div>`).join('');
  }
}

function renderLeaderboard(data) {
  const container = document.getElementById('report-content-leaderboard');

  if (!data || data.length === 0) { container.innerHTML = '<div class="text-center text-muted py-8 text-sm">Chưa có dữ liệu.</div>'; return; }
  
  // Sort by currentPoints descending for the always-visible leaderboard
  const sorted = [...data].sort((a, b) => b.currentPoints - a.currentPoints);
  
  container.innerHTML = sorted.map((user, index) => {
    const isMe = user.username === currentUser.username;
    const score = user.currentPoints;
    
    // Top 3 get special styling
    if (index === 0) {
      return `
        <div class="bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border-2 border-yellow-500/30 rounded-2xl p-4 flex items-center gap-4 shadow-lg shadow-yellow-500/10 ${isMe ? 'ring-2 ring-primary ring-offset-2 ring-offset-[var(--bg-dark)]' : ''}">
            <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/30"><i class="fa-solid fa-crown text-xl"></i></div>
            <div class="flex-1">
                <div class="font-black text-main text-base">${user.name} ${isMe ? '<span class="text-primary text-[10px] ml-1 bg-primary/10 px-1.5 py-0.5 rounded-full font-black border border-primary/20">(Bạn)</span>' : ''}</div>
                <div class="text-xs text-muted mt-0.5">Hạng 1 · <span class="text-success font-bold">+${user.earned}</span> <span class="text-red-500 font-bold">-${user.penalty}</span></div>
            </div>
            <div class="text-right"><div class="text-2xl font-black text-yellow-500">${score}</div><div class="text-[10px] text-muted font-bold">điểm</div></div>
        </div>`;
    } else if (index <= 2) {
      const medalColor = index === 1 ? 'text-gray-300' : 'text-amber-600';
      const bgAccent = index === 1 ? 'bg-gray-500/5 border-gray-500/20' : 'bg-amber-600/5 border-amber-600/20';
      return `
        <div class="${bgAccent} border rounded-2xl p-3.5 flex items-center gap-3 ${isMe ? 'ring-2 ring-primary ring-offset-1 ring-offset-[var(--bg-dark)]' : ''}">
            <div class="w-9 h-9 rounded-xl bg-surface flex items-center justify-center"><i class="fa-solid fa-medal ${medalColor} text-lg"></i></div>
            <div class="flex-1">
                <div class="font-bold text-main text-sm">${user.name} ${isMe ? '<span class="text-primary text-[10px] ml-1 bg-primary/10 px-1 rounded font-black border border-primary/20">(Bạn)</span>' : ''}</div>
                <div class="text-[10px] text-muted">Hạng ${index + 1} · <span class="text-success font-bold">+${user.earned}</span> <span class="text-red-500 font-bold">-${user.penalty}</span></div>
            </div>
            <div class="font-black text-base text-main">${score}<span class="text-[10px] text-muted ml-0.5">pts</span></div>
        </div>`;
    } else {
      return `
        <div class="bg-card border ${isMe ? 'border-primary bg-primary/5' : 'border-borderline'} rounded-2xl p-3 flex items-center gap-3">
            <div class="w-7 h-7 rounded-full bg-surface text-muted flex items-center justify-center text-xs font-bold">${index + 1}</div>
            <div class="flex-1">
                <div class="font-bold text-main text-sm">${user.name} ${isMe ? '<span class="text-primary text-[10px] ml-1 bg-primary/10 px-1 rounded font-black border border-primary/20">(Bạn)</span>' : ''}</div>
            </div>
            <div class="font-black text-sm text-main">${score}<span class="text-[10px] text-muted ml-0.5">pts</span></div>
        </div>`;
    }
  }).join('');
}

async function loadAdminData(type) {
  const menuGrid = document.getElementById('admin-menu-grid');
  const listContainer = document.getElementById('admin-list-container');
  const addBtn = document.getElementById('admin-add-btn');
  const resetBtn = document.getElementById('admin-reset-btn');

  if (!type) {
    menuGrid.classList.remove('hidden');
    listContainer.innerHTML = '';
    addBtn.style.display = 'none';
    resetBtn.style.display = 'none';
    return;
  }
  
  menuGrid.classList.add('hidden');
  currentAdminType = type;
  
  document.querySelectorAll('#view-admin button[id^="admin-tab-"]').forEach(el => { 
    el.classList.remove('border-primary', 'bg-primary/10', 'text-primary', 'shadow-lg'); 
    el.classList.add('border-borderline', 'bg-card', 'text-muted'); 
  });
  
  const activeBtn = document.getElementById(`admin-tab-${type}`);
  if (activeBtn) {
    activeBtn.classList.remove('border-borderline', 'bg-card', 'text-muted');
    activeBtn.classList.add('border-primary', 'bg-primary/10', 'text-primary');
  }

  // Hide menu grid on mobile to save space, or just scroll to container
  // For now, let's keep it but add a back button in the container

  if (type === 'themes') {
    addBtn.style.display = 'none'; resetBtn.style.display = 'none';
    renderThemeAdmin();
  } else if (type === 'settings') {
    addBtn.style.display = 'none'; resetBtn.style.display = 'none';
    renderSettingsAdmin();
  } else if (type === 'approvals') {
    currentApprovalFilter = 'Pending Approval';
    addBtn.style.display = 'none'; resetBtn.style.display = 'none'; await loadApprovals();
  } else if (type === 'reward_approvals') {
    addBtn.style.display = 'none'; resetBtn.style.display = 'none'; await loadRewardApprovals();
  } else if (type === 'families') {
    addBtn.style.display = 'flex'; resetBtn.style.display = 'none';
    addBtn.onclick = () => openFamilyModal();
    await loadFamiliesData();
  } else {
    addBtn.style.display = 'flex';
    resetBtn.style.display = (type === 'users' && isAdmin()) ? 'flex' : 'none';

    addBtn.onclick = () => openModal(type);
    showLoading(true); let data = []; let extraHtml = '';
    if (type === 'users') {
      let usersQuery = supabaseClient.from('users').select('*');
      if (getFamilyId()) usersQuery = usersQuery.eq('family_id', getFamilyId());
      const res = await usersQuery; data = res.data || [];
      if (currentUser.role === 'Moderator') data = data.filter(u => u.role === 'User');
    }
    else if (type === 'tasks') {
      let tasksQuery = supabaseClient.from('tasks').select('*');
      if (getFamilyId()) tasksQuery = tasksQuery.eq('family_id', getFamilyId());
      const res = await tasksQuery; data = unpackTasks(res.data || []).filter(t => t.frequency !== 'Holiday');
    }
    else if (type === 'holidays') {
      let tasksQuery = supabaseClient.from('tasks').select('*');
      if (getFamilyId()) tasksQuery = tasksQuery.eq('family_id', getFamilyId());
      const res = await tasksQuery; data = unpackTasks(res.data || []).filter(t => t.frequency === 'Holiday');
    }
    else if (type === 'rewards') {
      let rewardsQuery = supabaseClient.from('rewards').select('*');
      if (getFamilyId()) rewardsQuery = rewardsQuery.eq('family_id', getFamilyId());
      const res = await rewardsQuery; data = res.data || [];
    }
    else if (type === 'violations') {
      addBtn.onclick = () => openModal('violations');
      let tasksQuery = supabaseClient.from('tasks').select('*');
      if (getFamilyId()) tasksQuery = tasksQuery.eq('family_id', getFamilyId());
      const res = await tasksQuery; data = unpackTasks(res.data || []).filter(t => t.frequency === 'Violation');
      // Add a special button to record a penalty using these types
      extraHtml = `<button onclick="openPenaltyModal()" class="w-full bg-red-500 text-white font-bold py-3 rounded-xl mb-4 active-scale shadow-lg shadow-red-500/20 flex items-center justify-center gap-2"><i class="fa-solid fa-gavel"></i> Ghi nhận phạt ngay</button>`;
    }
    else if (type === 'penalties') {
      addBtn.style.display = 'none'; // Use the record button instead
      let usersQuery = supabaseClient.from('users').select('*');
      if (getFamilyId()) usersQuery = usersQuery.eq('family_id', getFamilyId());
      const { data: usersData } = await usersQuery;
      const familyUsernames = (usersData || []).map(u => u.username);
      
      let penQuery = supabaseClient.from('transactions').select('*').eq('type', 'Penalty').order('created_at', { ascending: false }).limit(50);
      if (familyUsernames.length > 0) penQuery = penQuery.in('username', familyUsernames);
      const res = await penQuery; data = res.data || [];
      data = data.map(item => {
          const u = (usersData || []).find(x => x.username === item.username);
          return {...item, user_name: u ? u.name : item.username};
      });
      extraHtml = `<button onclick="openPenaltyModal()" class="w-full bg-red-500 text-white font-bold py-3 rounded-xl mb-4 active-scale shadow-lg shadow-red-500/20 flex items-center justify-center gap-2"><i class="fa-solid fa-gavel"></i> Ghi nhận phạt ngay</button>`;
    }
    showLoading(false); renderAdminList(type, data, extraHtml);
  }
  
  // Ensure "Back to menu" button is present
  const backBtnHtml = `<button onclick="loadAdminData(null)" class="flex items-center gap-2 text-sm font-bold text-main mb-4 active-scale bg-card border border-borderline rounded-2xl px-4 py-3 w-full shadow-sm hover:border-primary/30 transition-all"><i class="fa-solid fa-arrow-left text-primary mr-1"></i> Quay lại menu quản trị</button>`;
  if (!listContainer.innerHTML.includes('Quay lại menu quản trị')) {
    listContainer.innerHTML = backBtnHtml + listContainer.innerHTML;
  }
}

async function loadRewardApprovals() {
  showLoading(true);
  let usersQuery = supabaseClient.from('users').select('*');
  if (getFamilyId()) usersQuery = usersQuery.eq('family_id', getFamilyId());

  let pointRewardsQuery = supabaseClient.from('rewards').select('*').is('is_point_reward', true);
  if (getFamilyId()) pointRewardsQuery = pointRewardsQuery.eq('family_id', getFamilyId());

  const [{ data: usersData }, { data: pointRewards }] = await Promise.all([usersQuery, pointRewardsQuery]);
  window._lastAdminUsersList = usersData || [];
  const familyUsernames = (usersData || []).map(u => u.username);

  // Đơn đang mở đọc thẳng theo status - không phải tải cả lịch sử rồi lọc ở client.
  let openQuery = supabaseClient.from('reward_redemptions').select('*')
      .in('status', ['pending_delivery', 'delivered', 'pending_claim'])
      .order('created_at', { ascending: true });
  if (familyUsernames.length > 0) openQuery = openQuery.in('username', familyUsernames);

  const { data: openItems, error } = await openQuery;
  showLoading(false);

  const container = document.getElementById('admin-list-container');
  if (error) { container.innerHTML = rewardSchemaWarning(error); return; }

  const grants = (openItems || []).filter(r => r.kind === 'grant');
  const orders = (openItems || []).filter(r => r.kind === 'spend');

  // Mục 1: trao thưởng điểm
  let pointRewardsHtml = '';
  if (pointRewards && pointRewards.length > 0) {
    pointRewardsHtml = `
      <div class="mb-6">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center text-white text-lg shadow-lg shadow-primary/30"><i class="fa-solid fa-gift"></i></div>
          <div>
            <h3 class="font-black text-main text-base">Trao thưởng điểm</h3>
            <p class="text-[10px] text-muted">Chọn gói thưởng để trao cho thành viên</p>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          ${pointRewards.map(r => `
            <button onclick="openGrantByRewardModal('${escJsAttr(r.id)}', '${escJsAttr(r.reward_name)}', ${Number(r.cost) || 0})"
              class="bg-gradient-to-br from-primary/5 to-purple-500/5 border-2 border-primary/20 rounded-2xl p-4 text-center active-scale hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 transition-all group">
              <div class="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-2 text-2xl group-hover:scale-110 transition-transform"><i class="${escHtml(r.icon || 'fa-solid fa-gift')} text-primary"></i></div>
              <div class="font-bold text-main text-sm mb-1">${escHtml(r.reward_name)}</div>
              <div class="text-primary font-black text-base">+${Number(r.cost) || 0} pts</div>
              <div class="text-[10px] text-muted mt-1"><i class="fa-solid fa-paper-plane mr-1"></i>Bấm để trao</div>
            </button>
          `).join('')}
        </div>
      </div>`;
  } else {
    pointRewardsHtml = '<div class="text-center text-muted py-4 text-xs bg-card border border-dashed border-borderline rounded-2xl mb-4">Chưa có gói thưởng điểm nào. Vào <b>Phần thưởng</b> để thêm.</div>';
  }

  // Mục 2: điểm đã trao, chờ người nhận bấm nhận
  let grantsHtml = '';
  if (grants.length > 0) {
    grantsHtml = sectionDivider(`Đã trao, chờ nhận (${grants.length})`)
      + grants.map(g => renderRedemptionCard(g, { showUser: true })).join('');
  }

  // Mục 3: đơn đổi quà đang mở
  let ordersHtml = sectionDivider(`Đơn đổi quà đang mở (${orders.length})`);
  if (orders.length === 0) {
    ordersHtml += '<div class="text-center text-muted py-8 text-sm bg-card border border-dashed border-borderline rounded-2xl flex flex-col items-center gap-2"><i class="fa-solid fa-check-circle text-success text-2xl"></i>Tuyệt vời! Không có đơn nào đang chờ.</div>';
  } else {
    ordersHtml += orders.map(o => renderRedemptionCard(o, { showUser: true })).join('');
  }

  container.innerHTML = pointRewardsHtml + grantsHtml + ordersHtml;
}

function sectionDivider(label) {
  return `
      <div class="relative my-5">
        <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-borderline"></div></div>
        <div class="relative flex justify-center"><span class="bg-[var(--bg-dark)] px-3 text-[10px] font-bold text-muted uppercase tracking-wider">${escHtml(label)}</span></div>
      </div>`;
}

// Bảng/hàm mới chưa có -> nói thẳng phải chạy migration, đừng để màn hình trắng.
function rewardSchemaWarning(error) {
  return `
    <div class="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-sm">
      <div class="font-bold text-red-500 mb-1"><i class="fa-solid fa-triangle-exclamation mr-1.5"></i>Chưa chạy migration</div>
      <p class="text-main text-xs leading-relaxed">Tính năng phần thưởng cần bảng <b>reward_redemptions</b>. Mở Supabase → SQL Editor và chạy toàn bộ file <b>migration_reward_flow.sql</b> trong thư mục dự án, rồi tải lại trang.</p>
      <p class="text-[10px] text-muted mt-2 break-words">Chi tiết: ${escHtml((error && error.message) || '')}</p>
    </div>`;
}

function setApprovalFilter(status) {
  currentApprovalFilter = status;
  loadApprovals();
}

async function loadApprovals() {
  showLoading(true);
  let approvalQuery = supabaseClient.from('task_logs').select('*, tasks!inner(*), users(*)').eq('status', currentApprovalFilter);
  if (getFamilyId()) approvalQuery = approvalQuery.eq('tasks.family_id', getFamilyId());
  const { data, error } = await approvalQuery;
  showLoading(false);
  if (data) {
    data.forEach(item => {
      if (item.tasks && item.tasks.icon && item.tasks.icon.includes('|')) {
        const parts = item.tasks.icon.split('|');
        item.tasks.icon = parts[0];
        item.tasks.schedule = parts[1];
      }
    });
  }
  const container = document.getElementById('admin-list-container');

  // Render toggle tabs
  const toggleHtml = `
    <div class="flex border-b border-borderline mb-4 w-full">
      <button onclick="setApprovalFilter('Pending Approval')" class="flex-1 py-2.5 text-xs font-bold text-center transition-colors ${currentApprovalFilter === 'Pending Approval' ? 'text-primary border-b-2 border-primary font-black' : 'text-muted border-b-2 border-transparent'}">
        <i class="fa-solid fa-clock mr-1"></i>Chờ duyệt
      </button>
      <button onclick="setApprovalFilter('Rejected')" class="flex-1 py-2.5 text-xs font-bold text-center transition-colors ${currentApprovalFilter === 'Rejected' ? 'text-primary border-b-2 border-primary font-black' : 'text-muted border-b-2 border-transparent'}">
        <i class="fa-solid fa-circle-xmark mr-1"></i>Đã từ chối
      </button>
    </div>
  `;

  if (error) { container.innerHTML = toggleHtml; return showToast(error.message, 'error'); }
  if (!data || data.length === 0) {
    container.innerHTML = toggleHtml + `<div class="text-center text-muted py-8 text-sm bg-card border border-dashed border-borderline rounded-2xl w-full">${currentApprovalFilter === 'Pending Approval' ? 'Quá mượt! Không có việc chờ duyệt.' : 'Không có việc nào bị từ chối.'}</div>`;
    return;
  }

  const itemsHtml = data.map(item => {
    const taskDateFormatted = formatPeriodId(item.period_id);
    const dateObj = new Date(item.created_at);
    const timeStr = String(dateObj.getHours()).padStart(2, '0') + ':' + String(dateObj.getMinutes()).padStart(2, '0');
    const dateStr = dateObj.toLocaleDateString('vi-VN');
    const submitLabel = `${timeStr} ${dateStr}`;

    const isRejected = item.status === 'Rejected';
    const buttonsHtml = isRejected ?
      `<button onclick="approveTask('${item.id}', true, '${item.username}', ${item.tasks?.points}, '${item.tasks?.task_name}', ${item.tasks?.calc_admin ?? true})" class="w-full py-2.5 rounded-xl bg-success text-white text-xs font-bold active-scale shadow-lg shadow-success/30">Duyệt lại & Cộng Điểm</button>` :
      `<button onclick="approveTask('${item.id}', false, '${item.username}', ${item.tasks?.points}, '${item.tasks?.task_name}')" class="flex-1 py-2 rounded-xl bg-red-500/10 text-red-500 text-xs font-bold active-scale">Từ chối</button>
       <button onclick="approveTask('${item.id}', true, '${item.username}', ${item.tasks?.points}, '${item.tasks?.task_name}', ${item.tasks?.calc_admin ?? true})" class="flex-1 py-2 rounded-xl bg-success text-white text-xs font-bold active-scale shadow-lg shadow-success/30">Duyệt & Cộng Điểm</button>`;

    return `
        <div class="bg-card border border-borderline rounded-2xl p-4 shadow-sm hover:border-primary/50 transition-all mb-3 w-full">
            <div class="flex justify-between items-start mb-2">
                <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-xl bg-surface flex items-center justify-center text-primary shadow-inner text-base"><i class="${item.tasks?.icon || 'fa-solid fa-clipboard-list'}"></i></div>
                    <div>
                        <h4 class="font-bold text-main text-sm max-w-[180px] leading-tight mb-1">${item.tasks?.task_name}${item.tasks?.is_condition ? ' <span class="text-[9px] text-cyan-500 bg-cyan-500/10 px-1 py-0.5 rounded font-bold border border-cyan-500/20">⚡ĐK</span>' : ''}${item.is_claim ? ' <span class="text-[9px] text-orange-500 bg-orange-500/10 px-1 py-0.5 rounded font-bold border border-orange-500/20">🔄 CLAIM</span>' : ''}</h4>
                        <div class="text-xs text-muted mb-1">Bởi: <span class="text-main font-bold">${item.users?.name || item.username}</span></div>
                        <div class="text-[10px] text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 inline-block font-bold mb-1">Lịch việc: ${taskDateFormatted}</div>
                        <div class="text-[9px] text-muted"><i class="fa-regular fa-clock mr-1"></i>Nộp lúc: ${submitLabel}</div>
                        ${item.is_claim && item.claim_reason ? `<div class="text-[10px] text-muted italic mt-1 bg-surface p-1.5 rounded w-full line-clamp-2">Lý do: ${item.claim_reason}</div>` : ''}
                    </div>
                </div>
                <div class="flex flex-col items-end">
                    <div class="text-success font-black text-sm bg-success/10 px-2 py-1 rounded border border-success/20">+${item.is_claim ? Math.floor(item.tasks?.points * familySettings.claim_points_percent / 100) : item.tasks?.points}</div>
                    ${item.is_claim ? `<div class="text-[9px] text-muted mt-1 text-right max-w-[60px] leading-tight">Chỉ nhận ${familySettings.claim_points_percent}%</div>` : ''}
                </div>
            </div>
            <div class="flex gap-2 mt-4">
                ${buttonsHtml}
            </div>
        </div>`;
  });
  container.innerHTML = toggleHtml + itemsHtml.join('');
}

async function approveTask(logId, isApproved, username, points, taskName, calcAdmin = true) {
  showLoading(true); const status = isApproved ? 'Approved' : 'Rejected';
  // Get log details for condition checking and claim logic
  const { data: logData } = await supabaseClient.from('task_logs').select('task_id, period_id, is_claim').eq('id', logId).single();
  await supabaseClient.from('task_logs').update({ status: status, approved_by: currentUser.username, approved_at: new Date().toISOString() }).eq('id', logId);
  if (isApproved) {
    const { data: uData } = await supabaseClient.from('users').select('points, role').eq('username', username).single();
    if (uData && logData) {
      let finalPoints = points;
      let transactionDesc = `Được duyệt: ${taskName}`;
      
      if (logData.is_claim) {
          finalPoints = Math.floor(points * familySettings.claim_points_percent / 100);
          transactionDesc = `🔄 Claim: ${taskName} (${familySettings.claim_points_percent}%)`;
      }
      
      if (calcAdmin === false && (uData.role === 'Admin' || uData.role === 'Moderator' || uData.role === 'Super Admin')) {
        finalPoints = 0;
      }

      const periodId = logData.period_id;
      const familyId = getFamilyId();

      // Fetch all tasks and logs for condition checking
      let tasksQ = supabaseClient.from('tasks').select('*');
      if (familyId) tasksQ = tasksQ.eq('family_id', familyId);
      const { data: rawTasks } = await tasksQ;
      const allTasks = unpackTasks(rawTasks);

      const { data: periodLogs } = await supabaseClient.from('task_logs').select('*').eq('period_id', periodId);
      const condResult = getConditionStatusForPeriod(periodId, allTasks, periodLogs || []);

      if (!condResult.hasConditions) {
        // No condition tasks for this period → award immediately (old behavior)
        if (finalPoints > 0) {
          await adjustUserPoints(username, finalPoints);
          await supabaseClient.from('transactions').insert([{ username: username, type: 'Earn', amount: finalPoints, description: transactionDesc }]);
        }
        await supabaseClient.from('task_logs').update({ points_awarded: true }).eq('id', logId);
      } else if (condResult.allMet) {
        // All conditions met → award this task + any deferred tasks
        if (finalPoints > 0) {
          await adjustUserPoints(username, finalPoints);
          await supabaseClient.from('transactions').insert([{ username: username, type: 'Earn', amount: finalPoints, description: transactionDesc }]);
        }
        await supabaseClient.from('task_logs').update({ points_awarded: true }).eq('id', logId);
        // Retroactively award deferred points for other tasks in this period
        await awardDeferredPoints(periodId);
      } else {
        // Conditions not met → defer points (or mark as awarded if no points)
        await supabaseClient.from('task_logs').update({ points_awarded: (finalPoints <= 0) }).eq('id', logId);
      }
    }
  }
  invalidateDataCaches(); refreshPendingBadges();
  refreshUserPoints(); showLoading(false); showToast(isApproved ? 'Đã xử lý!' : 'Đã từ chối.', isApproved ? 'success' : 'error'); loadApprovals();
}

function renderAdminList(type, data, extraHtml = '') {
  const container = document.getElementById('admin-list-container');
  if (data.length === 0) return container.innerHTML = extraHtml + '<div class="text-center text-muted py-8 text-sm bg-card border border-dashed border-borderline rounded-2xl">Chưa có dữ liệu.</div>';

  const itemsHtml = data.map(item => {
    let title = '', subtitle = '', id = '', prefixHTML = '', actionHTML = '';
    if (type === 'users') {
      id = item.username; title = item.name;
      subtitle = `<span class="bg-surface px-1.5 rounded items-center mr-1">${item.role}</span> <span class="text-yellow-500 font-bold">${item.points} pts</span>`;
      prefixHTML = `<div class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-inner overflow-hidden ${item.avatar ? 'bg-surface' : 'bg-gradient-to-tr from-primary to-purple-500'}">${item.avatar && item.avatar.trim() !== '' ? `<img src="${item.avatar}" class="w-full h-full object-cover">` : item.name.charAt(0)}</div>`;
      actionHTML = `<button onclick="openGrantBonusModal('${item.username}', '${item.name}')" class="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center active-scale mr-1" title="Trao điểm"><i class="fa-solid fa-gift text-xs"></i></button><button onclick="openAdjustModal('${item.username}', '${item.name}')" class="w-8 h-8 rounded-lg bg-success/10 text-success flex items-center justify-center active-scale mr-1"><i class="fa-solid fa-coins text-xs"></i></button>`;
    }
    else if (type === 'tasks') {
      id = item.id; title = item.task_name;
      let freqBadge = item.frequency === 'Daily' ? 'Hàng ngày' : (item.frequency === 'Weekly' ? 'Hàng tuần' : (item.frequency === 'Monthly' ? 'Hàng tháng' : 'Sự vụ'));
      subtitle = `<span class="bg-surface px-1.5 rounded">${freqBadge}</span> | <span class="text-success font-bold">+${item.points}</span> / <span class="text-red-400 font-bold">-${item.penalty}</span>${item.is_condition ? ' | <span class="text-cyan-500 font-bold">⚡ĐK</span>' : ''}`;
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
      let badge = item.is_point_reward
        ? ' <span class="bg-primary/10 text-primary px-1.5 rounded text-[10px] ml-1">🎁 Tặng điểm</span>'
        : ' <span class="bg-amber-500/10 text-amber-500 px-1.5 rounded text-[10px] ml-1">🛒 Quà đổi</span>';
      if (!item.is_point_reward) {
        if (item.active === false) badge += ' <span class="bg-surface text-muted px-1.5 rounded text-[10px] ml-1 border border-borderline">Tạm ngưng</span>';
        if (item.stock !== null && item.stock !== undefined) {
          badge += Number(item.stock) > 0
            ? ` <span class="text-muted text-[10px] ml-1">· còn ${item.stock}</span>`
            : ' <span class="bg-red-500/10 text-red-500 px-1.5 rounded text-[10px] ml-1">Hết hàng</span>';
        }
        if (item.max_per_week) badge += ` <span class="text-muted text-[10px] ml-1">· tối đa ${item.max_per_week}/tuần</span>`;
      }
      const costLabel = item.is_point_reward ? `+${item.cost} pts` : `${item.cost} pts`;
      subtitle = `<span class="text-yellow-500 font-bold">${costLabel}</span>${badge}`;
      prefixHTML = `<div class="w-10 h-10 rounded-xl bg-surface flex items-center justify-center text-amber-500 shadow-inner text-base"><i class="${item.icon || 'fa-solid fa-gift'}"></i></div>`;
      // Point reward granting is now done from 'Trao quà' tab, not here
    }
    else if (type === 'violations') {
      id = item.id; title = item.task_name;
      subtitle = `<span class="text-red-500 font-bold">Phạt: -${item.penalty} pts</span>`;
      prefixHTML = `<div class="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 shadow-inner text-base"><i class="fa-solid fa-triangle-exclamation"></i></div>`;
    }
    else if (type === 'penalties') {
      id = item.id; title = item.description;
      const dateStr = new Date(item.created_at).toLocaleDateString('vi-VN');
      subtitle = `<span class="bg-surface px-1.5 rounded items-center mr-1">${item.user_name}</span> <span class="text-red-500 font-bold">-${item.amount} pts</span> | ${dateStr}`;
      prefixHTML = `<div class="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 shadow-inner text-base"><i class="fa-solid fa-circle-minus"></i></div>`;
      actionHTML = ''; // View only history in this tab
    }

    window[`editData_${id}`] = item;
    return `
        <div class="bg-card border border-borderline rounded-2xl p-4 flex justify-between items-center shadow-sm mb-3">
            <div class="flex gap-3 items-center">
                ${prefixHTML}
                <div><h4 class="font-bold text-main text-sm mb-1">${title}</h4><div class="text-[10px] text-muted flex items-center">${subtitle}</div></div>
            </div>
            <div class="flex gap-1.5">
                ${actionHTML}
                ${type !== 'penalties' ? `
                <button onclick="openModal('${type === 'violations' ? 'violations' : type}', window['editData_${id}'])" class="w-8 h-8 rounded-lg bg-surface text-main flex items-center justify-center active-scale"><i class="fa-solid fa-pen text-xs"></i></button>
                <button onclick="deleteData('${type === 'violations' ? 'tasks' : type}', '${id}')" class="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center active-scale"><i class="fa-solid fa-trash text-xs"></i></button>
                ` : `<button onclick="deleteData('transactions', '${id}')" class="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center active-scale"><i class="fa-solid fa-trash text-xs"></i></button>`}
            </div>
        </div>`;
  });
  container.innerHTML = extraHtml + itemsHtml.join('');
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

// Gói tặng điểm không có khái niệm tồn kho / giới hạn đổi -> ẩn cho đỡ rối,
// và đổi nhãn ô số điểm cho đúng nghĩa (phải trả vs. được tặng).
function toggleRewardKind() {
  const cb = document.getElementById('inp-is-point-reward');
  const block = document.getElementById('reward-stock-block');
  const lbl = document.getElementById('lbl-rcost');
  if (!cb) return;
  if (block) block.classList.toggle('hidden', cb.checked);
  if (lbl) lbl.innerText = cb.checked ? 'SỐ ĐIỂM ĐƯỢC TẶNG' : 'GIÁ ĐỔI QUÀ (ĐIỂM PHẢI TRẢ)';
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
    let roleOpts = isAdmin() ?
      `<option value="User" ${item && item.role === 'User' ? 'selected' : ''}>User</option>
             <option value="Moderator" ${item && item.role === 'Moderator' ? 'selected' : ''}>Moderator</option>
             <option value="Admin" ${item && item.role === 'Admin' ? 'selected' : ''}>Admin</option>${isSuperAdmin() ? `<option value="Super Admin" ${item && item.role === 'Super Admin' ? 'selected' : ''}>Super Admin</option>` : ''}` : `<option value="User" selected>User</option>`;

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
                <label class="block text-[10px] text-muted mb-1 font-bold uppercase">Hình thức trừ điểm (nếu không làm)</label>
                <select id="inp-tpenaltytype" class="w-full bg-input border border-borderline rounded-2xl px-4 py-3 text-main text-sm font-medium outline-none">
                    <option value="all" ${!item || item.penalty_type !== 'individual' ? 'selected' : ''}>Trừ tất cả thành viên</option>
                    <option value="individual" ${item && item.penalty_type === 'individual' ? 'selected' : ''}>Trừ từng người không làm</option>
                </select>
            </div>
            <div class="mt-4">
                <label class="block text-[10px] text-muted mb-1 font-bold uppercase">Tính điểm cho Admin, Mod & Super Admin</label>
                <select id="inp-tcalcadmin" class="w-full bg-input border border-borderline rounded-xl px-4 py-3 text-main text-sm font-medium outline-none">
                    <option value="true" ${!item || item.calc_admin !== false ? 'selected' : ''}>Có cộng/trừ bình thường</option>
                    <option value="false" ${item && item.calc_admin === false ? 'selected' : ''}>Không tính điểm</option>
                </select>
            </div>
            <div class="mt-4">
                <label class="block text-[10px] text-muted mb-1 font-bold uppercase">Đánh dấu Điều Kiện</label>
                <select id="inp-tcondition" class="w-full bg-input border border-borderline rounded-xl px-4 py-3 text-main text-sm font-medium outline-none">
                    <option value="false" ${!item || item.is_condition !== true ? 'selected' : ''}>Không (bình thường)</option>
                    <option value="true" ${item && item.is_condition === true ? 'selected' : ''}>✅ Là Điều Kiện bắt buộc</option>
                </select>
                <p class="text-[9px] text-muted mt-1 opacity-70">Nếu bật: phải hoàn thành việc này mới tính thưởng cho các việc khác trong ngày.</p>
            </div>
        `;
    setTimeout(() => { handleFreqChange(); if (item && item.schedule && document.getElementById('inp-tsched')) document.getElementById('inp-tsched').value = item.schedule; selectIcon(item && item.icon ? item.icon : ICONS[0]); }, 10);
  } else if (type === 'rewards') {
    body.innerHTML = `
            <input id="inp-rname" type="text" placeholder="Tên quà" class="w-full bg-input border border-borderline rounded-xl px-4 py-3.5 text-main text-sm font-medium outline-none mb-3" value="${item ? item.reward_name : ''}">
            ${iconGridHtml}
            <label id="lbl-rcost" class="block text-[10px] text-muted mb-1 mt-3 font-bold">GIÁ ĐỔI QUÀ (ĐIỂM PHẢI TRẢ)</label>
            <input id="inp-rcost" type="number" min="1" placeholder="Pts" class="w-full bg-input border border-borderline rounded-xl px-4 py-3.5 text-main text-sm font-black outline-none text-yellow-500" value="${item ? item.cost : ''}">
            <div class="mt-4 flex items-center gap-2 bg-surface rounded-xl p-3 border border-borderline">
                <input id="inp-is-point-reward" type="checkbox" onchange="toggleRewardKind()" class="w-4 h-4 rounded text-primary focus:ring-primary focus:ring-offset-surface bg-input border-borderline" ${item && item.is_point_reward ? 'checked' : ''}>
                <label for="inp-is-point-reward" class="text-sm text-main font-medium cursor-pointer flex-1">Là gói <b>tặng điểm</b> (Admin trao, không phải quà để đổi)</label>
            </div>
            <div id="reward-stock-block" class="mt-4 space-y-3">
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-[10px] text-muted mb-1 font-bold uppercase">Tồn kho</label>
                        <input id="inp-rstock" type="number" min="0" placeholder="Không giới hạn" class="w-full bg-input border border-borderline rounded-xl px-3 py-3 text-main text-sm font-bold outline-none" value="${item && item.stock !== null && item.stock !== undefined ? item.stock : ''}">
                    </div>
                    <div>
                        <label class="block text-[10px] text-muted mb-1 font-bold uppercase">Tối đa / tuần</label>
                        <input id="inp-rmaxweek" type="number" min="1" placeholder="Không giới hạn" class="w-full bg-input border border-borderline rounded-xl px-3 py-3 text-main text-sm font-bold outline-none" value="${item && item.max_per_week !== null && item.max_per_week !== undefined ? item.max_per_week : ''}">
                    </div>
                </div>
                <p class="text-[9px] text-muted opacity-70">Để trống là không giới hạn. Tồn kho tự trừ khi có người đổi và tự cộng lại khi đơn bị huỷ.</p>
                <div class="flex items-center gap-2">
                    <input id="inp-ractive" type="checkbox" class="w-4 h-4 rounded text-primary bg-input border-borderline" ${!item || item.active !== false ? 'checked' : ''}>
                    <label for="inp-ractive" class="text-sm text-main font-medium cursor-pointer">Đang mở cho đổi</label>
                </div>
            </div>
        `;
    setTimeout(toggleRewardKind, 20);
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
  } else if (type === 'violations') {
    body.innerHTML = `
            <input id="inp-tname" type="text" placeholder="Tên lỗi (vd: Quên tắt điện)" class="w-full bg-input border border-borderline rounded-xl px-4 py-3.5 text-main text-sm font-medium outline-none mb-3" value="${item ? item.task_name : ''}">
            <div class="mt-2">
                <label class="block text-[10px] text-muted mb-1 font-bold">MỨC PHẠT MẶC ĐỊNH</label>
                <div class="relative">
                    <span class="absolute left-4 top-1/2 -translate-y-1/2 text-red-500 font-bold">-</span>
                    <input id="inp-tpenalty" type="number" placeholder="Điểm" class="w-full bg-input border border-borderline rounded-xl pl-7 pr-4 py-3.5 text-main text-sm font-black outline-none text-red-500" value="${item ? item.penalty : ''}">
                </div>
            </div>
            <input type="hidden" id="inp-tfreq" value="Violation">
            <input type="hidden" id="inp-tpoints" value="0">
            <input type="hidden" id="inp-tcalcadmin" value="true">
            <input type="hidden" id="inp-icon" value="fa-solid fa-triangle-exclamation">
        `;
  }

  modal.classList.remove('hidden'); saveBtn.onclick = () => saveData(type, item ? (type === 'users' ? item.username : item.id) : null);
}

function closeModal() { document.getElementById('admin-modal').classList.add('hidden'); }

// === CLAIM LOGIC ===
let currentClaimData = null;
function openClaimModal(taskId, taskName, periodId, dateStr) {
    currentClaimData = { taskId, taskName, periodId };
    document.getElementById('claim-task-info').innerText = `${taskName} - ${dateStr}`;
    document.getElementById('claim-percent-info').innerText = familySettings.claim_points_percent;
    document.getElementById('claim-reason').value = '';
    document.getElementById('claim-modal').classList.remove('hidden');
    document.getElementById('claim-modal').classList.add('flex');
    
    document.getElementById('claim-submit-btn').onclick = async () => {
        const reason = document.getElementById('claim-reason').value.trim();
        await claimTask(taskId, periodId, reason);
    };
}
function closeClaimModal() {
    document.getElementById('claim-modal').classList.add('hidden');
    document.getElementById('claim-modal').classList.remove('flex');
    currentClaimData = null;
}
async function claimTask(taskId, periodId, reason) {
    if (!currentUser) return;
    showLoading(true);
    
    // Check if a log already exists for this claim
    const { data: existingLog } = await supabaseClient.from('task_logs')
        .select('*')
        .eq('task_id', taskId)
        .eq('period_id', periodId)
        .eq('username', currentUser.username)
        .single();
        
    if (existingLog) {
        showLoading(false);
        return showToast('Công việc này đã được nộp hoặc claim trước đó!', 'error');
    }
    
    const payload = {
        task_id: taskId,
        period_id: periodId,
        username: currentUser.username,
        status: 'Pending Approval',
        is_claim: true,
        claim_reason: reason
    };
    
    const { error } = await supabaseClient.from('task_logs').insert([payload]);
    showLoading(false);
    
    if (error) {
        showToast('Lỗi khi claim: ' + error.message, 'error');
    } else {
        closeClaimModal();
        invalidateDataCaches();
        showToast('Đã gửi yêu cầu claim!', 'success');
        if (typeof loadHistoryData === 'function' && document.getElementById('view-history').classList.contains('hidden') === false) {
            loadHistoryData(true);
        }
    }
}

async function saveData(type, id) {
  showLoading(true); let error = null;
  try {
    if (type === 'users') {
      const data = { username: document.getElementById('inp-username').value.trim(), name: document.getElementById('inp-name').value, role: document.getElementById('inp-role').value, password: document.getElementById('inp-password').value, avatar: document.getElementById('inp-avatar').value, family_id: getFamilyId() };
      if (id) { const res = await supabaseClient.from('users').update(data).eq('username', id); error = res.error; }
      else { const res = await supabaseClient.from('users').insert([data]); error = res.error; }
    } else if (type === 'tasks' || type === 'holidays') {
      const name = type === 'tasks' ? document.getElementById('inp-tname').value : document.getElementById('inp-hname').value;
      const freq = type === 'tasks' ? document.getElementById('inp-tfreq').value : 'Holiday';
      const icon = type === 'tasks' ? document.getElementById('inp-icon').value : 'fa-solid fa-umbrella-beach';
      const pts = type === 'tasks' ? document.getElementById('inp-tpoints').value : 0;
      const pen = type === 'tasks' ? (document.getElementById('inp-tpenalty').value || 0) : 0;
      const calc_admin = type === 'tasks' ? document.getElementById('inp-tcalcadmin').value === 'true' : false;
      const penalty_type = type === 'tasks' ? document.getElementById('inp-tpenaltytype').value : 'all';
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

      const is_condition = document.getElementById('inp-tcondition') ? document.getElementById('inp-tcondition').value === 'true' : false;
      const data = { task_name: name, icon: finalIcon, frequency: freq, schedule: finalSched, points: pts, penalty: pen, calc_admin: calc_admin, penalty_type: penalty_type, is_condition: is_condition, family_id: getFamilyId() };
      if (id) { const res = await supabaseClient.from('tasks').update(data).eq('id', id); error = res.error; }
      else { const res = await supabaseClient.from('tasks').insert([data]); error = res.error; }
    } else if (type === 'rewards') {
      const is_point = document.getElementById('inp-is-point-reward') ? document.getElementById('inp-is-point-reward').checked : false;
      const name = document.getElementById('inp-rname').value.trim();
      const cost = parseInt(document.getElementById('inp-rcost').value, 10);
      if (!name) { showLoading(false); return showToast('Nhập tên phần thưởng nhé!', 'error'); }
      if (!cost || cost <= 0) { showLoading(false); return showToast('Nhập số điểm lớn hơn 0!', 'error'); }
      const rawStock = (document.getElementById('inp-rstock') || {}).value;
      const rawMax = (document.getElementById('inp-rmaxweek') || {}).value;
      const data = {
        reward_name: name,
        icon: document.getElementById('inp-icon').value,
        cost: cost,
        is_point_reward: is_point,
        // Tồn kho và giới hạn tuần chỉ áp dụng cho quà để đổi.
        stock: (is_point || rawStock === '' || rawStock === undefined) ? null : parseInt(rawStock, 10),
        max_per_week: (is_point || rawMax === '' || rawMax === undefined) ? null : parseInt(rawMax, 10),
        active: document.getElementById('inp-ractive') ? document.getElementById('inp-ractive').checked : true,
        family_id: getFamilyId()
      };
      if (id) { const res = await supabaseClient.from('rewards').update(data).eq('id', id); error = res.error; }
      else { const res = await supabaseClient.from('rewards').insert([data]); error = res.error; }
    } else if (type === 'violations') {
        const name = document.getElementById('inp-tname').value;
        const pen = document.getElementById('inp-tpenalty').value || 0;
        const data = { task_name: name, icon: 'fa-solid fa-triangle-exclamation', frequency: 'Violation', schedule: null, points: 0, penalty: pen, calc_admin: true, family_id: getFamilyId() };
        if (id) { const res = await supabaseClient.from('tasks').update(data).eq('id', id); error = res.error; }
        else { const res = await supabaseClient.from('tasks').insert([data]); error = res.error; }
    }
  } catch (err) { error = err; }
  showLoading(false); if (error) return showToast(error.message, 'error');
  showToast('Lưu thành công!', 'mega-success'); closeModal(); loadAdminData(type);
}

async function deleteData(type, id) {
  if (!(await customConfirm('Chắc chắn xoá luôn ?', 'Xoá dữ liệu'))) return;
  showLoading(true); let error = null;
  if (type === 'users') { const res = await supabaseClient.from('users').delete().eq('username', id); error = res.error; }
  else if (type === 'tasks' || type === 'holidays') { const res = await supabaseClient.from('tasks').delete().eq('id', id); error = res.error; }
  else if (type === 'rewards') { const res = await supabaseClient.from('rewards').delete().eq('id', id); error = res.error; }
  else if (type === 'transactions') { const res = await supabaseClient.from('transactions').delete().eq('id', id); error = res.error; }
  showLoading(false); if (error) return showToast(error.message, 'error');
  showToast('Đã xoá!'); loadAdminData(currentAdminType);
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
  const logType = type === 'add' ? 'Earn' : 'Penalty';
  const adjRes = await adjustUserPoints(window.currentAdjustUser, type === 'add' ? amount : -amount);
  if (adjRes.error) { showLoading(false); return showToast(adjRes.error, 'error'); }
  await supabaseClient.from('transactions').insert([{ username: window.currentAdjustUser, type: logType, amount: amount, description: `[Admin/Mod] ${reason}` }]);
  showLoading(false);
  invalidateDataCaches();
  showToast('Cập nhật điểm cái rẹt thành công!', 'mega-success');
  closeAdjustModal(); loadAdminData('users');
}


// Mở từ tab Thành viên: đã biết người nhận, cần chọn gói thưởng.
async function openGrantBonusModal(username, name) {
  return openGrantByRewardModal(null, null, null, username, name);
}

// Modal trao thưởng điểm, chạy được ở 2 chiều:
//  - Biết phần thưởng (từ tab Trao quà) -> chọn người nhận.
//  - Biết người nhận (từ tab Thành viên) -> chọn gói thưởng.
async function openGrantByRewardModal(rewardId, rewardName, points, preselectedUser, preselectedName) {
  window.currentGrantRewardId = rewardId || null;
  window.currentGrantRewardName = rewardName || null;
  window.currentGrantPoints = (points === null || points === undefined) ? null : Number(points);
  window.currentGrantUser = preselectedUser || null;
  window.currentGrantUserName = preselectedName || null;

  const titleEl = document.getElementById('grant-reward-name');
  const subEl = document.getElementById('grant-reward-points');
  const labelEl = document.getElementById('grant-list-label');
  const container = document.getElementById('grant-user-list');
  container.innerHTML = '<div class="text-center text-muted py-4 text-sm">Đang tải...</div>';

  document.getElementById('grant-bonus-modal').classList.remove('hidden');
  document.getElementById('grant-bonus-modal').classList.add('flex');

  if (preselectedUser && !rewardId) {
    // Chiều 2: chọn gói thưởng cho người đã biết.
    titleEl.innerText = preselectedName || preselectedUser;
    subEl.innerText = 'Chọn gói thưởng để trao';
    if (labelEl) labelEl.innerText = 'CHỌN GÓI THƯỞNG ĐIỂM';

    let rq = supabaseClient.from('rewards').select('*').is('is_point_reward', true);
    if (getFamilyId()) rq = rq.eq('family_id', getFamilyId());
    const { data: rewards } = await rq;

    if (!rewards || rewards.length === 0) {
      container.innerHTML = '<div class="text-center text-muted py-6 text-sm leading-relaxed">Chưa có gói thưởng điểm nào.<br><span class="text-[11px]">Vào <b>Quản trị → Phần thưởng</b>, thêm mới và tick <b>"Là phần thưởng tặng điểm"</b>.</span></div>';
      return;
    }
    container.innerHTML = rewards.map(r => `
        <button onclick="selectGrantReward('${escJsAttr(r.id)}', '${escJsAttr(r.reward_name)}', ${Number(r.cost) || 0})" class="w-full flex items-center gap-3 p-3 bg-surface rounded-2xl border border-borderline hover:border-primary/40 hover:bg-primary/5 active-scale transition-all">
          <div class="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary"><i class="${escHtml(r.icon || 'fa-solid fa-gift')}"></i></div>
          <div class="flex-1 text-left">
            <div class="font-bold text-main text-sm">${escHtml(r.reward_name)}</div>
            <div class="text-[10px] text-muted">Tặng +${Number(r.cost) || 0} điểm</div>
          </div>
          <div class="text-primary text-xs font-bold"><i class="fa-solid fa-paper-plane"></i></div>
        </button>`).join('');
    return;
  }

  // Chiều 1: chọn người nhận cho phần thưởng đã biết.
  titleEl.innerText = rewardName || 'Chọn phần thưởng';
  subEl.innerText = points ? `+${points} điểm` : '';
  if (labelEl) labelEl.innerText = 'CHỌN THÀNH VIÊN NHẬN';

  let usersQuery = supabaseClient.from('users').select('*');
  if (getFamilyId()) usersQuery = usersQuery.eq('family_id', getFamilyId());
  const { data: users } = await usersQuery;

  if (!users || users.length === 0) {
    container.innerHTML = '<div class="text-center text-muted py-4 text-sm">Không có thành viên nào.</div>';
    return;
  }
  container.innerHTML = users.map(u => {
    const avatarHtml = u.avatar && u.avatar.trim() !== ''
      ? `<img src="${escHtml(u.avatar)}" class="w-9 h-9 rounded-full object-cover">`
      : `<div class="w-9 h-9 rounded-full bg-gradient-to-tr from-primary to-purple-500 flex items-center justify-center text-white text-sm font-bold">${escHtml(u.name.charAt(0))}</div>`;
    return `
      <button onclick="grantBonusToUser('${escJsAttr(u.username)}', '${escJsAttr(u.name)}')" class="w-full flex items-center gap-3 p-3 bg-surface rounded-2xl border border-borderline hover:border-primary/40 hover:bg-primary/5 active-scale transition-all">
        ${avatarHtml}
        <div class="flex-1 text-left">
          <div class="font-bold text-main text-sm">${escHtml(u.name)}</div>
          <div class="text-[10px] text-muted">${escHtml(u.role)} · ${u.points} pts</div>
        </div>
        <div class="text-primary text-xs font-bold"><i class="fa-solid fa-paper-plane"></i></div>
      </button>`;
  }).join('');
}

// Đã biết người nhận, vừa chọn xong gói thưởng -> trao luôn.
function selectGrantReward(rewardId, rewardName, points) {
  window.currentGrantRewardId = rewardId;
  window.currentGrantRewardName = rewardName;
  window.currentGrantPoints = Number(points) || 0;
  grantBonusToUser(window.currentGrantUser, window.currentGrantUserName);
}

function closeGrantBonusModal() {
  document.getElementById('grant-bonus-modal').classList.add('hidden');
  document.getElementById('grant-bonus-modal').classList.remove('flex');
}

async function grantBonusToUser(username, userName) {
  if (!username) return showToast('Chưa chọn được người nhận!', 'error');
  if (!window.currentGrantRewardName || !window.currentGrantPoints) {
    return showToast('Chưa chọn được gói thưởng!', 'error');
  }

  const rewardName = window.currentGrantRewardName;
  const amount = Number(window.currentGrantPoints) || 0;
  const ok = await customConfirm(
    `Trao [ ${rewardName} ] (+${amount} điểm) cho ${userName}?

Bạn vẫn thu hồi được khi người nhận chưa bấm nhận.`,
    'Xác nhận trao thưởng', 'Trao ngay');
  if (!ok) return;

  showLoading(true);
  // Chưa cộng điểm ở bước này - điểm chỉ vào tài khoản khi người nhận bấm nhận.
  const { error } = await supabaseClient.from('reward_redemptions').insert([{
    family_id: getFamilyId(),
    username: username,
    reward_id: window.currentGrantRewardId || null,
    reward_name: rewardName,
    cost: amount,
    kind: 'grant',
    status: 'pending_claim',
    created_by: currentUser.username
  }]);
  showLoading(false);
  if (error) return showToast(rewardError(error), 'error');

  showToast(`🎉 Đã trao "${rewardName}" (+${amount} pts) cho ${userName}!`, 'mega-success');
  if (typeof confetti === 'function') confetti({ particleCount: 80, spread: 70, origin: { y: 0.7 } });
  closeGrantBonusModal();
  refreshRewardViews();
  if (currentAdminType === 'reward_approvals') loadAdminData('reward_approvals');
}

// Người nhận bấm nhận điểm thưởng. Cộng điểm + đổi trạng thái trong 1 transaction DB,
// nên bấm bao nhiêu lần cũng chỉ cộng đúng 1 lần.
async function claimPointGrant(redemptionId) {
  showLoading(true);
  const { data, error } = await supabaseClient.rpc('claim_point_grant', {
    p_id: Number(redemptionId), p_username: currentUser.username
  });
  showLoading(false);
  if (error) { refreshRewardViews(); return showToast(rewardError(error), 'error'); }

  const granted = Array.isArray(data) && data[0] ? Number(data[0].granted) : 0;
  showToast('🎉 Chúc mừng! Bạn đã nhận được +' + granted + ' điểm thưởng!', 'mega-success');
  if (typeof confetti === 'function') {
    confetti({ particleCount: 120, spread: 100, origin: { y: 0.6 } });
    setTimeout(() => confetti({ particleCount: 60, angle: 60, spread: 55, origin: { x: 0 } }), 250);
    setTimeout(() => confetti({ particleCount: 60, angle: 120, spread: 55, origin: { x: 1 } }), 400);
  }
  refreshUserPoints();
  refreshRewardViews();
}

// Admin thu hồi khoản thưởng điểm trao nhầm (chỉ khi người nhận chưa bấm nhận,
// tức là chưa có điểm nào được cộng nên không cần hoàn).
async function revokePointGrant(redemptionId) {
  if (!isAdminOrMod()) return showToast('Bạn không có quyền thu hồi.', 'error');
  const { data: r } = await supabaseClient.from('reward_redemptions').select('*').eq('id', redemptionId).single();
  if (!r) return showToast('Không tìm thấy khoản trao này!', 'error');
  if (r.status !== 'pending_claim') {
    refreshRewardViews();
    return showToast('Người nhận đã bấm nhận rồi, không thu hồi được. Dùng "Điều chỉnh điểm" nhé.', 'error');
  }
  const ok = await customConfirm(
    `Thu hồi khoản thưởng [ ${r.reward_name} ] (+${r.cost} điểm) đã trao cho ${r.username}?

Người nhận chưa bấm nhận nên chưa có điểm nào được cộng.`,
    'Thu hồi khoản trao', 'Thu hồi');
  if (!ok) return;

  showLoading(true);
  const { data: rows, error } = await supabaseClient.from('reward_redemptions')
    .update({ status: 'revoked', cancelled_at: new Date().toISOString(), handled_by: currentUser.username })
    .eq('id', redemptionId).eq('status', 'pending_claim')
    .select('id');
  showLoading(false);
  if (error) return showToast(rewardError(error), 'error');
  if (!rows || rows.length === 0) { refreshRewardViews(); return showToast('Người nhận vừa bấm nhận, không thu hồi được nữa.', 'error'); }
  showToast('Đã thu hồi khoản trao.', 'success');
  refreshRewardViews();
}

async function resetAllPoints() {
  if (!(await customConfirm('Hành động này sẽ đưa ĐIỂM CỦA TẤT CẢ USER VỀ 0. Dữ liệu giao dịch cũ vẫn được giữ nhưng điểm hiện tại sẽ mất. Bạn chắc chắn chứ?', 'Cảnh báo: Reset điểm', 'Reset ngay'))) return;
  showLoading(true);
  let resetQuery = supabaseClient.from('users').select('username');
  if (getFamilyId()) resetQuery = resetQuery.eq('family_id', getFamilyId());
  const { data: users } = await resetQuery;
  if (users) {
    for (let u of users) {
      await supabaseClient.from('users').update({ points: 0 }).eq('username', u.username);
      await supabaseClient.from('transactions').insert([{ username: u.username, type: 'Penalty', amount: 0, description: `HỆ THỐNG RESET ĐIỂM VÀO ĐẦU KỲ` }]);
    }
  }
  showLoading(false);
  invalidateDataCaches();
  showToast('Boom! Đã reset điểm toàn hệ thống về 0.', 'mega-success');
  loadAdminData('users');
}

// ------ TÍNH NĂNG PHẠT LỖI (BULK) ------

async function openPenaltyModal() {
  showLoading(true);
  const [{ data: users }, { data: violations }] = await Promise.all([
    supabaseClient.from('users').select('*').eq('family_id', getFamilyId()),
    supabaseClient.from('tasks').select('*').eq('family_id', getFamilyId()).eq('frequency', 'Violation')
  ]);
  showLoading(false);

  const typeSel = document.getElementById('pen-type');
  window.penaltyDataMap = {};
  if (violations) {
    typeSel.innerHTML = '<option value="custom">Lỗi khác (Tự nhập)</option>' + violations.map(v => {
      window.penaltyDataMap[v.id] = v;
      return `<option value="${v.id}">${v.task_name} (-${v.penalty} pts)</option>`;
    }).join('');
  } else {
    typeSel.innerHTML = '<option value="custom">Lỗi khác (Tự nhập)</option>';
  }

  const userList = document.getElementById('pen-users-list');
  if (users) {
    userList.innerHTML = users.map(u => `
                <label class="flex items-center gap-3 p-2 hover:bg-surface rounded-lg cursor-pointer transition-colors">
                    <input type="checkbox" name="pen-user-checkbox" value="${u.username}" class="w-4 h-4 rounded border-borderline text-primary focus:ring-primary">
                    <span class="text-sm font-medium text-main">${u.name}</span>
                    <span class="text-[10px] text-muted ml-auto">${u.points} pts</span>
                </label>`).join('');
  } else {
    userList.innerHTML = '';
  }

  document.getElementById('pen-amount').value = '';
  document.getElementById('pen-reason').value = '';
  document.getElementById('pen-date').valueAsDate = new Date();
  document.getElementById('penalty-modal').classList.remove('hidden');
  document.getElementById('penalty-modal').classList.add('flex');
  updatePenaltyDefaultPoints();
}

function updatePenaltyDefaultPoints() {
  const selId = document.getElementById('pen-type').value;
  const amountInp = document.getElementById('pen-amount');
  const reasonInp = document.getElementById('pen-reason');
  const customBox = document.getElementById('pen-custom-reason-box');

  if (selId === 'custom') {
    amountInp.value = '';
    reasonInp.value = '';
    customBox.classList.remove('hidden');
  } else {
    const v = window.penaltyDataMap[selId];
    amountInp.value = v.penalty;
    reasonInp.value = v.task_name;
    customBox.classList.add('hidden');
  }
}

function closePenaltyModal() {
  document.getElementById('penalty-modal').classList.add('hidden');
  document.getElementById('penalty-modal').classList.remove('flex');
}

async function saveBulkPenalty() {
  const selId = document.getElementById('pen-type').value;
  const amount = parseInt(document.getElementById('pen-amount').value);
  const reason = document.getElementById('pen-reason').value.trim();
  const dateStr = document.getElementById('pen-date').value;
  const checkboxes = document.querySelectorAll('input[name="pen-user-checkbox"]:checked');

  if (!amount || amount <= 0) return showToast('Nhập số điểm phạt hợp lệ!', 'error');
  if (!reason) return showToast('Nhập lý do phạt!', 'error');
  if (checkboxes.length === 0) return showToast('Chọn ít nhất 1 thành viên bị phạt!', 'error');

  showLoading(true);
  try {
    const usernames = Array.from(checkboxes).map(cb => cb.value);
    for (let username of usernames) {
      const penRes = await adjustUserPoints(username, -amount);
      if (!penRes.error) {
        // We use the selected date in the description since transactions.created_at is server-side
        const displayDate = new Date(dateStr).toLocaleDateString('vi-VN');
        await supabaseClient.from('transactions').insert([{ 
            username: username, 
            type: 'Penalty', 
            amount: amount, 
            description: `Bị phạt lỗi: ${reason} (Ngày ${displayDate})` 
        }]);
      }
    }
    showLoading(false);
    invalidateDataCaches();
    showToast(`Đã ghi nhận phạt cho ${checkboxes.length} thành viên!`, 'mega-success');
    closePenaltyModal();
    loadAdminData(currentAdminType);
    refreshUserPoints();
  } catch (err) {
    showLoading(false);
    showToast('Lỗi: ' + err.message, 'error');
  }
}

// ====== SUPER ADMIN: FAMILY MANAGEMENT ======

async function loadFamiliesData() {
  showLoading(true);
  const [{ data: families }, { data: allUsers }] = await Promise.all([
    supabaseClient.from('families').select('*').order('created_at', { ascending: true }),
    supabaseClient.from('users').select('username, name, role, family_id, points')
  ]);
  showLoading(false);

  const container = document.getElementById('admin-list-container');

  if (!families || families.length === 0) {
    container.innerHTML = '<div class="text-center text-muted py-8 text-sm bg-card border border-dashed border-borderline rounded-2xl">Chưa có gia đình nào.</div>';
    return;
  }

  container.innerHTML = families.map(f => {
    const members = (allUsers || []).filter(u => u.family_id === f.id);
    const totalMembers = members.length;
    const admins = members.filter(u => u.role === 'Admin' || u.role === 'Super Admin').length;
    const mods = members.filter(u => u.role === 'Moderator').length;
    const users = members.filter(u => u.role === 'User').length;
    const isMyFamily = f.id === getFamilyId();

    window[`familyData_${f.id}`] = f;

    return `
      <div class="bg-card border ${isMyFamily ? 'border-primary shadow-md' : 'border-borderline'} rounded-2xl p-5 shadow-sm transition-all hover:border-primary/50 mb-3">
        <div class="flex justify-between items-start mb-4">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-2xl ${isMyFamily ? 'bg-primary/20 text-primary' : 'bg-surface text-muted'} flex items-center justify-center text-xl shadow-inner">
              <i class="fa-solid fa-house-chimney"></i>
            </div>
            <div>
              <h4 class="font-bold text-main text-base leading-tight">${f.family_name}${isMyFamily ? ' <span class="text-primary text-[10px] ml-1 bg-primary/10 px-1.5 rounded font-black border border-primary/20">Của tôi</span>' : ''}</h4>
              <div class="text-[11px] text-muted mt-1"><i class="fa-solid fa-user-group mr-1"></i>${totalMembers} thành viên</div>
            </div>
          </div>
          <div class="flex gap-1.5">
            <button onclick="openFamilyModal(window['familyData_${f.id}'])" class="w-8 h-8 rounded-lg bg-surface text-main flex items-center justify-center active-scale" title="Sửa"><i class="fa-solid fa-pen text-xs"></i></button>
            ${!isMyFamily ? `<button onclick="deleteFamilyData('${f.id}')" class="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center active-scale" title="Xoá"><i class="fa-solid fa-trash text-xs"></i></button>` : ''}
          </div>
        </div>
        <div class="grid grid-cols-3 gap-2 mb-3">
          <div class="bg-input rounded-xl p-2.5 text-center border border-borderline">
            <div class="text-primary font-black text-lg">${admins}</div>
            <div class="text-[9px] text-muted font-bold uppercase">Admin</div>
          </div>
          <div class="bg-input rounded-xl p-2.5 text-center border border-borderline">
            <div class="text-amber-500 font-black text-lg">${mods}</div>
            <div class="text-[9px] text-muted font-bold uppercase">Mod</div>
          </div>
          <div class="bg-input rounded-xl p-2.5 text-center border border-borderline">
            <div class="text-success font-black text-lg">${users}</div>
            <div class="text-[9px] text-muted font-bold uppercase">User</div>
          </div>
        </div>
        ${!isMyFamily ? `<button onclick="copyTemplateTasks('${f.id}', '${f.family_name}')" class="w-full py-2 rounded-xl bg-surface text-muted text-[11px] font-bold active-scale hover:bg-primary/10 hover:text-primary transition-all border border-borderline"><i class="fa-solid fa-copy mr-1.5"></i>Copy công việc mẫu từ gia đình tôi</button>` : ''}
      </div>`;
  }).join('');
}

function openFamilyModal(family = null) {
  const modal = document.getElementById('family-modal');
  const title = document.getElementById('family-modal-title');
  const body = document.getElementById('family-modal-body');
  const saveBtn = document.getElementById('family-modal-save-btn');

  title.innerText = family ? 'Sửa Gia Đình' : 'Tạo Gia Đình Mới';
  saveBtn.innerText = family ? 'Cập nhật' : 'Tạo gia đình';

  if (family) {
    body.innerHTML = `
      <input id="inp-fname" type="text" placeholder="Tên gia đình" class="w-full bg-input border border-borderline rounded-xl px-4 py-3.5 text-main text-sm font-medium outline-none mb-3" value="${family.family_name}">
    `;
    saveBtn.onclick = () => saveFamilyData(family.id);
  } else {
    body.innerHTML = `
      <input id="inp-fname" type="text" placeholder="Tên gia đình (vd: Nguyễn Family)" class="w-full bg-input border border-borderline rounded-xl px-4 py-3.5 text-main text-sm font-medium outline-none mb-3">
      <div class="bg-surface rounded-2xl p-4 border border-borderline mb-3">
        <h4 class="font-bold text-main text-sm mb-3 flex items-center gap-2"><i class="fa-solid fa-user-shield text-primary"></i> Admin đầu tiên</h4>
        <input id="inp-fadmin-user" type="text" placeholder="Username" class="w-full bg-input border border-borderline rounded-xl px-4 py-3 text-main text-sm font-medium outline-none mb-2">
        <input id="inp-fadmin-name" type="text" placeholder="Tên hiển thị" class="w-full bg-input border border-borderline rounded-xl px-4 py-3 text-main text-sm font-medium outline-none mb-2">
        <input id="inp-fadmin-pass" type="text" placeholder="Mật khẩu" class="w-full bg-input border border-borderline rounded-xl px-4 py-3 text-main text-sm font-medium outline-none">
      </div>
      <label class="flex items-center gap-3 bg-input p-4 rounded-xl border border-borderline cursor-pointer hover:bg-primary/5 transition-all">
        <input id="inp-copy-template" type="checkbox" class="w-5 h-5 accent-primary rounded">
        <div>
          <div class="font-bold text-main text-sm">Áp dụng công việc mẫu</div>
          <div class="text-[10px] text-muted">Copy công việc từ gia đình của tôi</div>
        </div>
      </label>
    `;
    saveBtn.onclick = () => saveFamilyData(null);
  }

  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeFamilyModal() {
  document.getElementById('family-modal').classList.add('hidden');
  document.getElementById('family-modal').classList.remove('flex');
}

async function saveFamilyData(familyId) {
  const familyName = document.getElementById('inp-fname').value.trim();
  if (!familyName) return showToast('Nhập tên gia đình!', 'error');

  showLoading(true);

  if (familyId) {
    // Update existing family
    const { error } = await supabaseClient.from('families').update({ family_name: familyName }).eq('id', familyId);
    showLoading(false);
    if (error) return showToast('Lỗi: ' + error.message, 'error');
    showToast('Cập nhật thành công!', 'success');
  } else {
    // Create new family
    const adminUser = document.getElementById('inp-fadmin-user').value.trim();
    const adminName = document.getElementById('inp-fadmin-name').value.trim();
    const adminPass = document.getElementById('inp-fadmin-pass').value.trim();
    if (!adminUser || !adminName || !adminPass) {
      showLoading(false);
      return showToast('Nhập đầy đủ thông tin Admin!', 'error');
    }

    // Check duplicate username
    const { data: existingUser } = await supabaseClient.from('users').select('username').eq('username', adminUser);
    if (existingUser && existingUser.length > 0) {
      showLoading(false);
      return showToast('Username đã tồn tại!', 'error');
    }

    // Create family
    const { data: newFamily, error: famErr } = await supabaseClient.from('families').insert([{ family_name: familyName, created_by: currentUser.username }]).select().single();
    if (famErr) { showLoading(false); return showToast('Lỗi tạo gia đình: ' + famErr.message, 'error'); }

    // Create admin user for new family
    const { error: userErr } = await supabaseClient.from('users').insert([{
      username: adminUser, name: adminName, password: adminPass,
      role: 'Admin', points: 0, family_id: newFamily.id
    }]);
    if (userErr) { showLoading(false); return showToast('Lỗi tạo Admin: ' + userErr.message, 'error'); }

    // Copy template tasks if checked
    const copyTemplate = document.getElementById('inp-copy-template').checked;
    if (copyTemplate && getFamilyId()) {
      await copyTemplateTasks(newFamily.id, familyName, true);
    }

    showLoading(false);
    showToast(`Gia đình "${familyName}" đã được tạo!`, 'mega-success');
    if (typeof confetti === 'function') confetti({ particleCount: 150, spread: 80, origin: { y: 0.5 }, zIndex: 9999 });
  }

  closeFamilyModal();
  loadAdminData('families');
}

async function copyTemplateTasks(targetFamilyId, targetFamilyName, silent = false) {
  if (!silent && !(await customConfirm(`Copy tất cả công việc mẫu sang "${targetFamilyName}"?`, 'Copy công việc mẫu'))) return;
  if (!silent) showLoading(true);

  // Get tasks from my family
  const { data: myTasks } = await supabaseClient.from('tasks').select('*').eq('family_id', getFamilyId());
  if (myTasks && myTasks.length > 0) {
    // Phải copy đủ mọi cột cấu hình. Thiếu cột nào là gia đình mới nhận bản
    // sai lệch âm thầm: thiếu penalty_type thì việc cá nhân thành việc chung,
    // thiếu is_condition thì việc điều kiện mất hiệu lực.
    const tasksToInsert = myTasks.map(t => ({
      task_name: t.task_name,
      icon: t.icon,
      frequency: t.frequency,
      schedule: t.schedule,
      points: t.points,
      penalty: t.penalty,
      calc_admin: t.calc_admin,
      penalty_type: t.penalty_type,
      is_condition: t.is_condition,
      family_id: targetFamilyId
    }));
    const { error } = await supabaseClient.from('tasks').insert(tasksToInsert);
    if (error) {
      if (!silent) showLoading(false);
      return showToast('Lỗi copy tasks: ' + error.message, 'error');
    }
  }

  // Also copy rewards
  const { data: myRewards } = await supabaseClient.from('rewards').select('*').eq('family_id', getFamilyId());
  if (myRewards && myRewards.length > 0) {
    // Thiếu is_point_reward là nguy hiểm nhất: gói "tặng điểm" sẽ biến thành
    // quà để đổi ở gia đình mới, trẻ trả điểm để mua đúng cái đáng lẽ được cho.
    const rewardsToInsert = myRewards.map(r => ({
      reward_name: r.reward_name,
      icon: r.icon,
      cost: r.cost,
      is_point_reward: r.is_point_reward,
      stock: r.stock,
      max_per_week: r.max_per_week,
      active: r.active,
      family_id: targetFamilyId
    }));
    await supabaseClient.from('rewards').insert(rewardsToInsert);
  }

  if (!silent) {
    showLoading(false);
    showToast(`Đã copy công việc mẫu sang "${targetFamilyName}"!`, 'mega-success');
    loadAdminData('families');
  }
}

async function deleteFamilyData(familyId) {
  if (!(await customConfirm('Xoá gia đình sẽ xoá TẤT CẢ thành viên, công việc, phần thưởng, lịch sử của gia đình này. Bạn chắc chắn?', 'Cảnh báo: Xoá gia đình', 'Tiếp tục'))) return;
  if (!(await customConfirm('KHÔNG THỂ hoàn tác. Bạn có chắc chắn muốn xoá vĩnh viễn?', 'Xác nhận lần cuối', 'Xoá vĩnh viễn'))) return;

  showLoading(true);
  
  // Get all users in this family
  const { data: famUsers } = await supabaseClient.from('users').select('username').eq('family_id', familyId);
  const usernames = (famUsers || []).map(u => u.username);

  // Delete transactions and reward orders of family users.
  // Xoá theo username chứ không theo family_id: username là cột NOT NULL,
  // còn family_id có thể rỗng ở dòng cũ chuyển từ hệ thống trước.
  if (usernames.length > 0) {
    await supabaseClient.from('transactions').delete().in('username', usernames);
    await supabaseClient.from('reward_redemptions').delete().in('username', usernames);
  }

  // Get all tasks in this family
  const { data: famTasks } = await supabaseClient.from('tasks').select('id').eq('family_id', familyId);
  const taskIds = (famTasks || []).map(t => t.id);

  // Delete task_logs for family tasks
  if (taskIds.length > 0) {
    await supabaseClient.from('task_logs').delete().in('task_id', taskIds);
  }

  // Delete tasks, rewards, users, then family
  await supabaseClient.from('tasks').delete().eq('family_id', familyId);
  await supabaseClient.from('rewards').delete().eq('family_id', familyId);
  await supabaseClient.from('users').delete().eq('family_id', familyId);
  await supabaseClient.from('families').delete().eq('id', familyId);

  showLoading(false);
  showToast('Đã xoá gia đình!', 'success');
  loadAdminData('families');
}

window.onload = () => { setTimeout(checkLoginStatus, 500); };

// --- THEMES ---
const THEMES = [
  { id: 'dark', name: 'Đêm sâu', icon: 'fa-moon', bg: '#1A1D24', primary: '#3B82F6', desc: 'Giao diện tối mặc định' },
  { id: 'light', name: 'Sáng sủa', icon: 'fa-sun', bg: '#FFFFFF', primary: '#8B5CF6', desc: 'Giao diện sáng cổ điển' },
  { id: 'apple-midnight', name: 'Apple Midnight', icon: 'fa-apple-whole', bg: '#131315', primary: '#abc7ff', desc: 'Apple Pro - Midnight Blue', premium: true },
  { id: 'apple-crystal', name: 'Apple Crystal', icon: 'fa-apple-whole', bg: '#f9f9fb', primary: '#0059b5', desc: 'Apple Pro - Pure Crystal', premium: true },
  { id: 'apple-dark', name: 'Apple Dark', icon: 'fa-apple-whole', bg: '#000000', primary: '#0071e3', desc: 'Phong cách Apple cao cấp - Tối', premium: true },
  { id: 'apple-light', name: 'Apple Light', icon: 'fa-apple-whole', bg: '#f5f5f7', primary: '#0071e3', desc: 'Phong cách Apple cao cấp - Sáng', premium: true },
  { id: 'sakura', name: 'Hoa anh đào', icon: 'fa-spa', bg: '#FFE4E6', primary: '#F43F5E', desc: 'Hồng dịu dàng' },
  { id: 'matcha', name: 'Trà xanh mộc', icon: 'fa-leaf', bg: '#D1FAE5', primary: '#10B981', desc: 'Xanh mát thiên nhiên' },
  { id: 'cyberpunk', name: 'Neon Cyber', icon: 'fa-bolt', bg: '#1E1B4B', primary: '#EAB308', desc: 'Neon tương lai' }
];

function openThemeModal() {
  const container = document.getElementById('theme-options-container');
  const currentMode = localStorage.getItem('housework_theme') || 'dark';
  container.innerHTML = THEMES.map(t => {
    const isSelected = currentMode === t.id;
    const premiumBadge = t.premium ? '<span class="text-[9px] font-bold bg-gradient-to-r from-blue-500 to-cyan-400 text-white px-1.5 py-0.5 rounded-full ml-2">PRO</span>' : '';
    return `
        <div onclick="setAppTheme('${t.id}')" class="flex items-center justify-between p-4 rounded-xl border ${isSelected ? 'border-primary bg-primary/10' : 'border-borderline bg-input'} cursor-pointer active-scale mb-2 transition-all shadow-sm">
            <div class="flex items-center gap-4">
                <div class="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-md" style="background-color: ${t.primary};"><i class="fa-solid ${t.icon}"></i></div>
                <div>
                    <div class="font-bold text-main text-sm flex items-center">${t.name}${premiumBadge}</div>
                    <div class="text-[10px] text-muted">${t.desc}</div>
                </div>
            </div>
            ${isSelected ? '<i class="fa-solid fa-circle-check text-primary text-xl"></i>' : ''}
        </div>`;
  }).join('');
  document.getElementById('theme-modal').classList.remove('hidden'); document.getElementById('theme-modal').classList.add('flex');
}

function closeThemeModal() { document.getElementById('theme-modal').classList.add('hidden'); document.getElementById('theme-modal').classList.remove('flex'); }

function isPremiumTheme() {
  return true; // Daily Progress Ring now available for all themes
}

function setAppTheme(themeId) {
  if (themeId === 'dark') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', themeId);
  localStorage.setItem('housework_theme', themeId);
  // Refresh theme modal if open
  const modal = document.getElementById('theme-modal');
  if (modal && !modal.classList.contains('hidden')) openThemeModal();
  // Refresh admin theme panel if open
  if (currentAdminType === 'themes') renderThemeAdmin();
}

// --- ADMIN THEME MANAGEMENT (Super Admin) ---
function renderThemeAdmin() {
  const container = document.getElementById('admin-list-container');
  const currentMode = localStorage.getItem('housework_theme') || 'dark';
  const currentThemeObj = THEMES.find(t => t.id === currentMode) || THEMES[0];

  let html = `<button onclick="loadAdminData(null)" class="flex items-center gap-2 text-sm font-bold text-main mb-4 active-scale bg-card border border-borderline rounded-2xl px-4 py-3 w-full shadow-sm hover:border-primary/30 transition-all"><i class="fa-solid fa-arrow-left text-primary mr-1"></i> Quay lại menu quản trị</button>`;

  // Header
  html += `
    <div class="bg-card border border-borderline rounded-2xl p-5 mb-4 shadow-sm">
      <div class="flex items-center gap-3 mb-3">
        <div class="w-12 h-12 rounded-[16px] bg-primary/20 text-primary flex items-center justify-center text-2xl shadow-inner">
          <i class="fa-solid fa-palette"></i>
        </div>
        <div>
          <h3 class="font-bold text-main text-base">Quản lý Giao diện</h3>
          <p class="text-xs text-muted">Chọn phong cách hiển thị cho ứng dụng</p>
        </div>
      </div>
      <div class="bg-input rounded-xl p-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full flex items-center justify-center text-white" style="background-color: ${currentThemeObj.primary};"><i class="fa-solid ${currentThemeObj.icon} text-xs"></i></div>
          <div>
            <div class="text-sm font-bold text-main">Đang sử dụng: ${currentThemeObj.name}</div>
            <div class="text-[10px] text-muted">${currentThemeObj.desc}</div>
          </div>
        </div>
        <i class="fa-solid fa-circle-check text-primary text-lg"></i>
      </div>
    </div>`;

  // Apple Premium section
  html += `
    <div class="mb-4">
      <div class="flex items-center gap-2 mb-3">
        <div class="w-6 h-6 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 flex items-center justify-center">
          <i class="fa-solid fa-crown text-white text-[10px]"></i>
        </div>
        <h4 class="font-bold text-main text-sm">Premium — Inspired by Apple</h4>
      </div>
      <div class="grid grid-cols-1 gap-3">`;

  const appleThemes = THEMES.filter(t => t.premium);
  appleThemes.forEach(t => {
    const isSelected = currentMode === t.id;
    const isDark = t.id.includes('dark') || t.id.includes('midnight');
    const displayBg = t.bg;
    const primaryColor = t.primary;
    const cardBg = isDark ? (t.id === 'apple-dark' ? '#1c1c1e' : '#1f1f21') : '#ffffff';
    const subCardBg = isDark ? (t.id === 'apple-dark' ? '#2c2c2e' : '#2a2a2c') : '#f2f2f7';
    const textColor = isDark ? '#ffffff' : '#1d1d1f';
    const mutedColor = isDark ? '#8e8e93' : 'rgba(0,0,0,0.48)';

    html += `
      <div onclick="setAppTheme('${t.id}')" class="relative overflow-hidden rounded-2xl border-2 ${isSelected ? 'border-primary shadow-lg' : 'border-borderline'} cursor-pointer active-scale transition-all hover:shadow-md">
        <div style="background-color: ${displayBg};" class="p-5">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl flex items-center justify-center shadow-md" style="background: ${isDark ? 'linear-gradient(135deg, #1c1c1e, #2c2c2e)' : 'linear-gradient(135deg, #ffffff, #f5f5f7)'}; border: 1px solid ${isDark ? '#38383a' : '#d2d2d7'};">
                <i class="fa-solid fa-apple-whole" style="color: ${isDark ? '#ffffff' : '#1d1d1f'}; font-size: 1.125rem;"></i>
              </div>
              <div>
                <div class="font-bold text-sm" style="color: ${textColor};">${t.name}</div>
                <div class="text-[10px]" style="color: ${mutedColor};">${t.desc}</div>
              </div>
            </div>
            ${isSelected ? `<i class="fa-solid fa-circle-check text-xl" style="color: ${primaryColor};"></i>` : `<div class="w-6 h-6 rounded-full border-2" style="border-color: ${isDark ? '#38383a' : '#d2d2d7'};"></div>`}
          </div>
          <!-- Mini preview -->
          <div style="background-color: ${cardBg};" class="rounded-xl p-3 ${isDark ? '' : 'shadow-sm'}">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-6 h-6 rounded-full flex items-center justify-center" style="background-color: ${primaryColor};"><i class="fa-solid fa-house text-white text-[8px]"></i></div>
              <div class="h-2 w-16 rounded-full" style="background-color: ${subCardBg};"></div>
              <div class="ml-auto h-2 w-8 rounded-full opacity-60" style="background-color: ${primaryColor};"></div>
            </div>
            <div class="flex gap-2">
              <div class="flex-1 h-8 rounded-lg" style="background-color: ${subCardBg};"></div>
              <div class="flex-1 h-8 rounded-lg" style="background-color: ${subCardBg};"></div>
            </div>
          </div>
        </div>
      </div>`;
  });

  html += `</div></div>`;

  // Classic themes section
  html += `
    <div class="mb-4">
      <div class="flex items-center gap-2 mb-3">
        <div class="w-6 h-6 rounded-full bg-surface flex items-center justify-center">
          <i class="fa-solid fa-swatchbook text-muted text-[10px]"></i>
        </div>
        <h4 class="font-bold text-main text-sm">Giao diện cơ bản</h4>
      </div>
      <div class="space-y-2">`;

  const classicThemes = THEMES.filter(t => !t.premium);
  classicThemes.forEach(t => {
    const isSelected = currentMode === t.id;
    html += `
      <div onclick="setAppTheme('${t.id}')" class="flex items-center justify-between p-3.5 rounded-xl border ${isSelected ? 'border-primary bg-primary/10' : 'border-borderline bg-card'} cursor-pointer active-scale transition-all shadow-sm">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-full flex items-center justify-center text-white shadow-md" style="background-color: ${t.primary};"><i class="fa-solid ${t.icon} text-sm"></i></div>
          <div>
            <div class="font-bold text-main text-sm">${t.name}</div>
            <div class="text-[10px] text-muted">${t.desc}</div>
          </div>
        </div>
        ${isSelected ? '<i class="fa-solid fa-circle-check text-primary text-lg"></i>' : `<div class="w-5 h-5 rounded-full border-2 border-borderline"></div>`}
      </div>`;
  });

  html += `</div></div>`;

  // Info box
  html += `
    <div class="bg-input border border-borderline rounded-2xl p-4 text-xs text-muted">
      <div class="flex items-start gap-2">
        <i class="fa-solid fa-circle-info text-primary mt-0.5"></i>
        <div>
          <p class="mb-1">Giao diện <b class="text-main">Apple Midnight/Crystal</b> là các phiên bản Pro cao cấp nhất từ Stitch, sử dụng hệ màu Obsidian và Lumina tối tân.</p>
          <p>Mỗi thành viên có thể tự chọn giao diện riêng bằng biểu tượng <i class="fa-solid fa-palette"></i> ở thanh trên cùng.</p>
        </div>
      </div>
    </div>`;

  container.innerHTML = html;
}

// === FAMILY SETTINGS LOGIC ===
function renderSettingsAdmin() {
  var container = document.getElementById('admin-list-container');
  if (!container) { console.error('admin-list-container not found'); return; }
  
  var daysArr = [2,3,4,5,6,7,1];
  var dayLabels = {1:'CN', 2:'T2', 3:'T3', 4:'T4', 5:'T5', 6:'T6', 7:'T7'};
  var allowedDays = (familySettings.schedule_register_days || '6,7').split(',');
  var daysHtml = '';
  for (var i = 0; i < daysArr.length; i++) {
    var d = daysArr[i];
    var chk = allowedDays.indexOf(String(d)) >= 0 ? 'checked' : '';
    daysHtml += '<label class="flex items-center gap-1.5 cursor-pointer bg-input border border-borderline rounded-lg px-2.5 py-1.5">' +
      '<input type="checkbox" value="' + d + '" class="w-4 h-4 accent-[var(--primary)]" ' + chk + '>' +
      '<span class="text-xs font-medium text-main">' + dayLabels[d] + '</span></label>';
  }

  var schedChk = familySettings.schedule_enabled ? 'checked' : '';

  var html = '<div class="mb-4">' +
    '<h3 class="font-black text-main text-lg mb-4"><i class="fa-solid fa-calendar-week text-primary mr-2"></i>Quản Lý Lịch Tuần</h3>' +
    '<div class="bg-card border border-borderline rounded-2xl p-4 shadow-sm space-y-5">' +
    
    '<div>' +
      '<label class="block text-xs font-bold text-main mb-1"><i class="fa-solid fa-clock-rotate-left text-primary mr-1"></i>Số ngày cho phép Claim</label>' +
      '<p class="text-[10px] text-muted mb-2">Số ngày tối đa user có thể claim lại công việc bị lỡ.</p>' +
      '<input type="number" min="0" max="30" id="setting-claim-days" class="w-full bg-input border border-borderline rounded-xl px-3 py-2.5 text-sm text-main" value="' + familySettings.claim_max_days + '">' +
    '</div>' +

    '<div>' +
      '<label class="block text-xs font-bold text-main mb-1"><i class="fa-solid fa-percent text-primary mr-1"></i>% Điểm thưởng khi Claim</label>' +
      '<p class="text-[10px] text-muted mb-2">Phần trăm số điểm nhận được so với điểm gốc. Penalty sẽ được xoá 100%.</p>' +
      '<div class="relative">' +
        '<input type="number" min="0" max="100" id="setting-claim-percent" class="w-full bg-input border border-borderline rounded-xl pl-3 pr-10 py-2.5 text-sm text-main" value="' + familySettings.claim_points_percent + '">' +
        '<div class="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-sm font-bold">%</div>' +
      '</div>' +
    '</div>' +
    
    '<hr class="border-borderline">' +

    '<div class="flex items-center justify-between">' +
      '<div>' +
        '<label class="block text-xs font-bold text-main"><i class="fa-solid fa-calendar-week text-primary mr-1"></i>Bật/Tắt Lên Lịch Tuần</label>' +
        '<p class="text-[10px] text-muted">Cho phép các thành viên chủ động chọn việc trước.</p>' +
      '</div>' +
      '<div class="flex items-center">' +
        '<input type="checkbox" id="setting-schedule-enabled" class="w-5 h-5 accent-[var(--primary)] cursor-pointer" ' + schedChk + '>' +
      '</div>' +
    '</div>' +

    '<div>' +
      '<label class="block text-xs font-bold text-main mb-1"><i class="fa-solid fa-calendar-days text-primary mr-1"></i>Ngày cho phép đăng ký Lịch</label>' +
      '<p class="text-[10px] text-muted mb-2">Các ngày trong tuần mở cửa đăng ký.</p>' +
      '<div class="flex flex-wrap gap-2" id="setting-schedule-days">' + daysHtml + '</div>' +
    '</div>' +

    '</div>' +
    '<button onclick="saveFamilySettings()" class="w-full mt-4 bg-primary text-white font-bold py-3 rounded-xl shadow-lg active-scale transition-all"><i class="fa-solid fa-floppy-disk mr-2"></i>Lưu Cài Đặt</button>' +
  '</div>';

  container.innerHTML = html;
}

async function saveFamilySettings() {
    showLoading(true);
    
    const claimDays = parseInt(document.getElementById('setting-claim-days').value) || 2;
    const claimPercent = parseInt(document.getElementById('setting-claim-percent').value) || 50;
    const scheduleEnabled = document.getElementById('setting-schedule-enabled').checked;
    
    const dayCheckboxes = document.querySelectorAll('#setting-schedule-days input[type="checkbox"]:checked');
    const scheduleDays = Array.from(dayCheckboxes).map(cb => cb.value).join(',');
    
    const fid = getFamilyId();
    if (!fid) {
        showLoading(false);
        return showToast('Lỗi: Không xác định được Family ID', 'error');
    }
    
    const payload = {
        family_id: fid,
        claim_max_days: claimDays,
        claim_points_percent: claimPercent,
        schedule_enabled: scheduleEnabled,
        schedule_register_days: scheduleDays,
        updated_at: new Date()
    };
    
    const { error } = await supabaseClient.from('family_settings').upsert([payload]);
    showLoading(false);
    
    if (error) {
        showToast('Lỗi lưu cài đặt: ' + error.message, 'error');
    } else {
        familySettings.claim_max_days = claimDays;
        familySettings.claim_points_percent = claimPercent;
        familySettings.schedule_enabled = scheduleEnabled;
        familySettings.schedule_register_days = scheduleDays;
        
        showToast('Đã lưu cài đặt thành công!', 'success');
    }
}

// === SCHEDULE LOGIC ===
let currentScheduleWeekStart = getMonday(new Date());

function getMonday(d) {
  const dt = new Date(d);
  const day = dt.getDay(), diff = dt.getDate() - day + (day == 0 ? -6:1);
  return new Date(dt.setDate(diff));
}

function changeScheduleWeek(offset) {
    currentScheduleWeekStart.setDate(currentScheduleWeekStart.getDate() + (offset * 7));
    loadScheduleView();
}

function isScheduleRegistrationOpen() {
    if (!familySettings.schedule_enabled) return false;
    const today = new Date().getDay();
    // JS getDay(): 0=Sun, 1=Mon...6=Sat.
    // UI mapping: 1=Sun, 2=Mon...7=Sat. So it matches JS getDay() + 1.
    const allowedStr = familySettings.schedule_register_days || '6,7';
    const allowed = allowedStr.split(',').map(Number);
    return allowed.includes(today + 1);
}

async function loadScheduleView() {
    if (!currentUser) return;
    showLoading(true);
    const fid = getFamilyId();
    
    const startOfWeek = new Date(currentScheduleWeekStart);
    startOfWeek.setHours(0,0,0,0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23,59,59,999);
    
    document.getElementById('schedule-week-range').innerText = `${startOfWeek.toLocaleDateString('vi-VN')} - ${endOfWeek.toLocaleDateString('vi-VN')}`;
    
    const dates = [];
    for(let i=0; i<7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(d.getDate() + i);
        dates.push(d);
    }
    
    const daysHeader = document.getElementById('schedule-days-header');
    daysHeader.innerHTML = dates.map(d => {
        const isToday = new Date().toDateString() === d.toDateString();
        const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
        return `<div class="flex flex-col items-center justify-center p-2 rounded-xl ${isToday ? 'bg-primary text-white shadow-md' : 'bg-surface text-muted'}">
            <span class="text-[9px] font-bold">${dayNames[d.getDay()]}</span>
            <span class="text-xs font-black">${d.getDate()}</span>
        </div>`;
    }).join('');
    
    let tasksQuery = supabaseClient.from('tasks').select('*');
    if (fid) tasksQuery = tasksQuery.eq('family_id', fid);
    
    let scheduleQuery = supabaseClient.from('weekly_schedules').select('*')
        .gte('assigned_date', startOfWeek.toISOString().split('T')[0])
        .lte('assigned_date', endOfWeek.toISOString().split('T')[0]);
        
    const [tasksRes, schedRes, usersRes] = await Promise.all([tasksQuery, scheduleQuery, supabaseClient.from('users').select('username, name, avatar')]);
    showLoading(false);
    
    if (tasksRes.error || schedRes.error) return showToast('Lỗi tải lịch tuần', 'error');
    
    const tasks = tasksRes.data || [];
    const schedules = schedRes.data || [];
    const usersList = usersRes.data || [];
    
    const schedTasks = tasks.filter(t => t.frequency === 'Daily' || t.frequency === 'Weekly');
    
    const listContainer = document.getElementById('schedule-list-container');
    listContainer.innerHTML = '';
    
    const isRegOpen = isScheduleRegistrationOpen();
    const currentWeekStart = getMonday(new Date());
    currentWeekStart.setHours(0,0,0,0);
    const isPastWeek = startOfWeek.getTime() < currentWeekStart.getTime();
    
    if (schedTasks.length === 0) {
        listContainer.innerHTML = '<div class="text-center text-muted py-8 text-sm">Chưa có công việc nào cần lên lịch.</div>';
        return;
    }
    
    const grouped = dates.map(d => {
        const dateStr = d.toISOString().split('T')[0];
        
        let html = `<div class="bg-card border border-borderline rounded-2xl p-4 shadow-sm">
            <h3 class="font-black text-main text-sm mb-3 pb-2 border-b border-borderline"><i class="fa-regular fa-calendar-check text-primary mr-2"></i>${d.toLocaleDateString('vi-VN')}</h3>
            <div class="space-y-3">`;
            
        let taskCount = 0;
        schedTasks.forEach(t => {
            let applies = false;
            if (t.frequency === 'Daily') applies = true;
            if (t.frequency === 'Weekly' && t.schedule == (d.getDay() === 0 ? 8 : d.getDay() + 1)) applies = true;
            
            if (applies) {
                taskCount++;
                const assigned = schedules.filter(s => s.task_id === t.id && s.assigned_date === dateStr);
                const myReg = assigned.find(a => a.username === currentUser.username);
                
                let assignedUsersHTML = '';
                if (assigned.length > 0) {
                    assignedUsersHTML = `<div class="flex flex-wrap gap-1 mt-2">`;
                    assigned.forEach(a => {
                        const uInfo = usersList.find(u => u.username === a.username);
                        const uName = uInfo ? uInfo.name : a.username;
                        assignedUsersHTML += `<span class="text-[9px] font-bold px-2 py-0.5 rounded-full ${a.username === currentUser.username ? 'bg-primary/20 text-primary border-primary/30' : 'bg-surface text-muted border-borderline'} border flex items-center gap-1"><i class="fa-solid fa-user"></i> ${uName}</span>`;
                    });
                    assignedUsersHTML += `</div>`;
                }
                
                let btnHTML = '';
                if (!isPastWeek) {
                    if (myReg) {
                        btnHTML = `<button onclick="unregisterSchedule('${myReg.id}')" class="shrink-0 w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg active-scale"><i class="fa-solid fa-minus"></i></button>`;
                    } else if (isRegOpen && assigned.length === 0) {
                        btnHTML = `<button onclick="registerSchedule('${t.id}', '${dateStr}')" class="shrink-0 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shadow-lg active-scale"><i class="fa-solid fa-plus"></i></button>`;
                    } else if (assigned.length > 0) {
                        btnHTML = `<div class="shrink-0 w-8 h-8 rounded-full bg-surface text-muted flex items-center justify-center border border-borderline"><i class="fa-solid fa-lock"></i></div>`;
                    }
                }
                
                html += `
                    <div class="flex items-start justify-between gap-3 ${myReg ? 'opacity-100' : (assigned.length > 0 ? 'opacity-50' : '')}">
                        <div class="flex items-start gap-2">
                            <div class="w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-primary shadow-inner text-sm mt-0.5"><i class="${t.icon || 'fa-solid fa-tasks'}"></i></div>
                            <div>
                                <div class="font-bold text-main text-sm leading-tight">${t.task_name}</div>
                                <div class="text-[10px] text-success font-bold mt-0.5">+${t.points} điểm</div>
                                ${assignedUsersHTML}
                            </div>
                        </div>
                        ${btnHTML}
                    </div>
                `;
            }
        });
        
        if (taskCount === 0) {
            html += `<div class="text-[11px] text-muted text-center py-2 italic">Không có việc</div>`;
        }
        
        html += `</div></div>`;
        return html;
    }).join('');
    
    listContainer.innerHTML = grouped;
}

async function registerSchedule(taskId, dateStr) {
    if (!currentUser) return;
    showLoading(true);
    const { error } = await supabaseClient.from('weekly_schedules').insert([{
        task_id: taskId,
        username: currentUser.username,
        assigned_date: dateStr
    }]);
    if (error) showToast('Lỗi đăng ký: ' + error.message, 'error');
    else {
        showToast('Đã đăng ký nhận việc!', 'success');
        loadScheduleView();
    }
}

async function unregisterSchedule(id) {
    if (!currentUser) return;
    showLoading(true);
    const { error } = await supabaseClient.from('weekly_schedules').delete().eq('id', id);
    if (error) showToast('Lỗi huỷ: ' + error.message, 'error');
    else {
        showToast('Đã huỷ đăng ký!', 'success');
        loadScheduleView();
    }
}
