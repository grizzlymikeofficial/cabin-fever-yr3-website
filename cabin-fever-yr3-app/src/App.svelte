<script>
  import emblem from './assets/emblem.png'
  import Clock from './lib/clock.svelte'
  import Champion from './lib/champion.svelte'
  import EndlessTools from './lib/endless-tools-iframe.svelte'

  const whatsApp = import.meta.env.VITE_WHATS_APP
  const showEmblem = false //Placeholde for logo animation (while working on three.js)

  const navGroups = [
    [
      { label: 'about', href: '#about' },
      { label: 'tickets', href: 'https://shopify.com', external: true },
      { label: 'sets', href: 'https://soundcloud.com/cabinfeversoundsystem', external: true },
    ],
    [
      { label: 'transport', href: '#transport' },
      { label: 'group chat', href: whatsApp, external: true },
      { label: 'socials', href: 'https://www.instagram.com/cabinfever.wy/', external: true },
    ],
    [
      { label: 'contact', href: '#contact' },
      { label: 'faqs', href: '#faqs' },
    ],
  ]
</script>

<main class="page">
  <Champion />
  <EndlessTools />

  <nav class="nav" aria-label="Primary">
    {#each navGroups as group}
      <ul class="nav-group">
        {#each group as item}
          <li>
            <a
              href={item.href}
              target={item.external ? '_blank' : undefined}
              rel={item.external ? 'noopener noreferrer' : undefined}
            >
              {item.label}
            </a>
          </li>
        {/each}
      </ul>
    {/each}
  </nav>

  <section class="stage" aria-label="Cabin Fever">
    <h1 class="brand">
      <span class="brand-text">cabinfever</span><span class="brand-sup">.wy</span>
    </h1>

    <div class="emblem-cluster">
      <Clock location="JAC" class="meta meta--jac" />

      {#if showEmblem}
        <div class="emblem-frame">
          <img
            class="emblem"
            src={emblem}
            alt=""
            width="280"
            height="220"
            decoding="async"
          />
        </div>
      {/if}

      <Clock location="NYC" class="meta meta--nyc" />
    </div>

    <p class="dates">april 30 - may 2</p>
  </section>
</main>
