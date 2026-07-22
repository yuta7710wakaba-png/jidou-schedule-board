(() => {
  "use strict";

  const QUESTIONS = {
    intro: [
      'すきなたべものは？','すきなのみものは？','すきなくだものは？','すきなおやつは？','すきなどうぶつは？',
      'すきなのりものは？','すきないろは？','おなまえを おしえてね','なんさいかな？','すきなえほんは？'
    ],
    challenge: [
      '10まで かぞえよう','5まで うしろから かぞえよう','あいうえおを いってみよう','Good morning! と いってみよう',
      'ジャンプ 5かい','かたあしだち 5びょう','つまさきで たってみよう','ぐるっと 1かい まわろう',
      'いぬの まねを してみよう','ねこの まねを してみよう'
    ],
    sst: [
      'おもちゃを かりたい。なんて いう？','いっしょに あそびたい。なんて いう？','おともだちと ぶつかった。なんて いう？',
      'おかたづけの じかん。どうする？','おもちゃを こわしちゃった。どうする？','ごはんを たべるときの あいさつは？',
      'ごはんを たべおわったときの あいさつは？','おともだちが おもちゃを かしてくれた。なんて いう？',
      'あさ おきたときの あいさつは？','となりの おともだちの なまえを よんでみよう'
    ],
    event: [
      { text:'1かい おやすみ', effect:'skip', hint:'つぎの じゅんばんは おやすみです' },
      { text:'2ます もどる', effect:'back2', hint:'こまを 2ます もどします' },
      { text:'1ます すすめる', effect:'forward1', hint:'こまを 1ます すすめます' },
      { text:'もういちど サイコロを ふろう', effect:'again', hint:'おだいの あとに もういちど ふれます' },
      { text:'みんなで はくしゅ', effect:'clap', hint:'みんなで パチパチ！' },
      { text:'なにがでるかな？', effect:'randomQuestion', hint:'ほかの おだいカードを 1まい えらびます' }
    ]
  };


  const ICON_IMAGES = {
    intro: "icon_intro.png",
    sst: "icon_sst.png",
    challenge: "icon_challenge.png",
    event: "icon_event.png",
    start: "icon_start.png",
    goal: "icon_goal.png"
  };

  const CATEGORY = {
    start:{icon:"🚩",label:"スタート",color:"#fff7cf"},
    intro:{icon:"👤",label:"自己紹介",color:"#ffe7a3"},
    event:{icon:"⭐",label:"イベント",color:"#ffc4d6"},
    sst:{icon:"💬",label:"SST",color:"#bfe8ff"},
    challenge:{icon:"🎵",label:"チャレンジ",color:"#ccefc5"},
    goal:{icon:"🏁",label:"ゴール",color:"#fff7cf"}
  };

  // 5×4の課題マスを蛇行し、その前後にスタート・ゴールを置く。
  const SPACE_TYPES = [
    "start",
    "intro","sst","challenge","event","intro",
    "sst","challenge","event","intro","sst",
    "challenge","event","intro","sst","challenge",
    "event","intro","sst","challenge","event",
    "goal"
  ];

  const COLORS = ["#e76f51","#4387d6","#62a96b","#8e68c7","#e3a928"];
  const SYMBOLS = ["●","▲","■","★","◆"];

  const els = {
    board: document.getElementById("board"),
    boardWrap: document.getElementById("boardWrap"),
    routeLine: document.getElementById("routeLine"),
    tokens: document.getElementById("tokens"),
    playerList: document.getElementById("playerList"),
    hint: document.getElementById("hint"),
    setup: document.getElementById("setupOverlay"),
    playerCount: document.getElementById("playerCount"),
    nameInputs: document.getElementById("nameInputs"),
    startBtn: document.getElementById("startBtn"),
    diceOverlay: document.getElementById("diceOverlay"),
    bigDie: document.getElementById("bigDie"),
    dicePlayerName: document.getElementById("dicePlayerName"),
    diceMessage: document.getElementById("diceMessage"),
    confirmOverlay: document.getElementById("confirmOverlay"),
    confirmDie: document.getElementById("confirmDie"),
    confirmName: document.getElementById("confirmName"),
    shuffleOverlay: document.getElementById("shuffleOverlay"),
    shuffleCards: [...document.querySelectorAll(".shuffle-card")],
    promptOverlay: document.getElementById("promptOverlay"),
    promptBadge: document.getElementById("promptBadge"),
    promptText: document.getElementById("promptText"),
    closePromptBtn: document.getElementById("closePromptBtn"),
    nextOverlay: document.getElementById("nextOverlay"),
    nextName: document.getElementById("nextName"),
    goalOverlay: document.getElementById("goalOverlay"),
    goalName: document.getElementById("goalName"),
    settingsBtn: document.getElementById("settingsBtn"),
    resetBtn: document.getElementById("resetBtn")
  };

  let players = [];
  let current = 0;
  let state = "setup";
  let pendingRoll = 1;
  let soundOn = false;
  let audioCtx = null;
  let lastQuestion = {};
  let pendingEvent = null;
  let extraTurn = false;

  function makeBoard(){
    els.board.innerHTML = "";
    SPACE_TYPES.forEach((type,index) => {
      const s = document.createElement("div");
      s.className = `space ${type}`;
      s.dataset.index = index;
      s.style.setProperty("--tilt", `${[-2,1,-1,2,0][index%5]}deg`);
      const info = CATEGORY[type];
      if(type === "start" || type === "goal"){
        s.innerHTML = `<img class="endpoint-icon" src="${ICON_IMAGES[type]}" alt="${info.label}">`;
      } else {
        s.innerHTML = `<div class="icon" aria-label="${info.label}">
          <img class="category-icon-img" src="${ICON_IMAGES[type]}" alt="">
        </div>`;
      }
      const pos = gridPosition(index);
      s.style.gridColumn = pos.col;
      s.style.gridRow = pos.row;
      els.board.appendChild(s);
    });
    requestAnimationFrame(drawRoute);
  }

  // 各段5枚の課題カード。スタートは左上、ゴールは左下に配置。
  function gridPosition(index){
    const rows = [
      [0,1,2,3,4,5],
      [10,9,8,7,6],
      [11,12,13,14,15],
      [21,20,19,18,17,16]
    ];
    for(let r=0;r<rows.length;r++){
      const c = rows[r].indexOf(index);
      if(c !== -1) return {row:r+1,col:c+1};
    }
    return {row:1,col:1};
  }

  function centers(){
    const wrap = els.boardWrap.getBoundingClientRect();
    return [...els.board.children].map(space => {
      const r = space.getBoundingClientRect();
      return {x:r.left-wrap.left+r.width/2,y:r.top-wrap.top+r.height/2};
    });
  }

  function routePath(pts){
    if(!pts.length) return "";
    const parts = [`M ${pts[0].x} ${pts[0].y}`];

    for(let i=1;i<pts.length;i++){
      const a = pts[i-1];
      const b = pts[i];

      // Start込み6→7マス目：右側へふくらむ緩やかなカーブ
      if(i === 6){
        const bulge = Math.max(34, els.boardWrap.clientWidth * .045);
        parts.push(
          `C ${a.x + bulge} ${a.y + (b.y-a.y)*.22}, ` +
          `${b.x + bulge} ${a.y + (b.y-a.y)*.78}, ${b.x} ${b.y}`
        );
        continue;
      }

      // 16→17マス目：斜め直線ではなく、外側へ回り込むカーブ
      if(i === 16){
        const bulgeX = Math.max(36, els.boardWrap.clientWidth * .05);
        const midY = a.y + (b.y-a.y)*.52;
        parts.push(
          `C ${a.x + bulgeX} ${a.y + (b.y-a.y)*.12}, ` +
          `${b.x + bulgeX} ${midY}, ${b.x} ${b.y}`
        );
        continue;
      }

      parts.push(`L ${b.x} ${b.y}`);
    }
    return parts.join(" ");
  }

  function drawRoute(){
    const pts = centers();
    const w = els.boardWrap.clientWidth;
    const h = els.boardWrap.clientHeight;
    const d = routePath(pts);
    els.routeLine.setAttribute("viewBox",`0 0 ${w} ${h}`);
    els.routeLine.innerHTML = `
      <path d="${d}"
        fill="none" stroke="#a4815d" stroke-width="${Math.max(22,w*.034)}"
        stroke-linecap="round" stroke-linejoin="round" opacity=".42"/>
      <path d="${d}"
        fill="none" stroke="#f4d7a7" stroke-width="${Math.max(12,w*.021)}"
        stroke-linecap="round" stroke-linejoin="round" opacity=".76"/>
    `;
    updateAllTokens(false);
  }

  function renderNameInputs(){
    const count = Number(els.playerCount.value);
    const saved = [...els.nameInputs.querySelectorAll("input")].map(i=>i.value);
    els.nameInputs.innerHTML = "";
    for(let i=0;i<count;i++){
      const row = document.createElement("div");
      row.className = "setup-row";
      row.style.gridTemplateColumns = "1fr";
      row.innerHTML = `<label>プレイヤー${i+1}
        <input maxlength="10" value="${escapeHtml(saved[i] || `プレイヤー${i+1}`)}" aria-label="プレイヤー${i+1}の名前">
      </label>`;
      els.nameInputs.appendChild(row);
    }
  }

  function beginGame(){
    const names = [...els.nameInputs.querySelectorAll("input")]
      .map((i,n)=>i.value.trim() || `プレイヤー${n+1}`);
    players = names.map((name,i)=>({name,pos:0,finished:false,skip:false,color:COLORS[i],symbol:SYMBOLS[i]}));
    current = 0;
    lastQuestion = {};
    els.tokens.innerHTML = "";
    players.forEach((p,i)=>{
      const t = document.createElement("div");
      t.className = "token";
      t.id = `token-${i}`;
      t.style.background = p.color;
      t.textContent = p.symbol;
      els.tokens.appendChild(t);
    });
    renderPlayers();
    updateAllTokens(false);
    els.setup.classList.remove("show");
    state = "ready";
    setHint("画面をタップしてサイコロを振ろう");
  }

  function renderPlayers(){
    els.playerList.innerHTML = "";
    players.forEach((p,i)=>{
      const card = document.createElement("div");
      card.className = `player-card ${i===current && !p.finished ? "active":""} ${p.finished?"finished":""}`;
      card.innerHTML = `
        <div class="player-dot" style="background:${p.color}"></div>
        <div>
          <div class="player-name">${escapeHtml(p.name)}</div>
          <div class="status">${p.finished ? "ゴール！" : "すすんでいます"}</div>
        </div>
        <div class="turn-chip">いま</div>`;
      els.playerList.appendChild(card);
    });
  }

  function tokenOffset(playerIndex){
    const presets = [
      [{x:0,y:0}],
      [{x:-12,y:0},{x:12,y:0}],
      [{x:-13,y:-3},{x:13,y:-3},{x:0,y:12}],
      [{x:-14,y:-9},{x:14,y:-9},{x:-14,y:12},{x:14,y:12}],
      [{x:-17,y:-10},{x:0,y:-13},{x:17,y:-10},{x:-10,y:13},{x:10,y:13}]
    ];
    return presets[Math.min(players.length,5)-1][playerIndex] || {x:0,y:0};
  }

  function updateAllTokens(animate=true){
    if(!players.length) return;
    const pts = centers();
    players.forEach((p,i)=>{
      const token = document.getElementById(`token-${i}`);
      if(!token || !pts[p.pos]) return;
      const off = tokenOffset(i);
      token.style.transitionDuration = animate ? ".42s" : "0s";
      token.style.setProperty("--x",`${pts[p.pos].x+off.x}px`);
      token.style.setProperty("--y",`${pts[p.pos].y+off.y}px`);
    });
  }

  async function rollDice(){
    if(state !== "ready" || players[current]?.finished) return;
    state = "rolling";
    setHint("",true);
    els.dicePlayerName.textContent = `${players[current].name}さん`;
    els.diceMessage.textContent = "サイコロを振っています…";
    els.diceOverlay.classList.add("show");
    els.bigDie.classList.add("rolling");

    const cycles = 15;
    for(let i=0;i<cycles;i++){
      const n = 1 + Math.floor(Math.random()*6);
      setDie(els.bigDie,n);
      tone(270 + n*35,.04);
      await sleep(65 + i*7);
    }
    pendingRoll = 1 + Math.floor(Math.random()*6);
    setDie(els.bigDie,pendingRoll);
    els.bigDie.classList.remove("rolling");
    els.diceMessage.textContent = "でた！";
    tone(660,.12);
    await sleep(800);

    els.diceOverlay.classList.remove("show");
    els.confirmName.textContent = `${players[current].name}さん`;
    setDie(els.confirmDie,pendingRoll);
    els.confirmOverlay.classList.add("show");
    state = "confirm";
  }

  async function moveCurrent(){
    if(state !== "confirm") return;
    state = "moving";
    els.confirmOverlay.classList.remove("show");
    const p = players[current];
    const target = Math.min(SPACE_TYPES.length-1,p.pos+pendingRoll);
    while(p.pos < target){
      p.pos++;
      const token = document.getElementById(`token-${current}`);
      updateAllTokens(true);
      token.classList.remove("pulse");
      void token.offsetWidth;
      token.classList.add("pulse");
      tone(370 + p.pos*7,.07);
      await sleep(500);
    }
    renderPlayers();
    if(p.pos === SPACE_TYPES.length-1){
      p.finished = true;
      renderPlayers();
      els.goalName.textContent = `${p.name}さん`;
      els.goalOverlay.classList.add("show");
      tone(523,.12); await sleep(180); tone(659,.12); await sleep(180); tone(784,.24);
      await sleep(2200);
      els.goalOverlay.classList.remove("show");
      await advanceTurn();
      return;
    }
    await showShuffleAndPrompt(SPACE_TYPES[p.pos]);
  }

  async function showShuffle(type, mixed=false){
    state = "shuffle";
    els.shuffleCards.forEach((card,i)=>{
      const cardType = mixed ? ["intro","sst","challenge"][i%3] : type;
      card.style.setProperty("--card-color",CATEGORY[cardType].color);
    });
    els.shuffleOverlay.classList.add("show");
    for(let i=0;i<10;i++){ tone(260+(i%4)*45,.035); await sleep(500); }
    els.shuffleOverlay.classList.remove("show");
  }

  async function showShuffleAndPrompt(type){
    await showShuffle(type,false);

    if(type === "event"){
      const event = chooseQuestion("event");
      if(event.effect === "randomQuestion"){
        els.promptBadge.innerHTML = `<img class="prompt-category-icon" src="${ICON_IMAGES.event}" alt="">${CATEGORY.event.label}`;
        els.promptBadge.style.background = CATEGORY.event.color;
        els.promptText.textContent = event.text;
        els.promptOverlay.classList.add("show");
        tone(620,.12);
        await sleep(1200);
        els.promptOverlay.classList.remove("show");
        await showShuffle("event",true);
        const randomType = ["intro","sst","challenge"][Math.floor(Math.random()*3)];
        const q = chooseQuestion(randomType);
        pendingEvent = null;
        showPrompt(randomType,q);
        return;
      }
      pendingEvent = event;
      showPrompt("event",event.text);
      return;
    }

    pendingEvent = null;
    showPrompt(type,chooseQuestion(type));
  }

  function showPrompt(type,text){
    els.promptBadge.innerHTML = `<img class="prompt-category-icon" src="${ICON_IMAGES[type]}" alt="">${CATEGORY[type].label}`;
    els.promptBadge.style.background = CATEGORY[type].color;
    els.promptText.textContent = text;
    els.promptOverlay.classList.add("show");
    state = "prompt";
    tone(620,.12);
  }

  function chooseQuestion(type){
    const list = QUESTIONS[type] || ["みんなで考えてみよう。"];
    let idx = Math.floor(Math.random()*list.length);
    if(list.length > 1 && lastQuestion[type] === idx) idx = (idx+1)%list.length;
    lastQuestion[type] = idx;
    return list[idx];
  }

  async function applyEventEffect(event){
    if(!event) return;
    const p = players[current];
    if(event.effect === "skip") p.skip = true;
    if(event.effect === "again") extraTurn = true;
    if(event.effect === "back2"){
      const target = Math.max(0,p.pos-2);
      while(p.pos > target){ p.pos--; updateAllTokens(true); tone(330,.07); await sleep(500); }
    }
    if(event.effect === "forward1"){
      const target = Math.min(SPACE_TYPES.length-1,p.pos+1);
      while(p.pos < target){ p.pos++; updateAllTokens(true); tone(430,.07); await sleep(500); }
      if(p.pos === SPACE_TYPES.length-1) p.finished = true;
    }
    renderPlayers();
  }

  async function closePrompt(){
    if(state !== "prompt") return;
    els.promptOverlay.classList.remove("show");
    state = "transition";
    const event = pendingEvent;
    pendingEvent = null;
    await applyEventEffect(event);
    if(players[current].finished){
      els.goalName.textContent = `${players[current].name}さん`;
      els.goalOverlay.classList.add("show");
      await sleep(2200);
      els.goalOverlay.classList.remove("show");
    }
    await advanceTurn();
  }

  async function advanceTurn(){
    state = "transition";
    if(players.every(p=>p.finished)){
      els.nextName.textContent = "みんなゴール！";
      els.nextOverlay.classList.add("show");
      await sleep(3000);
      els.nextOverlay.classList.remove("show");
      state = "ended";
      setHint("おつかれさまでした！");
      return;
    }

    if(extraTurn && !players[current].finished){
      extraTurn = false;
      els.nextName.textContent = `${players[current].name}さん もういちど！`;
      els.nextOverlay.classList.add("show");
      await sleep(2500);
      els.nextOverlay.classList.remove("show");
      state = "ready";
      setHint("画面をタップしてサイコロを振ろう");
      return;
    }

    do{
      current = (current + 1) % players.length;
      if(players[current].skip && !players[current].finished){
        players[current].skip = false;
        renderPlayers();
        els.nextName.textContent = `${players[current].name}さんは おやすみ`;
        els.nextOverlay.classList.add("show");
        await sleep(2200);
        els.nextOverlay.classList.remove("show");
      } else if(!players[current].finished){
        break;
      }
    }while(true);

    renderPlayers();
    els.nextName.textContent = `${players[current].name}さん`;
    els.nextOverlay.classList.add("show");
    tone(500,.09);
    await sleep(3000);
    els.nextOverlay.classList.remove("show");
    state = "ready";
    setHint("画面をタップしてサイコロを振ろう");
  }

  function setDie(die,n){
    const patterns = {
      1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]
    };
    [...die.querySelectorAll(".pip")].forEach((p,i)=>p.classList.toggle("on",patterns[n].includes(i)));
    die.setAttribute("aria-label",`サイコロの目 ${n}`);
  }

  function setHint(text,hidden=false){
    els.hint.textContent = text;
    els.hint.classList.toggle("hidden",hidden);
  }

  function tone(freq,duration){
    if(!soundOn) return;
    try{
      audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = "sine"; o.frequency.value = freq;
      g.gain.setValueAtTime(.055,audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime+duration);
    }catch(e){}
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
  }
  const sleep = ms => new Promise(r=>setTimeout(r,ms));

  els.playerCount.addEventListener("change",renderNameInputs);
  els.startBtn.addEventListener("click",e=>{e.stopPropagation();beginGame();});
  els.closePromptBtn.addEventListener("click",e=>{e.stopPropagation();closePrompt();});
  els.settingsBtn.addEventListener("click",e=>{
    e.stopPropagation();
    if(["rolling","moving","shuffle","prompt","confirm","transition"].includes(state)) return;
    els.setup.classList.add("show");state="setup";
  });
  els.resetBtn.addEventListener("click",e=>{
    e.stopPropagation();
    if(confirm("最初からやり直しますか？")){
      els.setup.classList.add("show");state="setup";
    }
  });

  let pointerStart = null;

  function runPrimaryAction(target){
    if(target && target.closest("button,input,select,label,.players,.topbar")) return;
    if(state==="ready") rollDice();
    else if(state==="confirm") moveCurrent();
  }

  document.addEventListener("pointerdown",e=>{
    if(e.target.closest("button,input,select,label,.players,.topbar")) return;
    pointerStart = {x:e.clientX,y:e.clientY,time:Date.now(),target:e.target};
  },{passive:true});

  document.addEventListener("pointerup",e=>{
    if(!pointerStart) return;
    const dx = e.clientX - pointerStart.x;
    const dy = e.clientY - pointerStart.y;
    const distance = Math.hypot(dx,dy);
    const elapsed = Date.now() - pointerStart.time;

    // 短いタップだけをゲーム操作として扱う。
    // スワイプはiPhoneで画面をスクロールするために使う。
    if(elapsed < 1200 && distance < 35){
      runPrimaryAction(pointerStart.target);
    }
    pointerStart = null;
  },{passive:true});

  document.addEventListener("pointercancel",()=>{ pointerStart = null; },{passive:true});

  window.addEventListener("resize",()=>requestAnimationFrame(drawRoute));
  makeBoard();
  renderNameInputs();
})();