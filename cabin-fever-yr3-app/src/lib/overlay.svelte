<script lang="ts">
  import { onMount } from 'svelte'

  // Hash id → sheet title (must match App nav: #about, etc.)
  // Rich copy lives in the template below — not in this object
  const overlays: Record<string, { title: string }> = {
    about: { title: 'about' },
    transport: { title: 'transport' },
    contact: { title: 'contact' },
    faqs: { title: 'faqs' },
  }

  // null = closed; "about" | "transport" | ... = open that panel
  let activeId = $state<string | null>(null)

  // Read the # part of the URL and open/close to match
  function sync() {
    // "#about" → "about", "" → null
    const id = location.hash.slice(1) || null
    activeId = id && overlays[id] ? id : null
  }

  function close() {
    // Go back one history step (clears the hash if you got here via #about)
    if (location.hash) {
      history.back()
    } else {
      activeId = null
    }
  }

  onMount(() => {
    // If someone opens the site already on #about, put a clean URL under it
    // so the back button stays on this site instead of leaving
    const startId = location.hash.slice(1)
    if (startId && overlays[startId]) {
      history.replaceState(null, '', location.pathname)
      history.pushState(null, '', '#' + startId)
    }

    sync()

    // Browser fires these when the hash changes (nav click, back, swipe-back)
    window.addEventListener('hashchange', sync)
    window.addEventListener('popstate', sync)

    return () => {
      window.removeEventListener('hashchange', sync)
      window.removeEventListener('popstate', sync)
    }
  })
</script>

{#if activeId && overlays[activeId]}
  <div class="overlay" role="dialog" aria-modal="true" aria-labelledby="overlay-title">
    <button type="button" class="overlay__backdrop" aria-label="Close" onclick={close}
    ></button>

    <div class="overlay__sheet">
      <header class="overlay__header">
        <h2 id="overlay-title" class="overlay__title">{overlays[activeId].title}</h2>
        <button type="button" class="overlay__close" onclick={close}>close</button>
      </header>

      <div class="overlay__body">
        {#if activeId === 'about'}
          <p>text block text block</p>
        {:else if activeId === 'transport'}
          <p>getting there details coming soon — jac + nyc timing lives on the home screen.</p>
        {:else if activeId === 'contact'}
          <p>
            text @
            <a href="sms:+13073060055">307-306-0055</a>
            | email:
            <a href="mailto:cabinfever.wy@gmail.com">cabinfever.wy@gmail.com</a>
          </p>
        {:else if activeId === 'faqs'}
          <h3>transport</h3>
          <p>more faqs soon.</p>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 20;
    pointer-events: auto;
  }

  .overlay__backdrop {
    position: absolute;
    inset: 0;
    border: 0;
    padding: 0;
    margin: 0;
    background: rgba(36, 33, 33, 0.35);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    cursor: pointer;
  }

  .overlay__sheet {
    position: absolute;
    z-index: 1;
    inset: 10%;
    overflow: auto;
    padding:
      1.25rem
      max(1.25rem, env(safe-area-inset-right))
      max(1.5rem, env(safe-area-inset-bottom))
      max(1.25rem, env(safe-area-inset-left));
    background: #d9d9d9;
    color: #0a0a0a;
    animation: ease-in 0.5s ease-out;
    -webkit-mask-image: linear-gradient(to bottom, #d9d9d9 70%, transparent 100%);
    mask-image: linear-gradient(to bottom, #d9d9d9 70%, transparent 100%);
  }

  .overlay__header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .overlay__title {
    margin: 0;
    font-size: clamp(1.25rem, 4vw, 1.75rem);
    font-weight: 400;
    text-transform: lowercase;
  }

  .overlay__close {
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    text-transform: lowercase;
    cursor: pointer;
    opacity: 0.7;
    padding: 0.25rem 0;
  }

  .overlay__close:hover,
  .overlay__close:focus-visible {
    opacity: 1;
  }

  .overlay__body {
    font-size: clamp(0.95rem, 2.8vw, 1.05rem);
    line-height: 1.45;
    text-transform: lowercase;
  }

  .overlay__body h3 {
    margin: 0 0 0.35rem;
    font-size: 1em;
    font-weight: 600;
  }

  .overlay__body p {
    margin: 0 0 0.85rem;
  }

  .overlay__body p:last-child {
    margin-bottom: 0;
  }

  .overlay__body a {
    color: inherit;
  }

  @keyframes sheet-up {
    from {
      transform: translateY(0.75rem);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .overlay__sheet {
      animation: none;
    }
  }
</style>
