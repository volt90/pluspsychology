# Supabase 인증 메일 한국어 템플릿

Supabase 기본 인증 메일은 영어입니다. 아래를 대시보드에 붙여넣어 한국어로 바꿉니다.

**위치**: Supabase → **Authentication → Emails** (또는 Email Templates)

---

## 0. 먼저 — 리다이렉트 주소부터 고치세요

템플릿보다 이게 급합니다. 기본값이 `http://localhost:3000`이라 인증 링크를 누르면
**"사이트에 연결할 수 없음"** 이 뜹니다.

**Authentication → URL Configuration**

| 항목 | 값 |
|---|---|
| Site URL | `https://www.pluspsychology.ai/confirm.html` |
| Redirect URLs | `https://www.pluspsychology.ai/confirm.html`<br>`world.kimsimri.app://login-callback` |

`confirm.html`은 이 저장소의 한국어 인증 완료 페이지입니다. 성공하면
"이메일 인증이 완료되었어요 → 앱으로 돌아가기", 링크가 만료됐으면 그에 맞는 안내를 보여줍니다.

---

## 1. Confirm signup (가입 확인)

**Subject**
```
[김심리월드] 이메일 주소를 확인해주세요
```

**Message body (HTML)**
```html
<div style="font-family:'Apple SD Gothic Neo',Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px 24px;background:#FBF6EA;color:#2B2620;line-height:1.7">
  <h1 style="font-size:20px;margin:0 0 14px">이메일 주소를 확인해주세요</h1>
  <p style="font-size:14px;color:#6E6658;margin:0 0 12px">
    김심리월드에 오신 것을 환영해요.<br>
    아래 버튼을 눌러 인증을 마치면 바로 시작하실 수 있어요.
  </p>
  <p style="margin:24px 0">
    <a href="{{ .ConfirmationURL }}"
       style="display:inline-block;background:#4C8CCB;color:#fff;text-decoration:none;
              font-weight:700;font-size:15px;padding:13px 26px;border-radius:12px">
      이메일 인증하기
    </a>
  </p>
  <p style="font-size:12.5px;color:#A79E8E;margin:0 0 4px">
    버튼이 눌리지 않으면 아래 주소를 복사해 브라우저에 붙여넣어 주세요.
  </p>
  <p style="font-size:12px;color:#A79E8E;word-break:break-all;margin:0">
    {{ .ConfirmationURL }}
  </p>
  <p style="font-size:12px;color:#A79E8E;margin:22px 0 0;border-top:1px solid #ECE2CD;padding-top:14px">
    본인이 요청하지 않았다면 이 메일은 무시하셔도 됩니다.<br>
    ⓒ 2025 SIMRI KIM · 김심리월드
  </p>
</div>
```

---

## 2. Magic Link (쓰게 될 경우)

**Subject**
```
[김심리월드] 로그인 링크입니다
```
본문은 위 HTML에서 제목을 "로그인 링크입니다", 버튼 문구를 "로그인하기"로 바꾸면 됩니다.

## 3. Reset Password (비밀번호 재설정)

**Subject**
```
[김심리월드] 비밀번호 재설정 안내
```
제목을 "비밀번호를 재설정해주세요", 버튼 문구를 "비밀번호 재설정하기",
안내 문구를 "아래 버튼을 눌러 새 비밀번호를 설정해주세요"로 바꾸면 됩니다.

---

## 주의

- `{{ .ConfirmationURL }}` 은 Supabase가 치환하는 변수입니다. **철자를 바꾸지 마세요.**
- 인증 메일은 **광고성 정보가 아니므로** `(광고)` 표기가 필요 없습니다.
  랜딩의 출시 알림 메일과는 성격이 다릅니다.
- 발신 주소는 Resend에서 인증한 도메인이어야 합니다 (`noreply@pluspsychology.ai`).
