<script>
    import { onMount } from 'svelte';
    import Visible from './provider/Visible.svelte';
    import { isBrowser } from './js/Post';

    const onMessage = (action, data) => {
        switch (action) {
            case 'INIT':
                break;
            default:
        }
    };

    onMount(() => {
        if (isBrowser) {
            window.postMessage({ action: 'SET_READY' }, '*');
            window.postMessage({ action: 'SET_VISIBLE', data: { visible: true } }, '*');
        }
    });
</script>

<Visible {onMessage}>
    <!-- Add the resource UI here after requirements and wireframe approval. -->
</Visible>
