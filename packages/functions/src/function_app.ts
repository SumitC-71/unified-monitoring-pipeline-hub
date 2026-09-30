import {
  UserDataFunctions,
  type RayfinContext,
} from '@microsoft/fabric-user-data-functions';
import type {
  OnboardTenantResult,
  TenantConfigurationRecord,
  TenantOnboardingField,
  TenantOnboardingInput,
  TenantPlatform,
  UniversalAppSchema,
} from '@rayfin-app/shared';

const udf = new UserDataFunctions();

const PLATFORMS: readonly TenantPlatform[] = [
  'AzureDataFactory',
  'AzureSynapse',
  'Fabric',
];
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class InvalidInput extends Error {
  constructor(
    readonly field: TenantOnboardingField,
    message: string
  ) {
    super(message);
  }
}

/** Trims a required text value and enforces the entity's `max` length. */
function required(
  input: TenantOnboardingInput,
  field: TenantOnboardingField,
  label: string,
  max: number
): string {
  const raw = input[field];
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) throw new InvalidInput(field, `${label} is required.`);
  if (value.length > max) {
    throw new InvalidInput(field, `${label} must be ${max} characters or fewer.`);
  }
  return value;
}

/** Blank optional text becomes `undefined` so the column is left unset. */
function optional(
  input: TenantOnboardingInput,
  field: TenantOnboardingField,
  label: string,
  max: number
): string | undefined {
  const raw = input[field];
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'string') {
    throw new InvalidInput(field, `${label} must be text.`);
  }
  const value = raw.trim();
  if (!value) return undefined;
  if (value.length > max) {
    throw new InvalidInput(field, `${label} must be ${max} characters or fewer.`);
  }
  return value;
}

function guid(
  value: string | undefined,
  field: TenantOnboardingField,
  label: string
): string | undefined {
  if (value === undefined) return undefined;
  if (!GUID.test(value)) {
    throw new InvalidInput(field, `${label} must be a GUID.`);
  }
  return value.toLowerCase();
}

function validate(input: TenantOnboardingInput) {
  if (typeof input !== 'object' || input === null) {
    throw new InvalidInput('tenant_id', 'Tenant details are missing.');
  }

  const platform = input.platform;
  if (!PLATFORMS.includes(platform)) {
    throw new InvalidInput('platform', 'Choose a supported platform.');
  }

  const refresh = input.refresh_interval;
  if (typeof refresh !== 'number' || !Number.isInteger(refresh) || refresh < 1) {
    throw new InvalidInput(
      'refresh_interval',
      'Refresh interval must be a whole number of at least 1.'
    );
  }

  const adminEmail = optional(input, 'admin_email', 'Admin email', 320);
  if (adminEmail !== undefined && !EMAIL.test(adminEmail)) {
    throw new InvalidInput('admin_email', 'Admin email is not a valid address.');
  }

  return {
    id: guid(required(input, 'tenant_id', 'Tenant ID', 36), 'tenant_id', 'Tenant ID')!,
    tenant_name: required(input, 'tenant_name', 'Tenant name', 200),
    platform,
    subscription_id: guid(
      optional(input, 'subscription_id', 'Subscription ID', 64),
      'subscription_id',
      'Subscription ID'
    ),
    resource_group: optional(input, 'resource_group', 'Resource group', 200),
    factory_or_workspace_name: required(
      input,
      'factory_or_workspace_name',
      'Factory or workspace name',
      200
    ),
    fabric_workspace_id: guid(
      optional(input, 'fabric_workspace_id', 'Fabric workspace ID', 64),
      'fabric_workspace_id',
      'Fabric workspace ID'
    ),
    admin_name: optional(input, 'admin_name', 'Admin name', 200),
    admin_email: adminEmail,
    refresh_interval: refresh,
  };
}

udf.func(
  'onboardTenant',
  async (
    tenant: TenantOnboardingInput,
    ctx: RayfinContext<UniversalAppSchema>
  ): Promise<OnboardTenantResult> => {
    let fields: ReturnType<typeof validate>;
    try {
      fields = validate(tenant);
    } catch (error) {
      if (error instanceof InvalidInput) {
        return { ok: false, reason: 'invalid', message: error.message, field: error.field };
      }
      throw error;
    }

    const data = ctx.getDataClient();

    const existing = await data.TenantConfiguration.select(['id'])
      .where({ id: { eq: fields.id } })
      .execute();
    if (existing.length > 0) {
      return {
        ok: false,
        reason: 'duplicate',
        message: 'This tenant is already onboarded.',
        field: 'tenant_id',
      };
    }

    const now = new Date();
    const record: TenantConfigurationRecord = {
      ...fields,
      is_active: true,
      onboarded_at: now,
      created_at: now,
      updated_at: now,
    };
    // Leave unset optional columns out of the insert entirely.
    for (const key of Object.keys(record) as (keyof TenantConfigurationRecord)[]) {
      if (record[key] === undefined) delete record[key];
    }

    const created = await data.TenantConfiguration.create(record);
    console.log('onboardTenant created tenant configuration');

    return {
      ok: true,
      tenant: {
        id: created.id,
        tenant_name: created.tenant_name,
        platform: created.platform,
      },
    };
  },
  []
);
