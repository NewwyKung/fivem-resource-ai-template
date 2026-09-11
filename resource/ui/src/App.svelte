<script>
import { onNuiMessage, sendNuiCallback } from './js/NuiBridge'
onNuiMessage("IS_READY", () => {
    sendNuiCallback("READY", {})
})
</script>

<main>
</main>

<style>
</style>
