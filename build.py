import pathlib
root = pathlib.Path(__file__).parent
src = root / 'src'
js = '\n'.join((src / f).read_text() for f in ['1_core.js','2_world.js','3_render.js','4_game.js','5_ui.js'])
(root / 'test' / 'game.js').write_text(js)
html = (src / 'shell.html').read_text().replace('/*__JS__*/', js)
assert '</script' not in js
(root / 'index.html').write_text(html)
print('ok', len(html))
