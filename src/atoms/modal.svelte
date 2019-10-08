<script>
    import MarkdownIt from 'markdown-it';

    import { createEventDispatcher } from 'svelte';
    import { fly, fade } from 'svelte/transition';

    import helpText from './help';

    export let visible = true;
    export let text = helpText;

    const md = MarkdownIt({html: true, linkify: true, typographer: true});
    const dispatch = createEventDispatcher();

</script>

<style>
    #container {
        display: grid;
        position: fixed;
        background-color: #0008;
        width: 100vw;
        height: 100vh;

        z-index: 5000;
    }

    #content {
        align-self: center;
        justify-self: center;
        background-color: #DDD;
        border: 2px solid #000;
        border-radius: 2px;

        min-height: 500px;
        max-height: calc(100vh - 400px);
        width: 800px;
        padding: 20px;
    }

    #content {
        overflow-y: scroll;
    }
</style>

{#if visible}
    <div id="container" on:click={() => dispatch('close')} in:fly="{{y: -2000, duration: 1000}}" out:fade>
        <div id="content" on:click|stopPropagation="">
            {@html md.render(text)}
        </div>
    </div>
{/if}
