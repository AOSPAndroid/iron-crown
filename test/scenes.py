"""Playwright screenshots of test scenes -> shots/ (headless Chrome with SwiftShader WebGL2).
Usage: python3 test/scenes.py [d|m] [scene ...]      then: python3 test/scenes.py grid"""
import pathlib, asyncio, sys
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / 'index.html').as_uri()
SHOTS = ROOT / 'shots'; SHOTS.mkdir(exist_ok=True)
ARGS = ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
SETUP = """
window.scene = function(opts){
  window.__FREEZE=false; show('talk', false); show('qlog', false); TALK = null; S.mode='play'; P.drawing=false; P.draw=0; P.blocking=false; P.act=null; P.lock=null; P.iframes=0; P.parryT=0; P.counterT=0; P.riposteT=0;
  P.v=opts.v||0; P.step=opts.step||0; P.vx=0; P.vy=0; S.slowT=0; S.hitstop=0; S.pflash=0; S.flash=0; S.cueT=0; S.style=opts.style||0;
  S.ents = S.ents.filter(e=>e.team===2||e.post); S.projs=[]; S.parts=[]; S.drops=[]; S.corpses=[]; S.banner=null; S.msgs=[]; S.texts=[]; S.fx=[]; S.ghosts=[]; S.marks=[];
  S.tok.clear(); S.tokR.clear();
  P.x=opts.x; P.y=opts.y; P.a=opts.a===undefined?-Math.PI/2:opts.a; P.mounted=!!opts.mounted; P.hp=P.maxHp; P.st=opts.st===undefined?P.stMax:opts.st;
  S.horse.x=P.x+2.4*Math.cos(P.a+1.9); S.horse.y=P.y+2.4*Math.sin(P.a+1.9); S.horse.a=P.a+0.6; S.horse.state=P.mounted?'ridden':'idle';
  S.time=opts.time===undefined?0.45:opts.time; S.darkness=darkAt(S.time); S.tut=3; S.dirT=999; S.bloodMoon=false;
  P.armor=opts.armor||'chainmail'; P.hands=opts.hands||['kite_shield','iron_sword']; P.inv=P.inv.filter(q=>!P.hands.includes(q.id)); if (typeof hotInit==='function') hotInit();
  if (opts.speed) { P.vx=Math.cos(P.a)*opts.speed; P.vy=Math.sin(P.a)*opts.speed; }
  manageChunks(80); S.curBiome=biomeAt(P.x,P.y);
  CAMK.yaw = CAMK.yawT = opts.yaw===undefined ? -Math.PI/2 : opts.yaw; CAMK.zoomLock = opts.zoom || 0;
  { const st = structAt(P.x, P.y); S.cut = { s: st, k: st ? 1 : 0 }; S.curCastle = castleAt(P.x, P.y); }
  if (opts.horse) { S.horse.x = opts.horse[0]; S.horse.y = opts.horse[1]; } else if (structAt(P.x, P.y)) { S.horse.x = P.x + 60; S.horse.y = P.y + 60; }
  const f=P.a, ax=Math.cos(f), ay=Math.sin(f), rx=-ay, ry=ax; window.E=[];
  for (const s of (opts.ents||[])) { const e=spawnEnt(s[0], P.x+ax*s[1]+rx*s[2], P.y+ay*s[1]+ry*s[2], {D:0}); e.a=Math.atan2(P.y-e.y,P.x-e.x); e.cd=99; e.tT=99; e.target=P;
    if (s[3]) { const o=s[3]; if (o.atk!==undefined) { beginFoeAttack(e, EATK[e.kind][o.atk], P); e.wt=(o.frac||0.5)*(e.state==='aim'?e.atk.aim:foeWind(e.atk,e.hitIdx)); if (o.locked) e.locked=true; delete o.atk; delete o.frac; } Object.assign(e,o); }
    E.push(e); }
  if (opts.lock!==undefined) P.lock=E[opts.lock];
  if (opts.pre) opts.pre();
  updateCamera(0,true);
  for (let i=0;i<40 && prewarmScene(9)>0;i++);
  window.__FREEZE=true;
  for (let i=0;i<6;i++){ S.t+=0.05; updateCamera(0.05); render(0.05); }
  return 0;
};
// player mid-swing (weapon move index, fraction of the active frames) + matching slash ribbon
window.swing = function(wk, idx, frac, dir){
  const mv=MOVES[wk][idx], it=mainItem(); dir = dir===undefined ? P.a : dir; P.a=dir;
  P.act={k:'atk', mv, step:idx, wk, it, t:mv.w+mv.a*frac, dir, hit:new Set(), queued:false, mashed:false, sharp:false, crit:0, hand:mainHand(), fxDone:true, cue:true};
  const f=fx({k:'slash', x:P.x, y:P.y, h:P.mounted?1.9:1.05, dir, arc:mv.arc, r:moveRange(mv,it)*0.92, side:mv.sw||1, dur:0.16, col:[1,1,1,0.9], thrust:mv.sw===0}); f.t=0.16*Math.min(0.95, 0.35+frac*0.5);
};
// a castle of a kind (and optionally biome) near the origin; returns the castle object
window.castleOf = function(kind, biome){ let best=null, bd=1e9; for (let ry=-6; ry<=6; ry++) for (let rx=-6; rx<=6; rx++) { const c=castleFor(rx,ry); if (!c || c.kind!==kind || (biome!==undefined && c.b!==biome)) continue; const d=Math.hypot(c.x,c.y); if (d<bd) { bd=d; best=c; } } return best; };
// world point from castle-local coords, and the camera yaw that looks along a castle-local direction
window.cl = function(c, lx, lz){ return l2w(c, lx, lz); };
window.cyaw = function(c, dx, dz){ const d = d2w(c, dx, dz); return Math.atan2(d[1], d[0]); };
window.vb = function(type){ const L = villageLayout(villageFor(0,0)); return L.structs.find(s => s.type===type); };
window.findBiome = function(b, minR){ for(let r=minR||150;r<2600;r+=40) for(let k=0;k<24;k++){const a=k/24*Math.PI*2,x=Math.cos(a)*r,y=Math.sin(a)*r; if(biomeAt(x,y)===b && biomeAt(x,y-14)===b && biomeAt(x+8,y)===b && biomeAt(x-8,y)===b && !nearVillage(x,y,30)) return [x,y];} return [0,0]; };
"""
SCENES = {
  'field': "scene({x:16,y:-70, time:0.36, hands:['buckler','iron_sword'], armor:'leather', v:3.5, speed:4, step:2})",
  'fight': """scene({x:16,y:-60, time:0.5, style:340, lock:0, ents:[['soldier',2.6,0.6,{atk:0,frac:0.55,hurtT:0.1}],['pikeman',5.5,-2.6,{atk:0,frac:0.6}],['musketeer',10,2.5,{atk:0,frac:0.85,locked:true}],['bandit',3.4,3.4,{atk:0,frac:0.3}],['archer',9,-5,{atk:0,frac:0.4}]],
     pre:()=>{ swing('sword',1,0.5,Math.atan2(E[0].y-P.y,E[0].x-P.x)); sparks(E[0].x-0.3,E[0].y+0.3,1.1,'!#fff4c0',12,true); addText(E[0].x,E[0].y,2.2,'24','#ffffff'); addText(E[3].x,E[3].y,2.0,'17!','#ff9a3a',true); S.cueT=0.15; }})""",
  'perfect': """scene({x:16,y:-64, time:0.6, style:560, ents:[['soldier',1.5,-1.6,{atk:1,frac:0.98}],['bandit',3.5,2.6]],
     pre:()=>{ const sx=P.x-Math.cos(P.a)*0, sy=P.y; for(let i=0;i<5;i++) S.ghosts.push({x:P.x+0.75*(i+1),y:P.y+0.25*(i+1),a:P.a,t:0.22-i*0.04}); S.slowT=0.4; P.counterT=1.2; S.pflash=0.12; addText(P.x,P.y,2.4,'PERFECT!','#7af0ff',true); const f=fx({k:'ring',x:P.x,y:P.y,h:0.9,r0:0.4,r1:3.2,dur:0.45,col:[0.5,0.95,1,0.9]}); f.t=0.12; P.iframes=0.05; P.act={k:'dash',t:0.2,dur:0.28,a:Math.PI,dist:4.4,done:0.9,sx:P.x+3,sy:P.y}; }})""",
  'parry': """scene({x:16,y:-66, time:0.45, hands:['kite_shield','steel_sword'], style:300, ents:[['soldier',1.4,0,{state:'stagger',stT:1}],['soldier',4,2.5,{atk:0,frac:0.4}],['vampire',5.5,-2.5,{atk:1,frac:0.6}]],
     pre:()=>{ P.parryT=0.1; P.riposteT=1; const mx=(P.x+E[0].x)/2, my=(P.y+E[0].y)/2; sparks(mx,my,1.3,'!#fff4c0',16,true); const f=fx({k:'ring',x:mx,y:my,h:1.2,r0:0.2,r1:1.8,dur:0.3,col:[1,0.95,0.6,1]}); f.t=0.08; addText(P.x,P.y,2.4,'PARRY!','#ffe070',true); }})""",
  'giant': """scene({x:16,y:-60, time:0.55, hands:['torch','steel_sword'], armor:'leather', lock:0, ents:[['giant',6,-2.5,{atk:0,frac:0.55}],['frostgiant',14,5,{atk:2,frac:0.5}]],
     pre:()=>{ E[0].poise=E[0].poiseMax*0.35; S.marks.push({x:P.x-3,y:P.y-3,t:0.6,T0:1.4,rad:2.5}); }})""",
  'night': "scene({x:16,y:-78, a:-1.2, time:0.93, hands:['torch','steel_sword'], armor:'gambeson', v:2, step:1, ents:[['vampire',4.5,-1.5,{atk:0,frac:0.6}],['witch',8,3,{elev:1.3,atk:0,frac:0.5}],['vampire',9,-4]]})",
  'village': "scene({x:16,y:28, a:-Math.PI/2, time:0.9, hands:['torch','iron_sword'], armor:'tunic'})",
  'mounted': """scene({x:16,y:-92, mounted:true, time:0.4, hands:['torch','longsword'], armor:'halfplate', v:9, step:3, ents:[['soldier',3,-2.2,{hurtT:0.1}],['soldier',7,2],['dragoon',12,4,{atk:0,frac:0.5}]],
     pre:()=>{ const mv=MOVES.ride[0]; P.act={k:'atk', mv, step:0, wk:'ride', it:mainItem(), t:mv.w+mv.a*0.5, dir:P.a-Math.PI/2, hit:new Set(), hand:1, fxDone:true}; const f=fx({k:'slash',x:P.x,y:P.y,h:1.9,dir:P.a-Math.PI/2,arc:1.25,r:3.4,side:1,dur:0.16,col:[1,1,1,0.9]}); f.t=0.08; }})""",
}
# buildings and castles (positions come from the deterministic layouts)
BSCENES = {
  'vil_day': "(() => { const v=villageFor(0,0); return scene({x:v.x, y:v.y+3, a:-Math.PI/2, time:0.42, zoom:2.3, hands:['buckler','iron_sword'], armor:'leather'}); })()",
  'vil_night': "(() => { const v=villageFor(0,0); return scene({x:v.x+1, y:v.y+2, a:-Math.PI/2, time:0.9, zoom:1.9, hands:['torch','iron_sword'], armor:'leather'}); })()",
  'house': "(() => { const b=vb('cottage'), p=l2w(b, 0.6, 0.9); return scene({x:p[0], y:p[1], a:headingOf(b,0,-1), time:0.45, yaw:headingOf(b,0,-1), hands:[null,'iron_sword'], armor:'tunic'}); })()",
  'tavern': "(() => { const b=vb('tavern'), p=l2w(b, -0.4, 1.2); return scene({x:p[0], y:p[1], a:headingOf(b,-1,-0.4), time:0.9, yaw:headingOf(b,0,-1), hands:['torch','iron_sword'], armor:'gambeson'}); })()",
  'smithy': "(() => { const b=vb('smithy'), p=l2w(b, 0.6, 0.9); return scene({x:p[0], y:p[1], a:headingOf(b,-0.6,-1), time:0.62, yaw:headingOf(b,0,-1), hands:['buckler','iron_sword'], armor:'leather'}); })()",
  'chapel': "(() => { const b=vb('chapel'), p=l2w(b, 0.0, 3.6); return scene({x:p[0], y:p[1], a:headingOf(b,0,-1), time:0.5, yaw:headingOf(b,0,-1), hands:[null,'iron_sword'], armor:'tunic'}); })()",
  'castle': "(() => { const c=castleOf('usurper'), p=cl(c, 8, CAS_S+7); return scene({x:p[0], y:p[1], a:headingOf(c,-0.4,-1), time:0.44, yaw:headingOf(c,-0.55,-1), zoom:2.3, hands:['kite_shield','steel_sword'], armor:'chainmail', mounted:true}); })()",
  'court': "(() => { const c=castleOf('usurper'), p=cl(c, -7, 10); return scene({x:p[0], y:p[1], a:headingOf(c,0,-1), time:0.5, yaw:headingOf(c,0.25,-1), zoom:2.0, hands:['kite_shield','steel_sword'], armor:'chainmail'}); })()",
  'hall': "(() => { const c=castleOf('usurper'), p=cl(c, 2.8, -5.0); return scene({x:p[0], y:p[1], a:headingOf(c,-0.3,-1), time:0.86, yaw:headingOf(c,0,-1), zoom:1.28, hands:['torch','steel_sword'], armor:'chainmail'}); })()",
  'royal': "(() => { const c=castleOf('royal'), p=cl(c, 5.0, -3.0); return scene({x:p[0], y:p[1], a:headingOf(c,1,-0.3), time:0.47, yaw:headingOf(c,0,-1), hands:['kite_shield','steel_sword'], armor:'halfplate'}); })()",
  'ruin': "(() => { const c=castleOf('ruin', 2); return scene({x:c.x-10, y:c.y+CAS_S+9, a:-1.3, time:0.42, zoom:2.3, hands:['torch','longsword'], armor:'chainmail'}); })()",
  'ruin_in': "(() => { const c=castleOf('ruin', 2), p=cl(c, 6, 16); return scene({x:p[0], y:p[1], a:headingOf(c,0,-1), time:0.86, yaw:headingOf(c,0,-1), zoom:1.6, hands:['torch','longsword'], armor:'chainmail', pre:()=>{ for (const [lx,lz,k] of [[2,8,'vampire'],[10,9,'vampire'],[7,3,'witch']]) { const q=l2w(c, lx, lz); const e=spawnEnt(k, q[0], q[1], {D:0}); e.a=Math.atan2(P.y-e.y,P.x-e.x); e.cd=99; e.tT=99; if(k==='witch') e.elev=1.3; } }}); })()",
}
# story, quests, gremlins, haunted manors, the richer ground
SSCENES = {
  'dialogue': "(() => { const st=S.ents.find(e=>e.kind==='stranger'), tav=st.struct, p=l2w(tav, -2.3, 1.1); scene({x:p[0], y:p[1], a:Math.atan2(st.y-p[1], st.x-p[0]), time:0.86, yaw:headingOf(tav,0,-1), zoom:1.3, hands:[null,null], armor:'tunic'}); window.__FREEZE=false; openTalk(st); updateCamera(0,true); window.__FREEZE=true; render(0.05); render(0.05); return 0; })()",
  'questlog': "(() => { const v=villageFor(0,0); scene({x:v.x+2, y:v.y+4, time:0.5, hands:['torch','rusty_sword'], armor:'gambeson'}); const inn=S.ents.find(e=>e.kind==='innkeeper'), pr=S.ents.find(e=>e.kind==='priest'); window.__FREEZE=false; acceptQuest(npcBusiness(inn).offers[0]); acceptQuest(npcBusiness(pr).offers[0]); S.banner=null; openLog(); window.__FREEZE=true; render(0.05); return 0; })()",
  'gremlins': """scene({x:16,y:-74, a:-1.4, time:0.9, hands:['torch','iron_sword'], armor:'leather', style:200, ents:[['gremlin',1.9,0.6,{atk:1,frac:0.6}],['gremlin',2.6,-2.2,{atk:0,frac:0.35}],['gremlin_bomber',8,3,{atk:0,frac:0.65}],['gremlin_shaman',10,-3,{atk:0,frac:0.55}],['gremlin',4.5,4.5,{thief:true,stolen:30,fleeT:9,fleeAge:1}],['gremlin_brute',7,-6.5,{atk:0,frac:0.45}]],
     pre:()=>{ addText(P.x,P.y,2.6,'-30 gold!','#ffd84a',true); }})""",
  'manor_ext': "(() => { const m=nearestManor(16,16,900), p=l2w(m, 3.4, 11.5); return scene({x:p[0], y:p[1], a:headingOf(m,0,-1), time:0.77, yaw:headingOf(m,0,-1), zoom:2.7, hands:['torch','iron_sword'], armor:'leather'}); })()",
  'manor_int': "(() => { const m=nearestManor(16,16,900), p=l2w(m, 1.0, MAN_HZ+1.6); scene({x:p[0], y:p[1], a:headingOf(m,-0.3,-1), time:0.9, yaw:headingOf(m,0,-1), zoom:1.55, hands:['torch','iron_sword'], armor:'chainmail', ents:[['ghost',4.5,2.5,{elev:0.4}],['vlord',8.0,-1.0,{atk:3,frac:0.4}]]}); return 0; })()",
  'ghost': "(() => { const m=nearestManor(16,16,900), p=l2w(m, -12, 10); return scene({x:p[0], y:p[1], a:headingOf(m,0,-1), time:0.88, yaw:headingOf(m,0.3,-1), zoom:1.1, hands:['torch','iron_sword'], armor:'chainmail', ents:[['ghost',2.4,0.6,{atk:0,frac:0.55,elev:0.4}],['ghost',4.5,-2.5,{elev:0.3}],['gremlin',3.5,2.6]]}); })()",
  'ground': "(() => { let s=null; for(let r=180;r<1600 && !s;r+=40) for(let k=0;k<24;k++){ const a=k/24*Math.PI*2, x=Math.cos(a)*r, y=Math.sin(a)*r; if(biomeAt(x,y)===1 && biomeAt(x+10,y)===1 && !nearVillage(x,y,40) && !manorGround(x,y,30) && !castleGround(x,y) && !isWet(tileBase(x,y))) { s=[x,y]; break; } } return scene({x:s[0], y:s[1], time:0.4, hands:['buckler','iron_sword'], armor:'leather', v:2, step:1, zoom:1.25}); })()",
  'road': "(() => { const a=villageFor(0,0), b=villageLinks(a)[0], r=ROADS.get(a.id<b.id?a.id+'|'+b.id:b.id+'|'+a.id) || [...ROADS.values()][0], p=r.pts[1]; return scene({x:p[0], y:p[1], time:0.36, hands:['buckler','iron_sword'], armor:'leather', mounted:true, v:4, step:2, zoom:1.5}); })()",
}

# hotbar, inventory, forge, mining, shop (UI screens are DOM overlays over the frozen scene)
UISETUP = """
window.uikit = function(){
  P.inv=[{id:'steel_sword+2#1',n:1},{id:'claymore',n:1},{id:'long_bow',n:1},{id:'tower_shield',n:1},{id:'halfplate',n:1},{id:'potion',n:5},{id:'bandage',n:3},{id:'arrows',n:24},{id:'pistol',n:1},{id:'crown_blade!s',n:1},{id:'buckler+1',n:1},{id:'chainmail',n:1},{id:'war_bow',n:1}];
  P.hands=['kite_shield','iron_sword+1']; P.armor='leather';
  P.hot=['iron_sword+1','kite_shield','claymore','long_bow','torch','potion','bandage',null]; P.inv.push({id:'torch',n:1}); P.hotSel=0;
  P.mats={iron_ore:7,steel_ingot:4,leather_hide:3,wood:9,cloth:5,herb:4,silver:1,scrap:6,frost_shard:2,ghost_essence:1}; P.gold=412;
};
window.closeAll = function(){ for (const id of ['inv','forge','shop','talk','qlog']) show(id,false); INV.sel=null; FORGE.mg=null; FORGE.res=null; invDragEnd(); };
window.uiscene = function(opts, after){ closeAll(); const pre=opts.pre; opts.pre=()=>{ uikit(); if (pre) pre(); }; scene(opts); if (after) { window.__FREEZE=false; after(); window.__FREEZE=true; render(0.05); } return 0; };
window.oreNear = function(){ const v=villageFor(0,0); let best=null, bd=1e9; for (const c of CHUNKS.values()) for (const o of c.statics) if (o.type==='ore') { const d=Math.hypot(o.x-v.x,o.y-v.y); if (d<bd) { bd=d; best=o; } } return best; };
"""
UISCENES = {
  'hud': "(() => { const v=villageFor(0,0); return uiscene({x:v.x+3, y:v.y+5, a:-1.2, time:0.42, hands:['kite_shield','iron_sword+1'], armor:'leather', pre:()=>{ hotLabel('Iron Sword +1', tierCol(ITEMS['iron_sword+1'])); S.hotLbl.t=1.5; msg('Picked up 2 Leather Hide', '#d8e8b0', 4.5, 'leather_hide'); msg('Picked up Healing Draught', '#ffe6a0', 4.5, 'potion'); }}); })()",
  'inv_drag': "(() => { const v=villageFor(0,0); return uiscene({x:v.x+3, y:v.y+5, time:0.42, hands:['kite_shield','iron_sword+1'], armor:'leather'}, ()=>{ openInv(); }); })()",
  'inv_detail': "(() => { const v=villageFor(0,0); return uiscene({x:v.x+3, y:v.y+5, time:0.42, hands:['kite_shield','iron_sword+1'], armor:'leather'}, ()=>{ openInv(); INV.sel={k:'bag',i:0}; invRender(); const d=document.querySelector('.detail'); if (d) d.scrollIntoView({block:'end'}); }); })()",
  'forge': "(() => { const b=vb('smithy'), p=l2w(b, 0.6, 0.9); return uiscene({x:p[0], y:p[1], a:headingOf(b,-0.6,-1), time:0.62, yaw:headingOf(b,0,-1), hands:['kite_shield','iron_sword+1'], armor:'leather'}, ()=>{ openForge(S.ents.find(e=>e.kind==='smith'),'smith'); }); })()",
  'forge_up': "(() => { const b=vb('smithy'), p=l2w(b, 0.6, 0.9); return uiscene({x:p[0], y:p[1], a:headingOf(b,-0.6,-1), time:0.62, yaw:headingOf(b,0,-1), hands:['kite_shield','iron_sword+1'], armor:'leather'}, ()=>{ openForge(S.ents.find(e=>e.kind==='smith'),'smith'); FORGE.tab='upgrade'; forgeRender(); }); })()",
  'forge_mg': "(() => { const b=vb('smithy'), p=l2w(b, 0.6, 0.9); return uiscene({x:p[0], y:p[1], a:headingOf(b,-0.6,-1), time:0.62, yaw:headingOf(b,0,-1), hands:['kite_shield','iron_sword+1'], armor:'leather'}, ()=>{ openForge(S.ents.find(e=>e.kind==='smith'),'smith'); forgeAct('craft',{r:'smith:steel_sword'}); const m=FORGE.mg.m; m.res=[1]; m.i=1; m.zone=0.62; m.pos=0.48; m.fb='PERFECT!'; m.fbT=0.6; forgeRender(); drawMG(); }); })()",
  'ore': "(() => { const o=oreNear(), a=-0.9, px=o.x-Math.cos(a)*(o.r+1.1), py=o.y-Math.sin(a)*(o.r+1.1); return uiscene({x:px, y:py, a, time:0.4, hands:[null,'iron_sword+1'], armor:'leather', zoom:0.8, pre:()=>{ swing('sword',0,0.6,a); sparks(o.x-Math.cos(a)*0.5, o.y-Math.sin(a)*0.5, 0.7, '!#ffd890', 10, true); addText(o.x, o.y, 1.9, '+1 Iron Ore', '#ffc890', true); msg('Mined Iron Ore (8)', '#d8e8b0', 4, 'iron_ore'); }}); })()",
  'shop': "(() => { const m=S.ents.find(e=>e.kind==='merchant'), b=m.struct, p=b?l2w(b,0.4,0.8):[m.x+1,m.y+1]; return uiscene({x:p[0], y:p[1], time:0.5, yaw:b?headingOf(b,0,-1):undefined, hands:['kite_shield','iron_sword+1'], armor:'leather'}, ()=>{ openShop(m); }); })()",
}
async def ui_main(w, h, touch, tag, only):
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
        ctx = await b.new_context(viewport={'width': w, 'height': h}, has_touch=touch, is_mobile=touch, device_scale_factor=2 if touch else 1)
        pg = await ctx.new_page(); errs = []
        pg.on('console', lambda m: errs.append(m.text) if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
        await pg.goto(URL); await pg.wait_for_timeout(1500)
        await pg.evaluate("document.getElementById('btnNew').click()"); await pg.wait_for_timeout(2500)
        await pg.evaluate(SETUP + UISETUP + '; 0')
        for k, js in UISCENES.items():
            if only and k not in only and 'ui' not in only: continue
            await pg.evaluate(js); await pg.wait_for_timeout(350)
            if k == 'inv_drag':
                a = await pg.evaluate("(() => { const r=document.querySelector('.sl.bag[data-i=\"0\"]').getBoundingClientRect(), t=document.querySelector('.sl.hot[data-i=\"7\"]').getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2, t.x+t.width/2, t.y+t.height/2]; })()")
                await pg.mouse.move(a[0], a[1]); await pg.mouse.down()
                await pg.mouse.move((a[0] + a[2]) / 2, (a[1] + a[3]) / 2, steps=4); await pg.mouse.move(a[2] + 6, a[3] + 4, steps=4)
                await pg.wait_for_timeout(150)
                await pg.screenshot(path=str(SHOTS / f'sc_{tag}_{k}.png'))
                await pg.mouse.up(); await pg.wait_for_timeout(100)
                ok = await pg.evaluate("P.hot[7]")
                print(tag, 'drag dropped onto hotbar slot 8:', ok)
                continue
            await pg.screenshot(path=str(SHOTS / f'sc_{tag}_{k}.png'))
        info = await pg.evaluate("[GLOK, THUMBS.size, [...THUMBS.values()].filter(c=>c.gl).length]")
        print(tag, 'GLOK, thumbs, GL-rendered thumbs:', info)
        errs = [e for e in errs if 'GPU stall due to ReadPixels' not in e]
        print(tag, 'console errors:', len(errs), errs[:10])
        await b.close()
def grid_inventory():
    from PIL import Image, ImageDraw
    order = ['hud', 'inv_drag', 'inv_detail', 'forge', 'forge_up', 'forge_mg', 'ore', 'shop']
    parts = []
    for tag, cols, tw in (('d', 4, 480), ('m', 8, 240)):
        ims = [(n, Image.open(SHOTS / f'sc_{tag}_{n}.png').convert('RGB')) for n in order if (SHOTS / f'sc_{tag}_{n}.png').exists()]
        if not ims: continue
        th = int(ims[0][1].height * tw / ims[0][1].width)
        rows = (len(ims) + cols - 1) // cols
        G = Image.new('RGB', (cols * tw, rows * (th + 18)), (14, 12, 20)); d = ImageDraw.Draw(G)
        for i, (n, im) in enumerate(ims):
            x, y = (i % cols) * tw, (i // cols) * (th + 18)
            G.paste(im.resize((tw, th), Image.LANCZOS), (x, y + 18)); d.text((x + 6, y + 3), n, fill=(240, 220, 160))
        G.save(SHOTS / f'grid_inventory_{tag}.png'); parts.append(G)
    W = max(g.width for g in parts); parts = [g.resize((W, int(g.height * W / g.width)), Image.LANCZOS) for g in parts]
    G = Image.new('RGB', (W, sum(g.height for g in parts) + 8 * (len(parts) - 1)), (0, 0, 0)); y = 0
    for g in parts: G.paste(g, (0, y)); y += g.height + 8
    G.save(SHOTS / 'grid_inventory.png'); print('grid ->', SHOTS / 'grid_inventory.png', G.size)
async def shoot(pg, name, js):
    await pg.evaluate(js)
    await pg.wait_for_timeout(300)
    await pg.screenshot(path=str(SHOTS / f'sc_{name}.png'))
async def main(w, h, touch, tag, only):
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
        ctx = await b.new_context(viewport={'width': w, 'height': h}, has_touch=touch, is_mobile=touch, device_scale_factor=2 if touch else 1)
        pg = await ctx.new_page(); errs = []
        pg.on('console', lambda m: errs.append(m.text) if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
        await pg.goto(URL); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=str(SHOTS / f'sc_{tag}_title.png'))
        await pg.evaluate("document.getElementById('btnNew').click()"); await pg.wait_for_timeout(2500)
        if not only or 'story' in only or 'start' in only:
            await pg.wait_for_timeout(600)
            await pg.screenshot(path=str(SHOTS / f'sc_{tag}_start.png'))
        await pg.evaluate(SETUP + '; 0')
        for k, js in SSCENES.items():
            if only and k not in only and 'story' not in only: continue
            await shoot(pg, tag + '_' + k, js)
        for k, js in SCENES.items():
            if only and (k not in only or 'story' in only): continue
            await shoot(pg, tag + '_' + k, js)
        if (not only or 'snow' in only) and 'story' not in only:
            s = await pg.evaluate("findBiome(2)")
            await shoot(pg, tag + '_snow', f"scene({{x:{s[0]},y:{s[1]}, time:0.5, hands:['torch','longsword'], armor:'chainmail', v:2, step:1, ents:[['frostgiant',9,-3,{{atk:1,frac:0.5}}],['bandit',3.5,2.5]]}})")
        if (not only or 'swamp' in only) and 'story' not in only:
            s = await pg.evaluate("findBiome(3)")
            await shoot(pg, tag + '_swamp', f"scene({{x:{s[0]},y:{s[1]}, time:0.82, hands:['torch','iron_sword'], armor:'leather', ents:[['witch',7,2,{{elev:1.3,atk:1,frac:0.5}}]], pre:()=>{{ S.projs.push({{x:P.x+2,y:P.y-3,elev:1.3,vx:-6,vy:8,vz:0,team:1,dmg:10,life:3,kind:'fire',col:'y',target:P}}); }}}})")
        if (not only or 'desert' in only) and 'story' not in only:
            s = await pg.evaluate("findBiome(5)")
            await shoot(pg, tag + '_desert', f"scene({{x:{s[0]},y:{s[1]}, time:0.42, hands:[null,'long_bow'], ents:[['archer',8,0,{{atk:0,frac:0.6}}]], pre:()=>{{ P.hands=['long_bow','long_bow']; P.act={{k:'bow',t:0.8}}; P.drawing=true; P.draw=0.8; }}}})")
        for k, js in BSCENES.items():
            if only and k not in only and 'b' not in only: continue
            if only and 'story' in only: continue
            if not only and False: continue
            await shoot(pg, tag + '_' + k, js)
        info = await pg.evaluate("[GLOK, RW, RH, SW, SH, GCH.size, lastRenderMs.toFixed(1)]")
        print(tag, 'GLOK, canvas, scene, chunks, last render ms:', info)
        errs = [e for e in errs if 'GPU stall due to ReadPixels' not in e]
        print(tag, 'console errors:', len(errs), errs[:10])
        await b.close()
def grid():
    from PIL import Image, ImageDraw
    order = ['field', 'fight', 'perfect', 'parry', 'giant', 'night', 'village', 'snow', 'mounted', 'swamp', 'desert', 'start']
    for tag, cols, tw in (('d', 3, 640), ('m', 6, 260)):
        ims = [(n, Image.open(SHOTS / f'sc_{tag}_{n}.png').convert('RGB')) for n in order if (SHOTS / f'sc_{tag}_{n}.png').exists()]
        if not ims: continue
        th = int(ims[0][1].height * tw / ims[0][1].width)
        rows = (len(ims) + cols - 1) // cols
        G = Image.new('RGB', (cols * tw, rows * (th + 18)), (14, 12, 20)); d = ImageDraw.Draw(G)
        for i, (n, im) in enumerate(ims):
            x, y = (i % cols) * tw, (i // cols) * (th + 18)
            G.paste(im.resize((tw, th), Image.LANCZOS), (x, y + 18)); d.text((x + 6, y + 3), n, fill=(240, 220, 160))
        G.save(SHOTS / f'grid_toon_{tag}.png')
    a, b = Image.open(SHOTS / 'grid_toon_d.png'), Image.open(SHOTS / 'grid_toon_m.png')
    s = a.width / b.width; b = b.resize((a.width, int(b.height * s)), Image.LANCZOS)
    G = Image.new('RGB', (a.width, a.height + b.height + 8), (0, 0, 0)); G.paste(a, (0, 0)); G.paste(b, (0, a.height + 8)); G.save(SHOTS / 'grid_toon.png')
    print('grid ->', SHOTS / 'grid_toon.png')
def grid_buildings():
    from PIL import Image, ImageDraw
    order = ['vil_day', 'vil_night', 'house', 'tavern', 'smithy', 'chapel', 'castle', 'court', 'hall', 'royal', 'ruin', 'ruin_in']
    parts = []
    for tag, cols, tw in (('d', 3, 640), ('m', 6, 260)):
        ims = [(n, Image.open(SHOTS / f'sc_{tag}_{n}.png').convert('RGB')) for n in order if (SHOTS / f'sc_{tag}_{n}.png').exists()]
        if not ims: continue
        th = int(ims[0][1].height * tw / ims[0][1].width)
        rows = (len(ims) + cols - 1) // cols
        G = Image.new('RGB', (cols * tw, rows * (th + 18)), (14, 12, 20)); d = ImageDraw.Draw(G)
        for i, (n, im) in enumerate(ims):
            x, y = (i % cols) * tw, (i // cols) * (th + 18)
            G.paste(im.resize((tw, th), Image.LANCZOS), (x, y + 18)); d.text((x + 6, y + 3), n, fill=(240, 220, 160))
        G.save(SHOTS / f'grid_buildings_{tag}.png'); parts.append(G)
    W = max(g.width for g in parts); parts = [g.resize((W, int(g.height * W / g.width)), Image.LANCZOS) for g in parts]
    G = Image.new('RGB', (W, sum(g.height for g in parts) + 8 * (len(parts) - 1)), (0, 0, 0)); y = 0
    for g in parts: G.paste(g, (0, y)); y += g.height + 8
    G.save(SHOTS / 'grid_buildings.png'); print('grid ->', SHOTS / 'grid_buildings.png', G.size)
def grid_story():
    from PIL import Image, ImageDraw
    order = ['start', 'dialogue', 'questlog', 'gremlins', 'manor_ext', 'manor_int', 'ghost', 'ground', 'road']
    parts = []
    for tag, cols, tw in (('d', 3, 640), ('m', 5, 300)):
        ims = [(n, Image.open(SHOTS / f'sc_{tag}_{n}.png').convert('RGB')) for n in order if (SHOTS / f'sc_{tag}_{n}.png').exists()]
        if not ims: continue
        th = int(ims[0][1].height * tw / ims[0][1].width)
        rows = (len(ims) + cols - 1) // cols
        G = Image.new('RGB', (cols * tw, rows * (th + 18)), (14, 12, 20)); d = ImageDraw.Draw(G)
        for i, (n, im) in enumerate(ims):
            x, y = (i % cols) * tw, (i // cols) * (th + 18)
            G.paste(im.resize((tw, th), Image.LANCZOS), (x, y + 18)); d.text((x + 6, y + 3), n, fill=(240, 220, 160))
        G.save(SHOTS / f'grid_story_{tag}.png'); parts.append(G)
    W = max(g.width for g in parts); parts = [g.resize((W, int(g.height * W / g.width)), Image.LANCZOS) for g in parts]
    G = Image.new('RGB', (W, sum(g.height for g in parts) + 8 * (len(parts) - 1)), (0, 0, 0)); y = 0
    for g in parts: G.paste(g, (0, y)); y += g.height + 8
    G.save(SHOTS / 'grid_story.png'); print('grid ->', SHOTS / 'grid_story.png', G.size)
async def run():
    tags = [a for a in sys.argv[1:] if a in ('d', 'm', 'l')] or ['d', 'm']
    only = [a for a in sys.argv[1:] if a not in ('d', 'm', 'l')]
    if only and all(o in UISCENES or o == 'ui' for o in only):
        if 'd' in tags: await ui_main(1280, 720, False, 'd', only)
        if 'm' in tags: await ui_main(390, 844, True, 'm', only)
        if 'l' in tags: await ui_main(844, 390, True, 'l', only)
        return
    if 'd' in tags: await main(1280, 720, False, 'd', only)
    if 'm' in tags: await main(390, 844, True, 'm', only)
if __name__ == '__main__':
    if sys.argv[1:2] == ['grid']: grid(); grid_buildings(); grid_story()
    elif sys.argv[1:2] == ['grids']: grid_story()
    elif sys.argv[1:2] == ['gridi']: grid_inventory()
    elif sys.argv[1:2] == ['gridb']: grid_buildings()
    else: asyncio.run(run())
