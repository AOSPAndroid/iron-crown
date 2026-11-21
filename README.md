# Iron Crown 1700

A third-person, open-world RPG that runs in the browser. It is set in Anno Domini 1700: by day you fight the Usurper's redcoat armies, and at night vampires, witches and giants come out.

## Play

Open `index.html` in any modern browser. It is one self-contained file with no dependencies, and it works with a keyboard or a touchscreen.

## Features

- **Near-endless world.** The map is generated in chunks as you explore. It has six biomes: the Green Vales, the Old Forest, the Frostlands to the north (snow, frost giants), the Mirefen Swamps, the Grimmoor Heath (giants) and the Southern Sands to the south.
- **Villages and ruins.** Villages have a merchant, guards, a campfire you can rest at, a well and fields. Ruins hold treasure chests.
- **Day and night.** A full day takes 7 minutes. Without a torch, nights are dark. Every fifth night has a blood moon.
- **Unarmed start.** You begin in a linen tunic with no weapon. Your first fight is with your fists: landing 3 hits in a row gives a takedown.
- **Two hands.** Each hand holds one item:
  - swords (5 tiers)
  - shields that block attacks from the front (buckler, kite, tower)
  - a torch, which gives light and burns undead
  - a flintlock pistol

  Two-handed items take both hands: the claymore, and bows (hold to draw; they need arrows).
- **Armor tiers.** Tunic, gambeson, leather, chainmail, half-plate, full plate. Heavier armor protects more but slows you down.
- **Horse riding.** Mount and dismount, or whistle to call your horse. A charge does extra damage and tramples enemies. Pikemen deal double damage to riders, and a giant's slam knocks you off.
- **Enemies.**
  - By day: bandits, soldiers, pikemen, musketeers, archers, and dragoons (cavalry). There are also battles where the Royal army fights redcoats.
  - At night: vampires (they drain health and teleport behind you) and witches (homing fireballs, teleporting).
  - Giants and frost giants (ground slams, boulders).
- **RPG systems.** XP and levels, an inventory (20 slots), buying and selling with merchants, and loot that gets better the further you travel. The game saves when you rest at a campfire and also autosaves.

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Move / turn | W S / A D (or arrows) | Left-side joystick |
| Right hand | J, Space, left click | RIGHT |
| Left hand (hold to block) | K, Q, right click | LEFT |
| Trade / rest / loot / mount | E | USE |
| Horse (mount, dismount, call) | H | HORSE |
| Potion | R | POT |
| Inventory | I, Tab, B | BAG |
| Pause / mute | P, Esc / M | II |

## Status

- `index.html` here is v1, which draws everything with ASCII characters in a chase-camera view.
- A rewrite to **sprite-stacked pixel art** is in progress: voxel models are drawn as stacks of slices, with a rotating top-down camera ([technique](https://www.spritecook.ai/blog/sprite-stacking-pixel-art)). It will arrive with the split source (`src/`), a build script and tests.
