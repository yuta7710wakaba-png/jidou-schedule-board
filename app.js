"use strict";

const DEFAULT_ACTIVITIES = [
  { id:"meeting", name:"あさのかい", image:"meeting.webp", minutes:10 },
  { id:"washroom", name:"トイレ", image:"washroom.webp", minutes:5 },
  { id:"activity", name:"かつどう", image:"activity.webp", minutes:30 },
  { id:"lunch", name:"おひるごはん", image:"lunch.webp", minutes:30 },
  { id:"snack", name:"おやつ", image:"snack.webp", minutes:15 },
  { id:"free-play", name:"じゆうあそび", image:"free-play.webp", minutes:30 },
  { id:"nakayoshi", name:"なかよしタイム", image:"nakayoshi.webp", minutes:20 },
  { id:"goodbye", name:"かえりのかい", image:"goodbye.webp", minutes:10 }
];

const STORAGE_KEY = "jidouScheduleBoardV5";
const state = {
  activities: structuredClone(DEFAULT_ACTIVITIES), currentIndex:0,
  autoVoice:false, autoAdvance:false,
  current:{total:600, remaining:600, running:false, interval:null},
  personal:{total:300, remaining:300, running:false, interval:null}
};

const $ = (id) => document.getElementById(id);
const els = {
  clock:$("clock"), dateText:$("dateText"), currentImage:$("currentImage"), currentName:$("currentName"), currentPosition:$("currentPosition"),
  currentRing:$("currentRing"), currentTime:$("currentTime"), currentStartBtn:$("currentStartBtn"), currentResetBtn:$("currentResetBtn"),
  nextImage:$("nextImage"), nextName:$("nextName"), nextRing:$("nextRing"), nextTime:$("nextTime"),
  personalRing:$("personalRing"), personalTime:$("personalTime"), personalStartBtn:$("personalStartBtn"), personalResetBtn:$("personalResetBtn"),
  settingsDialog:$("settingsDialog"), scheduleEditor:$("scheduleEditor"), autoVoiceToggle:$("autoVoiceToggle"), autoAdvanceToggle:$("autoAdvanceToggle"), toast:$("toast")
};

function loadState(){
  try{
    const saved=JSON.parse(localStorage.getItem(STORAGE_KEY));
    if(saved?.activities?.length===8){state.activities=saved.activities;state.currentIndex=Math.min(saved.currentIndex||0,7);state.autoVoice=!!saved.autoVoice;state.autoAdvance=!!saved.autoAdvance;}
  }catch(err){console.warn("保存データを読み込めませんでした",err)}
}
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify({activities:state.activities,currentIndex:state.currentIndex,autoVoice:state.autoVoice,autoAdvance:state.autoAdvance}))}
function formatTime(sec){sec=Math.max(0,Math.ceil(sec));return `${String(Math.floor(sec/60)).padStart(2,"0")}:${String(sec%60).padStart(2,"0")}`}
function setRing(el,remaining,total){const progress=total<=0?0:Math.max(0,Math.min(100,(remaining/total)*100));el.style.setProperty("--progress",progress.toFixed(2))}
function updateClock(){const now=new Date();els.clock.textContent=now.toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit"});els.dateText.textContent=now.toLocaleDateString("ja-JP",{month:"long",day:"numeric",weekday:"short"})}
function currentActivity(){return state.activities[state.currentIndex]}
function nextActivity(){return state.activities[Math.min(state.currentIndex+1,state.activities.length-1)]}
function resetCurrentTimer(){clearInterval(state.current.interval);const mins=Number(currentActivity().minutes)||1;state.current={total:mins*60,remaining:mins*60,running:false,interval:null};renderTimers()}
function renderBoard(){
  const cur=currentActivity(), next=nextActivity();
  els.currentImage.src=cur.image;els.currentImage.alt=cur.name;els.currentName.textContent=cur.name;els.currentPosition.textContent=`${state.currentIndex+1} / ${state.activities.length}`;
  els.nextImage.src=next.image;els.nextImage.alt=next.name;els.nextName.textContent=state.currentIndex===state.activities.length-1?"おしまい":next.name;
  els.nextTime.textContent=state.currentIndex===state.activities.length-1?"--:--":formatTime((Number(next.minutes)||1)*60);
  setRing(els.nextRing,state.currentIndex===state.activities.length-1?0:(Number(next.minutes)||1)*60,(Number(next.minutes)||1)*60);
  resetCurrentTimer();
}
function renderTimers(){
  els.currentTime.textContent=formatTime(state.current.remaining);setRing(els.currentRing,state.current.remaining,state.current.total);els.currentStartBtn.textContent=state.current.running?"⏸ とめる":"▶ はじめる";
  els.personalTime.textContent=formatTime(state.personal.remaining);setRing(els.personalRing,state.personal.remaining,state.personal.total);els.personalStartBtn.textContent=state.personal.running?"⏸ とめる":"▶ はじめる";
}
function tickTimer(which,onDone){const timer=state[which];timer.remaining=Math.max(0,timer.remaining-1);renderTimers();if(timer.remaining<=0){clearInterval(timer.interval);timer.interval=null;timer.running=false;renderTimers();playChime();onDone?.()}}
function toggleCurrent(){
  const t=state.current;if(t.remaining<=0)resetCurrentTimer();t.running=!t.running;
  if(t.running){t.interval=setInterval(()=>tickTimer("current",()=>{speak("じかんです。つぎのかつどうに きりかえましょう");if(state.autoAdvance)setTimeout(()=>advanceActivity(),1800)}),1000)}else{clearInterval(t.interval);t.interval=null}renderTimers()
}
function setPersonal(minutes){clearInterval(state.personal.interval);state.personal={total:minutes*60,remaining:minutes*60,running:false,interval:null};document.querySelectorAll("[data-minutes]").forEach(b=>b.classList.toggle("selected",Number(b.dataset.minutes)===minutes));renderTimers()}
function togglePersonal(){const t=state.personal;if(t.remaining<=0)t.remaining=t.total;t.running=!t.running;if(t.running)t.interval=setInterval(()=>tickTimer("personal",()=>speak("こべつタイマーの じかんです")),1000);else{clearInterval(t.interval);t.interval=null}renderTimers()}
function advanceActivity(){if(state.currentIndex<state.activities.length-1){state.currentIndex++;saveState();renderBoard();if(state.autoVoice)speak(`${currentActivity().name}を はじめます`);showToast("つぎのかつどうへ すすみました")}else showToast("きょうの かつどうは おしまいです")}
function backActivity(){if(state.currentIndex>0){state.currentIndex--;saveState();renderBoard();showToast("ひとつまえに もどりました")}}
function firstActivity(){state.currentIndex=0;saveState();renderBoard();showToast("さいしょに もどりました")}
function speak(text){if(!("speechSynthesis" in window)){showToast("この端末では音声を使えません");return}speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang="ja-JP";u.rate=.88;u.pitch=1.08;speechSynthesis.speak(u)}
function playChime(){try{const ctx=new (window.AudioContext||window.webkitAudioContext)();[523.25,659.25,783.99].forEach((f,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.frequency.value=f;g.gain.setValueAtTime(.001,ctx.currentTime+i*.18);g.gain.exponentialRampToValueAtTime(.12,ctx.currentTime+i*.18+.03);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+i*.18+.28);o.start(ctx.currentTime+i*.18);o.stop(ctx.currentTime+i*.18+.3)})}catch(e){console.warn(e)}}
function showToast(msg){els.toast.textContent=msg;els.toast.classList.add("show");clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>els.toast.classList.remove("show"),1800)}

function renderEditor(){els.scheduleEditor.innerHTML="";state.activities.forEach((a,index)=>{const row=document.createElement("div");row.className="schedule-row";row.innerHTML=`<span>${index+1}</span><img src="${a.image}" alt=""><input type="text" value="${escapeHtml(a.name)}" aria-label="活動名"><label><input type="number" min="1" max="180" value="${a.minutes}" aria-label="時間（分）"> 分</label><div class="move-buttons"><button type="button" data-move="up" aria-label="上へ">↑</button><button type="button" data-move="down" aria-label="下へ">↓</button></div>`;row.querySelector('[data-move="up"]').disabled=index===0;row.querySelector('[data-move="down"]').disabled=index===state.activities.length-1;row.querySelector('[data-move="up"]').onclick=()=>moveActivity(index,-1);row.querySelector('[data-move="down"]').onclick=()=>moveActivity(index,1);els.scheduleEditor.appendChild(row)});els.autoVoiceToggle.checked=state.autoVoice;els.autoAdvanceToggle.checked=state.autoAdvance}
function escapeHtml(s){return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}
function pullEditorValues(){[...els.scheduleEditor.children].forEach((row,i)=>{const inputs=row.querySelectorAll("input");state.activities[i].name=inputs[0].value.trim()||DEFAULT_ACTIVITIES[i].name;state.activities[i].minutes=Math.max(1,Math.min(180,Number(inputs[1].value)||1))})}
function moveActivity(index,delta){pullEditorValues();const target=index+delta;[state.activities[index],state.activities[target]]=[state.activities[target],state.activities[index]];renderEditor()}
function openSettings(){renderEditor();els.settingsDialog.showModal()}
function saveSettings(){pullEditorValues();state.autoVoice=els.autoVoiceToggle.checked;state.autoAdvance=els.autoAdvanceToggle.checked;saveState();renderBoard();els.settingsDialog.close();showToast("せっていを ほぞんしました")}
async function toggleFullscreen(){try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen()}catch{showToast("全画面表示を使えませんでした")}}

loadState();updateClock();setInterval(updateClock,1000);renderBoard();setPersonal(5);
$("currentStartBtn").addEventListener("click",toggleCurrent);$("currentResetBtn").addEventListener("click",resetCurrentTimer);
$("personalStartBtn").addEventListener("click",togglePersonal);$("personalResetBtn").addEventListener("click",()=>setPersonal(state.personal.total/60));
document.querySelectorAll("[data-minutes]").forEach(btn=>btn.addEventListener("click",()=>setPersonal(Number(btn.dataset.minutes))));
$("voiceBtn").addEventListener("click",()=>speak(`いまは ${currentActivity().name}です。つぎは ${state.currentIndex===state.activities.length-1?"おしまい":nextActivity().name}です`));
$("fullscreenBtn").addEventListener("click",toggleFullscreen);$("settingsBtn").addEventListener("click",openSettings);
$("advanceBtn").addEventListener("click",()=>{pullEditorValues();advanceActivity();renderEditor()});$("backBtn").addEventListener("click",()=>{pullEditorValues();backActivity();renderEditor()});$("resetScheduleBtn").addEventListener("click",()=>{pullEditorValues();firstActivity();renderEditor()});$("saveSettingsBtn").addEventListener("click",saveSettings);
els.settingsDialog.addEventListener("click",e=>{if(e.target===els.settingsDialog)els.settingsDialog.close()});
