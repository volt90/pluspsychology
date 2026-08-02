// ============================================================
//  /api/public-config.js  —  브라우저가 로그인에 쓸 공개 설정
//  admin.html · login.html · account.html 이 함께 씁니다.
//
//  내려주는 값은 **anon 키와 프로젝트 URL 두 개뿐**입니다.
//  둘 다 공개돼도 되는 값입니다 — 모바일 앱 바이너리에도 들어 있고,
//  RLS 정책을 하나도 만들지 않았기 때문에 anon 키로는 아무 표도 못 읽습니다.
//
//  🔒 service_role 키는 절대 여기에 넣지 마세요.
//     그 키는 RLS 를 통째로 우회하므로 노출되면 명단 전체가 털립니다.
//     서버 코드(api/admin-stats.js)에서만 씁니다.
//
//  저장소에 키를 직접 박지 않고 이 경로로 받아가는 이유는,
//  키를 바꿀 때 코드 수정 없이 Vercel 환경변수만 고치면 되게 하려는 것입니다.
// ============================================================

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const anon = process.env.SUPABASE_ANON_KEY || '';

  if (!url || !anon) {
    return res.status(503).json({ error: 'Not configured' });
  }
  return res.status(200).json({ supabaseUrl: url, anonKey: anon });
}
