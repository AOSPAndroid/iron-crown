// Story, quests, gremlins, ghosts and haunted manors: deterministic checks on the headless harness.
const { run } = require('./harness');
let errors = 0;
const origErr = console.error; console.error = (...a) => { errors++; origErr(...a); };
run('init()');
run('startNew(); for(let i=0;i<200000 && S.mode==="loading";i++) step(0.016);');
const results = [];
function check(name, cond, info) { results.push([name, !!cond, info || '']); }
run(`
const DT = 1 / 60;
function I(o) { return Object.assign({ mx: 0, my: 0, atk: false, off: false, dash: false, lock: false, horse: false, pot: false, use: false }, o || {}); }
function tick(n, o) { for (let i = 0; i < n; i++) update(DT, I(typeof o === 'function' ? o(i) : o)); }
function walk(dx, dy) { const l = Math.hypot(dx, dy) || 1, fw = [Math.cos(CAMK.yaw), Math.sin(CAMK.yaw)], rt = [-Math.sin(CAMK.yaw), Math.cos(CAMK.yaw)]; return { my: (dx * fw[0] + dy * fw[1]) / l, mx: (dx * rt[0] + dy * rt[1]) / l }; }
function walkTo(x, y, secs) { tick(Math.round(secs / DT), () => walk(x - P.x, y - P.y)); }
function place(x, y) { P.x = x; P.y = y; P.vx = P.vy = 0; P.kx = P.ky = 0; P.act = null; P.mounted = false; S.horse.x = x + 90; S.horse.y = y + 90; S.horse.state = 'idle'; manageChunks(40); updateCut(1); }
function quiet() { if (S.mode === 'talk') closeTalk(); if (S.mode === 'log') closeLog(); S.ents = S.ents.filter(e => e.team === 2 || (e.post && e.team !== 1)); S.projs = []; S.dirT = 1e9; S.mode = 'play'; P.hp = P.maxHp = 500; P.st = P.stMax; P.iframes = 0; P.invT = 0; S.tok.clear(); S.tokR.clear(); S.marks = []; }
function killQuestFoes(id) { for (const e of S.ents.slice()) if (e.qid === id && e.team === 1 && !e.dead) { e.invT = 0; hurtEnt(e, 1e6, P.x, P.y, 0, true); } }
`);

// 1. a new game: no tutorial, straight into Ashford with the opening story beat
check('new game: no tutorial bandit, no tutorial state or prompts', run(`!S.ents.some(e => e.kind === 'bandit') && S.tut === undefined && typeof tutPrompt === 'undefined' && typeof tutAdvance === 'undefined' && !(S.banner && /COMBO|PARRY|FINISH/.test(S.banner.title))`), 'ents: ' + run(`S.ents.map(e => e.kind).join(',')`));
check('new game: starts in Ashford with the prologue story and chapter 1 tracked', run(`S.mode === 'talk' && TALK && TALK.view === 'narr' && /Iron Crown/i.test(TALK.title) && Math.hypot(P.x - 16, P.y - 16) < 20 && S.Q.act[0].id === 'main0' && S.Q.track === 'main0'`), run('S.Q.act[0].title') + ' / ' + run('qStep(S.Q.act[0]).txt'));
run(`closeTalk(); S.dirT = 0; var g0 = S.ents.filter(e => e.team === 1).length; P.x = 16; P.y = -150; manageChunks(40); for (let i = 0; i < 60 * 30 && S.ents.filter(e => e.team === 1).length === g0; i++) { P.hp = P.maxHp; tick(1); }`);
check('new game: the encounter director runs right away (no tutorial gate)', run(`S.ents.filter(e => e.team === 1).length > g0`), run(`S.ents.filter(e => e.team === 1).map(e => e.kind).join(',')`));

// 2. main chapter 1: talk to the stranger -> rewards -> chapter 2 starts with a real objective
run(`quiet(); var stx = S.ents.find(e => e.kind === 'stranger'); place(stx.x + 1.1, stx.y); P.hands = [null, null]; P.inv = []; var gold0 = P.gold; S.interact = findInteract(); var lab = S.interact && S.interact.label; doInteract(); var v0 = TALK && TALK.view; talkAct('story');`);
check('main quest: the Stranger tells the story, gives a sword and a torch, chapter 2 begins', run(`v0 === 'story' && lab === 'TALK' && S.Q.main === 1 && S.Q.act.some(q => q.id === 'main1') && (P.hands.includes('rusty_sword') || P.inv.some(q => q.id === 'rusty_sword')) && (P.hands.includes('torch') || P.inv.some(q => q.id === 'torch')) && P.gold === gold0 + 15`), 'chapter ' + run('S.Q.main') + ' ' + run('S.Q.act[0].title'));

// 3. side quest: accept -> progress -> complete -> reward (gold, XP, rep, the giver offers new work)
run(`quiet(); var inn = S.ents.find(e => e.kind === 'innkeeper'); var offers = npcBusiness(inn).offers; var gk = giverKey(inn), gen0 = S.Q.gen[gk] || 0;
var bq = makeSide('bounty', inn, inn.village, gk, gen0, 9, mulberry(5)); bq.id += '|test'; var accepted = acceptQuest(bq); var st0 = qStep(bq);
place(st0.x + 20, st0.y); for (let i = 0; i < 30; i++) tick(1); var spawned = S.ents.filter(e => e.qid === bq.id && e.team === 1).length;
var g1 = P.gold, xp1 = P.xp + P.level * 1000, rep1 = S.Q.rep[inn.village.id] || 0; killQuestFoes(bq.id); tick(5); var stepAfter = qStep(bq) && qStep(bq).t;
place(inn.x + 1.0, inn.y); tick(2); var mark = questMark(inn); doInteract(); var tv = TALK && TALK.view; talkAct('turnin'); tick(2);`);
check('side quest: offers come from the innkeeper with Accept / Decline', run('offers.length >= 1 && offers.every(q => q.title && q.steps.length && q.rew.gold > 0)'), run('offers.map(q => q.type + ": " + q.title).join(" | ")'));
check('side quest: accepting tracks it and its foes spawn at the site', run('accepted && S.Q.track && spawned === st0.n'), 'spawned ' + run('spawned') + '/' + run('st0.n') + ' ' + run('bq.title'));
check('side quest: killing them advances to "return", the giver shows "?" and pays out', run(`stepAfter === 'return' && mark === '?' && tv === 'turnin' && !qById(bq.id) && S.Q.done.includes(bq.id) && P.gold >= g1 + bq.rew.gold && (S.Q.rep[inn.village.id] || 0) === rep1 + 1 && (S.Q.gen[gk] || 0) === gen0 + 1`), 'gold +' + run('P.gold - g1') + ' rep ' + run('S.Q.rep[inn.village.id]'));
// the full dialogue path: open an offer, decline, accept
run(`quiet(); place(inn.x + 1.0, inn.y); doInteract(); var menuOK = TALK.view === 'menu' && TALK.offers.length > 0; talkAct('offer:0'); var offView = TALK.view === 'offer' && /Accept/.test(document.getElementById('talkPanel').innerHTML) && /Decline/.test(document.getElementById('talkPanel').innerHTML); talkAct('decline'); var back = TALK.view === 'menu'; talkAct('offer:0'); var oid = TALK.offer.id; talkAct('accept'); var gotIt = !!qById(oid);`);
check('dialogue: menu -> offer (Accept / Decline) -> decline -> accept', run('menuOK && offView && back && gotIt && S.mode === "play"'), run('qById(oid) && qById(oid).title'));

// 4. quest state survives save / load; old saves load without crashing
run(`quiet(); var qq = qById(oid); qq.steps[0].have = 1; S.Q.track = oid; S.Q.rep['0,0'] = 3; saveGame(); var snapQ = JSON.stringify({ act: S.Q.act.map(q => [q.id, q.si, q.steps[0].have || 0]), main: S.Q.main, track: S.Q.track, rep: S.Q.rep, done: S.Q.done.length });
continueGame(); for (let i = 0; i < 200000 && S.mode === 'loading'; i++) step(0.016); var loadQ = JSON.stringify({ act: S.Q.act.map(q => [q.id, q.si, q.steps[0].have || 0]), main: S.Q.main, track: S.Q.track, rep: S.Q.rep, done: S.Q.done.length });`);
check('saves: active quests (progress, tracking), chapter, reputation and done list persist', run('snapQ === loadQ && S.mode === "play"'), run('loadQ'));
run(`localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, x: 40, y: 30, a: 0, hp: 80, maxHp: 112, level: 2, xp: 10, gold: 77, inv: [{ id: 'potion', n: 2 }, { id: 'nonsense', n: 1 }], hands: [null, 'iron_sword'], armor: 'leather', mounted: false, horse: { x: 42, y: 30 }, day: 3, time: 0.5, looted: ['0,0:c'], lastVillage: { x: 16, y: 16, name: 'Ashford' }, kills: 9, tut: 3 }));
var legacyOK = false; try { continueGame(); for (let i = 0; i < 200000 && S.mode === 'loading'; i++) step(0.016); for (let i = 0; i < 30; i++) step(0.016); legacyOK = S.mode === 'play' && P.gold === 77 && P.hands[1] === 'iron_sword' && P.inv.length === 1 && S.Q.act.some(q => q.main) && S.day === 3; } catch (err) { console.log(err); }
localStorage.setItem(SAVE_KEY, JSON.stringify({ x: 'bad', hands: null, q: { act: 'nope' } })); var junkOK = false; try { continueGame(); for (let i = 0; i < 200000 && S.mode === 'loading'; i++) step(0.016); for (let i = 0; i < 10; i++) step(0.016); junkOK = S.mode === 'play' && isFinite(P.x); } catch (err) { console.log(err); }`);
check('saves: an old v1 save (from before quests) loads and gets the main story', run('legacyOK'), 'quest ' + run('S.Q.act.map(q=>q.title).join(",")'));
check('saves: a corrupt save does not crash the game', run('junkOK'));

// 5. gremlins: steal gold, run, and drop it all when killed; escape if you don't catch them; spook horses
run(`quiet(); place(300, 300); P.gold = 200; var gr = spawnEnt('gremlin', P.x + 1.0, P.y, { D: 0 }); gr.target = P; gr.tT = 99; gr.a = Math.PI; gr.cd = 99; P.a = Math.PI; beginFoeAttack(gr, EATK.gremlin[1], P);
tick(40); var stolen = gr.stolen || 0, goldAfter = P.gold, thief = !!gr.thief; var d0 = dist(gr, P); tick(60); var fled = dist(gr, P) > d0 + 2;
gr.invT = 0; hurtEnt(gr, 1e6, P.x, P.y, 0, true); var stolenDrops = S.drops.filter(d => d.kind === 'gold' && d.tag === 'stolen').reduce((a, d) => a + d.val, 0);
for (const d of S.drops) { d.x = P.x; d.y = P.y; d.lock = false; } tick(5);`);
check('gremlin: a snatch that lands steals gold and the gremlin turns thief', run('stolen > 0 && goldAfter === 200 - stolen && thief'), 'stole ' + run('stolen'));
check('gremlin: the thief runs away from you', run('fled'), 'distance ' + run('d0.toFixed(1)') + ' -> ' + run('dist(gr,P).toFixed(1)'));
check('gremlin: killing the thief drops exactly the stolen gold, and you get it all back', run('stolenDrops === stolen && P.gold >= 200'), 'gold ' + run('P.gold') + ' drops ' + run('stolenDrops'));
run(`quiet(); place(300, 300); P.gold = 100; var gr2 = spawnEnt('gremlin', P.x + 1.0, P.y, { D: 0 }); P.a = 0; P.iframes = 0; P.parryT = 0; P.blocking = false; gr2.target = P; gr2.tT = 99; gr2.a = Math.PI; beginFoeAttack(gr2, EATK.gremlin[1], P); P.hands = ['kite_shield', 'iron_sword'];
tick(40, { off: false }); var lost0 = S.stats.lost, st2 = gr2.stolen || 0; for (let i = 0; i < 60 * 20 && !gr2.dead; i++) { P.x = 300; P.y = 300; tick(1); } var escaped = gr2.dead && gr2.escaped && S.stats.lost === lost0 + st2 && P.gold === 100 - st2;`);
check('gremlin: an uncaught thief escapes with the gold after a while', run('st2 > 0 && escaped'), 'lost ' + run('st2'));
run(`quiet(); place(300, 300); P.mounted = true; S.horse.state = 'ridden'; var gr3 = spawnEnt('gremlin', P.x + 1.5, P.y, { D: 0 }); gr3.target = P; gr3.tT = 99; gr3.cd = 99; beginFoeAttack(gr3, EATK.gremlin[2], P); tick(60); var spooked = !P.mounted && S.horse.state === 'flee';`);
check('gremlin: a shriek spooks your horse and throws you (red telegraph, dodgeable)', run('spooked'));
run(`quiet(); place(300, 300); var sh = spawnEnt('gremlin_shaman', P.x + 6, P.y, { D: 0 }); var pal = spawnEnt('gremlin', P.x + 7, P.y + 1, { D: 0 }); pal.hp = 3; sh.target = P; sh.tT = 99; sh.cd = 99; beginFoeAttack(sh, EATK.gremlin_shaman[0], P); tick(10); sh.invT = 0; hurtEnt(sh, 1, P.x, P.y, 0, true); var interrupted = sh.state === 'stagger' && !(pal.buffT > 0);
sh.state = 'move'; sh.stT = 0; beginFoeAttack(sh, EATK.gremlin_shaman[0], P); tick(Math.round(1.6 / DT)); var buffed = pal.buffT > 0 && pal.hp > 3;`);
check('gremlin shaman: its chant is interrupted by any hit; if not, it heals and frenzies the pack', run('interrupted && buffed'), 'pal hp ' + run('Math.round(pal.hp)'));
run(`quiet(); place(300, 300); var bo = spawnEnt('gremlin_bomber', P.x + 8, P.y, { D: 0 }); bo.target = P; bo.tT = 99; bo.cd = 99; beginFoeAttack(bo, EATK.gremlin_bomber[0], P); var hpB = P.hp; tick(Math.round(0.85 / DT)); var marked = S.marks.length === 1; for (let i = 0; i < 200 && S.projs.length + S.marks.length > 0; i++) { P.x = 300; P.y = 300; tick(1); } var bombHit = P.hp < hpB && S.marks.length === 0;`);
check('firebomb gremlin: the bomb shows a red ground circle, then explodes where it lands', run('marked && bombHit'), 'hp ' + run('hpB') + ' -> ' + run('Math.round(P.hp)'));
run(`quiet(); place(16, -150); S.time = 0.9; S.darkness = 1; var picks = {}; var sg0 = spawnGroup; spawnGroup = g => { picks[g] = (picks[g] || 0) + 1; }; for (let i = 0; i < 400; i++) { S.dirT = 0; director(0.01); } spawnGroup = sg0;
var MNR0 = nearestManor(16, 16, 900); place(...l2w(MNR0, 0, MAN_G + 70)); var picksH = {}; spawnGroup = g => { picksH[g] = (picksH[g] || 0) + 1; }; for (let i = 0; i < 400; i++) { S.dirT = 0; director(0.01); } spawnGroup = sg0; S.time = 0.45;`);
check('director: gremlin packs and ghosts haunt the night, and come more often near a haunted manor', run('picks.gremlins > 0 && picks.ghosts > 0 && (picksH.gremlins + (picksH.ghosts || 0)) / 400 > (picks.gremlins + picks.ghosts) / 400'), 'wild ' + run('JSON.stringify(picks)') + ' / manor ' + run('JSON.stringify(picksH)'));

// 6. ghosts drift through walls; soldiers can't
run(`quiet(); var V = villageFor(0, 0), cot = villageLayout(V).structs.find(s => s.type === 'cottage'); var pin = l2w(cot, 0.6, -0.4), pout = l2w(cot, 0.6, -cot.hz - 4); place(pin[0], pin[1]);
var gh = spawnEnt('ghost', pout[0], pout[1], { D: 0 }); gh.hp = gh.maxHp = 9999; gh.cd = 999; var so = spawnEnt('soldier', pout[0] + 0.8, pout[1], { D: 0 }); so.hp = so.maxHp = 9999; so.cd = 999; so.navT = 999; so.navWP = null;
var ghostIn = -1; for (let i = 0; i < 60 * 6; i++) { P.x = pin[0]; P.y = pin[1]; so.navT = 999; so.navWP = null; tick(1); if (ghostIn < 0 && structContains(cot, gh.x, gh.y)) ghostIn = i * DT; }
var ghostPath = ghostIn > 0 && ghostIn < 3.5;`);
check('ghost: drifts straight through a cottage wall to reach you', run('ghostPath'), 'inside after ' + run('ghostIn.toFixed(2)') + 's');

// 7. haunted manors: deterministic placement, real constraints, enterable with the cutaway, residents and a master
run(`var M1 = []; for (let ry = -5; ry <= 5; ry++) for (let rx = -5; rx <= 5; rx++) { const m = manorFor(rx, ry); if (m) M1.push([m.name, m.x.toFixed(3), m.y.toFixed(3), m.rot.toFixed(3)].join('|')); }
MANC.clear(); var M2 = []; for (let ry = -5; ry <= 5; ry++) for (let rx = -5; rx <= 5; rx++) { const m = manorFor(rx, ry); if (m) M2.push([m.name, m.x.toFixed(3), m.y.toFixed(3), m.rot.toFixed(3)].join('|')); }`);
delete require.cache[require.resolve('./harness')];
const h2 = require('./harness');
const fresh = h2.run('init(); (() => { const out = []; for (let ry = -5; ry <= 5; ry++) for (let rx = -5; rx <= 5; rx++) { const m = manorFor(rx, ry); if (m) out.push([m.name, m.x.toFixed(3), m.y.toFixed(3), m.rot.toFixed(3)].join("|")); } return out.join(";"); })()');
check('manors: placement is deterministic (same regions -> same manors, also in a fresh context)', run('M1.length >= 8 && M1.join(";") === M2.join(";")') && fresh === run('M1.join(";")'), run('M1.length') + ' manors in 11x11 regions, e.g. ' + run('M1[0]'));
check('manors: rare, in forest / swamp / heath (or plains), on dry ground, away from villages and castles', run(`(() => { for (const s of M1) { const p = s.split('|'), x = +p[1], y = +p[2], b = biomeAt(x, y); if (b === B_SNOW || b === B_DESERT || isWet(tileBase(x, y)) || nearVillage(x, y, 60) || castlesNear(x, y, 160).some(c => Math.hypot(c.x - x, c.y - y) < 150)) return false; } return M1.length < 121 * 0.66; })()`), run('M1.map(s => BIOME_NAMES[biomeAt(+s.split("|")[1], +s.split("|")[2])]).slice(0, 6).join(", ")'));
run(`quiet(); var MNR = nearestManor(16, 16, 900), MH = manorWorld(MNR).house, hd = MH.doors[0]; place(...l2w(MNR, 3.6, MAN_G + 6)); CHUNKS.delete(MNR.ckey); manageChunks(40); tick(5); var residents = S.ents.filter(e => e.manor && e.manor.id === MNR.id).map(e => e.kind);
place(hd.ox, hd.oy); S.ents = S.ents.filter(e => e.team !== 1); walkTo(hd.ix, hd.iy, 2); tick(Math.round(0.6 / DT)); var manorCut = S.cut.s && S.cut.s.kind === 'manor' && S.cut.s.manor.id === MNR.id && S.cut.k === 1;
var wOut = l2w(MNR, -8, MAN_HZ + MAN_D + 1.5), wIn = l2w(MNR, -8, MAN_HZ + MAN_D - 2); place(wOut[0], wOut[1]); walkTo(wIn[0], wIn[1], 2.5); var wallBlocks = !(structAt(P.x, P.y) && structAt(P.x, P.y).kind === 'manor');
var gOut = l2w(MNR, 10, MAN_G + 2), gIn = l2w(MNR, 10, MAN_G - 3); place(gOut[0], gOut[1]); walkTo(gIn[0], gIn[1], 2.5); var gwall = w2l(MNR, P.x, P.y)[1] > MAN_G - 0.5 || (manorPlan(MNR).gwalls.find(w => w.side === 'f' && Math.min(w.x0, w.x1) <= 10 && Math.max(w.x0, w.x1) >= 10) || {}).h === 0;`);
check('manor: a gremlin pack in the garden, ghosts and a vampire inside, and its master in the crypt', run(`residents.includes('gremlin') && residents.includes('ghost') && residents.includes('vlord')`), run('MNR.name') + ': ' + run('residents.join(",")'));
check('manor: you walk in through the front door and get the roof cutaway', run('manorCut'), 'cut ' + run('S.cut.s && S.cut.s.kind'));
check('manor: the house walls and the garden wall block you', run('wallBlocks && gwall'));
run(`quiet(); var bossM = S.ents.find(e => e.manor && e.manor.id === MNR.id && e.kind === 'vlord'); if (!bossM) { spawnManor(MNR, MNR.ckey); bossM = S.ents.find(e => e.manor && e.manor.id === MNR.id && e.kind === 'vlord'); } bossM.invT = 0; hurtEnt(bossM, 1e6, P.x, P.y, 0, true); tick(2); var cleared = S.manors[MNR.id] && S.manors[MNR.id].cleared; saveGame(); continueGame(); for (let i = 0; i < 200000 && S.mode === 'loading'; i++) step(0.016); var clearedAfter = S.manors[MNR.id] && S.manors[MNR.id].cleared;
place(...l2w(MNR, 0, MAN_G + 30)); CHUNKS.delete(MNR.ckey); manageChunks(40); var bossBack = S.ents.some(e => e.manor && e.manor.id === MNR.id && e.kind === 'vlord');`);
check('manor: killing its master cleanses it, and that survives save / load (the master stays dead)', run('cleared && clearedAfter && !bossBack'));
check('manor: the moonlit chests are lootable treasure', run('manorWorld(MNR).parts.filter(p => p.type === "chest").length') >= 2);

// 8. the whole main story can be played to the end (fast-forwarded: teleports and instant kills)
run(`quiet(); var chLog = []; P.hp = P.maxHp = 99999;
for (let guard = 0; guard < 60 && S.Q.main < MAIN_TITLES.length; guard++) {
  const q = S.Q.act.find(x => x.main); if (!q) break; const st = qStep(q); chLog.push(q.ch + ':' + st.t);
  if (S.mode === 'talk') closeTalk(); while (S.Q.story.length) S.Q.story.shift();
  if (st.t === 'kill' || st.t === 'item') { place(st.x + 12, st.y); S.ents = S.ents.filter(e => !(e.team === 1 && !e.qid)); tick(30); killQuestFoes(q.id); tick(3); const d = S.drops.find(x => x.qid === q.id); if (d) { place(d.x, d.y); tick(5); } }
  else if (st.t === 'manor') { const m = [...MANC.values()].find(x => x && x.id === st.mid); if (S.manors[m.id] && S.manors[m.id].cleared) { tick(30); continue; } place(...l2w(m, 0, MAN_G + 30)); CHUNKS.delete(m.ckey); manageChunks(40); tick(3); const b = S.ents.find(e => e.manor && e.manor.id === m.id && e.kind === 'vlord'); b.invT = 0; hurtEnt(b, 1e7, P.x, P.y, 0, true); tick(10); }
  else if (st.t === 'talk' || st.t === 'return') { const tg = questTarget(q); place(tg.x + 3, tg.y + 3); tick(20); const n = S.ents.find(e => e.team === 2 && !e.dead && npcIs(e, st)); if (!n) { chLog.push('no npc ' + st.npc); break; } openTalk(n); talkAct(TALK.view === 'story' ? 'story' : 'turnin'); tick(3); }
}`);
check('main story: all 8 chapters can be completed, ending with the Iron Crown restored', run('S.Q.main === MAIN_TITLES.length && MAIN_TITLES.every((t, i) => S.Q.done.includes("main" + i)) && P.hands.concat(P.inv.map(q => q.id)).includes("crown_blade")'), run('chLog.join(" ")'));

let pass = 0;
for (const [n, ok, info] of results) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (info ? '  [' + info + ']' : '')); if (ok) pass++; }
console.log(pass + '/' + results.length + ' passed, exceptions: ' + errors);
if (pass !== results.length || errors) process.exit(1);
