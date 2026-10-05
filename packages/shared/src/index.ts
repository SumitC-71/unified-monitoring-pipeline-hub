/**
 * Browser-safe contracts shared by the data registration package, functions,
 * and frontend.
 *
 * Keep each record shape aligned with its decorated runtime entity in
 * `@rayfin-app/data`. This package must stay isomorphic, so do not import the
 * decorated classes here.
 */

export type ConsentStatus = 'Pending' | 'Sent' | 'Granted' | 'Revoked';
export type SyncStatus = 'Succeeded' | 'Failed' | 'Running';

/**
 * Mirrors `TenantConfiguration` in `@rayfin-app/data` (relationships omitted).
 * Platform and workspace details live on `Workspace`, written by discovery.
 */
export interface TenantConfigurationRecord {
  /** The AAD tenant GUID. */
  id: string;
  tenant_name: string;
  admin_name?: string | null;
  admin_email?: string | null;
  consent_url?: string | null;
  consent_status?: ConsentStatus | null;
  consent_sent_at?: Date | string | null;
  consent_granted_at?: Date | string | null;
  refresh_interval: number;
  is_active: boolean;
  last_sync_status?: SyncStatus | null;
  last_sync_time?: Date | string | null;
  onboarded_at?: Date | string | null;
  submitted_by?: string | null;
  submitted_by_email?: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

/**
 * What the onboarding form submits to the `onboardTenant` function. Only
 * tenant-level details — the submitter is read from the caller's token.
 *
 * Keep this a type alias, not an interface: Functions typegen reads this
 * package from its `.d.ts` output and emits named interfaces as bare
 * references, which `types.ts` cannot resolve. Object-literal aliases are
 * expanded inline.
 */
export type TenantOnboardingInput = {
  tenant_id: string;
  tenant_name: string;
  admin_name?: string;
  admin_email?: string;
  refresh_interval: number;
};

export type TenantOnboardingField = keyof TenantOnboardingInput;

export type OnboardTenantResult =
  | {
      ok: true;
      tenant: { id: string; tenant_name: string; submitted_by_email?: string };
    }
  | {
      ok: false;
      reason: 'invalid' | 'duplicate' | 'unauthenticated';
      message: string;
      field?: TenantOnboardingField;
    };

/**
 * What the browser submits to the `sendConsentEmail` function, straight after
 * onboarding. The tenant's stored configuration may not be readable yet, so
 * the function works from these details and builds the consent URL itself.
 */
export type SendConsentEmailInput = {
  tenant_id: string;
  tenant_name: string;
  admin_name?: string;
  admin_email?: string;
};

export type SendConsentEmailResult =
  | {
      ok: true;
      tenant_id: string;
      consent_status: 'Sent';
      /** ISO timestamp recorded in `consent_sent_at`. */
      consent_sent_at: string;
    }
  | {
      ok: false;
      reason:
        | 'invalid'
        | 'unauthenticated'
        | 'already_sent'
        | 'already_granted'
        | 'missing_admin_email'
        | 'not_configured'
        | 'flow_rejected'
        | 'flow_timeout';
      message: string;
    };

export type UniversalAppSchema = {
  TenantConfiguration: TenantConfigurationRecord;
};
