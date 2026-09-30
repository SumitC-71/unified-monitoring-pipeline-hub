//-----------------------------------------------------------------------
// Tenant onboarding form model — field limits mirror `TenantConfiguration`
// in `@rayfin-app/data`; the `onboardTenant` function re-validates on submit.
//-----------------------------------------------------------------------

import type {
  TenantOnboardingField,
  TenantOnboardingInput,
  TenantPlatform,
} from '@rayfin-app/shared';

export interface TenantFormValues {
  tenant_id: string;
  tenant_name: string;
  platform: TenantPlatform | '';
  subscription_id: string;
  resource_group: string;
  factory_or_workspace_name: string;
  fabric_workspace_id: string;
  admin_name: string;
  admin_email: string;
  refresh_interval: string;
}

export type TenantFormErrors = Partial<Record<TenantOnboardingField, string>>;

export const EMPTY_TENANT_FORM: TenantFormValues = {
  tenant_id: '',
  tenant_name: '',
  platform: '',
  subscription_id: '',
  resource_group: '',
  factory_or_workspace_name: '',
  fabric_workspace_id: '',
  admin_name: '',
  admin_email: '',
  refresh_interval: '60',
};

export const MAX_LENGTH = {
  tenant_id: 36,
  tenant_name: 200,
  subscription_id: 64,
  resource_group: 200,
  factory_or_workspace_name: 200,
  fabric_workspace_id: 64,
  admin_name: 200,
  admin_email: 320,
} as const;

export interface PlatformOption {
  value: TenantPlatform;
  label: string;
  hint: string;
  /** Label for `factory_or_workspace_name` on this platform. */
  resourceLabel: string;
  usesAzureResource: boolean;
  usesFabricWorkspace: boolean;
}

export const PLATFORM_OPTIONS: readonly PlatformOption[] = [
  {
    value: 'AzureDataFactory',
    label: 'Azure Data Factory',
    hint: 'Pipelines in a data factory',
    resourceLabel: 'Data factory name',
    usesAzureResource: true,
    usesFabricWorkspace: false,
  },
  {
    value: 'AzureSynapse',
    label: 'Azure Synapse',
    hint: 'Pipelines in a Synapse workspace',
    resourceLabel: 'Synapse workspace name',
    usesAzureResource: true,
    usesFabricWorkspace: false,
  },
  {
    value: 'Fabric',
    label: 'Microsoft Fabric',
    hint: 'Pipelines in a Fabric workspace',
    resourceLabel: 'Fabric workspace name',
    usesAzureResource: false,
    usesFabricWorkspace: true,
  },
];

export const REFRESH_PRESETS = [
  { minutes: 15, label: '15 min' },
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '1 hr' },
  { minutes: 240, label: '4 hr' },
  { minutes: 1440, label: '24 hr' },
] as const;

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function platformOption(
  platform: TenantFormValues['platform']
): PlatformOption | undefined {
  return PLATFORM_OPTIONS.find((option) => option.value === platform);
}

export function isGuid(value: string): boolean {
  return GUID.test(value.trim());
}

/** Validates every field that applies to the selected platform. */
export function validateTenantForm(values: TenantFormValues): TenantFormErrors {
  const errors: TenantFormErrors = {};
  const option = platformOption(values.platform);
  const text = (field: keyof typeof MAX_LENGTH) => values[field].trim();

  const tenantId = text('tenant_id');
  if (!tenantId) errors.tenant_id = 'Tenant ID is required.';
  else if (!isGuid(tenantId))
    errors.tenant_id = 'Enter the tenant ID as a GUID.';

  if (!text('tenant_name')) errors.tenant_name = 'Tenant name is required.';

  if (!option) errors.platform = 'Choose the platform this tenant runs on.';

  if (!text('factory_or_workspace_name')) {
    errors.factory_or_workspace_name = `${option?.resourceLabel ?? 'Factory or workspace name'} is required.`;
  }

  if (option?.usesAzureResource) {
    const subscription = text('subscription_id');
    if (subscription && !isGuid(subscription)) {
      errors.subscription_id = 'Enter the subscription ID as a GUID.';
    }
  }

  if (option?.usesFabricWorkspace) {
    const workspace = text('fabric_workspace_id');
    if (workspace && !isGuid(workspace)) {
      errors.fabric_workspace_id = 'Enter the workspace ID as a GUID.';
    }
  }

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

/**
 * Builds the function payload. Blank optional fields and fields that do not
 * apply to the chosen platform are left out so their columns stay unset.
 */
export function toOnboardingInput(
  values: TenantFormValues
): TenantOnboardingInput {
  const option = platformOption(values.platform);
  if (!option) throw new Error('A platform must be selected.');

  const optional = (field: keyof typeof MAX_LENGTH, applies = true) => {
    const value = values[field].trim();
    return applies && value ? value : undefined;
  };

  return {
    tenant_id: values.tenant_id.trim(),
    tenant_name: values.tenant_name.trim(),
    platform: option.value,
    subscription_id: optional('subscription_id', option.usesAzureResource),
    resource_group: optional('resource_group', option.usesAzureResource),
    factory_or_workspace_name: values.factory_or_workspace_name.trim(),
    fabric_workspace_id: optional(
      'fabric_workspace_id',
      option.usesFabricWorkspace
    ),
    admin_name: optional('admin_name'),
    admin_email: optional('admin_email'),
    refresh_interval: Number(values.refresh_interval.trim()),
  };
}
