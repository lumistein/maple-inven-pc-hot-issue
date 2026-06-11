/**
 * 메이플 인벤 자유게시판 PC버전에 '지금 뜨는 글' 위젯을 추가하는 Content Script
 * 모바일 페이지(m.inven.co.kr)를 fetch해서 핫글 정보를 파싱 후 표시합니다.
 */

const CACHE_KEY = 'inven_hot_posts';
const CACHE_DURATION = 3 * 60 * 1000; // 3분 캐시

// ──────────────────────────────────────────────
// 유틸 함수
// ──────────────────────────────────────────────

/**
 * 현재 시각을 "HH:MM" 형식으로 반환
 */
function formatTime(date) {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

// ──────────────────────────────────────────────
// 데이터 패칭
// ──────────────────────────────────────────────

/**
 * Background service worker에 메시지를 보내 핫글 목록을 요청
 * Background는 CORS 없이 m.inven.co.kr을 자유롭게 fetch 가능
 * @returns {Promise<Array<{title, category, commentCount, url}>>}
 */
async function fetchHotPosts() {
  // 세션 캐시 확인 (3분)
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_DURATION) {
        return data;
      }
    }
  } catch (_) {}

  // Background service worker에 fetch 요청
  const result = await new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: 'FETCH_HOT_POSTS' }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response) {
        reject(new Error('Background로부터 응답 없음'));
        return;
      }
      if (!response.ok) {
        reject(new Error(response.error || '알 수 없는 오류'));
        return;
      }
      resolve(response.posts);
    });
  });

  // 캐시 저장
  try {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ data: result, timestamp: Date.now() })
    );
  } catch (_) {}

  return result;
}


// ──────────────────────────────────────────────
// 위젯 렌더링
// ──────────────────────────────────────────────

function createWidgetBase() {
  const div = document.createElement('div');
  div.id = 'inven-hot-widget';
  div.innerHTML = `
    <div class="hot-header">
      <div class="hot-title"></div>
      <div class="hot-buttons"></div>
    </div>
  `;
  return div;
}

function updateWidgetState(widget, collapsed) {
  isWidgetCollapsed = collapsed;
  const header = widget.querySelector('.hot-header');
  const titleContainer = header.querySelector('.hot-title');
  const buttonsContainer = header.querySelector('.hot-buttons');

  // 기존 헤더 버튼 및 타이틀 비우기
  titleContainer.innerHTML = '';
  buttonsContainer.innerHTML = '';

  if (collapsed) {
    widget.classList.add('collapsed');

    // 리스트 및 로딩 영역 등 모두 제거
    const toRemove = widget.querySelectorAll('.hot-loading, .hot-list, .hot-footer, .hot-error');
    toRemove.forEach((el) => el.remove());

    // 타이틀: 비활성화 상태 표시
    titleContainer.innerHTML = `
      <span class="hot-icon">🔥</span>
      <span>지금 뜨는 글 (비활성화됨)</span>
    `;

    // 활성화하기 버튼 추가
    const activateBtn = document.createElement('button');
    activateBtn.type = 'button';
    activateBtn.className = 'hot-btn';
    activateBtn.textContent = '활성화하기';
    activateBtn.addEventListener('click', () => {
      chrome.storage.local.set({ hot_widget_disabled: false }, () => {
        updateWidgetState(widget, false);
        loadAndRender(widget);
      });
    });
    buttonsContainer.appendChild(activateBtn);
  } else {
    widget.classList.remove('collapsed');

    // 타이틀: 활성화 상태 표시
    titleContainer.innerHTML = `
      <span class="hot-icon">🔥</span>
      <span>지금 뜨는 글</span>
      <span class="hot-badge">LIVE</span>
    `;

    // '활성화 할때까지 보지 않기' 버튼 추가
    const deactivateBtn = document.createElement('button');
    deactivateBtn.type = 'button';
    deactivateBtn.className = 'hot-btn';
    deactivateBtn.textContent = '활성화 할때까지 보지 않기';
    deactivateBtn.addEventListener('click', () => {
      chrome.storage.local.set({ hot_widget_disabled: true }, () => {
        updateWidgetState(widget, true);
      });
    });
    buttonsContainer.appendChild(deactivateBtn);

    // 새로고침 버튼 추가
    const refreshBtn = document.createElement('button');
    refreshBtn.type = 'button';
    refreshBtn.className = 'hot-btn hot-refresh';
    refreshBtn.title = '새로고침';
    refreshBtn.innerHTML = `<span class="refresh-icon">↻</span> 새로고침`;
    refreshBtn.addEventListener('click', () => loadAndRender(widget, true));
    buttonsContainer.appendChild(refreshBtn);
  }
}

function renderPostList(posts, updatedAt) {
  const itemsHtml = posts
    .map(
      (post) => `
      <li class="hot-item">
        <span class="hot-bullet">•</span>
        ${post.category ? `<span class="cate-badge">${escapeHtml(post.category)}</span>` : ''}
        <a class="post-link" href="${escapeHtml(post.url)}" title="${escapeHtml(post.title)}">
          ${escapeHtml(post.title)}
        </a>
        ${post.commentCount > 0 ? `<span class="comment-count">[${post.commentCount}]</span>` : ''}
      </li>
    `
    )
    .join('');

  return `
    <ul class="hot-list">${itemsHtml}</ul>
    <div class="hot-footer">
      <span class="update-time">🕐 ${updatedAt} 기준</span>
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function getCachedPosts() {
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_DURATION) {
        return data;
      }
    }
  } catch (_) {}
  return null;
}

/**
 * 위젯 내용을 포스트 데이터로 업데이트
 */
function updateWidgetContent(widget, posts) {
  const header = widget.querySelector('.hot-header');
  const now = formatTime(new Date());

  // 기존 로딩/에러/포스트 영역 제거 후 새로 삽입
  const toRemove = widget.querySelectorAll('.hot-loading, .hot-list, .hot-footer, .hot-error');
  toRemove.forEach((el) => el.remove());

  const temp = document.createElement('div');
  temp.innerHTML = renderPostList(posts, now);
  while (temp.firstChild) {
    widget.appendChild(temp.firstChild);
  }

  // 새로고침 버튼 업데이트
  const refreshBtn = widget.querySelector('.hot-refresh');
  if (refreshBtn) {
    refreshBtn.classList.remove('spinning');
    refreshBtn.querySelector('.refresh-icon').textContent = '↻';
  }
}

function showError(widget, message) {
  const toRemove = widget.querySelectorAll('.hot-loading, .hot-list, .hot-footer, .hot-error');
  toRemove.forEach((el) => el.remove());

  const errorDiv = document.createElement('div');
  errorDiv.className = 'hot-error';
  errorDiv.textContent = `⚠️ ${message}`;
  widget.appendChild(errorDiv);

  const refreshBtn = widget.querySelector('.hot-refresh');
  if (refreshBtn) {
    refreshBtn.classList.remove('spinning');
    refreshBtn.querySelector('.refresh-icon').textContent = '↻';
  }
}

// ──────────────────────────────────────────────
// 메인 로직
// ──────────────────────────────────────────────

let isWidgetCollapsed = false;

/**
 * PC 게시판 페이지에서 위젯 삽입 기준 요소를 반환
 * 실제 인벤 PC 구조: form[name="board_list1"] > div.board-list > table
 * 위젯은 div.board-list 바로 앞에 insertBefore로 삽입
 */
function findInsertTarget() {
  // 1순위: 실제 인벤 PC 게시판 — div.board-list
  const boardList = document.querySelector('div.board-list');
  if (boardList) return boardList;

  // 2순위: form 안의 테이블
  const boardForm = document.querySelector('form[name="board_list1"]');
  if (boardForm) {
    const tbl = boardForm.querySelector('table');
    if (tbl) return tbl;
    return boardForm;
  }

  // 3순위: 일반 후보 선택자
  const candidates = [
    '.board-list-wrapper',
    '.bbs-list',
    '#article-list',
    '.list-bbs-wrap',
    '.board-main',
    '.content-board',
    '.community-list-wrap',
    '.ibuilder-module-list-bbs',
  ];
  for (const selector of candidates) {
    const el = document.querySelector(selector);
    if (el) return el;
  }

  // 4순위: 아무 게시글 테이블
  const table = document.querySelector('table.article-list, table.bbs, table#article-list-table');
  if (table) return table;

  return null;
}

async function init() {
  // 이미 위젯이 있으면 중복 생성 방지
  if (document.getElementById('inven-hot-widget')) return;

  const insertTarget = findInsertTarget();
  if (!insertTarget) {
    return;
  }

  const widget = createWidgetBase();

  // div.board-list 바로 앞에 삽입 (가장 확실한 위치)
  // 그 외에는 부모의 첫 번째 자식으로
  const parent = insertTarget.parentElement;
  if (parent) {
    parent.insertBefore(widget, insertTarget);
  } else {
    insertTarget.insertBefore(widget, insertTarget.firstChild);
  }

  // 저장된 비활성화 상태 확인 후 렌더링
  chrome.storage.local.get(['hot_widget_disabled'], async function (result) {
    const disabled = !!result.hot_widget_disabled;
    updateWidgetState(widget, disabled);
    if (!disabled) {
      await loadAndRender(widget);
    }
  });
}

async function loadAndRender(widget, forceRefresh = false) {
  if (isWidgetCollapsed) return;

  // 새로고침 시 스피너
  const refreshBtn = widget.querySelector('.hot-refresh');
  if (refreshBtn) {
    refreshBtn.classList.add('spinning');
    refreshBtn.querySelector('.refresh-icon').textContent = '↻';
  }

  if (forceRefresh) {
    sessionStorage.removeItem(CACHE_KEY);
  }

  // 캐시가 유효하면 로딩 표시 없이 바로 렌더링 (깜빡임 방지)
  const cachedPosts = getCachedPosts();
  if (cachedPosts) {
    updateWidgetContent(widget, cachedPosts);
    return;
  }

  // 기존 콘텐츠 제거하고 로딩 표시
  const toRemove = widget.querySelectorAll('.hot-list, .hot-footer, .hot-error');
  toRemove.forEach((el) => el.remove());

  if (!widget.querySelector('.hot-loading')) {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'hot-loading';
    loadingDiv.innerHTML = `
      <div class="loading-dot"></div>
      <div class="loading-dot"></div>
      <div class="loading-dot"></div>
    `;
    widget.appendChild(loadingDiv);
  }

  try {
    const posts = await fetchHotPosts();
    const loading = widget.querySelector('.hot-loading');
    if (loading) loading.remove();

    if (posts.length === 0) {
      showError(widget, '게시글을 불러오지 못했습니다.');
      return;
    }

    updateWidgetContent(widget, posts);
  } catch (err) {
    console.error('[인벤 핫글]', err);
    const loading = widget.querySelector('.hot-loading');
    if (loading) loading.remove();
    showError(widget, '데이터를 불러오는 데 실패했습니다.');
  }
}

// MutationObserver를 사용하여 document_start 시점에도 최대한 빠르게 타겟 요소를 탐색해 삽입
function startWidget() {
  if (findInsertTarget()) {
    init();
    return;
  }

  const observer = new MutationObserver((mutations, obs) => {
    if (findInsertTarget()) {
      obs.disconnect();
      init();
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  // Fallback: DOMContentLoaded 시점에도 실행할 수 있도록 보장
  document.addEventListener('DOMContentLoaded', () => {
    observer.disconnect();
    init();
  });
}

startWidget();
