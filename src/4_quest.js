// =====================================================================
//  STORY & QUESTS — the main storyline of the Iron Crown, procedurally generated
//  side quests per village, quest givers, objectives, rewards and reputation
// =====================================================================
const QMAX_SIDE = 5;
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h | 0; }
function questInit() { S.Q = { v: 1, main: 0, act: [], done: [], gen: {}, rep: {}, track: null, story: [] }; }
const qById = id => S.Q.act.find(q => q.id === id);
const qStep = q => q && q.steps[q.si];
const ASHV = () => villageFor(0, 0);

// ---------- world helpers for placing objectives (deterministic, no chunk loading needed) ----------
function siteOK(x, y) {
  const b = biomeAt(x, y); if (b === B_DESERT) return false;
  for (const [i, j] of [[0, 0], [3, 0], [-3, 0], [0, 3], [0, -3]]) if (isWet(tileBase(x + i, y + j))) return false;
  if (nearVillage(x, y, 42) || castleGround(x, y) || manorGround(x, y, 12)) return false;
  return true;
}
function siteNear(x0, y0, minD, maxD, seed, want) {
  const R = mulberry(seed | 0);
  for (let i = 0; i < 80; i++) { const a = R() * TAU, d = minD + R() * (maxD - minD), x = x0 + Math.cos(a) * d, y = y0 + Math.sin(a) * d; if (siteOK(x, y) && (!want || biomeAt(x, y) === want)) return [x, y]; }
  for (let i = 0; i < 80; i++) { const a = R() * TAU, d = minD + R() * (maxD - minD) * 1.6, x = x0 + Math.cos(a) * d, y = y0 + Math.sin(a) * d; if (siteOK(x, y)) return [x, y]; }
  return [x0 + minD, y0];
}
function biomePoint(b, x0, y0) {
  for (let r = 120; r < 2600; r += 30) for (let k = 0; k < 32; k++) { const a = k / 32 * TAU, x = x0 + Math.cos(a) * r, y = y0 + Math.sin(a) * r; if (biomeAt(x, y) === b && biomeAt(x + 12, y) === b && biomeAt(x, y + 12) === b && siteOK(x, y)) return [x, y]; }
  return [x0, y0 + 300];
}
function nearestCastleOf(kind, x, y, snow) {
  let best = null, bd = 1e9;
  for (let ry = -7; ry <= 7; ry++) for (let rx = -7; rx <= 7; rx++) { const c = castleFor(rx, ry); if (!c || c.kind !== kind || (snow !== undefined && c.snow !== snow)) continue; const d = Math.hypot(c.x - x, c.y - y); if (d < bd) { bd = d; best = c; } }
  return best;
}
const PLACES = ['the Old Mill', 'Gallows Hill', "Hob's Hollow", 'the Weeping Stones', "Crow's Ford", 'the Burnt Farm', 'Gibbet Lane', "Fenwick's Barrow", 'the Hanging Oak', 'Kettle Bottom', "Tanner's Copse", 'the Drowned Field'];
const placeName = seed => PLACES[Math.abs(seed) % PLACES.length];
function heroOfV(v) { const L = villageLinks(v); return L[0] || null; }
// compass word for a direction in world space (y grows to the south)
function dirWord(dx, dy) { const a = Math.atan2(dy, dx) * 180 / Math.PI, W = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east']; return W[((Math.round(a / 45) % 8) + 8) % 8]; }

// ---------- the main storyline (Anno Domini 1700) ----------
// Each chapter is built from the world when it starts, so its places are real landmarks.
const MAIN_TITLES = ['A Stranger in Ashford', 'Teeth in the Dark', "The Captain's Word", 'The House of Thorns', "The Paymaster's Road", 'Mother of the Mire', 'The Frozen Warden', 'The Iron Crown'];
function mainQuest(i) {
  const A = ASHV(), V2 = heroOfV(A) || A, M = nearestManor(A.x, A.y, 1200), U = nearestCastleOf('usurper', A.x, A.y), RU = nearestCastleOf('ruin', A.x, A.y, true) || nearestCastleOf('ruin', A.x, A.y);
  const q = { id: 'main' + i, main: true, ch: i, title: MAIN_TITLES[i], si: 0, steps: [], rew: { gold: 0, xp: 0 } };
  switch (i) {
    case 0: q.steps = [{ t: 'talk', npc: 'stranger', vid: A.id, txt: 'Speak with the hooded stranger in the inn at Ashford' }];
      q.rew = { gold: 15, xp: 25, items: ['rusty_sword', 'torch'], vid: A.id, rep: 1 }; q.sum = 'You woke in Ashford with nothing but a courier\'s coat. A hooded stranger at the inn has been asking for you.'; break;
    case 1: { const s = siteNear(A.x, A.y, 55, 85, 101);
      q.steps = [{ t: 'item', x: s[0], y: s[1], place: 'the Old Mill', item: "the Stranger's signet ring", spawn: { grp: [['gremlin', 3], ['gremlin_bomber', 1]], carry: 'gremlin' }, txt: "Take back the Stranger's signet from the gremlins at the Old Mill" },
        { t: 'return', npc: 'stranger', vid: A.id, txt: 'Bring the signet to the Stranger at the Ashford inn' }];
      q.rew = { gold: 40, xp: 70, items: ['gambeson'], vid: A.id, rep: 1 }; q.sum = 'Gremlins raided the inn and stole the Stranger\'s ring. He says it proves who he is.'; break; }
    case 2: q.steps = [{ t: 'talk', npc: 'hale', vid: V2.id, txt: 'Show the signet to Captain Hale at ' + V2.name }];
      q.rew = { gold: 30, xp: 60, vid: V2.id, rep: 1 }; q.sum = 'Sir Aldous Grey, the Princess\'s guardian, sends you to the Royal captain who keeps the road at ' + V2.name + '.'; break;
    case 3: q.steps = [{ t: 'manor', mid: M.id, mname: M.name, txt: 'Destroy the master of ' + M.name },
        { t: 'return', npc: 'hale', vid: V2.id, txt: 'Bring Elinor\'s journal to Captain Hale at ' + V2.name }];
      q.rew = { gold: 120, xp: 170, items: ['$armor'], vid: V2.id, rep: 2 }; q.sum = 'The Princess was last seen being taken to ' + M.name + ', a dead house haunted by gremlins and worse.'; break;
    case 4: { const mid = [lerp(A.x, U.x, 0.55), lerp(A.y, U.y, 0.55)], s = siteNear(mid[0], mid[1], 0, 35, 404);
      q.steps = [{ t: 'kill', x: s[0], y: s[1], place: 'the Protector\'s road', n: 1, spawn: { elite: ['dragoon', 'Paymaster Crake'], grp: [['soldier', 2], ['musketeer', 1]] }, txt: 'Ambush the Usurper\'s paymaster on the road to ' + U.name }];
      q.rew = { gold: 150, xp: 210, items: ['pistol'] }; q.sum = 'Elinor\'s journal names a warrant carried by the Usurper\'s paymaster on the road to ' + U.name + '.'; break; }
    case 5: { const s = biomePoint(B_SWAMP, A.x, A.y);
      q.steps = [{ t: 'kill', x: s[0], y: s[1], place: 'the Mirefen', n: 1, spawn: { elite: ['witch', 'Mother Gall'], grp: [['witch', 1], ['gremlin_shaman', 1], ['gremlin', 2]] }, txt: 'Slay Mother Gall, the witch of the Mirefen' }];
      q.rew = { gold: 170, xp: 260, items: ['potion', 'potion', 'potion'] }; q.sum = 'The warrant pays a witch of the Mirefen to keep the Princess silent. Find her in the swamps ' + dirWord(s[0] - A.x, s[1] - A.y) + ' of Ashford.'; break; }
    case 6: { const w = l2w(RU, 0, 10), k = l2w(RU, 0, -8);
      q.steps = [{ t: 'kill', x: w[0], y: w[1], place: RU.name, n: 1, spawn: { elite: ['frostgiant', 'Hrimgar the Warden'], grp: [['vampire', 1]] }, txt: 'Defeat Hrimgar, the Warden of ' + RU.name },
        { t: 'talk', npc: 'heir', x: k[0], y: k[1], txt: 'Free Lady Elinor in the ruined keep' }];
      q.rew = { gold: 220, xp: 340, items: ['longsword'] }; q.sum = 'Elinor is held in ' + RU.name + ' in the Frostlands, guarded by a frost giant.'; break; }
    case 7: { const w = l2w(U, 0, 8);
      q.steps = [{ t: 'kill', x: w[0], y: w[1], place: U.name, n: 1, spawn: { elite: ['lord', 'Lord Protector Ravensworth'], grp: [['soldier', 2]] }, txt: 'Defeat Lord Protector Ravensworth at ' + U.name }];
      q.rew = { gold: 500, xp: 600, items: ['crown_blade'] }; q.sum = 'Ravensworth holds the Iron Crown in ' + U.name + '. Every night he wears it, the old wards fail.'; break; }
  }
  return q;
}
// story text: what people say at each beat
const STORY = {
  prologue: ['Ashford, Anno Domini 1700.',
    'King Edmund the Third died at Michaelmas, and on the same night his daughter Elinor, heir to the Iron Crown, vanished from the palace. The Lord Protector, Ravensworth, took the Crown "until she is found". His redcoats now hold every road.',
    'Since the Crown left its rightful line, the old wards have been failing. The dead walk. Witches gather in the fens, giants come down from the frozen north, and the gremlins have come out of the hills.',
    'A carter found you on the north road, half dead, in a royal courier\'s coat, clutching a broken seal. You remember nothing of the letter. A hooded stranger at the inn has been asking for you.'],
  stranger0: ['So you live. The carter swore you were dead.', 'I knew the King, once. Whatever you carried was meant for Elinor\'s friends, and Ravensworth\'s men would kill for it.', 'Take this old blade and a torch. The nights are not safe.', 'Three nights past, gremlins raided this inn and took my signet ring. They nest at the Old Mill, %MILLDIR% of the village. Bring it back and I\'ll tell you who I am.'],
  stranger1: ['The ring. See the crest: the Iron Crown and the rowan branch.', 'I am Sir Aldous Grey, sworn guardian to the Princess. I failed her the night she was taken.', 'Your letter was for Captain Hale of the Royal army. He keeps the road at ' + '%V2%' + '. Show him my ring; he will know it.'],
  hale2: ['Grey\'s ring... then the old fox lives.', 'We have word the Princess was carried to %MANOR%: a dead house in the woods, full of gremlins and worse. Its master is no man.', 'Find out what happened to her. Gremlins will be the least of it: carry fire for the dead.'],
  hale3: ['Her journal. Her hand, without a doubt.', '"They move me north tomorrow, to the frozen hold. The Protector\'s paymaster carries the warrant." So Ravensworth knows exactly where she is.', 'His paymaster rides the road to %CASTLE%. Take that warrant from him.'],
  warrant: ['The warrant is sealed with the Iron Crown itself.', '"Deliver the girl to the Warden of %RUIN%. Pay the witch of the Mirefen to bind her tongue." It is signed Ravensworth, Lord Protector.', 'If the witch\'s binding holds, Elinor can never name him. Break it first: the witch keeps to the fens %SWAMPDIR% of Ashford.'],
  witch: ['With her last breath Mother Gall laughs: "Too late, little courier. The Warden has her in the ice."', 'Her binding-cords crumble to ash. Whatever she wove over the Princess is broken.', 'North, then, to %RUIN%, in the Frostlands.'],
  heir: ['You came... Grey sent you? Then he lives.', 'Ravensworth never wanted me dead. He needs my blood to hold the Crown, and every night he wears it, the wards fail a little more. That is why the dark things wake.', 'End him at %CASTLE%. Take back the Iron Crown, and I will be waiting in Ashford.'],
  ending: ['The Iron Crown rolls from Ravensworth\'s hand and rings on the flagstones.', 'Within a month Elinor is crowned in the little chapel at Ashford, with Sir Aldous Grey at her side and Captain Hale\'s soldiers lining the square.', 'The wards hold again, mostly. Giants keep to the north and the witches to their fens. The gremlins still giggle in the hedgerows at night, and somebody has to deal with them.', 'THE END. The realm is yours to wander.']
};
function storyText(key) {
  const A = ASHV(), V2 = heroOfV(A) || A, M = nearestManor(A.x, A.y, 1200), U = nearestCastleOf('usurper', A.x, A.y), RU = nearestCastleOf('ruin', A.x, A.y, true) || nearestCastleOf('ruin', A.x, A.y);
  const mill = mainQuest(1).steps[0], sw = biomePoint(B_SWAMP, A.x, A.y);
  return (STORY[key] || []).map(l => l.replace('%MILLDIR%', dirWord(mill.x - A.x, mill.y - A.y)).replace('%SWAMPDIR%', dirWord(sw[0] - A.x, sw[1] - A.y)).replace('%V2%', V2.name).replace('%MANOR%', M ? M.name : 'the old manor').replace('%CASTLE%', U ? U.name : 'his castle').replace('%RUIN%', RU ? RU.name : 'the ruins'));
}
function startMain(i, quiet) {
  S.Q.main = i;
  if (i >= MAIN_TITLES.length) return null;
  const q = mainQuest(i); S.Q.act.unshift(q); S.Q.track = q.id;
  if (!quiet) { banner('NEW QUEST', q.title + ': ' + q.steps[0].txt, 5, '#e8c050'); sfx('horn'); }
  return q;
}

// ---------- side quests: generated per village and giver ----------
const ROLE_TYPES = { innkeeper: ['deliver', 'recover', 'bounty'], priest: ['manor', 'rescue', 'bounty'], captain: ['elite', 'bounty', 'rescue'], smith: ['order'] };
const CAPTIVES = ["Tom the miller's boy", 'Old Bess', 'Wat the tinker', 'Agnes Cole', 'young Hal', 'Martha the alewife', 'Brother Anselm', 'little Rowan'];
const RELICS = ['a silver chalice', "the mill's ledger", "grandmother's locket", "the chapel's bell-clapper", 'the tithe purse', 'a box of seed corn', "the reeve's seal"];
const ELITE_NAMES = { bandit: ['Black Wat', 'Gallows Jack', 'Sour Ned', 'Red Rowan'], soldier: ['Sergeant Crowle', 'Corporal Vane', 'Ensign Blight'], dragoon: ['Cornet Ashe', 'the Grey Dragoon'], vampire: ['Lady Morwen', 'the Pale Abbot'], gremlin_brute: ['Grimtooth', 'Old Scratch', 'Gnawbone'], witch: ['Mother Hobb', 'Mad Meg'] };
function giverKey(e) { return e.qnpc ? e.qnpc : (e.village ? e.village.id : '?') + ':' + e.kind; }
function giverName(e) { if (e.qnpc === 'hale') return 'Captain Hale'; if (e.cname) return e.cname; const v = e.village; return (e.kind === 'innkeeper' ? 'the innkeeper' : e.kind === 'priest' ? 'the priest' : e.kind === 'smith' ? 'the blacksmith' : e.kind) + (v && v.name ? ' of ' + v.name : ''); }
const OFFERC = new Map();
function sideOffers(e) {
  const types = ROLE_TYPES[e.kind]; if (!types || !e.village || !e.village.id) return [];
  const v = e.village, gk = giverKey(e), gen = S.Q.gen[gk] || 0, ck = gk + '#' + gen;
  let out = OFFERC.get(ck);
  if (!out) {
    const R = mulberry(hashStr(gk) ^ Math.imul(gen + 1, 7919)), pool = types.slice(); out = [];
    while (out.length < 2 && pool.length) { const t = pool.splice((R() * pool.length) | 0, 1)[0]; const q = makeSide(t, e, v, gk, gen, out.length, R); if (q) out.push(q); }
    OFFERC.set(ck, out);
  }
  return out.filter(q => !qById(q.id) && !S.Q.done.includes(q.id)).map(q => JSON.parse(JSON.stringify(q)));
}
function makeSide(type, e, v, gk, gen, n, R) {
  const id = 'S|' + gk + '|' + gen + '|' + n, tier = v.tier | 0, gname = giverName(e), seed = hashStr(id);
  const giver = { key: gk, kind: e.kind, vid: v.id, name: gname, vname: v.name };
  const ret = { t: 'return', npc: gk, vid: v.id, txt: 'Return to ' + gname };
  const rew = { gold: Math.round(35 + 28 * tier + R() * 20), xp: Math.round(45 + 35 * tier), items: R() < 0.4 ? ['$any'] : [], vid: v.id, rep: 1 };
  const q = { id, main: false, type, giver, si: 0, rew, tier };
  const site = () => siteNear(v.x, v.y, 45, 100, seed);
  switch (type) {
    case 'bounty': {
      const kinds = e.kind === 'priest' ? ['ghost', 'vampire', 'gremlin'] : e.kind === 'captain' ? ['soldier', 'bandit', 'pikeman'] : ['bandit', 'gremlin', 'bandit'];
      const k = kinds[(R() * kinds.length) | 0], cnt = 3 + ((R() * 3) | 0) + (tier > 1 ? 1 : 0), s = site(), pl = placeName(seed);
      const nm = KINDS[k].name; q.title = 'Bounty: ' + nm + (nm.endsWith('s') ? 'es' : 's') + ' at ' + pl;
      q.sum = gname[0].toUpperCase() + gname.slice(1) + ' will pay for every ' + nm + ' cleared from ' + pl + '.';
      q.lines = ['There\'s a nest of ' + nm + 's at ' + pl + ', not far from here. They\'ve made the road a misery.', 'Clear out ' + cnt + ' of them and I\'ll see you paid.'];
      q.steps = [{ t: 'kill', x: s[0], y: s[1], place: pl, n: cnt, spawn: { grp: [[k, cnt]] }, txt: 'Slay ' + cnt + ' ' + nm + 's at ' + pl }, ret];
      break;
    }
    case 'recover': {
      const it = RELICS[(R() * RELICS.length) | 0], s = site(), pl = placeName(seed);
      q.title = 'Stolen: ' + it; q.sum = 'Gremlins made off with ' + it + '. They were seen at ' + pl + '.';
      q.lines = ['Gremlins! Little green thieves came in the night and took ' + it + '.', 'They giggle about ' + pl + ' after dark. Bring it back and you\'ll not regret it.'];
      q.steps = [{ t: 'item', x: s[0], y: s[1], place: pl, item: it, spawn: { grp: [['gremlin', 2 + ((R() * 2) | 0)], ['gremlin_bomber', 1]].concat(tier > 0 ? [['gremlin_shaman', 1]] : []), carry: 'gremlin' }, txt: 'Recover ' + it + ' from the gremlins at ' + pl }, ret];
      break;
    }
    case 'rescue': {
      const who = CAPTIVES[(R() * CAPTIVES.length) | 0], s = site(), pl = placeName(seed), foe = R() < 0.5 ? 'bandit' : 'gremlin', cnt = 2 + ((R() * 2) | 0) + (tier > 0 ? 1 : 0);
      q.title = 'Rescue ' + who; q.sum = who[0].toUpperCase() + who.slice(1) + ' was carried off to ' + pl + ' by ' + foe + 's.';
      q.lines = [who[0].toUpperCase() + who.slice(1) + ' never came home. ' + (foe === 'bandit' ? 'Bandits' : 'Gremlins') + ' took them to ' + pl + '.', 'Please. Bring them back to ' + v.name + ' alive.'];
      q.steps = [{ t: 'kill', x: s[0], y: s[1], place: pl, n: cnt, spawn: { grp: [[foe, cnt]], captive: who }, txt: 'Drive off the ' + foe + 's holding ' + who + ' at ' + pl },
        { t: 'free', who, txt: 'Free ' + who }, { t: 'escort', who, vid: v.id, x: v.x, y: v.y, r: 12, txt: 'Bring ' + who + ' home to ' + v.name }];
      q.rew.gold += 20; q.rew.rep = 2;
      break;
    }
    case 'manor': {
      const m = nearestManor(v.x, v.y, 700); if (!m || (S.manors[m.id] && S.manors[m.id].cleared)) return makeSide('bounty', e, v, gk, gen, n, R);
      q.title = 'The Master of ' + m.short; q.sum = 'Something rules ' + m.name + '. The priest wants it destroyed.';
      q.lines = ['The bell tolls by itself at night, and the candles in ' + m.name + ' are lit though no one has lived there in fifty years.', 'Whatever is master of that house feeds on our people. Destroy it. Take fire.'];
      q.steps = [{ t: 'manor', mid: m.id, mname: m.name, txt: 'Destroy the master of ' + m.name }, ret];
      q.rew.gold += 80; q.rew.xp += 80; q.rew.rep = 2; q.rew.items = ['$armor'];
      break;
    }
    case 'deliver': {
      const L = villageLinks(v), t = L[(R() * L.length) | 0]; if (!t) return makeSide('recover', e, v, gk, gen, n, R);
      q.title = 'A letter for ' + t.name; q.sum = 'Carry a sealed letter from ' + v.name + ' to the village of ' + t.name + '.';
      q.lines = ['I\'ve a letter that must reach ' + t.name + ', and no carter will take the road with redcoats and worse about.', 'Take it there and their reeve will pay you on delivery.'];
      q.steps = [{ t: 'reach', x: t.x, y: t.y, r: 12, vid: t.id, txt: 'Deliver the letter to ' + t.name }];
      q.rew.gold = Math.round(q.rew.gold * 0.8); q.rew.vid = t.id;
      break;
    }
    case 'order': {
      const opts = [{ iron_ore: 4 + ((R() * 3) | 0), wood: 2 }, { leather_hide: 3, cloth: 2 }, { scrap: 4 }, { wood: 6, iron_ore: 1 }, { steel_ingot: 2, wood: 2 }, { frost_shard: 1, iron_ore: 3 }, { silver: 1, steel_ingot: 2 }];
      const need = opts[(R() * (tier > 0 ? opts.length : 4)) | 0], kinds = ['sword', 'shield', 'armor'], k = kinds[(R() * 3) | 0];
      q.title = 'An order for the forge'; q.sum = gname[0].toUpperCase() + gname.slice(1) + ' needs ' + matsLine(need) + ' to fill an order.';
      q.lines = ['The Protector\'s quartermasters took every scrap of stock I had. I\'ve a lord\'s order to fill and nothing to fill it with.', 'Bring me ' + matsLine(need) + ' and I\'ll forge you something fine for your trouble.'];
      q.steps = [{ t: 'mats', npc: gk, vid: v.id, need, txt: 'Bring ' + matsLine(need) + ' to ' + gname }];
      q.rew.items = [makeVid(TIER[k][Math.min(4, tier + 1)], 0, '', 1)]; q.rew.gold = Math.round(q.rew.gold * 0.7);
      break;
    }
    case 'elite': {
      const kinds = tier >= 2 ? ['dragoon', 'gremlin_brute', 'vampire'] : ['bandit', 'soldier', 'gremlin_brute'], k = kinds[(R() * kinds.length) | 0], names = ELITE_NAMES[k] || ['the Butcher'];
      const nm = names[(R() * names.length) | 0], s = site(), pl = placeName(seed);
      q.title = 'Wanted: ' + nm; q.sum = nm + ', a ' + KINDS[k].name + ', haunts ' + pl + '. There is a price on that head.';
      q.lines = ['There\'s a price on ' + nm + '. A ' + KINDS[k].name + ' who has killed more of my people than I care to count.', 'Last seen at ' + pl + '. Bring me proof it\'s done.'];
      q.steps = [{ t: 'kill', x: s[0], y: s[1], place: pl, n: 1, spawn: { elite: [k, nm], grp: k === 'gremlin_brute' ? [['gremlin', 2]] : [] }, txt: 'Hunt down ' + nm + ' at ' + pl }, ret];
      q.rew.gold += 60; q.rew.xp += 60; q.rew.items = ['$any'];
      break;
    }
  }
  return q;
}
function acceptQuest(q) {
  if (!q || qById(q.id)) return false;
  if (!q.main && S.Q.act.filter(x => !x.main).length >= QMAX_SIDE) { msg('Your quest log is full (' + QMAX_SIDE + ' side quests).', '#ff9a7a'); return false; }
  S.Q.act.push(q); if (!S.Q.track || !qById(S.Q.track)) S.Q.track = q.id;
  banner('QUEST ACCEPTED', q.title + ': ' + q.steps[0].txt, 4.5, '#e8c050'); sfx('pickup');
  return true;
}
function abandonQuest(id) {
  const q = qById(id); if (!q || q.main) return false;
  for (const e of S.ents) if (e.qid === id) e.dead = true;
  S.drops = S.drops.filter(d => d.qid !== id);
  S.Q.act = S.Q.act.filter(x => x !== q); if (S.Q.track === id) S.Q.track = S.Q.act.length ? S.Q.act[0].id : null;
  msg('Quest abandoned: ' + q.title, '#c8b898');
  return true;
}

// ---------- progress ----------
function advance(q) {
  const st = qStep(q); if (st) st.done = true;
  q.si++;
  if (q.si >= q.steps.length) { completeQuest(q); return; }
  const nx = qStep(q);
  msg('Objective: ' + nx.txt, '#ffe070', 6); sfx('rank');
}
function completeQuest(q) {
  const r = q.rew || {}, got = [];
  if (r.gold) { P.gold += r.gold; got.push('+' + r.gold + ' gold'); }
  if (r.xp) { gainXP(r.xp); got.push('+' + r.xp + ' XP'); }
  const icons = [];
  for (const it of r.items || []) { const id = it[0] === '$' ? rollLoot(it, (q.tier || 0) + 0.8 + (q.main ? q.ch * 0.25 : 0)) : it; giveOrDrop(id); autoEquip(id); if (typeof hotAuto === 'function') hotAuto(id); got.push(ITEMS[id].name); icons.push(id); }
  if (r.rep && r.vid) { S.Q.rep[r.vid] = (S.Q.rep[r.vid] || 0) + r.rep; const v = villageByKey(r.vid); got.push('+' + r.rep + ' reputation' + (v ? ' in ' + v.name : '')); }
  S.Q.act = S.Q.act.filter(x => x !== q); S.Q.done.push(q.id);
  if (!q.main && q.giver) S.Q.gen[q.giver.key] = (S.Q.gen[q.giver.key] || 0) + 1;
  for (const e of S.ents) if (e.qid === q.id && e.team === 2) e.dead = true;
  banner('QUEST COMPLETE: ' + q.title.toUpperCase(), got.join(' · '), 5.5, '#8ae07a', icons.length ? icons : null); sfx('win');
  if (S.Q.track === q.id) S.Q.track = null;
  if (q.main) {
    const next = q.ch + 1;
    const beat = { 4: 'warrant', 5: 'witch' }[q.ch] || null;
    const nq = startMain(next, true);
    if (beat) queueStory(nq ? nq.title : 'The Iron Crown', storyText(beat));
    if (!nq) { S.Q.main = MAIN_TITLES.length; queueStory('THE IRON CROWN', storyText('ending')); banner('THE IRON CROWN IS RESTORED', 'Long live Queen Elinor.', 8, '#ffd84a'); }
    else banner('NEW QUEST: ' + nq.title.toUpperCase(), nq.steps[0].txt, 6, '#e8c050');
  }
  if (!S.Q.track) S.Q.track = S.Q.act.length ? S.Q.act[0].id : null;
  saveGame();
}
function villageByKey(id) { if (!id) return null; const p = id.split(','); return villageFor(+p[0], +p[1]); }
function queueStory(title, lines) { S.Q.story.push({ title, lines }); }
// kills of quest-tagged foes
function questOnKill(e) {
  if (!e.qid) return;
  const q = qById(e.qid); if (!q) return;
  if (e.qcarry) { S.drops.push({ kind: 'qitem', id: 'qitem', qid: q.id, name: e.qcarry, x: e.x, y: e.y, t: 1e9, warn: 0 }); msg('The thief dropped ' + e.qcarry + '!', '#ffe070'); }
  const st = qStep(q);
  if (st && st.t === 'kill' && e.qcount && e.qstep === q.si) { st.have = (st.have || 0) + 1; if (st.have >= st.n) { if (st.spawn && st.spawn.captive) { const c = S.ents.find(x => x.qid === q.id && x.kind === 'captive'); if (c) msg(st.spawn.captive + ' is free of the guards. Speak to them.', '#ffe070'); } advance(q); } else msg(q.title + ': ' + st.have + '/' + st.n, '#e8dcc0', 3); }
}
function questOnItem(d) {
  const q = qById(d.qid); if (!q) return;
  const st = qStep(q);
  banner('RECOVERED', d.name, 3.5, '#ffe070');
  if (st && st.t === 'item') { st.have = 1; advance(q); }
}
// spawn an objective's foes when the player comes near
function spawnStep(q, st) {
  const sp = st.spawn || {}, D = Math.max(danger(), (q.tier || 0) * 0.4 + (q.main ? q.ch * 0.18 : 0)), key = 'q:' + q.id;
  const tag = (e, count) => { e.qid = q.id; e.qstep = q.si; e.qcount = count; e.home = key; e.post = { x: e.x, y: e.y }; e.leash = 34; e.aggroR = 22; return e; };
  const left = st.n - (st.have || 0); let counted = 0;
  if (sp.elite) { const e = tag(spawnElite(sp.elite[0], st.x, st.y, sp.elite[1], { D }), true); counted++; if (sp.elite[0] === 'lord') e.a = 0; }
  for (const [k, n] of sp.grp || []) for (let i = 0; i < n; i++) {
    const countIt = st.t === 'kill' && !sp.elite && counted < left;
    if (st.t === 'kill' && !sp.elite && counted >= left) break;
    tag(spawnNear(k, st.x, st.y, 5, { D }), countIt); if (countIt) counted++;
  }
  if (sp.carry && st.t === 'item') { const c = S.ents.find(e => e.qid === q.id && e.kind === sp.carry && !e.dead && !e.qcarry); if (c) { c.qcarry = st.item; c.noSteal = true; } }
  if (sp.captive && !S.ents.some(e => e.qid === q.id && e.kind === 'captive')) { const c = spawnNear('captive', st.x + 1.5, st.y, 2, { home: key }); c.qid = q.id; c.who = sp.captive; c.cname = sp.captive; c.role = 'quest'; }
  st.spawned = true;
}
function ensureNPC(key, kind, x, y, extra) {
  if (S.ents.some(e => e.qnpc === key && !e.dead)) return;
  const ck = Math.floor(x / CS) + ',' + Math.floor(y / CS); if (!CHUNKS.has(ck)) return;
  const e = spawnEnt(kind, x, y, Object.assign({ qnpc: key, home: ck, role: 'quest', a: 0, homeA: 0 }, extra || {}));
  return e;
}
function haleSpot() { const A = ASHV(), V2 = heroOfV(A) || A, a = V2.gap + Math.PI - 0.9; return [V2, V2.x + Math.cos(a) * 5.2, V2.y + Math.sin(a) * 5.2, a + Math.PI]; }
function villageCaptain(v) { return v && v.id !== '0,0' && v !== haleSpot()[0] && (hash2(v.cx * 13 + 1, v.cy * 7 + 3) < 0.45 || v.tier >= 1); }
const CAPT_NAMES = ['Ashby', 'Morrow', 'Fenn', 'Carrow', 'Latimer', 'Rook', 'Penhallow', 'Strand', 'Mallory', 'Thorne'];
function questOnChunk(c) {
  const v = c.spawnVillage; if (!v) return;
  const hs = haleSpot();
  if (v === hs[0] && S.Q && S.Q.main >= 2) ensureNPC('hale', 'captain', hs[1], hs[2], { village: v, cname: 'Captain Hale', a: hs[3], homeA: hs[3] });
  else if (villageCaptain(v)) { const a = v.gap + Math.PI - 0.9; ensureNPC('cap:' + v.id, 'captain', v.x + Math.cos(a) * 5.2, v.y + Math.sin(a) * 5.2, { village: v, cname: 'Captain ' + CAPT_NAMES[Math.abs(v.seed) % CAPT_NAMES.length], a: a + Math.PI, homeA: a + Math.PI }); }
}
let qT = 0;
function questUpdate(dt) {
  qT -= dt; if (qT > 0) return; qT = 0.25;
  // story NPCs that only exist once the story needs them
  if (S.Q.main >= 2) { const hs = haleSpot(); ensureNPC('hale', 'captain', hs[1], hs[2], { village: hs[0], cname: 'Captain Hale', a: hs[3], homeA: hs[3] }); }
  for (const q of S.Q.act) {
    const st = qStep(q); if (!st) continue;
    const d = st.x !== undefined ? Math.hypot(P.x - st.x, P.y - st.y) : 1e9;
    if (st.t === 'kill' || st.t === 'item') {
      if (!st.spawned && d < 60) spawnStep(q, st);
      else if (st.spawned && d > 75) {
        const alive = S.ents.some(e => e.qid === q.id && !e.dead && e.team === 1), drop = S.drops.some(x => x.qid === q.id);
        if (!alive && !drop && (st.t === 'item' || (st.have || 0) < st.n)) st.spawned = false;
      }
    } else if (st.t === 'reach') { if (d < st.r) advance(q); }
    else if (st.t === 'manor') { if (S.manors[st.mid] && S.manors[st.mid].cleared) { if (q.main && q.ch === 3) banner("ELINOR'S JOURNAL", 'Among the master\'s ashes lies a torn journal in a girl\'s hand.', 5, '#c8b8ff'); advance(q); } }
    else if (st.t === 'escort') {
      const c = S.ents.find(e => e.qid === q.id && e.kind === 'captive' && !e.dead);
      if (!c) { const p = findFree(P.x - 1.5, P.y, 0.5, 2); const n = spawnEnt('captive', p[0], p[1], { home: 'q:' + q.id }); n.qid = q.id; n.freed = true; n.cname = st.who; n.role = 'quest'; }
      else if (Math.hypot(c.x - st.x, c.y - st.y) < st.r) { msg(st.who + ' is home safe.', '#8ae07a'); c.dead = true; advance(q); }
    } else if (st.t === 'talk' && st.npc === 'heir') { ensureNPC('heir', 'heir', st.x, st.y, { a: 0, homeA: 0 }); }
  }
  if (S.Q.main >= 7) { const A = ASHV(), a = A.gap + Math.PI + 0.25; ensureNPC('heirA', 'heir', A.x + Math.cos(a) * 3.2, A.y + Math.sin(a) * 3.2, { village: A, a: a + Math.PI, homeA: a + Math.PI }); }
}
// ---------- NPC matching, markers, dialogue content ----------
function npcIs(e, st) {
  if (!st || !st.npc) return false;
  if (st.npc === 'stranger') return e.kind === 'stranger';
  if (st.npc === 'hale') return e.qnpc === 'hale';
  if (st.npc === 'heir') return e.kind === 'heir';
  return giverKey(e) === st.npc;
}
function npcBusiness(e) {
  const out = { turnin: [], story: [], free: [], offers: [] };
  for (const q of S.Q.act) {
    const st = qStep(q); if (!st) continue;
    if (st.t === 'return' && npcIs(e, st)) out.turnin.push(q);
    else if (st.t === 'mats' && npcIs(e, st) && haveMats(st.need)) out.turnin.push(q);
    else if (st.t === 'talk' && npcIs(e, st)) out.story.push(q);
    else if (st.t === 'free' && e.kind === 'captive' && e.qid === q.id && !e.freed) out.free.push(q);
  }
  if (ROLE_TYPES[e.kind] && e.village) out.offers = sideOffers(e);
  return out;
}
function questMark(e) {
  if (e.team !== 2 || !S.Q) return null;
  const b = npcBusiness(e);
  if (b.turnin.length || b.story.length || b.free.length) return '?';
  if (b.offers.length && S.Q.act.filter(q => !q.main).length < QMAX_SIDE) return '!';
  return null;
}
// the dialogue lines for a story step (talk / return) with this NPC
function storyLines(q) {
  if (!q.main) return null;
  switch (q.ch) {
    case 0: return storyText('stranger0');
    case 1: return storyText('stranger1');
    case 2: return storyText('hale2');
    case 3: return storyText('hale3');
    case 6: return storyText('heir');
  }
  return null;
}
function storyStep(q) { const st = qStep(q); if (!st) return; if (q.main && q.ch === 0) { /* the stranger's gifts come with the reward */ } advance(q); }
function turnIn(q) { const st = qStep(q); if (!st || st.t !== 'return') return; advance(q); }
function freeCaptive(q, e) { e.freed = true; e.qid = q.id; msg(e.cname + ' will follow you home.', '#ffe070'); advance(q); }
// ---------- objective target for the HUD / minimap marker ----------
function questTarget(q) {
  q = q || qById(S.Q.track); const st = qStep(q); if (!st) return null;
  if (st.t === 'kill' || st.t === 'item') { const it = S.drops.find(d => d.qid === q.id); if (it) return { x: it.x, y: it.y }; return { x: st.x, y: st.y }; }
  if (st.t === 'reach' || st.t === 'escort') return { x: st.x, y: st.y };
  if (st.t === 'manor') { const m = [...MANC.values()].find(m => m && m.id === st.mid); if (m) { const p = l2w(m, 0, MAN_HZ - 2); return { x: p[0], y: p[1] }; } return null; }
  if (st.t === 'free') { const c = S.ents.find(e => e.qid === q.id && e.kind === 'captive'); return c ? { x: c.x, y: c.y } : null; }
  if (st.t === 'talk' || st.t === 'return' || st.t === 'mats') {
    const e = S.ents.find(x => !x.dead && x.team === 2 && npcIs(x, st)); if (e) return { x: e.x, y: e.y };
    if (st.npc === 'stranger') { const L = villageLayout(ASHV()), n = L.npcs.find(n => n.kind === 'stranger'); if (n) return { x: n.x, y: n.y }; }
    if (st.x !== undefined) return { x: st.x, y: st.y };
    const v = villageByKey(st.vid); if (v) return { x: v.x, y: v.y };
  }
  return null;
}
function stepProgress(st) { if (st && st.t === 'mats') return ' (' + Object.entries(st.need).map(([k, n]) => Math.min(invCount(k), n) + '/' + n).join(', ') + ')'; return st && st.n > 1 && (st.t === 'kill') ? ' (' + (st.have || 0) + '/' + st.n + ')' : ''; }
function deliverOrder(q) { const st = qStep(q); if (!st || st.t !== 'mats' || !haveMats(st.need)) return false; takeMats(st.need); msg('You hand over ' + matsLine(st.need) + '.', '#e8dcc0'); advance(q); return true; }
// ---------- save / load ----------
function questSave() { return JSON.parse(JSON.stringify(S.Q)); }
function questLoad(q, legacy) {
  questInit();
  if (q && typeof q === 'object' && Array.isArray(q.act)) {
    S.Q = Object.assign(S.Q, q); S.Q.act = q.act.filter(x => x && Array.isArray(x.steps)); S.Q.done = Array.isArray(q.done) ? q.done : []; S.Q.story = [];
    for (const x of S.Q.act) for (const st of x.steps) st.spawned = false;
  } else startMain(0, true);
  if (!S.Q.act.some(q => q.main) && S.Q.main < MAIN_TITLES.length) startMain(S.Q.main, true);
}
