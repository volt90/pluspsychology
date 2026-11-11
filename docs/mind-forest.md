# 고요한 숲 배포

- 공개 경로: `https://www.pluspsychology.ai/experience/mind-forest`
- 원본: `https://github.com/volt90/Forest_Interaction`
- 원본 커밋: `7d61c5694a8b76fde0c14cc157e9eec0237d5eea`
- 원본 압축 파일 Git blob: `a14705ee4b71c063ee27af455acf7100c6dccde0`

`experience/mind-forest.html`은 최신 단일 HTML에서 내장 자산 11개를 분리한 웹 배포본입니다. 그림·소리·모델·WASM의 바이트는 원본과 동일하며 `assets/mind-forest/` 아래에 있습니다. HTML의 변경은 내장 자산 저장소 제거와 자산 경로 변경뿐입니다. 인사 화면, 글꼴, 라이선스 고지, 입력과 애니메이션 로직은 유지합니다.

기존 `vercel.json`의 `cleanUrls: true` 설정으로 `.html` 없이 접근합니다. 기존 페이지·도메인 설정·메뉴·사이트맵은 변경하지 않습니다. 이 문서와 자동 검사는 기존 `.vercelignore`에 따라 배포에서 제외됩니다.

## 확인

```powershell
node --test tests/forest/*.test.cjs
node --test tests/bgm-qr.test.cjs
```

배포한 URL에서 시작 인사 → 조작 안내 → 시작하기, 카메라 허용/거부, 소리를 켠 상태의 네 캐릭터 반응, 손 이탈/복귀, 카메라 종료를 확인합니다. 카메라와 소리는 시작 버튼을 누르기 전에는 켜지지 않습니다.

원본을 다시 가져올 때에는 이 문서의 원본 커밋을 갱신하고 자산과 HTML을 함께 교체해야 합니다. ZIP 파일 자체를 정적 경로에 올리는 것으로는 체험 화면이 배포되지 않습니다.
