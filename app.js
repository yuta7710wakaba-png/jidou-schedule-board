
"use strict";
const activities=[
{id:"meeting",name:"あさ・ひるのかい",image:"meeting.png"},
{id:"washroom",name:"てあらい・トイレ",image:"washroom.png"},
{id:"lunch",name:"おひる",image:"lunch.png"},
{id:"snack",name:"おやつ",image:"snack.png"},
{id:"free-play",name:"じゆうあそび",image:"free-play.png"},
{id:"nakayoshi",name:"なかよし",image:"nakayoshi.png"},
{id:"goodbye",name:"かえりのかい",image:"goodbye.png"}];
const $=id=>document.getElementById(id),C=2*Math.PI*50,KEY="jidouScheduleBoardV7";
const defaults={currentId:"meeting",nextId:"washroom",nextStart:"",warningMinutes:5,volume:60};
let state=load(),audio=null,transitionKey="",transitionRunning=false;
const activitySound=new Audio("activity-change.wav?v=7.0.0");
const personalSound=new Audio("personal-alarm.wav?v=7.0.0");
let personalDuration=300,personalRemaining=300,personalRunning=false,lastFrame=0;

function load(){try{return {...defaults,...JSON.parse(localStorage.getItem(KEY)||"{}")}}catch{return {...defaults}}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch{}}
function act(id){return activities.find(a=>a.id===id)||activities[0]}
function image(el,a){el.src=a.image+"?v=7.0.0";el.alt=a.name}
function populate(){const opts=activities.map(a=>`<option value="${a.id}">${a.name}</option>`).join("");$("currentSelect").innerHTML=opts;$("nextSelect").innerHTML=opts}
function render(){const c=act(state.currentId),n=act(state.nextId);image($("currentImg"),c);image($("nextImg"),n);$("currentName").textContent=c.name;$("nextName").textContent=n.name;$("currentSelect").value=state.currentId;$("nextSelect").value=state.nextId;$("nextStart").value=state.nextStart;$("warningMinutes").value=String(state.warningMinutes);$("volume").value=String(state.volume)}
function clock(){const d=new Date();$("clockText").textContent=d.toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit"});$("todayLabel").textContent=d.toLocaleDateString("ja-JP",{month:"long",day:"numeric",weekday:"short"})}
function target(){if(!state.nextStart)return null;const [h,m]=state.nextStart.split(":").map(Number);if(!Number.isFinite(h)||!Number.isFinite(m))return null;const d=new Date();d.setHours(h,m,0,0);return d}
function fmt(ms){const s=Math.max(0,Math.ceil(ms/1000)),m=Math.floor(s/60);return String(m).padStart(2,"0")+":"+String(s%60).padStart(2,"0")}
function key(){const d=new Date();return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}_${state.nextStart}_${state.nextId}`}
function progress(el,p){el.style.strokeDashoffset=String(C*(1-Math.max(0,Math.min(1,p))))}
function updateMain(){const t=target();if(!t){$("mainText").textContent="--:--";$("mainSub").textContent="開始時間";$("countTitle").textContent="設定から次の時間を選んでください";progress($("mainProgress"),0);return}
const diff=t-Date.now(),warn=Math.max(1,Number(state.warningMinutes))*60000;
if(diff>warn){$("mainText").textContent=state.nextStart;$("mainSub").textContent="開始時間";$("countTitle").textContent=`${state.warningMinutes}分前に おしらせします`;$("message").textContent="たのしく すごそう";progress($("mainProgress"),0);return}
if(diff>0){$("mainText").textContent=fmt(diff);$("mainSub").textContent="あと";$("countTitle").textContent="つぎの じかんまで";$("message").textContent=`あと ${Math.ceil(diff/60000)}ぷんで きりかえ`;progress($("mainProgress"),1-diff/warn);return}
$("mainText").textContent="00:00";$("mainSub").textContent="じかんです";$("countTitle").textContent="つぎの じかんです";progress($("mainProgress"),1);const k=key();if(transitionKey!==k&&!transitionRunning){transitionKey=k;transition()}}
function transition(){transitionRunning=true;soundActivity();const n=act(state.nextId);image($("overlayImg"),n);$("overlayName").textContent=n.name;$("transitionOverlay").hidden=false;setTimeout(()=>{$("transitionOverlay").hidden=true;state.currentId=state.nextId;const i=activities.findIndex(a=>a.id===state.nextId);state.nextId=activities[(i+1)%activities.length].id;state.nextStart="";save();render();$("message").textContent="たのしく すごそう";transitionRunning=false},4500)}
function ensureAudio(){if(!audio){const A=window.AudioContext||window.webkitAudioContext;if(A)audio=new A()}if(audio&&audio.state==="suspended")audio.resume().catch(()=>{})}
function beep(f=660,d=.16,delay=0){if(!audio)return;const o=audio.createOscillator(),g=audio.createGain(),s=audio.currentTime+delay,v=Math.max(0,Math.min(1,Number(state.volume)/100))*.16;o.frequency.value=f;g.gain.setValueAtTime(.0001,s);g.gain.exponentialRampToValueAtTime(Math.max(.0001,v),s+.02);g.gain.exponentialRampToValueAtTime(.0001,s+d);o.connect(g);g.connect(audio.destination);o.start(s);o.stop(s+d+.03)}
function playFileSound(player,fallback){
  player.pause();player.currentTime=0;player.volume=Math.max(0,Math.min(1,Number(state.volume)/100));
  const promise=player.play();
  if(promise&&promise.catch)promise.catch(()=>fallback());
}
function fallbackActivity(){ensureAudio();beep(523,.18,0);beep(659,.18,.2);beep(784,.28,.4)}
function fallbackPersonal(){ensureAudio();beep(880,.20,0);beep(660,.30,.28);beep(880,.20,.80);beep(660,.35,1.08)}
function soundActivity(){playFileSound(activitySound,fallbackActivity)}
function soundPersonal(){playFileSound(personalSound,fallbackPersonal)}
function soundTest(){soundActivity()}
function setMinutes(m){personalDuration=m*60;personalRemaining=personalDuration;personalRunning=false;renderPersonal()}
function renderPersonal(){$("personalText").textContent=fmt(personalRemaining*1000);progress($("personalProgress"),personalDuration?1-personalRemaining/personalDuration:0);$("personalStart").textContent=personalRunning?"ストップ":"スタート"}
function tick(ts){if(personalRunning){if(!lastFrame)lastFrame=ts;personalRemaining=Math.max(0,personalRemaining-(ts-lastFrame)/1000);if(personalRemaining<=0){personalRunning=false;personalRemaining=0;soundPersonal()}renderPersonal()}lastFrame=ts;requestAnimationFrame(tick)}
function openSettings(){render();if($("settingsDialog").showModal)$("settingsDialog").showModal();else $("settingsDialog").setAttribute("open","")}
function closeSettings(){if($("settingsDialog").close)$("settingsDialog").close();else $("settingsDialog").removeAttribute("open")}
function saveSettings(e){e.preventDefault();state.currentId=$("currentSelect").value;state.nextId=$("nextSelect").value;state.nextStart=$("nextStart").value;state.warningMinutes=Number($("warningMinutes").value);state.volume=Number($("volume").value);transitionKey="";save();render();closeSettings()}
async function fullscreen(){try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen()}catch{}}
function init(){populate();render();clock();renderPersonal();$("settingsBtn").onclick=openSettings;$("closeSettings").onclick=closeSettings;$("settingsForm").onsubmit=saveSettings;$("testSound").onclick=soundActivity;$("testPersonalSound").onclick=soundPersonal;$("soundBtn").onclick=soundTest;$("fullscreenBtn").onclick=fullscreen;document.querySelectorAll("[data-minutes]").forEach(b=>b.onclick=()=>setMinutes(Number(b.dataset.minutes)));$("personalStart").onclick=()=>{if(personalRemaining<=0)personalRemaining=personalDuration;personalRunning=!personalRunning;ensureAudio();renderPersonal()};$("personalReset").onclick=()=>{personalRunning=false;personalRemaining=personalDuration;renderPersonal()};setInterval(()=>{clock();updateMain()},500);updateMain();requestAnimationFrame(tick)}
window.addEventListener("DOMContentLoaded",init);
