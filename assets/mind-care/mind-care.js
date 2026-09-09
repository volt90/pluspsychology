(function () {
  'use strict';
  const root = document.getElementById('simri-care');
  const content = document.getElementById('simri-care-content');
  if (!root || !content) return;
  const hero = "/assets/mind-care/friends.webp";
  const seruO = "/assets/mind-care/seru-o.webp";
  const rhubyX = "/assets/mind-care/rhuby-x.webp";
  const postcards = ["/assets/mind-care/01-rest.png","/assets/mind-care/02-connection.png","/assets/mind-care/03-sunlight.png","/assets/mind-care/04-self-expression.png","/assets/mind-care/05-meals.png","/assets/mind-care/06-sleep.png","/assets/mind-care/07-movement.png","/assets/mind-care/08-seeking-help.png"];
  const seruPortrait = hero;
  const areas = [
    {name:'휴식',color:'#F6D473',q:'해야 할 일에서 잠시 벗어나, 마음을 쉬게 할 틈이 있었어요.',action:'잠깐, 해야 할 일 내려놓기',tip:'가능하다면 3분만 편한 자세로 쉬어보세요.'},
    {name:'관계',color:'#F2A0AA',q:'누군가와 편안하게 연결되어 있다고 느꼈어요.',action:'편안한 사람 한 명 떠올리기',tip:'안부를 나누고 싶은 사람이 있나요? 부담이 적다면 짧은 메시지 한 줄을 건네볼 수 있어요.'},
    {name:'햇빛',color:'#95BFE2',q:'낮에 자연의 밝은 빛을 접할 기회가 있었어요.',action:'밝은 공간에 잠깐 머무르기',tip:'몸 상태와 생활 리듬에 맞는 시간에 밝은 공간에서 잠시 머물러 보세요.'},
    {name:'자기표현',color:'#9ECEA0',q:'내 마음을 말이나 글, 그림 등 편한 방식으로 표현할 수 있었어요.',action:'오늘 느낀 감정, 한 줄 남기기',tip:'“오늘은 이런 순간에 이런 마음이 들었어요.” 말이나 글, 그림 중 편한 방법을 골라보세요.'},
    {name:'식사',color:'#BCA4CC',q:'내 몸에 필요한 식사를 챙길 수 있었어요.',action:'식사 시간을 규칙적으로 챙기기',tip:'규칙적인 식사 시간을 지키기 위해 실천할 수 있는 방법을 찾아보세요.'},
    {name:'수면',color:'#F29C8F',q:'내게 필요한 잠을 잘 수 있었어요.',action:'기상 시간 일정하게 맞추기',tip:'평일과 주말에 일어나는 시간이 크게 달라지지 않도록, 나에게 맞는 기상 시간을 정해보세요.'},
    {name:'운동',color:'#B5D39B',q:'내 몸의 상태에 맞게 움직일 기회가 있었어요.',action:'스트레칭으로 몸 풀기',tip:'어깨와 팔, 다리를 천천히 늘려보세요. 통증이 느껴지지 않는 범위에서 부드럽게 움직여주세요.'},
    {name:'도움요청',color:'#8EA9D5',q:'도움이 필요할 때 연락할 사람이나 기관을 떠올릴 수 있었어요.',action:'도움을 청할 곳 하나 알아두기',tip:'믿을 만한 사람이나 가까운 상담기관을 떠올려 보세요.'}
  ];
  const labels = ['전혀 그렇지 않았어요','별로 그렇지 않았어요','보통이었어요','대체로 그랬어요','매우 그랬어요'];
  const shortLabels = ['전혀 아니었어요','별로 아니었어요','보통이었어요','대체로 그랬어요','매우 그랬어요'];
  const quiz = [
    {a:0,q:'쉬는 시간은 할 일을 모두 끝낸 뒤에만 가져야 해요.',answer:false,head:'할 일이 남아 있어도 쉴 수 있어요.',ex:'짧은 이완 활동이나 즐거운 취미를 위한 시간도 마음 돌봄의 한 방법이에요.',source:'NIMH · 마음 건강 돌보기',url:'https://www.nimh.nih.gov/health/topics/caring-for-your-mental-health'},
    {a:1,q:'정서적인 지지를 주고받는 관계는 마음 건강에 도움이 될 수 있어요.',answer:true,head:'편안한 연결이 힘이 될 수 있어요.',ex:'마음을 편하게 나누고 서로 의지할 수 있는 관계는 마음 건강에 도움이 될 수 있어요.',source:'NHS · 마음 건강을 위한 다섯 가지',url:'https://www.nhs.uk/mental-health/self-help/guides-tools-and-activities/five-steps-to-mental-wellbeing/'},
    {a:2,q:'햇빛만 충분히 쬐면 우울증을 치료할 수 있어요.',answer:false,head:'빛이 치료를 대신하지는 않아요.',ex:'낮의 빛은 생활 리듬을 돕지만 우울증 치료를 대신한다고 볼 수 없어요. 어려움이 지속되면 전문가와 상의할 수 있어요.',source:'NIMH · 우울증 이해하기',url:'https://www.nimh.nih.gov/health/publications/depression'},
    {a:3,q:'생각과 감정을 적어보는 것은 내 마음을 이해하는 데 도움이 될 수 있어요.',answer:true,head:'한 줄의 기록으로 돌아볼 수 있어요.',ex:'어떤 상황에서 어떤 생각과 감정이 생겼는지 적어보는 것은 마음을 살펴보는 한 방법이에요.',source:'NHS · 생각 기록하기',url:'https://www.nhs.uk/every-mind-matters/mental-wellbeing-tips/self-help-cbt-techniques/thought-record/'},
    {a:4,q:'식사 습관은 기분과 관계가 없어요.',answer:false,head:'규칙적인 식사는 기분 안정에 도움이 돼요.',ex:'끼니를 규칙적으로 챙기면 에너지를 꾸준히 공급해, 공복으로 피곤하거나 예민해지는 것을 줄이는 데 도움이 될 수 있어요.',source:'West London NHS · 음식과 기분',url:'https://www.westlondon.nhs.uk/ealing-talking-therapies/move-4-mood/eat-well-feel-well/how-food-and-drink-affects-my-mood'},
    {a:5,q:'불규칙하게 자거나 자는 시간을 줄여도 마음 건강에는 영향이 없다.',answer:false,head:'잠도 마음 돌봄의 한 부분이에요.',ex:'충분한 잠과 일정한 수면 습관은 마음 건강을 돌보는 데 중요해요.',source:'NIMH · 마음 건강 돌보기',url:'https://www.nimh.nih.gov/health/topics/caring-for-your-mental-health'},
    {a:6,q:'걷기 같은 신체활동은 우울감과 불안을 줄이는 데 도움이 될 수 있어요.',answer:true,head:'몸을 움직이는 것도 마음 돌봄이에요.',ex:'규칙적인 신체활동은 우울감과 불안 증상을 줄이는 데 도움이 될 수 있어요. 내 몸 상태에 맞는 작은 움직임부터 시작해 보세요.',source:'WHO · 신체활동',url:'https://www.who.int/news-room/fact-sheets/detail/physical-activity'},
    {a:7,q:'상담은 정신질환을 진단받은 사람만 이용할 수 있어요.',answer:false,head:'진단이 없어도 상담받을 수 있어요.',ex:'오래 지속되는 스트레스나 관계의 어려움 등 여러 이유로 상담을 받을 수 있어요. 힘들다는 사실만으로도 도움을 고려할 수 있어요.',source:'NIMH · 심리치료',url:'https://www.nimh.nih.gov/health/topics/psychotherapies'}
  ];
  const state = {screen:'home',index:0,answers:Array(8).fill(null),current:null,selected:0,quizIndex:0,quizAnswer:null,quizAnswers:Array(8).fill(null)};
  const design = {chart:'hearts',paper:'cream',radius:24};
  const art = () => `<div class="sc-avatar"><img src="${seruPortrait}" alt="세루"></div>`;
  const ensemble = () => `<div class="sc-ensemble"><img src="${hero}" alt="김심리, 아르, 루비, 세루가 나란히 함께 있어요"></div>`;
  const step = (name,idx,area) => `<div class="sc-step${area?' sc-step-with-tag':''}"><button type="button" class="sc-text-button" data-action="home">← 처음으로</button>${area?`<span class="sc-tag"><span style="color:${area.color}" aria-hidden="true">♥</span>${area.name}</span>`:''}<span class="sc-step-count">${name} ${String(idx+1).padStart(2,'0')} / 08</span></div><div class="sc-track" role="progressbar" aria-label="${name} 진행" aria-valuenow="${idx+1}" aria-valuemin="0" aria-valuemax="8"><span style="width:${(idx+1)*12.5}%"></span></div>`;
  function home(){return `<div class="sc-center"><p class="sc-kicker">8가지 마음 돌봄</p><h1>오늘 내 마음,<br><span class="sc-yellow">무엇이 필요할까요?</span></h1></div>${ensemble()}<button type="button" class="sc-choice" data-action="check"><span><strong>내 마음에 필요한 것 찾기</strong><small>최근 일주일의 생활을 돌아봐요.</small></span></button><button type="button" class="sc-choice" data-action="quiz"><span><strong>마음에 관한 OX 퀴즈</strong><small>알쏭달쏭한 마음 상식, 함께 알아보기</small></span></button><div class="sc-heart-ribbon" aria-hidden="true">${areas.map(a=>`<span style="color:${a.color}">♥</span>`).join('')}</div>`;}
  function check(){const a=areas[state.index];return `${step('퀴즈',state.index,a)}<div class="sc-question"><p class="sc-kicker">최근 7일을 떠올려 주세요</p><h2>${a.q}</h2></div><div class="sc-answers">${labels.map((label,i)=>`<button type="button" class="sc-answer" data-answer="${i}" aria-pressed="${state.current===i}"><span>${label}</span><span class="sc-radio" aria-hidden="true">${state.current===i?'✓':''}</span></button>`).join('')}</div><button type="button" class="sc-primary" data-action="next" ${state.current===null?'disabled':''}>${state.index===7?'엽서 추천받기':'다음으로'} →</button><div class="sc-step"><button type="button" class="sc-text-button" data-action="previous" ${state.index===0?'disabled':''}>이전 질문</button></div>`;}
  function heart(a,i,v,low){const id=`sc-heart-clip-${i}`;return `<button type="button" class="sc-heart-button" data-area="${i}" data-selected="${state.selected===i}" aria-label="${a.name}: ${v===null?'아직 돌아보지 않았어요':labels[v]}. ${a.name} 포스트카드 보기">${low.includes(i)?'<span class="sc-more">살펴볼 곳</span>':''}<svg viewBox="0 0 100 90" role="img" aria-label="${a.name} 응답 ${v===null?'없음':v+' / 4'}"><defs><clipPath id="${id}"><path d="M50 87C43 80 3 52 3 27C3 0 35 -5 50 18C65 -5 97 0 97 27C97 52 57 80 50 87Z"/></clipPath></defs><path d="M50 87C43 80 3 52 3 27C3 0 35 -5 50 18C65 -5 97 0 97 27C97 52 57 80 50 87Z" fill="${a.color}" opacity=".22"/>${v!==null?`<rect x="0" y="${87-(v/4)*87}" width="100" height="${(v/4)*87}" fill="${a.color}" clip-path="url(#${id})"/>`:''}</svg><strong>${a.name}</strong><small>${v===null?'아직 답하지 않았어요':shortLabels[v]}</small></button>`;}
  function result(){const values=state.answers;const valid=values.filter(v=>v!==null);const min=valid.length?Math.min(...valid):null;const low=min!==null&&min<3?values.flatMap((v,i)=>v===min?[i]:[]):[];let title=valid.length===0?'오늘 돌보고 싶은 곳을<br>자유롭게 골라보세요.':low.length>2?'여러 곳에 작은 돌봄이<br>필요했을 수 있어요.':low.length?`${low.map(i=>areas[i].name).join(' · ')}부터<br>살펴볼까요?`:'요즘 나를 지지해 준 것들,<br>계속 챙겨볼까요?';const a=areas[state.selected];return `<p class="sc-kicker">나의 8가지 돌봄</p><h2>${title}</h2><p class="sc-lead">최근 답변을 바탕으로 돌아본 모습이에요.<br>아래에서 돌보고 싶은 곳을 눌러보세요.</p>${design.chart==='hearts'?`<div class="sc-hearts">${areas.map((a,i)=>heart(a,i,values[i],low)).join('')}</div>`:`<div class="sc-bar-list">${areas.map((a,i)=>`<button type="button" class="sc-bar-row" data-area="${i}" data-selected="${state.selected===i}" aria-label="${a.name}: ${values[i]===null?'아직 돌아보지 않았어요':labels[values[i]]}. ${a.name} 포스트카드 보기"><strong>${a.name}</strong><span class="sc-bar-track">${[0,1,2,3].map(n=>`<i style="${values[i]!==null&&n<values[i]?'background:'+a.color:''}"></i>`).join('')}</span><small>${values[i]===null?'아직 답하지 않았어요':shortLabels[values[i]]}</small></button>`).join('')}</div>`}<div class="sc-friend">${art()}<p><strong>세루와 함께</strong>오늘은 하나만 골라도 괜찮아요.<br>지금 가능한 작은 것부터 살펴봐요.</p></div><button type="button" class="sc-primary" data-action="postcard">${a.name} 포스트카드 보기</button><button type="button" class="sc-secondary" data-action="quiz">마음에 관한 OX 퀴즈도 해보기 →</button>`;}
  const postcardCaptions = ['긴장을 풀고 마음에 여유를 줘요.','마음을 안정시키고 회복할 힘을 줘요.','아침 햇빛은 수면 리듬과 기분 조절을 도와요.','마음을 표현하면 내 감정을 이해하기 쉬워져요.','규칙적인 식사는 기분과 집중력 유지에 도움이 돼요.','규칙적인 수면은 기분 안정과 감정조절을 도와요.','스트레스를 줄이고 기분 전환을 도와요.','필요한 지지와 도움을 받는 첫걸음이에요.'];
  function postcardView(){const a=areas[state.selected];return `<div class="sc-step"><button type="button" class="sc-text-button" data-action="back-result">← 결과로 돌아가기</button></div><figure class="sc-postcard" aria-label="${a.name} 포스트카드"><img src="${postcards[state.selected]}" width="1205" height="1772" alt="${a.name}. ${postcardCaptions[state.selected]}"></figure><section class="sc-result-card" aria-label="${a.name} 추천 활동"><span class="sc-tag"><span style="color:${a.color}" aria-hidden="true">♥</span>오늘의 작은 돌봄</span><h3>${a.action}</h3><p>${a.tip}</p></section><button type="button" class="sc-secondary" data-action="quiz">마음에 관한 OX 퀴즈도 해보기 →</button>`;}
  function quizView(){const q=quiz[state.quizIndex],a=areas[q.a],done=state.quizAnswer!==null;return `${step('퀴즈',state.quizIndex,a)}<div class="sc-question sc-quiz-question"><h2>${q.q}</h2></div><div class="sc-ox"><button type="button" data-ox="true" aria-pressed="${state.quizAnswer===true}" ${done?'disabled':''}><span>O</span><small>맞아요</small><img class="sc-ox-art seru" src="${seruO}" alt="" aria-hidden="true"></button><button type="button" data-ox="false" aria-pressed="${state.quizAnswer===false}" ${done?'disabled':''}><span>X</span><small>아니에요</small><img class="sc-ox-art rhuby" src="${rhubyX}" alt="" aria-hidden="true"></button></div>${done?`<div class="sc-feedback" role="status"><p class="sc-kicker">정답 ${q.answer?'O':'X'}</p><h3>${q.head}</h3><p>${q.ex}</p></div><button type="button" class="sc-primary" data-action="quiz-next">${state.quizIndex===7?'함께 알아본 내용 보기':'다음 문제'} →</button>`:''}`;}
  function complete(){return `<div class="sc-center"><p class="sc-kicker">8가지 마음 상식을 함께 살펴봤어요</p><h1>새로 알게 된 것,<br>하나면 충분해요.</h1></div>${ensemble()}<div class="sc-result-card"><h3>마음 돌봄에는 여러 방법이 있어요.</h3><p>쉼과 연결, 표현과 도움 요청까지.<br>지금 나에게 맞는 것부터 골라보세요.</p></div><button type="button" class="sc-primary" data-action="check">내 마음에 필요한 것 찾기 →</button><button type="button" class="sc-secondary" data-action="home">처음으로</button>`;}

  // Answers stay in this tab's memory. Only navigation positions enter history.
  const visitId = Math.random().toString(36).slice(2);
  function render(focusHeading = false) {
    const views = {home, check, result, postcard: postcardView, quiz: quizView, complete};
    content.innerHTML = views[state.screen]();
    root.dataset.screen = state.screen;
    if (focusHeading) {
      const heading = content.querySelector('h1, h2, .sc-postcard, h3');
      if (heading) {
        heading.setAttribute('tabindex', '-1');
        heading.setAttribute('data-screen-heading', '');
        heading.focus({preventScroll: true});
      }
      window.scrollTo(0, 0);
    }
  }

  function historyPosition() {
    return {mindCare: true, visit: visitId, screen: state.screen, index: state.index,
      selected: state.selected, quizIndex: state.quizIndex};
  }

  function navigate(screen, replace = false) {
    state.screen = screen;
    history[replace ? 'replaceState' : 'pushState'](historyPosition(), '');
    render(true);
  }

  function begin(screen) {
    if (screen === 'check') {
      state.index = 0;
      state.current = state.answers[0];
    } else if (screen === 'quiz') {
      state.quizIndex = 0;
      state.quizAnswer = null;
      state.quizAnswers = Array(8).fill(null);
    }
    navigate(screen);
  }

  function advance() {
    if (state.current === null) return;
    state.answers[state.index] = state.current;
    if (state.index < 7) {
      state.index++;
      state.current = state.answers[state.index];
      navigate('check');
    } else {
      const missing = state.answers.indexOf(null);
      if (missing !== -1) {
        state.index = missing;
        state.current = null;
        navigate('check');
        return;
      }
      state.selected = state.answers.indexOf(Math.min(...state.answers));
      navigate('result');
    }
  }

  root.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    if (button.dataset.answer !== undefined) {
      state.current = Number(button.dataset.answer);
      state.answers[state.index] = state.current;
      render();
      content.querySelector(`[data-answer="${state.current}"]`).focus({preventScroll: true});
      return;
    }
    if (button.dataset.area !== undefined) {
      state.selected = Number(button.dataset.area);
      // Keep the chosen card selected when browser Back returns to the result.
      history.replaceState(historyPosition(), '');
      navigate('postcard');
      return;
    }
    if (button.dataset.ox !== undefined) {
      state.quizAnswer = button.dataset.ox === 'true';
      state.quizAnswers[state.quizIndex] = state.quizAnswer;
      render();
      const feedback = content.querySelector('.sc-feedback');
      feedback.setAttribute('tabindex', '-1');
      feedback.focus({preventScroll: true});
      return;
    }
    const action = button.dataset.action;
    if (action === 'home' || action === 'check' || action === 'quiz') {
      begin(action);
    } else if (action === 'next') {
      advance();
    } else if (action === 'previous' && state.index > 0) {
      state.index--;
      state.current = state.answers[state.index];
      navigate('check', true);
    } else if (action === 'postcard') {
      navigate('postcard');
    } else if (action === 'back-result') {
      history.back();
    } else if (action === 'quiz-next') {
      if (state.quizIndex < 7) {
        state.quizIndex++;
        state.quizAnswer = state.quizAnswers[state.quizIndex];
        navigate('quiz');
      } else {
        navigate('complete');
      }
    }
  });

  window.addEventListener('popstate', event => {
    const position = event.state;
    if (!position || !position.mindCare) return;
    // A reload deliberately discards answers. Older history must not skip questions.
    if (position.visit !== visitId) {
      state.screen = 'home';
      state.index = 0;
      state.quizIndex = 0;
      state.current = state.answers[0];
      state.quizAnswer = null;
      history.replaceState(historyPosition(), '');
      render(true);
      return;
    }
    const allowed = ['home','check','result','postcard','quiz','complete'];
    state.screen = allowed.includes(position.screen) ? position.screen : 'home';
    state.index = Number.isInteger(position.index) ? Math.max(0, Math.min(7, position.index)) : 0;
    state.selected = Number.isInteger(position.selected) ? Math.max(0, Math.min(7, position.selected)) : 0;
    state.quizIndex = Number.isInteger(position.quizIndex) ? Math.max(0, Math.min(7, position.quizIndex)) : 0;
    state.current = state.answers[state.index];
    state.quizAnswer = state.quizAnswers[state.quizIndex];
    if (['result', 'postcard'].includes(state.screen) && state.answers.some(value => value === null)) {
      state.screen = 'home';
    }
    render(true);
  });

  history.replaceState(historyPosition(), '');
  render();
})();
