import {config} from '@salon/config'
import { Pool } from 'pg'


/**
 * A shared PostgreSQL connection pool.
 *
 * The pool manages database connections for the entire application.
 * Individual modules should never create their own pools.
 */

 export const pool = new Pool({
    connectionString : config.database.url,
 })