<script>
    import Visible from './provider/Visible.svelte';
    import Game from './components/Game.svelte';

    const onMessage = (action, data) => {
        switch(action) {
            case 'INIT':
                // DO SOMETHING
                break;
            default:
        }
    }
</script>

<Visible {onMessage}>
    <Game />
</Visible>

<style>
</style>
