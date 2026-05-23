# FrontEnd-KMJ

SMU-Talk 프론트엔드 고명준

`chat_front_preview.html` 프로토타입을 React 앱 구조로 변환했습니다. 기존 화면 스타일은 유지하되, DOM 직접 조작과 전역 상태를 제거하고 API 연동 지점을 `src/api`에 모았습니다.

## 실행 방법

```bash
npm install
npm run dev
```

빌드 확인:

```bash
npm run build
```

## 파일 구조

```text
FrontEnd-KMJ/
├─ chat_front_preview.html    # 원본 HTML 프로토타입 보관
├─ index.html                 # Vite 진입 HTML
├─ package.json               # React/Vite 실행 스크립트
├─ vite.config.js             # Vite React 설정
└─ src/
   ├─ main.jsx                # React 앱 마운트
   ├─ App.jsx                 # 화면 컴포넌트와 사용자 입력 상태
   ├─ styles.css              # 기존 CSS를 React 클래스 기준으로 정리
   ├─ noticeData.js           # 태그, 학과 트리, 샘플 공지 데이터
   ├─ layouts/
   │  ├─ pc.css               # PC: 좌측 사이드바 + 우측 채팅 화면
   │  ├─ tablet.css           # 태블릿: 좁은 사이드바와 압축된 채팅 여백
   │  └─ mobile.css           # 모바일: 필터 드로어 + 채팅 우선 화면
   └─ api/
      ├─ client.js            # API base URL, 토큰 저장, 공통 fetch 처리
      ├─ authApi.js           # 로그인/로그아웃/세션 갱신 API
      └─ noticeApi.js         # 공지 챗봇 API 또는 mock 응답 처리
```

## 유지보수 전략

- 화면은 `App.jsx` 안의 작은 컴포넌트로만 나눴습니다. 라우터, 전역 상태 라이브러리, UI 라이브러리는 아직 필요하지 않아 추가하지 않았습니다.
- HTML의 `innerHTML`, `onclick`, `document.querySelector` 로직은 React state와 props 흐름으로 대체했습니다.
- 공지 검색 mock 로직은 `noticeApi.js`에 격리했습니다. `.env`에 API 주소가 있으면 백엔드 요청으로 자동 전환됩니다.
- 태그, 학과, 샘플 공지처럼 자주 바뀔 수 있는 데이터는 `noticeData.js`에 모아 화면 코드와 분리했습니다.
- 채팅 메시지와 공지 카드는 객체 배열을 렌더링합니다. API 응답 형태와 UI 렌더링 형태가 같아서 나중에 실제 데이터로 바꾸기 쉽습니다.
- 반응형 레이아웃은 `src/layouts` 폴더에 PC, 태블릿, 모바일 기준으로 분리했습니다. 공통 색상과 컴포넌트 스타일은 `styles.css`, 화면 크기별 배치는 각 layout 파일에서 수정합니다.

## 반응형 기준

- 모바일: `767px` 이하, 또는 가로형 모바일처럼 높이가 낮은 `932px x 480px` 이하 화면. 사이드바는 `필터` 버튼으로 여는 드로어로 표시됩니다.
- 태블릿: `768px` 이상 `1024px` 이하. 좌측 사이드바를 유지하되 폭과 여백을 줄였습니다.
- PC: `1025px` 이상. 기존처럼 좌측 필터 사이드바와 우측 채팅 영역을 나란히 표시합니다.

## API 연동 방식

현재 `.env`에 `VITE_API_BASE_URL`이 없으면 mock 로그인과 mock 공지 응답을 사용합니다. 백엔드와 연동할 때는 프로젝트 루트에 `.env`를 만들고 API 주소를 넣으면 됩니다.

```env
VITE_API_BASE_URL=http://localhost:8000/api
```

로그인 요청:

```http
POST /auth/login
Content-Type: application/json
```

```json
{
  "user_id": "학번",
  "password": "비밀번호"
}
```

공지 질문 요청:

```http
POST /chat
Content-Type: application/json
Authorization: Bearer <access_token>
```

```json
{
  "question": "장학금 공지 있어?",
  "filters": {
    "tags": ["등록/장학"],
    "dept": "융합공과대학",
    "major": "컴퓨터과학전공"
  }
}
```

예상 응답:

```json
{
  "message": "등록/장학 관련 공지 1건을 찾았습니다.",
  "notices": [
    {
      "title": "[장학] 교내 장학금 신청 안내",
      "tag": "등록/장학",
      "dept": "전체",
      "date": "2025-03-03",
      "body": "신청 기간과 조건 안내..."
    }
  ]
}
```

백엔드 응답 필드가 달라질 경우 `src/api/noticeApi.js`의 `normalizeChatResponse`만 수정하면 됩니다.
