import pathlib
root = pathlib.Path(__file__).parent
src = root / 'src'
js = '\n'.join((src / f).read_text() for f in ['1_core.js','2_world.js','2_struct.js','2_manor.js','3_gl.js','3_mesh.js','3_scene.js','3_arch.js','3_manor.js','4_game.js','4_quest.js','5_ui.js'])
(root / 'test' / 'game.js').write_text(js)
html = (src / 'shell.html').read_text().replace('/*__JS__*/', js)
assert '</script' not in js
(root / 'index.html').write_text(html)
print('ok', len(html))
