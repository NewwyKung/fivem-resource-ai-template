<script>
    import { Post } from "../js/Post";

    let { children, onMessage = () => {} } = $props();

    let IS_READY = $state(false);
    let visible = $state(false);

     const listener = (event) => {
        const { action, data } = event.data;
        if(action === 'SET_READY') {
            IS_READY = true;
        }
        else if(IS_READY) {
            if(action === 'SET_VISIBLE') {
                visible = data.visible;
            }else{
                onMessage(action, data)
            }
        }
    }

    const keydownListener = (event) => {
        console.log("keydownListener", event.key);
        if (event.key === "Escape") {
            Post("CLOSE_UI", {});
        }
    };

</script>

<svelte:window onmessage={listener} onkeydown={keydownListener} />
<div class="visible-wrapper" class:hidden={!visible || !IS_READY}>
    {@render children()}
</div>

<style>
    .visible-wrapper {
        display: block;
        width: 100%;
        height: 100%;
    }

    .hidden {
        display: none;
    }
</style>