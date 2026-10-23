// Turns the drawables Core reports into raw meshes.
//
// A model has 100-300 drawables. Drawables that are drawn one after another
// with the same texture, blend mode and masks are merged into one mesh (a
// "run"), which keeps the mesh count (and the draw calls) low. Runs are rebuilt
// only when what is visible or its order changes. Everything that changed in a
// frame, runs and masks together, goes up in one `raw.upload` batch: one upload
// call however many meshes, applied all or nothing.
//
// Vertices arrive from the native bridge already in canvas pixels (see
// cubism_bridge.h), so placing the model on screen is a mesh `transform`:
// moving, scaling or mirroring it uploads nothing.
//
// Masks: a drawable may be clipped by several mask drawables, or by the
// inverse of them. Each mask drawable becomes a hidden mesh of its own (with
// its own texture page) and the clipped runs list them: the Player unites
// their coverage. A drawable with more than 16 masks keeps the first 16.

import {
  BLEND_ADDITIVE,
  BLEND_MULTIPLICATIVE,
  DYNAMIC_VISIBLE,
  INVERTED_MASK,
  VERTEX_FLOATS,
  type ModelDescription,
  type UpdateFrame,
} from "./protocol.ts";

// The slice of @prismatix/runtime/raw this file uses, so the renderer runs
// against a fake in tests and the real thing (structurally the same) in the Player.
export type RenderPhaseLike = "before-stage" | "after-stage" | "before-ui" | "after-ui";
export type BlendLike = "normal" | "additive" | "multiply";
export type TextureSourceLike =
  | {readonly kind: "asset"; readonly path: string}
  | {readonly kind: "texture"; readonly id: string}
  | {readonly kind: "target"; readonly id: string};

/** x' = a*x + c*y + tx, y' = b*x + d*y + ty. */
export interface AffineLike {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly tx: number;
  readonly ty: number;
}

export interface MeshOptionsLike {
  readonly phase?: RenderPhaseLike;
  readonly order?: number;
  readonly visible?: boolean;
  readonly route?: string;
  readonly texture?: TextureSourceLike | null;
  readonly blend?: BlendLike;
  readonly mask?: string | readonly string[] | null;
  readonly maskInverted?: boolean;
  readonly transform?: AffineLike | null;
}

export interface UploadPartLike {
  readonly mesh: string;
  readonly vertices?: Float32Array;
  readonly indices?: Uint16Array | Uint32Array;
}

export interface MeshLike {
  readonly id: string;
  update(options: MeshOptionsLike): boolean;
  destroy(): boolean;
}

export interface RawLike {
  createMesh(id: string, options?: MeshOptionsLike): MeshLike;
  /** Uploads to many meshes as one upload call, all or nothing. */
  upload(parts: readonly UploadPartLike[]): void;
  /** A packaged image as a mesh texture. */
  asset(path: string): TextureSourceLike;
}

export interface RendererOptions {
  /** Prefix of every mesh id this model creates; unique per model instance. */
  readonly name: string;
  readonly raw: RawLike;
  readonly description: ModelDescription;
  /** Texture sources by Cubism texture index (`raw.asset(path)`). */
  readonly textures: readonly TextureSourceLike[];
  readonly phase: RenderPhaseLike;
  /** Meshes of this model draw in [order, order + 1000). */
  readonly order: number;
  readonly route?: string;
  readonly warn: (message: string) => void;
}

/** A mesh's vertex limit is 65,536; stay under it so indices fit 16 bits. */
export const MAX_RUN_VERTICES = 60000;
/** The Player unites at most this many masks per mesh. */
export const MAX_MASKS = 16;

const IDENTITY: AffineLike = {a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0};

interface Piece {
  mesh: MeshLike;
  buffer: Float32Array;
  indices: Uint16Array;
  /** The mesh needs its vertices and indices (a new layout). */
  setup: boolean;
  /** A member has new vertices. */
  stale: boolean;
}

interface Run extends Piece {
  signature: string;
  members: number[];
  offsets: number[];
  options: MeshOptionsLike;
}

interface MaskMesh extends Piece {
  drawable: number;
  used: boolean;
}

export class ModelRenderer {
  private readonly options: RendererOptions;
  private readonly drawables: ModelDescription["drawables"];
  private readonly vertexData: Float32Array[];
  private readonly shown: boolean[];
  private readonly renderOrders: Int32Array;
  private readonly changed = new Set<number>();
  private readonly runs: Run[] = [];
  private readonly masks = new Map<number, MaskMesh>();
  /** Slot of the run each shown drawable is in. */
  private ownerRun = new Map<number, number>();
  private transform: AffineLike = IDENTITY;
  private structureDirty = true;
  private warnedMasks = false;
  /** Upload calls the last `apply` made: 0 or 1 (diagnostics, tests). */
  uploads = 0;

  constructor(options: RendererOptions) {
    this.options = options;
    this.drawables = options.description.drawables;
    this.vertexData = this.drawables.map((drawable) => new Float32Array(drawable.vc * VERTEX_FLOATS));
    this.shown = this.drawables.map(() => false);
    this.renderOrders = new Int32Array(this.drawables.length).fill(-1);
  }

  /** Where the model's canvas pixels land on screen; changing it uploads nothing. */
  setTransform(transform: AffineLike): void {
    if (this.transform.a === transform.a && this.transform.b === transform.b && this.transform.c === transform.c &&
        this.transform.d === transform.d && this.transform.tx === transform.tx && this.transform.ty === transform.ty) return;
    this.transform = transform;
    for (const run of this.runs) {
      run.options = {...run.options, transform};
      if (!run.setup) run.mesh.update({transform});
    }
    for (const mask of this.masks.values()) mask.mesh.update({transform});
  }

  /** Takes one update from Core, rebuilds what changed and uploads it. */
  apply(frame: UpdateFrame): void {
    this.changed.clear();
    for (let at = 0; at < this.drawables.length; at += 1) {
      const incoming = frame.vertices[at];
      if (incoming) {
        this.vertexData[at]!.set(incoming);
        this.changed.add(at);
      }
      const drawable = this.drawables[at]!;
      const alpha = drawable.vc > 0 ? this.vertexData[at]![7]! : 0;
      const shown = (frame.flags[at]! & DYNAMIC_VISIBLE) !== 0 && alpha > 0;
      if (shown !== this.shown[at] || frame.renderOrders[at] !== this.renderOrders[at]) this.structureDirty = true;
      this.shown[at] = shown;
      this.renderOrders[at] = frame.renderOrders[at]!;
    }
    if (this.structureDirty) this.layout();
    for (const at of this.changed) {
      const slot = this.ownerRun.get(at);
      if (slot !== undefined && !this.runs[slot]!.setup) this.runs[slot]!.stale = true;
      const mask = this.masks.get(at);
      if (mask && !mask.setup) mask.stale = true;
    }
    this.flush();
  }

  dispose(): void {
    for (const run of this.runs) run.mesh.destroy();
    this.runs.length = 0;
    for (const mask of this.masks.values()) mask.mesh.destroy();
    this.masks.clear();
    this.ownerRun.clear();
  }

  private blendOf(flags: number): BlendLike {
    return (flags & BLEND_ADDITIVE) !== 0 ? "additive" : (flags & BLEND_MULTIPLICATIVE) !== 0 ? "multiply" : "normal";
  }

  /** The drawables that clip drawable `at`, sorted and capped. */
  private masksOf(at: number): number[] {
    const wanted = [...this.drawables[at]!.masks].sort((a, b) => a - b);
    if (wanted.length > MAX_MASKS) {
      if (!this.warnedMasks) {
        this.warnedMasks = true;
        this.options.warn(`${this.options.name}: ${this.drawables[at]!.id} has ${wanted.length} masks; the Player unites ${MAX_MASKS}`);
      }
      wanted.length = MAX_MASKS;
    }
    return wanted;
  }

  /** Decides which drawables share which mesh; touches the raw API only to create and tune meshes. */
  private layout(): void {
    this.structureDirty = false;
    const order: number[] = [];
    for (let at = 0; at < this.drawables.length; at += 1) if (this.shown[at]) order.push(at);
    order.sort((a, b) => this.renderOrders[a]! - this.renderOrders[b]! || a - b);

    const plan: {key: string; masks: number[]; inverted: boolean; members: number[]; vertices: number}[] = [];
    for (const at of order) {
      const drawable = this.drawables[at]!;
      const masks = this.masksOf(at);
      const inverted = masks.length > 0 && (drawable.flags & INVERTED_MASK) !== 0;
      const key = `${drawable.texture}|${this.blendOf(drawable.flags)}|${masks.join(",")}|${inverted ? "i" : ""}`;
      const last = plan[plan.length - 1];
      if (last && last.key === key && last.vertices + drawable.vc <= MAX_RUN_VERTICES) {
        last.members.push(at);
        last.vertices += drawable.vc;
      } else {
        plan.push({key, masks, inverted, members: [at], vertices: drawable.vc});
      }
    }

    for (const mask of this.masks.values()) mask.used = false;
    this.ownerRun = new Map();
    plan.forEach((entry, slot) => {
      for (const at of entry.members) this.ownerRun.set(at, slot);
      const maskIds = entry.masks.map((at) => this.ensureMask(at));
      const signature = `${entry.key}:${entry.members.join(",")}`;
      const existing = this.runs[slot];
      if (existing && existing.signature === signature) return;

      const first = this.drawables[entry.members[0]!]!;
      const offsets: number[] = [];
      let vertexTotal = 0, indexTotal = 0;
      for (const at of entry.members) {
        offsets.push(vertexTotal * VERTEX_FLOATS);
        vertexTotal += this.drawables[at]!.vc;
        indexTotal += this.drawables[at]!.ic;
      }
      const indices = new Uint16Array(indexTotal);
      let written = 0, base = 0;
      for (const at of entry.members) {
        const source = this.options.description.indices[at]!;
        for (let k = 0; k < source.length; k += 1) indices[written++] = source[k]! + base;
        base += this.drawables[at]!.vc;
      }
      const mesh = existing?.mesh ?? this.options.raw.createMesh(`${this.options.name}.run${slot}`, {
        phase: this.options.phase, visible: false,
        ...(this.options.route === undefined ? {} : {route: this.options.route}),
      });
      this.runs[slot] = {
        mesh, signature, members: entry.members, offsets, buffer: new Float32Array(vertexTotal * VERTEX_FLOATS), indices,
        setup: true, stale: false,
        options: {
          visible: true, order: this.options.order + slot,
          texture: this.options.textures[first.texture] ?? null, blend: this.blendOf(first.flags),
          mask: maskIds.length === 0 ? null : maskIds, maskInverted: entry.inverted, transform: this.transform,
        },
      };
    });
    for (let slot = plan.length; slot < this.runs.length; slot += 1) {
      const stale = this.runs[slot]!;
      stale.mesh.update({visible: false});
      stale.signature = "";
      stale.members = [];
      stale.setup = stale.stale = false;
    }
    for (const [at, mask] of this.masks) {
      if (mask.used) continue;
      mask.mesh.destroy();
      this.masks.delete(at);
    }
  }

  /** The id of the hidden mesh that carries mask drawable `at`, creating it when new. */
  private ensureMask(at: number): string {
    let mask = this.masks.get(at);
    if (!mask) {
      const drawable = this.drawables[at]!;
      const mesh = this.options.raw.createMesh(`${this.options.name}.mask${at}`, {
        phase: this.options.phase, visible: false, texture: this.options.textures[drawable.texture] ?? null, blend: "normal",
        transform: this.transform, ...(this.options.route === undefined ? {} : {route: this.options.route}),
      });
      mask = {mesh, drawable: at, buffer: new Float32Array(drawable.vc * VERTEX_FLOATS), indices: this.options.description.indices[at]!,
        setup: true, stale: false, used: true};
      this.masks.set(at, mask);
    }
    mask.used = true;
    return mask.mesh.id;
  }

  /** Coverage of a mask is its texture alone, whatever the drawable's own opacity. */
  private fillMask(mask: MaskMesh): void {
    mask.buffer.set(this.vertexData[mask.drawable]!);
    for (let k = 7; k < mask.buffer.length; k += VERTEX_FLOATS) mask.buffer[k] = 1;
  }

  /** One batch for everything that changed. Flags clear only after the Player accepted it. */
  private flush(): void {
    this.uploads = 0;
    const parts: UploadPartLike[] = [];
    const sent: Piece[] = [];
    for (const mask of this.masks.values()) {
      if (!mask.setup && !mask.stale) continue;
      this.fillMask(mask);
      parts.push(mask.setup ? {mesh: mask.mesh.id, vertices: mask.buffer, indices: mask.indices} : {mesh: mask.mesh.id, vertices: mask.buffer});
      sent.push(mask);
    }
    for (const run of this.runs) {
      if (run.members.length === 0 || (!run.setup && !run.stale)) continue;
      run.members.forEach((at, slot) => run.buffer.set(this.vertexData[at]!, run.offsets[slot]!));
      if (run.setup) run.mesh.update(run.options);
      parts.push(run.setup ? {mesh: run.mesh.id, vertices: run.buffer, indices: run.indices} : {mesh: run.mesh.id, vertices: run.buffer});
      sent.push(run);
    }
    if (parts.length === 0) return;
    this.options.raw.upload(parts);
    this.uploads = 1;
    for (const piece of sent) piece.setup = piece.stale = false;
  }
}
