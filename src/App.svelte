<script>
	import LZS from 'lz-string';

	import HitboxSummary from "./components/hitboxSummary.svelte";
	import ParamsBuilder from './components/paramsBuilder.svelte';
	import Timeline from './components/timeline.svelte';
	import LocalStorageFS from './components/LocalStorageFS.svelte';
	import Modal from './atoms/modal.svelte';

	import {
		default as winProps,
		isDisabled
	} from './util/windowProperties.js';
	import hitboxProps from './util/hitboxProperties.js';
	import atkDataProps from './util/atkDataProperties.js';
	import charProps from './util/characterProperties.js';
	import { velocityAtFrame, velocityAtFrameGrav } from './util/XAtFrames.js';
	import { strip, populate } from './util/importExportData.js';
	import exporter from './util/exportToGML.js';
	import { ATK_INDEXES } from "./util/exportToGML.js";

	// makes a confirmation dialog appear before closing the window
	window.onbeforeunload = (e) => 'derp';

	let modalVisible = false;

	let spritesheetSrc = {
		file: '...',
		dataUrl: '',
		dimensions: {
			width: 0,
			height: 0
		},
		framecount: 1
	};

	let char = charProps;
	let windows = [
		{
			meta: {
				name: 'New Window',
			},
			data: JSON.parse(JSON.stringify({...winProps}))
		},
	];
	let hitboxes = [
		// {
		// 	meta: {
		// 		color: ...
		// 		name: ...
		//		etc: ...
		// 	},
		//  data: {HG_Attrs...}
		// }
	]
	let atkData = JSON.parse(JSON.stringify(atkDataProps));

	let editingMode = 'window';
	let mainViewInfo = true;
	let activeEl;
	let tools = [
		["pan_tool", "pan", "v"],
		["add_box", "rectangle", "b"],
		["rounded_corner", "round", "r"],
		["add_circle", "circle", "o"],
		["clear", "eraser", "no shortcut"],
	];
	tools.selected = "pan";

	let renderer;
	let rend;
	$: rend = (renderer) ? renderer : {clientWidth: 100, clientHeight: 100};

	let anim = {
		// controlled
		animFrame: 0,
		playSpeed: 1,
		playing: false,
		loop: true,
		zoom: 2,
		cameraX: 0,
		cameraY: 0,
		movement: true,

		audio: true,

		// calculated
		duration: 0,
		spriteFrame: 0,
		windowIndex: 0, // also known as "windex" :^)
		windowFrame: 0,
		windowPositions: [],

		hitboxFrames: {},

		xpos: 0,
		ypos: 0,
		charFramePositionData: [],
	}

	let calc = {
		frameWidth: 0,
		sprXPos: 0,
		sprYPos: 0,
		mouseX: 0,
		mouseY: 0,
		get relMouseX() {
			if (rend instanceof HTMLElement) {
				return (calc.mouseX
						- rend.getBoundingClientRect().left
						- rend.clientWidth / 2
						+ anim.cameraX/2)
					/anim.zoom;
			}
			return 0;
		},
		get relMouseY() {
			if (rend instanceof HTMLElement) {
				return (calc.mouseY
						- rend.getBoundingClientRect().top
						- rend.clientHeight / 2
						+ anim.cameraY/2)
					/anim.zoom;
			}
			return 0;
		},
		aspectRatio: 1
	}

	let updateStates = {
		length: true,
		movement: true,
		hitboxes: true,
		frames: true,
	}

	// calculation of window positions also happens here
	$: if (updateStates.length) {
		updateStates.length = false;
		let temp = anim.duration;
		anim.duration = windows.reduce((acc, win, i) => {
			// gets position of window in frames
			if (anim.windowPositions.length !== i) anim.windowPositions[i] = acc;
			else anim.windowPositions.push(acc);

			// actually calculates the duration
			return acc + (win.data.AG_WINDOW_LENGTH.value || 1)
		} , 0);
		if (temp !== anim.duration) updateStates.movement = true;
	}

	// movement calculations
	$: if (anim.movement && updateStates.movement) {
		updateStates.movement = false;
		let prevData = {xvel: 0, yvel: 0, xpos: 0, ypos: 0};
		for (const [windex, win] of windows.entries()) {
			let data = win.data;

			// gets velocities and positions of the character sprite
			let HSpeed = 0;
			if (data.AG_WINDOW_HSPEED && data.AG_WINDOW_HSPEED.value !== undefined) {
				HSpeed = data.AG_WINDOW_HSPEED.value;
			}
			let HFriction = (data.AG_WINDOW_HAS_CUSTOM_FRICTION.value === 1) ?
				data.AG_WINDOW_CUSTOM_GROUND_FRICTION.value : char.ground_friction.value;
			let HFrictionAir = (data.AG_WINDOW_HAS_CUSTOM_FRICTION.value === 1) ?
				data.AG_WINDOW_CUSTOM_AIR_FRICTION.value : char.air_friction.value;
				HFriction *= -1;
				HFrictionAir *= -1;

			let VSpeed = 0;
			if (data.AG_WINDOW_VSPEED && data.AG_WINDOW_VSPEED.value !== undefined) {
				VSpeed = data.AG_WINDOW_VSPEED.value;
			}
			let Gravity = (atkData.AG_USES_CUSTOM_GRAVITY.value === 1 && data.AG_WINDOW_CUSTOM_GRAVITY.value !== 0) ?
				data.AG_WINDOW_CUSTOM_GRAVITY.value : char.gravity_speed.value;

			let duration = data.AG_WINDOW_LENGTH.value || 1;
			let movementData = new Array(duration).fill(0).map(() => {return {xvel: 0, yvel: 0, xpos: 0, ypos: 0}});

			// calculate vertical movement
			switch(data.AG_WINDOW_VSPEED_TYPE.value) {
				case 0:
					for (let i = 0; i < duration; i++) {
						movementData[i].yvel = velocityAtFrameGrav(Gravity, VSpeed + prevData.yvel, i);
						movementData[i].ypos = (i === 0) ?
							prevData.ypos + movementData[i].yvel :
							movementData[i-1].ypos + movementData[i].yvel;
						if (movementData[i].ypos > 0) {
							movementData[i].ypos = 0;
							movementData[i].yvel = 0;
						}
					}
					break;
				case 1:
					for (let i = 0; i < duration; i++) {
						movementData[i].yvel = VSpeed;
						movementData[i].ypos = (i === 0) ?
							prevData.ypos + movementData[i].yvel :
							movementData[i-1].ypos + movementData[i].yvel;
						if (movementData[i].ypos > 0) {
							movementData[i].ypos = 0;
							movementData[i].yvel = 0;
						}
					}
					break;
				case 2:
					for (let i = 0; i < duration; i++) {
						movementData[i].yvel = velocityAtFrameGrav(Gravity, VSpeed, i);
						movementData[i].ypos = (i === 0) ?
							prevData.ypos + movementData[i].yvel :
							movementData[i-1].ypos + movementData[i].yvel;
						if (movementData[i].ypos > 0) {
							movementData[i].ypos = 0;
							movementData[i].yvel = 0;
						}
					}
					break;
			}

			// calculate horizontal movement
			switch(data.AG_WINDOW_HSPEED_TYPE.value) {
				case 0:
					for (let i = 0; i < duration; i++) {
						let ref = (i === 0) ? prevData : movementData[i-1];
						let fric = (ref.ypos === 0) ? HFriction : HFrictionAir;
						movementData[i].xvel = (ref.xvel + fric <= 0) ? 0 : ref.xvel + fric;
						if (i === 0) movementData[i].xvel += HSpeed;
						movementData[i].xpos = ref.xpos + movementData[i].xvel
					}
					break;
				case 1:
					for (let i = 0; i < duration; i++) {
						let ref = (i === 0) ? prevData : movementData[i-1];
						movementData[i].xvel = HSpeed;
						movementData[i].xpos = ref.xpos + movementData[i].xvel
					}
					break;
				case 2:
					for (let i = 0; i < duration; i++) {
						let ref = (i === 0) ? prevData : movementData[i-1];
						let fric = (ref.ypos === 0) ? HFriction : HFrictionAir;
						movementData[i].xvel = (ref.xvel + fric <= 0) ? 0 : ref.xvel + fric;
						if (i === 0) movementData[i].xvel = HSpeed;
						movementData[i].xpos = ref.xpos + movementData[i].xvel
					}
					break;
			}

			// update animation data
			if (windex === anim.charFramePositionData.length) anim.charFramePositionData.push(movementData);
			else anim.charFramePositionData[windex] = movementData;

			// set previous window
			prevData = movementData[movementData.length - 1];
		}
	}

	// hitbox calculations
	$: if (updateStates.hitboxes) {
		updateStates.hitboxes = false;
		anim.hitboxFrames = {};
		for (const [index, hb] of hitboxes.entries()) {
			const frame = anim.windowPositions[hb.data.HG_WINDOW.value] + hb.data.HG_WINDOW_CREATION_FRAME.value;
			const duration = hb.data.HG_LIFETIME.value;
			for (let i = frame; i < frame + duration; i++) {
				if (!anim.hitboxFrames[i]) anim.hitboxFrames[i] = [];
				anim.hitboxFrames[i].push(index);
			}
		}
	}

	// things that do need to be calculated each frame
	$: if (updateStates.frames) {
		updateStates.frames = false;
		if (anim.animFrame >= anim.duration) anim.animFrame = anim.windowPositions[anim.windowIndex];
		let tracker = anim.animFrame;
		for (const [i, win] of windows.entries()) {
			tracker -= win.data.AG_WINDOW_LENGTH.value;
			if (tracker <= 0) {
				if (tracker === 0 && anim.duration !== 1) {
					anim.windowIndex = i + 1;
					anim.windowFrame = 0;
					break;
				}
				anim.windowIndex = i;
				anim.windowFrame = win.data.AG_WINDOW_LENGTH.value - (tracker * -1);
				break;
			}
		}
		let win = windows[anim.windowIndex].data;
		anim.spriteFrame = (win.AG_WINDOW_ANIM_FRAME_START.value + Math.floor((anim.windowFrame / win.AG_WINDOW_LENGTH.value) * win.AG_WINDOW_ANIM_FRAMES.value)) % spritesheetSrc.framecount;

		if (anim.movement) {
			anim.xpos = Math.floor(anim.charFramePositionData[anim.windowIndex][anim.windowFrame].xpos);
			anim.ypos = Math.floor(anim.charFramePositionData[anim.windowIndex][anim.windowFrame].ypos);
		} else {
			anim.xpos = 0;
			anim.ypos = 0;
		}

		if (anim.audio) {
			const path = (win.AG_WINDOW_SFX.options.includes(win.AG_WINDOW_SFX.value)) ?
			`./sounds/${win.AG_WINDOW_SFX.value}` : '';
			if (path !== '' && win.AG_WINDOW_SFX_FRAME.value === anim.windowFrame) {
				let thing = new Audio(path);
				thing.play();
			}
		}
	}

	// common computations
	$: {
		calc.frameWidth = spritesheetSrc.dimensions.width / spritesheetSrc.framecount;
		calc.sprXPos = anim.xpos - anim.spriteFrame * calc.frameWidth + Math.floor(char.sprite_offset_x.value) - calc.frameWidth;
		calc.sprYPos = anim.ypos + Math.floor(char.sprite_offset_y.value);
		if (!anim.movement) {
			calc.sprXPos += anim.xpos;
			calc.sprYPos -= anim.ypos;
		}
	}

	const fullUpdate = () => {
		updateStates.hitboxes = true;
		updateStates.movement = true;
		updateStates.length = true;
		updateStates.frames = true;
	}

	const exportWIP = () => {
		gmlExport();
		const filename = ATK_INDEXES[+atkData.ATK_INDEX.value] || "UNKNOWN";
		const data = JSON.stringify({
			anim,
			windows: strip(windows),
			hitboxes: strip(hitboxes),
			spritesheetSrc,
			char: strip(char),
			atkData,
			gml: {
				init: initGMLCode,
				load: loadGMLCode,
				attack: attackGMLCode,
			}
		});
		const url = URL.createObjectURL(new Blob([data]))
		const link = document.createElement("a");
		link.download = `${filename}.json`;
		link.href = url;
		link.click();
	}

	const loadWIP = async (evt) => {
		const file = evt.target.files[0];
		let d;
		if (file.name.match(/\.roab$/)) {
			const data = new Uint8Array(await file.arrayBuffer());
			d = JSON.parse(LZS.decompressFromUint8Array(data));
		} else {
			const data = await file.text();
			d = JSON.parse(data);
		}

		anim = d.anim;
		windows = populate(d.windows, winProps);
		hitboxes = populate(d.hitboxes, hitboxProps);
		spritesheetSrc = d.spritesheetSrc;
		char = populate(d.char, charProps);
		atkData = d.atkData;

		if (d.gml) {
			loadGMLCode = d.gml.load;
			initGMLCode = d.gml.init;
			attackGMLCode = d.gml.attack;
		}

		fullUpdate();
	}

	let initGMLCode = 'nothing exported yet';
	let loadGMLCode = 'nothing exported yet';
	let attackGMLCode = 'nothing exported yet';

	const gmlExport = () => {
		const strings = exporter(char, atkData, windows, JSON.parse(JSON.stringify(hitboxes)));
		initGMLCode = strings.out_INIT;
		loadGMLCode = strings.out_LOAD;
		attackGMLCode = strings.out_ATK;
	};

	const showGml = () => {
		gmlExport();
		editingMode = "gml";
	}

	const skipBack = () => {
		if (anim.windowIndex !== 0) anim.animFrame = anim.windowPositions[anim.windowIndex - 1];
		else anim.animFrame = 0;
	}

	const skipAhead = () => {
		if (anim.windowIndex !== windows.length - 1) anim.animFrame = anim.windowPositions[anim.windowIndex + 1];
		else anim.animFrame = anim.windowPositions[anim.windowIndex] + windows[anim.windowIndex].data.AG_WINDOW_LENGTH.value - 1;
	}

	const processImage = async (file) => {
		spritesheetSrc.file = file;
		spritesheetSrc.buffer = await file.arrayBuffer();

		const fname = file.name;
		const match = fname.match(/(.+?)_strip(\d+)\./);

		if (match) {
			const sprite = match[1];
			const nframes = +(match[2]);
			atkData.AG_SPRITE.value = sprite;
			atkData.AG_HURTBOX_SPRITE.value = `${sprite}_hurt`;
			if (!isNaN(nframes)) {
				spritesheetSrc.framecount = nframes;
			}
		}

		let fileReader = new FileReader();
		fileReader.onloadend = () => {
			spritesheetSrc.dataUrl = fileReader.result;
			let img = new Image();
			img.onload = function() {
				spritesheetSrc.dimensions = {width: this.width, height: this.height}

			}
			img.src = fileReader.result;
		};
		fileReader.readAsDataURL(file);
	}

	const clearHitboxesPendingDelete = () => {
		let wasPending = false;
		for (const hb of hitboxes) {
			wasPending = wasPending || hb.meta.confirmDelete;
			hb.meta.confirmDelete = false;
		}
		return wasPending;
	}

	const onHitboxSummarySelected = (hitbox) => {
		const hbIndex = hitboxes.findIndex((h) => h === hitbox);
		if (hbIndex === -1) {
			throw new Error("Couldn't find hitbox");
		}
		hitboxes.selected = hbIndex;
		const windex = hitbox.data.HG_WINDOW.value
		const hbFrame = hitbox.data.HG_WINDOW_CREATION_FRAME.value;
		const window = windows[windex];
		if (window == null || hbFrame == null) {
			throw new Error("Couldn't find window / frame for hitbox");
		}
		anim.animFrame = anim.windowPositions[windex] + hbFrame;
		updateStates.frames = true;
	}
</script>

<style>
	#app {
		height: 100vh;
		width: 100vw;
		display: grid;

		grid-template-columns: auto 300px;
		grid-template-rows: 120px 100px 30px 100px 30px auto;
	}

	@media screen and (min-width: 1250px) {
		#app {
			grid-template-rows: 80px 100px 30px 100px 30px auto;
		}
	}

	#file,
	#settings {
		padding: 5px;
		text-align: right;
	}

	#file {
		background-color: #555;
		border: 5px double #222;
		color: white;
		grid-row: 1 / 2;
		grid-column: 1 / 2;
		border-right: 1px solid #333;
		overflow: auto;
		display: flex;
	}

	#frames {
		background-color: #000;
		grid-row: 2 / 3;
		grid-column: 1 / 2;
		overflow-x: auto;
	}

	#main {
		background-color: #888;
		grid-row: 6 / 7;
		grid-column: 1 / 2;
		position: relative;
		border-top: 1px solid #555;

		display: grid;
		overflow: hidden;
	}

	#settings {
		background-color: #555;
		border: 5px double #222;
		color: white;
		grid-row: 1 / 7;
		grid-column: 2 / 3;
		border-left: 1px solid #333;
		user-select: none;
		display: flex;
		overflow: hidden;
		flex-direction: column;
	}

	#settings hr {
		margin-left: 0;
		margin-right: 0;
	}

	#settings>.inputGroup {
		flex: 0 0 auto;
	}

	#settings>.controls {
		overflow-y: auto;
		padding: 0 1em;
	}

	.inputGroup {
		width: 100%;
		height: auto;
		padding: 0.5em;
		text-align: left;
	}

	input[type="file"] {
		display: none;
	}

	.option-container {
		position: absolute;
		background-color: #FFF8;
		border-bottom-right-radius: 2px;
		user-select: none;
		display: grid;
		grid-template-rows: 25px auto;
		grid-template-columns: auto auto;
		width: 155px;
	}
	.tab { pointer-events: auto; border: none; border-radius: 0; }
	.tab[active="true"] { background-color: transparent; }
	.tab[active="false"] { background-color: #0004; }
	.tool-container {grid-column: 1 / 3; padding: 10px;}
	.option-param { pointer-events: auto; width: auto;}

	button.tool {
		height: 30px;
		width: 100%;
		pointer-events: auto;
	}
	button.tool[active="true"] {
		background-color: transparent;
		border: none;
	}
	button.tool span {
		float: left;
		padding-left: 10px;
		vertical-align: middle;
		text-align: center;
	}
	button.tool i {
		font-size: 20px;
		float: left;
		vertical-align: middle;
	}

	.inputGroup button {
		height: 30px;
	}
	.inputGroup button i {
		vertical-align: middle;
	}
	.inputGroup button span {
		vertical-align: middle;
	}

	input[type="checkbox"] {
		width: 0;
		height: 0;
		opacity: 0;
		position: absolute;
	}
	input[type="checkbox"] ~ .checkmark {
		display: inline-block;
		margin-bottom: -5px;
		width: 20px;
		height: 20px;
		border: 2px solid var(--accent);
		border-radius: 2px;
	}

	input[type="checkbox"]:checked ~ .checkmark {
		display: inline-block;
		margin-bottom: -5px;
		width: 20px;
		height: 20px;
		border: 2px solid var(--accent);
		background-color: var(--accent);
		border-radius: 2px;
	}

	input[type="checkbox"] ~ .checkmark::after {
		display: block;
		opacity: 0;
		margin-left: 4px;
		width: 5px;
		height: 10px;
		border-bottom: 3px solid white;
		border-right: 3px solid white;
		border-radius: 2px;
		transform: rotate(45deg);
		content: "";
	}
	input[type="checkbox"]:checked ~ .checkmark::after {
		opacity: 1;
	}

	.gmlPreview {
		height: 300px;
		width: 100%;
		color: #DDD;
		font-size: 10px;
		font-family: monospace;
		background-color: black;
	}

	.gmlPreview.small {
		height: 60px;
	}

	h3 {
		margin: 0.5em 0;
		text-align: left;
	}

</style>

<svelte:window
	on:keydown={(evt) => {
		switch(evt.key) {
			case '[':
				skipBack();
				updateStates.frames = true;
				break;
			case '<':
				if (anim.animFrame > 0) anim.animFrame --;
				updateStates.frames = true;
				break;
			case ']':
				skipAhead();
				updateStates.frames = true;
				break;
			case '>':
				if (anim.animFrame < anim.duration - 1) anim.animFrame ++;
				updateStates.frames = true;
				break;
			default:
				for (const t of tools) {
					if (t[1] === tools.selected) continue;
					else if (t[2] === evt.key) {
						tools.selected = t[1];
						break;
					}
				}
		}

	}}
/>

<Modal on:close={() => modalVisible = false} bind:visible={modalVisible}/>

<LocalStorageFS saveMode={false} active={false}/>
<div id="app">
	<div id="file">
		<div class="inputGroup">
			<button on:click={exportWIP}>
				<i class="material-icons">attachment</i><span>export JSON</span>
			</button>
			<label for="import-wip" style="display: inline-block">
				<button style="pointer-events: none">
					<i class="material-icons">attachment</i><span>import JSON</span>
				</button>
			</label>
			<input id="import-wip" type="file" accept=".roab,.json" on:change={loadWIP} />
			<button on:click={() => modalVisible = true}>Help / Credits</button>
		</div>
		<div class="inputGroup">
			<label for="spritesheet-upload" style="display: inline-block">
				<button style="pointer-events: none">upload spritesheet</button>
			</label>
			<input id="spritesheet-upload" type="file" on:change={async (evt) => {spritesheetSrc.file = evt.target.files[0]; processImage(evt.target.files[0])}}>
			<div style="display: inline-block">
				<label for="framecount">number of frames in spritesheet:</label>
				<input id="framecount" type="number" min="1" max="99" bind:value={spritesheetSrc.framecount}>
			</div>
		</div>
	</div>
	<div id="frames">
		<div class="frameContainer"
			style="
				width: {spritesheetSrc.dimensions.width}px;
				height: 100%;
				background-color: black;
			">
			{#each new Array(spritesheetSrc.framecount).fill(0) as _, i}
				<div class="frame"
					style="
						height: {spritesheetSrc.dimensions.height}px;
						width: {calc.frameWidth}px;
						background-color: white;
						background-image: url('{spritesheetSrc.dataUrl}');
						background-position: -{(calc.frameWidth) * i}px 0;
						box-shadow: {(anim.spriteFrame % spritesheetSrc.framecount == i) ? 'inset 0 0 5px black' : 'none'};
						border-right: 2px solid black;
						display: inline-block;
					"
					on:click={() => {windows[anim.windowIndex].data.AG_WINDOW_ANIM_FRAME_START.value = i}}
				></div>
			{/each}
		</div>
	</div>
	<Timeline
		bind:anim={anim}
		bind:windows={windows}
		bind:hitboxes={hitboxes}
		bind:editingMode={editingMode}
		bind:updateStates={updateStates}
		skipAhead={skipAhead}
		skipBack={skipBack}
		winProps={winProps}
		/>
	<div id="main"
		bind:this={renderer}
		on:mousemove={(evt) => {
			if (renderer.dragging) {
				switch(tools.selected) {
					case "pan":
						switch(renderer.target) {
							case 'hitbox':
								hitboxes[hitboxes.selected].data.HG_HITBOX_X.value += evt.movementX/anim.zoom;
								hitboxes[hitboxes.selected].data.HG_HITBOX_Y.value += evt.movementY/anim.zoom;
								updateStates.hitboxes = true;
								break;
							case 'angle-indicator':
								hitboxes[hitboxes.selected].data.HG_ANGLE.value = 180 - Math.atan2(renderer.mouseOrigin[1] - evt.pageY, renderer.mouseOrigin[0] - evt.pageX) * 180/Math.PI;
								updateStates.hitboxes = true;
								break;
							case 'resizer':
								hitboxes[hitboxes.selected].data.HG_WIDTH.value = Math.ceil(Math.abs((renderer.mouseOrigin[0] - evt.pageX)/anim.zoom));
								hitboxes[hitboxes.selected].data.HG_HEIGHT.value = Math.ceil(Math.abs((renderer.mouseOrigin[1] - evt.pageY)/anim.zoom));
								updateStates.hitboxes = true;
								break;
							default:
								anim.cameraX -= evt.movementX;
								anim.cameraY -= evt.movementY;
						}
						break;
					case "circle":
						activeEl.setAttributeNS(null, 'rx', Math.ceil(Math.abs((renderer.mouseOrigin[0] - evt.pageX)/anim.zoom)));
						activeEl.setAttributeNS(null, 'ry', Math.ceil(Math.abs((renderer.mouseOrigin[1] - evt.pageY)/anim.zoom)));
						break;
					case "rectangle":
					case "round":
						activeEl.setAttributeNS(null, 'x', renderer.svgPosition[0] - Math.ceil(Math.abs((renderer.mouseOrigin[0] - evt.pageX)/anim.zoom)) );
						activeEl.setAttributeNS(null, 'y', renderer.svgPosition[1] - Math.ceil(Math.abs((renderer.mouseOrigin[1] - evt.pageY)/anim.zoom)) );
						activeEl.setAttributeNS(null, 'width', Math.ceil(Math.abs((renderer.mouseOrigin[0] - evt.pageX)/anim.zoom))*2);
						activeEl.setAttributeNS(null, 'height', Math.ceil(Math.abs((renderer.mouseOrigin[1] - evt.pageY)/anim.zoom))*2);
						if (tools.selected === "round") {
							activeEl.setAttributeNS(null, 'rx', parseInt(activeEl.getAttribute('width')) * 0.25);
							activeEl.setAttributeNS(null, 'ry', parseInt(activeEl.getAttribute('height')) * 0.25);

						}
						break;
				}
			}
		}}
		on:mousedown={(evt) => {
			calc.mouseX = evt.clientX;
			calc.mouseY = evt.clientY;
			tools.active = true;
			renderer.dragging = true;
			renderer.target = evt.target.getAttributeNS(null, 'class');
			if (renderer.target === 'hitbox' || renderer.target === 'angle-indicator') {
				if (tools.selected === 'eraser') {
					editingMode = 'window';
					const index = evt.target.getAttributeNS(null, 'data-index');
					if (hitboxes[index]) {
						if (hitboxes[index].meta.confirmDelete) {
							hitboxes.splice(evt.target.getAttributeNS(null, 'data-index'), 1);
						} else {
							clearHitboxesPendingDelete();
							hitboxes[index].meta.confirmDelete = true;
						}
					}
					updateStates.hitboxes = true;
				} else {
					editingMode = 'hitbox';
					hitboxes.selected = parseInt(evt.target.getAttributeNS(null, 'data-index'));
					const hb = hitboxes[hitboxes.selected];
					const br = hb.meta.el.getBoundingClientRect();
					renderer.mouseOrigin = [br.left + (br.right - br.left)/2, br.top + (br.bottom - br.top)/2];
					updateStates.hitboxes = true;
				}

			} else {
				if (renderer.target === "resizer") {
					hitboxes.selected = parseInt(evt.target.getAttributeNS(null, 'data-index'));
					updateStates.hitboxes = true;
				}
				if (tools.selected === "eraser") {
						updateStates.hitboxes = clearHitboxesPendingDelete();
				}
				renderer.mouseOrigin = [evt.pageX, evt.pageY];
			}
			renderer.svgPosition = [calc.relMouseX, calc.relMouseY];
		}}
		on:mouseup={(evt) => {
			tools.active = false;
			renderer.dragging = false
			switch(tools.selected) {
				case "pan":
					let hb = hitboxes[hitboxes.selected]
					switch(renderer.target) {
						case 'hitbox':
							hb.data.HG_HITBOX_X.value = Math.round(hb.data.HG_HITBOX_X.value);
							hb.data.HG_HITBOX_Y.value = Math.round(hb.data.HG_HITBOX_Y.value);
							updateStates.hitboxes = true;
							break;
						case 'angle-indicator':
							hb.data.HG_ANGLE.value = Math.round(hb.data.HG_ANGLE.value);
							updateStates.hitboxes = true;
							break;
						case 'resizer':
							if (hb.data.HG_WIDTH.value === 0 || hb.data.HG_HEIGHT.value === 0) {
								editingMode = 'window';
								hitboxes.splice(hitboxes.selected, 1);
								updateStates.hitboxes = true;
							}
						default:
							break;
					}
					break;
				case "circle":
				case "rectangle":
				case "round":
					let attributes = JSON.parse(JSON.stringify(hitboxProps));
					attributes.HG_WIDTH.value = 2 * Math.ceil(Math.abs((renderer.mouseOrigin[0] - evt.pageX)/anim.zoom));
					attributes.HG_HEIGHT.value = 2 * Math.ceil(Math.abs((renderer.mouseOrigin[1] - evt.pageY)/anim.zoom));
					if (attributes.HG_WIDTH.value === 0 || attributes.HG_HEIGHT.value === 0) break;

					attributes.HG_HITBOX_X.value = Math.floor(renderer.svgPosition[0]);
					attributes.HG_HITBOX_Y.value = Math.floor(renderer.svgPosition[1]);
					attributes.HG_SHAPE.value = ["circle", "rectangle", "round"].indexOf(tools.selected);
					attributes.HG_WINDOW.value = anim.windowIndex;
					attributes.HG_WINDOW_CREATION_FRAME.value = anim.windowFrame;
					hitboxes.push({meta: {color: '#f008', stroke: '#fFF8', strokeWidth: 0.5, el: null}, data: attributes});
					hitboxes.selected = hitboxes.length - 1;
					updateStates.hitboxes = true;
					editingMode = 'hitbox';
					break;
			}
		}}
	>
		<div class="option-container" style="z-index: 500; height: auto; pointer-events: none;">
			<button class="tab" on:click={() => mainViewInfo = true} active={mainViewInfo}>info</button>
			<button class="tab" on:click={() => mainViewInfo = false} active={!mainViewInfo}>tools</button>
			<div class="tool-container">
				{#if mainViewInfo}
					<div class="option-param" style="justify-self: right; display: block;">
						zoom:
						<select bind:value={anim.zoom}>
							<option value="0.25">1/4x</option>
							<option value="0.5">1/2x</option>
							<option value="1" >1x</option>
							<option value="2" selected>2x</option>
							<option value="4" >4x</option>
							<option value="8" >8x</option>
						</select>
					</div>
					<div class="option-param" style="justify-self: right; display: block;">
						<label>
							lock offset:
							<input type="checkbox" bind:checked={char.position_locked.value} />
							<span class="checkmark"></span>
						</label>
						<label>
							show motion:
							<input type="checkbox" bind:checked={anim.movement} />
							<span class="checkmark"></span>
						</label>
						<label>
							play sounds:
							<input type="checkbox" bind:checked={anim.audio} />
							<span class="checkmark"></span>
						</label>
					</div>
				{:else}
					{#each tools as tool}
						<button
							class="tool"
							on:click={() => tools.selected = tool[1]}
							active={tools.selected === tool[1]}>
							<i class="material-icons">{tool[0]}</i><span>{tool[1]}</span>
						</button>

					{/each}
				{/if}
			</div>

		</div>
		<div class="grid" style="width: 100%; height: 100%; position: absolute; top:0; left: 0; display: grid; image-rendering: pixelated;">
			<svg
				version="2.0"
				style="width: 100%; height: 100%;"
				viewBox="{(anim.cameraX - rend.clientWidth) / 2 / anim.zoom}
{(anim.cameraY - rend.clientHeight) / 2 / anim.zoom}
{rend.clientWidth / anim.zoom}
{rend.clientHeight / anim.zoom}"
			>
				<defs>
					<clipPath id="spriteClip" clipPathUnits="objectBoundingBox">
						<rect x="{(anim.spriteFrame % spritesheetSrc.framecount) / spritesheetSrc.framecount}" y="0" width="{1 / spritesheetSrc.framecount}" height="1" />
					</clipPath>
				</defs>
				<path d="
					M {-4 * rend.clientWidth / 2} 0
					h {rend.clientWidth * 4}
				"
					stroke-width="{2 / anim.zoom}"
					stroke="#000F"
					shape-rendering="crispEdges"
				/>
				<path d="
					M 0 {-4 * rend.clientHeight / 2}
					v {rend.clientHeight * 4}
				"
					stroke-width="{2 / anim.zoom}"
					stroke="#000F"
					shape-rendering="crispEdges"
				/>
				<rect
					x="{calc.sprXPos + calc.frameWidth * (anim.spriteFrame)}"
					y="{calc.sprYPos}"
					width="{calc.frameWidth}"
					height="{spritesheetSrc.dimensions.height}"
					stroke="black"
					stroke-width="2"
					fill="none"
				/>
				{#if char.position_locked.value || tools.selected !== "pan"}
					<image
						on:dragstart={(e) => e.preventDefault()}
						draggable="false"
						x="{calc.sprXPos}"
						y="{calc.sprYPos}"
						width="{spritesheetSrc.dimensions.width}"
						height="{spritesheetSrc.dimensions.height}"
						xlink:href="{spritesheetSrc.dataUrl}"
						clip-path="url(#spriteClip)"
					/>
				{:else}
					<image
						draggable="false"
						on:dragstart={(e) => e.preventDefault()}
						on:mousedown|stopPropagation={(evt) => evt.target.dragging = true}
						on:mouseout|stopPropagation={(evt) => evt.target.dragging = false}
						on:mouseup|stopPropagation={(evt) => evt.target.dragging = false}
						on:mousemove|stopPropagation={(evt) => {
							if (evt.target.dragging && !char.position_locked.value && tools.selected === "pan") {
								char.sprite_offset_x.value += evt.movementX / anim.zoom;
								char.sprite_offset_y.value += evt.movementY / anim.zoom;
							}
						}}
						x="{calc.sprXPos}"
						y="{calc.sprYPos}"
						width="{spritesheetSrc.dimensions.width}"
						height="{spritesheetSrc.dimensions.height}"
						xlink:href="{spritesheetSrc.dataUrl}"
						clip-path="url(#spriteClip)"
					/>
				{/if}
				{#each hitboxes as hitbox, i}
					{#if anim.hitboxFrames[anim.animFrame] && anim.hitboxFrames[anim.animFrame].includes(i)}
						{#if hitbox.data.HG_SHAPE.value === 0}
							<ellipse
								class="hitbox"
								data-index={i}
								bind:this={hitbox.meta.el}
								cx="{calc.sprXPos + hitbox.data.HG_HITBOX_X.value - char.sprite_offset_x.value + calc.frameWidth * (anim.spriteFrame + 1)}"
								cy="{calc.sprYPos + hitbox.data.HG_HITBOX_Y.value - char.sprite_offset_y.value}"
								rx="{hitbox.data.HG_WIDTH.value / 2}"
								ry="{hitbox.data.HG_HEIGHT.value / 2}"
								fill="{hitbox.meta.confirmDelete ? "black" : hitbox.meta.color}"
								stroke="{(hitboxes.selected === i) ? 'black' : hitbox.meta.stroke || 'black'}"
								stroke-width="{(hitboxes.selected === i) ? 4/anim.zoom : hitbox.meta.strokeWidth || 0}"
							/>
						{:else if hitbox.data.HG_SHAPE.value === 1}
							<rect
								class="hitbox"
								data-index={i}
								bind:this={hitbox.meta.el}
								x="{calc.sprXPos + hitbox.data.HG_HITBOX_X.value - char.sprite_offset_x.value  - hitbox.data.HG_WIDTH.value / 2 + calc.frameWidth * (anim.spriteFrame+1)}"
								y="{calc.sprYPos + hitbox.data.HG_HITBOX_Y.value - char.sprite_offset_y.value - hitbox.data.HG_HEIGHT.value / 2}"
								width="{hitbox.data.HG_WIDTH.value}"
								height="{hitbox.data.HG_HEIGHT.value}"
								fill="{hitbox.meta.color}"
								stroke="{(hitboxes.selected === i) ? 'black' : hitbox.meta.stroke || 'black'}"
								stroke-width="{(hitboxes.selected === i) ? 4/anim.zoom : hitbox.meta.strokeWidth || 0}"
							/>
						{:else}
							<rect
								class="hitbox"
								data-index={i}
								bind:this={hitbox.meta.el}
								x="{calc.sprXPos + hitbox.data.HG_HITBOX_X.value - char.sprite_offset_x.value  - hitbox.data.HG_WIDTH.value / 2 + calc.frameWidth * (anim.spriteFrame+1)}"
								y="{calc.sprYPos + hitbox.data.HG_HITBOX_Y.value - char.sprite_offset_y.value - hitbox.data.HG_HEIGHT.value / 2}"
								rx="{hitbox.data.HG_WIDTH.value * 0.25}"
								ry="{hitbox.data.HG_HEIGHT.value * 0.25}"
								width="{hitbox.data.HG_WIDTH.value}"
								height="{hitbox.data.HG_HEIGHT.value}"
								fill="{hitbox.meta.color}"
								stroke="{(hitboxes.selected === i) ? 'black' : hitbox.meta.stroke || 'black'}"
								stroke-width="{(hitboxes.selected === i) ? 4/anim.zoom : hitbox.meta.strokeWidth || 0}"
							/>
						{/if}
						<line
							class="angle-indicator"
							data-index={i}
							x1="{calc.sprXPos + hitbox.data.HG_HITBOX_X.value - char.sprite_offset_x.value + calc.frameWidth * (anim.spriteFrame+1)}"
							x2="{
								calc.sprXPos
								+ hitbox.data.HG_HITBOX_X.value
								- char.sprite_offset_x.value
								+ Math.cos(hitbox.data.HG_ANGLE.value * -Math.PI/180)
								* hitbox.data.HG_WIDTH.value / 2
								+ calc.frameWidth * (anim.spriteFrame+1)}"
							y1="{calc.sprYPos - char.sprite_offset_y.value + hitbox.data.HG_HITBOX_Y.value}"
							y2="{
								calc.sprYPos
								+ hitbox.data.HG_HITBOX_Y.value
								- char.sprite_offset_y.value
								+ Math.sin(hitbox.data.HG_ANGLE.value * -Math.PI/180)
								* hitbox.data.HG_HEIGHT.value / 2}"
							stroke="#0008" stroke-width="{4/anim.zoom}" stroke-dasharray="{(hitbox.data.HG_ANGLE.value === 361) ? 4/anim.zoom : 0}"
						/>
						{#if tools.selected === 'pan'}
							<circle
								class="resizer"
								data-index={i}
								cx="{calc.sprXPos + hitbox.data.HG_HITBOX_X.value - char.sprite_offset_x.value + calc.frameWidth * (anim.spriteFrame+1)}"
								cy="{calc.sprYPos + hitbox.data.HG_HITBOX_Y.value - char.sprite_offset_y.value}"
								r="{4/anim.zoom}"
							/>
						{/if}
					{/if}
				{/each}
				{#if tools.active}
					{#if tools.selected === 'circle'}
						<ellipse
							cx="{Math.floor(calc.relMouseX)}"
							cy="{Math.floor(calc.relMouseY)}"
							bind:this={activeEl}
							fill="white"
							stroke="black"
							stroke-width="{4 / anim.zoom}"
						/>
					{:else if tools.selected === 'rectangle' || tools.selected === 'round'}
						<rect
							x="{Math.floor(calc.relMouseX)}"
							y="{Math.floor(calc.relMouseY)}"
							bind:this={activeEl}
							fill="white"
							stroke="black"
							stroke-width="{4 / anim.zoom}"
						/>
					{/if}
				{:else if ['circle', 'rectangle', 'round'].includes(tools.selected)}
					<ellipse
						style="pointer-events: none"
						cx="{Math.floor(calc.relMouseX)}"
						cy="{Math.floor(calc.relMouseY)}"
						rx="1"
						ry="1"
						fill="#F008"
						stroke="black"
						stroke-width="0"
					/>

				{/if}
			</svg>
		</div>
	</div>
	<div id="settings">
		<div class="inputGroup">
			<button on:click={() => editingMode = 'atkData'}><i class="material-icons">edit</i><span>edit attack data</span></button>
			<button on:click={() => editingMode = 'chrData'}><i class="material-icons">person</i><span>edit character data</span></button>
			<button on:click={() => editingMode = "hitbox_summary"}><i class="material-icons">radio_button_unchecked</i><span>View Hitboxes</span></button>
			<button on:click={showGml}><i class="material-icons">import_export</i><span>View GML</span></button>
		</div>
		<hr>
		<div class="controls">
			{#if editingMode === 'window'}
				<ParamsBuilder
					isDisabled={isDisabled}
					bind:props={windows[anim.windowIndex].data}
					on:dataChanged={() => {updateStates.length = true; updateStates.movement = true; updateStates.frames = true;}}
				/>
			{:else if editingMode === 'hitbox'}
				<ParamsBuilder
					isDisabled={isDisabled}
					bind:props={hitboxes[hitboxes.selected].data}
					on:dataChanged={() => updateStates.hitboxes = true}
				/>
			{:else if editingMode === 'atkData'}
				<ParamsBuilder
					isDisabled={isDisabled}
					bind:props={atkData}
					on:dataChanged={() => updateStates.movement = true}
				/>
			{:else if editingMode === 'chrData'}
				<ParamsBuilder
					isDisabled={isDisabled}
					bind:props={char}
					on:dataChanged={() => updateStates.movement = true}
				/>
			{:else if editingMode === 'gml'}
				<h3>init.gml</h3>
				<textarea
				class="gmlPreview small"
				autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
				bind:value={initGMLCode}
				/>
				<h3>load.gml</h3>
				<textarea
				class="gmlPreview small"
				autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
				bind:value={loadGMLCode}
				/>
				<h3>[attackname].gml</h3>
				<textarea
				class="gmlPreview"
				autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
				bind:value={attackGMLCode}
				/>
			{:else if editingMode === 'hitbox_summary'}
				<HitboxSummary
					bind:hitboxes={hitboxes}
					on:selected={(e) => {
						if (e.detail.hitbox) {
							onHitboxSummarySelected(e.detail.hitbox);
						}
					}}>
				</HitboxSummary>
			{/if}
		</div>
	</div>
</div>