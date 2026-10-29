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
    type Object3D,
  } from 'three'
  import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
  import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

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

  const t_logo = 3000 // ms hold on each logo
  const t_exp = 1000 // ms hold on each explosion
  const t_animation = 3000 // ms travel between poses
  const scale_explosion = 5 // >1 = more drastic burst
  const point_size = 0.04

  function easeInOut(t: number) {
    return t * t * (3 - 2 * t)
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
      type Pose = { logo: Float32Array; explode: Float32Array }

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
        for (let i = 0; i < explode.length; i++) {
          explode[i] = logo[i]! + (explodeRaw[i]! - logo[i]!) * scale_explosion
        }
        poses.push({ logo, explode })
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

      const material = new PointsMaterial({
        color: point_color,
        size: point_size,
        sizeAttenuation: true,
      })
      const points = new Points(geometry, material)
      scene.add(points)

      // working lerp buffers
      let from = Float32Array.from(poses[0]!.logo)
      let to = Float32Array.from(poses[0]!.explode)

      type Phase = 'holdLogo' | 'toExplode' | 'holdExplode' | 'toNextLogo'
      let phase: Phase = 'holdLogo'
      let shapeIndex = 0
      let phaseStart = performance.now()
      let influence = 0

      function setTargets(nextFrom: Float32Array, nextTo: Float32Array) {
        from = Float32Array.from(nextFrom)
        to = Float32Array.from(nextTo)
      }

      function applyInfluence(t: number) {
        influence = t
        for (let i = 0; i < mixed.length; i++) {
          mixed[i] = from[i]! + (to[i]! - from[i]!) * t
        }
        posAttr.needsUpdate = true
      }

      updateTasks.morph = () => {
        const elapsed = performance.now() - phaseStart

        if (phase === 'holdLogo') {
          if (influence !== 0) applyInfluence(0)
          if (elapsed >= logoHoldMs) {
            // logo → this shape's explode
            setTargets(poses[shapeIndex]!.logo, poses[shapeIndex]!.explode)
            phase = 'toExplode'
            phaseStart = performance.now()
          }
        } else if (phase === 'toExplode') {
          const t = Math.min(1, elapsed / travelMs)
          applyInfluence(easeInOut(t))
          if (t >= 1) {
            phase = 'holdExplode'
            phaseStart = performance.now()
          }
        } else if (phase === 'holdExplode') {
          if (influence !== 1) applyInfluence(1)
          if (elapsed >= explodeHoldMs) {
            // explode → next shape's logo
            const nextIndex = (shapeIndex + 1) % poses.length
            setTargets(poses[shapeIndex]!.explode, poses[nextIndex]!.logo)
            shapeIndex = nextIndex
            phase = 'toNextLogo'
            phaseStart = performance.now()
          }
        } else if (phase === 'toNextLogo') {
          const t = Math.min(1, elapsed / travelMs)
          applyInfluence(easeInOut(t))
          if (t >= 1) {
            // snap targets for upcoming explode of the new logo
            setTargets(poses[shapeIndex]!.logo, poses[shapeIndex]!.explode)
            applyInfluence(0)
            phase = 'holdLogo'
            phaseStart = performance.now()
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
    display: grid;
    place-items: center;
    pointer-events: auto;
    --point-color: #99ABB7;
  }

  .champion :global(canvas) {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
