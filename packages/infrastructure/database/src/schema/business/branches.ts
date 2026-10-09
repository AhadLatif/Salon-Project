import { sql } from 'drizzle-orm';
import {
  boolean,
  char,
  check,
  customType,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { generateId, helperTimeStamp } from '../shared/index.js';
import { businesses } from './businesses.js'; // Adjust path as needed

/**
 * PostGIS `geography(Point,4326)` custom column definition.
 *
 * Technical Details:
 * Drizzle ORM does not provide a native PostGIS geography type. Defining a custom type
 * mapping to PostgreSQL's `geography(Point,4326)` enables spherical calculations (e.g. radius
 * and distance queries in meters) using the WGS84 coordinate reference system.
 *
 * Values are read by the driver as WKB hex strings and written using PostGIS spatial functions
 * in the branch repository.
 */
export const geographyPoint = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'geography(Point,4326)';
  },
});

export const branchStatusEnum = pgEnum('branch_status', ['active', 'inactive', 'archived']);

export const branches = pgTable(
  'branches',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    phoneNumber: text('phone_number'),
    email: text('email'),
    timezone: text('timezone').notNull(),
    currency: char('currency', { length: 3 }).notNull(),
    addressLine1: text('address_line_1').notNull(),
    addressLine2: text('address_line_2'),
    city: text('city').notNull(),
    state: text('state'),
    postalCode: text('postal_code'),
    countryCode: char('country_code', { length: 2 }).notNull(),
    latitude: numeric('latitude', { precision: 9, scale: 6 }),
    longitude: numeric('longitude', { precision: 9, scale: 6 }),
    /**
     * PostGIS spatial point derived from `latitude` and `longitude`.
     * Used for geospatial radius queries (e.g. searching salons within a given distance).
     * Nullable when branch coordinates are not provided.
     */
    location: geographyPoint('location'),
    status: branchStatusEnum('status').notNull().default('active'),
    isPublished: boolean('is_published').notNull().default(false),
    ...helperTimeStamp,
  },
  (table) => [
    index('idx_branches_business').on(table.businessId),
    index('idx_branches_status').on(table.status),
    index('idx_branches_city').on(table.city),
    unique('uq_branches_tenant').on(table.businessId, table.id),
    check('chk_branches_name', sql`length(trim(${table.name})) > 0`),
  ],
);
