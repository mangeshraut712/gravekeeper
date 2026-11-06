import upstream from "../../../third_party/esrever/upstream/esrever.js";
import { reverse } from "./reverse.mts";

/** Both implementations run locally; no user text is sent to a server. */
export function compareVersions(input: string) {
  if (typeof input !== "string") throw new TypeError("Expected a string.");
  if (input.length > 512) throw new RangeError("Use at most 512 UTF-16 code units.");
  return { input, before: upstream.reverse(input) as string, after: reverse(input) };
}
