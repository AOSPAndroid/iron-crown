import pathlib
import asyncio, sys
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / 'index.html').as_uri()
(ROOT / 'shots').mkdir(exist_ok=True)
SETUP = """
window.scene = function(opts){
  S.mode='play'; P.drawing=false; P.draw=0; P.blocking=false; S.ents = S.ents.filter(e=>e.team===2||e.post); S.projs=[]; S.parts=[]; S.drops=[]; S.corpses=[]; S.banner=null; S.msgs=[];
  P.x=opts.x; P.y=opts.y; P.a=opts.a===undefined?-Math.PI/2:opts.a; P.v=0; P.mounted=!!opts.mounted; P.hp=P.maxHp;
  S.horse.x=P.x+3; S.horse.y=P.y+1; S.horse.state=P.mounted?'ridden':'idle';
  S.time=opts.time===undefined?0.45:opts.time; S.darkness=darkAt(S.time); S.tut=3; S.dirT=999;
  P.armor=opts.armor||'chainmail'; P.hands=opts.hands||['kite_shield','iron_sword'];
  manageChunks(60); updateCamera(0,true);
  const f=P.a, ax=Math.cos(f), ay=Math.sin(f), rx=-ay, ry=ax;
  for (const s of (opts.ents||[])) { const e=spawnEnt(s[0], P.x+ax*s[1]+rx*s[2], P.y+ay*s[1]+ry*s[2], {D:0}); e.a=Math.atan2(P.y-e.y,P.x-e.x); if(s[3]) Object.assign(e,s[3]); e.cd=99; e.tT=99; e.target=null; }
  for (let i=0;i<3;i++){ S.t+=0.016; render(0.016); }
  S.mode='paused';
}
"""
async def shoot(pg, name, js, w, h):
    await pg.evaluate(js)
    await pg.wait_for_timeout(150)
    await pg.screenshot(path=str(ROOT / 'shots' / f'sc_{name}.png'))
async def main(w, h, touch, tag):
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width': w, 'height': h}, has_touch=touch, is_mobile=touch, device_scale_factor=2 if touch else 1)
        pg = await ctx.new_page(); errs = []
        pg.on('console', lambda m: errs.append(m.text) if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
        await pg.goto(URL); await pg.wait_for_timeout(800)
        await pg.evaluate("document.getElementById('btnNew').click()"); await pg.wait_for_timeout(1800)
        await pg.evaluate(SETUP + '; 0')
        sc = {
          'fight': "scene({x:16,y:-60, ents:[['soldier',5,-2.5,{state:'wind'}],['pikeman',7,1.5],['musketeer',11,-4,{state:'aim'}],['archer',10,4,{state:'aim'}],['bandit',4,3],['dragoon',14,0,{moving:true}],['ally',1,-2.5,{state:'wind'}]]}); P.anim[1]=0.2;  render(0.016);",
          'giants': "scene({x:16,y:-60, hands:['torch','steel_sword'], armor:'leather', ents:[['giant',9,-3,{state:'slam'}],['frostgiant',15,5,{state:'throw'}]]})",
          'night': "scene({x:16,y:2, a:Math.PI/2, time:0.9, hands:['torch','steel_sword'], armor:'gambeson', ents:[['vampire',4,-1.5,{state:'wind'}],['witch',8,2.5,{state:'cast',elev:1.4}],['vampire',9,-4]]})",
          'mounted': "scene({x:16,y:-90, mounted:true, hands:['long_bow','long_bow'], armor:'halfplate', ents:[['soldier',12,-3],['soldier',13,2]]}); P.drawing=true; P.draw=0.8; P.v=8; P.step=1; S.mode='play'; render(0.016); S.mode='paused';",
          'block': "scene({x:16,y:-60, hands:['tower_shield','longsword'], armor:'fullplate', ents:[['bandit',3,0,{state:'wind'}]]}); P.blocking=true; S.mode='play'; render(0.016); S.mode='paused';",
          'loot': "scene({x:16,y:-60, hands:[null,null], armor:'tunic', ents:[['bandit',3,1,{downT:2}]]}); for(const [id,dx,dy] of [['iron_sword',2,-2],['potion',3,1],['kite_shield',4,-1],['long_bow',5,2],['chainmail',2.5,2.5],['arrows',6,0],['torch',4.5,-3]]) S.drops.push({kind:'item',id,n:1,x:P.x+dy,y:P.y-dx,t:60,warn:0}); S.drops.push({kind:'gold',val:5,x:P.x-1,y:P.y-3,t:60}); S.corpses.push({x:P.x+2,y:P.y-6,c:'R',t:20}); S.corpses.push({x:P.x-3,y:P.y-8,c:'H',t:20}); S.corpses.push({x:P.x+5,y:P.y-12,c:'G',t:20}); S.mode='play'; render(0.016); S.mode='paused';",
          'village': "scene({x:16,y:24, a:-Math.PI/2, hands:['buckler','iron_sword'], armor:'leather'})",
        }
        for k, js in sc.items():
            await shoot(pg, tag + '_' + k, js, w, h)
        # find desert & snow spots
        spot = await pg.evaluate("(()=>{let d=null,s=null,best=1e9; for(let r=150;r<1400 && !d;r+=40) for(let k=0;k<24;k++){const a=k/24*Math.PI*2,x=Math.cos(a)*r,y=Math.sin(a)*r; if(biomeAt(x,y)===5&&!d)d=[x,y];} for(let r=150;r<2400;r+=40) for(let k=0;k<24;k++){const a=k/24*Math.PI*2,x=Math.cos(a)*r,y=Math.sin(a)*r; if(biomeAt(x,y)!==2||biomeAt(x,y-12)!==2||tileAt(x,y)!==5||tileAt(x,y-10)!==5) continue; let n=0; for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)getChunk(Math.floor(x/32)+i,Math.floor((y-8)/32)+j); forStatics(x,y-8,12,()=>{n++;}); const sc=Math.abs(n-3); if(sc<best){best=sc;s=[x,y];} } return [d,s];})()")
        if spot[0]: await shoot(pg, tag + '_desert', f"scene({{x:{spot[0][0]},y:{spot[0][1]}, ents:[['archer',8,0,{{state:'aim'}}]]}})", w, h)
        if spot[1]: await shoot(pg, tag + '_snow', f"scene({{x:{spot[1][0]},y:{spot[1][1]}, hands:['torch','longsword'], armor:'chainmail', ents:[['frostgiant',6.5,-4.5,{{state:'throw'}}],['frostgiant',9,5]]}}); S.mode='play'; for(let i=0;i<20;i++){{S.t+=0.03; render(0.03);}} S.mode='paused';", w, h)
        perf = await pg.evaluate("(()=>{ scene({x:16,y:-60, ents:[['soldier',5,-2],['pikeman',7,1],['musketeer',11,-4],['archer',10,4],['bandit',4,3],['dragoon',14,0],['ally',1,-2],['giant',16,6]]}); S.mode='play'; let t=performance.now(), worst=0; for(let i=0;i<120;i++){ const a=performance.now(); P.a+=0.03; updateCamera(0.016); S.t+=0.016; render(0.016); worst=Math.max(worst, performance.now()-a);} const avg=(performance.now()-t)/120; S.mode='paused'; return [avg.toFixed(2), worst.toFixed(2), COMPS.size, MODELS.size]; })()")
        print(tag, 'turning render avg/worst ms, comps, models', perf)
        print(tag, 'errors', errs[:8])
        await b.close()
async def run():
    await main(1280, 720, False, 'd')
    await main(390, 844, True, 'm')
asyncio.run(run())
