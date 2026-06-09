# 🔥 메이플 인벤 지금 뜨는 글 - Chrome 확장 프로그램

메이플 인벤 자유게시판 **PC 버전**에서 모바일 전용 기능인 **'지금 뜨는 글'** 을 볼 수 있는 Chrome 확장 프로그램입니다.

---

## 📦 설치 방법

1. Chrome 브라우저 주소창에 `chrome://extensions` 입력
2. 우측 상단 **개발자 모드** 토글 켜기
3. **압축해제된 확장 프로그램을 로드합니다** 클릭
4. 이 폴더(`D:\gemini\empty`) 선택
5. 설치 완료! 🎉

---

## 🎯 사용법

- `https://www.inven.co.kr/board/maple/5974` 접속하면 자동으로 위젯이 표시됩니다
- **새로고침** 버튼으로 최신 핫글을 다시 불러올 수 있습니다
- 데이터는 3분간 캐시되어 불필요한 요청을 방지합니다

---

## 📁 파일 구조

```
empty/
├── manifest.json    # 확장 프로그램 설정
├── content.js       # 핵심 로직 (모바일 페이지 파싱 & 위젯 삽입)
├── content.css      # 위젯 스타일
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

---

## ⚙️ 작동 원리

1. `www.inven.co.kr/board/maple/5974` 페이지 방문 시 content script 실행
2. `m.inven.co.kr/board/maple/5974` 에 fetch 요청 (모바일 User-Agent 사용)
3. 응답 HTML에서 `.current_hot_issue .article-list .list` 요소들 파싱
4. 모바일 URL을 PC URL로 변환 후 게시판 상단에 위젯 삽입
5. sessionStorage 캐시로 3분간 재요청 방지
