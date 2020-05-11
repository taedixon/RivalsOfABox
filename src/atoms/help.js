export default `
# Credits (scroll down for help)

---

I'm just gonna put this front and center so that there isn't any doubt as to which parties various stuffs belongs to:

- Credit for the sound effects goes to "[rafael langoni smith](http://rafaelsmith.com/home)"
  & "[flashygoodness](https://flashygoodness.bandcamp.com/album/rivals-of-aether-original-soundtrack)"
- Mechanics/Physics based upon those found within [Rivals of Aether](https://www.rivalsofaether.com/)

This webapp was created by [fudgepop01](https://twitter.com/fudgepop01), to assist development Steam Workshop characters for the game, Rivals of Aether.

This webapp was PWND and made way gooder by N0><1[)

B3

---

# Help

---

## Overview

Moves in Rivals of Aether are structured in an interesting way. Every move is split into different parts. Each part is called a "window."
Each of these "windows" is able to modify the character in various ways. Each window can also create "hitboxes" that are activated on particular frames.
These "hitboxes" can be circles, rectangles, or rounded rectangles and have various properties. The attack itself also can have certian propreties, as well
as the overall character. All of these things can be adjusted, and should hopefully be explained sufficiently in the coming paragraphs.

### Getting Started

Click the "upload spritesheet" button in the top-left corner. From here, choose a horizontal spritesheet that you have on your machine.
After everything loads, set the number of frames that the spritesheet has. What you do from this point is basically up to you.

### Parts of the App

Each part of the app serves a particular purpose:

- **left toolbar** (where you upload the spritesheet and see this message)
  - various ways of importing and exporting data.
- **top**
  - the individual sprites in the spritesheet.
  - shows the current frame
  - a sprite can be selected to set the first sprite frame of the selected window
- below that, the **timeline**
  - tools on the top can modify the playback of the attack
  - the timeline itself can be clicked to select the attack window you wish to edit
- below that, the **metadata** (the dark bar below the timeline)
  - can be used to give the current window a name and color
  - can be used to give the selected hitbox a name and color
- below that, the **main stage**
  - a visual preview of how the move will look in-game
  - can be zoomed in and out of with the zoom dropdown
  - is pixel-perfect
- **right toolbar**
  - parameters for the selected window or hitbox
  - hover over a parameter to see a description of what it does

### Editing

hitboxes can be created by clicking and dragging in the main stage when the respective tool is selected.
The bounding box of the sprite is shown as a black border. The sprite itself can be repositioned by click + dragging if the "lock position" box is unchecked.

etc etc.

click

### Exporting


---

# Tips

---

there are keyboard shortcuts!

- \`,\` and \`.\` go back and forward by 1 frame
- \`[\` and \`]\` go back and forward by 1 window
- \`v\` will enter "pan" mode
- \`o\` will enter circle mode
- \`r\` will enter rounded rectangle mode
- \`b\` will enter rectangle mode
- \`backspace\` will enter erase mode

---

# Changelog

---

### 10/8/2019

- (+) added support for sound playback
- (+) added this help message
- (+) allowed the ability to import and export WIP moves as a small file
- (-) removed filename display
  - seemed unnecessary and took up space
- fixed bug where exporting didn't use the attack index names properly
- fixed bug where sound exports didn't export with "asset_get()"

Upcoming features:

- none, go away

---
`;