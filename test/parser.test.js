import { test } from "node:test";
import assert from "node:assert/strict";
import { parseStack } from "../src/parser.js";

test("parseStack returns array", () => {
  const s = parseStack();
  assert.ok(Array.isArray(s));
  assert.ok(s.length > 0);
});
