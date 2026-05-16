import { useEffect, useMemo, useRef, useState } from 'react';
import { askNotice } from './api/noticeApi.js';
import { DEPT_TREE, QUICK_QUESTIONS, TAGS } from './noticeData.js';

const emptyLogin = { id: '', password: '' };

export default function App() {
  const [user, setUser] = useState(null);
  const [login, setLogin] = useState(emptyLogin);
  const [loginError, setLoginError] = useState(false);
  const [activeTags, setActiveTags] = useState([]);
  const [openDeptIndex, setOpenDeptIndex] = useState(null);
  const [selectedMajor, setSelectedMajor] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const filters = useMemo(
    () => ({
      tags: activeTags,
      dept: selectedMajor?.dept ?? null,
      major: selectedMajor?.major ?? null,
    }),
    [activeTags, selectedMajor],
  );

  const loginUser = (event) => {
    event.preventDefault();

    if (!login.id.trim() || !login.password.trim()) {
      setLoginError(true);
      window.setTimeout(() => setLoginError(false), 420);
      return;
    }

    setUser({ id: login.id.trim() });
  };

  const logout = () => {
    if (!window.confirm('로그아웃 하시겠습니까?')) return;

    setUser(null);
    setLogin(emptyLogin);
    setActiveTags([]);
    setOpenDeptIndex(null);
    setSelectedMajor(null);
    setMessages([]);
    setDraft('');
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
      setMessages((current) => [
        ...current,
        makeMessage('bot', error.message || '잠시 후 다시 시도해주세요.', []),
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return <LoginPage login={login} hasError={loginError} onChange={setLogin} onSubmit={loginUser} />;
  }

  return (
    <div className="app-shell">
      <Sidebar
        activeTags={activeTags}
        openDeptIndex={openDeptIndex}
        selectedMajor={selectedMajor}
        user={user}
        onLogout={logout}
        onPickMajor={setSelectedMajor}
        onToggleDept={setOpenDeptIndex}
        onToggleTag={toggleTag}
      />
      <ChatArea
        activeTags={activeTags}
        draft={draft}
        filters={filters}
        isLoading={isLoading}
        messages={messages}
        selectedMajor={selectedMajor}
        user={user}
        onClearChat={() => setMessages([])}
        onClearMajor={() => setSelectedMajor(null)}
        onDraftChange={setDraft}
        onRemoveTag={toggleTag}
        onSend={sendQuestion}
      />
    </div>
  );
}

function LoginPage({ login, hasError, onChange, onSubmit }) {
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

          <button className="btn-login" type="submit">
            로그인 →
          </button>
          <p className="login-hint">
            UI 프로토타입입니다. 어떤 정보로든 로그인 가능합니다.
            <br />실 서비스 연동 시 API 인증으로 교체됩니다.
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
  activeTags,
  draft,
  filters,
  isLoading,
  messages,
  selectedMajor,
  user,
  onClearChat,
  onClearMajor,
  onDraftChange,
  onRemoveTag,
  onSend,
}) {
  const subtitle = selectedMajor ? `${selectedMajor.major} 공지를 검색합니다` : '전체 학과 공지를 검색합니다';

  return (
    <main className="chat-area">
      <header className="chat-header">
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

  return (
    <article className={`msg-row ${message.role}`}>
      {isBot && <div className="msg-ava bot">{avatar}</div>}
      <div className="msg-body">
        <div className="bubble">
          <p>{message.text}</p>
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
