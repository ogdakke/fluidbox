// A classic script, loaded first, so it hears the violations the parser causes.
window.cspViolations = [];
document.addEventListener("securitypolicyviolation", (event) => {
  window.cspViolations.push(
    `${event.effectiveDirective} ${event.blockedURI} ${event.sourceFile}:${event.lineNumber}`,
  );
});
