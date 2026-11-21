// Hotbar, inventory drag and drop, forging, upgrades, salvage, the hammer minigame, mining and save compatibility.
const { run } = require('./harness');
let errors = 0;
const origErr = console.error; console.error = (...a) => { errors++; origErr(...a); };
run('init()');
run('startNew(); for(let i=0;i<200000 && S.mode==="loading";i++) step(0.016); closeTalk();');
const results = [];
function check(name, cond, info) { results.push([name, !!cond, info || '']); }
run(`
const DT = 1 / 60;
function I(o) { return Object.assign({ mx: 0, my: 0, atk: false, off: false, dash: false, lock: false, horse: false, pot: false, use: false }, o || {}); }
function tick(n, o) { for (let i = 0; i < n; i++) update(DT, I(typeof o === 'function' ? o(i) : o)); }
function quiet() { for (const m of ['talk', 'log', 'inv', 'forge', 'shop']) if (S.mode === m) ({ talk: closeTalk, log: closeLog, inv: closeInv, forge: closeForge, shop: closeShop })[m](); S.ents = S.ents.filter(e => e.team === 2); S.projs = []; S.dirT = 1e9; S.mode = 'play'; P.hp = P.maxHp = 100; P.act = null; P.iframes = 0; P.invT = 0; }
function kit() { quiet(); P.hands = [null, null]; P.armor = 'tunic'; P.mats = {}; P.inv = [{ id: 'iron_sword', n: 1 }, { id: 'claymore', n: 1 }, { id: 'kite_shield', n: 1 }, { id: 'torch', n: 1 }, { id: 'potion', n: 3 }];
  P.hot = ['iron_sword', 'claymore', 'kite_shield', 'torch', 'potion', null, null, null]; P.hotSel = 5; }
`);

// 1. hotbar selection follows the two-hand rules
run(`kit(); hotSelect(0, 'key'); var h1 = P.hands.join(','); hotSelect(2, 'key'); var h2 = P.hands.join(','); hotSelect(1, 'key'); var h3 = P.hands.join(','), bag3 = P.inv.map(q => q.id).sort().join(',');
hotSelect(2, 'key'); var h4 = P.hands.join(','); hotSelect(0, 'key'); var h5 = P.hands.join(','); hotSelect(3, 'key'); var h6 = P.hands.join(',');`);
check('hotbar: a one-hand sword goes to the main (right) hand', run('h1') === ',iron_sword', run('h1'));
check('hotbar: a shield goes to the off hand beside the sword', run('h2') === 'kite_shield,iron_sword', run('h2'));
check('hotbar: a two-handed claymore takes both hands and stows the rest', run('h3') === 'claymore,claymore' && run('bag3').includes('iron_sword') && run('bag3').includes('kite_shield'), run('h3') + ' bag ' + run('bag3'));
check('hotbar: a shield selected while two-handed stows the claymore', run('h4') === 'kite_shield,', run('h4'));
check('hotbar: a torch goes to the off hand when the main hand holds a one-hand weapon', run('h5') === 'kite_shield,iron_sword' && run('h6') === 'torch,iron_sword', run('h5') + ' -> ' + run('h6'));
run(`P.hp = 40; hotSelect(4, 'key'); var hp0 = P.hp, potHands = P.hands.join(','), n0 = invCount('potion'); tick(1, { atk: true }); tick(1); var hp1 = P.hp, n1 = invCount('potion'), attacked = !!(P.act && P.act.k === 'atk'); tick(1, { atk: true }); tick(1);
var lblPot = S.hotLbl && S.hotLbl.txt; hotSelect(5, 'key'); var fists = mainItem() === null && P.hands.every(h => !h || ITEMS[h].type === 'shield'), lblF = S.hotLbl.txt;`);
check('hotbar: selecting a potion keeps your gear; ATTACK drinks it (no swing)', run('hp0 === 40 && potHands === "torch,iron_sword" && hp1 > hp0 && n1 === n0 - 1 && !attacked'), 'hp ' + run('hp0') + '->' + run('hp1') + ' potions ' + run('n0') + '->' + run('n1') + ' label "' + run('lblPot') + '"');
check('hotbar: an empty slot means bare fists, with a fading name label', run('fists') && run('lblF') === 'Bare fists' && run('S.hotLbl.t > 1'), run('P.hands.join(",")'));
run(`kit(); P.hp = 30; hotSelect(4, 'key'); var a0 = invCount('potion'); hotSelect(4, 'key'); var a1 = invCount('potion');`);
check('hotbar: pressing the selected potion key again drinks it', run('a1 === a0 - 1 && P.hp > 30'), run('a0') + '->' + run('a1'));

// 2. mouse wheel and number keys
run(`kit(); P.hotSel = 0; hotSelect(0, 'key'); onWheel({ deltaY: 100, preventDefault() {} }); var w1 = P.hotSel, wh = P.hands.join(','); onWheel({ deltaY: -100, preventDefault() {} }); var w2 = P.hotSel; onWheel({ deltaY: -100, preventDefault() {} }); var w3 = P.hotSel;
onKeyDown({ code: 'Digit3', preventDefault() {} }); onKeyUp({ code: 'Digit3' }); var k3 = P.hotSel, kh = P.hands.join(','); onKeyDown({ code: 'Digit8', preventDefault() {} }); onKeyUp({ code: 'Digit8' }); var k8 = P.hotSel;`);
check('wheel: one notch down = next slot (equips it), up = previous, wraps around', run('w1 === 1 && wh === "claymore,claymore" && w2 === 0 && w3 === 7'), [run('w1'), run('w2'), run('w3')].join(' '));
check('number keys 1-8 select slots directly', run('k3 === 2 && kh.includes("kite_shield") && k8 === 7'), run('k3') + ' ' + run('kh') + ' ' + run('k8'));
run(`kit(); P.hotSel = 0; S.mode = 'inv'; onWheel({ deltaY: 100, preventDefault() {} }); var wInv = P.hotSel; S.mode = 'play';`);
check('wheel does nothing while a menu is open', run('wInv === 0'));

// 3. save / load of the hotbar, the pouch and forged variants
run(`kit(); P.inv.push({ id: 'steel_sword+3!s#2', n: 1 }); P.hot[5] = 'steel_sword+3!s#2'; P.hot[0] = null; P.hotSel = 5; P.mats = { iron_ore: 4, silver: 1 }; S.ore = { 'x:o0': { left: 0, h: 0, day: 1 } };
var snap = JSON.stringify([P.hot, P.hotSel, P.mats, P.inv.map(q => q.id)]); saveGame(); continueGame(); for (let i = 0; i < 200000 && S.mode === 'loading'; i++) step(0.016); var snap2 = JSON.stringify([P.hot, P.hotSel, P.mats, P.inv.map(q => q.id)]);`);
check('saves: hotbar layout, selection, materials and forged items persist', run('snap === snap2') && run('S.ore["x:o0"] && S.ore["x:o0"].left === 0'), run('snap2'));

// 4. old saves still load
run(`localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 2, x: 40, y: 30, a: 0, hp: 80, maxHp: 112, level: 2, xp: 10, gold: 77, inv: [{ id: 'potion', n: 2 }, { id: 'kite_shield', n: 1 }, { id: 'bogus', n: 1 }], hands: [null, 'iron_sword'], armor: 'leather', mounted: false, horse: { x: 42, y: 30 }, day: 3, time: 0.5, looted: [], lastVillage: { x: 16, y: 16, name: 'Ashford' }, kills: 9 }));
var oldOK = false; try { continueGame(); for (let i = 0; i < 200000 && S.mode === 'loading'; i++) step(0.016); for (let i = 0; i < 20; i++) step(0.016); oldOK = S.mode === 'play' && P.gold === 77 && P.hands[1] === 'iron_sword' && P.inv.length === 2 && P.hot[0] === 'iron_sword' && P.hot.includes('potion') && P.hot.includes('kite_shield') && P.hotSel === 0 && JSON.stringify(P.mats) === '{}'; } catch (err) { console.log(err); }
localStorage.setItem(SAVE_KEY, JSON.stringify({ x: 1, y: 2, hot: [5, 'nope', null, {}], hotSel: 99, mats: { iron_ore: 'x', wood: 3, fake: 9 } })); var junkOK = false; try { continueGame(); for (let i = 0; i < 200000 && S.mode === 'loading'; i++) step(0.016); for (let i = 0; i < 10; i++) step(0.016); junkOK = S.mode === 'play' && P.hot.length === 8 && P.hot.every(h => h === null) && P.hotSel === 7 && JSON.stringify(P.mats) === '{"wood":3}'; } catch (err) { console.log(err); }`);
check('saves: a save from before the hotbar loads and builds the hotbar from your gear', run('oldOK'), run('JSON.stringify(P.hot)'));
check('saves: a corrupt hotbar / pouch in a save is cleaned up', run('junkOK'), run('JSON.stringify(P.mats)') + ' ' + run('P.hotSel'));

// 5. crafting
run(`kit(); P.inv = []; P.mats = { iron_ore: 3, wood: 2, leather_hide: 1 }; P.gold = 50; var rs = recipeFor('iron_sword', 'smith'); var can0 = canCraft(rs); var cid = craftItem(rs, 1); var can1 = canCraft(rs);
var craftOK = cid === 'iron_sword#1' && P.inv.some(q => q.id === cid) && P.gold === 50 - rs.gold && !P.mats.iron_ore && P.mats.wood === 1 && !P.mats.leather_hide && P.hot.includes(cid);
P.mats = { wood: 1, iron_ore: 1 }; var a0 = invCount('arrows'); var aid = craftItem(recipeFor('arrows', 'camp')); var arrowsOK = aid === 'arrows' && invCount('arrows') === a0 + 10 && !P.mats.wood;
P.mats = { iron_ore: 1 }; var failId = craftItem(rs, 2); var failOK = failId === null && P.mats.iron_ore === 1;`);
check('crafting: consumes the materials and gold and gives the item (with its quality)', run('can0 && !can1 && craftOK'), run('cid') + ' mats ' + run('JSON.stringify(P.mats)'));
check('crafting: camp recipes (10 arrows from timber + iron)', run('arrowsOK'));
check('crafting: without the materials nothing is made or taken', run('failOK'));

// 6. upgrades change stats; equipped items and hotbar refs follow
run(`kit(); P.mats = { iron_ore: 20, steel_ingot: 30, silver: 5, ghost_essence: 5, leather_hide: 10, wood: 20 }; P.gold = 99999; P.inv = [{ id: 'leather', n: 1 }, { id: 'buckler', n: 1 }]; P.hands = [null, 'iron_sword']; P.hot[0] = 'iron_sword';
var dm = [ITEMS.iron_sword.dmg], id = 'iron_sword'; for (let L = 1; L <= 5; L++) { id = upgradeItem(id, 0); dm.push(ITEMS[id].dmg); } var capped = !upgradable(id) && upgradeItem(id, 0) === null;
var aid = upgradeItem('leather', 0), bid = upgradeItem(upgradeItem('buckler', 0), 2);`);
check('upgrade: +1..+5 raise damage every level, and +5 is the cap', run('dm.every((v, i) => i === 0 || v > dm[i - 1]) && id === "iron_sword+5" && capped'), run('dm.join(" -> ")'));
check('upgrade: the equipped sword is replaced in hand and on the hotbar', run('P.hands[1] === "iron_sword+5" && P.hot[0] === "iron_sword+5"'));
check('upgrade: armour gains armour, shields gain block; a masterwork strike raises quality', run('ITEMS[aid].def > ITEMS.leather.def && ITEMS[bid].block > ITEMS.buckler.block && ITEMS[bid].q === 2 && bid === "buckler+2#2"'), run('aid') + ' ' + run('bid'));
run(`var t1 = temperItem('iron_sword+5', 's', 0); var tIt = ITEMS[t1];`);
check('temper: silvering a blade keeps its level and marks it silvered', run('t1 === "iron_sword+5!s" && tIt.silver && tIt.lvl === 5 && /silvered/.test(tIt.name)'), run('t1'));
check('variant ids: unknown or impossible variants are rejected', run('!ITEMS["iron_sword+9"] && !ITEMS["potion+1"] && !ITEMS["iron_sword#1+2"] && !!ITEMS["claymore+1!f#2"]'));

// 7. salvage
run(`kit(); P.mats = {}; P.inv = [{ id: 'steel_sword+2', n: 1 }, { id: 'potion', n: 2 }]; var y = salvageBag(0); var salvOK = y && P.inv.length === 1 && P.mats.steel_ingot === 2 && !salvageYield('potion');`);
check('salvage: gear breaks down into materials (more for upgraded gear)', run('salvOK'), run('JSON.stringify(P.mats)'));

// 8. the hammer minigame
run(`var m = mgNew({}); m.pos = m.zone; var s1 = mgStrike(m); m.pos = Math.min(1, m.zone + 0.1); var s2 = mgStrike(m); m.pos = m.zone > 0.5 ? 0 : 1; var s3 = mgStrike(m); var doneOK = m.done && m.res.length === 3;
var g2 = forgeGrade([1, 1, 1]).grade, g1 = forgeGrade([1, 0.6, 0.6]).grade, g0 = forgeGrade([0, 0.3, 0]).grade;
var mm = mgNew({}); let lo = 9, hi = -9, flips = 0, d0 = mm.dir; for (let i = 0; i < 300; i++) { mgTick(mm, 0.016); lo = Math.min(lo, mm.pos); hi = Math.max(hi, mm.pos); if (mm.dir !== d0) { flips++; d0 = mm.dir; } }`);
check('forge timing: on the mark = perfect, near = good, far = miss', run('s1 === 1 && s2 === 0.6 && s3 === 0 && doneOK'), [run('s1'), run('s2'), run('s3')].join(' '));
check('forge timing: quality grades (masterwork / fine / standard)', run('g2 === 2 && g1 === 1 && g0 === 0'));
check('forge timing: the marker sweeps back and forth across the bar', run('lo >= 0 && hi <= 1 && flips >= 2'), 'range ' + run('lo.toFixed(2)') + '..' + run('hi.toFixed(2)'));
run(`kit(); P.inv = []; P.mats = { iron_ore: 3, wood: 1, leather_hide: 1 }; P.gold = 100; var sm = S.ents.find(e => e.kind === 'smith'); openForge(sm, 'smith'); var fh = document.getElementById('forgePanel').innerHTML;
forgeAct('craft', { r: 'smith:iron_sword' }); var inMG = !!FORGE.mg; for (let k = 0; k < 3; k++) { FORGE.mg.m.pos = FORGE.mg.m.zone; forgeStrike(); } for (let i = 0; i < 40; i++) step(0.016); var res = FORGE.res; closeForge();`);
check('forge screen: recipes show required vs owned materials; forging runs the minigame', run('/Forge/.test(fh) && /3\\/3/.test(fh) && /chip/.test(fh) && inMG'), '');
check('forge screen: three perfect strikes make a masterwork', run('res && res.grade === 2 && res.id === "iron_sword#2" && P.inv.some(q => q.id === "iron_sword#2")'), run('res && res.id'));
run(`kit(); P.mats = {}; var smb = S.ents.find(e => e.kind === 'smith'); openForge(smb, 'smith'); var fh2 = document.getElementById('forgePanel').innerHTML; closeForge();`);
check('forge screen: recipes you cannot afford are greyed out', run('/rec no/.test(fh2) && /disabled/.test(fh2)'));

// 9. mining an ore outcrop and chopping a tree (hits that land on no foe)
run(`kit(); var ore = null; for (const c of CHUNKS.values()) for (const o of c.statics) if (o.type === 'ore' && !o.silver && !ore) ore = o;
P.x = ore.x - ore.r - 1.0; P.y = ore.y; P.a = 0; P.mats = {}; delete S.ore[ore.id]; const A = () => ({ it: ITEMS.iron_sword, mv: MOVES.sword[0], dir: 0 }); var r1 = hitWorld(A(), 2.4, 1.15), r2 = hitWorld(A(), 2.4, 1.15);
for (let i = 0; i < 12; i++) hitWorld(A(), 2.4, 1.15); var dep = oreDepleted(ore), oreN = invCount('iron_ore'); S.day += 2; var back = !oreDepleted(ore);
var tree = null; for (const c of CHUNKS.values()) for (const o of c.statics) if ((o.type === 'oak' || o.type === 'pine') && !tree) tree = o; P.x = tree.x - tree.r - 1.0; P.y = tree.y; var w = 0; for (let i = 0; i < 30; i++) hitWorld(A(), 2.4, 1.15); w = invCount('wood');`);
check('mining: an ore rock gives iron ore every couple of hits, then is spent (and regrows)', run('r1 === "hit" && r2 === "iron_ore" && oreN === 4 && dep && back'), 'ore ' + run('oreN') + ' at ' + run('ore.id'));
check('chopping: hitting a tree yields timber (a few per tree)', run('w >= 1 && w <= 3'), 'wood ' + run('w'));
check('world: every village has an ore outcrop just outside it', run(`(() => { const v = villageFor(0, 0); let best = 1e9; for (const c of CHUNKS.values()) for (const o of c.statics) if (o.type === 'ore') best = Math.min(best, Math.hypot(o.x - v.x, o.y - v.y)); return best < 40; })()`));

// 10. silvered blades vs the undead
run(`kit(); P.x = 400; P.y = 400; manageChunks(40); const mk = () => { const g = spawnEnt('ghost', P.x + 1.2, P.y, { D: 0 }); g.hp = g.maxHp = 9999; return g; };
const sa = (it, e) => { S.ents = S.ents.filter(x => x === e || x.team === 2); const h = e.hp; attackHits({ mv: MOVES.sword[0], it: ITEMS[it], wk: 'sword', dir: 0, hit: new Set(), crit: 0, sharp: false }); return h - e.hp; };
let sP = 0, sS = 0; for (let k = 0; k < 6; k++) { sP += sa('iron_sword', mk()); sS += sa('iron_sword!s', mk()); } var dPlain = sP / 6, dSilver = sS / 6;`);
check('temper: a silvered blade hits ghosts about x1.5 harder', run('dSilver / dPlain > 1.3 && dSilver / dPlain < 1.75'), run('dPlain.toFixed(1)') + ' -> ' + run('dSilver.toFixed(1)'));

// 11. smith order quest (bring materials)
run(`quiet(); var smq = S.ents.find(e => e.kind === 'smith'); var offs = npcBusiness(smq).offers; var oq = offs[0]; var acc = acceptQuest(oq); var need = qStep(qById(oq.id)).need; var markBefore = questMark(smq);
for (const k in need) P.mats[k] = (P.mats[k] || 0) + need[k]; var markAfter = questMark(smq); var g0 = P.gold; var delivered = deliverOrder(qById(oq.id)); var after = JSON.stringify(P.mats);`);
check('smith order: the blacksmith offers a materials order; delivering it completes the quest', run('offs.length >= 1 && acc && markBefore !== "?" && markAfter === "?" && delivered && S.Q.done.includes(oq.id) && P.gold > g0'), run('oq.title') + ': ' + run('JSON.stringify(need)'));

// 12. inventory: grid, drag and drop between bag / hotbar / hands, details with compare
run(`kit(); P.hands = [null, 'iron_sword']; P.inv = [{ id: 'steel_sword', n: 1 }, { id: 'buckler', n: 1 }, { id: 'potion', n: 4 }]; P.hot = ['iron_sword', null, null, null, null, null, null, null]; openInv(); var ih = document.getElementById('invPanel').innerHTML;
var nBag = (ih.match(/data-k="bag"/g) || []).length, nHot = (ih.match(/data-k="hot"/g) || []).length, nEq = (ih.match(/data-k="eq"/g) || []).length;
INV.sel = { k: 'bag', i: 0 }; var dt = detailHTML();
var d1 = invDrop({ k: 'bag', i: 0 }, { k: 'hot', i: 3 }), hot3 = P.hot[3]; var d2 = invDrop({ k: 'bag', i: 1 }, { k: 'eq', i: 0 }), left = P.hands[0];
var d3 = invDrop({ k: 'eq', i: 1 }, { k: 'bag', i: 9 }), right = P.hands[1], bagHasIron = P.inv.some(q => q.id === 'iron_sword');
var d4 = invDrop({ k: 'hot', i: 3 }, { k: 'eq', i: 1 }), right2 = P.hands[1]; var d5 = invDrop({ k: 'bag', i: 0 }, { k: 'eq', i: 2 }); var d6 = invDrop({ k: 'hot', i: 0 }, { k: 'bag', i: 5 }), hot0 = P.hot[0];
INV.sel = null; invTap('bag', P.inv.findIndex(q => q.id === 'potion')); invTap('hot', 6); var tapPlaced = P.hot[6] === 'potion'; closeInv();`);
check('inventory: a grid of 20 bag slots, 8 hotbar slots and 3 equipment slots with thumbnails', run('nBag === 20 && nHot === 8 && nEq === 3 && /class="th/.test(ih)'), run('nBag') + '/' + run('nHot') + '/' + run('nEq'));
check('inventory: the detail panel compares with what you have equipped', run('/Damage/.test(dt) && /▲/.test(dt) && /compared with Iron Sword/.test(dt) && /Equip L/.test(dt) && /To hotbar/.test(dt)'));
check('inventory: drag bag -> hotbar binds the item; bag -> left hand equips a shield', run('d1 && hot3 === "steel_sword" && d2 && left === "buckler"'));
check('inventory: drag hand -> bag unequips; hotbar -> hand equips', run('d3 && !right && bagHasIron && d4 && right2 === "steel_sword"'));
check('inventory: invalid drops are refused (a sword on the body); hotbar -> bag unbinds', run('!d5 && d6 && hot0 === null'));
check('inventory: tap-to-select then tap-to-place (touch fallback)', run('tapPlaced'));

// 13. thumbnails exist for every item type (glyph fallback in this headless run)
check('thumbnails: one per item type, cached, shared by variants', run(`Object.keys(ITEM_DEFS).every(k => THUMBS.has(k)) && thumbCanvas('iron_sword+3!s') === thumbCanvas('iron_sword')`), run('THUMBS.size') + ' thumbs');

let pass = 0;
for (const [n, ok, info] of results) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (info ? '  [' + info + ']' : '')); if (ok) pass++; }
console.log(pass + '/' + results.length + ' passed, exceptions: ' + errors);
if (pass !== results.length || errors) process.exit(1);
