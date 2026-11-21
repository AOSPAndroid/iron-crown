// Long headless simulation: tutorial, gear, day / night / snow fights, death, save + continue. Must finish with zero exceptions.
const { run } = require('./harness');
let errors = 0;
const origErr = console.error; console.error = (...a) => { errors++; origErr(...a); };
run('init()');
const t0 = Date.now();
run('for(let i=0;i<30;i++) step(0.016)');
run('startNew()');
run('for(let i=0;i<200000 && S.mode==="loading";i++) step(0.016)');
console.log('mode after load', run('S.mode'), 'tut', run('S.tut'), 'ents', run('S.ents.length'), 'chunks', run('CHUNKS.size'));
run(`
// virtual joystick toward a world point (camera-relative input)
function stick(tx, ty, stop) {
  const dx = tx - P.x, dy = ty - P.y, d = Math.hypot(dx, dy);
  if (d < (stop || 0.5)) { touch.active = false; touch.jx = touch.jy = 0; return d; }
  const fw = [Math.cos(CAMK.yaw), Math.sin(CAMK.yaw)], rt = [-Math.sin(CAMK.yaw), Math.cos(CAMK.yaw)];
  touch.active = true; touch.jx = (dx * rt[0] + dy * rt[1]) / d; touch.jy = -(dx * fw[0] + dy * fw[1]) / d; return d;
}
function release() { touch.active = false; touch.jx = touch.jy = 0; keys.KeyJ = false; keys.KeyK = false; }
var KEYS = ['KeyJ', 'KeyK'];
function randKeys() {
  keys.KeyJ = Math.random() < 0.45; keys.KeyK = Math.random() < 0.2;
  if (Math.random() < 0.15) edge.Space = true; if (Math.random() < 0.05) edge.KeyL = true;
  if (Math.random() < 0.04) edge.KeyH = true; if (Math.random() < 0.05) edge.KeyE = true; if (Math.random() < 0.02) edge.KeyR = true;
  const foe = S.ents.find(e => e.team === 1 && !e.dead && dist(e, P) < 25);
  if (foe && Math.random() < 0.8) stick(foe.x, foe.y, 1.2); else { touch.active = true; touch.jx = Math.random() * 2 - 1; touch.jy = Math.random() * 2 - 1; }
}
function sim(sec) { const n = Math.round(sec / 0.033); for (let i = 0; i < n; i++) { if (i % 6 === 0) randKeys(); step(0.033); if (S.mode === 'shop') closeShop(); if (S.mode === 'inv') closeInv(); if (S.mode === 'paused') closePause(); if (S.mode === 'over') { overClick({ target: { closest: () => ({ dataset: { a: 'rise' } }) } }); } } release(); }
`);
// tutorial, played with the new mechanics: rhythm combo, parry-grab, perfect dodge, then finish
run(`var tl = [];
for (let i = 0; i < 4000 && S.tut === 0; i++) {
  const b = S.ents.find(e => e.tut); if (!b) { step(0.033); continue; }
  const d = stick(b.x, b.y, 1.3);
  keys.KeyJ = false; keys.KeyK = false;
  if (S.tutStep === 0 || S.tutStep >= 3) {
    // press attack when the combo window opens (or start a string when idle)
    const a = P.act; if (!a || (a.k === 'atk' && a.t >= a.mv.w + a.mv.a && a.t < a.mv.w + a.mv.a + 0.05)) keys.KeyJ = d < 1.9 && i % 2 === 0;
  } else if (S.tutStep === 1) {
    // parry: tap block when the bandit's punch is ~0.1s from landing
    if (b.state === 'wind' && b.atk && b.wt > foeWind(b.atk, b.hitIdx) - 0.12) keys.KeyK = true;
  } else if (S.tutStep === 2) {
    if (b.state === 'wind' && b.atk && b.wt > foeWind(b.atk, b.hitIdx) - 0.08 && !(P.act && P.act.k === 'dash')) edge.Space = true;
  }
  if (tl[tl.length - 1] !== S.tutStep) tl.push(S.tutStep);
  step(0.033);
}
release();`);
console.log('tutorial steps seen', run('tl.join(">")'), 'tut', run('S.tut'), 'hp', run('Math.round(P.hp)'), 'drops', run('S.drops.map(d=>d.id||d.kind).join(",")'));
run(`for(let i=0;i<300 && S.tut===1;i++){ const d=S.drops.find(d=>d.id==='rusty_sword'); if(d) stick(d.x,d.y,0.2); step(0.033); } release();`);
console.log('tut after pickup', run('S.tut'), 'hands', run('JSON.stringify(P.hands)'));
run(`edge.KeyH=true; for(let i=0;i<300 && S.tut===2;i++){ if(i%30===0) edge.KeyH=true; step(0.033); }`);
console.log('tut after horse', run('S.tut'), 'mounted', run('P.mounted'));
run(`P.gold=5000; invAdd('torch'); invAdd('kite_shield'); invAdd('long_bow'); invAdd('arrows',50); invAdd('pistol'); invAdd('claymore'); invAdd('chainmail'); invAdd('potion',5);`);
run(`openShop(S.ents.find(e=>e.kind==='merchant')); shopClick({target:{closest:()=>({dataset:{a:'buy',i:'0'}})}}); shopClick({target:{closest:()=>({dataset:{a:'tab',t:'sell'}})}}); shopClick({target:{closest:()=>({dataset:{a:'sell',i:'0'}})}}); closeShop();`);
run(`openInv(); invClick({target:{closest:()=>({dataset:{a:'eq',i:String(P.inv.findIndex(q=>q.id==='kite_shield')),s:'0'}})}}); invClick({target:{closest:()=>({dataset:{a:'eq',i:String(P.inv.findIndex(q=>q.id==='chainmail')),s:'0'}})}}); closeInv();`);
console.log('hands', run('JSON.stringify(P.hands)'), 'armor', run('P.armor'), 'inv', run('P.inv.length'));
run('S.tut=3; S.dirT=0; sim(60)');
console.log('day sword+shield: ents', run('S.ents.length'), 'kills', run('S.kills'), 'hp', run('Math.round(P.hp)'), 'lvl', run('P.level'), 'style', run('Math.round(S.style)'));
run(`const bi=P.inv.findIndex(q=>q.id==='long_bow'); if(bi>=0) equipFromInv(bi,1); S.dirT=0; sim(40)`);
console.log('bow: kills', run('S.kills'), 'arrows', run("invCount('arrows')"));
run(`const ci=P.inv.findIndex(q=>q.id==='claymore'); if(ci>=0) equipFromInv(ci,1); S.dirT=0; spawnGroup('patrol'); sim(40)`);
console.log('claymore: kills', run('S.kills'), 'hp', run('Math.round(P.hp)'));
run(`unequipHand(1); const pi=P.inv.findIndex(q=>q.id==='pistol'); if(pi>=0) equipFromInv(pi,1); const si=P.inv.findIndex(q=>q.id==='iron_sword'||q.id==='rusty_sword'); spawnGroup('archers'); sim(30)`);
run(`S.time=0.85; S.dirT=0; const ti=P.inv.findIndex(q=>q.id==='torch'); if(ti>=0) equipFromInv(ti,1); spawnGroup('vampires'); spawnGroup('witches'); sim(60)`);
console.log('night: ents', run('S.ents.map(e=>e.kind).join(",")'), 'dark', run('S.darkness.toFixed(2)'), 'hp', run('Math.round(P.hp)'), 'mode', run('S.mode'));
run(`P.x=10; P.y=-420; S.horse.x=P.x; S.horse.y=P.y; S.time=0.4; for(let i=0;i<30;i++) step(0.033);`);
console.log('biome at snow', run('biomeAt(P.x,P.y)'));
run(`S.dirT=0; spawnGroup('frostgiant'); spawnGroup('giant'); sim(60)`);
console.log('snow: ents', run('S.ents.map(e=>e.kind).join(",")'), 'hp', run('Math.round(P.hp)'), 'kills', run('S.kills'));
run(`horseAction(); for(let i=0;i<60;i++) step(0.033); S.dirT=0; spawnGroup('dragoons'); sim(30)`);
console.log('mounted fights: kills', run('S.kills'), 'mounted', run('P.mounted'));
run(`P.x=0; P.y=500; sim(20); P.x=900; P.y=0; sim(20); P.x=-900; P.y=200; sim(20);`);
console.log('biomes visited', run('S.curBiome'), 'chunks', run('CHUNKS.size'));
run(`hurtPlayer(9999,{x:P.x+1,y:P.y,k:{name:'test'}}); for(let i=0;i<80;i++) step(0.033);`);
console.log('mode after death', run('S.mode'));
run(`overClick({target:{closest:()=>({dataset:{a:'rise'}})}}); for(let i=0;i<30;i++) step(0.033);`);
console.log('after respawn', run('S.mode'), run('Math.round(P.x)+","+Math.round(P.y)'), 'hp', run('P.hp'));
run('saveGame(); continueGame(); for(let i=0;i<200000 && S.mode==="loading";i++) step(0.016); for(let i=0;i<60;i++) step(0.016);');
console.log('continue mode', run('S.mode'), 'day', run('S.day'));
run('sim(120)');
console.log('final', run('S.mode'), 'kills', run('S.kills'), 'lvl', run('P.level'), 'ents', run('S.ents.length'), 'parts', run('S.parts.length'), 'fx', run('S.fx.length'));
console.log('total sim time', Date.now() - t0, 'ms', '| exceptions:', errors);
if (errors) process.exit(1);
