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

// The circuit SVG tiles at 80px. Grid-line positions are 40 + 80k
// (center of each tile, where the node dots and line segments sit).
const GRID_SIZE = 80;
const GRID_OFFSET = 40;

function rgba(alpha: number) {
  return `rgba(${BRAND.r},${BRAND.g},${BRAND.b},${alpha.toFixed(3)})`;
}

/** Return a random grid-line coordinate along the given axis length. */
function randomGridLine(axisLen: number): number {
  const count = Math.floor((axisLen - GRID_OFFSET) / GRID_SIZE) + 1;
  const idx = Math.floor(Math.random() * count);
  return GRID_OFFSET + idx * GRID_SIZE;
}

function spawnMeteor(w: number, h: number): Meteor {
  const horizontal = Math.random() < 0.5;
  const speed = 1.8 + Math.random() * 1.0;

  let x: number, y: number, vx: number, vy: number;

  if (horizontal) {
    // Travel left→right or right→left along a horizontal grid line
    y = randomGridLine(h);
    if (Math.random() < 0.5) {
      x = -CULL_MARGIN + 10;
      vx = speed;
    } else {
      x = w + CULL_MARGIN - 10;
      vx = -speed;
    }
    vy = 0;
  } else {
    // Travel top→bottom or bottom→top along a vertical grid line
    x = randomGridLine(w);
    if (Math.random() < 0.5) {
      y = -CULL_MARGIN + 10;
      vy = speed;
    } else {
      y = h + CULL_MARGIN - 10;
      vy = -speed;
    }
    vx = 0;
  }

  return {
    x,
    y,
    vx,
    vy,
    len: 60 + Math.random() * 60,
    age: 0,
    duration: 200 + Math.floor(Math.random() * 120),
  };
}

function lifeEnvelope(age: number, duration: number): number {
  const t = age / duration;
  if (t < 0.12) return t / 0.12;
  if (t > 0.78) return (1 - t) / 0.22;
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
        grad.addColorStop(1, rgba(life * 0.42));

        ctx.save();
        ctx.shadowColor = rgba(life * 0.35);
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
