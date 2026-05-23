import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { loginWithSmu, logoutFromApi, refreshLogin, restoreLogin } from './api/authApi.js';
import { askNotice } from './api/noticeApi.js';
import { DEPT_TREE, QUICK_QUESTIONS, TAGS } from './noticeData.js';

const emptyLogin = { id: '', password: '' };

export default function App() {
  const [user, setUser] = useState(null);
  const [login, setLogin] = useState(emptyLogin);
  const [loginError, setLoginError] = useState('');
  const [authReady, setAuthReady] = useState(false);
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [activeTags, setActiveTags] = useState([]);
  const [openDeptIndex, setOpenDeptIndex] = useState(null);
  const [selectedMajor, setSelectedMajor] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const filters = useMemo(
    () => ({
      tags: activeTags,
      dept: selectedMajor?.dept ?? null,
      major: selectedMajor?.major ?? null,
    }),
    [activeTags, selectedMajor],
  );

  useEffect(() => {
    let mounted = true;

    restoreLogin()
      .then((savedUser) => {
        if (mounted && savedUser) setUser({ id: savedUser.nickname });
      })
      .finally(() => {
        if (mounted) setAuthReady(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!user) return undefined;

    const timer = window.setInterval(() => {
      refreshLogin().catch(async () => {
        await logoutFromApi();
        resetSession('학교 세션이 만료되었습니다. 다시 로그인해주세요.');
      });
    }, 20 * 60 * 1000);

    return () => window.clearInterval(timer);
  }, [user]);

  const resetSession = (message = '') => {
    setUser(null);
    setLogin(emptyLogin);
    setActiveTags([]);
    setOpenDeptIndex(null);
    setSelectedMajor(null);
    setMessages([]);
    setDraft('');
    setLoginError(message);
  };

  const loginUser = async (event) => {
    event.preventDefault();

    if (!login.id.trim() || !login.password.trim()) {
      setLoginError('아이디와 비밀번호를 모두 입력해주세요.');
      return;
    }

    setIsLoginLoading(true);
    setLoginError('');

    try {
      const loggedInUser = await loginWithSmu({ id: login.id.trim(), password: login.password });
      setUser({ id: loggedInUser.nickname || login.id.trim() });
      setLogin(emptyLogin);
    } catch (error) {
      setLoginError(error.message || '학교 로그인에 실패했습니다.');
    } finally {
      setIsLoginLoading(false);
    }
  };

  const logout = async () => {
    if (!window.confirm('로그아웃 하시겠습니까?')) return;

    await logoutFromApi();
    resetSession();
  };

  const toggleTag = (tag) => {
    setActiveTags((current) => (current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]));
  };

  const sendQuestion = async (value = draft) => {
    const question = value.trim();

    if (!question || isLoading) return;

    setDraft('');
    setMessages((current) => [...current, makeMessage('user', question)]);
    setIsLoading(true);

    try {
      const reply = await askNotice({ question, filters });
      setMessages((current) => [...current, makeMessage('bot', reply.message, reply.notices)]);
    } catch (error) {
      if (error.status === 401) {
        await logoutFromApi();
        resetSession('학교 세션이 만료되었습니다. 다시 로그인해주세요.');
        return;
      }

      setMessages((current) => [
        ...current,
        makeMessage('bot', error.message || '잠시 후 다시 시도해주세요.', []),
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!authReady) {
    return (
      <main className="login-page">
        <div className="login-loading">로그인 상태를 확인하고 있습니다...</div>
      </main>
    );
  }

  if (!user) {
    return (
      <LoginPage
        errorMessage={loginError}
        hasError={Boolean(loginError)}
        isSubmitting={isLoginLoading}
        login={login}
        onChange={(nextLogin) => {
          setLogin(nextLogin);
          if (loginError) setLoginError('');
        }}
        onSubmit={loginUser}
      />
    );
  }

  return (
    <div className={`app-shell ${isSidebarOpen ? 'sidebar-open' : ''}`}>
      <Sidebar
        activeTags={activeTags}
        openDeptIndex={openDeptIndex}
        selectedMajor={selectedMajor}
        user={user}
        onClose={() => setIsSidebarOpen(false)}
        onLogout={logout}
        onPickMajor={(major) => {
          setSelectedMajor(major);
          setIsSidebarOpen(false);
        }}
        onToggleDept={setOpenDeptIndex}
        onToggleTag={toggleTag}
      />
      <button
        className="sidebar-backdrop"
        type="button"
        aria-label="필터 패널 닫기"
        onClick={() => setIsSidebarOpen(false)}
      />
      <ChatArea
        draft={draft}
        filters={filters}
        isLoading={isLoading}
        messages={messages}
        selectedMajor={selectedMajor}
        user={user}
        onClearChat={() => setMessages([])}
        onClearMajor={() => setSelectedMajor(null)}
        onDraftChange={setDraft}
        onOpenSidebar={() => setIsSidebarOpen(true)}
        onRemoveTag={toggleTag}
        onSend={sendQuestion}
      />
    </div>
  );
}

function LoginPage({ login, errorMessage, hasError, isSubmitting, onChange, onSubmit }) {
  return (
    <main className="login-page">
      <form className={`login-wrap ${hasError ? 'shake' : ''}`} onSubmit={onSubmit}>
        <section className="login-deco" aria-label="UniNotice AI 소개">
          <div className="login-deco-brand">
            <div className="login-deco-icon">🎓</div>
            <div className="login-deco-name">
              Uni
              <br />
              <span>Notice AI</span>
            </div>
          </div>
          <div className="login-deco-footer">
            학과 공지를 AI가
            <br />
            빠르게 찾아드립니다.
            <div className="login-deco-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
          </div>
        </section>

        <section className="login-form-panel">
          <h1 className="login-title">로그인</h1>
          <p className="login-sub">아이디와 비밀번호를 입력해주세요.</p>

          <label className="form-group">
            <span className="form-label">아이디</span>
            <input
              className="form-input"
              placeholder="아이디를 입력하세요"
              type="text"
              value={login.id}
              onChange={(event) => onChange({ ...login, id: event.target.value })}
            />
          </label>
          <label className="form-group">
            <span className="form-label">비밀번호</span>
            <input
              className="form-input"
              placeholder="비밀번호를 입력하세요"
              type="password"
              value={login.password}
              onChange={(event) => onChange({ ...login, password: event.target.value })}
            />
          </label>

          <button className="btn-login" disabled={isSubmitting} type="submit">
            {isSubmitting ? '로그인 중...' : '로그인 →'}
          </button>
          {errorMessage && <p className="login-error">{errorMessage}</p>}
          <p className="login-hint">
            상명대학교 통합 로그인 계정으로 인증합니다.
            <br />세션은 사용 중 자동으로 갱신됩니다.
          </p>
        </section>
      </form>
    </main>
  );
}

function Sidebar({
  activeTags,
  openDeptIndex,
  selectedMajor,
  user,
  onClose,
  onLogout,
  onPickMajor,
  onToggleDept,
  onToggleTag,
}) {
  return (
    <aside className="sidebar">
      <div className="sb-header">
        <div className="sb-logo-icon">🎓</div>
        <div className="sb-logo-text">
          Uni<em>Notice</em> AI
        </div>
        <button className="sb-close-btn" type="button" aria-label="필터 패널 닫기" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="sb-body">
        <section className="sb-section">
          <h2 className="sb-section-label">공지 태그 필터</h2>
          <div className="tag-grid">
            {TAGS.map((tag) => (
              <button
                className={`tag-chip ${activeTags.includes(tag) ? 'on' : ''}`}
                key={tag}
                type="button"
                onClick={() => onToggleTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </section>

        <section className="sb-section">
          <h2 className="sb-section-label">단과대 / 학과 선택</h2>
          <DeptTree
            openDeptIndex={openDeptIndex}
            selectedMajor={selectedMajor}
            onPickMajor={onPickMajor}
            onToggleDept={onToggleDept}
          />
        </section>
      </div>

      <div className="sb-footer">
        <div className="user-ava">{getInitial(user.id)}</div>
        <div className="user-meta">
          <div className="user-name">{user.id} 님</div>
          <div className="user-stat">● 온라인</div>
        </div>
        <button className="logout-btn" type="button" title="로그아웃" onClick={onLogout}>
          <LogoutIcon />
        </button>
      </div>
    </aside>
  );
}

function DeptTree({ openDeptIndex, selectedMajor, onPickMajor, onToggleDept }) {
  return (
    <div>
      {DEPT_TREE.map((dept, deptIndex) => (
        <div key={dept.name}>
          <div className={`dept-item ${openDeptIndex === deptIndex ? 'open' : ''}`}>
            <button
              className={`dept-header ${selectedMajor?.dept === dept.name ? 'selected' : ''}`}
              type="button"
              onClick={() => onToggleDept(openDeptIndex === deptIndex ? null : deptIndex)}
            >
              <span className="dept-label">
                {dept.name}
                <span className="dept-badge">{dept.majors.length}</span>
              </span>
              <ChevronIcon />
            </button>

            <div className="major-list">
              {dept.majors.map((major) => (
                <button
                  className={`major-item ${selectedMajor?.major === major ? 'selected' : ''}`}
                  key={major}
                  type="button"
                  onClick={() => onPickMajor({ dept: dept.name, major })}
                >
                  <span className="major-dot" />
                  <span className="major-name">{major}</span>
                </button>
              ))}
            </div>
          </div>
          {deptIndex < DEPT_TREE.length - 1 && <div className="dept-divider" />}
        </div>
      ))}
    </div>
  );
}

function ChatArea({
  draft,
  filters,
  isLoading,
  messages,
  selectedMajor,
  user,
  onClearChat,
  onClearMajor,
  onDraftChange,
  onOpenSidebar,
  onRemoveTag,
  onSend,
}) {
  const subtitle = selectedMajor ? `${selectedMajor.major} 공지를 검색합니다` : '전체 학과 공지를 검색합니다';

  return (
    <main className="chat-area">
      <header className="chat-header">
        <button className="filter-toggle-btn" type="button" onClick={onOpenSidebar}>
          필터
        </button>
        <div className="ch-icon">🤖</div>
        <div className="ch-info">
          <h1 className="ch-title">학과 공지 AI 어시스턴트</h1>
          <p className="ch-sub">{subtitle}</p>
        </div>
        <div className="ch-status">
          <div className="ch-status-dot" />
          응답 가능
        </div>
        <button className="clear-btn" type="button" onClick={onClearChat}>
          초기화
        </button>
      </header>

      <FilterBar filters={filters} onClearMajor={onClearMajor} onRemoveTag={onRemoveTag} />

      <MessageList isLoading={isLoading} messages={messages} onQuickAsk={onSend} user={user} />

      <Composer draft={draft} disabled={isLoading} onChange={onDraftChange} onSend={onSend} />
    </main>
  );
}

function FilterBar({ filters, onClearMajor, onRemoveTag }) {
  const hasFilter = filters.major || filters.tags.length > 0;

  if (!hasFilter) return null;

  return (
    <div className="filter-bar">
      <span className="filter-bar-label">현재 필터:</span>
      {filters.major && (
        <button className="fpill" type="button" onClick={onClearMajor}>
          🏫 {filters.dept} · {filters.major}
          <span className="fpill-x">×</span>
        </button>
      )}
      {filters.tags.map((tag) => (
        <button className="fpill" key={tag} type="button" onClick={() => onRemoveTag(tag)}>
          🏷 {tag}
          <span className="fpill-x">×</span>
        </button>
      ))}
    </div>
  );
}

function MessageList({ isLoading, messages, onQuickAsk, user }) {
  const listRef = useAutoScroll(messages.length, isLoading);

  return (
    <div className="msgs" ref={listRef}>
      {messages.length === 0 && !isLoading && <Welcome onQuickAsk={onQuickAsk} />}
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} user={user} />
      ))}
      {isLoading && <TypingBubble />}
    </div>
  );
}

function Welcome({ onQuickAsk }) {
  return (
    <section className="welcome">
      <div className="welcome-emoji">🎓</div>
      <h2 className="welcome-title">학과 공지 AI에 오신 것을 환영합니다!</h2>
      <p className="welcome-desc">
        왼쪽에서 단과대, 학과를 선택하거나 태그로 필터링해보세요.
        <br />
        아래 예시 질문을 클릭하거나 자유롭게 물어보세요.
      </p>
      <div className="welcome-chips">
        {QUICK_QUESTIONS.map((question) => (
          <button className="wchip" key={question.text} type="button" onClick={() => onQuickAsk(question.text)}>
            {question.icon} {question.text}
          </button>
        ))}
      </div>
    </section>
  );
}

function MessageBubble({ message, user }) {
  const isBot = message.role === 'bot';
  const avatar = isBot ? '🤖' : getInitial(user.id);
  const normalizedText = normalizeBotText(message.text);

  return (
    <article className={`msg-row ${message.role}`}>
      {isBot && <div className="msg-ava bot">{avatar}</div>}
      <div className="msg-body">
        <div className="bubble">
          {isBot ? (
            <div className="md">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkBreaks]}
                components={{
                  a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
                }}
              >
                {normalizedText}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="user-text">{message.text}</p>
          )}
          {message.notices.map((notice) => (
            <NoticeCard key={`${notice.date}-${notice.title}`} notice={notice} />
          ))}
        </div>
        <time className="msg-time">{message.time}</time>
      </div>
      {!isBot && <div className="msg-ava user">{avatar}</div>}
    </article>
  );
}

// LLM 답변이 한 줄로 붙어서 오는 경우(예: "1. **제목**: ... 2. **제목**: ..." )를
// 사람이 읽기 좋도록 줄바꿈/리스트 패턴으로 정규화한다.
function normalizeBotText(raw) {
  if (!raw) return '';
  let text = String(raw).replace(/\r\n/g, '\n');

  // "1." "2." 등 번호 매기기 앞에 줄바꿈 (이미 줄바꿈이면 그대로)
  text = text.replace(/\s+(?=(?:\d{1,2})\.\s)/g, '\n\n');
  // 한 줄에 들어 있는 메타 라벨들을 각각 개행
  text = text.replace(/\s*(\*\*(?:제목|날짜|소속|태그|작성자|마감|기간|장소|문의|첨부|URL|링크)\*\*\s*[:：])/g, '\n$1');
  // 연속된 공백/탭 정리 (개행은 보존)
  text = text.replace(/[ \t]{2,}/g, ' ');
  // 라인 머리 공백 제거
  text = text
    .split('\n')
    .map((line) => line.replace(/^[ \t]+/, ''))
    .join('\n');
  return text.trim();
}

function NoticeCard({ notice }) {
  return (
    <article className="notice-card">
      <div className="nc-meta">
        <span className="nc-tag">{notice.tag}</span>
        <span className="nc-date">📅 {notice.date}</span>
        {notice.dept !== '전체' && <span className="nc-dept">🏫 {notice.dept}</span>}
      </div>
      <h3 className="nc-title">{notice.title}</h3>
      <p className="nc-body">{notice.body}</p>
    </article>
  );
}

function TypingBubble() {
  return (
    <div className="typing-row">
      <div className="msg-ava bot">🤖</div>
      <div className="typing-bubble">
        <div className="t-dot" />
        <div className="t-dot" />
        <div className="t-dot" />
      </div>
    </div>
  );
}

function Composer({ disabled, draft, onChange, onSend }) {
  const textareaRef = useRef(null);

  const resize = (target) => {
    target.style.height = 'auto';
    target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
  };

  const submit = () => {
    onSend(draft);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  return (
    <footer className="input-zone">
      <div className="input-wrap">
        <textarea
          className="chat-ta"
          disabled={disabled}
          placeholder="공지 내용을 자유롭게 물어보세요... (Enter 전송 · Shift+Enter 줄바꿈)"
          ref={textareaRef}
          rows="1"
          value={draft}
          onChange={(event) => {
            onChange(event.target.value);
            resize(event.target);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <button className="send-btn" disabled={disabled || !draft.trim()} type="button" onClick={submit} title="전송">
          <SendIcon />
        </button>
      </div>
      <div className="input-hint">Enter로 전송 · Shift+Enter로 줄바꿈</div>
    </footer>
  );
}

function useAutoScroll(dependency, isLoading) {
  const ref = useRef(null);

  useEffect(() => {
    window.requestAnimationFrame(() => {
      if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
    });
  }, [dependency, isLoading]);

  return ref;
}

function makeMessage(role, text, notices = []) {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    notices,
    role,
    text,
    time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
  };
}

function getInitial(value) {
  return value?.[0]?.toUpperCase() || 'U';
}

function ChevronIcon() {
  return (
    <svg className="dept-chevron" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}
