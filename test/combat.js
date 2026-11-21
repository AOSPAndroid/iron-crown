// Deterministic timing tests for the skill-based combat rules.
const { run } = require('./harness');
let errors = 0;
const origErr = console.error; console.error = (...a) => { errors++; origErr(...a); };
run('init()');
run('startNew(); for(let i=0;i<200000 && S.mode==="loading";i++) step(0.016);');
run(`
const DT = 1 / 120;
function I(o) { return Object.assign({ mx: 0, my: 0, atk: false, off: false, dash: false, lock: false, horse: false, pot: false, use: false }, o || {}); }
function tick(n, o) { for (let i = 0; i < n; i++) update(DT, I(typeof o === 'function' ? o(i) : o)); }
function arena(hands) {
  S.ents = []; S.projs = []; S.fx = []; S.tok.clear(); S.tokR.clear(); S.dirT = 1e9; S.tut = 3; S.mode = 'play'; S.slowT = 0; S.hitstop = 0; S.style = 0; S.banner = null;
  P.x = 400; P.y = 400; P.a = 0; P.hp = P.maxHp = 1000; P.st = P.stMax = 100; P.act = null; P.lock = null; P.iframes = 0; P.parryT = 0; P.parryCd = 0; P.counterT = 0; P.riposteT = 0;
  P.comboStep = 0; P.comboT = 0; P.prevAtk = false; P.prevOff = false; P.buf = { atk: 0, dash: 0, off: 0 }; P.invT = 0; P.mounted = false; P.kx = P.ky = 0; P.vx = P.vy = 0; P.armor = 'tunic';
  P.hands = hands || [null, null];
  manageChunks(40);
}
// a foe 1.2 units east of the player, already winding up its basic melee attack at the player
function foe(kind, atkIdx, d) {
  const e = spawnEnt(kind || 'soldier', P.x + (d || 1.2), P.y, { D: 0 });
  e.target = P; e.tT = 99; e.a = Math.PI; e.cd = 99;
  beginFoeAttack(e, EATK[e.kind][atkIdx === undefined ? 0 : atkIdx], P);
  return e;
}
// run until the foe's wind-up has (leadSec) left, then call fn
function untilLead(e, lead) { let n = 0; while (e.state === 'wind' && foeWind(e.atk, e.hitIdx) - e.wt > lead && n++ < 2000) tick(1); }
`);
const results = [];
function check(name, cond, info) { results.push([name, !!cond, info || '']); }

// 1. perfect dodge: only when the dash's i-frames overlap the impact
{
  run(`arena(); var e1 = foe('bandit'); untilLead(e1, 0.05); tick(1, { dash: true }); tick(1); var hp0 = P.hp; tick(40);`);
  check('perfect dodge: dash 0.05s before impact triggers slow-mo + counter window', run('S.slowT > 0 || P.counterT > 0') && run('P.hp === hp0'), 'slowT=' + run('S.slowT.toFixed(2)') + ' counter=' + run('P.counterT.toFixed(2)'));
  run(`arena(); var e2 = foe('bandit'); untilLead(e2, 0.36); tick(1, { dash: true }); var hp1 = P.hp; tick(60);`);
  check('perfect dodge: dash 0.36s early (i-frames over) gives no perfect dodge', run('S.slowT <= 0 && P.counterT <= 0'), 'slowT=' + run('S.slowT.toFixed(2)'));
  run(`arena(); var e3 = foe('bandit'); var hp2 = P.hp; tick(120);`);
  check('no dash: the hit lands', run('P.hp < hp2'), 'hp ' + run('hp2') + '->' + run('P.hp'));
  run(`arena(); var e4 = foe('bandit'); untilLead(e4, 0.05); tick(1, { dash: true }); tick(30); var c0 = P.counterT; P.act = null; P.x = e4.x - 1.1; P.y = e4.y; P.a = 0; e4.hp = e4.maxHp = 9999; e4.state = 'rec'; e4.rt = 9; var h0 = e4.hp; var cOK = c0 > 0; tick(1, { atk: true }); tick(40);`);
  check('counter attack after perfect dodge is a guaranteed crit (x2)', run('cOK') && run('e4.hp < h0') && run('(h0 - e4.hp) > 1.6 * (5 + P.level * 0.8)'), 'dmg ' + run('Math.round(h0-e4.hp)'));
}
// 2. parry windows
for (const [label, hands, win] of [['fists (grab)', '[null,null]', 0.12], ['sword', '[null,"iron_sword"]', 0.1], ['shield', '["kite_shield","iron_sword"]', 0.16]]) {
  run(`arena(${hands}); var pe = foe('soldier', 1); untilLead(pe, ${win * 0.5}); tick(1, { off: true }); var hpA = P.hp; tick(60);`);
  const ok = run('pe.state === "stagger" || (P.act && P.act.k === "grab") || P.riposteT > 0 || pe.downT > 0') && run('P.hp === hpA');
  check('parry ' + label + ': tap ' + (win * 0.5).toFixed(3) + 's before impact parries', ok, 'foe=' + run('pe.state') + ' hp=' + run('P.hp'));
  run(`arena(${hands}); var pf = foe('soldier', 1); untilLead(pf, ${win + 0.12}); tick(1, { off: true }); var hpB = P.hp; tick(60);`);
  check('parry ' + label + ': tap ' + (win + 0.12).toFixed(2) + 's before impact is too early', run('pf.state !== "stagger"') && (label === 'shield' ? true : run('P.hp < hpB')), 'foe=' + run('pf.state') + ' hp ' + run('hpB') + '->' + run('P.hp'));
}
// red attacks cannot be parried
run(`arena([null,"iron_sword"]); var pk = foe('pikeman', 0, 1.5); untilLead(pk, 0.05); tick(1, { off: true }); var hpC = P.hp; tick(60);`);
check('red (unblockable) pike thrust ignores parry', run('P.hp < hpC') && run('pk.state !== "stagger"'), 'hp ' + run('hpC') + '->' + run('P.hp'));
// parry reflects a witch fireball
run(`arena([null,"iron_sword"]); var w = spawnEnt('witch', P.x + 8, P.y, { D: 0 }); w.cd = 99; w.tT = 99; w.target = P; S.projs.push({ x: P.x + 3, y: P.y, elev: 1.3, vx: -11, vy: 0, vz: 0, team: 1, dmg: 10, life: 4, kind: 'fire', col: 'y', target: P, src: w });
var hpD = P.hp; let fired = false; tick(80, i => { const pr = S.projs[0]; const near = pr && Math.hypot(pr.x - P.x, pr.y - P.y) < 1.4; if (near && !fired) { fired = true; return { off: true }; } return {}; });`);
check('parry reflects a fireball back at the witch', run('P.hp === hpD') && run('(S.projs[0] && S.projs[0].team === 0) || w.hp < w.maxHp'), 'proj team=' + run('S.projs[0] ? S.projs[0].team : "gone"') + ' witch hp ' + run('Math.round(w.hp)'));

// 3. combo timing: pressing in the window chains, mashing early drops the combo
run(`arena([null,"iron_sword"]); tick(1, { atk: true }); tick(1); var s0 = P.act.mv.n; const mv = P.act.mv; tick(Math.round((mv.w + mv.a) / DT) - 1); tick(1, { atk: true }); tick(2); var s1 = P.act && P.act.mv ? P.act.mv.n : 'none';`);
check('combo: press inside the window chains slash1 -> slash2', run('s0') === 'slash1' && run('s1') === 'slash2', run('s0') + ' -> ' + run('s1'));
run(`arena([null,"iron_sword"]); tick(1, { atk: true }); tick(1); tick(3); tick(1, { atk: true }); tick(1); var mashed = P.act.mashed; tick(80); var after = P.act ? P.act.k : 'none'; tick(1, { atk: true }); tick(2); var restart = P.act && P.act.mv ? P.act.mv.n : 'none';`);
check('combo: mashing during wind-up marks the swing and drops the string', run('mashed') === true && run('restart') === 'slash1', 'mashed=' + run('mashed') + ' next=' + run('restart'));
run(`arena([null,null]); let steps = []; for (let k = 0; k < 3; k++) { tick(1, { atk: true }); const a = P.act; steps.push(a.mv.n); while (P.act === a && a.t < a.mv.w + a.mv.a) tick(1); tick(1); }`);
check('fists: jab -> cross -> hook with on-beat presses', run('steps.join(",")') === 'jab,cross,hook', run('steps.join(",")'));
// 4. dash rules
run(`arena(); P.st = 10; tick(1, { dash: true }); tick(1); var dashedLow = !!(P.act && P.act.k === 'dash');`);
check('stamina gate: no dash below the minimum stamina', run('dashedLow') === false, 'act=' + run('P.act ? P.act.k : "none"'));
run(`arena(); let nd = 0; for (let k = 0; k < 12; k++) { tick(1, { dash: true }); if (P.act && P.act.k === 'dash' && P.act.t < DT * 1.5) nd++; tick(Math.round(0.4 / DT)); }`);
check('dash spam is limited by stamina (12 attempts, 0.4s apart)', run('nd') < 12 && run('nd') >= 4, run('nd') + ' dashes');
run(`arena([null,"iron_sword"]); tick(1, { atk: true }); tick(3); tick(1, { dash: true }); tick(2); var duringWind = P.act.k;`);
check('dash cannot cancel a wind-up', run('duringWind') === 'atk', run('duringWind'));
run(`arena([null,"iron_sword"]); tick(1, { atk: true }); const ma = P.act; while (P.act === ma && ma.t < ma.mv.w + ma.mv.a + 0.02) tick(1); tick(1, { dash: true }); tick(1); var duringRec = P.act.k;`);
check('dash cancels attack recovery', run('duringRec') === 'dash', run('duringRec'));
run(`arena(); tick(1, { dash: true }); var ifr = P.iframes; tick(Math.round(0.28 / DT)); var ifr2 = P.iframes;`);
check('roll i-frames ~0.24s (tunic)', Math.abs(run('ifr') - 0.24) < 0.01 && run('ifr2') <= 0, 'start=' + run('ifr.toFixed(3)'));
// 5. heavy sweet spot
run(`arena([null,"iron_sword"]); let hk = 0; tick(Math.round((HOLD_HEAVY + CHARGE_FULL.sword + 0.06) / DT), { atk: true }); tick(1); var crit = P.act && P.act.heavyCrit;`);
check('heavy: release in the sweet spot = crit + guard break', run('crit') === true, 'heavyCrit=' + run('crit'));
run(`arena([null,"iron_sword"]); tick(Math.round((HOLD_HEAVY + 0.25) / DT), { atk: true }); tick(1); var crit2 = P.act && P.act.heavyCrit;`);
check('heavy: early release is not a crit', run('crit2') === false, 'heavyCrit=' + run('crit2'));
// 6. pistol interrupts a wind-up
run(`arena([null,"pistol"]); var mu = foe('musketeer', 0, 8); mu.hp = mu.maxHp = 500; tick(Math.round(0.3 / DT)); P.a = 0; tick(1, { atk: true }); tick(30);`);
check('pistol shot during an aim interrupts (stagger)', run('mu.state === "stagger" || mu.dead'), 'state=' + run('mu.state'));
// 7. attack tokens: at most 1-2 melee foes wind up on the player at once
run(`arena([null,"iron_sword"]); P.hp = P.maxHp = 1e6; const ring = []; for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; const e = spawnEnt('soldier', P.x + Math.cos(a) * 3, P.y + Math.sin(a) * 3, { D: 0 }); e.cd = 0; ring.push(e); }
var maxW = 0; for (let i = 0; i < 1200; i++) { tick(1); const n = S.ents.filter(e => e.team === 1 && !e.k.boss && (e.state === 'wind') && e.tgt === P).length; maxW = Math.max(maxW, n); }`);
check('attack tokens: max simultaneous melee wind-ups on the player <= ' + run('tokCap(false)'), run('maxW') <= run('tokCap(false)') && run('maxW') >= 1, 'max=' + run('maxW'));
// 8. input buffer: a press 0.1s before the window opens still chains
run(`arena([null,"iron_sword"]); tick(1, { atk: true }); const ba = P.act; while (ba.t < ba.mv.w + ba.mv.a - 0.1) tick(1); tick(1, { atk: true }); while (P.act === ba) tick(1); var bufNext = P.act && P.act.mv ? P.act.mv.n : 'none';`);
check('input buffer: press 0.1s before the window still chains', run('bufNext') === 'slash2', run('bufNext'));
// 9. style rank: rises with skill, drops when hit
run(`arena([null,"iron_sword"]); S.style = 0; styleAdd(350); var r1 = styleRank()[0]; hurtPlayer(5, { x: P.x + 1, y: P.y }); var r2 = styleRank()[0];`);
check('style: rank rises with skill and drops when hit', run('r1') === 'B' && run('r2') !== 'B', run('r1') + ' -> ' + run('r2'));

// 10. forward roll through a foe: it loses track, you end up behind it, and the strike from behind is a x2.2 ROLL STRIKE
run(`arena([null,'iron_sword']); var rb = spawnEnt('soldier', P.x + 1.6, P.y, { D: 0 }); rb.target = P; rb.tT = 99; rb.a = Math.PI; rb.cd = 99; rb.hp = rb.maxHp = 9999;
startDash(1, 0); var lostSeen = false, winSeen = false; for (let i = 0; i < 60; i++) { tick(1); if (rb.lostT > 0) lostSeen = true; if (P.rollStrikeT > 0) winSeen = true; }
var behindOK = P.x > rb.x && Math.abs(angDiff(rb.a, Math.atan2(P.y - rb.y, P.x - rb.x))) > 1.95;
P.act = null; P.a = Math.PI; var h0b = rb.hp; tick(1, { atk: true }); tick(50); var rollDmg = h0b - rb.hp;`);
check('roll past a foe: it loses track and you end up behind it', run('lostSeen && winSeen && behindOK'), 'lost=' + run('lostSeen') + ' win=' + run('winSeen') + ' behind=' + run('behindOK'));
check('roll strike from behind hits ~x2.2', run('rollDmg') > 17 * 1.9, 'dmg ' + run('Math.round(rollDmg)'));

let pass = 0;
for (const [n, ok, info] of results) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (info ? '  [' + info + ']' : '')); if (ok) pass++; }
console.log(pass + '/' + results.length + ' passed, exceptions: ' + errors);
if (pass !== results.length || errors) process.exit(1);
