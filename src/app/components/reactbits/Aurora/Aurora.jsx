import { Renderer, Program, Mesh, Color, Triangle } from 'ogl'
import { useEffect, useRef } from 'react'
import { useThemeTokens } from '@hooks/theme/useThemeTokens'
import { drawsInSoftware, webglAvailable } from '@utils/softwareRenderer'

const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`

const FRAG = `#version 300 es
precision highp float;

uniform float uTime;
uniform float uAmplitude;
uniform vec3 uColorStops[3];
uniform vec2 uResolution;
uniform float uBlend;

out vec4 fragColor;

vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec2 v){
  const vec4 C = vec4(
      0.211324865405187, 0.366025403784439,
      -0.577350269189626, 0.024390243902439
  );
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);

  vec3 p = permute(
      permute(i.y + vec3(0.0, i1.y, 1.0))
    + i.x + vec3(0.0, i1.x, 1.0)
  );

  vec3 m = max(
      0.5 - vec3(
          dot(x0, x0),
          dot(x12.xy, x12.xy),
          dot(x12.zw, x12.zw)
      ), 
      0.0
  );
  m = m * m;
  m = m * m;

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);

  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

struct ColorStop {
  vec3 color;
  float position;
};

#define COLOR_RAMP(colors, factor, finalColor) {              \
  int index = 0;                                            \
  for (int i = 0; i < 2; i++) {                               \
     ColorStop currentColor = colors[i];                    \
     bool isInBetween = currentColor.position <= factor;    \
     index = int(mix(float(index), float(i), float(isInBetween))); \
  }                                                         \
  ColorStop currentColor = colors[index];                   \
  ColorStop nextColor = colors[index + 1];                  \
  float range = nextColor.position - currentColor.position; \
  float lerpFactor = (factor - currentColor.position) / range; \
  finalColor = mix(currentColor.color, nextColor.color, lerpFactor); \
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  
  ColorStop colors[3];
  colors[0] = ColorStop(uColorStops[0], 0.0);
  colors[1] = ColorStop(uColorStops[1], 0.5);
  colors[2] = ColorStop(uColorStops[2], 1.0);
  
  vec3 rampColor;
  COLOR_RAMP(colors, uv.x, rampColor);
  
  float height = snoise(vec2(uv.x * 2.0 + uTime * 0.1, uTime * 0.25)) * 0.5 * uAmplitude;
  height = exp(height);
  height = (uv.y * 2.0 - height + 0.2);
  float intensity = 0.6 * height;
  
  float midPoint = 0.20;
  float auroraAlpha = smoothstep(midPoint - uBlend * 0.5, midPoint + uBlend * 0.5, intensity);
  
  vec3 auroraColor = intensity * rampColor;
  
  fragColor = vec4(auroraColor * auroraAlpha, auroraAlpha);
}
`

export default function Aurora(props) {
  const ctnDom = useRef(null)
  // The shader takes colour values, not CSS, so the accent steps are resolved
  // first - and resolved against the container rather than the document, so a
  // ramp drawn over a dark slab is the slab's ramp and one drawn over the field
  // is the field's.
  const tone = useThemeTokens(['--accent-lo', '--accent-hi', '--accent-loud'], ctnDom)
  const {
    colorStops = [tone['--accent-lo'], tone['--accent-loud'], tone['--accent-hi']],
    amplitude = 1.0,
    blend = 0.5,
  } = props
  const propsRef = useRef(props)
  propsRef.current = props

  useEffect(() => {
    const ctn = ctnDom.current
    if (!ctn) return

    // Same reading as the particle field: a browser that will not hand out a
    // context gets the wash left off rather than a renderer built around
    // nothing, which announces itself and then throws where the page can see
    // it.
    if (!webglAvailable()) return undefined

    let renderer
    try {
      renderer = new Renderer({
        alpha: true,
        premultipliedAlpha: true,
        antialias: true,
      })
    } catch {
      renderer = null
    }
    if (!renderer?.gl) return undefined
    const gl = renderer.gl
    const software = drawsInSoftware(gl)
    gl.clearColor(0, 0, 0, 0)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.canvas.style.backgroundColor = 'transparent'

    let program

    function resize() {
      if (!ctn) return
      const width = ctn.offsetWidth
      const height = ctn.offsetHeight
      renderer.setSize(width, height)
      if (program) {
        program.uniforms.uResolution.value = [width, height]
      }
    }
    window.addEventListener('resize', resize)

    const geometry = new Triangle(gl)
    if (geometry.attributes.uv) {
      delete geometry.attributes.uv
    }

    const colorStopsArray = colorStops.map(hex => {
      const c = new Color(hex)
      return [c.r, c.g, c.b]
    })

    program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uAmplitude: { value: amplitude },
        uColorStops: { value: colorStopsArray },
        uResolution: { value: [ctn.offsetWidth, ctn.offsetHeight] },
        uBlend: { value: blend },
      },
    })

    const mesh = new Mesh(gl, { geometry, program })
    ctn.appendChild(gl.canvas)

    // A shader that keeps drawing competes with every interaction for as long
    // as the visit lasts. It stops when the tab is hidden and when the wash has
    // been scrolled off, because nobody is reading it in either place, and it
    // never starts for a reader who has asked for less motion - who still gets
    // the wash, drawn once and left still.
    const still = window.matchMedia('(prefers-reduced-motion: reduce)')
    let onScreen = true
    let animateId = 0
    const running = () => !still.matches && !software && !document.hidden && onScreen
    const update = t => {
      if (running()) animateId = requestAnimationFrame(update)
      else animateId = 0
      const { time = t * 0.01, speed = 1.0 } = propsRef.current
      program.uniforms.uTime.value = time * speed * 0.1
      program.uniforms.uAmplitude.value = propsRef.current.amplitude ?? 1.0
      program.uniforms.uBlend.value = propsRef.current.blend ?? blend
      const stops = propsRef.current.colorStops ?? colorStops
      program.uniforms.uColorStops.value = stops.map(hex => {
        const c = new Color(hex)
        return [c.r, c.g, c.b]
      })
      renderer.render({ scene: mesh })
    }
    animateId = requestAnimationFrame(update)

    // Coming back to the tab, or scrolling the wash back into view, restarts it
    // from wherever it left off, and a reader who turns reduced motion off gets
    // the movement without a reload.
    const wake = () => {
      if (!animateId && running()) {
        animateId = requestAnimationFrame(update)
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
    watcher?.observe(ctn)

    resize()

    return () => {
      cancelAnimationFrame(animateId)
      watcher?.disconnect()
      document.removeEventListener('visibilitychange', wake)
      still.removeEventListener('change', wake)
      window.removeEventListener('resize', resize)
      if (ctn && gl.canvas.parentNode === ctn) {
        ctn.removeChild(gl.canvas)
      }
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amplitude])

  return <div ref={ctnDom} className="h-full w-full" />
}
