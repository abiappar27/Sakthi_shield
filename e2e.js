// End-to-end test: real server + the real pages executed in jsdom. Run: npm i && npm test
const {JSDOM}=require('jsdom'),{webcrypto}=require('crypto'),fs=require('fs'),path=require('path'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'),PORT=3222,B='http://localhost:'+PORT;let fail=0;
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++},sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function snap(role){const r=await fetch(B+'/api/stream?role='+role),rd=r.body.getReader(),d=new TextDecoder();let s='';
 while(!s.includes('\n\n'))s+=d.decode((await rd.read()).value);rd.cancel();return JSON.parse(s.split('data: ')[1].trim())}
async function page(file){const msgs=[];const dom=new JSDOM(fs.readFileSync(path.join(root,'public',file.split('?')[0]),'utf8'),{url:B+'/'+file,runScripts:'dangerously',pretendToBeVisual:true,
 beforeParse(w){Object.defineProperty(w.crypto,'subtle',{value:webcrypto.subtle});w.TextEncoder=TextEncoder;w.fetch=(u,o)=>fetch(new URL(u,B).href,o);w.alert=m=>msgs.push(m);
  w.EventSource=class{constructor(u){(async()=>{const rd=(await fetch(B+u)).body.getReader(),d=new TextDecoder();let b='';for(;;){const{value,done}=await rd.read();if(done)return;b+=d.decode(value);let i;
   while((i=b.indexOf('\n\n'))>=0){const c=b.slice(0,i);b=b.slice(i+2);const m=c.match(/^data: (.*)$/m);if(m&&this.onmessage)this.onmessage({data:m[1]})}}})()}}}});
 return{w:dom.window,d:dom.window.document,msgs}}
const click=(d,s)=>d.querySelector(s).click(),key=(d,k)=>[...d.querySelectorAll('#keys button')].find(b=>b.textContent===k).click(),keys=(d,s)=>[...s].forEach(k=>key(d,k));
(async()=>{
 try{fs.unlinkSync(path.join(root,'data.json'))}catch{}
 const srv=spawn('node',['server.js'],{cwd:root,env:{...process.env,PORT}});await sleep(800);
 const t0=Date.now(),pre=await(await fetch(B+'/api/alert',{method:'POST',body:JSON.stringify({name:'Asha',reason:'SOS',lat:13.0827,lng:80.2707})})).json();
 const p=await page('index.html'),d=p.d;
 key(d,'7');key(d,'×');key(d,'6');key(d,'=');ok(d.querySelector('#disp').textContent==='42','disguise calculator computes 7×6=42');
 key(d,'C');keys(d,'1234');key(d,'=');ok(d.querySelector('#app').style.display==='block','PIN 1234 opens the real app');
 click(d,'#sos');ok(d.querySelector('#ov').style.display==='grid','SOS shows the 5 s cancel window');
 await sleep(1500);click(d,'#cancel');await sleep(5500);
 ok(!(await snap('contact')).some(a=>a.name==='Priya'),'cancelled SOS sends nothing');
 click(d,'#sos');await sleep(6500);
 let c=(await snap('contact')).filter(a=>a.name==='Priya');
 ok(c.length===1&&c[0].reason==='SOS button','SOS creates an alert after the countdown');
 ok(d.querySelector('#act').style.display==='block','active-alert banner is shown');
 ok(d.querySelector('#sms').href.startsWith('sms:'),'SMS fallback link is built');
 ok(c[0].evidence.length>=1,'evidence hash reaches the server');
 click(d,'#stop');await sleep(500);c=(await snap('contact')).filter(a=>a.name==='Priya');
 ok(c[0].status==='resolved'&&d.querySelector('#act').style.display==='none','"I\'m safe" stops and resolves the alert');
 d.querySelector('#note').value='threat message';click(d,'#add');await sleep(300);click(d,'#chk');await sleep(300);
 ok(p.msgs.at(-1).startsWith('Chain intact'),'evidence chain verifies');
 p.w.eval('locker[0].data="edited"');click(d,'#chk');await sleep(300);ok(p.msgs.at(-1).startsWith('TAMPERING'),'tampering is detected');
 d.querySelector('#mins').value='0.03';click(d,'#walk');await sleep(8000);
 ok((await snap('contact')).some(a=>a.reason==='Missed walk check-in'),'missed walk check-in auto-escalates');
 const p2=await page('index.html');keys(p2.d,'0000');key(p2.d,'=');
 ok(p2.d.querySelector('#app').innerHTML.includes('Notes'),'duress PIN shows decoy Notes app');
 await sleep(800);ok((await snap('contact')).some(a=>a.duress),'duress PIN silently sends an alert');
 await sleep(Math.max(0,t0+31500-Date.now()));
 const ga=(await snap('guardian')).find(a=>a.id===pre.id);
 ok(ga&&ga.tier>=1,'tier-1 escalation reaches guardians after 30 s');
 ok(ga&&!('name' in ga)&&!('reason' in ga)&&ga.lat===13.083,'guardian view is anonymous with ~100 m blurred location');
 const gp=await page('guardian.html?role=guardian');await sleep(800);const L=gp.d.querySelector('#list').textContent;
 ok(L.includes('Alert #')&&!L.includes('Asha'),'guardian dashboard renders anonymised alert');
 [...gp.d.querySelectorAll('button')].find(b=>b.textContent.includes('responding')).click();await sleep(500);
 ok((await snap('contact')).find(a=>a.id===pre.id).responders===1,'"I\'m responding" updates the alert');
 const cp=await page('guardian.html?role=contact');await sleep(800);ok(cp.d.querySelector('#list').textContent.includes('Asha'),'contact dashboard shows full name');
 srv.kill();console.log(fail?`\n${fail} FAILED`:'\nALL TESTS PASSED');process.exit(fail?1:0);
})();
