# 전시 사진

projects.html 이 아래 파일명을 가리킵니다. 같은 이름으로 넣으면 그 칸이 채워지고,
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

## 사진을 더 넣거나 뺄 때

한 전시에 사진을 추가하려면 파일을 넣는 것만으로는 안 되고, `projects.html` 에
칸을 하나 늘려야 합니다. 같은 전시의 `data-lb` 값을 그대로 쓰면 확대 화면에서
그 전시 사진끼리 넘겨보게 됩니다.

```html
<li class="gcard"><figure data-lb="seongsu" data-lb-cap="성수동 언더스탠드 애비뉴 팝업(2025) · 전시 4">
  <img src="/assets/img/exhibitions/seongsu-2025-4.jpg" alt="…" loading="lazy"
       onerror="this.onerror=null;this.src='/assets/img/placeholder.svg'">
  <figcaption data-en="Exhibition 4">전시 4</figcaption></figure></li>
```

- `data-lb` — 같은 값끼리 한 묶음 (확대 화면에서 ← → 로 이동)
- `data-lb-cap` — 확대 화면 제목. 없으면 figcaption 을 씁니다

## 올리실 때

- **저장소 루트가 아니라 이 폴더에** 넣어주세요. 루트에 두면 사이트에 그대로 노출됩니다.
- 크기·비율·방향 신경 쓰지 않으셔도 됩니다. 긴 변 1600px 으로 줄이고,
  세로로 찍은 사진의 회전 정보(EXIF)도 반영해서 넣어드립니다.
- 확대 화면에서도 같은 파일을 쓰므로 1600px 이면 충분히 선명합니다.
