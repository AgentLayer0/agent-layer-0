import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

interface Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  len: number;
  age: number;
  duration: number;
}

const BRAND = { r: 232, g: 84, b: 28 };
const MIN_METEORS = 3;
const MAX_METEORS = 5;
const SPAWN_CHANCE = 0.012;
const CULL_MARGIN = 200;

function rgba(alpha: number) {
  return `rgba(${BRAND.r},${BRAND.g},${BRAND.b},${alpha.toFixed(3)})`;
}

function spawnMeteor(w: number, h: number): Meteor {
  const r = Math.random();
  const edge = r < 0.35 ? "top" : r < 0.55 ? "left" : r < 0.75 ? "right" : "bottom";

  const speed = 1.8 + Math.random() * 1.0;
  const driftAngle = Math.PI / 6 + Math.random() * (Math.PI / 6);

  let x: number, y: number, vx: number, vy: number;

  if (edge === "top") {
    x = Math.random() * w;
    y = -10;
    vx = (Math.random() < 0.5 ? 1 : -1) * Math.sin(driftAngle) * speed;
    vy = Math.cos(driftAngle) * speed;
  } else if (edge === "bottom") {
    x = Math.random() * w;
    y = h + 10;
    vx = (Math.random() < 0.5 ? 1 : -1) * Math.sin(driftAngle) * speed;
    vy = -Math.cos(driftAngle) * speed;
  } else if (edge === "left") {
    x = -10;
    y = Math.random() * h;
    vx = Math.cos(driftAngle) * speed;
    vy = (Math.random() < 0.75 ? 1 : -1) * Math.sin(driftAngle) * speed;
  } else {
    x = w + 10;
    y = Math.random() * h;
    vx = -Math.cos(driftAngle) * speed;
    vy = (Math.random() < 0.75 ? 1 : -1) * Math.sin(driftAngle) * speed;
  }

  return {
    x,
    y,
    vx,
    vy,
    len: 70 + Math.random() * 60,
    age: 0,
    duration: 160 + Math.floor(Math.random() * 80),
  };
}

function lifeEnvelope(age: number, duration: number): number {
  const t = age / duration;
  if (t < 0.15) return t / 0.15;
  if (t > 0.75) return (1 - t) / 0.25;
  return 1;
}

function isOutOfBounds(m: Meteor, w: number, h: number): boolean {
  return (
    m.x < -CULL_MARGIN ||
    m.x > w + CULL_MARGIN ||
    m.y < -CULL_MARGIN ||
    m.y > h + CULL_MARGIN
  );
}

export function MeteorCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shouldReduce = useReducedMotion();

  useEffect(() => {
    if (shouldReduce) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId: number;
    const meteors: Meteor[] = [];

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    function frame() {
      if (!canvas || !ctx) return;
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        m.age++;
        m.x += m.vx;
        m.y += m.vy;

        if (m.age >= m.duration || isOutOfBounds(m, w, h)) {
          meteors.splice(i, 1);
          continue;
        }

        const life = lifeEnvelope(m.age, m.duration);
        const speed = Math.hypot(m.vx, m.vy);
        const tailX = m.x - (m.vx / speed) * m.len;
        const tailY = m.y - (m.vy / speed) * m.len;

        const grad = ctx.createLinearGradient(tailX, tailY, m.x, m.y);
        grad.addColorStop(0, rgba(0));
        grad.addColorStop(0.5, rgba(life * 0.18));
        grad.addColorStop(1, rgba(life * 0.4));

        ctx.save();
        ctx.shadowColor = rgba(life * 0.35);
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(m.x, m.y);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.lineCap = "round";
        ctx.stroke();
        ctx.restore();
      }

      while (meteors.length < MIN_METEORS) {
        meteors.push(spawnMeteor(w, h));
      }
      if (meteors.length < MAX_METEORS && Math.random() < SPAWN_CHANCE) {
        meteors.push(spawnMeteor(w, h));
      }

      rafId = requestAnimationFrame(frame);
    }

    for (let i = 0; i < MIN_METEORS; i++) {
      meteors.push(spawnMeteor(canvas.width, canvas.height));
    }
    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    };
  }, [shouldReduce]);

  if (shouldReduce) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        pointerEvents: "none",
      }}
    />
  );
}
