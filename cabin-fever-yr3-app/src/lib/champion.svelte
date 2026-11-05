<script lang="ts">
  import { onMount } from 'svelte'
  import {
    PerspectiveCamera,
    Scene,
    WebGLRenderer,
    HemisphereLight,
    Points,
    PointsMaterial,
    BufferAttribute,
    BufferGeometry,
    CanvasTexture,
    type Object3D,
  } from 'three'
  import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
  import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
  import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js'

  /*
   * Point Cloud Code for folder of 4 logos
   */
  const glbs = import.meta.glob('../assets/points_web/*.glb', {
    eager: true,
    query: '?url',
    import: 'default',
  }) as Record<string, string>

  const byName = Object.fromEntries(
    Object.entries(glbs).map(([path, url]) => [
      path.split('/').pop()!.replace('.glb', ''),
      url,
    ]),
  ) as Record<string, string>

  // cycle order: logo → explode → next logo → …
  const SHAPE_ORDER = ['snowflake', 'realfreak', 'cowboy', 'reelfreqqed'] as const

  // keep in sync with overlay.svelte panel keys
  const OVERLAY_HASHES = new Set(['about', 'transport', 'contact', 'faqs'])

  const t_logo = 3000 // ms hold on each logo
  const t_exp = 5000 // ms hold on each explosion
  const t_animation = 1000 // ms travel between poses
  const scale_explosion = 5 // >1 = more drastic burst
  const point_size = 0.04
  const noise_amp = 0.15 // world-unit jitter while held exploded
  const noise_speed = 0.00035 // how fast the noise field drifts
  const spin_speed = 0.10 // rad/sec around Y while fully exploded (CCW / +Y)
  const TWO_PI = Math.PI * 2

  function overlayHashOpen() {
    const id = location.hash.slice(1)
    return OVERLAY_HASHES.has(id)
  }

  function easeInOut(t: number) {
    return (3 - 2 * t)*t*t
  }

  /** Soft round sprite for PointsMaterial.map (CSS border-radius can't round GL points). */
  function makeCirclePointTexture(size = 128) {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    const r = size / 2
    const g = ctx.createRadialGradient(r, r, 0, r, r, r)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.7, 'rgba(255,255,255,1)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
    const tex = new CanvasTexture(canvas)
    tex.needsUpdate = true
    return tex
  }

  let host: HTMLDivElement | undefined = $state()

  onMount(() => {
    if (!host) return

    const point_color =
      getComputedStyle(host).getPropertyValue('--point-color').trim() || '#ffffff'

    const updateTasks: Record<string, () => void> = {}
    let frameId = 0
    let disposed = false

    const scene = new Scene()
    const camera = new PerspectiveCamera(50, 1, 0.1, 10000)
    camera.position.z = 5

    const renderer = new WebGLRenderer({ antialias: true, alpha: true })
    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    host.appendChild(renderer.domElement)

    const light = new HemisphereLight(0xffffff, 0x000000, 1)
    scene.add(light)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true

    updateTasks.controls = () => controls.update()
    updateTasks.renderer = () => renderer.render(scene, camera)

    const loader = new GLTFLoader()

    function findPoints(root: Object3D): Points | null {
      let found: Points | null = null
      root.traverse((obj) => {
        if ((obj as Points).isPoints) found = obj as Points
      })
      return found
    }

    async function loadPositions(url: string): Promise<Float32Array> {
      const gltf = await loader.loadAsync(url)
      const pts = findPoints(gltf.scene)
      if (!pts) throw new Error(`No Points mesh in ${url}`)
      return Float32Array.from(pts.geometry.attributes.position.array as Float32Array)
    }

    /**
     * Full show loop:
     * snowflake → explode → realfreak → explode → cowboy → explode → reelfreqqed → explode → snowflake…
     */
    async function loopShow(
      logoHoldMs: number,
      explodeHoldMs: number,
      travelMs: number,
    ) {
      // dir = unit vector logo → explode (for along-burst jitter)
      type Pose = { logo: Float32Array; explode: Float32Array; dir: Float32Array }

      // init poses from glb files
      const poses: Pose[] = []
      for (const name of SHAPE_ORDER) {
        const logoUrl = byName[name]
        const explodeUrl = byName[`${name}_explode`]
        if (!logoUrl || !explodeUrl) {
          console.error(`Missing GLBs for ${name}`)
          return
        }
        const logo = await loadPositions(logoUrl)
        const explodeRaw = await loadPositions(explodeUrl)
        if (logo.length !== explodeRaw.length) {
          console.error(`Point count mismatch for ${name}`)
          return
        }
        const explode = new Float32Array(explodeRaw.length)
        const dir = new Float32Array(explodeRaw.length)
        for (let i = 0; i < explode.length; i += 3) {
          const dx = (explodeRaw[i]! - logo[i]!) * scale_explosion
          const dy = (explodeRaw[i + 1]! - logo[i + 1]!) * scale_explosion
          const dz = (explodeRaw[i + 2]! - logo[i + 2]!) * scale_explosion
          explode[i] = logo[i]! + dx
          explode[i + 1] = logo[i + 1]! + dy
          explode[i + 2] = logo[i + 2]! + dz
          const len = Math.hypot(dx, dy, dz)
          if (len < 1e-6) {
            dir[i] = 0
            dir[i + 1] = 0
            dir[i + 2] = 0
          } else {
            dir[i] = dx / len
            dir[i + 1] = dy / len
            dir[i + 2] = dz / len
          }
        }
        poses.push({ logo, explode, dir })
      }
      if (disposed || poses.length === 0) return

      const count = poses[0]!.logo.length
      for (const pose of poses) {
        if (pose.logo.length !== count) {
          console.error('All shapes must share the same point count for morphing')
          return
        }
      }

      const mixed = new Float32Array(poses[0]!.logo)
      const geometry = new BufferGeometry()
      const posAttr = new BufferAttribute(mixed, 3)
      geometry.setAttribute('position', posAttr)

      // logo = default square points; explode = round sprite map
      const pointMap = makeCirclePointTexture(128)
      const material = new PointsMaterial({
        color: point_color,
        size: point_size,
        sizeAttenuation: true,
        map: null,
        transparent: false,
        depthWrite: true,
        alphaTest: 0,
      })
      const points = new Points(geometry, material)
      points.rotation.y = 0
      scene.add(points)

      // working lerp buffers
      let from = Float32Array.from(poses[0]!.logo)
      let to = Float32Array.from(poses[0]!.explode)
      // which shape's burst axis to jitter along (stays put during toNextLogo)
      let burstDir = poses[0]!.dir
      const perlin = new ImprovedNoise()
      let roundPoints = false
      let lastSpinNow = performance.now()
      // during reassemble: lerp Y CCW from spinHomeFrom → spinHomeTo (next face-on)
      let spinHomeFrom = 0
      let spinHomeTo = 0
      let spinHoming = false

      type Phase = 'holdLogo' | 'toExplode' | 'holdExplode' | 'toNextLogo'
      let phase: Phase = 'holdLogo'
      let shapeIndex = 0
      let phaseStart = performance.now()
      let influence = 0
      let explodeNow = false
      // true while any overlay hash is open (#about, …) — hold explode for later FX
      let pinnedExplode = overlayHashOpen()
      let unpinReassemble = false

      function setTargets(nextFrom: Float32Array, nextTo: Float32Array) {
        from = Float32Array.from(nextFrom)
        to = Float32Array.from(nextTo)
      }

      function syncPinnedFromHash() {
        const open = overlayHashOpen()
        if (!open && pinnedExplode) unpinReassemble = true
        pinnedExplode = open
      }

      window.addEventListener('hashchange', syncPinnedFromHash)
      window.addEventListener('popstate', syncPinnedFromHash)

      // squares on logo, round sprites while exploding (can't morph square↔circle — hard switch)
      function setRoundPoints(on: boolean) {
        if (on === roundPoints) return
        roundPoints = on
        material.map = on ? pointMap : null
        material.transparent = on
        material.depthWrite = !on
        material.alphaTest = on ? 0.85 : 0
        material.needsUpdate = true
      }

      // lerp from→to, then slide along burstDir by scalar noise (not XYZ wind)
      function writePositions(lerpT: number, jitterStrength: number, now: number) {
        influence = lerpT
        setRoundPoints(jitterStrength > 0)
        const jt = now * noise_speed
        const jAmp = noise_amp * jitterStrength
        for (let i = 0; i < mixed.length; i += 3) {
          const x = from[i]! + (to[i]! - from[i]!) * lerpT
          const y = from[i + 1]! + (to[i + 1]! - from[i + 1]!) * lerpT
          const z = from[i + 2]! + (to[i + 2]! - from[i + 2]!) * lerpT
          if (jAmp !== 0) {
            const n = perlin.noise(x + jt, y, z) * jAmp
            mixed[i] = x + burstDir[i]! * n
            mixed[i + 1] = y + burstDir[i + 1]! * n
            mixed[i + 2] = z + burstDir[i + 2]! * n
          } else {
            mixed[i] = x
            mixed[i + 1] = y
            mixed[i + 2] = z
          }
        }
        posAttr.needsUpdate = true
      }

      // continuous CCW spin while exploded (not during reassemble home)
      function updateSpin(spinAmount: number, now: number) {
        const dt = Math.min(0.05, (now - lastSpinNow) / 1000)
        lastSpinNow = now
        if (spinAmount > 0.001) {
          points.rotation.y += spin_speed * spinAmount * dt
        }
      }

      // arm CCW-only unwind to the next face-on angle (never reverse)
      function beginSpinHome() {
        spinHomeFrom = points.rotation.y
        const turns = Math.floor(spinHomeFrom / TWO_PI)
        const frac = spinHomeFrom - turns * TWO_PI
        spinHomeTo = frac < 1e-3 ? turns * TWO_PI : (turns + 1) * TWO_PI
        spinHoming = true
      }

      function applySpinHome(t: number) {
        if (!spinHoming) return
        points.rotation.y = spinHomeFrom + (spinHomeTo - spinHomeFrom) * t
        if (t >= 1) {
          points.rotation.y = 0
          spinHoming = false
        }
      }

      function beginExplode(now: number) {
        spinHoming = false
        burstDir = poses[shapeIndex]!.dir
        setTargets(poses[shapeIndex]!.logo, poses[shapeIndex]!.explode)
        phase = 'toExplode'
        phaseStart = now
        explodeNow = false
      }

      function reassembleToCurrentLogo(now: number) {
        burstDir = poses[shapeIndex]!.dir
        setTargets(Float32Array.from(mixed), poses[shapeIndex]!.logo)
        beginSpinHome()
        phase = 'toNextLogo'
        phaseStart = now
        unpinReassemble = false
      }

      function onPointerDown(e: PointerEvent) {
        const el = e.target
        if (!(el instanceof Element)) return
        if (el.closest('a, button, .nav, .overlay, [role="button"]')) return
        if (pinnedExplode) return
        if (phase === 'holdLogo') explodeNow = true
      }

      window.addEventListener('pointerdown', onPointerDown)

      updateTasks.morph = () => {
        const now = performance.now()

        // overlay closed → fold back to the logo we exploded from
        if (unpinReassemble && (phase === 'holdExplode' || phase === 'toExplode')) {
          reassembleToCurrentLogo(now)
        }

        // overlay opened mid-reassemble → turn around toward this logo's explode
        if (pinnedExplode && phase === 'toNextLogo') {
          spinHoming = false
          burstDir = poses[shapeIndex]!.dir
          setTargets(Float32Array.from(mixed), poses[shapeIndex]!.explode)
          phase = 'toExplode'
          phaseStart = now
        }

        // AFTER pin/unpin may reset phaseStart — stale elapsed was snapping reassemble to t=1
        const elapsed = now - phaseStart

        if (phase === 'holdLogo') {
          if (influence !== 0) writePositions(0, 0, now)
          points.rotation.y = 0
          if (elapsed >= logoHoldMs || explodeNow || pinnedExplode) {
            beginExplode(now)
          }
        } else if (phase === 'toExplode') {
          const t = easeInOut(Math.min(1, elapsed / travelMs))
          // jitter fades in with the explode so holdExplode doesn't pop
          writePositions(t, t, now)
          updateSpin(t, now)
          if (elapsed >= travelMs) {
            phase = 'holdExplode'
            phaseStart = now
          }
        } else if (phase === 'holdExplode') {
          writePositions(1, 1, now)
          updateSpin(1, now)
          // pinned = hold forever; otherwise advance on timer
          if (!pinnedExplode && elapsed >= explodeHoldMs) {
            const nextIndex = (shapeIndex + 1) % poses.length
            setTargets(poses[shapeIndex]!.explode, poses[nextIndex]!.logo)
            shapeIndex = nextIndex
            beginSpinHome()
            phase = 'toNextLogo'
            phaseStart = now
          }
        } else if (phase === 'toNextLogo') {
          const t = easeInOut(Math.min(1, elapsed / travelMs))
          writePositions(t, 1 - t, now)
          // face-on unwind happens with the morph — always CCW, never after
          applySpinHome(t)
          if (elapsed >= travelMs) {
            setTargets(poses[shapeIndex]!.logo, poses[shapeIndex]!.explode)
            writePositions(0, 0, now)
            points.rotation.y = 0
            spinHoming = false
            phase = 'holdLogo'
            phaseStart = now
          }
        }
      }
    }

    void loopShow(t_logo, t_exp, t_animation)

    function resize() {
      if (!host) return
      const { clientWidth: w, clientHeight: h } = host
      if (w === 0 || h === 0) return
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h, false)
    }

    function run() {
      if (disposed) return
      for (const key in updateTasks) updateTasks[key]()
      frameId = requestAnimationFrame(run)
    }

    const ro = new ResizeObserver(resize)
    ro.observe(host)
    resize()
    run()

    return () => {
      disposed = true
      cancelAnimationFrame(frameId)
      ro.disconnect()
      controls.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  })
</script>

<div class="champion" bind:this={host} aria-hidden="true"></div>

<style>
  .champion {
    position: absolute;
    inset: 0;
    z-index: 0;
    border-radius: 999px;
    display: grid;
    place-items: center;
    pointer-events: auto;
    --point-color: #8DB7FF;
  }

  .champion :global(canvas) {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
