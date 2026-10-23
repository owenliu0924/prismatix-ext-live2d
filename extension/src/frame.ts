// The seconds a frame.update event covers. The documented payload is
// {delta: "0.016667"}, but the Player at engine commit ae74e2b sends
// ["delta", "0.016667"] (its C++ builds the payload as an array), so
// ctx.frame.onUpdate and raw.onFrame hand every listener 0 and nothing
// animates. This reads both; see DEVELOPMENT_NOTES item 25.

export function frameDelta(payload: unknown): number {
  let value: unknown;
  if (Array.isArray(payload)) {
    const at = payload.indexOf("delta");
    value = at >= 0 ? payload[at + 1] : undefined;
  } else if (payload !== null && typeof payload === "object") {
    value = (payload as {delta?: unknown}).delta;
  }
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
}
