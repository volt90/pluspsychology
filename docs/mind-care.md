# 김심리월드 QR 마음 돌봄

주소: `https://www.pluspsychology.ai/experience/mind-care`

사용자가 승인한 v13 화면을 기존 정적 사이트에 추가했다. Vercel의 기존
`cleanUrls` 설정으로 `experience/mind-care.html`이 위 주소에서 열린다.
메인 메뉴와 sitemap에는 추가하지 않으며, 페이지에 `noindex,nofollow`를 둔다.
이 페이지는 URL로 접근하는 공개 체험 페이지이며 인증을 요구하지 않는다.

## 파일

- `experience/mind-care.html`: 전용 헤더, 웹폰트, 메타 정보, 공통 음악 연결
- `assets/mind-care/mind-care.css`: 승인된 모바일 화면 스타일
- `assets/mind-care/mind-care.js`: 8문항 체크인, 하트 결과, 엽서와 추천 활동, OX 퀴즈
- `assets/mind-care/01-rest.png` ~ `08-seeking-help.png`: 1205×1772px 원본 엽서
- `assets/mind-care/friends.webp`: 투명 캐릭터 일러스트
- `assets/mind-care/seru-o.webp`, `rhuby-x.webp`: 승인된 O/X 캐릭터
- `assets/mind-care/brand-logo.png`: 기존 김심리월드 로고

## 유지할 동작

- 카페24 아네모네는 시작 화면 두 활동 제목에만 적용한다.
- 체크인의 다섯 답변은 최근 7일을 회상하는 과거형이며, 건너뛰기는 없다.
- 마지막 버튼은 ‘엽서 추천받기’다. 샘플 응답을 실제 결과로 사용하지 않는다.
- 응답값 0~4는 각 하트의 채움에 대응한다. 최솟값이 3 미만이면 그 최솟값을
  선택한 영역에만 ‘살펴볼 곳’을 표시한다. 동점인 영역은 모두 표시한다.
- 모든 하트는 표시 유무와 관계없이 한 번 누르면 해당 엽서와 추천 활동을 연다.
- 추천 활동은 엽서 아래에 있으며 소제목은 공통 ‘오늘의 작은 돌봄’이다.
- 엽서에서 결과로 돌아갈 때 응답과 하트 채움을 유지한다.
- 응답은 탭의 메모리에만 둔다. 서버, 분석 도구, URL, localStorage로 전송·저장하지 않는다.
- 브라우저 history에는 화면 위치만 둔다. 새로고침으로 응답이 초기화된 뒤
  이전 history로 이동하면 첫 화면으로 돌아가 미응답 결과를 만들지 않는다.
- 외부 출처 링크, 시안용 탭, 디자인 조절 도구는 방문자 화면에 표시하지 않는다.

## 음악

기존 `/assets/bgm/landing-loop.mp3`와 공용 WebAudio 모듈을 재사용한다.
페이지는 아래 속성으로 QR 전용 옵션을 켠다.

```html
<script defer src="/assets/bgm/bgm.js"
  data-preference="visit"
  data-button-id="simri-care-music-toggle"></script>
```

`visit`은 매 페이지 로드 기본 ON을 뜻한다. 다른 페이지의 저장된 음악 선호를
읽거나 덮어쓰지 않으며, 현재 방문에서 끄면 화면을 이동해도 OFF를 유지한다.
브라우저가 자동재생을 차단하면 첫 조작 후 시작한다. 기존 페이지에서 옵션을
생략하면 기존의 저장 선호, 플로팅 버튼, 한/영 라벨을 유지한다.

커스텀 버튼의 `[data-music-label]`만 갱신한다. `aria-checked`는 켜짐 선호,
`data-playback`은 실제 `pending/playing/paused/error` 상태를 나타낸다.

## 검증

```sh
node --check assets/mind-care/mind-care.js
node --test tests/bgm-qr.test.cjs
python -m http.server 8769 --bind 127.0.0.1
```

로컬 일반 HTTP 서버에서는 `/experience/mind-care.html`을 연다.
320/390/768px, DPR 3에서 체크인·OX 완주, 최저/최고 응답의 8하트 직접 열기,
고해상도 원본 8종 로드, 결과 복귀, 화면 넘침과 스크립트 오류를 확인했다.
자동재생 첫 조작, ON/OFF, 기존 저장 선호 보존은 공통 음악 회귀 테스트와
실제 Chromium의 AudioContext 재생/중지로 확인했다.
실제 iPhone/Android 하드웨어 검증은 별도로 진행할 수 있다.

문서와 테스트는 `.vercelignore`로 배포에서 제외한다.

## 퀴즈의 내부 참고 출처

출처는 콘텐츠 검수용이다. 방문자 화면에는 외부 링크를 넣지 않는다.

- https://www.nimh.nih.gov/health/topics/caring-for-your-mental-health
- https://www.nhs.uk/mental-health/self-help/guides-tools-and-activities/five-steps-to-mental-wellbeing/
- https://www.nimh.nih.gov/health/publications/depression
- https://www.nhs.uk/every-mind-matters/mental-wellbeing-tips/self-help-cbt-techniques/thought-record/
- https://www.westlondon.nhs.uk/ealing-talking-therapies/move-4-mood/eat-well-feel-well/how-food-and-drink-affects-my-mood
- https://www.who.int/news-room/fact-sheets/detail/physical-activity
- https://www.nimh.nih.gov/health/topics/psychotherapies
