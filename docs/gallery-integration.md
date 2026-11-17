# 김심리월드 버츄얼 갤러리

2026-11-17 제작. 운영 경로는 `https://www.pluspsychology.ai/gallery/`입니다. 사용자는 같은 날 이 주소로 배포하되 **메인페이지에 갤러리 진입 버튼을 만들지 말고 주소를 아는 사람만 관람하도록 유지**할 것을 요청했습니다.

## 공개 범위 유지

- 홈페이지·Projects·메뉴·사이트맵에 갤러리 링크를 추가하지 않습니다.
- HTML의 `robots` 메타 태그와 갤러리 경로의 `X-Robots-Tag` 응답 헤더에 `noindex, nofollow, noimageindex`를 설정합니다.
- `robots.txt`에서 갤러리 크롤링을 막지 않습니다. 검색엔진이 페이지에 접근해야 `noindex`를 읽을 수 있습니다.
- 로그인이나 비밀번호로 보호하는 페이지는 아닙니다. 주소를 전달받거나 알아낸 사람도 접근할 수 있습니다.
- 운영 사이트의 다른 페이지 및 검색 노출 설정은 그대로 유지합니다.

## 보기

저장소 루트에서 `node scripts/gallery-preview.cjs` 실행 후 `http://127.0.0.1:4173/gallery/`를 엽니다. ES 모듈과 WebGL을 사용하므로 HTML 파일을 더블클릭하는 대신 HTTP로 실행합니다.

## 구성

- `gallery/index.html`: 관람 화면, 대화상자, 검색·공유 메타데이터
- `gallery/gallery.css`: 기존 사이트의 크림·파랑·골드와 Jua/Noto Sans KR 디자인
- `gallery/app.js`: 공간/연혁 전환, 사진 앨범, 공간 안내, 키보드, URL 상태
- `gallery/scene.js`: 독립 구현한 3D 전시 공간, 카메라, 전시물 클릭
- `gallery/content.js`: 회사 소개, 공간, 전시 기록, 출처
- `gallery/media/`: 기존 공개 사이트의 원본 이미지 사본
- `gallery/vendor/`: 버전 고정 Three.js와 라이선스

네 공간은 브랜드 소개, 2025년 활동, 2026년 활동, 이야기와 체험입니다. 연혁 보기는 실제 전시 6건을 연도별로 표시합니다. 확인되지 않은 창립일·행사 월일은 넣지 않았으며 워크북을 출간 완료로 표현하지 않습니다. 상세 근거는 `docs/gallery-content-sources.md`에 있습니다.

참고 사이트는 실제 REA CLI로 정적 분석했습니다. 보고서와 원본 Evidence는 사이트 저장소 밖 `output/pluspsychology-gallery/research/`에 보관합니다. 참고 사이트의 파노라마·사진·플레이어 코드를 제품에 복제하지 않았습니다. 새 전시장은 회사 자료를 전시하기 위해 설계한 가상 공간이며 실제 회사 공간을 촬영한 디지털 트윈은 아닙니다.

## pluspsychology.ai에 연결

1. 이 저장소의 `gallery/` 디렉터리를 기존 Vercel 배포에 포함하면 `/gallery/` 경로로 서비스할 수 있습니다. 기존 `cleanUrls` 설정을 유지합니다.
2. **현재 사용자 요청에 따라** `projects.html`, 메인페이지, 헤더, 푸터에 갤러리 진입 링크를 추가하지 않습니다.
3. `sitemap.xml`에도 갤러리 주소를 추가하지 않습니다. 향후 노출 정책을 바꾸려면 사용자의 별도 요청이 필요합니다.
4. 필요하면 외부 페이지에 `<iframe src="https://www.pluspsychology.ai/gallery/" title="김심리월드 버츄얼 갤러리" style="width:100%;height:850px;border:0" loading="lazy" allow="fullscreen"></iframe>`으로 삽입할 수 있습니다. 모바일은 독립 페이지 링크 방식이 편합니다. 호스트의 프레임 보안 정책에 따라 삽입 가능 여부를 확인하세요.

`index.html`의 `<base href="/gallery/">`가 `/gallery`와 `/gallery/` 양쪽에서 자산을 올바르게 찾도록 합니다. 다른 도메인의 웹 루트에 독립 배포할 때는 이 base를 `/`로 바꾸고 canonical/OG URL과 OG 이미지를 맞춥니다. 공식 기록·홈페이지 링크는 절대 URL입니다. Google Fonts만 외부 요청이며 실패 시 시스템 한글 폰트를 사용합니다. 계정·DB·API 키·유료 플랫폼이 필요하지 않습니다.

## 기록 추가·수정

`content.js`의 `exhibits`에 고유 ID, 공간 ID, 제목, 확인된 날짜, 장소, 설명, 사진 경로/대체 텍스트, 공식 출처를 작성합니다. 사진을 `media/`에 추가합니다. 현재의 네 공간 구조를 유지하면서 각 연도 공간에 기록을 추가할 수 있습니다. **공간 자체를 추가할 경우** `app.js`의 `shortNames`/`headings`와 `index.html`의 공간 수 표기도 함께 갱신해야 합니다. 월일이 확인되지 않았다면 연도만 적습니다.

URL 예: `/gallery/#room=history-2026`, `/gallery/#room=history-2026&exhibit=mini-showcase-2026`, `/gallery/#room=welcome&view=archive&year=2025`. 내부 관람 상태 공유용이며 광고 유입 주소는 기존 사이트 정책대로 해시 없는 `/gallery/`를 사용합니다.

## 검증 범위

모든 콘텐츠/미디어 경로와 모듈 문법, 데스크톱·모바일 뷰, 공간 이동, 사진 상세·앨범, 연도 필터, URL 복귀를 점검합니다. WebGL 사용 불가 시 연혁 관람으로 이동할 수 있습니다. 3D 관람 속도는 기기 그래픽 성능에 따라 달라집니다. 화면 자동 회전과 배경음 자동 재생은 없습니다.
