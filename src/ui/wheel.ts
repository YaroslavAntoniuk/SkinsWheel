// Canvas 2D wheel. The engine decides the result first; the wheel only
// animates to the segment it was told to land on.

export interface Segment {
  label: string;
  color: string;
  /** Relative width; segments are drawn proportional to it. */
  weight: number;
  image?: string;
}

const POINTER_ANGLE = -Math.PI / 2; // 12 o'clock
const FULL = Math.PI * 2;

const images = new Map<string, HTMLImageElement>();

export class Wheel {
  private readonly ctx: CanvasRenderingContext2D;
  private segments: Segment[] = [];
  private rotation = 0;
  private winner: number | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D is not available");
    this.ctx = ctx;
  }

  setSegments(segments: Segment[]): void {
    this.segments = segments;
    this.rotation = 0;
    this.winner = null;
    for (const seg of segments) if (seg.image) this.loadImage(seg.image);
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
    const offset = ((before + width * (0.2 + 0.6 * rng())) / total) * FULL;
    const turns = durationMs > 0 ? 5 : 0;
    const start = this.rotation % FULL;
    // The pointer is at rotation 0, so the wheel must end at −offset (mod 2π).
    const delta = (((-offset - start) % FULL) + FULL) % FULL;
    const end = start + delta + turns * FULL;
    this.winner = null;

    const land = () => {
      this.rotation = end;
      this.winner = index;
      this.draw();
    };

    if (durationMs === 0) {
      land();
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
        else {
          land();
          resolve();
        }
      };
      requestAnimationFrame(frame);
    });
  }

  private loadImage(src: string): void {
    if (images.has(src)) return;
    const img = new Image();
    img.decoding = "async";
    img.onload = () => this.draw();
    img.src = src;
    images.set(src, img);
  }

  private total(): number {
    return this.segments.reduce((s, x) => s + x.weight, 0);
  }

  private draw(): void {
    const { ctx, canvas } = this;
    const size = Math.min(canvas.width, canvas.height);
    const r = size / 2 - 10;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (this.segments.length === 0) return;

    const total = this.total();
    const many = this.segments.length > 24;
    let angle = POINTER_ANGLE + this.rotation;

    this.segments.forEach((seg, i) => {
      const sweep = (seg.weight / total) * FULL;
      const won = this.winner === i;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, angle, angle + sweep);
      ctx.closePath();
      ctx.fillStyle = shade(seg.color, i % 2 === 0 ? 0 : -0.18);
      ctx.fill();
      ctx.strokeStyle = won ? "#fff" : "#0b0d12";
      ctx.lineWidth = won ? 6 : 1.5;
      ctx.stroke();

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle + sweep / 2);

      // Picture near the rim, sized to the segment's arc.
      const img = seg.image ? images.get(seg.image) : undefined;
      const arc = sweep * r * 0.82;
      const imgSize = Math.min(arc * 1.6, size / 7);
      let textEnd = r - 14;
      if (img?.complete && img.naturalWidth > 0 && imgSize >= 26) {
        const h = imgSize * 0.75;
        ctx.save();
        ctx.translate(r * 0.86 - imgSize / 2, 0);
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(img, -imgSize / 2, -h / 2, imgSize, h);
        ctx.restore();
        textEnd = r * 0.86 - imgSize - 6;
      }

      const fontSize = Math.round(Math.max(11, Math.min(size / 30, sweep * r * 0.55)));
      ctx.fillStyle = "#fff";
      ctx.font = `700 ${fontSize}px system-ui, sans-serif`;
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,.85)";
      ctx.shadowBlur = 4;
      const text = fit(ctx, seg.label, textEnd - r * (many ? 0.2 : 0.18));
      // On the left half, turn the label over so it never reads upside down.
      if (Math.cos(angle + sweep / 2) < 0) {
        ctx.rotate(Math.PI);
        ctx.textAlign = "left";
        ctx.fillText(text, -textEnd, 0);
      } else {
        ctx.textAlign = "right";
        ctx.fillText(text, textEnd, 0);
      }
      ctx.restore();

      angle += sweep;
    });

    // Hub
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.14, 0, FULL);
    ctx.fillStyle = "#0b0d12";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#fff";
    ctx.stroke();

    // Pointer
    ctx.beginPath();
    ctx.moveTo(cx - 18, 0);
    ctx.lineTo(cx + 18, 0);
    ctx.lineTo(cx, 40);
    ctx.closePath();
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "rgba(0,0,0,.6)";
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

/** Shortens text with an ellipsis until it fits `maxWidth` pixels. */
function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut}…`;
}

/** Darkens (amount < 0) a #rrggbb colour so neighbouring segments of one rarity stay distinct. */
function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.round(Math.max(0, Math.min(255, v * (1 + amount))));
  return `rgb(${f((n >> 16) & 255)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}
