

<script>
    import { createEventDispatcher } from 'svelte';

    export let hitboxes = [];

    const dispatch = createEventDispatcher();

    const hbTypes = ["invalid", "Physical", "Projectile"];
    const hbShapes= ["Circle", "Rectangle", "Round Rect"];

    const clickHandler = (hitbox) => {
        dispatch("selected", {hitbox})
    }
</script>

<style>
    .hitbox-container {
        text-align: left;
        border: 1px solid grey;
        border-radius: 8px;
        padding: 0.5em;
        margin-bottom: 1em;
        background-color: #E443;
    }

    .hitbox-container:hover {
        border: 1px solid white;
        background-color: #E446;
        cursor: pointer;
    }

    th {
        font-weight: bold;
        padding-right: 1em;
    }
</style>

<h3>Hitbox List</h3>
{#each hitboxes as hitbox}
    <div class="hitbox-container" on:click={() => clickHandler(hitbox)}>
        <table>
            <tr>
                <th>Type:</th><td>{hbTypes[hitbox.data.HG_HITBOX_TYPE.value]}</td>
            </tr>
            <tr>
                <th>Window:</th><td>{hitbox.data.HG_WINDOW.value}</td>
            </tr>
            <tr>
                <th>Frame:</th><td>{hitbox.data.HG_WINDOW_CREATION_FRAME.value}</td>
            </tr>
            <tr>
                <th>Shape:</th><td>{hbShapes[hitbox.data.HG_SHAPE.value]}</td>
            </tr>
        </table>
    </div>
{/each}