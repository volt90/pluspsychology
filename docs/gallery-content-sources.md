# 버츄얼 갤러리 콘텐츠 출처

확인일: 2026-11-17 (Asia/Seoul). 기존 회사 웹사이트 공개 페이지와 같은 저장소의 HTML 및 공개 이미지 파일을 바탕으로 작성했다.

## 브랜드 및 이미지

- 브랜드 표기는 `김심리월드`. 공개 웹사이트만으로 사업자 법인명이나 설립일을 확인할 수 없으므로 별도 법인명·설립연도를 만들지 않았다.
- https://www.pluspsychology.ai/about — 브랜드 소개, 네 캐릭터 이름과 설명.
- https://www.pluspsychology.ai/ — 워크북 설명, 표지, 출시 알림 안내.
- `gallery/media/logo.png`, `simri.png`, `seru.png`, `ruby.png`, `ar.png`, `workbook.jpg`는 기존 `index.html`의 해당 alt 이미지 base64를 원본 바이트 그대로 추출했다. 새 그림·보정·재압축 없음.
- `gallery/media/*.jpg` 중 전시 사진 11개는 `assets/img/exhibitions/` 공개 파일의 동일 바이트 복사다.

## 활동 기록

| 기록 | 사용한 날짜 | 출처 |
|---|---|---|
| 부산 일러스트레이션 페어 v.6 / A34 | 2025년만 확인 | https://www.pluspsychology.ai/exhibitions/busan-2025 |
| 성수동 언더스탠드에비뉴 팝업 | 2025-09-21 ~ 2025-09-28 | https://www.pluspsychology.ai/exhibitions/seongsu-2025 |
| 스퀘어원 팝업 | 2025년만 확인 | https://www.pluspsychology.ai/exhibitions/squareone-2025 |
| 성수동 팝업 | 2026년만 확인 | https://www.pluspsychology.ai/exhibitions/seongsu-2026 |
| 스퀘어원 팝업 | 2026년만 확인 | https://www.pluspsychology.ai/exhibitions/squareone-2026 |
| 체험형 전시 미니 쇼케이스 / 손짓으로 여는 AI 세계 | 2026-11-13 | https://www.pluspsychology.ai/exhibitions/mini-showcase-2026 |

연도별 전시 배치는 기록의 묶음이며, 날짜 미상 기록 사이의 월별 순서를 확정하지 않는다. 창립일·수상·매출·관람객 수 같은 확인되지 않은 연혁은 추가하지 않았다. 2026 미니 쇼케이스는 연혁과 체험관 양쪽에서 다루지만 하나의 행사다. 전시 설명은 원문을 짧게 편집했다.

## 상태와 표현

- 워크북은 공개 사이트에 출시 알림 신청이 있어 출시·판매 완료를 단정하지 않는다.
- 손짓 체험은 실제 전시의 사진 기록이다. 이 갤러리 자체에서 카메라 기반 손짓 인식을 제공한다고 표현하지 않는다.
- 심리교육·자기이해 범위의 소개이며 치료·증상 개선 효과를 추가하지 않았다.
- `docs/`는 기존 `.vercelignore`로 공개 배포에서 제외되어 있다.

## 업데이트

실제 새 활동이 확인되면 `gallery/content.js`의 `exhibits`에 추가하고, `room`을 정확한 방 ID로 연결한다. `images`는 `{ src, alt }` 배열이고 경로는 갤러리 HTML 기준이다. 월일이 확인되지 않으면 연도만 유지한다. 사진을 추가할 때는 해당 사용 권한 및 공개 용도를 확인한다.
