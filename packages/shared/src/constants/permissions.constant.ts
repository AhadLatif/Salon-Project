export interface PermissionDefinition {
  code: string;
  module: string;
  name: string;
  description: string;
}

export const OWNER_ROLE_NAME = 'Owner';

export const PERMISSION_CATALOG = [
  // --- BUSINESS ---
  {
    code: 'business.read',
    module: 'Business',
    name: 'View Business Details',
    description: 'Allows viewing business details and settings.',
  },
  {
    code: 'business.update',
    module: 'Business',
    name: 'Update Business Details',
    description: 'Allows editing business settings and contact info.',
  },
  {
    code: 'business.roles.manage',
    module: 'Business',
    name: 'Manage Roles & Permissions',
    description: 'Allows creating custom roles and configuring permission matrices.',
  },

  // --- BRANCH ---
  {
    code: 'branch.read',
    module: 'Branch',
    name: 'View Branches',
    description: 'Allows viewing salon branch locations and opening hours.',
  },
  {
    code: 'branch.create',
    module: 'Branch',
    name: 'Create Branch',
    description: 'Allows creating a new branch location.',
  },
  {
    code: 'branch.update',
    module: 'Branch',
    name: 'Update Branch',
    description: 'Allows updating branch details and operating hours.',
  },
  {
    code: 'branch.delete',
    module: 'Branch',
    name: 'Delete Branch',
    description: 'Allows deleting a branch location.',
  },

  // --- SERVICE ---
  {
    code: 'service.read',
    module: 'Service',
    name: 'View Services',
    description: 'Allows viewing service catalog, pricing, and duration.',
  },
  {
    code: 'service.create',
    module: 'Service',
    name: 'Create Service',
    description: 'Allows adding new services and service categories.',
  },
  {
    code: 'service.update',
    module: 'Service',
    name: 'Update Service',
    description: 'Allows modifying service prices, durations, and details.',
  },
  {
    code: 'service.delete',
    module: 'Service',
    name: 'Delete Service',
    description: 'Allows deleting services from catalog.',
  },

  // --- STAFF ---
  {
    code: 'staff.read',
    module: 'Staff',
    name: 'View Staff Roster',
    description: 'Allows viewing staff directory and schedules.',
  },
  {
    code: 'staff.invite',
    module: 'Staff',
    name: 'Invite Staff Member',
    description: 'Allows inviting new team members and assigning roles.',
  },
  {
    code: 'staff.update',
    module: 'Staff',
    name: 'Update Staff Profile',
    description: 'Allows editing staff details, assigned services, and hours.',
  },
  {
    code: 'staff.delete',
    module: 'Staff',
    name: 'Remove Staff Member',
    description: 'Allows removing staff members from the business.',
  },

  // --- APPOINTMENT ---
  {
    code: 'appointment.read',
    module: 'Appointment',
    name: 'View Calendar & Bookings',
    description: 'Allows viewing appointment calendar and booking details.',
  },
  {
    code: 'appointment.create',
    module: 'Appointment',
    name: 'Create Booking',
    description: 'Allows booking new appointments for clients.',
  },
  {
    code: 'appointment.update',
    module: 'Appointment',
    name: 'Update Booking',
    description: 'Allows rescheduling or modifying appointment details.',
  },
  {
    code: 'appointment.cancel',
    module: 'Appointment',
    name: 'Cancel Booking',
    description: 'Allows cancelling existing appointments.',
  },

  // --- CUSTOMER ---
  {
    code: 'customer.read',
    module: 'Customer',
    name: 'View Customers',
    description: 'Allows viewing customer directory and history.',
  },
  {
    code: 'customer.create',
    module: 'Customer',
    name: 'Create Customer',
    description: 'Allows creating new customer profile.',
  },
  {
    code: 'customer.update',
    module: 'Customer',
    name: 'Update Customer',
    description: 'Allows editing customer profile and contact info.',
  },
  {
    code: 'customer.delete',
    module: 'Customer',
    name: 'Delete Customer',
    description: 'Allows archiving customer profiles and deleting notes or tags.',
  },
] as const satisfies readonly PermissionDefinition[];

export type PermissionCode = (typeof PERMISSION_CATALOG)[number]['code'];
