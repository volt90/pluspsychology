# 갤러리 그림

`gallery.html`(로비)과 `rooms/*.html`(전시실)이 아래 파일명을 가리킵니다.
같은 이름으로 넣으면 그 액자가 채워지고, 없는 파일은 자리표시 이미지로 보입니다.

## 지금 들어 있는 것 — 캐릭터 (about.html 에서 꺼낸 것)

| 파일명 | 크기 | 쓰이는 곳 |
|---|---|---|
| `simri.png`          | 142×261 | 김심리의 방 액자 · 비전관 도슨트 · 로비 카드 |
| `simri-portrait.png` | 480×480 | 김심리의 방 대표 액자 |
| `seru.png`           | 287×383 | 세루의 방 액자·도슨트 · 로비 카드 |
| `ruby.png`           | 285×339 | 루비의 방 액자·도슨트 · 로비 카드 |
| `ar.png`             | 163×175 | 아르의 방 액자·도슨트 · 로비 카드 |

⚠️ **원본은 `about.html` 안에 base64 로 박혀 있습니다.** 여기 있는 것은 그것을
파일로 꺼낸 사본입니다. 캐릭터 그림을 바꿀 때 **두 곳을 함께** 고치세요.
크기가 작아서(가장 큰 것이 480px) 액자를 눌러 크게 봐도 원본 크기까지만 보입니다.
더 큰 그림이 생기면 같은 이름으로 덮어쓰면 됩니다.

## 아직 없는 것 — 넣으면 바로 걸립니다

| 파일명 | 무엇 |
|---|---|
| `room-simri.jpg` · `room-seru.jpg` · `room-ruby.jpg` · `room-ar.jpg` | 전시실 배경 사진/그림 (16:9) |
| `room-vision-2031.jpg` · `room-vision-2036.jpg` | 비전관 배경 (16:9) |

배경이 없으면 CSS 로 그린 벽·바닥이 대신 보입니다. 파일을 넣으면
`.room-bg` 가 그 위를 덮습니다. **16:9 가 아니면 잘립니다**(`object-fit:cover`).

## 액자를 더 걸거나 그림을 바꿀 때

각 방 파일의 `<figure class="frame">` 를 고칩니다.

```html
<figure class="frame" style="--x:8%;--y:13%;--w:21%;--ar:1/1"
        data-lb="room-simri" data-lb-cap="김심리 — 초상">
  <img src="/assets/img/gallery/simri-portrait.png" alt="…" data-en-alt="…" loading="lazy"
       onerror="this.onerror=null;this.src='/assets/img/placeholder.svg'">
  <figcaption data-en="Simri — Portrait">김심리 — 초상</figcaption>
</figure>
```

- 🚨 **`--x` · `--y` · `--w` 는 반드시 `%` 로 두세요.** px 로 바꾸면 화면 폭이
  달라질 때 액자가 벽 밖으로 나갑니다.
- `--w` 를 정할 때 벽 아래 **72% 부터는 바닥**이라는 걸 염두에 두세요.
  액자 높이는 `--w × 16/9 ÷ (--ar)` 만큼 세로로 내려옵니다.
- `data-lb` 값이 같은 액자끼리 묶여 크게 볼 때 ← → 로 넘어갑니다.
  방마다 다른 값(`room-<slug>`)을 씁니다.
- **자리표시(`placeholder.svg`)만 있는 액자는 눌러도 열리지 않습니다.** 일부러
  그렇게 돼 있습니다 (`assets/lightbox/lightbox.js`).
