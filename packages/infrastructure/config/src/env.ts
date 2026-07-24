/*
Responsibility of this file is to:  
Load environment variables and Nothing else.

It should:
Load .env
Expose raw environment values

It should not:
Validate
Parse
Build configuration
*/


import { config as loadEnv } from 'dotenv';

loadEnv();

export const env = process.env;