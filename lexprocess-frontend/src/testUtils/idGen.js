// Simple incremental ID generator for tests to avoid duplicate React keys
let current = 1;
export const nextId = () => current++;
export const resetIds = () => { current = 1; };
