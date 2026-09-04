import { randomUUID } from 'node:crypto';
import { db } from '@salon/database';
import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

async function exec(statement: string) {
  await db.execute(sql.raw(statement));
}

async function seedFullChain() {
  const biz = randomUUID();
  const branch = randomUUID();
  const customer = randomUUID();
  const category = randomUUID();
  const service = randomUUID();
  const user1 = randomUUID();
  const role1 = randomUUID();
  const member1 = randomUUID();
  const staff1 = randomUUID();
  const user2 = randomUUID();
  const role2 = randomUUID();
  const member2 = randomUUID();
  const staff2 = randomUUID();
  const appt = randomUUID();
  const seg1 = randomUUID();
  const seg2 = randomUUID();

  await exec(
    `INSERT INTO businesses (id, slug, name, email, phone_number, status) VALUES ('${biz}', 'salon-${biz.slice(0, 8)}', 'Test', 'a@b.com', '+1234567890', 'active')`,
  );
  await exec(
    `INSERT INTO users (id, first_name, last_name, primary_email, primary_phone) VALUES ('${user1}', 'Test', 'User1', 'u1@b.com', '+1234567890')`,
  );
  await exec(
    `INSERT INTO users (id, first_name, last_name, primary_email, primary_phone) VALUES ('${user2}', 'Test', 'User2', 'u2@b.com', '+1234567891')`,
  );
  await exec(
    `INSERT INTO business_roles (id, business_id, name) VALUES ('${role1}', '${biz}', 'Owner')`,
  );
  await exec(
    `INSERT INTO business_roles (id, business_id, name) VALUES ('${role2}', '${biz}', 'Staff')`,
  );
  await exec(
    `INSERT INTO business_members (id, business_id, user_id, role_id) VALUES ('${member1}', '${biz}', '${user1}', '${role1}')`,
  );
  await exec(
    `INSERT INTO business_members (id, business_id, user_id, role_id) VALUES ('${member2}', '${biz}', '${user2}', '${role2}')`,
  );
  await exec(
    `INSERT INTO staff_members (id, business_id, business_member_id, display_name, status) VALUES ('${staff1}', '${biz}', '${member1}', 'Staff A', 'active')`,
  );
  await exec(
    `INSERT INTO staff_members (id, business_id, business_member_id, display_name, status) VALUES ('${staff2}', '${biz}', '${member2}', 'Staff B', 'active')`,
  );
  await exec(
    `INSERT INTO branches (id, business_id, name, timezone, currency, address_line_1, city, country_code, status) VALUES ('${branch}', '${biz}', 'Main', 'UTC', 'USD', '1 St', 'City', 'US', 'active')`,
  );
  await exec(
    `INSERT INTO business_customers (id, business_id, first_name, email, phone_number, status) VALUES ('${customer}', '${biz}', 'Cust', 'c@b.com', '+1234567890', 'active')`,
  );
  await exec(
    `INSERT INTO service_categories (id, business_id, name) VALUES ('${category}', '${biz}', 'Hair')`,
  );
  await exec(
    `INSERT INTO services (id, business_id, category_id, name, default_price, default_duration_minutes, is_bookable, is_active) VALUES ('${service}', '${biz}', '${category}', 'Cut', 50.00, 60, true, true)`,
  );
  await exec(
    `INSERT INTO appointments (id, business_id, branch_id, business_customer_id, status, booking_channel, scheduled_start_at, scheduled_end_at) VALUES ('${appt}', '${biz}', '${branch}', '${customer}', 'confirmed', 'business_dashboard', '2030-01-02T10:00:00Z', '2030-01-02T11:00:00Z')`,
  );
  await exec(
    `INSERT INTO appointment_services (id, business_id, appointment_id, service_id, staff_member_id, service_name, staff_name, unit_price, duration_minutes, starts_at, ends_at, sequence) VALUES ('${seg1}', '${biz}', '${appt}', '${service}', '${staff1}', 'Cut', 'Staff A', 50.00, 60, '2030-01-02T10:00:00Z', '2030-01-02T11:00:00Z', 1)`,
  );
  await exec(
    `INSERT INTO appointment_services (id, business_id, appointment_id, service_id, staff_member_id, service_name, staff_name, unit_price, duration_minutes, starts_at, ends_at, sequence) VALUES ('${seg2}', '${biz}', '${appt}', '${service}', '${staff2}', 'Cut', 'Staff B', 50.00, 60, '2030-01-02T10:00:00Z', '2030-01-02T11:00:00Z', 2)`,
  );

  return { biz, appt, staff1, staff2, seg1, seg2 };
}

describe('appointment_service_allocations — no_staff_time_overlap', () => {
  let ctx: {
    biz: string;
    appt: string;
    staff1: string;
    staff2: string;
    seg1: string;
    seg2: string;
  };

  async function insertAllocation(
    allocationId: string,
    segmentId: string,
    staffId: string,
    start: string,
    end: string,
  ) {
    await exec(
      `INSERT INTO appointment_service_allocations (id, business_id, appointment_id, appointment_service_id, staff_member_id, occupied_period)
       VALUES ('${allocationId}', '${ctx.biz}', '${ctx.appt}', '${segmentId}', '${staffId}', tstzrange('${start}', '${end}', '[)'))`,
    );
  }

  beforeEach(async () => {
    await exec(
      'TRUNCATE TABLE appointment_service_allocations, appointment_services, appointments CASCADE',
    );
    await exec(
      'TRUNCATE TABLE services, service_categories, business_customers, staff_members, branches CASCADE',
    );
    await exec('TRUNCATE TABLE business_members, business_roles, businesses, users CASCADE');
    ctx = await seedFullChain();
  });

  it('rejects two overlapping occupied periods for the same staff+business (SQLSTATE 23P01)', async () => {
    const a1 = randomUUID();
    const a2 = randomUUID();
    await insertAllocation(
      a1,
      ctx.seg1,
      ctx.staff1,
      '2030-01-02T10:00:00Z',
      '2030-01-02T11:00:00Z',
    );

    await expect(
      insertAllocation(a2, ctx.seg1, ctx.staff1, '2030-01-02T10:30:00Z', '2030-01-02T11:30:00Z'),
    ).rejects.toMatchObject({ cause: { code: '23P01' } });
  });

  it('allows ADJACENT (non-overlapping) half-open periods for the same staff', async () => {
    const a1 = randomUUID();
    const a2 = randomUUID();
    await insertAllocation(
      a1,
      ctx.seg1,
      ctx.staff1,
      '2030-01-02T10:00:00Z',
      '2030-01-02T11:00:00Z',
    );

    await expect(
      insertAllocation(a2, ctx.seg1, ctx.staff1, '2030-01-02T11:00:00Z', '2030-01-02T12:00:00Z'),
    ).resolves.toBeUndefined();
  });

  it('allows the SAME period for DIFFERENT staff members (per-staff, not global)', async () => {
    const a1 = randomUUID();
    const a2 = randomUUID();
    await insertAllocation(
      a1,
      ctx.seg1,
      ctx.staff1,
      '2030-01-02T10:00:00Z',
      '2030-01-02T11:00:00Z',
    );

    await expect(
      insertAllocation(a2, ctx.seg2, ctx.staff2, '2030-01-02T10:00:00Z', '2030-01-02T11:00:00Z'),
    ).resolves.toBeUndefined();
  });
});
