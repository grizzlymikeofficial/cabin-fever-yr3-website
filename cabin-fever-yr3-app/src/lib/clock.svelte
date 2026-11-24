<script lang="ts">
  type Location = 'nyc' | 'jac'

  const timeZones = {
    nyc: 'America/New_York',
    jac: 'America/Denver', // Jackson Hole, WY (Mountain Time)
  } as const satisfies Record<Location, string>

  let {
    location,
    class: className = 'meta',
  }: {
    location: Location
    class?: string
  } = $props()

  let label = $state('')

  function formatNow(loc: Location) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timeZones[loc],
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date())

    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value ?? '00'

    return `${get('hour')}:${get('minute')}:${get('second')} ${loc.toUpperCase()}`
  }

  $effect(() => {
    label = formatNow(location)
    const id = setInterval(() => {
      label = formatNow(location)
    }, 1000)

    return () => clearInterval(id)
  })
</script>

<p class={className}>{label}</p>
