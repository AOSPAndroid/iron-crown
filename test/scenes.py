"""Playwright screenshots of test scenes -> shots/ (headless Chrome with SwiftShader WebGL2).
Usage: python3 test/scenes.py [d|m] [scene ...]"""
import pathlib, asyncio, sys
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / 'index.html').as_uri()
(ROOT / 'shots').mkdir(exist_ok=True)
ARGS = ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
SETUP = """
window.scene = function(opts){
  S.mode='play'; P.drawing=false; P.draw=0; P.blocking=false; P.anim=[0,0]; P.v=opts.v||0; P.step=opts.step||0;
  S.ents = S.ents.filter(e=>e.team===2||e.post); S.projs=[]; S.parts=[]; S.drops=[]; S.corpses=[]; S.banner=null; S.msgs=[]; S.texts=[];
  P.x=opts.x; P.y=opts.y; P.a=opts.a===undefined?-Math.PI/2:opts.a; P.mounted=!!opts.mounted; P.hp=P.maxHp;
  S.horse.x=P.x+2.2*Math.cos(P.a+1.2); S.horse.y=P.y+2.2*Math.sin(P.a+1.2); S.horse.a=P.a+0.6; S.horse.state=P.mounted?'ridden':'idle';
  S.time=opts.time===undefined?0.45:opts.time; S.darkness=darkAt(S.time); S.tut=3; S.dirT=999; S.bloodMoon=false;
  P.armor=opts.armor||'chainmail'; P.hands=opts.hands||['kite_shield','iron_sword'];
  manageChunks(80); updateCamera(0,true); S.curBiome=biomeAt(P.x,P.y);
  const f=P.a, ax=Math.cos(f), ay=Math.sin(f), rx=-ay, ry=ax;
  for (const s of (opts.ents||[])) { const e=spawnEnt(s[0], P.x+ax*s[1]+rx*s[2], P.y+ay*s[1]+ry*s[2], {D:0}); e.a=Math.atan2(P.y-e.y,P.x-e.x); if(s[3]) Object.assign(e,s[3]); e.cd=99; e.tT=99; e.target=null; }
  for (let i=0;i<40 && prewarmScene(9)>0;i++);
  updateGrassMap(true);
  for (let i=0;i<6;i++){ S.t+=0.05; render(0.05); }
  S.mode='paused';
  return 0;
}
window.findBiome = function(b, minR){ for(let r=minR||150;r<2600;r+=40) for(let k=0;k<24;k++){const a=k/24*Math.PI*2,x=Math.cos(a)*r,y=Math.sin(a)*r; if(biomeAt(x,y)===b && biomeAt(x,y-14)===b && biomeAt(x+8,y)===b && biomeAt(x-8,y)===b) return [x,y];} return [0,0]; };
"""
SCENES = {
  'field': "scene({x:16,y:-70, time:0.36, hands:['buckler','iron_sword'], armor:'leather', v:3.5, step:2})",
  'fight': "scene({x:16,y:-60, time:0.62, ents:[['soldier',4.5,-1.8,{state:'wind',wt:0.15}],['pikeman',7,1.8],['musketeer',11,-4,{state:'aim'}],['archer',10,4.5,{state:'aim'}],['bandit',3.6,2.4,{hurtT:0.1}],['dragoon',14,0,{moving:true}],['ally',1.5,-3,{state:'wind',wt:0.1}]]}); P.anim[1]=0.1; S.mode='play'; render(0.016); S.mode='paused';",
  'night': "scene({x:16,y:-78, a:-1.2, time:0.93, hands:['torch','steel_sword'], armor:'gambeson', v:2, step:1, ents:[['vampire',6,-1.5,{state:'wind',wt:0.2}],['witch',9,3,{state:'cast',elev:1.3}],['vampire',11,-4]]})",
  'mounted': "scene({x:16,y:-92, mounted:true, time:0.4, hands:['torch','longsword'], armor:'halfplate', v:9, step:3, ents:[['soldier',12,-3],['soldier',13,2],['dragoon',18,4,{moving:true}]]})",
  'village': "scene({x:16,y:31, a:-Math.PI/2, time:0.9, hands:['torch','iron_sword'], armor:'tunic'})",
  'giants': "scene({x:16,y:-60, time:0.55, hands:['torch','steel_sword'], armor:'leather', ents:[['giant',9,-3,{state:'slam',wt:0.3}],['frostgiant',13,5,{state:'throw',wt:0.3}]]})",
}
async def shoot(pg, name, js):
    await pg.evaluate(js)
    await pg.wait_for_timeout(350)
    await pg.screenshot(path=str(ROOT / 'shots' / f'sc_{name}.png'))
async def main(w, h, touch, tag, only):
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
        ctx = await b.new_context(viewport={'width': w, 'height': h}, has_touch=touch, is_mobile=touch, device_scale_factor=2 if touch else 1)
        pg = await ctx.new_page(); errs = []
        pg.on('console', lambda m: errs.append(m.text) if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
        await pg.goto(URL); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=str(ROOT / 'shots' / f'sc_{tag}_title.png'))
        await pg.evaluate("document.getElementById('btnNew').click()"); await pg.wait_for_timeout(2500)
        await pg.evaluate(SETUP + '; 0')
        for k, js in SCENES.items():
            if only and k not in only: continue
            await shoot(pg, tag + '_' + k, js)
        if not only or 'snow' in only:
            s = await pg.evaluate("findBiome(2)")
            await shoot(pg, tag + '_snow', f"scene({{x:{s[0]},y:{s[1]}, time:0.5, hands:['torch','longsword'], armor:'chainmail', v:2, step:1, ents:[['frostgiant',10,-4,{{state:'throw',wt:0.3}}],['bandit',5,3]]}})")
        if not only or 'swamp' in only:
            s = await pg.evaluate("findBiome(3)")
            await shoot(pg, tag + '_swamp', f"scene({{x:{s[0]},y:{s[1]}, time:0.82, hands:['torch','iron_sword'], armor:'leather', ents:[['witch',8,2,{{elev:1.3}}]]}})")
        if not only or 'desert' in only:
            s = await pg.evaluate("findBiome(5)")
            await shoot(pg, tag + '_desert', f"scene({{x:{s[0]},y:{s[1]}, time:0.42, ents:[['archer',8,0,{{state:'aim'}}]]}})")
        info = await pg.evaluate("[GLOK, RW, RH, SW, SH, CW, CH, GCH.size, lastRenderMs.toFixed(1)]")
        print(tag, 'GLOK, canvas, scene, cells, chunks, last render ms:', info)
        print(tag, 'errors', errs[:10])
        await b.close()
async def run():
    tags = [a for a in sys.argv[1:] if a in ('d', 'm')] or ['d', 'm']
    only = [a for a in sys.argv[1:] if a not in ('d', 'm')]
    if 'd' in tags: await main(1280, 720, False, 'd', only)
    if 'm' in tags: await main(390, 844, True, 'm', only)
asyncio.run(run())
