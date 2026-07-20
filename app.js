"use strict";

const activities = [
  {id:"meeting", name:"あさ・おひるのかい", visual:"👋"},
  {id:"washroom", name:"てあらい・トイレ", visual:"🧼"},
  {id:"lunch", name:"おひるごはん", visual:"🍱"},
  {id:"snack", name:"おやつ", visual:"🍪"},
  {id:"free", name:"じゆうあそび", visual:"🧸"},
  {id:"nakayoshi", name:"なかよし", visual:"🎨"}
];

const storageKey = "jihatsuTransitionBoardV1";
const defaultState = {
  currentId:"free",
  nextId:"meeting",
  nextStart:"10:30",
  warningMinutes:10,
  volume:40,
  soundEnabled:false,
  warningPlayedFor:"",
  transitionPlayedFor:""
};

let state = loadState();
let audioContext = null;
let activeOscillators = [];
let overlayTimer = null;
const $ = id => document.getElementById(id);
const radius = 58;
const circumference = 2 * Math.PI * radius;
$("timerProgress").style.strokeDasharray = String(circumference);

function loadState(){
  try{
    return {...defaultState, ...JSON.parse(localStorage.getItem(storageKey) || "{}")};
  }catch{return {...defaultState};}
}
function saveState(){localStorage.setItem(storageKey, JSON.stringify(state));}
function getActivity(id){return activities.find(a => a.id === id) || activities[0];}
function pad(v){return String(v).padStart(2,"0");}
function todayKey(){const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;}
function targetDate(){
  const [h,m] = state.nextStart.split(":").map(Number);
  const d = new Date(); d.setHours(h,m,0,0); return d;
}
function formatRemaining(ms){
  const sec = Math.max(0, Math.ceil(ms/1000));
  return `${pad(Math.floor(sec/60))}:${pad(sec%60)}`;
}
function populateSelects(){
  for(const id of ["currentSelect","nextSelect"]){
    $(id).innerHTML = activities.map(a=>`<option value="${a.id}">${a.visual} ${a.name}</option>`).join("");
  }
}
function renderActivities(){
  const current=getActivity(state.currentId), next=getActivity(state.nextId);
  $("currentVisual").textContent=current.visual;
  $("currentName").textContent=current.name;
  $("nextVisual").textContent=next.visual;
  $("nextName").textContent=next.name;
  $("nextTime").textContent=`${state.nextStart}から`;
  $("soundButton").textContent=state.soundEnabled?"🔊 音は有効です":"🔇 音を有効にする";
  $("soundButton").classList.toggle("sound-off",!state.soundEnabled);
}
function renderClock(){
  const now=new Date();
  $("clock").textContent=`${pad(now.getHours())}:${pad(now.getMinutes())}`;
  $("date").textContent=new Intl.DateTimeFormat("ja-JP",{month:"long",day:"numeric",weekday:"short"}).format(now);
}
function tick(){
  renderClock();
  const now=new Date(), target=targetDate();
  const diff=target-now;
  const warningMs=state.warningMinutes*60*1000;
  const eventKey=`${todayKey()}_${state.nextStart}_${state.nextId}`;

  if(diff>warningMs){
    setTimer(circumference,"--:--","開始前",false);
    $("countdownTitle").textContent=`${state.warningMinutes}分前に おしらせします`;
    $("statusMessage").textContent="たのしく すごそう";
  }else if(diff>0){
    const ratio=Math.max(0,Math.min(1,diff/warningMs));
    setTimer(circumference*(1-ratio),formatRemaining(diff),"あと",true);
    $("countdownTitle").textContent="つぎの じかんまで";
    $("statusMessage").textContent=`あと ${Math.ceil(diff/60000)}ぷんで きりかえ`;
    if(state.warningPlayedFor!==eventKey){
      state.warningPlayedFor=eventKey; saveState(); playWarning();
    }
  }else{
    setTimer(circumference,"00:00","じかんです",true);
    if(state.transitionPlayedFor!==eventKey){
      state.transitionPlayedFor=eventKey; saveState(); performTransition();
    }
  }
}
function setTimer(offset,text,subtext,active){
  $("timerProgress").style.strokeDashoffset=String(offset);
  $("timerText").textContent=text;
  $("timerSubtext").textContent=subtext;
  $("countdownCard").classList.toggle("active-warning",active);
  $("countdownCard").classList.toggle("waiting",!active);
}
async function enableSound(){
  audioContext ||= new (window.AudioContext||window.webkitAudioContext)();
  await audioContext.resume();
  state.soundEnabled=true; saveState(); renderActivities(); playTone(523.25,.12,.12);
}
function playTone(freq,start,duration,type="sine",gainScale=1){
  if(!state.soundEnabled || !audioContext) return;
  const osc=audioContext.createOscillator(), gain=audioContext.createGain();
  const at=audioContext.currentTime+start;
  osc.type=type; osc.frequency.value=freq;
  const volume=(state.volume/100)*0.16*gainScale;
  gain.gain.setValueAtTime(0.0001,at);
  gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),at+.025);
  gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
  osc.connect(gain).connect(audioContext.destination);
  osc.start(at); osc.stop(at+duration+.03);
  activeOscillators.push(osc);
  osc.onended=()=>activeOscillators=activeOscillators.filter(o=>o!==osc);
}
function playWarning(){
  if(!state.soundEnabled)return;
  playTone(659.25,0,.3,"sine",.8);
  playTone(783.99,.34,.45,"sine",.8);
}
function playTransitionMusic(){
  if(!state.soundEnabled)return;
  const notes=[523.25,659.25,783.99,1046.5,783.99,659.25,698.46,880,1046.5];
  notes.forEach((n,i)=>playTone(n,i*.28,.38,i%3===0?"triangle":"sine",.75));
}
function stopSound(){
  for(const osc of activeOscillators){try{osc.stop();}catch{}}
  activeOscillators=[];
}
function performTransition(){
  playTransitionMusic();
  const next=getActivity(state.nextId);
  $("overlayVisual").textContent=next.visual;
  $("overlayName").textContent=next.name;
  $("transitionOverlay").hidden=false;
  clearTimeout(overlayTimer);
  overlayTimer=setTimeout(()=>{
    $("transitionOverlay").hidden=true;
    state.currentId=state.nextId;
    saveState(); renderActivities();
    $("statusMessage").textContent="はじめよう";
  },6500);
}
function openSettings(){
  $("currentSelect").value=state.currentId;
  $("nextSelect").value=state.nextId;
  $("nextStartTime").value=state.nextStart;
  $("warningMinutes").value=String(state.warningMinutes);
  $("volumeRange").value=String(state.volume);
  $("settingsDialog").showModal();
}
function applySettings(){
  state.currentId=$("currentSelect").value;
  state.nextId=$("nextSelect").value;
  state.nextStart=$("nextStartTime").value;
  state.warningMinutes=Number($("warningMinutes").value);
  state.volume=Number($("volumeRange").value);
  state.warningPlayedFor="";
  state.transitionPlayedFor="";
  saveState(); renderActivities(); tick();
}

populateSelects(); renderActivities(); tick();
setInterval(tick,500);
$("soundButton").addEventListener("click",enableSound);
$("settingsButton").addEventListener("click",openSettings);
$("saveSettings").addEventListener("click",applySettings);
$("previewWarning").addEventListener("click",async()=>{if(!state.soundEnabled)await enableSound();state.volume=Number($("volumeRange").value);playWarning();});
$("previewTransition").addEventListener("click",async()=>{if(!state.soundEnabled)await enableSound();state.volume=Number($("volumeRange").value);playTransitionMusic();});
$("stopSoundButton").addEventListener("click",stopSound);
$("switchNowButton").addEventListener("click",performTransition);
$("fullscreenButton").addEventListener("click",()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen());
window.addEventListener("focus",tick);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)tick();});
