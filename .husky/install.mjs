// Skip Husky install in production and CI (no git / no dev deps there).
// Runs from the `prepare` script; importing husky only when we actually need it
// avoids the "husky: not found" crash when the package isn't installed.
if (process.env.NODE_ENV === "production" || process.env.CI === "true") {
  process.exit(0);
}
const husky = (await import("husky")).default;
console.log(husky());
