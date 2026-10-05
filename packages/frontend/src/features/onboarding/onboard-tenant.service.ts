//-----------------------------------------------------------------------
// Submits the onboarding form to the trusted `onboardTenant` function and
// asks `sendConsentEmail` to email the tenant admin the consent link.
//-----------------------------------------------------------------------

import { NetworkError } from '@microsoft/rayfin-lib';
import type {
  OnboardTenantResult,
  SendConsentEmailInput,
  SendConsentEmailResult,
  TenantOnboardingInput,
} from '@rayfin-app/shared';

import { getRayfinClient, MissingRayfinConfigError } from '@/lib/rayfin-client';

/** A failure the person can act on, with provider internals stripped. */
export class OnboardingRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OnboardingRequestError';
  }
}

export async function onboardTenant(
  tenant: TenantOnboardingInput
): Promise<OnboardTenantResult> {
  try {
    const client = await getRayfinClient();
    const session = client.auth.getSession();
    if (!session.isAuthenticated || !session.user) {
      throw new OnboardingRequestError(
        'Your session has expired. Sign in again to onboard this tenant.'
      );
    }
    // The function records the submitter from the session's token.
    return await client.functions.onboardTenant.invoke({ tenant });
  } catch (error) {
    console.error('onboardTenant failed', error);
    throw toRequestError(error);
  }
}

/**
 * Emails the admin consent link. Called right after onboarding, so it passes
 * the submitted details rather than relying on the stored configuration.
 */
export async function sendConsentEmail(
  request: SendConsentEmailInput
): Promise<SendConsentEmailResult> {
  try {
    const client = await getRayfinClient();
    const session = client.auth.getSession();
    if (!session.isAuthenticated || !session.user) {
      throw new OnboardingRequestError(
        'Your session has expired. Sign in again to send the consent email.'
      );
    }
    return await client.functions.sendConsentEmail.invoke({ request });
  } catch (error) {
    console.error('sendConsentEmail failed', error);
    if (error instanceof OnboardingRequestError) throw error;
    if (error instanceof NetworkError && (error.status === 401 || error.status === 403)) {
      throw new OnboardingRequestError(
        "You don't have permission to send consent emails. Ask a workspace admin for access."
      );
    }
    throw new OnboardingRequestError(
      "Couldn't reach the consent email service. Try sending the email again later."
    );
  }
}

function toRequestError(error: unknown): OnboardingRequestError {
  if (error instanceof OnboardingRequestError) return error;
  if (error instanceof MissingRayfinConfigError) {
    return new OnboardingRequestError(
      'This app is missing its backend configuration, so the tenant could not be saved.'
    );
  }
  if (error instanceof NetworkError) {
    if (error.status === 401 || error.status === 403) {
      return new OnboardingRequestError(
        "You don't have permission to onboard tenants. Ask a workspace admin for access."
      );
    }
    return new OnboardingRequestError(
      "Couldn't reach the onboarding service. Check your connection and try again."
    );
  }
  return new OnboardingRequestError(
    'The tenant could not be saved because the onboarding service reported an error. Try again, and contact support if it keeps happening.'
  );
}
