// Silence specific noisy warnings in test environment (React Router future flags already enabled)
if (typeof window !== 'undefined') {
  const originalError = console.error;
  const originalWarn = console.warn;
  const SUPPRESS_PATTERNS = [
    /An update to .* inside a test was not wrapped in act/,
    /A suspended resource finished loading inside a test, but the event was not wrapped in act/,
    /The current testing environment is not configured to support act/,
    /React Router Future Flag Warning/,
  ];
  const shouldSuppress = (args) => SUPPRESS_PATTERNS.some((re) => args.some(a => typeof a === 'string' && re.test(a)));
  console.error = (...args) => {
    if (shouldSuppress(args)) return;
    originalError(...args);
  };
  console.warn = (...args) => {
    if (shouldSuppress(args)) return;
    originalWarn(...args);
  };
}
