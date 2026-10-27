<script lang="ts">
  import { onMount } from 'svelte'
  import {
    PerspectiveCamera,
    Scene,
    WebGLRenderer,
    InstancedMesh,
    BoxGeometry,
    MeshPhongMaterial,
    Matrix4,
    Vector3,
    HemisphereLight,
  } from 'three'
  import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
  import instanceData from '../assets/instances.json'

  let host: HTMLDivElement | undefined = $state()

  onMount(() => {
    if (!host) return

    const updateTasks: Record<string, () => void> = {}
    let frameId = 0
    let disposed = false

    const scene = new Scene()
    const camera = new PerspectiveCamera(75, 1, 0.1, 10000)
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

    const geometry = new BoxGeometry(0.1, 0.1, 0.1)
    const material = new MeshPhongMaterial()
    const mesh = new InstancedMesh(geometry, material, instanceData.length)
    const matrix = new Matrix4()

    for (let i = 0; i < instanceData.length; i++) {
      const inst = instanceData[i]
      matrix.setPosition(new Vector3(inst.tx, inst.ty, inst.tz))
      mesh.setMatrixAt(i, matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
    scene.add(mesh)

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
      geometry.dispose()
      material.dispose()
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
  }

  .champion :global(canvas) {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
