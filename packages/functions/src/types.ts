/**
 * Function schema types for RayfinClient.
 *
 * AUTO-GENERATED — do not edit manually.
 * Re-generated automatically when function source files change.
 *
 * If this file is not updating automatically, run:
 *   rayfin dev functions apply
 *
 * The schema is a closed object type: only the function names listed
 * below are accepted by RayfinClient.functions.<name>.invoke(...).
 * Adding, renaming, or changing the signature of a udf.func() call
 * regenerates this file and surfaces type errors at every consumer.
 *
 * IMPORTANT: This file must NOT import any Node.js packages — it is
 * resolved by the frontend app's TypeScript compiler.
 */

export type AppFunctionsSchema = {
  onboardTenant: {
    input: { tenant: { tenant_id: string; tenant_name: string; admin_name?: undefined | string; admin_email?: undefined | string; refresh_interval: number } };
    output: { ok: true; tenant: { id: string; tenant_name: string; submitted_by_email?: undefined | string } } | { ok: false; reason: 'invalid' | 'duplicate' | 'unauthenticated'; message: string; field?: undefined | 'tenant_id' | 'tenant_name' | 'admin_name' | 'admin_email' | 'refresh_interval' };
  };
  sendConsentEmail: {
    input: { request: { tenant_id: string; tenant_name: string; admin_name?: undefined | string; admin_email?: undefined | string } };
    output: { ok: true; tenant_id: string; consent_status: 'Sent'; consent_sent_at: string } | { ok: false; reason: 'invalid' | 'unauthenticated' | 'already_sent' | 'already_granted' | 'missing_admin_email' | 'not_configured' | 'flow_rejected' | 'flow_timeout'; message: string };
  };
};
