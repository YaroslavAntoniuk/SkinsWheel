// Canvas 2D wheel. The engine decides the result first; the wheel only
// animates to the segment it was told to land on.

export interface Segment {
  label: string;
  color: string;
  /** Relative width; segments are drawn proportional to it. */
  weight: number;
}

const POINTER_ANGLE = -Math.PI / 2; // 12 o'clock

export class Wheel {
  private readonly ctx: CanvasRenderingContext2D;
  private segments: Segment[] = [];
  private rotation = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D is not available");
    this.ctx = ctx;
  }

  setSegments(segments: Segment[]): void {
    this.segments = segments;
    this.rotation = 0;
    this.draw();
  }

  /**
   * Spins to land inside segment `index`, away from its edges, and resolves
   * when the wheel stops. `rng` only picks where inside the segment to stop.
   */
  spinTo(index: number, rng: () => number, durationMs: number): Promise<void> {
    const total = this.total();
    const before = this.segments.slice(0, index).reduce((s, x) => s + x.weight, 0);
    const width = this.segments[index]!.weight;
    // Stop between 20% and 80% of the segment so the pointer never sits on a border.
    const offset = ((before + width * (0.2 + 0.6 * rng())) / total) * Math.PI * 2;
    const full = Math.PI * 2;
    const turns = durationMs > 0 ? 5 : 0;
    const start = this.rotation % full;
    // The pointer is at rotation 0, so the wheel must end at −offset (mod 2π).
    const delta = (((-offset - start) % full) + full) % full;
    const end = start + delta + turns * full;

    if (durationMs === 0) {
      this.rotation = end;
      this.draw();
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const t0 = performance.now();
      const frame = (now: number) => {
        const t = Math.min(1, (now - t0) / durationMs);
        const eased = 1 - Math.pow(1 - t, 4);
        this.rotation = start + (end - start) * eased;
        this.draw();
        if (t < 1) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });
  }

  private total(): number {
    return this.segments.reduce((s, x) => s + x.weight, 0);
  }

  private draw(): void {
    const { ctx, canvas } = this;
    const size = Math.min(canvas.width, canvas.height);
    const r = size / 2 - 8;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const total = this.total();
    let angle = POINTER_ANGLE + this.rotation;
    for (const seg of this.segments) {
      const sweep = (seg.weight / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, angle, angle + sweep);
      ctx.closePath();
      ctx.fillStyle = seg.color;
      ctx.fill();
      ctx.strokeStyle = "#0b0d12";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle + sweep / 2);
      ctx.fillStyle = "#fff";
      ctx.font = `600 ${Math.round(size / 34)}px system-ui, sans-serif`;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,.7)";
      ctx.shadowBlur = 4;
      ctx.fillText(truncate(seg.label, 24), r - 14, 0);
      ctx.restore();

      angle += sweep;
    }

    // Pointer
    ctx.beginPath();
    ctx.moveTo(cx - 14, 2);
    ctx.lineTo(cx + 14, 2);
    ctx.lineTo(cx, 30);
    ctx.closePath();
    ctx.fillStyle = "#fff";
    ctx.fill();
  }
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
