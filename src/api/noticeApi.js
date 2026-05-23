import { MOCK_NOTICES } from '../noticeData.js';
import { API_BASE_URL, apiRequest, getAccessToken, isApiConfigured } from './client.js';

export async function askNotice({ question, filters }) {
  if (isApiConfigured()) {
    return requestNoticeApi({ question, filters });
  }

  await wait(650);
  return createMockReply(question, filters);
}

async function requestNoticeApi(payload) {
  return normalizeChatResponse(
    await apiRequest('/chat', {
      method: 'POST',
      body: payload,
    }),
  );
}

function normalizeChatResponse(data) {
  return {
    message: data.message ?? data.answer ?? '응답 메시지가 비어 있습니다.',
    notices: Array.isArray(data.notices) ? data.notices : [],
  };
}

/**
 * /api/chat/stream(SSE) 을 호출하고 토큰을 실시간으로 콜백에 전달한다.
 * API_BASE_URL 가 비어 있으면 mock 데이터를 사용해 약식 스트리밍을 흉내낸다.
 *
 * @param {{question:string, filters:object}} payload
 * @param {{
 *   onNotices?: (notices:Array)=>void,
 *   onToken?:   (text:string)=>void,
 *   onError?:   (err:Error)=>void,
 *   onDone?:    ()=>void,
 *   signal?:    AbortSignal,
 * }} callbacks
 */
export async function streamNotice(payload, callbacks = {}) {
  const { onNotices, onToken, onError, onDone, signal } = callbacks;

  if (!isApiConfigured()) {
    return mockStream(payload, callbacks);
  }

  const token = getAccessToken();
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  let response;
  try {
    response = await fetch(`${API_BASE_URL}/chat/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') return;
    const error = new Error(err?.message || '네트워크 오류가 발생했습니다.');
    onError?.(error);
    onDone?.();
    return;
  }

  if (!response.ok) {
    const text = await safeText(response);
    let detail = text;
    try { detail = JSON.parse(text)?.detail || detail; } catch { /* keep raw */ }
    const error = new Error(detail || `HTTP ${response.status}`);
    error.status = response.status;
    onError?.(error);
    onDone?.();
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    onError?.(new Error('스트림을 읽을 수 없습니다.'));
    onDone?.();
    return;
  }

  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE 이벤트는 빈 줄("\n\n") 로 구분된다.
      let boundary;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const { event, data } = parseSseBlock(rawEvent);
        if (!event) continue;

        switch (event) {
          case 'notices':
            onNotices?.(Array.isArray(data?.notices) ? data.notices : []);
            break;
          case 'token':
            if (typeof data?.text === 'string') onToken?.(data.text);
            break;
          case 'error':
            onError?.(new Error(data?.detail || data?.message || '응답 생성에 실패했습니다.'));
            break;
          case 'done':
            onDone?.();
            return;
          default:
            break;
        }
      }
    }
  } catch (err) {
    if (err?.name !== 'AbortError') {
      onError?.(new Error(err?.message || '스트리밍 중 오류가 발생했습니다.'));
    }
  } finally {
    onDone?.();
  }
}

function parseSseBlock(block) {
  const lines = block.split('\n');
  let event = '';
  const dataLines = [];
  for (const line of lines) {
    if (line.startsWith(':')) continue; // SSE 주석
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim());
    }
  }
  const rawData = dataLines.join('\n');
  let data = null;
  if (rawData) {
    try { data = JSON.parse(rawData); } catch { data = { raw: rawData }; }
  }
  return { event, data };
}

async function safeText(response) {
  try { return await response.text(); } catch { return ''; }
}

async function mockStream({ question, filters }, { onNotices, onToken, onDone }) {
  await wait(200);
  const reply = createMockReply(question, filters);
  onNotices?.(reply.notices || []);
  const words = reply.message.split(/(\s+)/);
  for (const w of words) {
    await wait(30);
    onToken?.(w);
  }
  onDone?.();
}

function createMockReply(question, filters) {
  const { keyword, notices } = searchMockNotices(question, filters);
  const context = filters.major ? `${filters.dept} · ${filters.major}` : '전체 학과';
  const tagText = filters.tags.length > 0 ? ` (태그: ${filters.tags.join(', ')})` : '';

  if (notices.length === 0) {
    return {
      message: `${context}${tagText} 기준으로 '${keyword}' 관련 공지를 검색했지만 현재 조건에 맞는 공지가 없습니다. 태그 필터를 해제하거나 다른 키워드로 다시 시도해보세요.`,
      notices: [],
    };
  }

  return {
    message: `${context}${tagText} 기준으로 '${keyword}' 관련 공지 ${notices.length}건을 찾았습니다:`,
    notices,
  };
}

function searchMockNotices(question, filters) {
  const query = question.toLowerCase();
  const tags = new Set(filters.tags);
  let pool = MOCK_NOTICES.filter((notice) => notice.dept === '전체' || !filters.dept || notice.dept === filters.dept);

  if (tags.size > 0) {
    pool = pool.filter((notice) => tags.has(notice.tag));
  }

  const rules = [
    { pattern: /최신|최근|전체|공지/, keyword: '최신', pick: (items) => items.slice(0, 3) },
    { pattern: /장학|등록|학비|장학금/, keyword: '장학금', pick: byTag('등록/장학') },
    { pattern: /수강|학사|강의|시간표/, keyword: '수강신청/학사', pick: byTag('학사') },
    { pattern: /취업|진로|채용|인턴|잡/, keyword: '취업/진로', pick: byTag('진로취업') },
    { pattern: /글로벌|해외|교환|유학/, keyword: '글로벌/교환학생', pick: byTag('글로벌') },
    { pattern: /축제|행사|이벤트|봄|학생생활/, keyword: '학생생활/행사', pick: byTag('학생생활') },
    { pattern: /봉사|사회봉사/, keyword: '사회봉사', pick: byTag('사회봉사') },
    { pattern: /비교과|프로그램|클리닉/, keyword: '비교과', pick: byTag('비교과') },
  ];

  const matchedRule = rules.find((rule) => rule.pattern.test(query));
  return matchedRule
    ? { keyword: matchedRule.keyword, notices: matchedRule.pick(pool) }
    : { keyword: '검색어 관련', notices: pool.slice(0, 2) };
}

function byTag(tag) {
  return (items) => items.filter((notice) => notice.tag === tag);
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
