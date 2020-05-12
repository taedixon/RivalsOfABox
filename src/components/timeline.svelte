<script>

export let anim;
export let windows;
export let hitboxes;

export let skipAhead;
export let skipBack;

export let editingMode;
export let winProps;

export let updateStates;

    let currentFrameLabel;
	let isCurrentFrameFocused = false;
	let fpsMonitor = 0;

    const startPlaying = () => {
		anim.playing = !anim.playing;
		if (anim.playing) play();
	}
	const play = () => {
		if (anim.playing) {
			requestAnimationFrame(play);
			updateStates.frames = true;
			fpsMonitor++;
			if (fpsMonitor >= (1 / anim.playSpeed)) {
				fpsMonitor = 0;
				if (anim.animFrame + 1 === anim.duration) {
					anim.animFrame = 0;
					if (!anim.loop) { anim.playing = false; }
				}
				else { anim.animFrame += 1}
			}
		}
	}

	const handleWindowAddition = () => {
		windows.splice(anim.windowIndex, 0, {meta: {}, data: JSON.parse(JSON.stringify({...winProps}))} );
		anim.animFrame = anim.animFrame;
		updateStates.length = true;
		updateStates.frames = true;
	}
	const handleWindowDeletion = () => {
		windows.splice(anim.windowIndex, 1);
		anim.animFrame = anim.windowPositions[anim.windowIndex - 1] || 0;
		updateStates.length = true;
		updateStates.frames = true;
	}

</script>

<style>
    #timeline-controls {
		grid-row: 3 / 4;
		grid-column: 1 / 2;
		position: relative;
		padding: 3px;
		display: flex;
		justify-content: space-between;
		align-content: center;
	}

	@media screen and (min-width: 1250px) {
		#timeline-controls {
			justify-content: center;
		}
		#timeline-controls>* {
			margin-right: 2em;
		}
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
		grid-row: 4 / 5;
		grid-column: 1 / 2;
		border-top: 1px solid black;
		position: relative;
		display: flex;
		flex-direction: row;
	}

	#window-metadata {
		background-color: #555;
		border-top: 1px solid #333;
		grid-row: 5 / 6;
		grid-column: 1 / 2;
		position: relative;
		padding: 3px;
		display: grid;
		color: white;
    }

    #current-frame {
		opacity: 0;
		position: fixed;
		left: 0;
		right: 0;
		pointer-events: none;
    }

    button[disabled] {
		background-color: transparent;
		border: 1px dashed #DDD;
		color: #DDD;
	}
</style>

<div id="timeline-controls">
		<div class="option-group">
			<input
				type="number"
				id="current-frame"
				bind:value={anim.animFrame}
				on:focus={(evt) => {isCurrentFrameFocused = true; evt.target.select()}}
				on:blur={() => isCurrentFrameFocused = false}
				min="0" max="{anim.duration - 1}">
			<p style="margin: 0; display: inline-block">
				F: <label
					bind:this={currentFrameLabel}
					style="width: {anim.duration.toString().length * 10 + 10}px"
					id="current-frame-label"
					class={(isCurrentFrameFocused) ? 'active' : ''}
					for="current-frame"
				>
					{anim.animFrame + 1}
				</label> / {anim.duration};
			</p>
		</div>
		<div class="option-group">
			W: {anim.windowIndex + 1} / {windows.length}
		</div>
		<div class="option-group">
			<button on:click={handleWindowAddition}><i class="material-icons">add</i></button>
			<button on:click={handleWindowDeletion} disabled="{windows.length <= 1}"><i class="material-icons">delete</i></button>
		</div>
		<div class="option-group">
			<button on:click={ ()=>{anim.loop = !anim.loop} }><i class="material-icons">loop</i></button>
			<button on:click={skipBack} disabled="{anim.animFrame === 0}"><i class="material-icons">skip_previous</i></button>
			<button on:click={startPlaying}><i class="material-icons">{anim.playing ? 'pause' : 'play_arrow'}</i></button>
			<button on:click={skipAhead} disabled="{anim.animFrame === anim.duration - 1}"><i class="material-icons">skip_next</i></button>
		</div>
		<div class="option-group">
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
				on:click={() => {anim.animFrame = anim.windowPositions[i]; updateStates.frames = true; editingMode = "window"}}
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
				{:else if editingMode === 'hitbox'}
					<input type="text" bind:value={hitboxes[hitboxes.selected].meta.name}>
				{/if}
			</label>
			<label style="display: inline-block">
				color:
				{#if editingMode === 'window'}
					<input type="text" bind:value={windows[anim.windowIndex].meta.color}>
				{:else if editingMode === 'hitbox'}
					<input type="text" bind:value={hitboxes[hitboxes.selected].meta.color}>
				{/if}
			</label>
		</div>
	</div>