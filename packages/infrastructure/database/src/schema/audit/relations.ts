import { relations } from 'drizzle-orm';
import { businesses } from '../business/businesses.js';
import { users } from '../identity/users.js';
import { auditLogs } from './audit_logs.js';

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  business: one(businesses, {
    fields: [auditLogs.businessId],
    references: [businesses.id],
  }),
  actor: one(users, {
    fields: [auditLogs.actorUserId],
    references: [users.id],
  }),
}));
