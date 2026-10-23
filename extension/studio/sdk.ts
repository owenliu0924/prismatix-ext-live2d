// The types of @prismatix/studio-sdk, copied from PrismatiX Studio's
// packages/studio-sdk/index.d.ts (the package is private and not on npm yet).
// Types only: esbuild drops this module from dist/studio.js.

export type StudioLocale = "zh-TW" | "en";
export type StudioTheme = "light" | "dark";
export type StudioPermission = "project.read" | "project.write";

/** A file or folder in the project; `path` is project-relative with `/` separators. */
export interface ProjectEntry {
  name: string;
  path: string;
  kind: "file" | "directory";
  size: number;
}

/**
 * The open project. Paths are project-relative (`Assets/hero.model3.json`);
 * absolute paths, backslashes and `..` are rejected. A call the manifest has
 * no permission for rejects with an error that names the permission.
 */
export interface StudioProject {
  /** Needs `project.read`. */
  readFile(path: string): Promise<Uint8Array>;
  /** UTF-8 text. Needs `project.read`. */
  readText(path: string): Promise<string>;
  /** The entries of a folder (`""` is the project root). Needs `project.read`. */
  list(dir?: string): Promise<ProjectEntry[]>;
  /**
   * Creates or overwrites a file (and its folders). Needs `project.write`.
   * Refuses hidden files and folders, NativeUserFiles/, node_modules/,
   * package.json, executables and native libraries.
   */
  writeFile(path: string, data: string | Uint8Array | ArrayBuffer): Promise<void>;
}

export interface InspectorContext {
  /** The file being inspected. */
  readonly asset: {readonly path: string; readonly name: string};
  /** Needs `project.read`. */
  readFile(path: string): Promise<Uint8Array>;
  /** Needs `project.read`. */
  readText(path: string): Promise<string>;
  readonly locale: StudioLocale;
  /** Studio's current theme; the frame's `color-scheme` and `data-theme` follow it too. */
  readonly theme: StudioTheme;
  /** Called when Studio's theme changes; returns a function that stops listening. */
  onThemeChange(listener: (theme: StudioTheme) => void): () => void;
}

/** Draws one asset inside the Assets inspector, in a frame Studio sizes. */
export interface Inspector {
  mount(element: HTMLElement, ctx: InspectorContext): void | Promise<void>;
  unmount?(): void | Promise<void>;
}

export interface ParameterOption {
  value: string;
  label?: string;
}

export interface ParameterOptionsContext {
  /**
   * The other arguments of the command or Action being edited, by parameter
   * name: Story arguments as written (strings), button Action arguments as
   * values (a resource or token is its path or text).
   */
  readonly parameters: Readonly<Record<string, unknown>>;
  /** Needs `project.read`. */
  readFile(path: string): Promise<Uint8Array>;
  /** Needs `project.read`. */
  readText(path: string): Promise<string>;
  readonly locale: StudioLocale;
}

/** Options for a parameter whose manifest says `"optionsFrom": {"provider": "<extension id>:<id>"}`. */
export type ParameterOptionsProvider = (ctx: ParameterOptionsContext) =>
  readonly (ParameterOption | string)[] | Promise<readonly (ParameterOption | string)[]>;

export interface Disposable {
  dispose(): void;
}

export interface Studio {
  /** The running Studio's version. */
  readonly version: string;
  inspectors: {
    /** `assetType`: one of the manifest's `contributes.assetTypes[].id`, or `image`, `audio`, `video`, `font`, `text`. */
    register(assetType: string, inspector: Inspector): Disposable;
  };
  parameterOptions: {
    /** `id`: a `contributes.parameterOptions[].id` of the manifest (not qualified). */
    register(id: string, provider: ParameterOptionsProvider): Disposable;
  };
  project: StudioProject;
}

/** What the entry module exports. Errors it throws are shown in Studio's Extensions workspace. */
export type Activate = (studio: Studio) => void | Promise<void>;

