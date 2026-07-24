/*
 The public APIOnly exports:
 
 export { config };
 
 Everything else remains private.
 
 types.ts
 
 Only exists if we need to export types later.
 
 We won't create unnecessary abstractions.
 
 If it stays empty, we'll delete it.
 */

export { config } from "./config.js";