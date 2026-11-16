# 전시 사진

`exhibitions/*.html` (전시 상세 페이지)와 `projects.html` (카드 목록)이
아래 파일명을 가리킵니다. 같은 이름으로 넣으면 그 칸이 채워지고,
없는 파일은 자리표시 이미지로 보입니다.

| 파일명 | 전시 | 페이지 캡션 |
|---|---|---|
| `busan-2025.jpg`            | 부산 일러스트레이션 페어(2025) | 전시 |
| `busan-2025-invite-1.jpg`   | 〃 | 초대장 1 |
| `busan-2025-invite-2.jpg`   | 〃 | 초대장 2 |
| `seongsu-2025-1.jpg`        | 성수동 언더스탠드 애비뉴 팝업(2025) | 전시 1 |
| `seongsu-2025-2.jpg`        | 〃 | 전시 2 |
| `seongsu-2025-3.jpg`        | 〃 | 전시 3 |
| `seongsu-2025-invite-1.jpg` | 〃 | 초대장 1 |
| `seongsu-2025-invite-2.jpg` | 〃 | 초대장 2 |
| `squareone-2025.jpg`        | 스퀘어원 팝업(2025) | 전시 |
| `seongsu-2026-1.jpg`        | 성수동 팝업(2026) | 김심리월드 부스 전경 |
| `seongsu-2026-2.jpg`        | 〃 | 캐릭터 굿즈와 엽서 진열 |
| `squareone-2026-1.jpg`      | 스퀘어원 팝업(2026) | 팝업 전시 전경 |
| `squareone-2026-2.jpg`      | 〃 | 김심리월드 부스 |
| `mini-showcase-2026-1.jpg` | 체험형 전시 미니 쇼케이스(2026) | 인터랙티브 전시에서 만난 세루와 루비 |
| `mini-showcase-2026-2.jpg` | 〃 | 손짓에 반응하는 인터랙티브 체험 |
| `mini-showcase-2026-3.jpg` | 〃 | 전시장에 설치된 행사 안내 화면 |
| `mini-showcase-2026-poster.jpg` | 〃 | 손짓으로 여는 AI 세계 전시 포스터 |

2026년 성수동과 스퀘어원 사진 4장은 사용자가 제공한 현장 사진입니다. 촬영 방향을 반영하고
긴 변 1600px의 웹용 JPEG로 저장했으며, 원본 구도와 색을 유지합니다.

2026년 11월 13일 미니 쇼케이스는 현장 사진 3장과 전시 포스터 1장으로 구성합니다.
사용자 첨부 파일이 이미 긴 변 1536px의 JPEG이므로 재압축 없이 원본을 사용합니다.
`mini-showcase-2026-1.jpg`와 `-2.jpg`는 864×1536px, `-3.jpg`는 1152×1536px,
포스터는 1536×868px입니다. 포스터의 원래 확장자는 PNG였지만 실제 형식이 JPEG이어서
내용 변경 없이 확장자만 맞췄습니다. 영상 파일은 아직 포함되어 있지 않습니다.

## 사진을 더 넣거나 뺄 때

파일만 넣어서는 화면에 나오지 않습니다. 그 전시의 상세 페이지
(`exhibitions/<slug>.html`) 의 `.shots` 안에 칸을 하나 늘려야 합니다.

```html
<figure data-lb="seongsu-2025" data-lb-cap="성수동 언더스탠드 애비뉴 팝업(2025) · 전시 4">
  <img src="/assets/img/exhibitions/seongsu-2025-4.jpg" alt="…" data-en-alt="…" loading="lazy"
       onerror="this.onerror=null;this.src='/assets/img/placeholder.svg'">
  <figcaption data-en="Exhibition 4">전시 4</figcaption>
</figure>
```

- `data-lb` — 같은 값끼리 한 묶음 (확대 화면에서 ← → 로 이동). 전시 slug 를 씁니다
- `data-lb-cap` — 확대 화면 제목. 없으면 figcaption 을 씁니다
- 목록(`projects.html`)의 카드에 적힌 **사진 장수 문구**도 함께 고쳐주세요

새 사진의 톤은 기존 5장과 맞춰야 합니다 — 기준값은 CLAUDE.md 의 '전시 부스 사진의 톤' 참고.

## 올리실 때

- **저장소 루트가 아니라 이 폴더에** 넣어주세요. 루트에 두면 사이트에 그대로 노출됩니다.
- 크기·비율·방향 신경 쓰지 않으셔도 됩니다. 긴 변 1600px 으로 줄이고,
  세로로 찍은 사진의 회전 정보(EXIF)도 반영해서 넣어드립니다.
- 확대 화면에서도 같은 파일을 쓰므로 1600px 이면 충분히 선명합니다.
