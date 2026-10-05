import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TenantOnboarding } from './TenantOnboarding';
import {
  EMPTY_TENANT_FORM,
  toOnboardingInput,
  validateTenantForm,
} from './tenant-form.model';

const onboardTenant = vi.fn();
const sendConsentEmail = vi.fn();
vi.mock('./onboard-tenant.service', () => ({
  onboardTenant: (...args: unknown[]) => onboardTenant(...args),
  sendConsentEmail: (...args: unknown[]) => sendConsentEmail(...args),
}));

const TENANT = '11111111-2222-3333-4444-555555555555';

describe('tenant form model', () => {
  it('requires the tenant ID and name', () => {
    const errors = validateTenantForm(EMPTY_TENANT_FORM);
    expect(Object.keys(errors).sort()).toEqual(['tenant_id', 'tenant_name']);
  });

  it('rejects malformed GUIDs, emails, and intervals', () => {
    const errors = validateTenantForm({
      ...EMPTY_TENANT_FORM,
      tenant_id: 'not-a-guid',
      tenant_name: 'Contoso',
      admin_email: 'nope',
      refresh_interval: '1.5',
    });
    expect(errors).toMatchObject({
      tenant_id: expect.any(String),
      admin_email: expect.any(String),
      refresh_interval: expect.any(String),
    });
  });

  it('trims values and drops blank optionals', () => {
    const input = toOnboardingInput({
      ...EMPTY_TENANT_FORM,
      tenant_id: ` ${TENANT} `,
      tenant_name: ' Contoso ',
      admin_name: ' Alex ',
      admin_email: '  ',
      refresh_interval: '30',
    });
    expect(input).toEqual({
      tenant_id: TENANT,
      tenant_name: 'Contoso',
      admin_name: 'Alex',
      admin_email: undefined,
      refresh_interval: 30,
    });
  });
});

describe('TenantOnboarding', () => {
  beforeEach(() => {
    onboardTenant.mockReset();
    sendConsentEmail.mockReset();
    Element.prototype.scrollIntoView = vi.fn();
  });

  function fillRequired() {
    fireEvent.change(screen.getByLabelText('Tenant ID'), { target: { value: TENANT } });
    fireEvent.change(screen.getByLabelText('Tenant name'), { target: { value: 'Contoso' } });
  }

  it('shows validation errors instead of submitting an incomplete form', async () => {
    render(<TenantOnboarding />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Onboard tenant/ })));
    expect(screen.getByText('Tenant ID is required.')).toBeVisible();
    expect(onboardTenant).not.toHaveBeenCalled();
  });

  it('asks only for tenant details, not platform or workspace details', () => {
    render(<TenantOnboarding />);
    expect(screen.queryByRole('radiogroup', { name: 'Platform' })).toBeNull();
    expect(screen.queryByLabelText('Subscription ID')).toBeNull();
    expect(screen.queryByLabelText('Fabric workspace ID')).toBeNull();
  });

  it('submits and confirms the saved tenant', async () => {
    onboardTenant.mockResolvedValue({
      ok: true,
      tenant: { id: TENANT, tenant_name: 'Contoso', submitted_by_email: 'megan@contoso.com' },
    });
    render(<TenantOnboarding />);
    fillRequired();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Onboard tenant/ })));
    expect(onboardTenant).toHaveBeenCalledWith(
      { tenant_id: TENANT, tenant_name: 'Contoso', admin_name: undefined, admin_email: undefined, refresh_interval: 60 }
    );
    expect(await screen.findByRole('heading', { name: 'Tenant onboarded' })).toBeVisible();
    expect(screen.getByText('megan@contoso.com')).toBeVisible();
    expect(sendConsentEmail).not.toHaveBeenCalled();
    expect(screen.getByText(/no consent email was sent/)).toBeVisible();
  });

  it('emails the consent link to the admin after saving', async () => {
    onboardTenant.mockResolvedValue({ ok: true, tenant: { id: TENANT, tenant_name: 'Contoso' } });
    sendConsentEmail.mockResolvedValue({
      ok: true,
      tenant_id: TENANT,
      consent_status: 'Sent',
      consent_sent_at: '2026-10-05T00:00:00.000Z',
    });
    render(<TenantOnboarding />);
    fillRequired();
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Alex' } });
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'alex@contoso.com' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Onboard tenant/ })));
    expect(sendConsentEmail).toHaveBeenCalledWith({
      tenant_id: TENANT,
      tenant_name: 'Contoso',
      admin_name: 'Alex',
      admin_email: 'alex@contoso.com',
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Consent email sent to alex@contoso.com');
  });

  it('keeps the tenant saved when the consent email fails', async () => {
    onboardTenant.mockResolvedValue({ ok: true, tenant: { id: TENANT, tenant_name: 'Contoso' } });
    sendConsentEmail.mockResolvedValue({
      ok: false,
      reason: 'not_configured',
      message: 'The consent email service is not configured.',
    });
    render(<TenantOnboarding />);
    fillRequired();
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'alex@contoso.com' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Onboard tenant/ })));
    expect(await screen.findByRole('heading', { name: 'Tenant onboarded' })).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('The consent email service is not configured.');
  });

  it('keeps the entries and flags the field when the tenant already exists', async () => {
    onboardTenant.mockResolvedValue({
      ok: false,
      reason: 'duplicate',
      message: 'This tenant is already onboarded.',
      field: 'tenant_id',
    });
    render(<TenantOnboarding />);
    fillRequired();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Onboard tenant/ })));
    expect(screen.getByText('This tenant is already onboarded.')).toBeVisible();
    expect(screen.getByLabelText('Tenant name')).toHaveValue('Contoso');
  });

  it('surfaces a request failure without losing the form', async () => {
    onboardTenant.mockRejectedValue(new Error("Couldn't reach the onboarding service."));
    render(<TenantOnboarding />);
    fillRequired();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Onboard tenant/ })));
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't reach the onboarding service.");
    expect(screen.getByLabelText('Tenant ID')).toHaveValue(TENANT);
  });
});
