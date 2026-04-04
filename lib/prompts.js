"use strict";

const fs = require("fs");
const path = require("path");

const PROMPT_FILES = Object.freeze({
  build: "build.md",
  plan: "plan.md"
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
    COMPLETION_PROMISE: context.completionPromise
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

module.exports = {
  getCanonicalPromptTemplate,
  loadModePrompt,
  projectPromptPath,
  scaffoldProjectPrompts
};
