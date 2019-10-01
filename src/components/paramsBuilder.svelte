<script>
    export let winProps = {};
    export let isDisabled = false;
</script>

<style>
    * {
        position: relative;
    }

    input {
        padding-left: 3px;
    }

    *[data-tooltip]::after {
        background-color: black;
        border-radius: 2px;
        padding: 5px;
        font-size: 15px;
        color: white;
        min-width: 200px;
        content: attr(data-tooltip);
        white-space: pre-wrap;

        position: absolute;
        display: block;
        z-index: 1000;

        opacity: 0;
        pointer-events: none;
        transition: opacity .2s ease-out;

        border: 1px solid #444;

    }

    *[data-tooltip]:hover::after {
        opacity: 1;
        transition: opacity .2s ease-out;
    }

    *.tooltip-left::after {right: calc(100% + 5px); top: 0;}
    *.tooltip-up-left::after {right: calc(100% + 5px); bottom: 0;}

    .input-title {
        font-size: 12px;
        font-weight: bold;
    }
</style>

{#each Object.entries(winProps) as [key, val], index}
    {#if (!isDisabled(key, winProps))}
        <div class="input-title">{key}</div>
        <div class="{(index !== Object.keys(winProps).length - 1) ? 'tooltip-left' : 'tooltip-up-left'}" data-tooltip="{val.description}">
        {#if Array.isArray(val.type)}
            <select bind:value={winProps[key].value}>
                {#each val.type as choice}
                    <option value="{choice}" selected="{choice === val.value}">{choice}</option>
                {/each}
            </select>
        {:else if val.type === 'number'}
            <input type="number" bind:value={winProps[key].value} /> 
        {/if}
        </div>
    {/if}
{/each}