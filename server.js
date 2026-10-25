// Sakhi Shield backend: zero dependencies. REST + Server-Sent Events + tiered escalation.
const http=require('http'),fs=require('fs'),path=require('path');
const alerts={},clients=[],PUB=path.join(__dirname,'public'),DB=path.join(__dirname,'data.json');
try{Object.assign(alerts,JSON.parse(fs.readFileSync(DB,'utf8')))}catch{} // persist across restarts
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css'};
const r3=x=>x==null?null:Math.round(x*1000)/1000; // ~100 m privacy blur for guardians
function view(a,role){
  if(role==='contact')return a;
  if(a.tier<1)return null; // guardians only see alerts after tier-1 escalation
  return{id:a.id,anon:'Alert #'+a.id.slice(-4),tier:a.tier,status:a.status,t:a.t,
    lat:r3(a.lat),lng:r3(a.lng),responders:a.responders,evidence:a.evidence.length};
}
function broadcast(){
  fs.writeFile(DB,JSON.stringify(alerts),()=>{});
  for(const c of clients){
    const list=Object.values(alerts).map(a=>view(a,c.role)).filter(Boolean);
    c.res.write('data: '+JSON.stringify(list)+'\n\n');
  }
}
function escalate(a){ // tier0 contacts -> tier1 guardians (30s) -> tier2 police 112 (60s, simulated)
  [[30000,1],[60000,2]].forEach(([ms,t])=>setTimeout(()=>{
    if(a.status==='active'){a.tier=t;broadcast();console.log(`[${a.id}] escalated to tier ${t}`);}},ms));
}
const body=req=>new Promise(ok=>{let s='';req.on('data',d=>s+=d);req.on('end',()=>{try{ok(JSON.parse(s||'{}'))}catch{ok({})}})});
const json=(res,o,c=200)=>{res.writeHead(c,{'Content-Type':'application/json'});res.end(JSON.stringify(o))};

http.createServer(async(req,res)=>{
  const u=new URL(req.url,'http://x'),p=u.pathname;
  if(p==='/api/stream'){
    res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache',Connection:'keep-alive'});
    const c={res,role:u.searchParams.get('role')==='contact'?'contact':'guardian'};
    clients.push(c);req.on('close',()=>clients.splice(clients.indexOf(c),1));
    return broadcast();
  }
  if(req.method==='POST'&&p==='/api/alert'){
    const b=await body(req),id=Date.now().toString(36)+Math.random().toString(36).slice(2,5);
    const a=alerts[id]={id,name:String(b.name||'Unknown').slice(0,40),reason:b.reason||'SOS',duress:!!b.duress,
      lat:b.lat,lng:b.lng,tier:0,status:'active',t:Date.now(),responders:0,evidence:[]};
    console.log(`[${id}] ALERT ${a.name} (${a.reason})${a.duress?' DURESS':''}`);
    escalate(a);broadcast();return json(res,{id});
  }
  const m=p.match(/^\/api\/alert\/([^/]+)\/(loc|evidence|respond|resolve)$/);
  if(req.method==='POST'&&m){
    const a=alerts[m[1]];if(!a)return json(res,{error:'not found'},404);
    const b=await body(req);
    if(m[2]==='loc'){a.lat=b.lat;a.lng=b.lng}
    if(m[2]==='evidence')a.evidence.push({kind:b.kind,hash:b.hash,prev:b.prev,ts:b.ts});
    if(m[2]==='respond')a.responders++;
    if(m[2]==='resolve')a.status='resolved';
    broadcast();return json(res,{ok:true});
  }
  const f=path.join(PUB,p==='/'?'index.html':p);
  if(!f.startsWith(PUB)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);return res.end('Not found')}
  res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'text/plain'});fs.createReadStream(f).pipe(res);
}).listen(process.env.PORT||3000,()=>console.log('Sakhi Shield on http://localhost:'+(process.env.PORT||3000)));
