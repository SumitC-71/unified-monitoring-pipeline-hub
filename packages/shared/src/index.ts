/**
 * Browser-safe contracts shared by the data registration package, functions,
 * and frontend.
 *
 * Keep each record shape aligned with its decorated runtime entity in
 * `@rayfin-app/data`. This package must stay isomorphic, so do not import the
 * decorated classes here.
 */

export type TenantPlatform = 'AzureDataFactory' | 'AzureSynapse' | 'Fabric';

/** Mirrors `TenantConfiguration` in `@rayfin-app/data` (relationships omitted). */
export interface TenantConfigurationRecord {
  /** The AAD tenant GUID. */
  id: string;
  tenant_name: string;
  platform: TenantPlatform;
  subscription_id?: string | null;
  resource_group?: string | null;
  factory_or_workspace_name: string;
  fabric_workspace_id?: string | null;
  admin_name?: string | null;
  admin_email?: string | null;
  consent_url?: string | null;
  consent_status?: string | null;
  consent_sent_at?: Date | string | null;
  consent_granted_at?: Date | string | null;
  refresh_interval: number;
  is_active: boolean;
  last_sync_status?: string | null;
  last_sync_time?: Date | string | null;
  onboarded_at?: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

/**
 * What the onboarding form submits to the `onboardTenant` function.
 *
 * Keep this a type alias, not an interface: Functions typegen reads this
 * package from its `.d.ts` output and emits named interfaces as bare
 * references, which `types.ts` cannot resolve. Object-literal aliases are
 * expanded inline.
 */
export type TenantOnboardingInput = {
  tenant_id: string;
  tenant_name: string;
  platform: TenantPlatform;
  subscription_id?: string;
  resource_group?: string;
  factory_or_workspace_name: string;
  fabric_workspace_id?: string;
  admin_name?: string;
  admin_email?: string;
  refresh_interval: number;
};

export type TenantOnboardingField = keyof TenantOnboardingInput;

export type OnboardTenantResult =
  | {
      ok: true;
      tenant: { id: string; tenant_name: string; platform: TenantPlatform };
    }
  | {
      ok: false;
      reason: 'invalid' | 'duplicate';
      message: string;
      field?: TenantOnboardingField;
    };

export type UniversalAppSchema = {
  TenantConfiguration: TenantConfigurationRecord;
};
