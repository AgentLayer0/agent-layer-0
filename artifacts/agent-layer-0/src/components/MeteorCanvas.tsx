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

function rgba(alpha: number) {
  return `rgba(${BRAND.r},${BRAND.g},${BRAND.b},${alpha.toFixed(3)})`;
}

function spawnMeteor(w: number, h: number): Meteor {
  const r = Math.random();
  const edge = r < 0.35 ? "top" : r < 0.55 ? "left" : r < 0.75 ? "right" : "bottom";
  let x: number, y: number, vx: number, vy: number;

  const speed = 1.6 + Math.random() * 1.2;
  const angle = (Math.PI / 4) * (0.6 + Math.random() * 0.8);

  if (edge === "top") {
    x = Math.random() * w;
    y = -10;
    vx = (Math.random() < 0.5 ? 1 : -1) * Math.cos(angle) * speed;
    vy = Math.sin(angle) * speed;
  } else if (edge === "left") {
    x = -10;
    y = Math.random() * h;
    vx = Math.cos(angle) * speed;
    vy = (Math.random() < 0.5 ? 1 : -1) * Math.sin(angle) * speed;
  } else if (edge === "right") {
    x = w + 10;
    y = Math.random() * h;
    vx = -Math.cos(angle) * speed;
    vy = (Math.random() < 0.5 ? 1 : -1) * Math.sin(angle) * speed;
  } else {
    x = Math.random() * w;
    y = h + 10;
    vx = (Math.random() < 0.5 ? 1 : -1) * Math.cos(angle) * speed;
    vy = -Math.sin(angle) * speed;
  }

  return {
    x,
    y,
    vx,
    vy,
    len: 70 + Math.random() * 60,
    age: 0,
    duration: 140 + Math.floor(Math.random() * 80),
  };
}

function lifeEnvelope(age: number, duration: number): number {
  const t = age / duration;
  if (t < 0.15) return t / 0.15;
  if (t > 0.75) return (1 - t) / 0.25;
  return 1;
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
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        m.age++;
        m.x += m.vx;
        m.y += m.vy;

        if (m.age >= m.duration) {
          meteors.splice(i, 1);
          continue;
        }

        const life = lifeEnvelope(m.age, m.duration);
        const tailX = m.x - (m.vx / Math.hypot(m.vx, m.vy)) * m.len;
        const tailY = m.y - (m.vy / Math.hypot(m.vx, m.vy)) * m.len;

        const grad = ctx.createLinearGradient(tailX, tailY, m.x, m.y);
        grad.addColorStop(0, rgba(0));
        grad.addColorStop(0.55, rgba(life * 0.22));
        grad.addColorStop(1, rgba(life * 0.5));

        ctx.save();
        ctx.shadowColor = rgba(life * 0.4);
        ctx.shadowBlur = 7;
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
        meteors.push(spawnMeteor(canvas.width, canvas.height));
      }
      if (meteors.length < MAX_METEORS && Math.random() < SPAWN_CHANCE) {
        meteors.push(spawnMeteor(canvas.width, canvas.height));
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
