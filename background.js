/**
 * Background Service Worker
 * Content script에서 요청을 받아 m.inven.co.kr을 fetch하고 결과를 반환합니다.
 * Background에서 fetch하면 CORS 제한 없이 host_permissions 범위의 URL에 접근 가능합니다.
 */

const MOBILE_URL = 'https://m.inven.co.kr/board/maple/5974';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type !== 'FETCH_HOT_POSTS') return false;

  fetchAndParse()
    .then((posts) => sendResponse({ ok: true, posts }))
    .catch((err) => sendResponse({ ok: false, error: err.message }));

  // true를 반환해야 비동기 sendResponse가 동작함
  return true;
});

async function fetchAndParse() {
  const response = await fetch(MOBILE_URL, {
    // background에서는 User-Agent 헤더가 적용될 수도 있지만,
    // m.inven.co.kr은 모바일 전용 서브도메인이므로 UA 무관하게 모바일 HTML 반환
    cache: 'no-cache',
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();

  // DOMParser는 service worker에서 사용 불가 → 정규식으로 파싱
  const posts = parseHotPosts(html);

  if (posts.length === 0) {
    throw new Error('지금 뜨는 글 섹션을 파싱하지 못했습니다.');
  }

  return posts;
}

/**
 * HTML 문자열에서 .current_hot_issue 섹션을 정규식으로 파싱
 */
function parseHotPosts(html) {
  const posts = [];

  // current_hot_issue 섹션 추출
  const sectionMatch = html.match(
    /class="current_hot_issue"[\s\S]*?<\/section>/
  );
  if (!sectionMatch) {
    // 더 넓은 범위로 재시도
    return parseHotPostsFallback(html);
  }

  const section = sectionMatch[0];

  // 각 .list 항목 추출
  // <li class="list">...</li> 반복
  const listItemRegex = /<li class="list">([\s\S]*?)<\/li>/g;
  let match;

  while ((match = listItemRegex.exec(section)) !== null) {
    const item = match[1];

    // href 추출
    const hrefMatch = item.match(/href="([^"]+)"/);
    if (!hrefMatch) continue;

    const mobileUrl = hrefMatch[1];
    const pcUrl = mobileUrl
      .replace('https://m.inven.co.kr', 'https://www.inven.co.kr')
      .replace('http://m.inven.co.kr', 'https://www.inven.co.kr');

    // 카테고리 추출: <span class="cate">수다</span>
    const cateMatch = item.match(/<span class="cate">([^<]+)<\/span>/);
    const category = cateMatch ? cateMatch[1].trim() : '';

    // 제목 추출: <span class="txt">제목</span>
    const txtMatch = item.match(/<span class="txt">([^<]+)<\/span>/);
    if (!txtMatch) continue;
    const title = txtMatch[1].trim();

    // 댓글 수 추출: <span class="comment">[42]</span>
    const commentMatch = item.match(/<span class="comment">\[(\d+)\]<\/span>/);
    const commentCount = commentMatch ? parseInt(commentMatch[1], 10) : 0;

    posts.push({ title, category, commentCount, url: pcUrl });
  }

  return posts;
}

/**
 * 섹션 추출 실패 시 더 느슨하게 파싱 시도
 */
function parseHotPostsFallback(html) {
  const posts = [];

  // article-list 내 list 아이템 전체에서 찾기
  const listItemRegex = /<li class="list">([\s\S]*?)<\/li>/g;
  let match;
  let count = 0;

  while ((match = listItemRegex.exec(html)) !== null && count < 5) {
    const item = match[1];

    const hrefMatch = item.match(/href="(https?:\/\/[^"]*\/board\/maple\/5974\/\d+)"/);
    if (!hrefMatch) continue;

    const mobileUrl = hrefMatch[1];
    const pcUrl = mobileUrl.replace('https://m.inven.co.kr', 'https://www.inven.co.kr');

    const cateMatch = item.match(/<span class="cate">([^<]+)<\/span>/);
    const txtMatch = item.match(/<span class="txt">([^<]+)<\/span>/);
    if (!txtMatch) continue;

    const commentMatch = item.match(/<span class="comment">\[(\d+)\]<\/span>/);
    const commentCount = commentMatch ? parseInt(commentMatch[1], 10) : 0;

    posts.push({
      title: txtMatch[1].trim(),
      category: cateMatch ? cateMatch[1].trim() : '',
      commentCount,
      url: pcUrl,
    });
    count++;
  }

  return posts;
}
