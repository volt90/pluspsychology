// Public editorial content. All media paths are relative to gallery/index.html.
// Keep year-only dates when the original public record has no month or day.
export const brand = {
  name: '김심리월드',
  company: '김심리월드',
  tagline: '마음을 이해하는 다정한 방법',
  home: 'https://www.pluspsychology.ai/'
};

export const media = {
  logo: 'media/logo.png',
  simri: 'media/simri.png',
  ruby: 'media/ruby.png',
  seru: 'media/seru.png',
  ar: 'media/ar.png',
  workbook: 'media/workbook.jpg'
};

export const rooms = [
  {
    id: 'welcome', title: '우리의 마음', subtitle: '김심리월드에 오신 것을 환영해요',
    description: '이야기로 연결되고, 심리학으로 성장하는 우리. 마음 곁의 친구들과 함께 김심리월드의 기록을 만나보세요.',
    color: '#4C8CCB', year: ''
  },
  {
    id: 'history-2025', title: '2025 · 첫 만남의 기록', subtitle: '캐릭터가 일상과 만나는 자리',
    description: '성수동, 스퀘어원, 부산에서 만난 사람들. 캐릭터와 이야기, 작은 굿즈로 마음의 대화를 열었습니다.',
    color: '#E86B5E', year: '2025'
  },
  {
    id: 'history-2026', title: '2026 · 넓어지는 경험', subtitle: '종이 위 이야기에서 손짓으로',
    description: '팝업에서 이어진 만남과 관람객의 손짓에 반응하는 전시. 김심리월드의 이야기가 새로운 경험으로 이어집니다.',
    color: '#54B491', year: '2026'
  },
  {
    id: 'experience', title: '이야기와 체험', subtitle: '내 마음을 만나는 여러 가지 방법',
    description: '책장을 넘기며 나를 살피고, 몸을 움직이며 캐릭터를 만나요. 심리학을 쉽고 재미있는 이야기와 경험으로 풀어냅니다.',
    color: '#F2B620', year: ''
  }
];

export const exhibits = [
  {
    id: 'our-story', room: 'welcome', title: '이야기로 연결되는 우리',
    date: '브랜드 이야기', year: '', location: '김심리월드', kind: '브랜드',
    description: '김심리월드는 심리학을 쉽고 재미있는 이야기와 경험으로 풀어냅니다. 누구나 자신의 마음을 이해하고 돌보는 힘을 기르며, 일상과 관계 속에서 작은 변화를 만들어 갈 수 있도록 돕습니다.',
    images: [{ src: media.simri, alt: '김심리월드의 김심리 캐릭터' }],
    sourceUrl: 'https://www.pluspsychology.ai/about'
  },
  {
    id: 'our-friends', room: 'welcome', title: '마음 곁의 친구들',
    date: '캐릭터 이야기', year: '', location: '김심리 · 세루 · 루비 · 아르', kind: '캐릭터',
    description: '마음만은 따뜻한 좌충우돌 도움대장 김심리, 마음을 먼저 듣는 소심한 부끄럼쟁이 세루, 냉철한 시선으로 핵심을 파헤치는 현실파 루비, 말없이 누군가의 곁을 지켜주는 고양이 아르. 나를 이해하는 여정을 함께 걷는 친구들입니다.',
    images: [
      { src: media.simri, alt: '마음만은 따뜻한 도움대장 김심리' },
      { src: media.seru, alt: '마음을 먼저 듣는 세루' },
      { src: media.ruby, alt: '냉철한 현실파 루비' },
      { src: media.ar, alt: '말없이 곁을 지켜주는 고양이 아르' }
    ],
    sourceUrl: 'https://www.pluspsychology.ai/about'
  },
  {
    id: 'seongsu-2025', room: 'history-2025', title: '성수동 언더스탠드에비뉴 팝업',
    date: '2025. 09. 21–28', year: '2025', location: '서울 성수동 언더스탠드에비뉴', kind: '팝업',
    description: '서울숲 옆 언더스탠드에비뉴의 컨테이너 공간에서 진행한 팝업입니다. 인천콘텐츠코리아랩 팝업스토어에 함께하며 김심리월드의 캐릭터와 굿즈를 선보였습니다.',
    images: [
      { src: 'media/seongsu-2025-1.jpg', alt: '2025년 성수동 팝업스토어 외관' },
      { src: 'media/seongsu-2025-2.jpg', alt: '2025년 성수동 팝업의 김심리월드 부스 진열' }
    ],
    sourceUrl: 'https://www.pluspsychology.ai/exhibitions/seongsu-2025'
  },
  {
    id: 'squareone-2025', room: 'history-2025', title: '스퀘어원 팝업',
    date: '2025', year: '2025', location: '스퀘어원', kind: '팝업',
    description: '인천콘텐츠코리아랩 팝업에 함께한 김심리월드. 쇼핑몰 한가운데 메모지, 스티커, 키링, 엽서, 손거울을 함께 진열했습니다.',
    images: [{ src: 'media/squareone-2025.jpg', alt: '2025년 스퀘어원 팝업의 김심리월드 부스' }],
    sourceUrl: 'https://www.pluspsychology.ai/exhibitions/squareone-2025'
  },
  {
    id: 'busan-2025', room: 'history-2025', title: '부산 일러스트레이션 페어',
    date: '2025', year: '2025', location: '부산 일러스트레이션 페어 v.6 · A34', kind: '페어',
    description: '캐릭터 영상과 함께 김심리월드를 소개하고, 캐릭터의 탄생을 축하하는 기념 이벤트를 열었습니다. 부산 일러스트레이션 페어 v.6의 A34 부스에서 관람객을 만났습니다.',
    images: [{ src: 'media/busan-2025.jpg', alt: '2025년 부산 일러스트레이션 페어의 김심리월드 부스' }],
    sourceUrl: 'https://www.pluspsychology.ai/exhibitions/busan-2025'
  },
  {
    id: 'seongsu-2026', room: 'history-2026', title: '성수동 팝업',
    date: '2026', year: '2026', location: '서울 성수동', kind: '팝업',
    description: '2026년 성수동에서 이어간 팝업의 기록입니다. 마음 돌봄 엽서와 포스터, 캐릭터 굿즈를 통해 김심리월드의 이야기를 전했습니다.',
    images: [
      { src: 'media/seongsu-2026-1.jpg', alt: '2026년 성수동 팝업의 김심리월드 부스 전경' },
      { src: 'media/seongsu-2026-2.jpg', alt: '2026년 성수동 팝업에 진열한 마음 돌봄 엽서와 캐릭터 굿즈' }
    ],
    sourceUrl: 'https://www.pluspsychology.ai/exhibitions/seongsu-2026'
  },
  {
    id: 'squareone-2026', room: 'history-2026', title: '스퀘어원 팝업',
    date: '2026', year: '2026', location: '인천 스퀘어원', kind: '팝업',
    description: '인천 스퀘어원에서 열린 인천콘텐츠코리아랩 팝업의 전시 공간과 김심리월드 부스입니다. 캐릭터 굿즈와 함께 또 한 번의 만남을 기록했습니다.',
    images: [
      { src: 'media/squareone-2026-1.jpg', alt: '2026년 인천 스퀘어원 팝업의 전시장 전경' },
      { src: 'media/squareone-2026-2.jpg', alt: '2026년 스퀘어원 팝업의 김심리월드 부스와 굿즈' }
    ],
    sourceUrl: 'https://www.pluspsychology.ai/exhibitions/squareone-2026'
  },
  {
    id: 'mini-showcase-2026', room: 'history-2026', title: '손짓으로 여는 AI 세계',
    date: '2026. 11. 13', year: '2026', location: '상암 누리꿈스퀘어', kind: '체험형 전시',
    description: '상암 누리꿈스퀘어에서 열린 체험형 전시 미니 쇼케이스에 참여했습니다. 관람객의 손짓에 반응하는 화면을 통해 세루와 루비를 만나는 인터랙티브 콘텐츠를 선보였습니다.',
    images: [
      { src: 'media/mini-showcase-2026-1.jpg', alt: '미니 쇼케이스에서 세루와 루비를 만나는 관람객' },
      { src: 'media/mini-showcase-2026-2.jpg', alt: '손짓에 반응하는 김심리월드 인터랙티브 전시 체험' },
      { src: 'media/mini-showcase-2026-poster.jpg', alt: '2026년 11월 13일 손짓으로 여는 AI 세계 전시 포스터' }
    ],
    sourceUrl: 'https://www.pluspsychology.ai/exhibitions/mini-showcase-2026'
  },
  {
    id: 'mind-manual', room: 'experience', title: '마음 사용 설명서',
    date: '워크북 소개', year: '', location: '자기이해를 위한 심리 워크북', kind: '워크북',
    description: '감정 체크, 나를 이해하는 질문, 작지만 실천 가능한 활동을 담은 마음 워크북입니다. 캐릭터들의 이야기를 따라 내 감정과 하루를 살펴봅니다. 현재 회사 홈페이지에서 워크북 소개와 출시 알림을 안내하고 있습니다.',
    images: [{ src: media.workbook, alt: '심리 워크북 마음 사용 설명서 표지' }],
    sourceUrl: 'https://www.pluspsychology.ai/'
  },
  {
    id: 'gesture-experience', room: 'experience', title: '손짓으로 만나는 친구들',
    date: '2026. 11. 13 전시 기록', year: '2026', location: '체험형 전시 미니 쇼케이스', kind: '인터랙티브',
    description: '관람객의 움직임이 캐릭터와의 만남으로 이어집니다. 세루와 루비가 등장하는 인터랙티브 체험의 현장을 살펴보세요. 이 공간에서는 실제 전시 사진과 이야기를 감상할 수 있습니다.',
    images: [
      { src: 'media/mini-showcase-2026-2.jpg', alt: '관람객의 손짓에 반응하는 전시 화면' },
      { src: 'media/mini-showcase-2026-1.jpg', alt: '김심리월드 세루와 루비가 등장하는 전시 현장' }
    ],
    sourceUrl: 'https://www.pluspsychology.ai/exhibitions/mini-showcase-2026'
  }
];
