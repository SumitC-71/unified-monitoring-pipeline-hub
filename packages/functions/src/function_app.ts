import {
  UserDataFunctions,
  type RayfinContext,
} from '@microsoft/fabric-user-data-functions';
import type {
  OnboardTenantResult,
  SendConsentEmailInput,
  SendConsentEmailResult,
  TenantConfigurationRecord,
  TenantOnboardingField,
  TenantOnboardingInput,
  UniversalAppSchema,
} from '@rayfin-app/shared';

const udf = new UserDataFunctions();

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

type TextFields = Partial<Record<TenantOnboardingField, unknown>>;

/** Trims a required text value and enforces the entity's `max` length. */
function required(
  input: TextFields,
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
  input: TextFields,
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

function validate(input: TenantOnboardingInput) {
  if (typeof input !== 'object' || input === null) {
    throw new InvalidInput('tenant_id', 'Tenant details are missing.');
  }

  const tenantId = required(input, 'tenant_id', 'Tenant ID', 36);
  if (!GUID.test(tenantId)) {
    throw new InvalidInput('tenant_id', 'Tenant ID must be a GUID.');
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
    id: tenantId.toLowerCase(),
    tenant_name: required(input, 'tenant_name', 'Tenant name', 200),
    admin_name: optional(input, 'admin_name', 'Admin name', 200),
    admin_email: adminEmail,
    refresh_interval: refresh,
  };
}

/**
 * Reads the submitter from the invocation's Rayfin JWT (`sub` and `email`
 * claims) so the browser cannot claim to be someone else. The token's
 * signature is enforced by the Rayfin DB on the data calls made with it, so
 * the record is only written when the token is genuine.
 */
function submitter(
  accessToken: string
): { submitted_by: string; submitted_by_email?: string } | undefined {
  const payload = accessToken?.split('.')[1];
  if (!payload) return undefined;
  let claims: unknown;
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return undefined;
  }
  if (typeof claims !== 'object' || claims === null) return undefined;
  const { sub, email } = claims as { sub?: unknown; email?: unknown };
  const id = typeof sub === 'string' ? sub.trim() : '';
  if (!id || id.length > 200) return undefined;
  const mail = typeof email === 'string' ? email.trim() : '';
  return {
    submitted_by: id,
    submitted_by_email: mail && mail.length <= 320 ? mail : undefined,
  };
}

/**
 * Admin consent link for this app's multi-tenant registration. The client ID
 * comes from the `CONSENT_APP_CLIENT_ID` secret; `undefined` when it is unset
 * or not a GUID, so callers can report the missing configuration.
 */
function consentUrl(ctx: RayfinContext<UniversalAppSchema>): string | undefined {
  let clientId: string;
  try {
    clientId = ctx.Secrets.CONSENT_APP_CLIENT_ID?.trim() ?? '';
  } catch {
    return undefined;
  }
  if (!GUID.test(clientId)) return undefined;
  return `https://login.microsoftonline.com/common/adminconsent?client_id=${clientId.toLowerCase()}`;
}

udf.func(
  'onboardTenant',
  async (
    tenant: TenantOnboardingInput,
    ctx: RayfinContext<UniversalAppSchema>
  ): Promise<OnboardTenantResult> => {
    const audit = submitter(ctx.accessToken);
    if (!audit) {
      return {
        ok: false,
        reason: 'unauthenticated',
        message: 'Sign in again so we can record who onboarded this tenant.',
      };
    }

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
      ...audit,
      consent_url: consentUrl(ctx),
      consent_status: 'Pending',
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
        submitted_by_email: created.submitted_by_email ?? undefined,
      },
    };
  },
  []
);

/** Outbound deadline for the Power Automate HTTP trigger. */
const CONSENT_FLOW_TIMEOUT_MS = 15_000;

udf.func(
  'sendConsentEmail',
  async (
    request: SendConsentEmailInput,
    ctx: RayfinContext<UniversalAppSchema>
  ): Promise<SendConsentEmailResult> => {
    if (!submitter(ctx.accessToken)) {
      return {
        ok: false,
        reason: 'unauthenticated',
        message: 'Sign in again to send the consent email.',
      };
    }

    // Work from the submitted details: on first onboarding the stored
    // configuration may not be readable yet.
    let tenantId: string;
    let tenantName: string;
    let adminName: string | undefined;
    let adminEmail: string | undefined;
    try {
      if (typeof request !== 'object' || request === null) {
        throw new InvalidInput('tenant_id', 'Tenant details are missing.');
      }
      tenantId = required(request, 'tenant_id', 'Tenant ID', 36);
      if (!GUID.test(tenantId)) {
        throw new InvalidInput('tenant_id', 'Tenant ID must be a GUID.');
      }
      tenantId = tenantId.toLowerCase();
      tenantName = required(request, 'tenant_name', 'Tenant name', 200);
      adminName = optional(request, 'admin_name', 'Admin name', 200);
      adminEmail = optional(request, 'admin_email', 'Admin email', 320);
      if (adminEmail !== undefined && !EMAIL.test(adminEmail)) {
        throw new InvalidInput('admin_email', 'Admin email is not a valid address.');
      }
    } catch (error) {
      if (error instanceof InvalidInput) {
        return { ok: false, reason: 'invalid', message: error.message };
      }
      throw error;
    }

    if (!adminEmail) {
      return {
        ok: false,
        reason: 'missing_admin_email',
        message: 'Add an admin email for this tenant before sending consent.',
      };
    }

    let flowUrl: string | undefined;
    flowUrl = ctx.Secrets.CONSENT_EMAIL_FLOW_URL;
    // flowUrl = ctx.getSecret('CONSENT_EMAIL_FLOW_URL'); 
    if (!flowUrl) {
      return {
        ok: false,
        reason: 'not_configured',
        message: 'The consent email service is not configured. - flow URL is missing',
      };
    }
    const link = consentUrl(ctx);
    if (!link) {
      return {
        ok: false,
        reason: 'not_configured',
        message: 'The consent email service is not configured. - link is missing',
      };
    }



    // The record is optional here; when it exists, respect its consent state.
    const data = ctx.getDataClient();
    const [existing] = await data.TenantConfiguration.select(['id', 'consent_status'])
      .where({ id: { eq: tenantId } })
      .execute();
    if (existing?.consent_status === 'Granted') {
      return {
        ok: false,
        reason: 'already_granted',
        message: 'Admin consent is already granted for this tenant.',
      };
    }
    if (existing?.consent_status === 'Sent') {
      return {
        ok: false,
        reason: 'already_sent',
        message: 'The consent email was already sent to the tenant admin.',
      };
    }

    let response: Response;
    try {
      response = await fetch(flowUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminName: adminName ?? '',
          adminEmail,
          tenantName,
          consentUrl: link,
        }),
        signal: AbortSignal.timeout(CONSENT_FLOW_TIMEOUT_MS),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        return {
          ok: false,
          reason: 'flow_timeout',
          message: 'The consent email service did not respond in time. Try again.',
        };
      }
      // The flow URL carries its signature, so never surface fetch details.
      throw new Error('Could not reach the consent email service.');
    }

    if (!response.ok) {
      console.log(`sendConsentEmail flow rejected the request (${response.status})`);
      return {
        ok: false,
        reason: 'flow_rejected',
        message: `The consent email service rejected the request (${response.status}).`,
      };
    }

    const now = new Date();
    if (existing) {
      await data.TenantConfiguration.update(
        { id: tenantId },
        { consent_status: 'Sent', consent_sent_at: now, consent_url: link, updated_at: now }
      );
      console.log('sendConsentEmail sent consent email');
    } else {
      console.log('sendConsentEmail sent consent email; no tenant record to update yet');
    }

    return {
      ok: true,
      tenant_id: tenantId,
      consent_status: 'Sent',
      consent_sent_at: now.toISOString(),
    };
  },
  []
);
