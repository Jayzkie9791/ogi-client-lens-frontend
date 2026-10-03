import fs from "node:fs";

const requiredNode = "22.18.0";
const requiredNpm = "10.9.3";
const actualNode = process.versions.node;
const actualNpm = process.env.npm_config_user_agent?.match(/npm\/([^ ]+)/)?.[1] ?? null;
const nvmrc = fs.readFileSync(new URL("../../.nvmrc", import.meta.url), "utf8").trim();

if (actualNode !== requiredNode || nvmrc !== requiredNode) throw new Error(`CBH_TOOLCHAIN_MISMATCH: expected Node ${requiredNode}, received ${actualNode}, .nvmrc=${nvmrc}`);
if (actualNpm !== null && actualNpm !== requiredNpm) throw new Error(`CBH_TOOLCHAIN_MISMATCH: expected npm ${requiredNpm}, received ${actualNpm}`);
console.log(JSON.stringify({ status: "PASS", node: actualNode, npm: actualNpm ?? "NOT_PROVIDED", nvmrc }));
