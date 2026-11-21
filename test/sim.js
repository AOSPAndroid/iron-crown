// Long headless simulation: story opening, quests, gremlins, a haunted manor, gear, day / night / snow fights, death, save + continue. Must finish with zero exceptions.
const { run } = require('./harness');
let errors = 0;
const origErr = console.error; console.error = (...a) => { errors++; origErr(...a); };
run('init()');
const t0 = Date.now();
run('for(let i=0;i<30;i++) step(0.016)');
run('startNew()');
run('for(let i=0;i<200000 && S.mode==="loading";i++) step(0.016)');
console.log('mode after load', run('S.mode'), 'ents', run('S.ents.length'), 'chunks', run('CHUNKS.size'));
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
  if (Math.random() < 0.04) edge.KeyH = true; if (Math.random() < 0.04) hotSelect(ri(0, 7), 'key'); if (Math.random() < 0.03) hotWheel(Math.random() < 0.5 ? 1 : -1); if (Math.random() < 0.05) edge.KeyE = true; if (Math.random() < 0.02) edge.KeyR = true;
  const foe = S.ents.find(e => e.team === 1 && !e.dead && dist(e, P) < 25);
  if (foe && Math.random() < 0.8) stick(foe.x, foe.y, 1.2); else { touch.active = true; touch.jx = Math.random() * 2 - 1; touch.jy = Math.random() * 2 - 1; }
}
function sim(sec) { const n = Math.round(sec / 0.033); for (let i = 0; i < n; i++) { if (i % 6 === 0) randKeys(); step(0.033); if (S.mode === 'shop') closeShop(); if (S.mode === 'inv') closeInv(); if (S.mode === 'paused') closePause(); if (S.mode === 'talk') closeTalk(); if (S.mode === 'log') closeLog(); if (S.mode === 'forge') closeForge(); if (S.mode === 'over') { overClick({ target: { closest: () => ({ dataset: { a: 'rise' } }) } }); } } release(); }
`);
// story opening: the prologue, then the stranger at the inn (no tutorial)
console.log('opening', run('S.mode'), 'quest', run('S.Q.act[0].title'), 'bandits', run("S.ents.filter(e=>e.kind==='bandit').length"));
run(`closeTalk(); for (let i = 0; i < 10; i++) step(0.033);
{ const st = S.ents.find(e => e.kind === 'stranger'), tav = st.struct, d = tav.doors[0];
  for (let i = 0; i < 600 && structAt(P.x, P.y) !== tav; i++) { const out = !structAt(P.x, P.y) && Math.hypot(P.x - d.ox, P.y - d.oy) > 1.2; stick(out ? d.ox : d.ix, out ? d.oy : d.iy, 0.3); step(0.033); }
  for (let i = 0; i < 300 && dist(P, st) > 2.2; i++) { stick(st.x, st.y, 1.8); step(0.033); } release();
  for (let i = 0; i < 5; i++) step(0.033); S.interact = findInteract(); doInteract(); var talkView = TALK && TALK.view; talkAct('story'); for (let i = 0; i < 10; i++) step(0.033); }`);
console.log('stranger talk', run('talkView'), 'quest now', run('S.Q.act[0] && S.Q.act[0].title'), 'hands', run('JSON.stringify(P.hands)'), 'inv', run('P.inv.map(q=>q.id).join(",")'));
// chapter 2: the gremlins at the Old Mill steal the signet; fight them with the new gear, pick it up, bring it back
run(`{ const q = S.Q.act[0], st = qStep(q); P.x = st.x + 30; P.y = st.y; S.horse.x = P.x + 3; S.horse.y = P.y; P.hp = P.maxHp = 400; for (let i = 0; i < 40; i++) step(0.033);
  for (let i = 0; i < 2400 && qStep(q) && qStep(q).t === 'item'; i++) { const drop = S.drops.find(d => d.qid === q.id); const foe = S.ents.find(e => e.qid === q.id && !e.dead && e.team === 1);
    if (drop) { stick(drop.x, drop.y, 0.2); keys.KeyJ = false; } else if (foe) { stick(foe.x, foe.y, 1.0); keys.KeyJ = i % 6 < 2; } else stick(st.x, st.y, 1); P.hp = Math.max(P.hp, 200); step(0.033); }
  release(); var signetStep = qStep(q) && qStep(q).t; }`);
console.log('signet recovered, next step', run('signetStep'), 'gremlins stole', run('S.stats.stolen'), 'recovered', run('S.stats.recovered'));
run(`{ const q = S.Q.act[0], st = S.ents.find(e => e.kind === 'stranger'); P.x = st.x + 1.2; P.y = st.y; for (let i = 0; i < 10; i++) step(0.033); S.interact = findInteract(); doInteract(); var tv2 = TALK && TALK.view; talkAct('turnin'); for (let i = 0; i < 10; i++) step(0.033); }`);
console.log('turn-in view', run('tv2'), 'main chapter', run('S.Q.main'), 'quest', run('S.Q.act[0] && S.Q.act[0].title'), 'gold', run('P.gold'));
run(`while (S.Q.story.length) S.Q.story.shift(); if (S.mode === 'talk') closeTalk();`);
run(`P.gold=5000; invAdd('torch'); invAdd('kite_shield'); invAdd('long_bow'); invAdd('arrows',50); invAdd('pistol'); invAdd('claymore'); invAdd('chainmail'); invAdd('potion',5);`);
run(`openShop(S.ents.find(e=>e.kind==='merchant')); shopClick({target:{closest:()=>({dataset:{a:'buy',i:'0'}})}}); shopClick({target:{closest:()=>({dataset:{a:'tab',t:'sell'}})}}); shopClick({target:{closest:()=>({dataset:{a:'sell',i:'0'}})}}); closeShop();`);
run(`openInv(); invClick({target:{closest:()=>({dataset:{a:'eq',i:String(P.inv.findIndex(q=>q.id==='kite_shield')),s:'0'}})}}); invClick({target:{closest:()=>({dataset:{a:'eq',i:String(P.inv.findIndex(q=>q.id==='chainmail')),s:'0'}})}}); closeInv();`);
console.log('hands', run('JSON.stringify(P.hands)'), 'armor', run('P.armor'), 'inv', run('P.inv.length'));
run('S.dirT=0; sim(60)');
console.log('day sword+shield: ents', run('S.ents.length'), 'kills', run('S.kills'), 'hp', run('Math.round(P.hp)'), 'lvl', run('P.level'), 'style', run('Math.round(S.style)'));
run(`const bi=P.inv.findIndex(q=>q.id==='long_bow'); if(bi>=0) equipFromInv(bi,1); S.dirT=0; sim(40)`);
console.log('bow: kills', run('S.kills'), 'arrows', run("invCount('arrows')"));
run(`const ci=P.inv.findIndex(q=>q.id==='claymore'); if(ci>=0) equipFromInv(ci,1); S.dirT=0; spawnGroup('patrol'); sim(40)`);
console.log('claymore: kills', run('S.kills'), 'hp', run('Math.round(P.hp)'));
run(`unequipHand(1); const pi=P.inv.findIndex(q=>q.id==='pistol'); if(pi>=0) equipFromInv(pi,1); const si=P.inv.findIndex(q=>q.id==='iron_sword'||q.id==='rusty_sword'); spawnGroup('archers'); sim(30)`);
run(`S.time=0.85; S.dirT=0; const ti=P.inv.findIndex(q=>q.id==='torch'); if(ti>=0) equipFromInv(ti,1); spawnGroup('vampires'); spawnGroup('witches'); sim(60)`);
console.log('night: ents', run('S.ents.map(e=>e.kind).join(",")'), 'dark', run('S.darkness.toFixed(2)'), 'hp', run('Math.round(P.hp)'), 'mode', run('S.mode'));
run(`S.time=0.9; spawnGroup('gremlins'); spawnGroup('gremlinbrute'); P.gold += 200; sim(50)`);
console.log('gremlin night: stolen', run('S.stats.stolen'), 'recovered', run('S.stats.recovered'), 'lost', run('S.stats.lost'), 'hp', run('Math.round(P.hp)'), 'mode', run('S.mode'));
run(`{ const m = nearestManor(16, 16, 900), g = l2w(m, 0, MAN_G + 6); P.x = g[0]; P.y = g[1]; S.horse.x = P.x + 3; S.horse.y = P.y; P.mounted = false; S.time = 0.85; P.hp = P.maxHp = 3000; for (let i = 0; i < 40; i++) step(0.033);
  var manorFoes = S.ents.filter(e => e.manor === m).map(e => e.kind).join(','); const d = manorWorld(m).house.doors[0];
  const wps = [l2w(m, 3.6, 19), l2w(m, 3.6, 6), [d.ox, d.oy], [d.ix, d.iy]]; let wi = 0;
  for (let i = 0; i < 1500 && structAt(P.x, P.y) !== manorWorld(m).house; i++) { const w = wps[Math.min(wi, 3)]; if (Math.hypot(P.x - w[0], P.y - w[1]) < 0.8) wi++; stick(w[0], w[1], 0.2); keys.KeyJ = i % 7 < 2; P.hp = Math.max(P.hp, 1000); if (S.mode === 'talk') closeTalk(); step(0.033); }
  release(); var inManor = structAt(P.x, P.y) === manorWorld(m).house; sim(40); var manorM = m; }`);
console.log('manor', run('manorM.name'), 'foes', run('manorFoes'), 'inside', run('inManor'), 'cut', run('S.cut.s && S.cut.s.kind'), 'mode', run('S.mode'));
run(`P.x=10; P.y=-420; S.horse.x=P.x; S.horse.y=P.y; S.time=0.4; for(let i=0;i<30;i++) step(0.033);`);
console.log('biome at snow', run('biomeAt(P.x,P.y)'));
run(`S.dirT=0; spawnGroup('frostgiant'); spawnGroup('giant'); sim(60)`);
console.log('snow: ents', run('S.ents.map(e=>e.kind).join(",")'), 'hp', run('Math.round(P.hp)'), 'kills', run('S.kills'));
run(`horseAction(); for(let i=0;i<60;i++) step(0.033); S.dirT=0; spawnGroup('dragoons'); sim(30)`);
console.log('mounted fights: kills', run('S.kills'), 'mounted', run('P.mounted'));
run(`P.x=0; P.y=500; sim(20); P.x=900; P.y=0; sim(20); P.x=-900; P.y=200; sim(20);`);
// buildings: walk into Ashford's tavern, rest at the inn, trade with the blacksmith; then storm a castle, its keep, and a ruin at night
run(`P.x=16; P.y=22; S.horse.x=20; S.horse.y=22; P.mounted=false; for(let i=0;i<40;i++) step(0.033);
{ const L=villageLayout(villageFor(0,0)), tav=L.structs.find(s=>s.type==='tavern'), d=tav.doors[0]; for(let i=0;i<400 && structAt(P.x,P.y)!==tav;i++){ stick(Math.hypot(P.x-d.ox,P.y-d.oy)>1.2 && !structAt(P.x,P.y) ? d.ox : d.ix, Math.hypot(P.x-d.ox,P.y-d.oy)>1.2 && !structAt(P.x,P.y) ? d.oy : d.iy, 0.3); step(0.033); }
  release(); var inTavern = structAt(P.x,P.y)===tav; S.ents=S.ents.filter(e=>e.team!==1); const ip=l2w(tav,3.0,-0.6); P.x=ip[0]; P.y=ip[1]; P.hp=10; P.gold+=20; for(let i=0;i<3;i++) step(0.033); S.interact=findInteract(); doInteract(); if (S.mode==='talk') talkAct('rest'); for(let i=0;i<30;i++) step(0.033); }
const sm=S.ents.find(e=>e.kind==='smith'); if(sm){ openShop(sm); shopClick({target:{closest:()=>({dataset:{a:'buy',i:'0'}})}}); closeShop(); }
if(sm){ Object.assign(P.mats, { iron_ore: 9, wood: 6, leather_hide: 4, steel_ingot: 6, cloth: 4 }); P.gold += 300; openForge(sm, 'smith'); for (const t of ['upgrade', 'temper', 'salvage', 'orders', 'craft']) forgeAct('tab', { t });
  forgeAct('craft', { r: 'smith:iron_sword' }); for (let i = 0; i < 200 && FORGE.mg; i++) { step(0.033); if (i % 9 === 4) forgeStrike(); } forgeAct('resok', {}); forgeAct('tab', { t: 'upgrade' });
  const up = forgeOwned(id => upgradable(id))[0]; if (up) { forgeAct('upg', { id: up }); for (let i = 0; i < 200 && FORGE.mg; i++) { step(0.033); if (i % 7 === 3) forgeStrike(); } } closeForge(); }`);
console.log('tavern entered', run('inTavern'), 'hp after inn', run('Math.round(P.hp)'), 'cut', run('S.cut.s && S.cut.s.type'));
run(`{ const cs=nearestCastle(16,16,900), g=l2w(cs,0,CAS_S+12); P.x=g[0]; P.y=g[1]; S.horse.x=P.x+3; S.horse.y=P.y; S.time=0.4; for(let i=0;i<60;i++) step(0.033);
  if (P.mounted) horseAction(); const gi=l2w(cs,0,CAS_S-12); P.hp=P.maxHp=2000; for(let i=0;i<450 && castleAt(P.x,P.y)!==cs;i++){ stick(gi[0],gi[1],0.5); keys.KeyJ = i % 8 < 2; step(0.033); } release(); var inCastle=castleAt(P.x,P.y)===cs; var garrisonSeen=S.ents.filter(e=>e.castle===cs).length; sim(45);
  const K=castleWorld(cs).keep, kd=K.doors[0]; P.x=kd.ox; P.y=kd.oy; for(let i=0;i<200 && structAt(P.x,P.y)!==K;i++){ stick(kd.ix,kd.iy,0.3); step(0.033); } release(); var inKeep=structAt(P.x,P.y)===K;
  for (const c of castlePlan(cs).chests) { const p=l2w(cs,c.x,c.z+1.3); P.x=p[0]; P.y=p[1]; S.ents=S.ents.filter(e=>e.team!==1); for(let i=0;i<5;i++) step(0.033); S.interact=findInteract(); doInteract(); } sim(20); }`);
console.log('castle', run('inCastle'), 'garrison', run('garrisonSeen'), 'keep', run('inKeep'), 'looted', run('[...S.looted].filter(k=>k.startsWith("K")).length'), 'kills', run('S.kills'), 'mode', run('S.mode'));
run(`{ let r=null, bd=1e9; for(let ry=-4;ry<=2;ry++) for(let rx=-4;rx<=3;rx++){ const c=castleFor(rx,ry); if(c && c.kind==='ruin'){ const d=Math.hypot(c.x,c.y); if(d<bd){bd=d;r=c;} } }
  const p=l2w(r,0,10); P.x=p[0]; P.y=p[1]; S.time=0.88; for(let i=0;i<60;i++) step(0.033); var ruinFoes=S.ents.filter(e=>e.team===1 && castleGround(e.x,e.y)===r).map(e=>e.kind).join(','); sim(40); }`);
console.log('ruin at night: woke', run('ruinFoes'), 'hp', run('Math.round(P.hp)'), 'mode', run('S.mode'));
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
