import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";
import { setup } from "../lib/setup";

// Mock @inquirer/prompts
vi.mock("@inquirer/prompts", () => ({
  checkbox: vi.fn().mockResolvedValue(["entry.publish", "entry.unpublish"]),
}));

// Mock child_process to avoid running npm install
vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

describe("setup", () => {
  let tempDir;
  const templatesDir = path.join(__dirname, "../templates");

  beforeAll(() => {
    // Create a temporary directory for the test project
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "strapi-test-"));
    console.log(`Testing in temp dir: ${tempDir}`);

    // Create a dummy src/index.ts to simulate a Strapi project
    const srcDir = path.join(tempDir, "src");
    fs.mkdirSync(srcDir, { recursive: true });

    const initialIndexTs = `
import type { Core } from '@strapi/strapi';

export default {
  register({ strapi }: { strapi: Core.Strapi }) {},
  bootstrap(/* { strapi }: { strapi: Core.Strapi } */) {},
};
`;
    fs.writeFileSync(path.join(srcDir, "index.ts"), initialIndexTs);
  });

  afterAll(() => {
    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should create necessary files and update index.ts", async () => {
    await setup(tempDir, templatesDir);

    // Check if files are created
    expect(fs.existsSync(path.join(tempDir, "src/config.ts"))).toBe(true);
    expect(
      fs.existsSync(path.join(tempDir, "src/util/get-github-auth.ts"))
    ).toBe(true);
    expect(
      fs.existsSync(path.join(tempDir, "src/util/set-up-github-webhook.ts"))
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(tempDir, "src/api/github/routes/trigger-pipeline.ts")
      )
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(tempDir, "src/api/github/controllers/trigger-pipeline.ts")
      )
    ).toBe(true);
    expect(fs.existsSync(path.join(tempDir, ".env"))).toBe(true);

    // Check if set-up-github-webhook.ts contains selected events
    const webhookFile = fs.readFileSync(
      path.join(tempDir, "src/util/set-up-github-webhook.ts"),
      "utf8"
    );
    expect(webhookFile).toContain(
      'events: ["entry.publish","entry.unpublish"]'
    );

    // Check if src/index.ts is updated
    const indexTs = fs.readFileSync(path.join(tempDir, "src/index.ts"), "utf8");
    expect(indexTs).toContain(
      'import { setUpGithubWebhook } from "./util/set-up-github-webhook";'
    );
    expect(indexTs).toContain(
      "async bootstrap({ strapi }: { strapi: Core.Strapi }) {"
    );
    expect(indexTs).toContain("await setUpGithubWebhook(strapi);");
  });
});
