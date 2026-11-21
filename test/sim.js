const { run, els } = require('./harness');
run('init()');
const t0 = Date.now();
// title frames
run('for(let i=0;i<30;i++) step(0.016)');
run('startNew()');
run('for(let i=0;i<200000 && S.mode==="loading";i++) step(0.016)');
console.log('mode after load', run('S.mode'), 'tut', run('S.tut'), 'ents', run('S.ents.length'), 'chunks', run('CHUNKS.size'));
// fake input
run(`var KEYS=['KeyW','KeyA','KeyD','KeyJ','KeyK','Space','KeyH','KeyE','KeyR'];
function randKeys(){ for(const k of KEYS) keys[k]=Math.random()<0.35; if(Math.random()<0.05) edge.KeyH=true; if(Math.random()<0.05) edge.KeyE=true; if(Math.random()<0.02) edge.KeyR=true; keys.KeyW = Math.random()<0.8; }
function sim(sec){ const n=Math.round(sec/0.033); for(let i=0;i<n;i++){ if(i%10===0) randKeys(); step(0.033); if(S.mode==='shop') closeShop(); if(S.mode==='inv') closeInv(); if(S.mode==='paused') closePause(); if(S.mode==='over'){ overClick({target:{closest:()=>({dataset:{a:'rise'}})}}); } } }`);
// tutorial: kill bandit by walking toward & punching
run(`for(let i=0;i<600 && S.tut===0;i++){ const b=S.ents.find(e=>e.tut); if(b){ P.a=Math.atan2(b.y-P.y,b.x-P.x); keys.KeyW = dist(b,P)>1.6; keys.KeyJ=true; keys.KeyK = i%2===0; } step(0.033); }`);
console.log('tut after fight', run('S.tut'), 'hp', run('Math.round(P.hp)'), 'drops', run('S.drops.map(d=>d.id||d.kind).join(",")'));
run(`keys.KeyJ=false; keys.KeyK=false; for(let i=0;i<300 && S.tut===1;i++){ const d=S.drops.find(d=>d.id==='rusty_sword'); if(d){ P.a=Math.atan2(d.y-P.y,d.x-P.x); keys.KeyW=true; } step(0.033); } keys.KeyW=false;`);
console.log('tut after pickup', run('S.tut'), 'hands', run('JSON.stringify(P.hands)'));
run(`edge.KeyH=true; for(let i=0;i<300 && S.tut===2;i++){ if(i%30===0) edge.KeyH=true; step(0.033); }`);
console.log('tut after horse', run('S.tut'), 'mounted', run('P.mounted'));
// give gear and simulate
run(`P.gold=5000; invAdd('torch'); invAdd('kite_shield'); invAdd('long_bow'); invAdd('arrows',50); invAdd('pistol'); invAdd('claymore'); invAdd('chainmail'); invAdd('potion',5);`);
const m = run(`S.ents.find(e=>e.kind==='merchant')`);
run(`openShop(S.ents.find(e=>e.kind==='merchant')); shopClick({target:{closest:()=>({dataset:{a:'buy',i:'0'}})}}); shopClick({target:{closest:()=>({dataset:{a:'tab',t:'sell'}})}}); shopClick({target:{closest:()=>({dataset:{a:'sell',i:'0'}})}}); closeShop();`);
run(`openInv(); invClick({target:{closest:()=>({dataset:{a:'eq',i:String(P.inv.findIndex(q=>q.id==='kite_shield')),s:'0'}})}}); invClick({target:{closest:()=>({dataset:{a:'eq',i:String(P.inv.findIndex(q=>q.id==='chainmail')),s:'0'}})}}); closeInv();`);
console.log('hands', run('JSON.stringify(P.hands)'), 'armor', run('P.armor'), 'inv', run('P.inv.length'));
run('sim(60)');
console.log('after 60s day: ents', run('S.ents.length'), 'kills', run('S.kills'), 'hp', run('Math.round(P.hp)'), 'lvl', run('P.level'), 'mode', run('S.mode'));
// switch to bow
run(`const bi=P.inv.findIndex(q=>q.id==='long_bow'); if(bi>=0) equipFromInv(bi,1);`);
run(`S.tut=3; S.dirT=0; sim(40)`);
// night
run(`S.time=0.85; S.dirT=0; const ti=P.inv.findIndex(q=>q.id==='torch'); if(ti>=0) equipFromInv(ti,0); sim(60)`);
console.log('night: ents', run('S.ents.map(e=>e.kind).join(",")'), 'dark', run('S.darkness'), 'hp', run('Math.round(P.hp)'), 'mode', run('S.mode'));
// snow
run(`P.x=10; P.y=-420; S.horse.x=P.x; S.horse.y=P.y; S.time=0.4; for(let i=0;i<30;i++) step(0.033);`);
console.log('biome at snow', run('biomeAt(P.x,P.y)'));
run(`S.dirT=0; spawnGroup('frostgiant'); sim(60)`);
console.log('snow: ents', run('S.ents.map(e=>e.kind).join(",")'), 'hp', run('Math.round(P.hp)'), 'kills', run('S.kills'));
// desert, swamp, far east
run(`P.x=0; P.y=500; sim(20); P.x=900; P.y=0; sim(20); P.x=-900; P.y=200; sim(20);`);
console.log('biomes visited', run('S.curBiome'), 'chunks', run('CHUNKS.size'));
// death and respawn
run(`hurtPlayer(9999,{x:P.x+1,y:P.y,k:{name:'test'}}); for(let i=0;i<80;i++) step(0.033);`);
console.log('mode after death', run('S.mode'));
run(`overClick({target:{closest:()=>({dataset:{a:'rise'}})}}); for(let i=0;i<30;i++) step(0.033);`);
console.log('after respawn', run('S.mode'), run('Math.round(P.x)+","+Math.round(P.y)'), 'hp', run('P.hp'));
// save / continue
run('saveGame(); continueGame(); for(let i=0;i<200000 && S.mode==="loading";i++) step(0.016); for(let i=0;i<60;i++) step(0.016);');
console.log('continue mode', run('S.mode'), 'day', run('S.day'));
run('sim(120)');
console.log('final', run('S.mode'), 'kills', run('S.kills'), 'lvl', run('P.level'), 'ents', run('S.ents.length'), 'parts', run('S.parts.length'));
// timing
const t1 = Date.now(); run('for(let i=0;i<200;i++) render(0.016)'); console.log('render ms/frame', (Date.now() - t1) / 200);
run('S.time=0.9; updateTime(0);'); const t2 = Date.now(); run('for(let i=0;i<200;i++) render(0.016)'); console.log('night render ms/frame', (Date.now() - t2) / 200);
console.log('total sim time', Date.now() - t0, 'ms');
