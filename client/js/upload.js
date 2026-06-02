// client/js/upload.js
// 업로드 모달 + 로그인/회원가입 모달

// ---------- 로그인 ----------
const authModal = document.getElementById('auth-modal');
const authBtn   = document.getElementById('auth-btn');
const authTitle = document.getElementById('auth-title');
const authSubmit = document.getElementById('auth-submit');
const authToggle = document.getElementById('auth-toggle');
const authNickname = document.getElementById('auth-nickname');

let authMode = 'login'; // 'login' | 'register'

function refreshAuthUI() {
  if (Auth.isLoggedIn()) {
    const u = Auth.getUser();
    authBtn.textContent = `${u.nickname} ▾`;
  } else {
    authBtn.textContent = '로그인';
  }
}

function openAuth() {
  if (Auth.isLoggedIn()) {
    if (confirm('로그아웃하시겠어요?')) {
      Auth.clear();
      refreshAuthUI();
    }
    return;
  }
  authModal.hidden = false;
}

function setAuthMode(mode) {
  authMode = mode;
  authTitle.textContent = mode === 'login' ? '로그인' : '회원가입';
  authSubmit.textContent = mode === 'login' ? '로그인' : '가입하기';
  authToggle.textContent = mode === 'login' ? '회원가입으로' : '로그인으로';
  authNickname.hidden = (mode === 'login');
}

authBtn.addEventListener('click', openAuth);
authToggle.addEventListener('click', () => setAuthMode(authMode === 'login' ? 'register' : 'login'));

authSubmit.addEventListener('click', async () => {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const nickname = authNickname.value.trim();
  if (!email || !password) return alert('이메일/비밀번호를 입력하세요.');

  try {
    if (authMode === 'register') {
      if (!nickname) return alert('닉네임을 입력하세요.');
      await API.register({ email, password, nickname });
      alert('가입 완료! 로그인해주세요.');
      setAuthMode('login');
      return;
    }
    const r = await API.login({ email, password });
    Auth.set(r.token, r.user);
    refreshAuthUI();
    authModal.hidden = true;
  } catch (e) {
    alert(e.message);
  }
});

// 모달 외부 클릭으로 닫기
authModal.addEventListener('click', (e) => { if (e.target === authModal) authModal.hidden = true; });

// ---------- 사진 업로드 ----------
const uploadModal = document.getElementById('upload-modal');
document.getElementById('upload-btn').addEventListener('click', () => {
  if (!Auth.isLoggedIn()) {
    alert('로그인이 필요합니다.');
    openAuth();
    return;
  }
  if (!Sidebar.current) return alert('축제를 먼저 선택하세요.');
  uploadModal.hidden = false;
});
document.getElementById('upload-cancel').addEventListener('click', () => uploadModal.hidden = true);
uploadModal.addEventListener('click', (e) => { if (e.target === uploadModal) uploadModal.hidden = true; });

document.getElementById('upload-submit').addEventListener('click', async () => {
  const file = document.getElementById('upload-file').files[0];
  const caption = document.getElementById('upload-caption').value;
  if (!file) return alert('파일을 선택하세요.');
  if (!Sidebar.current) return alert('축제 선택이 필요합니다.');

  const fd = new FormData();
  fd.append('image', file);
  fd.append('festival_id', Sidebar.current.id);
  fd.append('caption', caption);

  try {
    await API.uploadPhoto(fd);
    uploadModal.hidden = true;
    document.getElementById('upload-file').value = '';
    document.getElementById('upload-caption').value = '';
    Sidebar.loadPhotos(Sidebar.current.id);
  } catch (e) {
    alert(e.message);
  }
});

// 초기 UI 갱신
refreshAuthUI();
setAuthMode('login');
