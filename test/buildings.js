// Enterable buildings and castles: wall collision, doors and gates, cutaway state, navigation, placement, saves.
const { run } = require('./harness');
let errors = 0;
const origErr = console.error; console.error = (...a) => { errors++; origErr(...a); };
run('init()');
run('startNew(); for(let i=0;i<200000 && S.mode==="loading";i++) step(0.016);');
run(`
const DT = 1 / 60;
function I(o) { return Object.assign({ mx: 0, my: 0, atk: false, off: false, dash: false, lock: false, horse: false, pot: false, use: false }, o || {}); }
// camera-relative stick input that walks in world direction (dx, dy)
function walk(dx, dy) { const l = Math.hypot(dx, dy) || 1, fw = [Math.cos(CAMK.yaw), Math.sin(CAMK.yaw)], rt = [-Math.sin(CAMK.yaw), Math.cos(CAMK.yaw)]; return { my: (dx * fw[0] + dy * fw[1]) / l, mx: (dx * rt[0] + dy * rt[1]) / l }; }
function tick(n, o) { for (let i = 0; i < n; i++) update(DT, I(typeof o === 'function' ? o(i) : o)); }
function walkTo(x, y, secs, extra) { tick(Math.round(secs / DT), () => Object.assign(walk(x - P.x, y - P.y), extra || {})); }
function place(x, y) { P.x = x; P.y = y; P.vx = P.vy = 0; P.kx = P.ky = 0; P.act = null; P.mounted = false; S.horse.x = x + 90; S.horse.y = y + 90; S.horse.state = 'idle'; manageChunks(40); updateCut(1); }
function quiet() { S.ents = S.ents.filter(e => e.team === 2 || (e.post && e.team !== 1)); S.projs = []; S.dirT = 1e9; S.tut = 3; S.mode = 'play'; P.hp = P.maxHp = 500; P.st = P.stMax; P.iframes = 0; S.tok.clear(); S.tokR.clear(); }
var V = villageFor(0, 0), VL = villageLayout(V);
function bld(type) { return VL.structs.find(s => s.type === type); }
`);
const results = [];
function check(name, cond, info) { results.push([name, !!cond, info || '']); }

// 1. walls block movement (walking and rolling); the door is a walkable gap
run(`quiet(); var cot = bld('cottage'); var back = l2w(cot, 0.6, -cot.hz - 1.2), inBack = l2w(cot, 0.6, 0); place(back[0], back[1]); walkTo(inBack[0], inBack[1], 2.5);
var wallOK = !structContains(cot, P.x, P.y) && Math.abs(w2l(cot, P.x, P.y)[1]) > cot.hz + 0.2;
place(back[0], back[1]); for (let k = 0; k < 4; k++) { const d = walk(inBack[0] - P.x, inBack[1] - P.y); tick(1, Object.assign({ dash: true }, d)); tick(Math.round(0.5 / DT), d); }
var rollOK = !structContains(cot, P.x, P.y);`);
check('wall collision: walking into a cottage wall does not get you inside', run('wallOK'), 'local=' + run('w2l(cot,P.x,P.y).map(v=>v.toFixed(2)).join(",")'));
check('wall collision: rolling into the wall does not pass through it', run('rollOK'), 'local=' + run('w2l(cot,P.x,P.y).map(v=>v.toFixed(2)).join(",")'));
run(`quiet(); var door = cot.doors[0]; place(door.ox + (door.ox - door.ix) * 1.2, door.oy + (door.oy - door.iy) * 1.2); walkTo(door.ox, door.oy, 1.2); walkTo(door.ix, door.iy, 1.5); var inside = structAt(P.x, P.y) === cot;`);
check('door: walking through the doorway gets you inside', run('inside'), 'struct=' + run('(structAt(P.x,P.y)||{}).type'));

// 2. cutaway state: set while inside, cleared on exit
run(`tick(Math.round(0.6 / DT)); var cutIn = S.cut.s === cot && S.cut.k === 1; var zoomIn = CAMK.zoom < 1;
walkTo(door.ox + (door.ox - door.ix) * 2, door.oy + (door.oy - door.iy) * 2, 2.5); tick(Math.round(0.8 / DT)); var cutOut = S.cut.s === null && S.cut.k === 0 && !structAt(P.x, P.y);`);
check('cutaway: inside the house the roof cut is fully on (and the camera eases in)', run('cutIn') && run('zoomIn'), 'k=' + run('S.cut.k') + ' zoom=' + run('CAMK.zoom.toFixed(2)'));
check('cutaway: leaving the house clears it', run('cutOut'), 'k=' + run('S.cut.k') + ' s=' + run('S.cut.s && S.cut.s.type'));

// 3. mounted: too wide for a cottage door, fits a castle gate
run(`quiet(); place(door.ox + (door.ox - door.ix) * 1.5, door.oy + (door.oy - door.iy) * 1.5); P.mounted = true; S.horse.state = 'ridden'; walkTo(door.ix, door.iy, 3); var horseOut = structAt(P.x, P.y) !== cot; P.mounted = false;`);
check('horse: a mounted rider cannot squeeze through a cottage door', run('horseOut'));

// 4. castles: deterministic placement, the gate is open, the curtain wall is not
run(`var CS1 = []; for (let ry = -5; ry <= 5; ry++) for (let rx = -5; rx <= 5; rx++) { const c = castleFor(rx, ry); if (c) CS1.push([c.name, c.kind, c.x.toFixed(3), c.y.toFixed(3), c.rot.toFixed(3)].join('|')); }
CASC.clear(); var CS2 = []; for (let ry = -5; ry <= 5; ry++) for (let rx = -5; rx <= 5; rx++) { const c = castleFor(rx, ry); if (c) CS2.push([c.name, c.kind, c.x.toFixed(3), c.y.toFixed(3), c.rot.toFixed(3)].join('|')); }
var castleSame = CS1.length > 5 && CS1.join(';') === CS2.join(';');`);
// a fresh JS context must produce the same castles
delete require.cache[require.resolve('./harness')];
const h2 = require('./harness');
const fresh = h2.run('init(); (() => { const out = []; for (let ry = -5; ry <= 5; ry++) for (let rx = -5; rx <= 5; rx++) { const c = castleFor(rx, ry); if (c) out.push([c.name, c.kind, c.x.toFixed(3), c.y.toFixed(3), c.rot.toFixed(3)].join("|")); } return out.join(";"); })()');
check('castles: placement is deterministic (same region cells -> same castles, also in a fresh context)', run('castleSame') && fresh === run('CS1.join(";")'), run('CS1.length') + ' castles in 11x11 regions');
check('castles: about one per 12x12-chunk region where the land allows (plains / heath / snow, no water, away from villages)', run(`(() => { let ok = true; for (const s of CS1) { const p = s.split('|'), x = +p[2], y = +p[3], b = biomeAt(x, y); if (![B_PLAINS, B_HEATH, B_SNOW].includes(b) || isWet(tileBase(x, y)) || nearVillage(x, y, 80)) ok = false; } return ok; })()`), run('CS1.slice(0,3).join("  ")'));
run(`quiet(); var CA = nearestCastle(16, 16, 900); var gateOut = l2w(CA, 0, CAS_S + 8), gateIn = l2w(CA, 0, CAS_S - 10); place(gateOut[0], gateOut[1]); walkTo(gateIn[0], gateIn[1], 4); var inCastle = castleAt(P.x, P.y) === CA;
P.mounted = true; S.horse.state = 'ridden'; place(gateOut[0], gateOut[1]); P.mounted = true; walkTo(gateIn[0], gateIn[1], 3); var rideIn = castleAt(P.x, P.y) === CA; P.mounted = false;
var wOut = l2w(CA, 16, CAS_S + 4), wIn = l2w(CA, 16, CAS_S - 10); place(wOut[0], wOut[1]); walkTo(wIn[0], wIn[1], 3); var wallBlocks = castleAt(P.x, P.y) !== CA;
for (let k = 0; k < 4; k++) { const d = walk(wIn[0] - P.x, wIn[1] - P.y); tick(1, Object.assign({ dash: true }, d)); tick(Math.round(0.5 / DT), d); } var wallBlocks2 = castleAt(P.x, P.y) !== CA;`);
check('castle gate: you can walk through the open gate into the courtyard', run('inCastle'), run('CA.name') + ' local=' + run('w2l(CA,P.x,P.y).map(v=>v.toFixed(1)).join(",")'));
check('castle gate: a rider fits through the gate too', run('rideIn'));
check('castle walls: the curtain wall blocks walking and rolling', run('wallBlocks') && run('wallBlocks2'), 'local=' + run('w2l(CA,P.x,P.y).map(v=>v.toFixed(1)).join(",")'));
run(`quiet(); var K = castleWorld(CA).keep, kd = K.doors[0]; place(kd.ox, kd.oy); walkTo(kd.ix, kd.iy, 2); tick(Math.round(0.6 / DT)); var keepCut = S.cut.s === K && S.cut.k === 1 && K.parent === castleWorld(CA).court;`);
check('keep: its great hall is enterable and gets the same cutaway', run('keepCut'), 'cut=' + run('S.cut.s && S.cut.s.kind'));

// 5. projectiles hit walls; melee doesn't reach through them
run(`quiet(); place(...l2w(cot, 0, 0)); var a0 = l2w(cot, 0, -cot.hz - 6); S.projs.push({ x: a0[0], y: a0[1], elev: 1.25, vx: (P.x - a0[0]) / 6 * 24, vy: (P.y - a0[1]) / 6 * 24, vz: 0, team: 1, dmg: 20, life: 2, kind: 'arrow', col: 'y' }); var hpA = P.hp; tick(90); var arrowStopped = P.hp === hpA && S.projs.length === 0;`);
check('projectiles: an arrow shot at a wall stops there (you inside are not hit)', run('arrowStopped'), 'hp ' + run('hpA') + '->' + run('P.hp'));
run(`quiet(); var pin = l2w(cot, -1.4, -cot.hz + BT + 0.6), pout = l2w(cot, -1.4, -cot.hz - 0.65); place(pin[0], pin[1]); var sv = spawnEnt('soldier', pout[0], pout[1], { D: 0 }); sv.target = P; sv.tT = 99; sv.a = Math.atan2(P.y - sv.y, P.x - sv.x); beginFoeAttack(sv, EATK.soldier[1], P); var hpB = P.hp; for (let i = 0; i < 60; i++) { P.x = pin[0]; P.y = pin[1]; tick(1); } var meleeBlocked = P.hp === hpB;`);
check('melee: a soldier outside cannot cut you through the wall', run('meleeBlocked'), 'dist=' + run('Math.hypot(sv.x-P.x, sv.y-P.y).toFixed(2)') + ' hp ' + run('hpB') + '->' + run('P.hp'));

// 6. enemies steer around walls and come in through the door
run(`quiet(); var pc = l2w(cot, 0.8, -0.4); place(pc[0], pc[1]); var bo = l2w(cot, 0.5, -cot.hz - 3); var bd = spawnEnt('bandit', bo[0], bo[1], { D: 0 }); bd.hp = bd.maxHp = 9999; bd.cd = 999; var reached = -1;
for (let i = 0; i < 60 * 14; i++) { P.x = pc[0]; P.y = pc[1]; tick(1); if (structAt(bd.x, bd.y) === cot && dist(bd, P) < 2.2) { reached = i * DT; break; } }`);
check('AI: a foe outside walks round the house and in through the door to reach you', run('reached') > 0, 'reached after ' + run('reached.toFixed(1)') + 's, foe ' + run('w2l(cot,bd.x,bd.y).map(v=>v.toFixed(1)).join(",")'));
run(`quiet(); var kin = l2w(CA, 3, -6); place(kin[0], kin[1]); var go = l2w(CA, -20, CAS_S + 10); var cf = spawnEnt('soldier', go[0], go[1], { D: 0 }); cf.hp = cf.maxHp = 9999; cf.cd = 999; var reachedK = -1;
for (let i = 0; i < 60 * 40; i++) { P.x = kin[0]; P.y = kin[1]; P.hp = P.maxHp; tick(1); if (dist(cf, P) < 2.5) { reachedK = i * DT; break; } }`);
check('AI: a foe outside the castle finds the gate and the keep door', run('reachedK') > 0, 'after ' + run('reachedK.toFixed(1)') + 's, foe local ' + run('w2l(CA,cf.x,cf.y).map(v=>v.toFixed(1)).join(",")'));

// 7. village life: inn rest for gold, smithy stock, merchant in the shop
run(`quiet(); var inn = S.ents.find(e => e.kind === 'innkeeper'), tav = bld('tavern'); var ip = l2w(tav, 3.0, -0.6); place(ip[0], ip[1]); P.hp = 40; P.gold = 100; S.interact = findInteract(); var lbl = S.interact && S.interact.label; var innRef = S.interact && S.interact.ref; doInteract(); var innOK = innRef && innRef.kind === 'innkeeper' && P.hp === P.maxHp && P.gold === 100 - innCost(innRef);
P.gold = 1; P.hp = 30; doInteract(); var innPoor = P.hp === 30 && P.gold === 1;`);
check('inn: the innkeeper sells a bed (heals, saves) for a few gold', run('innOK') && /REST/.test(run('lbl')), 'label=' + run('lbl') + ' gold=' + run('P.gold'));
check('inn: no gold, no bed', run('innPoor'));
run(`var sm = S.ents.find(e => e.kind === 'smith'); sm.stock = null; var st = genStock(sm).map(s => ITEMS[s.id].type); var smithOK = st.length >= 5 && st.every(t => ['sword', 'sword2', 'armor', 'shield'].includes(t));
var mer = S.ents.find(e => e.kind === 'merchant'); var merIn = mer.struct && mer.struct.type === 'shop' && structContains(mer.struct, mer.x, mer.y);`);
check('blacksmith: sells weapons and armour', run('smithOK'), run('st.join(",")'));
check('merchant: lives inside the shop building', run('merIn'));

// 8. castle garrison / quartermaster / director, and saves keep castle chests looted
run(`var CU = (() => { let b = null, bd = 1e9; for (let ry = -4; ry <= 2; ry++) for (let rx = -4; rx <= 3; rx++) { const c = castleFor(rx, ry); if (c && c.kind === 'usurper') { const d = Math.hypot(c.x, c.y); if (d < bd) { bd = d; b = c; } } } return b; })();
quiet(); place(...l2w(CU, 0, CAS_S + 20)); var garrison = S.ents.filter(e => e.castle === CU && e.team === 1).length;
var CR = (() => { let b = null, bd = 1e9; for (let ry = -4; ry <= 2; ry++) for (let rx = -4; rx <= 3; rx++) { const c = castleFor(rx, ry); if (c && c.kind === 'royal') { const d = Math.hypot(c.x, c.y); if (d < bd) { bd = d; b = c; } } } return b; })();
quiet(); place(...l2w(CR, 0, 0)); var qm = S.ents.find(e => e.kind === 'quartermaster' && e.castle === CR); qm.stock = null; var qst = qm ? genStock(qm).filter(s => ITEMS[s.id].tier !== undefined).map(s => ITEMS[s.id].tier) : [];`);
check('usurper castle: a redcoat garrison spawns when its chunk loads', run('garrison') >= 5, run('garrison') + ' redcoats at ' + run('CU.name'));
check('royal castle: friendly guards and a quartermaster with higher-tier gear', run('!!qm') && run('Math.max(...qst)') >= 3 && run(`S.ents.filter(e => e.castle === CR && e.kind === 'ally').length`) >= 3, 'tiers ' + run('qst.join(",")'));
run(`quiet(); place(...l2w(CU, 0, 4)); var dirInside = 0; for (let i = 0; i < 300; i++) { const g = groupPos(); if (g && inCastleArea(g[0], g[1], 0)) dirInside++; }`);
check('director: random groups never spawn inside castle walls', run('dirInside') === 0, run('dirInside') + ' of 300 inside');
run(`quiet(); var ch = castleWorld(CU).parts.find(p => p.type === 'chest'); var cp = l2w(CU, castlePlan(CU).chests[0].x, castlePlan(CU).chests[0].z + 1.3); place(cp[0], cp[1]); S.ents = S.ents.filter(e => e.team !== 1); S.interact = findInteract(); var canLoot = S.interact && S.interact.type === 'loot'; doInteract(); var lootedId = ch.id;
saveGame(); continueGame(); for (let i = 0; i < 200000 && S.mode === 'loading'; i++) step(0.016); var stillLooted = S.looted.has(lootedId); S.interact = findInteract(); var noReloot = !(S.interact && S.interact.type === 'loot' && S.interact.ref.id === lootedId);`);
check('saves: a looted castle chest stays looted after save + continue', run('canLoot') && run('stillLooted') && run('noReloot'), 'id=' + run('lootedId'));

let pass = 0;
for (const [n, ok, info] of results) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (info ? '  [' + info + ']' : '')); if (ok) pass++; }
console.log(pass + '/' + results.length + ' passed, exceptions: ' + errors);
if (pass !== results.length || errors) process.exit(1);
