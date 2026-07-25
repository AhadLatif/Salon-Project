/**
 * @Responsibility of this file is to:  
 * Load environment variables and Nothing else.
It should:
Load .env
Expose raw environment values

It should not:
Validate
Parse
Build configuration
*/


import { config as loadEnv } from 'dotenv'
import { expand } from 'dotenv-expand'

import path from 'node:path'

expand(loadEnv({
  path: path.resolve(process.cwd(), '../../.env'),
  override: false  // don't override vars already set by the shell/CI
}))