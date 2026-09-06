import { useEffect, useRef } from 'react'
import { Renderer, Camera, Geometry, Program, Mesh } from 'ogl'
import { useThemeTokens } from '@hooks/useThemeTokens'
import { drawsInSoftware, webglAvailable } from '@utils/softwareRenderer'

const hexToRgb = hex => {
  hex = hex.replace(/^#/, '')
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map(c => c + c)
      .join('')
  }
  const int = parseInt(hex, 16)
  const r = ((int >> 16) & 255) / 255
  const g = ((int >> 8) & 255) / 255
  const b = (int & 255) / 255
  return [r, g, b]
}

const vertex = /* glsl */ `
  attribute vec3 position;
  attribute vec4 random;
  attribute vec3 color;
  
  uniform mat4 modelMatrix;
  uniform mat4 viewMatrix;
  uniform mat4 projectionMatrix;
  uniform float uTime;
  uniform float uSpread;
  uniform float uBaseSize;
  uniform float uSizeRandomness;
  
  varying vec4 vRandom;
  varying vec3 vColor;
  
  void main() {
    vRandom = random;
    vColor = color;
    
    vec3 pos = position * uSpread;
    pos.z *= 10.0;
    
    vec4 mPos = modelMatrix * vec4(pos, 1.0);
    float t = uTime;
    mPos.x += sin(t * random.z + 6.28 * random.w) * mix(0.1, 1.5, random.x);
    mPos.y += sin(t * random.y + 6.28 * random.x) * mix(0.1, 1.5, random.w);
    mPos.z += sin(t * random.w + 6.28 * random.y) * mix(0.1, 1.5, random.z);
    
    vec4 mvPos = viewMatrix * mPos;

    if (uSizeRandomness == 0.0) {
      gl_PointSize = uBaseSize;
    } else {
      gl_PointSize = (uBaseSize * (1.0 + uSizeRandomness * (random.x - 0.5))) / length(mvPos.xyz);
    }

    gl_Position = projectionMatrix * mvPos;
  }
`

const fragment = /* glsl */ `
  precision highp float;
  
  uniform float uTime;
  uniform float uAlphaParticles;
  varying vec4 vRandom;
  varying vec3 vColor;
  
  void main() {
    vec2 uv = gl_PointCoord.xy;
    float d = length(uv - vec2(0.5));
    
    if(uAlphaParticles < 0.5) {
      if(d > 0.5) {
        discard;
      }
      gl_FragColor = vec4(vColor + 0.2 * sin(uv.yxx + uTime + vRandom.y * 6.28), 1.0);
    } else {
      float circle = smoothstep(0.5, 0.4, d) * 0.8;
      gl_FragColor = vec4(vColor + 0.2 * sin(uv.yxx + uTime + vRandom.y * 6.28), circle);
    }
  }
`

const Particles = ({
  particleCount = 200,
  particleSpread = 10,
  speed = 0.1,
  particleColors,
  moveParticlesOnHover = false,
  particleHoverFactor = 1,
  alphaParticles = false,
  particleBaseSize = 100,
  sizeRandomness = 1,
  cameraDistance = 20,
  disableRotation = false,
  pixelRatio = 1,
  className,
}) => {
  const tone = useThemeTokens(['--ink'])
  const containerRef = useRef(null)
  const mouseRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // The field is decoration over a ground that is already drawn, so where
    // there is no context to draw it in there is nothing to replace and nothing
    // to say: the section keeps its grid and its wash and the reader is none
    // the wiser. Asking anyway is what turns a machine without WebGL into a
    // broken page rather than a plainer one.
    if (!webglAvailable()) return undefined

    let renderer
    try {
      renderer = new Renderer({
        dpr: pixelRatio,
        depth: false,
        alpha: true,
      })
    } catch {
      renderer = null
    }
    if (!renderer?.gl) return undefined
    const gl = renderer.gl
    const software = drawsInSoftware(gl)
    container.appendChild(gl.canvas)
    gl.clearColor(0, 0, 0, 0)

    const camera = new Camera(gl, { fov: 15 })
    camera.position.set(0, 0, cameraDistance)

    const resize = () => {
      const width = container.clientWidth
      const height = container.clientHeight
      renderer.setSize(width, height)
      camera.perspective({ aspect: gl.canvas.width / gl.canvas.height })
    }
    window.addEventListener('resize', resize, false)
    resize()

    const handleMouseMove = e => {
      const rect = container.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1)
      mouseRef.current = { x, y }
    }

    if (moveParticlesOnHover) {
      container.addEventListener('mousemove', handleMouseMove)
    }

    const count = particleCount
    const positions = new Float32Array(count * 3)
    const randoms = new Float32Array(count * 4)
    const colors = new Float32Array(count * 3)
    const palette = particleColors && particleColors.length > 0 ? particleColors : [tone['--ink']]

    for (let i = 0; i < count; i++) {
      let x, y, z, len
      do {
        x = Math.random() * 2 - 1
        y = Math.random() * 2 - 1
        z = Math.random() * 2 - 1
        len = x * x + y * y + z * z
      } while (len > 1 || len === 0)
      const r = Math.cbrt(Math.random())
      positions.set([x * r, y * r, z * r], i * 3)
      randoms.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4)
      const col = hexToRgb(palette[Math.floor(Math.random() * palette.length)])
      colors.set(col, i * 3)
    }

    const geometry = new Geometry(gl, {
      position: { size: 3, data: positions },
      random: { size: 4, data: randoms },
      color: { size: 3, data: colors },
    })

    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        uTime: { value: 0 },
        uSpread: { value: particleSpread },
        uBaseSize: { value: particleBaseSize * pixelRatio },
        uSizeRandomness: { value: sizeRandomness },
        uAlphaParticles: { value: alphaParticles ? 1 : 0 },
      },
      transparent: true,
      depthTest: false,
    })

    const particles = new Mesh(gl, { mode: gl.POINTS, geometry, program })

    // A field that keeps drawing behind the page competes with every
    // interaction for as long as the visit lasts. It stops when the tab is
    // hidden and when the field has been scrolled off, because nobody is
    // reading it in either place, and it never starts for a reader who has
    // asked for less motion - who still gets the field, drawn once and left
    // still.
    const still = window.matchMedia('(prefers-reduced-motion: reduce)')
    let onScreen = true
    let animationFrameId
    let lastTime = performance.now()
    let elapsed = 0

    const running = () => !still.matches && !software && !document.hidden && onScreen
    const update = t => {
      if (running()) animationFrameId = requestAnimationFrame(update)
      else animationFrameId = 0
      const delta = t - lastTime
      lastTime = t
      elapsed += delta * speed

      program.uniforms.uTime.value = elapsed * 0.001

      if (moveParticlesOnHover) {
        particles.position.x = -mouseRef.current.x * particleHoverFactor
        particles.position.y = -mouseRef.current.y * particleHoverFactor
      } else {
        particles.position.x = 0
        particles.position.y = 0
      }

      if (!disableRotation) {
        particles.rotation.x = Math.sin(elapsed * 0.0002) * 0.1
        particles.rotation.y = Math.cos(elapsed * 0.0005) * 0.15
        particles.rotation.z += 0.01 * speed
      }

      renderer.render({ scene: particles, camera })
    }

    animationFrameId = requestAnimationFrame(update)

    // Coming back to the tab, or scrolling the field back into view, restarts
    // it from wherever it left off, and a reader who turns reduced motion off
    // gets the movement without a reload.
    const wake = () => {
      if (!animationFrameId && running()) {
        lastTime = performance.now()
        animationFrameId = requestAnimationFrame(update)
      }
    }
    document.addEventListener('visibilitychange', wake)
    still.addEventListener('change', wake)

    const watcher =
      typeof IntersectionObserver === 'function'
        ? new IntersectionObserver(([entry]) => {
            onScreen = entry.isIntersecting
            wake()
          })
        : null
    watcher?.observe(container)

    return () => {
      window.removeEventListener('resize', resize)
      watcher?.disconnect()
      document.removeEventListener('visibilitychange', wake)
      still.removeEventListener('change', wake)
      if (moveParticlesOnHover) {
        container.removeEventListener('mousemove', handleMouseMove)
      }
      cancelAnimationFrame(animationFrameId)
      if (container.contains(gl.canvas)) {
        container.removeChild(gl.canvas)
      }
      // Release the WebGL context explicitly. Browsers cap the number of live
      // contexts (~16); without this, every navigation to a page with this
      // background leaks one until the browser force-drops the oldest — which
      // can surface as a lost-context error on a later page.
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    particleCount,
    particleSpread,
    speed,
    moveParticlesOnHover,
    particleHoverFactor,
    alphaParticles,
    particleBaseSize,
    sizeRandomness,
    cameraDistance,
    disableRotation,
    pixelRatio,
  ])

  return <div ref={containerRef} className={`relative h-full w-full ${className}`} />
}

export default Particles
