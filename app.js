const activities = [
  {id:"meeting",name:"あさ・おひるのかい",image:"meeting.png"},
  {id:"washroom",name:"てあらい・トイレ",image:"washroom.png"},
  {id:"lunch",name:"おひるごはん",image:"lunch.png"},
  {id:"snack",name:"おやつ",image:"snack.png"},
  {id:"free",name:"じゆうあそび",image:"free-play.png"},
  {id:"nakayoshi",name:"なかよし",image:"nakayoshi.png"},
  {id:"goodbye",name:"かえりのかい",image:"goodbye.png"}
];

const KEY="jidouScheduleBoardV5";
const defaults={
  currentId:"meeting",
  nextId:"washroom",
  followingId:"lunch",
  nextStart:"10:30",
  warningMinutes:10,
  volume:45,
  sound:false,
  personalLabel:"トイレ",
  personalMinutes:5
};

let state;
try{
  state={...defaults,...JSON.parse(localStorage.getItem(KEY)||"{}")};
}catch{
  state={...defaults};
}

const $=id=>document.getElementById(id);
const r=58;
const C=2*Math.PI*r;

$("mainProgress").style.strokeDasharray=C;
$("personalProgress").style.strokeDasharray=C;

let audio=null;
let oscillators=[];
let personal={
  duration:state.personalMinutes*60000,
  remaining:state.personalMinutes*60000,
  running:false,
  endAt:0,
  finished:false
};
let lastWarning="";
let lastTransition="";

function save(){
  localStorage.setItem(KEY,JSON.stringify(state));
}
function act(id){
  return activities.find(a=>a.id===id)||activities[0];
}
function pad(n){
  return String(n).padStart(2,"0");
}
function fmt(ms){
  const s=Math.max(0,Math.ceil(ms/1000));
  return `${pad(Math.floor(s/60))}:${pad(s%60)}`;
}
function targetToday(){
  const [h,m]=state.nextStart.split(":").map(Number);
  const d=new Date();
  d.setHours(h,m,0,0);
  return d;
}
function eventKey(){
  const d=new Date();
  return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}_${state.nextStart}_${state.nextId}`;
}
function setImage(el,a){
  el.src=`./${a.image}?v=5.0.0`;
  el.alt=a.name;
}
function populate(){
  const opts=activities.map(a=>`<option value="${a.id}">${a.name}</option>`).join("");
  $("currentSelect").innerHTML=opts;
  $("nextSelect").innerHTML=opts;
  $("followingSelect").innerHTML=opts;
}
function render(){
  const cur=act(state.currentId);
  const next=act(state.nextId);
  const following=act(state.followingId);

  setImage($("currentImg"),cur);
  $("currentName").textContent=cur.name;

  setImage($("nextImg"),next);
  $("nextName").textContent=next.name;

  setImage($("followingImg"),following);
  $("followingName").textContent=following.name;
  $("followingTime").textContent="そのつぎ";

  $("soundBtn").textContent=state.sound?"🔊 音は有効です":"🔇 音を有効にする";
  $("personalLabel").value=state.personalLabel;
}
function renderClock(){
  const d=new Date();
  $("clock").textContent=`${pad(d.getHours())}:${pad(d.getMinutes())}`;
  $("date").textContent=new Intl.DateTimeFormat("ja-JP",{
    month:"long",day:"numeric",weekday:"short"
  }).format(d);
}
function mainTimer(offset,text,sub){
  $("mainProgress").style.strokeDashoffset=offset;
  $("mainText").textContent=text;
  $("mainSub").textContent=sub;
}
async function enableSound(){
  audio ||= new (window.AudioContext||window.webkitAudioContext)();
  await audio.resume();
  state.sound=true;
  save();
  render();
  tone(523,0,.16);
}
function tone(freq,delay,dur,type="sine"){
  if(!state.sound||!audio)return;
  const o=audio.createOscillator();
  const g=audio.createGain();
  const t=audio.currentTime+delay;
  o.type=type;
  o.frequency.value=freq;
  const v=Math.max(.0002,(state.volume/100)*.14);
  g.gain.setValueAtTime(.0001,t);
  g.gain.exponentialRampToValueAtTime(v,t+.02);
  g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  o.connect(g).connect(audio.destination);
  o.start(t);
  o.stop(t+dur+.03);
  oscillators.push(o);
  o.onended=()=>oscillators=oscillators.filter(x=>x!==o);
}
function warningSound(){
  tone(660,0,.3);
  tone(784,.34,.42);
}
function transitionSound(){
  [523,659,784,1047,784,659].forEach((n,i)=>tone(n,i*.28,.38,i%2?"sine":"triangle"));
}
function personalSound(){
  [659,784,988].forEach((n,i)=>tone(n,i*.25,.42));
}
function stopAudio(){
  oscillators.forEach(o=>{try{o.stop()}catch{}});
  oscillators=[];
}
function doTransition(){
  transitionSound();
  const next=act(state.nextId);
  setImage($("overlayImg"),next);
  $("overlayName").textContent=next.name;
  $("transitionOverlay").hidden=false;

  setTimeout(()=>{
    $("transitionOverlay").hidden=true;
    state.currentId=state.nextId;
    state.nextId=state.followingId;
    save();
    render();
    $("message").textContent="はじめよう";
  },5500);
}
function tickMain(){
  renderClock();

  const diff=targetToday()-new Date();
  const warn=state.warningMinutes*60000;
  const key=eventKey();

  if(diff>warn){
    mainTimer(C,state.nextStart,"開始時間");
    $("countTitle").textContent=state.warningMinutes+"分前に おしらせします";
    $("message").textContent="たのしく すごそう";
  }else if(diff>0){
    const ratio=diff/warn;
    mainTimer(C*(1-ratio),fmt(diff),"あと");
    $("countTitle").textContent="つぎの じかんまで";
    $("message").textContent="あと "+Math.ceil(diff/60000)+"ぷんで きりかえ";
    if(lastWarning!==key){
      lastWarning=key;
      warningSound();
    }
  }else{
    mainTimer(C,"00:00","じかんです");
    if(lastTransition!==key){
      lastTransition=key;
      doTransition();
    }
  }
}
function setPersonal(min){
  state.personalMinutes=min;
  save();
  personal={
    duration:min*60000,
    remaining:min*60000,
    running:false,
    endAt:0,
    finished:false
  };
  document.querySelectorAll("[data-min]").forEach(b=>{
    b.classList.toggle("active",Number(b.dataset.min)===min);
  });
  $("personalStart").textContent="スタート";
  renderPersonal();
}
function renderPersonal(){
  const ratio=personal.duration?personal.remaining/personal.duration:0;
  $("personalProgress").style.strokeDashoffset=C*(1-ratio);
  $("personalText").textContent=fmt(personal.remaining);
}
function tickPersonal(){
  if(personal.running){
    personal.remaining=Math.max(0,personal.endAt-Date.now());
    if(personal.remaining<=0){
      personal.running=false;
      personal.finished=true;
      $("personalStart").textContent="もういちど";
      $("personalOverlayName").textContent=state.personalLabel||"じかん";
      $("personalOverlay").hidden=false;
      personalSound();
    }
  }
  renderPersonal();
}
function openSettings(){
  $("currentSelect").value=state.currentId;
  $("nextSelect").value=state.nextId;
  $("followingSelect").value=state.followingId;
  $("nextStart").value=state.nextStart;
  $("warningMinutes").value=state.warningMinutes;
  $("volume").value=state.volume;
  $("settingsDialog").showModal();
}

populate();
render();
setPersonal(state.personalMinutes);
tickMain();

setInterval(()=>{
  tickMain();
  tickPersonal();
},500);

$("soundBtn").onclick=enableSound;
$("settingsBtn").onclick=openSettings;

$("saveSettings").onclick=()=>{
  state.currentId=$("currentSelect").value;
  state.nextId=$("nextSelect").value;
  state.followingId=$("followingSelect").value;
  state.nextStart=$("nextStart").value;
  state.warningMinutes=Number($("warningMinutes").value);
  state.volume=Number($("volume").value);
  lastWarning="";
  lastTransition="";
  save();
  render();
  tickMain();
};

$("switchNow").onclick=doTransition;
$("stopSound").onclick=stopAudio;

$("fullBtn").onclick=async()=>{
  try{
    if(document.fullscreenElement){
      await document.exitFullscreen();
    }else{
      await document.documentElement.requestFullscreen();
    }
  }catch{
    alert("この端末では、ブラウザのメニューから「ホーム画面に追加」すると大きく表示できます。");
  }
};

document.querySelectorAll("[data-min]").forEach(b=>{
  b.onclick=()=>setPersonal(Number(b.dataset.min));
});

$("personalStart").onclick=()=>{
  if(personal.finished){
    setPersonal(state.personalMinutes);
    return;
  }
  if(personal.running){
    personal.remaining=Math.max(0,personal.endAt-Date.now());
    personal.running=false;
    $("personalStart").textContent="つづける";
  }else{
    personal.endAt=Date.now()+personal.remaining;
    personal.running=true;
    $("personalStart").textContent="いったん とめる";
  }
};

$("personalReset").onclick=()=>setPersonal(state.personalMinutes);

$("personalLabel").oninput=()=>{
  state.personalLabel=$("personalLabel").value.trim()||"じかん";
  save();
};

$("closePersonal").onclick=()=>{
  $("personalOverlay").hidden=true;
};

window.addEventListener("focus",()=>{
  tickMain();
  tickPersonal();
});
