const translations = {
  ko: {
    title: '마음 투표',
    intro: '마음에 닿는 답을 골라 포스트잇 한 장을 붙여보세요.',
    closed: '종료',
    vote: '투표 참여하기',
    results: '결과 보기',
    past: '지난 투표',
    noPast: '투표가 끝나면 이곳에서 우리가 고른 답을 다시 볼 수 있어요.',
    noOpen: '지금은 진행 중인 투표가 없어요.'
  },
  en: {
    title: 'Heart notes',
    intro: 'Pick the answer that feels right to you and add a sticky note to the board.',
    closed: 'Closed',
    vote: 'Join the poll',
    results: 'View results',
    past: 'Past polls',
    noPast: 'Once a poll closes, you can revisit everyone’s answers here.',
    noOpen: 'There are no open polls right now.'
  }
};

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function makeCover(poll) {
  const frame = element('span', 'archive-art');
  frame.setAttribute('aria-hidden', 'true');
  const board = element('span', 'vote-cover paper-' + (poll.coverColor || poll.options[0].color));
  const scene = element('img', 'vote-cover__scene');
  scene.src = '/vote/assets/' + encodeURIComponent(poll.scene || poll.options[0].art + '.png');
  scene.alt = '';
  board.append(scene);
  for (const option of [poll.options[0], poll.options[poll.options.length - 1]]) {
    const note = element('span', 'vote-cover__note paper-' + option.color);
    const drawing = element('img');
    drawing.src = '/vote/assets/' + encodeURIComponent(option.art) + '.png';
    drawing.alt = '';
    note.append(drawing);
    board.append(note);
  }
  frame.append(board);
  return frame;
}

function makePollCard(poll, language) {
  const labels = translations[language];
  const title = (language === 'en' && poll.titleEn) || poll.title;
  const prompt = (language === 'en' && poll.promptEn) || poll.prompt;
  const link = element('a', 'archive-card ' + (poll.open ? 'archive-card--open' : 'archive-card--closed'));
  const path = '/vote/' + encodeURIComponent(poll.slug);
  link.href = poll.open ? path : path + '/results';

  const content = element('div', 'archive-card-copy');
  if (!poll.open) content.append(element('span', 'archive-status', labels.closed));
  const heading = element(poll.open ? 'h2' : 'h3', 'archive-question', title);
  content.append(heading);
  if (poll.open && prompt) content.append(element('p', 'archive-prompt', prompt));
  const action = element('span', 'archive-action', poll.open ? labels.vote : labels.results);
  const arrow = element('span', 'archive-arrow');
  arrow.setAttribute('aria-hidden', 'true');
  action.append(arrow);
  content.append(action);
  link.append(makeCover(poll), content);
  return link;
}

export function renderArchive(container, polls, lang = 'ko') {
  const language = lang === 'en' ? 'en' : 'ko';
  const labels = translations[language];
  const header = element('header', 'archive-intro');
  header.append(element('h1', 'archive-title', labels.title), element('p', 'archive-subtitle', labels.intro));

  const current = element('div', 'archive-current');
  const previous = element('section', 'archive-past');
  previous.append(element('h2', 'archive-past-title', labels.past));
  const previousCards = element('div', 'archive-past-grid');
  for (const poll of polls) {
    const group = poll.open ? current : previousCards;
    group.append(makePollCard(poll, language));
  }
  current.classList.toggle('archive-many', current.childElementCount > 1);
  if (!current.childElementCount) current.append(element('p', 'archive-empty', labels.noOpen));
  if (previousCards.childElementCount) {
    previous.append(previousCards);
  } else {
    previous.append(element('p', 'archive-empty', labels.noPast));
  }
  container.classList.add('vote-archive');
  container.replaceChildren(header, current, previous);
}
