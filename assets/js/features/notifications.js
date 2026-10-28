/* Avisos preservam o horário local e continuam funcionando sem notificações nativas. */
const AVS_DEF={on:true,min:15};
let avsList=[],avsCtx=null;
function avsCfg(){db.avs=Object.assign({},AVS_DEF,db.avs||{});return db.avs}
function avsDoneGet(){try{return JSON.parse(localStorage.getItem('consultorio_avs')||'{}')}catch(e){return{}}}
function avsDoneSet(o){try{localStorage.setItem('consultorio_avs',JSON.stringify(o))}catch(e){}}
function avsStart(a){const d=String(a.data).split('-'),h=String(a.hora).split(':');return new Date(+d[0],(+d[1])-1,+d[2],+h[0]||0,+h[1]||0,0,0)}
const avsAtivo=a=>!a.st||a.st==='Agendado'||a.st==='Confirmado';
const isIOS=()=>/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const isStandalone=()=>!!(navigator.standalone||(window.matchMedia&&matchMedia('(display-mode: standalone)').matches));
function avsAudio(){return avsCtx&&avsCtx.state==='running'?avsCtx:null}
const avsUnlock=async event=>{
  if(!event?.isTrusted||(navigator.userActivation&&!navigator.userActivation.isActive))return;
  try{
    const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
    if(!avsCtx||avsCtx.state==='closed')avsCtx=new Audio();
    if(avsCtx.state==='suspended')await avsCtx.resume();
  }catch(error){}
};
document.addEventListener('pointerdown',avsUnlock,true);document.addEventListener('pointerup',avsUnlock,true);document.addEventListener('keydown',avsUnlock,true);
function avsBeep(){const c=avsAudio();if(!c)return;try{[[0,880],[.3,1100],[.6,880]].forEach(([dl,fr])=>{const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.value=fr;o.connect(g);g.connect(c.destination);const t=c.currentTime+dl;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.45,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+.24);o.start(t);o.stop(t+.27)})}catch(e){}}
async function avsNotify(title,body,tag){
  if(!('Notification' in window)||Notification.permission!=='granted')return false;
  const opt={body,tag,vibrate:[200,100,200,100,200],requireInteraction:true,renotify:true};
  try{if('serviceWorker' in navigator){const r=await navigator.serviceWorker.getRegistration();if(r){await r.showNotification(title,opt);return true}}}catch(e){}
  try{new Notification(title,opt);return true}catch(e){}
  return false;
}
function avsTexto(a,diff){
  const hr=a.hora,quem=pName(a.pid);
  if(diff>0){const m=Math.max(1,Math.ceil(diff));return {t:'Horário chegando',b:quem+' às '+hr+' (em '+m+' min)'+(a.proc?' · '+a.proc:'')}}
  return {t:'Chegou o horário',b:quem+' · '+hr+(a.proc?' · '+a.proc:'')};
}
function avsCheck(){
  try{
    const c=avsCfg();if(!c.on||!Array.isArray(db.ag))return;
    const now=Date.now(),done=avsDoneGet();let ch=false;
    Object.keys(done).forEach(k=>{if(now-done[k]>3*864e5){delete done[k];ch=true}});
    db.ag.forEach(a=>{
      if(!a.data||!a.hora||!avsAtivo(a))return;
      const diff=(avsStart(a).getTime()-now)/60000;
      if(Math.abs(diff)>24*60)return;
      const stage=(diff>0&&diff<=c.min)?'a':(diff<=0&&diff>=-15)?'b':null;
      if(!stage)return;
      const key=a.id+':'+a.data+':'+a.hora+':'+stage;
      if(done[key])return;
      done[key]=now;ch=true;
      avsList=avsList.filter(x=>x.id!==a.id);
      avsList.push({id:a.id,key,ring:3,last:now});
      const tx=avsTexto(a,diff);
      avsNotify(LOCKED?'Horário de paciente chegando':tx.t,LOCKED?'Abra o sistema para ver os detalhes.':tx.b,key);
      avsBeep();try{navigator.vibrate&&navigator.vibrate([200,100,200,100,200])}catch(e){}
    });
    if(ch)avsDoneSet(done);
  }catch(e){}
  avsRender();
}
function avsRender(){
  let box=document.getElementById('apptBanner');
  const now=Date.now();
  const vis=LOCKED?[]:avsList.map(x=>{const a=(db.ag||[]).find(z=>z.id===x.id);if(!a||!avsAtivo(a))return null;const diff=(avsStart(a).getTime()-now)/60000;if(diff<-15)return null;return {x,a,diff}}).filter(Boolean);
  avsList=avsList.filter(x=>vis.some(v=>v.x.id===x.id)||LOCKED);
  avsTitle(vis.length?(vis.some(v=>v.diff<=0)?'⏰ Chegou o horário!':'⏰ Horário chegando!'):'');
  if(!vis.length){if(box)box.remove();return}
  if(!box){box=document.createElement('div');box.id='apptBanner';box.setAttribute('role','alert');document.body.appendChild(box)}
  box.innerHTML=vis.map(v=>{const tx=avsTexto(v.a,v.diff);return `<div class="appt-item${v.diff<=0?' now':''}"><div class="appt-ic" aria-hidden="true">⏰</div><div class="appt-tx"><b>${esc(tx.t)}</b><span>${esc(tx.b)}</span></div><div class="appt-bt"><button type="button" class="appt-go" data-act="avsgo" data-id="${v.a.id}">Ver agenda</button><button type="button" class="appt-ok" data-act="avsok" data-id="${v.a.id}" aria-label="Fechar aviso">✕</button></div></div>`}).join('');
}
let avsT0=null,avsTI=null;
function avsTitle(txt){
  if(!txt){if(avsTI){clearInterval(avsTI);avsTI=null}if(avsT0!==null){document.title=avsT0;avsT0=null}return}
  if(avsT0===null)avsT0=document.title;
  if(avsTI)return;
  let on=false;avsTI=setInterval(()=>{on=!on;document.title=on?txt:avsT0},1000);
}
function avsTick(){
  avsCheck();
  const now=Date.now();
  avsList.forEach(x=>{if(x.ring>0&&now-(x.last||0)>=9000&&!LOCKED){x.ring--;x.last=now;avsBeep()}});
}
function avsTickStart(){
  try{const w=new Worker(URL.createObjectURL(new Blob(['setInterval(function(){postMessage(1)},10000)'],{type:'text/javascript'})));w.onmessage=avsTick;return}catch(e){}
  setInterval(avsTick,10000);
}
function avsStatusTxt(){
  if(!window.isSecureContext)return ['bad','Para notificar no celular, abra o sistema por um endereço seguro (https). Neste modo só o aviso na tela funciona.'];
  if(!('Notification' in window))return isIOS()&&!isStandalone()?['bad','No iPhone, toque em Compartilhar › "Adicionar à Tela de Início" e abra o sistema por esse ícone para poder ativar as notificações.']:['bad','Este navegador não permite notificações. O aviso na tela continua funcionando.'];
  const pm=Notification.permission;
  if(pm==='granted')return ['ok','✓ Notificações ativadas neste aparelho.'];
  if(pm==='denied')return ['bad','Notificações bloqueadas. Libere nas configurações do navegador/site e volte aqui.'];
  if(isIOS()&&!isStandalone())return ['bad','No iPhone, primeiro adicione o sistema à Tela de Início (Compartilhar › Adicionar à Tela de Início) e abra por esse ícone.'];
  return ['warn','Notificações ainda não ativadas neste aparelho.'];
}
function avsCardHtml(){
  const c=avsCfg(),st=avsStatusTxt(),pm=('Notification' in window)?Notification.permission:'none';
  const can=window.isSecureContext&&('Notification' in window)&&pm==='default'&&!(isIOS()&&!isStandalone());
  const dot=!c.on?'off':(pm==='granted'?'ok':'warn');
  return `<details class="avs-mini" id="avsBox"${view.avsOpen?' open':''}><summary title="Aviso de horário dos pacientes"><span class="avs-dot ${dot}"></span>${c.on?'🔔 Aviso '+c.min+' min':'🔕 Aviso desligado'}</summary>
  <div class="avs-panel"><label class="avs-sw"><input type="checkbox" id="avsOn"${c.on?' checked':''}> Avisar quando o horário do paciente estiver chegando</label>
  <div class="avs-line"><label for="avsMin">Antecedência</label><select id="avsMin">${[5,10,15,20,30,60].map(m=>`<option value="${m}"${c.min===m?' selected':''}>${m} min</option>`).join('')}</select></div>
  <p class="avs-st ${st[0]}">${esc(st[1])}</p>
  <div class="avs-btns">${can?'<button class="sm" data-act="avsperm">Ativar notificações</button>':''}<button class="sm" data-act="pushactivate">Ativar Push (iPhone/Windows)</button><button class="ghost sm" data-act="avstest">Testar alarme</button></div></div></details>`;
}