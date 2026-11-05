import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { assertPluginCompatibility } from "@getpaseo/protocol/plugin-requirements";

const manifest = JSON.parse(readFileSync(new URL("../paseo-plugin.json", import.meta.url), "utf8"));
const check = (version: string) =>
  assertPluginCompatibility({ id: manifest.id, requirements: manifest.requirements, version, runtime: "app" });

test("manifest loads on every 0.x Paseo release from 0.14.0, including patches and prereleases", () => {
  for (const version of ["0.14.0", "0.15.0", "0.15.1", "0.16.0-beta.1", "0.99.9"]) {
    assert.doesNotThrow(() => check(version), version);
  }
});

test("manifest rejects Paseo before 0.14.0 and 1.0.0 onward", () => {
  for (const version of ["0.13.9", "1.0.0"]) {
    assert.throws(() => check(version), /requires Paseo/, version);
  }
});
