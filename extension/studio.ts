// Live2D (Cubism) for PrismatiX Studio: the Studio side. Games never include it.
//
// Studio loads dist/studio.js (bundled from this file by `prismatix extension
// build` and `pack`) in a sandboxed frame after each user allows it, with
// read access to the project only (studio.permissions). It adds:
//   - an inspector for *.model3.json (asset type live2d.model);
//   - the choices for the commands' dropdowns (parameterOptions): models,
//     motions, expressions, parameters, named in the manifest as
//     owenliu0924/live2d-cubism:<id>.
// The logic is in studio/model.ts (unit-tested); this file only wires it up.

import {ModelInspector} from "./studio/inspector.ts";
import {
  expressionChoices, inspectModel, modelChoices, motionChoices, parameterChoices, type ProjectReader,
} from "./studio/model.ts";
import type {Activate} from "./studio/sdk.ts";

export const activate: Activate = (studio) => {
  const project: ProjectReader = studio.project;

  studio.inspectors.register("live2d.model", {
    async mount(element, ctx) {
      const inspector = new ModelInspector(element, ctx.locale);
      mounted?.dispose();
      mounted = inspector;
      try {
        inspector.render(await inspectModel(project, ctx.asset.path));
      } catch (error) {
        inspector.fail(error);
      }
    },
    unmount() {
      mounted?.dispose();
      mounted = null;
    },
  });

  studio.parameterOptions.register("models", () => modelChoices(project));
  studio.parameterOptions.register("motions", (ctx) => motionChoices(project, ctx.parameters, ctx.locale));
  studio.parameterOptions.register("expressions", (ctx) => expressionChoices(project, ctx.parameters));
  studio.parameterOptions.register("parameters", (ctx) => parameterChoices(project, ctx.parameters));
};

let mounted: ModelInspector | null = null;
