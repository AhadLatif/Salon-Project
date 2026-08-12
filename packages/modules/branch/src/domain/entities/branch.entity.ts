import { ValidationError } from '@salon/shared';

export type BranchStatus = 'active' | 'inactive' | 'archived';

export interface OpeningHourProps {
  id?: string;
  businessId: string;
  branchId: string;
  dayOfWeek: number; // 1 (Monday) to 7 (Sunday)
  shiftName: string | null;
  isClosed: boolean;
  opensAt: string | null; // e.g., '09:00:00'
  closesAt: string | null; // e.g., '17:00:00'
}

export interface BranchProps {
  id?: string;
  businessId: string;
  name: string;
  phoneNumber: string | null;
  email: string | null;
  timezone: string; // e.g., 'America/New_York'
  currency: string; // e.g., 'USD'
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string | null;
  postalCode: string | null;
  countryCode: string; // 2-letter ISO
  latitude: string | null;
  longitude: string | null;
  status?: BranchStatus;

  // A branch is conceptually incomplete without its opening hours
  openingHours?: OpeningHourProps[];

  createdAt?: Date;
  updatedAt?: Date;
}

export class BranchEntity {
  public readonly id?: string | undefined;
  public readonly businessId: string;
  public readonly name: string;
  public readonly phoneNumber: string | null;
  public readonly email: string | null;
  public readonly timezone: string;
  public readonly currency: string;
  public readonly addressLine1: string;
  public readonly addressLine2: string | null;
  public readonly city: string;
  public readonly state: string | null;
  public readonly postalCode: string | null;
  public readonly countryCode: string;
  public readonly latitude: string | null;
  public readonly longitude: string | null;
  public readonly status: BranchStatus;

  public readonly openingHours: OpeningHourProps[];

  public readonly createdAt?: Date | undefined;
  public readonly updatedAt?: Date | undefined;

  constructor(props: BranchProps) {
    this.id = props.id;
    this.businessId = props.businessId;
    this.name = props.name;
    this.phoneNumber = props.phoneNumber;
    this.email = props.email;
    this.timezone = props.timezone;
    this.currency = props.currency;
    this.addressLine1 = props.addressLine1;
    this.addressLine2 = props.addressLine2;
    this.city = props.city;
    this.state = props.state;
    this.postalCode = props.postalCode;
    this.countryCode = props.countryCode;
    this.latitude = props.latitude;
    this.longitude = props.longitude;
    this.status = props.status ?? 'active';

    this.openingHours = props.openingHours ?? [];

    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;

    this.validate();
  }

  /**
   * Domain-level validation to ensure the Branch is always in a valid state
   * before it ever reaches the repository/database layer.
   */
  private validate(): void {
    if (!this.businessId) {
      throw new ValidationError(
        'Branch must belong to a business tenant (businessId is required).',
        { businessId: 'Required' },
      );
    }
    if (!this.name || this.name.trim().length === 0) {
      throw new ValidationError('Branch name cannot be empty.', { name: 'Cannot be empty' });
    }
    if (this.countryCode.length !== 2) {
      throw new ValidationError('Country code must be exactly 2 characters (ISO 3166-1 alpha-2).', {
        countryCode: 'Invalid format',
      });
    }
    if (this.currency.length !== 3) {
      throw new ValidationError('Currency code must be exactly 3 characters (ISO 4217).', {
        currency: 'Invalid format',
      });
    }
    if (this.openingHours.length === 0) {
      throw new ValidationError('Branch must have at least one opening hours entry.', {
        openingHours: 'Cannot be empty',
      });
    }

    this.validateOpeningHours();
  }

  /**
   * Validates the business logic of opening hours.
   * - Ensures dayOfWeek is 1-7
   * - Ensures times are logical (opensAt < closesAt)
   * - Validates closed state consistency
   */
  private validateOpeningHours(): void {
    const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

    const toSeconds = (value: string): number => {
      const parts = value.split(':').map(Number);
      const hours = parts[0] ?? 0;
      const minutes = parts[1] ?? 0;
      const seconds = parts[2] ?? 0;
      return hours * 3600 + minutes * 60 + seconds;
    };

    for (const hours of this.openingHours) {
      if (hours.dayOfWeek < 1 || hours.dayOfWeek > 7) {
        throw new ValidationError(
          `Invalid dayOfWeek: ${hours.dayOfWeek}. Must be between 1 (Monday) and 7 (Sunday).`,
          { dayOfWeek: 'Invalid day' },
        );
      }

      if (hours.isClosed) {
        // If it's closed, there should be no opening/closing times
        if (hours.opensAt !== null || hours.closesAt !== null) {
          throw new ValidationError(
            `Day ${hours.dayOfWeek} is marked closed but has opening/closing times.`,
            { opensAt: 'Must be null when closed' },
          );
        }
      } else {
        // If it's open, opening/closing times are mandatory
        if (hours.opensAt === null || hours.closesAt === null) {
          throw new ValidationError(
            `Day ${hours.dayOfWeek} is marked open but missing opening or closing times.`,
            { opensAt: 'Required when open' },
          );
        }
        // Validate time format before converting
        if (!timePattern.test(hours.opensAt) || !timePattern.test(hours.closesAt)) {
          throw new ValidationError(
            `Day ${hours.dayOfWeek} has invalid time format. Expected HH:MM or HH:MM:SS.`,
            { opensAt: 'Invalid time format' },
          );
        }
        if (toSeconds(hours.opensAt) >= toSeconds(hours.closesAt)) {
          throw new ValidationError(
            `Day ${hours.dayOfWeek} opening time (${hours.opensAt}) must be before closing time (${hours.closesAt}).`,
            { opensAt: 'Must be before closesAt' },
          );
        }
      }
    }
  }

  public toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      businessId: this.businessId,
      name: this.name,
      phoneNumber: this.phoneNumber,
      email: this.email,
      timezone: this.timezone,
      currency: this.currency,
      addressLine1: this.addressLine1,
      addressLine2: this.addressLine2,
      city: this.city,
      state: this.state,
      postalCode: this.postalCode,
      countryCode: this.countryCode,
      latitude: this.latitude,
      longitude: this.longitude,
      status: this.status,
      openingHours: this.openingHours.map((h) => ({
        dayOfWeek: h.dayOfWeek,
        shiftName: h.shiftName,
        isClosed: h.isClosed,
        opensAt: h.opensAt,
        closesAt: h.closesAt,
      })),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
