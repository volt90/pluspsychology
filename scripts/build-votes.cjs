// Rebuild the static, shareable URLs after editing vote/polls.json.
// The site header and its mobile layout come from the existing Projects page.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const site = fs.readFileSync(path.join(root, 'projects.html'), 'utf8');
const polls = require('../vote/polls.json');
const base = 'https://www.pluspsychology.ai';
const css = site.split('<style>')[1].split('/* ---------- shared ---------- */')[0];
const header = site.match(/<header class="siteheader">[\s\S]*?<\/header>/)[0]
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/src="data:image\/png;base64,[^"]+"/, 'src="/vote/assets/logo.png"')
  .replace('class="hdr rv"', 'class="hdr"')
  .replace('aria-current="page"', 'aria-current="location"');
const fonts = site.match(/<link rel="preconnect"[\s\S]*?display=swap" rel="stylesheet">/)[0];
const escape = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const translated = (ko, en) => '<span data-en="' + escape(en) + '">' + escape(ko) + '</span>';
const archiveTitle = '마음 투표';
const archiveDesc = '김심리월드의 질문에 포스트잇 한 장으로 답하고, 함께 모인 마음을 들여다보세요.';
function write(file, value) {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), {recursive:true});
  fs.writeFileSync(target, value.replace(/[ \t]+$/gm, ''));
}
write('vote/chrome.css', css.trim().replace(/\/\*[\s\S]*?\*\//g, '').trim() + '\n');
function page(poll, results = false) {
  const slug = poll?.slug;
  const url = '/vote' + (slug ? '/' + slug : '') + (results ? '/results' : '');
  const name = poll ? poll.title + (results ? ' · 투표 결과' : '') : archiveTitle;
  const nameEn = poll ? poll.titleEn + (results ? ' · Results' : '') : 'Heart notes';
  const title = name + ' | 김심리월드';
  const desc = results ? poll.resultsDescription || poll.resultsIntro : poll?.prompt || archiveDesc;
  const shareImage = poll ? poll.shareImage || `share-${slug}.png` : 'share-archive.png';
  const crumbs = [['Home', '/', 'Home'], [archiveTitle, '/vote', 'Heart notes']];
  if (poll) crumbs.push([poll.title, '/vote/' + slug, poll.titleEn]);
  if (results) crumbs.push(['투표 결과', url, 'Results']);
  const breadcrumb = crumbs.map(([label, href, en], i) => (i ? '<span class="sep" aria-hidden="true">/</span>' : '') +
    (i === crumbs.length-1 ? '<span aria-current="page">' + translated(label,en) + '</span>' : '<a href="' + href + '">' + translated(label,en) + '</a>')).join('');
  const schema = {'@context':'https://schema.org','@type':'BreadcrumbList', itemListElement:crumbs.map(([name, href], i) => ({'@type':'ListItem',position:i+1,name,item:base+href}))};
  const status = poll?.open ? translated('진행중','Open') : translated('종료','Closed');
  const main = poll ? `<section class="intro" aria-labelledby="question">
      <div class="intro-copy"><div class="poll-status ${poll.open ? '' : 'closed'}">${status}</div>
        <h1 id="question">${translated(poll.title, poll.titleEn)}</h1>
        <p>${results ? translated(poll.resultsIntro, poll.resultsIntroEn) : translated(poll.prompt,poll.promptEn)}</p>
      </div>
      <div class="friends-art" aria-hidden="true"><i></i><img class="simri" src="/vote/assets/simri.png" alt=""><img class="aru" src="/vote/assets/aru.png" alt=""><b>✦</b></div>
    </section>
    <div id="board"></div>
    <div class="under-board"><a href="/vote">${translated('모든 마음 투표','All polls')}</a><button type="button" id="share">${translated('결과 공유하기','Share results')}</button></div>
    <div id="share-notice" role="status"></div>
    <div id="manual-share" hidden><label for="result-url">${translated('결과 링크','Result link')}</label><input id="result-url" readonly></div>` :
    '<div id="archive"><h1>마음 투표</h1></div>';
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(title)}</title><meta name="description" content="${escape(desc)}"><meta name="theme-color" content="#FBF6EA">
<link rel="canonical" href="${base+url}"><meta property="og:type" content="website"><meta property="og:site_name" content="김심리월드"><meta property="og:locale" content="ko_KR">
<meta property="og:url" content="${base+url}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(desc)}"><meta property="og:image" content="${base}/vote/assets/${shareImage}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(title)}"><meta name="twitter:description" content="${escape(desc)}"><meta name="twitter:image" content="${base}/vote/assets/${shareImage}">
${fonts}
<link rel="stylesheet" href="/vote/chrome.css"><link rel="stylesheet" href="/vote/board.css">${poll ? '' : '<link rel="stylesheet" href="/vote/art.css"><link rel="stylesheet" href="/vote/archive.css">'}
<link rel="stylesheet" href="/assets/bgm/bgm.css"><script type="application/ld+json">${JSON.stringify(schema).replace(/</g,'\\u003c')}</script>
</head><body data-poll="${slug || ''}" data-view="${poll ? results ? 'results' : 'vote' : 'archive'}" data-title-en="${escape(nameEn)} | Kim Simri World">
${header}
<main class="page"><nav class="crumb" aria-label="현재 위치" data-en-aria="Breadcrumb">${breadcrumb}</nav>
${main}<noscript>마음 투표에 참여하려면 브라우저에서 자바스크립트를 켜 주세요.</noscript>
</main>
<footer class="vote-footer"><div><img src="/vote/assets/logo.png" alt="김심리월드" data-en-alt="Kim Simri World"><span>© SIMRI KIM</span></div><nav><a href="/privacy">${translated('개인정보처리방침','Privacy')}</a><a href="/terms">${translated('이용약관','Terms')}</a></nav></footer>
<script type="module" src="/vote/app.js"></script><script defer src="/assets/bgm/bgm.js"></script></body></html>\n`;
}
write('vote.html',page(null));
for (const poll of polls) {
  if (!/^[a-z0-9-]+$/.test(poll.slug)) throw new Error('Invalid poll slug');
  write('vote/' + poll.slug + '.html',page(poll));
  write('vote/' + poll.slug + '/results.html',page(poll,true));
}
