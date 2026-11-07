<script lang="ts">
  import { onMount } from 'svelte'
  import faqsContent from './content/faqs.json'

  type Bullet = { label?: string; text: string }
  type Section = {
    heading: string
    intro?: string
    bullets?: Bullet[]
    groups?: { heading: string; bullets: Bullet[] }[]
  }

  // Hash id → sheet title (must match App nav: #about, etc.)
  const overlays: Record<string, { title: string }> = {
    about: { title: 'about' },
    contact: { title: 'contact' },
    faqs: { title: faqsContent.title },
  }

  const faqSections = faqsContent.sections as Section[]

  // null = closed; "about" | "contact" | "faqs" = open that panel
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
          <p>more about soon.</p>
        {:else if activeId === 'contact'}
          <p>
            text @
            <a href="sms:+13073060055">307-306-0055</a>
            | email:
            <a href="mailto:cabinfever.wy@gmail.com">cabinfever.wy@gmail.com</a>
          </p>
        {:else if activeId === 'faqs'}
          {#each faqSections as section}
            <section class="overlay__section">
              <h3>{section.heading}</h3>
              {#if section.intro}
                <p class="overlay__intro">{section.intro}</p>
              {/if}
              {#if section.bullets?.length}
                <ul>
                  {#each section.bullets as bullet}
                    <li>
                      {#if bullet.label}<span class="overlay__label">{bullet.label}</span>
                        <span aria-hidden="true"> :: </span>{/if}{bullet.text}
                    </li>
                  {/each}
                </ul>
              {/if}
              {#if section.groups}
                {#each section.groups as group}
                  <h4>{group.heading}</h4>
                  <ul>
                    {#each group.bullets as bullet}
                      <li>
                        {#if bullet.label}<span class="overlay__label">{bullet.label}</span>
                          <span aria-hidden="true"> :: </span>{/if}{bullet.text}
                      </li>
                    {/each}
                  </ul>
                {/each}
              {/if}
            </section>
          {/each}
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
    /* background: rgba(255, 255, 255, 0.5); */
    opacity: 0.5;
    backdrop-filter: blur(100px);
    -webkit-backdrop-filter: blur(100px);
    cursor: pointer;
    animation: ease-o 1s ease-out;
  }

  .overlay__sheet {
    position: absolute;
    z-index: 1;
    inset: 10%;
    overflow: auto;
    border-radius: 10px;
    box-shadow: 2px 2px 0px rgba(0, 0, 0, 0.1);
    padding:
      1.25rem
      max(1.25rem, env(safe-area-inset-right))
      max(1.5rem, env(safe-area-inset-bottom))
      max(1.25rem, env(safe-area-inset-left));
    color: var(--ink-overlay);
    font-family: var(--font);
    text-shadow: 0 0 var(--title-blur) var(--accent);
    background-color: var(--overlay-background);
    /* background-image: var(--background-image); */
    background-repeat: repeat;
    background-size: 180px 180px;
    opacity: 0.8;
    backdrop-filter: blur(100px);
    animation: ease-o 1s ease-out;
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
    text-shadow: inherit;
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

  .overlay__section {
    margin-bottom: 1.35rem;
  }

  .overlay__section:last-child {
    margin-bottom: 0;
  }

  .overlay__body h3 {
    margin: 0 0 0.35rem;
    font-size: 1.05em;
    font-weight: 600;
  }

  .overlay__body h4 {
    margin: 0.75rem 0 0.3rem;
    font-size: 0.95em;
    font-weight: 600;
  }

  .overlay__intro {
    margin: 0 0 0.55rem;
    opacity: 0.85;
  }

  .overlay__body ul {
    margin: 0;
    padding-left: 1.1rem;
  }

  .overlay__body li {
    margin: 0 0 0.45rem;
  }

  .overlay__body li:last-child {
    margin-bottom: 0;
  }

  .overlay__label {
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
