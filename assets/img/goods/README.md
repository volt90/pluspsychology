# 굿즈 사진 넣는 곳

store.html 의 각 칸이 아래 파일명을 **이미 가리키고 있습니다.**
파일을 이 폴더에 같은 이름으로 넣기만 하면 그 칸이 바로 채워집니다.
아직 없는 파일은 자동으로 자리표시 이미지(사진 준비 중)로 보입니다.

| 파일명 | 페이지 캡션 | 어떤 사진인지 |
|---|---|---|
| `memo-a.jpg`     | 메모지A | MEMO · 노란 배경, 장미 든 세루 |
| `memo-b.jpg`     | 메모지B | MEMO · 화이트보드, 갓 쓴 세루 |
| `memo-c.jpg`     | 메모지C | To Do List · 파란 배경, 클립보드 든 김심리 |
| `sticker-a.jpg`  | 스티커A | 세루의 하루 DECO STICKER (5종 시트) |
| `keyring-a.jpg`  | 키링A   | 갓 쓴 세루 · 네이비 가방 |
| `keyring-b.jpg`  | 키링B   | 장미 든 세루 · 베이지 백팩 |
| `keyring-c.jpg`  | 키링C   | 파란 모자 세루 · 검정 백팩 |
| `keyring-d.jpg`  | 키링D   | 책 읽는 세루 · 검정 백팩 |
| `keyring-e.jpg`  | 키링E   | 자는 세루 · 회색 백팩 |
| `keyring-f.jpg`  | 키링F   | 클립보드 든 김심리 · 회색 백팩 |
| `postcard-a.jpg` | 엽서A   | HAPPY BIRTHDAY! CELEBRATE YOU! · 케이크 위 김심리 |
| `postcard-b.jpg` | 엽서B   | HAPPY BIRTHDAY! · 선물기차 탄 세루 |
| `mirror-a.jpg`   | 손거울A | 하늘색 · 책 읽는 세루 (True knowledge is more than knowing…) |
| `mirror-b.jpg`   | 손거울B | 청록 · 걷는 김심리 (The heart holds wisdom…) |

## 알아두면 좋은 것

- **확장자가 다르면** (png 등) store.html 의 해당 `<img src>` 도 같이 고쳐야 합니다.
- **크기·비율은 맞추지 않아도 됩니다.** CSS 가 4:3 으로 잘라 맞춥니다 (`object-fit:cover`).
  다만 잘리는 걸 원치 않으면 가로세로 4:3 에 가깝게 준비하는 편이 안전합니다.
- 웹용이므로 긴 변 **1600px 이하**, 장당 **300KB 안팎**을 권합니다. 원본 인쇄용 파일은 너무 큽니다.
