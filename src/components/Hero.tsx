"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { Banner, Product } from "@/lib/types";

const VERT = `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position,1.0);}`;
const SHADERS = {
  splat: `precision highp float; uniform sampler2D uTarget; uniform float aspect,radius; uniform vec3 color; uniform vec2 point; varying vec2 vUv; void main(){vec2 d=vUv-point;d.x*=aspect;vec3 base=texture2D(uTarget,vUv).xyz;gl_FragColor=vec4(base+exp(-dot(d,d)/radius)*color,1.0);}`,
  advection: `precision highp float; uniform sampler2D uVelocity,uSource; uniform vec2 texel; uniform float dt,dissipation; varying vec2 vUv; void main(){vec2 coord=vUv-dt*texture2D(uVelocity,vUv).xy*texel;gl_FragColor=vec4(dissipation*texture2D(uSource,coord).rgb,1.0);}`,
  divergence: `precision highp float; uniform sampler2D uVelocity; uniform vec2 texel; varying vec2 vUv; vec2 vel(vec2 uv){vec2 s=vec2(1.0);if(uv.x<0.0){uv.x=0.0;s.x=-1.0;}if(uv.x>1.0){uv.x=1.0;s.x=-1.0;}if(uv.y<0.0){uv.y=0.0;s.y=-1.0;}if(uv.y>1.0){uv.y=1.0;s.y=-1.0;}return s*texture2D(uVelocity,uv).xy;} void main(){vec2 L=vUv-vec2(texel.x,0.0),R=vUv+vec2(texel.x,0.0),T=vUv+vec2(0.0,texel.y),B=vUv-vec2(0.0,texel.y);gl_FragColor=vec4(.5*(vel(R).x-vel(L).x+vel(T).y-vel(B).y),0.0,0.0,1.0);}`,
  curl: `precision highp float; uniform sampler2D uVelocity; uniform vec2 texel; varying vec2 vUv; void main(){vec2 L=vUv-vec2(texel.x,0.0),R=vUv+vec2(texel.x,0.0),T=vUv+vec2(0.0,texel.y),B=vUv-vec2(0.0,texel.y);gl_FragColor=vec4(texture2D(uVelocity,R).y-texture2D(uVelocity,L).y-texture2D(uVelocity,T).x+texture2D(uVelocity,B).x,0.0,0.0,1.0);}`,
  vorticity: `precision highp float; uniform sampler2D uVelocity,uCurl; uniform vec2 texel; uniform float strength,dt; varying vec2 vUv; void main(){vec2 L=vUv-vec2(texel.x,0.0),R=vUv+vec2(texel.x,0.0),T=vUv+vec2(0.0,texel.y),B=vUv-vec2(0.0,texel.y);vec2 f=normalize(vec2(abs(texture2D(uCurl,T).x)-abs(texture2D(uCurl,B).x),abs(texture2D(uCurl,R).x)-abs(texture2D(uCurl,L).x))+.0001)*strength*texture2D(uCurl,vUv).x;gl_FragColor=vec4(texture2D(uVelocity,vUv).xy+f*dt,0.0,1.0);}`,
  pressure: `precision highp float; uniform sampler2D uPressure,uDivergence; uniform vec2 texel; varying vec2 vUv; void main(){vec2 L=clamp(vUv-vec2(texel.x,0.0),0.0,1.0),R=clamp(vUv+vec2(texel.x,0.0),0.0,1.0),T=clamp(vUv+vec2(0.0,texel.y),0.0,1.0),B=clamp(vUv-vec2(0.0,texel.y),0.0,1.0);gl_FragColor=vec4((texture2D(uPressure,L).x+texture2D(uPressure,R).x+texture2D(uPressure,T).x+texture2D(uPressure,B).x-texture2D(uDivergence,vUv).x)*.25,0.0,0.0,1.0);}`,
  gradient: `precision highp float; uniform sampler2D uPressure,uVelocity; uniform vec2 texel; varying vec2 vUv; void main(){float pL=texture2D(uPressure,clamp(vUv-vec2(texel.x,0.0),0.0,1.0)).x,pR=texture2D(uPressure,clamp(vUv+vec2(texel.x,0.0),0.0,1.0)).x,pT=texture2D(uPressure,clamp(vUv+vec2(0.0,texel.y),0.0,1.0)).x,pB=texture2D(uPressure,clamp(vUv-vec2(0.0,texel.y),0.0,1.0)).x;gl_FragColor=vec4(texture2D(uVelocity,vUv).xy-vec2(pR-pL,pT-pB),0.0,1.0);}`,
  clear: `precision highp float; uniform sampler2D uTexture; uniform float value; varying vec2 vUv; void main(){gl_FragColor=value*texture2D(uTexture,vUv);}`,
  display: `precision highp float; uniform sampler2D uTexture; varying vec2 vUv; void main(){float d=clamp(length(texture2D(uTexture,vUv).rgb),0.0,1.0);float a=smoothstep(.055,.22,d);gl_FragColor=vec4(vec3(a),a);}`,
};

function FluidField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    if (!canvas || !root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false }); }
    catch { return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    const rect = root.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height, false);
    const dpr = renderer.getPixelRatio();
    let width = Math.max(1, rect.width * dpr);
    let height = Math.max(1, rect.height * dpr);
    const aspect = width / height;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    scene.add(quad);
    const opts = { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter } as const;
    const single = (w: number, h: number) => new THREE.WebGLRenderTarget(w, h, opts);
    const double = (w: number, h: number) => ({ read: single(w, h), write: single(w, h), swap() { [this.read, this.write] = [this.write, this.read]; } });
    const simW = 192, simH = Math.max(96, Math.round(simW / aspect));
    const dyeW = 768, dyeH = Math.max(256, Math.round(dyeW / aspect));
    const velocity = double(simW, simH);
    const dye = double(dyeW, dyeH);
    const pressure = double(simW, simH);
    const divergence = single(simW, simH);
    const curl = single(simW, simH);
    const simTexel = new THREE.Vector2(1 / simW, 1 / simH);
    const dyeTexel = new THREE.Vector2(1 / dyeW, 1 / dyeH);
    const uniform = (value: unknown = null) => ({ value });
    const material = (fragmentShader: string, uniforms: Record<string, { value: unknown }>) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader, uniforms, transparent: fragmentShader === SHADERS.display });
    const mats = {
      splat: material(SHADERS.splat, { uTarget: uniform(), aspect: uniform(aspect), radius: uniform(.007), color: uniform(new THREE.Vector3()), point: uniform(new THREE.Vector2()) }),
      advection: material(SHADERS.advection, { uVelocity: uniform(), uSource: uniform(), texel: uniform(), dt: uniform(), dissipation: uniform() }),
      divergence: material(SHADERS.divergence, { uVelocity: uniform(), texel: uniform(simTexel) }),
      curl: material(SHADERS.curl, { uVelocity: uniform(), texel: uniform(simTexel) }),
      vorticity: material(SHADERS.vorticity, { uVelocity: uniform(), uCurl: uniform(), texel: uniform(simTexel), strength: uniform(42), dt: uniform() }),
      pressure: material(SHADERS.pressure, { uPressure: uniform(), uDivergence: uniform(), texel: uniform(simTexel) }),
      gradient: material(SHADERS.gradient, { uPressure: uniform(), uVelocity: uniform(), texel: uniform(simTexel) }),
      clear: material(SHADERS.clear, { uTexture: uniform(), value: uniform(.78) }),
      display: material(SHADERS.display, { uTexture: uniform() }),
    };
    const set = (mat: THREE.ShaderMaterial, values: Record<string, unknown>) => { Object.entries(values).forEach(([key, value]) => { mat.uniforms[key].value = value; }); return mat; };
    const pass = (mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) => { quad.material = mat; renderer.setRenderTarget(target); renderer.render(scene, camera); };
    const pointer = { x: width * .5, y: height * .5, vx: 0, vy: 0, moved: false, active: false };
    const move = (clientX: number, clientY: number, real = true) => {
      const r = root.getBoundingClientRect();
      const x = (clientX - r.left) * dpr, y = (clientY - r.top) * dpr;
      pointer.vx = (x - pointer.x) * 7.5; pointer.vy = (y - pointer.y) * 7.5;
      pointer.x = x; pointer.y = y; pointer.moved = true; if (real) pointer.active = true;
    };
    const onPointer = (event: PointerEvent) => {
      const r = root.getBoundingClientRect();
      if (event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom) move(event.clientX, event.clientY);
    };
    window.addEventListener("pointermove", onPointer);
    const splat = () => {
      set(mats.splat, { point: new THREE.Vector2(pointer.x / width, 1 - pointer.y / height), aspect: width / height, radius: .007 });
      pass(set(mats.splat, { uTarget: velocity.read.texture, color: new THREE.Vector3(pointer.vx, -pointer.vy, 0) }), velocity.write); velocity.swap();
      pass(set(mats.splat, { uTarget: dye.read.texture, color: new THREE.Vector3(4, 4, 4) }), dye.write); dye.swap();
    };
    const simulate = (dt: number) => {
      pass(set(mats.curl, { uVelocity: velocity.read.texture }), curl);
      pass(set(mats.vorticity, { uVelocity: velocity.read.texture, uCurl: curl.texture, dt }), velocity.write); velocity.swap();
      pass(set(mats.divergence, { uVelocity: velocity.read.texture }), divergence);
      pass(set(mats.clear, { uTexture: pressure.read.texture }), pressure.write); pressure.swap();
      set(mats.pressure, { uDivergence: divergence.texture });
      for (let i = 0; i < 22; i += 1) { mats.pressure.uniforms.uPressure.value = pressure.read.texture; pass(mats.pressure, pressure.write); pressure.swap(); }
      pass(set(mats.gradient, { uPressure: pressure.read.texture, uVelocity: velocity.read.texture }), velocity.write); velocity.swap();
      pass(set(mats.advection, { uVelocity: velocity.read.texture, uSource: velocity.read.texture, texel: simTexel, dt, dissipation: .975 }), velocity.write); velocity.swap();
      pass(set(mats.advection, { uVelocity: velocity.read.texture, uSource: dye.read.texture, texel: dyeTexel, dt, dissipation: .982 }), dye.write); dye.swap();
    };
    let frame = 0, last = performance.now(), clock = 0;
    const loop = () => {
      const now = performance.now(), dt = Math.min((now - last) / 1000, .016);
      last = now; clock += dt;
      if (!pointer.active) { const r = root.getBoundingClientRect(); move(r.left + r.width * (.5 + .29 * Math.sin(clock * .52)), r.top + r.height * (.48 + .2 * Math.sin(clock * .91 + .8)), false); }
      if (pointer.moved) { splat(); pointer.moved = false; }
      simulate(dt); pass(set(mats.display, { uTexture: dye.read.texture }), null);
      frame = requestAnimationFrame(loop);
    };
    loop();
    const onResize = () => { const r = root.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); width = Math.max(1, r.width * dpr); height = Math.max(1, r.height * dpr); };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(frame); window.removeEventListener("pointermove", onPointer); window.removeEventListener("resize", onResize); renderer.dispose();
      [velocity, dye, pressure].forEach((target) => { target.read.dispose(); target.write.dispose(); });
      [divergence, curl].forEach((target) => target.dispose()); Object.values(mats).forEach((mat) => mat.dispose()); quad.geometry.dispose();
    };
  }, []);

  return <div className="fluid-field" ref={rootRef} aria-hidden="true"><canvas ref={canvasRef} /></div>;
}

export function Hero({ banner, product }: { banner?: Banner; product?: Product }) {
  const headline = banner?.headline?.trim() || "Art in motion";
  const words = headline.split(/\s+/);
  const lineOne = words.length > 2 ? words.slice(0, -1).join(" ") : words[0];
  const lineTwo = words.length > 2 ? words.at(-1) : words.slice(1).join(" ");
  const sub = banner?.sub || "Independent artwork. Limited releases. Made to be worn your way.";
  const cta = banner?.cta || "Explore the collection";
  const href = banner?.href || "/shop";

  return (
    <section className="fluid-hero" aria-labelledby="hero-title">
      <div className="hero-fluid-fallback" aria-hidden="true"><i /><i /><i /><i /></div>
      <FluidField />
      <div className="hero-grid" aria-hidden="true" />
      <div className="hero-orbit hero-orbit-one" aria-hidden="true" />
      <div className="hero-orbit hero-orbit-two" aria-hidden="true" />
      <div className="hero-copy">
        <p className="hero-kicker"><span>Independent label</span><span>India / Worldwide</span></p>
        <h1 id="hero-title"><span>{lineOne}</span>{lineTwo && <span className="hero-line-two">{lineTwo}</span>}</h1>
      </div>
      <div className="hero-bottom">
        <p>{sub}</p>
        <div className="hero-actions">
          <Link href={href} className="hero-cta"><span>{cta}</span><span aria-hidden>↗</span></Link>
          <Link href="/shop?tag=new" className="hero-text-link">New release <span aria-hidden>→</span></Link>
        </div>
      </div>
      <div className="hero-index" aria-hidden="true"><span>01</span><span>Move to make it yours</span><span>{product?.name || "Originals / 2026"}</span></div>
    </section>
  );
}
