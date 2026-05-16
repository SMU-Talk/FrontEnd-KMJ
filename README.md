# FrontEnd-KMJ

SMU-Talk 프론트엔드 고명준

`chat_front_preview.html` 프로토타입을 React 앱 구조로 변환했습니다. 기존 화면 스타일은 유지하되, DOM 직접 조작과 전역 상태를 제거하고 API 연동 지점을 `src/api/noticeApi.js` 한 곳으로 모았습니다.

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
   └─ api/
      └─ noticeApi.js         # 백엔드 API 또는 mock 응답을 담당하는 단일 경계
```

## 유지보수 전략

- 화면은 `App.jsx` 안의 작은 컴포넌트로만 나눴습니다. 라우터, 전역 상태 라이브러리, UI 라이브러리는 아직 필요하지 않아 추가하지 않았습니다.
- HTML의 `innerHTML`, `onclick`, `document.querySelector` 로직은 React state와 props 흐름으로 대체했습니다.
- 공지 검색 mock 로직은 `noticeApi.js`에 격리했습니다. 백엔드가 준비되면 화면 코드는 거의 건드리지 않고 이 파일의 API 요청만 맞추면 됩니다.
- 태그, 학과, 샘플 공지처럼 자주 바뀔 수 있는 데이터는 `noticeData.js`에 모아 화면 코드와 분리했습니다.
- 채팅 메시지와 공지 카드는 객체 배열을 렌더링합니다. API 응답 형태와 UI 렌더링 형태가 같아서 나중에 실제 데이터로 바꾸기 쉽습니다.

## API 연동 방식

현재 `.env`에 `VITE_API_BASE_URL`이 없으면 mock 응답을 사용합니다. 백엔드가 준비되면 프로젝트 루트에 `.env`를 만들고 API 주소를 넣으면 됩니다.

```env
VITE_API_BASE_URL=http://localhost:8080/api
```

예상 요청:

```http
POST /chat
Content-Type: application/json
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
