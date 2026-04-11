import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROMPT_FILES = Object.freeze({
  build: "build.md",
  plan: "plan.md",
  sync: "sync.md"
});

function assertMode(mode) {
  if (!PROMPT_FILES[mode]) {
    throw new Error(`Unsupported prompt mode: ${mode}`);
  }
}

function canonicalPromptPath(mode) {
  assertMode(mode);
  return path.join(__dirname, "..", "prompts", PROMPT_FILES[mode]);
}

function projectPromptPath(configDir, mode) {
  assertMode(mode);
  return path.join(configDir, "prompts", PROMPT_FILES[mode]);
}

function getCanonicalPromptTemplate(mode) {
  return fs.readFileSync(canonicalPromptPath(mode), "utf8");
}

function renderPromptTemplate(template, context) {
  const replacements = {
    WORKDIR: context.workdir,
    SPECS_GLOB: context.specsGlob,
    PLAN_FILE: context.planFile,
    COMPLETION_PROMISE: context.completionPromise,
    OPERATOR_INSTRUCT_FILE: context.operatorInstructFile,
    LOG_DIR: context.logDir
  };

  return template.replace(/\{\{\s*([A-Z_]+)\s*\}\}/g, (match, token) => {
    if (Object.prototype.hasOwnProperty.call(replacements, token)) {
      return replacements[token];
    }
    return match;
  });
}

function scaffoldProjectPrompts(configDir) {
  const promptsDir = path.join(configDir, "prompts");
  fs.mkdirSync(promptsDir, { recursive: true });

  for (const mode of Object.keys(PROMPT_FILES)) {
    const targetPath = projectPromptPath(configDir, mode);
    if (!fs.existsSync(targetPath)) {
      fs.writeFileSync(targetPath, getCanonicalPromptTemplate(mode), "utf8");
    }
  }
}

function loadModePrompt(configDir, mode, context) {
  const promptPath = projectPromptPath(configDir, mode);
  const template = fs.existsSync(promptPath)
    ? fs.readFileSync(promptPath, "utf8")
    : getCanonicalPromptTemplate(mode);
  return renderPromptTemplate(template, context);
}


function buildRuntimePrompt(mode, context, modePrompt, modePromptPath) {
  return `Ralph runtime context:
- Mode: ${mode}
- Work dir: ${context.workdir}
- Specs path: ${context.specsGlob}
- Plan path: ${context.planFile}
- Plan update path: ${context.planFile}
- Operator instructions path: ${context.operatorInstructFile}
- Log dir: ${context.logDir}
- Prompt file: ${modePromptPath}
- Completion rule: final non-empty output line must exactly match ${context.completionPromise}

${modePrompt}
`;
}

export {
  getCanonicalPromptTemplate,
  loadModePrompt,
  projectPromptPath,
  scaffoldProjectPrompts,
  buildRuntimePrompt,
};
