<script>
    export let props = {};
    export let isDisabled = false;
    let items = [];

</script>

<style>
    *[data-tooltip] {
        --position-right: 0px;
        --position-top: 0px;
        
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
        max-width: 200px;
        content: attr(data-tooltip);
        white-space: pre-wrap;
        position: fixed;
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

    *.tooltip-left::after {right: calc(100% - var(--position-right)); top: var(--position-top);}
    *.tooltip-up-left::after {right: calc(100% - var(--position-right)); top: var(--position-top);}

    .input-title {
        font-size: 12px;
        font-weight: bold;
    }
</style>

{#each Object.entries(props) as [key, val], index}
    {#if (!isDisabled(key, props))}
        <div class="input-title">{key}</div>
        <div 
            class="{(index !== Object.keys(props).length - 1) ? 'tooltip-left' : 'tooltip-up-left'}" 
            data-tooltip="{val.description}"
            bind:this={items[index]}
            on:mouseover={(evt) => {
                let self = items[index];
                let bounds = self.getBoundingClientRect();
                let styles = window.getComputedStyle(self, ':after');
                self.style.setProperty('--position-right', `${bounds.left - 5}px`);
                self.style.setProperty('--position-top', `${
                    (bounds.top + parseInt(styles.getPropertyValue('height')) > window.innerHeight) ? 
                    window.innerHeight - parseInt(styles.getPropertyValue('height')) - 10 : bounds.top 
                }px`);
            }}
        >
        {#if Array.isArray(val.type)}
            <select bind:value={props[key].value}>
                {#each val.type as choice}
                    <option value="{choice}" selected="{choice === val.value}">{choice}</option>
                {/each}
            </select>
        {:else if val.type === 'number'}
            <input type="number" bind:value={props[key].value} /> 
        {:else if val.type === 'string'}
            <input type="text" bind:value={props[key].value} /> 
        {:else if val.type === 'auto'}
            <input type="text" bind:value={props[key].value} disabled /> 
        {/if}
        </div>
    {/if}
{/each}