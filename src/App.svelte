<script>
	// I hope y'all like spaghetti
	import store from 'store2';
	import {stripIndent} from 'common-tags';
	
	import ParamsBuilder from './components/paramsBuilder.svelte';

	import NDReverse from './util/nonDestructiveReverse.js';
	import {
		default as winProps, 
		isDisabled
	} from './util/windowProperties.js';
	import hitboxProps from './util/hitboxProperties.js';
	import { velocityAtFrame, velocityAtFrameGrav } from './util/XAtFrames.js'


	let spritesheetSrc = {
		file: '...',
		dataUrl: '',
		dimensions: {
			width: 0,
			height: 0
		},
		framecount: 1
	};
	let hurtboxSrc = {
		file: '...',
		buffer: null
	};
	let codeFile;


	let char = {
		ground_friction: 1.00,
		air_friction: 0.07,
		gravity_speed: 0.50,
		sprite_offset: [0, 0],
		position_locked: false
	}
	let windows = [
		{
			meta: {
				name: 'derp',
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

	let editingMode = 'window';
	let mainViewInfo = true;
	let activeEl;
	let tools = [
		["pan_tool", "pan", "v"], 
		["add_box", "rectangle", "r"], 
		["rounded_corner", "round", "r"], 
		["add_circle", "circle", "o"],
		["clear", "eraser", "Backspace"]

	];
	tools.selected = "pan";

	let currentFrameLabel;
	let isCurrentFrameFocused = false;
	let renderer;
	let rend;
	$: rend = (renderer) ? renderer : {};

	let anim = {
		// controlled
		animFrame: 0,
		playSpeed: 1, 
		playing: false,
		loop: true,
		zoom: 1,
		cameraX: 0,
		cameraY: 0,
		movement: true,

		grid: -1,
		gridViewerRadius: 45,
		zoomGrids: {
			0.25: [50, 50],
			0.50: [25, 25],
			1.00: [20, 20],
			2.00: [10, 10],
			4.00: [5, 5],
			8.00: [1, 1],
		},

		// calculated
		duration: 0,
		spriteFrame: 0,
		windowIndex: 0, // also known as "windex" :^)
		windowFrame: 0,
		windowPositions: [],

		hitboxFrames: {},
		
		xpos: 0,
		ypos: 0,
		charFramePositionData: []
	}

	let calc = {
		frameWidth: 0,
		sprXPos: 0,
		sprYPos: 0,
		mouseX: 0,
		mouseY: 0,
		relMouseX: 0,
		relMouseY: 0,
		aspectRatio: 1
	}

	// calculation of window positions also happens here
	$: anim.duration = windows.reduce((acc, win, i) => {
		// gets position of window in frames
		if (anim.windowPositions.length !== i) anim.windowPositions[i] = acc;
		else anim.windowPositions.push(acc);

		// actually calculates the duration		
		return acc + (win.data.AG_WINDOW_LENGTH.value || 1)
	} , 0);
	$: if (anim.movement) {
		let prevData = {xvel: 0, yvel: 0, xpos: 0, ypos: 0};
		for (const [windex, win] of windows.entries()) {
			let data = win.data;

			// gets velocities and positions of the character sprite		
			let HSpeed = data.AG_WINDOW_HSPEED.value || 0;
			let HFriction = (data.AG_WINDOW_HAS_CUSTOM_FRICTION.value === 1) ?
				data.AG_WINDOW_CUSTOM_GROUND_FRICTION.value : char.ground_friction;
			let HFrictionAir = (data.AG_WINDOW_HAS_CUSTOM_FRICTION.value === 1) ?
				data.AG_WINDOW_CUSTOM_AIR_FRICTION.value : char.air_friction;
				HFriction *= -1;
				HFrictionAir *= -1;

			let VSpeed = data.AG_WINDOW_VSPEED.value || 0;
			let Gravity = (data.AG_WINDOW_HAS_CUSTOM_GRAVITY.value === 1) ?
				data.AG_WINDOW_CUSTOM_GRAVITY.value : char.gravity_speed;

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

	$: {
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

	$: {
		if (anim.animFrame >= anim.duration) anim.animFrame = anim.windowPositions[anim.windowIndex];
		let tracker = anim.animFrame;
		for (const [i, win] of windows.entries()) {
			tracker -= win.data.AG_WINDOW_LENGTH.value;
			if (tracker <= 0) {
				if (tracker === 0) {
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
	}

	// calculation of common computations
	$: {
		calc.frameWidth = spritesheetSrc.dimensions.width / spritesheetSrc.framecount;
		calc.sprXPos = anim.xpos - anim.spriteFrame * calc.frameWidth + Math.floor(char.sprite_offset[0]) - calc.frameWidth / 2;
		calc.sprYPos = anim.ypos + Math.floor(char.sprite_offset[1]);
		if (!anim.movement) {
			calc.sprXPos += anim.xpos;
			calc.sprYPos -= anim.ypos;
		}
		if (rend instanceof HTMLElement) {
			calc.relMouseX = (calc.mouseX - rend.getBoundingClientRect().left - rend.clientWidth / 2 + anim.cameraX/2)/anim.zoom;
			calc.relMouseY = (calc.mouseY - rend.getBoundingClientRect().top - rend.clientHeight / 2 + anim.cameraY/2)/anim.zoom;
		}
	}

	const save = () => {
		store({
			anim,
			windows,
			hitboxes,
			spritesheetSrc,
			char
		});
	}
	const load = () => {
		let data = store();
		
		anim = data.anim;
		windows = data.windows;
		spritesheetSrc = data.spritesheetSrc;
		char = data.char;
		hitboxes = data.hitboxes;
	}

	const startPlaying = () => {
		anim.playing = !anim.playing;
		if (anim.playing) play();
	}
	const play = () => {
		if (anim.playing) {
			setTimeout(() => { 
				if (anim.animFrame + 1 === anim.duration) { 
					anim.animFrame = 0;
					if (!anim.loop) { anim.playing = false; }
				}
				else { anim.animFrame += 1 }
				requestAnimationFrame(play)
			}, 1000 / 60 * (1 / anim.playSpeed))
		}
	} 
	const skipBack = () => {
		if (anim.windowIndex !== 0) anim.animFrame = anim.windowPositions[anim.windowIndex - 1];
		else anim.animFrame = 0;
	}
	const skipAhead = () => {
		if (anim.windowIndex !== windows.length - 1) anim.animFrame = anim.windowPositions[anim.windowIndex + 1];
		else anim.animFrame = anim.windowPositions[anim.windowIndex] + windows[anim.windowIndex].data.AG_WINDOW_LENGTH.value - 1;
	}

	const handleWindowAddition = () => {
		windows.splice(anim.windowIndex, 0, {meta: {}, data: JSON.parse(JSON.stringify({...winProps}))} );
		anim.animFrame = anim.animFrame;
	}
	const handleWindowDeletion = () => {
		windows.splice(anim.windowIndex, 1);
		anim.animFrame = anim.windowPositions[anim.windowIndex - 1] || 0;
	}

	const processImage = async (file) => {
		spritesheetSrc.file = file;
		spritesheetSrc.buffer = await file.arrayBuffer();

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

	const drawGridOverlay = (pixelsX, pixelsY, radius, xpos, ypos) => {
		const yOffset = ypos - radius * 1.5;
		const xOffset = xpos - radius * 1.5;
		let out = "";
		for (let y = yOffset - (yOffset) % pixelsY; y < ypos + radius; y += pixelsY) {
			out += `
				M ${xpos - radius} ${y}
				h ${radius * 2}
			`;
		}
		for (let x = (xOffset - (xOffset) % pixelsX); x < xpos + radius; x += pixelsX) {
			out += `
				M ${x} ${ypos - radius}
				v ${radius * 2}
			`;
		}
		return out;
	}
</script>

<style>
	#app {
		height: 100vh;
		width: 100vw;
		display: grid;

		grid-template-columns: 300px auto 300px;
		grid-template-rows: 100px 30px 100px 30px auto;
	}

	#file,
	#settings {
		padding: 5px;
	}

	#frames {
		background-color: #000;
		grid-row: 1 / 2;
		grid-column: 2 / 3;
		overflow-x: scroll;
	}

	#timeline-controls {
		grid-row: 2 / 3;
		grid-column: 2 / 3;
		position: relative;
		padding: 3px;
		display: grid;
	}

	#current-frame-label {
		display: inline-block; 
		text-align: right;
		border-radius: 2px;
		border: 1px solid #DDD;
	}
	#current-frame-label:hover { background-color: #0004; }
	#current-frame-label.active {
		background-color: #0004;
		color: white;
		border: 1px solid black;
	}

	#timeline {
		background-color: #FFF;
		grid-row: 3 / 4;
		grid-column: 2 / 3;
		border-top: 1px solid black;
		position: relative;
		display: flex;
		flex-direction: row;
	}

	#window-metadata {
		background-color: #555;
		border-top: 1px solid #333;
		grid-row: 4 / 5;
		grid-column: 2 / 3;
		position: relative;
		padding: 3px;
		display: grid;
		color: white;
	}

	#file {
		background-color: #555;
		border: 5px double #222;
		color: white;
		grid-row: 1 / 6;
		grid-column: 1 / 2;
		border-right: 1px solid #333;
	}

	#main {
		background-color: #888;
		grid-row: 5 / 6;
		grid-column: 2 / 3;
		position: relative;
		border-top: 1px solid #555;

		display: grid;
		overflow: hidden;
	}

	#settings {
		background-color: #555;
		border: 5px double #222;
		color: white;
		grid-row: 1 / 6;
		grid-column: 3 / 4;
		border-left: 1px solid #333;
		overflow-y: scroll;
		user-select: none;
	}

	.inputGroup { 
		width: 100%;
		height: auto;
		padding: 10px;
	}

	input[type="file"] {
		display: none;
	}
	#current-frame {
		opacity: 0;
		position: fixed;
		left: 0;
		right: 0;
		pointer-events: none;
	}
	.filename {
		margin: 0;
	}

	.option-group {
		position: absolute;
		top: 2px;
	}
	.option-group i {
		font-size: inherit;
		line-height: 20px;
	}

	.option-container { 
		position: absolute; 
		background-color: #FFF8;
		border-bottom-right-radius: 2px;
		user-select: none;
		display: grid;
		grid-template-rows: 25px auto;
		grid-template-columns: auto auto;
		width: 150px;
	}
	.tab { pointer-events: auto; border: none; border-radius: 0; }
	.tab[active="true"] { background-color: transparent; }
	.tab[active="false"] { background-color: #0004; }
	.tool-container {grid-column: 1 / 3; padding: 10px;}
	.option-param, .stats { pointer-events: auto; width: auto;}

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

	button[disabled] {
		background-color: transparent;
		border: 1px dashed #DDD;
		color: #DDD;
	}

	.inputGroup button {
		height: 30px;
		width: 70%;
	}
	.inputGroup button i {
		float: left;
		vertical-align: middle;
	}
	.inputGroup button span {
		float: right;
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
	
</style>

<div id="app">
	<div id="file">
		<div class="inputGroup">
			<label for="spritesheet-upload">upload spritesheet:</label>
			<input id="spritesheet-upload" type="file" on:change={async (evt) => {spritesheetSrc.file = evt.target.files[0]; processImage(evt.target.files[0])}}>
			<p class="filename">{spritesheetSrc ? spritesheetSrc.file.name : '...'}</p>
		</div>
		<div class="inputGroup">
			<label for="framecount">number of frames in spritesheet:</label>
			<input id="framecount" type="number" min="1" max="99" bind:value={spritesheetSrc.framecount}>
		</div> 
		<div class="inputGroup">
			<button on:click={save}><i class="material-icons">save_alt</i><span>save to browser</span></button>
			<button on:click={load}><i class="material-icons">unarchive</i><span>load from browser</span></button>
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
	<div id="timeline-controls">
		<div class="option-group" style="justify-self: left">
			<input 
				type="number"
				id="current-frame"
				bind:value={anim.animFrame}
				on:focus={(evt) => {isCurrentFrameFocused = true; evt.target.select()}}
				on:blur={() => isCurrentFrameFocused = false}
				min="0" max="{anim.duration - 1}">
			<p style="width: 150px; margin: 0; display: inline-block">
				frame: <label 
					bind:this={currentFrameLabel} 
					style="width: {anim.duration.toString().length * 10 + 10}px" 
					id="current-frame-label"
					class={(isCurrentFrameFocused) ? 'active' : ''}
					for="current-frame"
				>
					{anim.animFrame + 1}
				</label> / {anim.duration};
			</p>
			
			<div style="width: 400px; margin: 0; display: inline-block">
				window: {anim.windowIndex + 1} / {windows.length}
				<button on:click={handleWindowAddition}><i class="material-icons">add</i></button>
				<button on:click={handleWindowDeletion} disabled="{windows.length <= 1}"><i class="material-icons">delete</i></button>
			</div>
		</div>
		<div class="option-group" style="justify-self: center;">
			<button on:click={ ()=>{anim.loop = !anim.loop} }><i class="material-icons">loop</i></button>
			<button on:click={skipBack} disabled="{anim.animFrame === 0}"><i class="material-icons">skip_previous</i></button>
			<button on:click={startPlaying}><i class="material-icons">{anim.playing ? 'pause' : 'play_arrow'}</i></button>
			<button on:click={skipAhead} disabled="{anim.animFrame === anim.duration - 1}"><i class="material-icons">skip_next</i></button>
		</div>
		<div class="option-group" style="justify-self: right;">
			playback speed:
			<select bind:value={anim.playSpeed}>
				<option value="0.25">1/4x</option>
				<option value="0.5">1/2x</option>
				<option value="1" selected>1x</option>
			</select>
		</div>
	</div>
	<div id="timeline">
		{#each windows as win, i}
			<div class="window"
				on:click={() => {anim.animFrame = anim.windowPositions[i]; editingMode = "window"}}
				style="
					height: 100%;
					flex-grow: {win.data.AG_WINDOW_LENGTH.value};
					background-color: {win.meta.color};
					border-right: {(i !== windows.length - 1) ? '1px solid black' : 'none'};
					display: grid;
					position: relative;
					box-shadow: {anim.windowIndex == i ? 'inset 0 0 5px black' : 'none'};
				"
			>
				<p style="justify-self: center; align-self: center; margin: 0; position: absolute;">{win.meta.name}</p>
			</div>
		{/each}
		<div id="playhead" 
			style="
				height: 100%;
				width: 2px;
				background-color: #8888;
				box-shadow: 0 0 0 1px #000;
				position: absolute;
				margin-left: {(anim.duration != 0) ? anim.animFrame * 100 / anim.duration : 0}%;
			"
		/>
	</div>
	<div id="window-metadata">
		<div class="option-group">
			<label style="display: inline-block">
				name:
				{#if editingMode === 'window'} 
					<input type="text" bind:value={windows[anim.windowIndex].meta.name}>
				{:else}
					<input type="text" bind:value={hitboxes[hitboxes.selected].meta.name}>
				{/if}
			</label>
			<label style="display: inline-block">
				color:
				{#if editingMode === 'window'} 
					<input type="text" bind:value={windows[anim.windowIndex].meta.color}>
				{:else}
					<input type="text" bind:value={hitboxes[hitboxes.selected].meta.color}>
				{/if}			
			</label>
		</div>
	</div>
	<div id="main" 
		bind:this={renderer}
		tabindex="0"
		
		on:keydown={(evt) => {
			for (const t of tools) {
				if (t[1] === tools.selected) continue;
				else if (t[2] === evt.key) {
					tools.selected = t[1];
					break;
				}
			}
		}}
		on:mousemove={(evt) => {
			if (renderer.dragging) {
				switch(tools.selected) {
					case "pan": 
						switch(renderer.target) {
							case 'hitbox':
								hitboxes[hitboxes.selected].data.HG_HITBOX_X.value += evt.movementX/anim.zoom;
								hitboxes[hitboxes.selected].data.HG_HITBOX_Y.value += evt.movementY/anim.zoom;
								break;
							case 'angle-indicator':
								hitboxes[hitboxes.selected].data.HG_ANGLE.value = 180 - Math.atan2(renderer.mouseOrigin[1] - evt.pageY, renderer.mouseOrigin[0] - evt.pageX) * 180/Math.PI;
								break;
							case 'resizer':
								hitboxes[hitboxes.selected].data.HG_WIDTH.value = Math.ceil(Math.abs((renderer.mouseOrigin[0] - evt.pageX)/anim.zoom));
								hitboxes[hitboxes.selected].data.HG_HEIGHT.value = Math.ceil(Math.abs((renderer.mouseOrigin[1] - evt.pageY)/anim.zoom));
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
			} else {
				calc.mouseX = evt.clientX; calc.mouseY = evt.clientY
			}
		}}
		on:mousedown={(evt) => {
			tools.active = true;
			renderer.dragging = true;
			renderer.target = evt.target.getAttributeNS(null, 'class');
			if (renderer.target === 'hitbox' || renderer.target === 'angle-indicator') {
				if (tools.selected === 'eraser') {
					editingMode = 'window';
					hitboxes.splice(evt.target.getAttributeNS(null, 'data-index'), 1);
					hitboxes.forceUpdate = true;
				} else {
					editingMode = 'hitbox';
					hitboxes.selected = parseInt(evt.target.getAttributeNS(null, 'data-index'));
					const hb = hitboxes[hitboxes.selected];
					const br = hb.meta.el.getBoundingClientRect();
					renderer.mouseOrigin = [br.left + (br.right - br.left)/2, br.top + (br.bottom - br.top)/2];
				}

			} else {
				if (renderer.target === "resizer") {
					hitboxes.selected = parseInt(evt.target.getAttributeNS(null, 'data-index'));
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
							break;
						case 'angle-indicator':
							hb.data.HG_ANGLE.value = Math.round(hb.data.HG_ANGLE.value);
							break;
						case 'resizer':
							if (hb.data.HG_WIDTH.value === 0 || hb.data.HG_HEIGHT.value === 0) {
								editingMode = 'window';
								hitboxes.splice(hitboxes.selected, 1);
								hitboxes.forceUpdate = true;
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

					attributes.HG_HITBOX_X.value = Math.floor(renderer.svgPosition[0]) - calc.sprXPos - calc.frameWidth * (anim.spriteFrame);
					attributes.HG_HITBOX_Y.value = Math.floor(renderer.svgPosition[1]) - calc.sprYPos;
					attributes.HG_SHAPE.value = ["circle", "rectangle", "round"].indexOf(tools.selected);
					attributes.HG_WINDOW.value = anim.windowIndex;
					attributes.HG_WINDOW_CREATION_FRAME.value = anim.windowFrame;
					hitboxes.push({meta: {color: '#f008', stroke: '#fFF8', strokeWidth: 0.5, el: null}, data: attributes});
					hitboxes.selected = hitboxes.length - 1;
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
							<option value="1" selected>1x</option>
							<option value="2" >2x</option>
							<option value="4" >4x</option>
							<option value="8" >8x</option>
						</select>
					</div>
					<div class="option-param" style="justify-self: right; display: block;">
						grid-x: <input type="number" bind:value={anim.zoomGrids[anim.zoom][0]} min="1" max="100"/>
					</div>
					<div class="option-param" style="justify-self: right; display: block;">
						grid-y: <input type="number" bind:value={anim.zoomGrids[anim.zoom][1]} min="1" max="100"/>
					</div>
					<div class="option-param" style="justify-self: right; display: block;">
						<label>
							lock offset: 
							<input type="checkbox" bind:checked={char.position_locked} />
							<span class="checkmark"></span>
						</label>
						<label>
							show motion: 
							<input type="checkbox" bind:checked={anim.movement} />
							<span class="checkmark"></span>
						</label>
					</div>
					<div class="stats">
						xvel: {anim.charFramePositionData[anim.windowIndex][anim.windowFrame].xvel}<br/>
						yvel: {anim.charFramePositionData[anim.windowIndex][anim.windowFrame].yvel}<br/>
						xpos: {anim.charFramePositionData[anim.windowIndex][anim.windowFrame].xpos}<br/>
						ypos: {anim.charFramePositionData[anim.windowIndex][anim.windowFrame].ypos}<br/>
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
				viewBox="
					{(anim.cameraX - rend.clientWidth) / 2 / anim.zoom} 
					{(anim.cameraY - rend.clientHeight) / 2 / anim.zoom} 
					{rend.clientWidth / anim.zoom} 
					{rend.clientHeight / anim.zoom}"
			>
				<defs>
					<filter id="blur" x="0" y="0">
						<feGaussianBlur in="SourceGraphic" stdDeviation="5" />
					</filter>
					<clipPath id="spriteClip" clipPathUnits="objectBoundingBox">
						<rect x="{(anim.spriteFrame % spritesheetSrc.framecount) / spritesheetSrc.framecount}" y="0" width="{1 / spritesheetSrc.framecount}" height="1" />
					</clipPath>
					<mask id="mouseMask">
						<circle cx="{calc.relMouseX}" cy="{calc.relMouseY}" r="{anim.gridViewerRadius / anim.zoom}" fill="white" filter="url(#blur)"/>
					</mask>
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
				<path d={(anim.grid) ? drawGridOverlay(anim.zoomGrids[anim.zoom][0], anim.zoomGrids[anim.zoom][1], anim.gridViewerRadius / anim.zoom, calc.relMouseX, calc.relMouseY) : ''}
					stroke-width="{1 / anim.zoom}"
					stroke="#0008"
					shape-rendering="crispEdges"
					mask="url(#mouseMask)"
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
				{#if char.position_locked}
					<image 
						x="{calc.sprXPos}"
						y="{calc.sprYPos}"
						width="{spritesheetSrc.dimensions.width}"
						height="{spritesheetSrc.dimensions.height}"
						xlink:href="{spritesheetSrc.dataUrl}"
						clip-path="url(#spriteClip)"
					/>
				{:else}
					<image 
						on:mousedown|stopPropagation={(evt) => evt.target.dragging = true}
						on:mouseout|stopPropagation={(evt) => evt.target.dragging = false}
						on:mouseup|stopPropagation={(evt) => evt.target.dragging = false}
						on:mousemove|stopPropagation={(evt) => {
							if (evt.target.dragging && !char.position_locked && tools.selected === "pan") {
								char.sprite_offset[0] += evt.movementX / anim.zoom;
								char.sprite_offset[1] += evt.movementY / anim.zoom;
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
								cx="{calc.sprXPos + hitbox.data.HG_HITBOX_X.value + calc.frameWidth * (anim.spriteFrame)}" 
								cy="{calc.sprYPos + hitbox.data.HG_HITBOX_Y.value}"
								rx="{hitbox.data.HG_WIDTH.value / 2}"
								ry="{hitbox.data.HG_HEIGHT.value / 2}"
								fill="{hitbox.meta.color}"
								stroke="{(hitboxes.selected === i) ? 'black' : hitbox.meta.stroke || 'black'}"
								stroke-width="{(hitboxes.selected === i) ? 4/anim.zoom : hitbox.meta.strokeWidth || 0}"
							/>
						{:else if hitbox.data.HG_SHAPE.value === 1}
							<rect 
								class="hitbox"
								data-index={i}
								bind:this={hitbox.meta.el}
								x="{calc.sprXPos + hitbox.data.HG_HITBOX_X.value - hitbox.data.HG_WIDTH.value / 2 + calc.frameWidth * (anim.spriteFrame)}" 
								y="{calc.sprYPos + hitbox.data.HG_HITBOX_Y.value - hitbox.data.HG_HEIGHT.value / 2}"
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
								x="{calc.sprXPos + hitbox.data.HG_HITBOX_X.value - hitbox.data.HG_WIDTH.value / 2 + calc.frameWidth * (anim.spriteFrame)}" 
								y="{calc.sprYPos + hitbox.data.HG_HITBOX_Y.value - hitbox.data.HG_HEIGHT.value / 2}"
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
							x1="{calc.sprXPos + hitbox.data.HG_HITBOX_X.value + calc.frameWidth * (anim.spriteFrame)}"
							x2="{
								calc.sprXPos 
								+ hitbox.data.HG_HITBOX_X.value 
								+ Math.cos(hitbox.data.HG_ANGLE.value * -Math.PI/180) 
								* hitbox.data.HG_WIDTH.value / 2
								+ calc.frameWidth * (anim.spriteFrame)}"
							y1="{calc.sprYPos + hitbox.data.HG_HITBOX_Y.value}"
							y2="{
								calc.sprYPos 
								+ hitbox.data.HG_HITBOX_Y.value 
								+ Math.sin(hitbox.data.HG_ANGLE.value * -Math.PI/180) 
								* hitbox.data.HG_HEIGHT.value / 2}"
							stroke="#0008" stroke-width="{4/anim.zoom}" stroke-dasharray="{(hitbox.data.HG_ANGLE.value === 361) ? 4/anim.zoom : 0}"
						/>
						{#if tools.selected === 'pan'}
							<circle 
								class="resizer"
								data-index={i}
								cx="{calc.sprXPos + hitbox.data.HG_HITBOX_X.value + calc.frameWidth * (anim.spriteFrame)}" 
								cy="{calc.sprYPos + hitbox.data.HG_HITBOX_Y.value}"
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
		{#if editingMode === 'window'}
			<ParamsBuilder isDisabled={isDisabled} bind:props={windows[anim.windowIndex].data} />
		{:else if editingMode === 'hitbox'}
			<ParamsBuilder isDisabled={isDisabled} bind:props={hitboxes[hitboxes.selected].data} />
		{/if}
	</div>
</div>