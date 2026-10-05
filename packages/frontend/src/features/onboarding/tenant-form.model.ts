//-----------------------------------------------------------------------
// Tenant onboarding form model — field limits mirror `TenantConfiguration`
// in `@rayfin-app/data`; the `onboardTenant` function re-validates on submit.
// Platform and workspace details are discovered later, not entered here.
//-----------------------------------------------------------------------

import type {
  TenantOnboardingField,
  TenantOnboardingInput,
} from '@rayfin-app/shared';

export interface TenantFormValues {
  tenant_id: string;
  tenant_name: string;
  admin_name: string;
  admin_email: string;
  refresh_interval: string;
}

export type TenantFormErrors = Partial<Record<TenantOnboardingField, string>>;

export const EMPTY_TENANT_FORM: TenantFormValues = {
  tenant_id: '',
  tenant_name: '',
  admin_name: '',
  admin_email: '',
  refresh_interval: '60',
};

export const MAX_LENGTH = {
  tenant_id: 36,
  tenant_name: 200,
  admin_name: 200,
  admin_email: 320,
} as const;

export const REFRESH_PRESETS = [
  { minutes: 15, label: '15 min' },
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '1 hr' },
  { minutes: 240, label: '4 hr' },
  { minutes: 1440, label: '24 hr' },
] as const;

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isGuid(value: string): boolean {
  return GUID.test(value.trim());
}

export function validateTenantForm(values: TenantFormValues): TenantFormErrors {
  const errors: TenantFormErrors = {};
  const text = (field: keyof typeof MAX_LENGTH) => values[field].trim();

  const tenantId = text('tenant_id');
  if (!tenantId) errors.tenant_id = 'Tenant ID is required.';
  else if (!isGuid(tenantId))
    errors.tenant_id = 'Enter the tenant ID as a GUID.';

  if (!text('tenant_name')) errors.tenant_name = 'Tenant name is required.';

  const email = text('admin_email');
  if (email && !EMAIL.test(email)) {
    errors.admin_email = 'Enter a valid email address.';
  }

  const refresh = values.refresh_interval.trim();
  const minutes = Number(refresh);
  if (!refresh) errors.refresh_interval = 'Refresh interval is required.';
  else if (!Number.isInteger(minutes) || minutes < 1) {
    errors.refresh_interval = 'Use a whole number of minutes, 1 or more.';
  }

  return errors;
}

/** Builds the function payload. Blank optional fields are left out. */
export function toOnboardingInput(
  values: TenantFormValues
): TenantOnboardingInput {
  const optional = (field: 'admin_name' | 'admin_email') =>
    values[field].trim() || undefined;

  return {
    tenant_id: values.tenant_id.trim(),
    tenant_name: values.tenant_name.trim(),
    admin_name: optional('admin_name'),
    admin_email: optional('admin_email'),
    refresh_interval: Number(values.refresh_interval.trim()),
  };
}
