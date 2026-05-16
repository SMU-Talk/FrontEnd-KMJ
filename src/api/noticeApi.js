import { MOCK_NOTICES } from '../noticeData.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export async function askNotice({ question, filters }) {
  if (API_BASE_URL) {
    return requestNoticeApi({ question, filters });
  }

  await wait(650);
  return createMockReply(question, filters);
}

async function requestNoticeApi(payload) {
  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('공지 검색 API 요청에 실패했습니다.');
  }

  return normalizeChatResponse(await response.json());
}

function normalizeChatResponse(data) {
  return {
    message: data.message ?? data.answer ?? '응답 메시지가 비어 있습니다.',
    notices: Array.isArray(data.notices) ? data.notices : [],
  };
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
