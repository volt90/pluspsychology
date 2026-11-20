# 마음 투표 운영

- 참여 주소는 `/vote/<slug>`, 공유할 결과 주소는 `/vote/<slug>/results`입니다. `/vote`에서 진행 중인 투표와 지난 투표를 볼 수 있습니다.
- 마감하려면 `vote/polls.json`에서 해당 투표의 `open`을 `false`로 바꾸고 아래 생성 명령을 실행한 뒤 변경 사항을 배포하세요. 새 표 접수가 멈추고 기존 결과는 그대로 열립니다.
- 새 투표를 추가할 때는 같은 파일에 새 `slug`의 항목을 추가합니다. 선택지의 `id`와 투표의 `slug`는 저장된 표를 식별하므로, 참여가 시작되면 그대로 유지하세요. `art`는 `vote/assets`의 PNG 파일 이름(확장자 제외)입니다. 결과 소개는 `resultsIntro`와 `resultsIntroEn`에 적습니다. 공유 카드는 같은 폴더의 `share-<slug>.png`(1200×630)를 사용하며 `shareImage`로 다른 파일을 지정할 수 있습니다. 생성 후 새 참여·결과 주소도 `sitemap.xml`에 추가합니다.

```sh
node scripts/build-votes.cjs
node --test tests/vote.test.cjs
```

득표는 기존 사이트의 Supabase 서버 연결을 통해 비공개 버킷에 저장합니다. 로그인 없이 브라우저 쿠키로 투표별 첫 선택을 기억합니다. 새 브라우저나 쿠키 삭제 후에는 새 참여자로 인식합니다.
