/**
 * @jest-environment node
 */
import fs from "fs";
import path from "path";
import { isHosstedEnabledForTenant } from "../hossted-tenants";

describe("shipped default", () => {
  it("leaves HOSSTED_ENABLED_TENANTS empty in the committed .env, which the standalone image ships", () => {
    const envFile = fs.readFileSync(
      path.join(__dirname, "../../../../../.env"),
      "utf8"
    );
    const line = envFile
      .split("\n")
      .find((entry) => entry.startsWith("HOSSTED_ENABLED_TENANTS="));
    expect(line).toBe("HOSSTED_ENABLED_TENANTS=");
  });
});

describe("isHosstedEnabledForTenant", () => {
  let saved: string | undefined;

  beforeEach(() => {
    saved = process.env.HOSSTED_ENABLED_TENANTS;
  });

  afterEach(() => {
    if (saved === undefined) {
      delete process.env.HOSSTED_ENABLED_TENANTS;
    } else {
      process.env.HOSSTED_ENABLED_TENANTS = saved;
    }
  });

  it("is off when the setting is unset", () => {
    delete process.env.HOSSTED_ENABLED_TENANTS;
    expect(isHosstedEnabledForTenant("keep")).toBe(false);
  });

  it("is off when the setting is empty", () => {
    process.env.HOSSTED_ENABLED_TENANTS = "";
    expect(isHosstedEnabledForTenant("keep")).toBe(false);
  });

  it("is off for every tenant when the setting is only spaces and commas", () => {
    process.env.HOSSTED_ENABLED_TENANTS = " , ";
    expect(isHosstedEnabledForTenant("keep")).toBe(false);
    expect(isHosstedEnabledForTenant("")).toBe(false);
  });

  it("matches a single listed tenant only", () => {
    process.env.HOSSTED_ENABLED_TENANTS = "keep";
    expect(isHosstedEnabledForTenant("keep")).toBe(true);
    expect(isHosstedEnabledForTenant("other")).toBe(false);
  });

  it("trims entries and ignores empty ones", () => {
    process.env.HOSSTED_ENABLED_TENANTS =
      " keep , ,3f1c9a2e-0000-4000-8000-000000000001, ";
    expect(isHosstedEnabledForTenant("keep")).toBe(true);
    expect(
      isHosstedEnabledForTenant("3f1c9a2e-0000-4000-8000-000000000001")
    ).toBe(true);
    expect(isHosstedEnabledForTenant("")).toBe(false);
  });

  it("matches case-sensitively", () => {
    process.env.HOSSTED_ENABLED_TENANTS = "Keep";
    expect(isHosstedEnabledForTenant("keep")).toBe(false);
  });

  it("is off for a missing tenant id", () => {
    process.env.HOSSTED_ENABLED_TENANTS = "keep";
    expect(isHosstedEnabledForTenant(undefined)).toBe(false);
    expect(isHosstedEnabledForTenant(null)).toBe(false);
  });

  it("reads the setting on every call", () => {
    process.env.HOSSTED_ENABLED_TENANTS = "tenant-a";
    expect(isHosstedEnabledForTenant("tenant-a")).toBe(true);
    process.env.HOSSTED_ENABLED_TENANTS = "tenant-b";
    expect(isHosstedEnabledForTenant("tenant-a")).toBe(false);
    expect(isHosstedEnabledForTenant("tenant-b")).toBe(true);
  });
});
