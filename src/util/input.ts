import * as core from "@actions/core";
import type { Severity } from "../schemas/finding.js";

export function readInput(name: string, required = false): string {
  const fromCore = core.getInput(name);
  const normalized = name.replace(/[^A-Za-z0-9]/g, "_").toUpperCase();
  const fromEnv =
    process.env[`INPUT_${normalized}`] ||
    process.env[`TABBYGUARD_${normalized}`] ||
    "";
  const value = (fromCore || fromEnv).trim();
  if (required && !value)
    throw new Error(`Input required and not supplied: ${name}`);
  return value;
}

export function readBoolean(name: string, fallback: boolean): boolean {
  const value = readInput(name);
  if (!value) return fallback;
  if (["true", "1", "yes"].includes(value.toLowerCase())) return true;
  if (["false", "0", "no"].includes(value.toLowerCase())) return false;
  throw new Error(`${name} must be true or false`);
}

export function readMode(): "deterministic" | "assisted" {
  const value = readInput("mode") || "deterministic";
  if (value !== "deterministic" && value !== "assisted") {
    throw new Error("mode must be deterministic or assisted");
  }
  return value;
}

export function readFailOnSeverity(): "none" | Severity {
  const value = readInput("fail-on-severity") || "high";
  if (!["none", "critical", "high", "medium", "low"].includes(value)) {
    throw new Error(
      "fail-on-severity must be none, critical, high, medium, or low",
    );
  }
  return value as "none" | Severity;
}

export function readRoutes(): string[] {
  const raw = readInput("routes") || "/";
  return [
    ...new Set(
      raw
        .split(",")
        .map((route) => route.trim())
        .filter(Boolean),
    ),
  ];
}

export function readMaxChecks(): number {
  const raw = Number(readInput("max-checks") || "16");
  if (!Number.isInteger(raw) || raw < 1 || raw > 24)
    throw new Error("max-checks must be an integer from 1 to 24");
  return raw;
}
