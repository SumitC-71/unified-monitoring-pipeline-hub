//-----------------------------------------------------------------------
// Tenant onboarding — collects a tenant's configuration and saves it to the
// TenantConfiguration table through the `onboardTenant` function, then emails
// the admin consent link through `sendConsentEmail`.
//-----------------------------------------------------------------------

import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  ArrowRight,
  Check,
  CircleAlert,
  CircleCheck,
  LoaderCircle,
  Mail,
  RotateCcw,
} from 'lucide-react';
import type {
  OnboardTenantResult,
  TenantOnboardingField,
} from '@rayfin-app/shared';

import { Button, Field, TextInput } from '@/components/ui/form-controls';
import { cn } from '@/lib/utils';

import { onboardTenant, sendConsentEmail } from './onboard-tenant.service';
import {
  EMPTY_TENANT_FORM,
  MAX_LENGTH,
  REFRESH_PRESETS,
  toOnboardingInput,
  validateTenantForm,
  type TenantFormErrors,
  type TenantFormValues,
} from './tenant-form.model';

type SectionId = 'tenant' | 'admin' | 'schedule';

const SECTIONS: readonly {
  id: SectionId;
  title: string;
  fields: readonly TenantOnboardingField[];
  optional?: boolean;
}[] = [
  { id: 'tenant', title: 'Tenant', fields: ['tenant_id', 'tenant_name'] },
  {
    id: 'admin',
    title: 'Admin contact',
    fields: ['admin_name', 'admin_email'],
    optional: true,
  },
  { id: 'schedule', title: 'Ingestion schedule', fields: ['refresh_interval'] },
];

/** Required values that must be filled before a section counts as ready. */
const REQUIRED: readonly (keyof TenantFormValues)[] = [
  'tenant_id',
  'tenant_name',
  'refresh_interval',
];

type SavedTenantInfo = Extract<OnboardTenantResult, { ok: true }>['tenant'];

/** What happened to the consent email after the tenant was saved. */
type ConsentOutcome =
  | { kind: 'sent'; email: string }
  | { kind: 'skipped' }
  | { kind: 'failed'; message: string };

type Status =
  | { kind: 'editing' }
  | { kind: 'submitting' }
  | { kind: 'saved'; tenant: SavedTenantInfo; consent: ConsentOutcome };

/** Sends the consent email; a failure here never undoes the saved tenant. */
async function requestConsent(
  input: ReturnType<typeof toOnboardingInput>
): Promise<ConsentOutcome> {
  if (!input.admin_email) return { kind: 'skipped' };
  try {
    const result = await sendConsentEmail({
      tenant_id: input.tenant_id,
      tenant_name: input.tenant_name,
      admin_name: input.admin_name,
      admin_email: input.admin_email,
    });
    return result.ok
      ? { kind: 'sent', email: input.admin_email }
      : { kind: 'failed', message: result.message };
  } catch (error) {
    return {
      kind: 'failed',
      message: error instanceof Error ? error.message : 'The consent email could not be sent.',
    };
  }
}

export function TenantOnboarding() {
  const [values, setValues] = useState<TenantFormValues>(EMPTY_TENANT_FORM);
  const [touched, setTouched] = useState<Partial<Record<keyof TenantFormValues, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<TenantFormErrors>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'editing' });

  const errors = useMemo(() => validateTenantForm(values), [values]);
  const submitting = status.kind === 'submitting';

  const visibleError = (field: TenantOnboardingField) =>
    serverErrors[field] ?? (submitted || touched[field] ? errors[field] : undefined);

  const sectionReady = (id: SectionId) => {
    const section = SECTIONS.find((s) => s.id === id)!;
    return section.fields.every(
      (field) =>
        !errors[field] &&
        !serverErrors[field] &&
        (!REQUIRED.includes(field) || values[field].trim() !== '')
    );
  };

  const set = <K extends keyof TenantFormValues>(field: K, value: TenantFormValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
    setServerErrors((current) => {
      if (!(field in current)) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const blur = (field: keyof TenantFormValues) =>
    setTouched((current) => ({ ...current, [field]: true }));

  const reset = () => {
    setValues(EMPTY_TENANT_FORM);
    setTouched({});
    setSubmitted(false);
    setServerErrors({});
    setRequestError(null);
    setStatus({ kind: 'editing' });
  };

  const focusField = (field: TenantOnboardingField) => {
    const target = document.getElementById(field);
    target?.focus();
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitted(true);
    setRequestError(null);

    const firstInvalid = SECTIONS.flatMap((s) => s.fields).find((f) => errors[f]);
    if (firstInvalid) {
      focusField(firstInvalid);
      return;
    }

    setStatus({ kind: 'submitting' });
    try {
      const input = toOnboardingInput(values);
      const result = await onboardTenant(input);
      if (result.ok) {
        const consent = await requestConsent(input);
        setStatus({ kind: 'saved', tenant: result.tenant, consent });
        return;
      }
      setStatus({ kind: 'editing' });
      if (result.field) {
        setServerErrors({ [result.field]: result.message });
        focusField(result.field);
      } else {
        setRequestError(result.message);
      }
    } catch (error) {
      setStatus({ kind: 'editing' });
      setRequestError(
        error instanceof Error ? error.message : 'The tenant could not be saved.'
      );
    }
  };

  if (status.kind === 'saved') {
    return <SavedTenant tenant={status.tenant} consent={status.consent} onAnother={reset} />;
  }

  return (
    <div className="grid gap-800 lg:grid-cols-[1fr_200px]">
      <form
        noValidate
        onSubmit={(event) => void submit(event)}
        aria-busy={submitting}
        className="flex min-w-0 flex-col gap-500"
      >
        {requestError ? (
          <div
            role="alert"
            className="flex items-start gap-300 rounded-xl border border-destructive/30 bg-destructive/5 p-400 text-300 leading-300 text-foreground"
          >
            <CircleAlert aria-hidden className="mt-100-nudge icon-size-300 shrink-0 text-destructive" />
            <div className="flex flex-col gap-100">
              <p className="font-semibold">Tenant not saved</p>
              <p className="text-muted-foreground">{requestError}</p>
            </div>
          </div>
        ) : null}

        <fieldset disabled={submitting} className="contents">
          <Section index={1} id="tenant" title="Tenant" description="The Microsoft Entra tenant whose pipelines you want to monitor.">
            <div className="grid gap-400 md:grid-cols-2">
              <Field
                id="tenant_id"
                label="Tenant ID"
                hint="Directory (tenant) ID from Microsoft Entra, e.g. 00000000-0000-0000-0000-000000000000"
                error={visibleError('tenant_id')}
                className="md:col-span-2"
              >
                <TextInput
                  id="tenant_id"
                  mono
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={MAX_LENGTH.tenant_id}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  value={values.tenant_id}
                  invalid={!!visibleError('tenant_id')}
                  onChange={(e) => set('tenant_id', e.target.value)}
                  onBlur={() => blur('tenant_id')}
                />
              </Field>
              <Field
                id="tenant_name"
                label="Tenant name"
                hint="A friendly name shown across the monitoring views."
                error={visibleError('tenant_name')}
                className="md:col-span-2"
              >
                <TextInput
                  id="tenant_name"
                  maxLength={MAX_LENGTH.tenant_name}
                  placeholder="Contoso Retail"
                  value={values.tenant_name}
                  invalid={!!visibleError('tenant_name')}
                  onChange={(e) => set('tenant_name', e.target.value)}
                  onBlur={() => blur('tenant_name')}
                />
              </Field>
            </div>
          </Section>

          <Section index={2} id="admin" title="Admin contact" optional description="Who to reach about consent and access for this tenant.">
            <div className="grid gap-400 md:grid-cols-2">
              <Field id="admin_name" label="Name" optional error={visibleError('admin_name')}>
                <TextInput
                  id="admin_name"
                  autoComplete="off"
                  maxLength={MAX_LENGTH.admin_name}
                  placeholder="Alex Wilber"
                  value={values.admin_name}
                  invalid={!!visibleError('admin_name')}
                  onChange={(e) => set('admin_name', e.target.value)}
                  onBlur={() => blur('admin_name')}
                />
              </Field>
              <Field id="admin_email" label="Email" optional error={visibleError('admin_email')}>
                <TextInput
                  id="admin_email"
                  type="email"
                  autoComplete="off"
                  maxLength={MAX_LENGTH.admin_email}
                  placeholder="alex@contoso.com"
                  value={values.admin_email}
                  invalid={!!visibleError('admin_email')}
                  onChange={(e) => set('admin_email', e.target.value)}
                  onBlur={() => blur('admin_email')}
                />
              </Field>
            </div>
          </Section>

          <Section index={3} id="schedule" title="Ingestion schedule" description="How often pipeline runs are pulled for this tenant.">
            <Field
              id="refresh_interval"
              label="Refresh interval"
              hint="In minutes. Pick a preset or enter your own."
              error={visibleError('refresh_interval')}
            >
              <div className="flex flex-wrap items-center gap-300">
                <div className="relative w-40">
                  <TextInput
                    id="refresh_interval"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    value={values.refresh_interval}
                    invalid={!!visibleError('refresh_interval')}
                    onChange={(e) => set('refresh_interval', e.target.value)}
                    onBlur={() => blur('refresh_interval')}
                    className="pr-800"
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 right-300 flex items-center text-200 text-muted-foreground"
                  >
                    min
                  </span>
                </div>
                <div role="group" aria-label="Refresh presets" className="flex flex-wrap gap-200">
                  {REFRESH_PRESETS.map((preset) => {
                    const active = values.refresh_interval.trim() === String(preset.minutes);
                    return (
                      <button
                        key={preset.minutes}
                        type="button"
                        aria-pressed={active}
                        onClick={() => set('refresh_interval', String(preset.minutes))}
                        className={cn(
                          'h-8 rounded-full border px-300 text-[length:var(--text-200)] font-medium transition-colors',
                          'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30',
                          active
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-input bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground'
                        )}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </Field>
          </Section>
        </fieldset>

        <div className="sticky bottom-0 -mx-100 flex items-center justify-between gap-300 border-t border-border bg-background/90 px-100 py-400 backdrop-blur">
          <p className="hidden text-200 leading-200 text-muted-foreground sm:block">
            New tenants are saved as active and recorded under your sign-in. If you add an admin email, they're sent the consent link.
          </p>
          <div className="ml-auto flex items-center gap-200">
            <Button variant="ghost" onClick={reset} disabled={submitting}>
              <RotateCcw aria-hidden className="icon-size-200" />
              Clear
            </Button>
            <Button type="submit" disabled={submitting} className="min-w-40">
              {submitting ? (
                <>
                  <LoaderCircle aria-hidden className="icon-size-200 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  Onboard tenant
                  <ArrowRight aria-hidden className="icon-size-200" />
                </>
              )}
            </Button>
          </div>
        </div>
      </form>

      <ReadinessRail sections={SECTIONS} ready={sectionReady} />
    </div>
  );
}

function Section({
  index,
  id,
  title,
  description,
  optional,
  children,
}: {
  index: number;
  id: SectionId;
  title: string;
  description: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      id={`section-${id}`}
      aria-labelledby={`section-${id}-title`}
      className="scroll-mt-600 rounded-2xl border border-border bg-card p-600 shadow-[var(--shadow-card)]"
    >
      <header className="mb-500 flex items-start gap-400">
        <span className="font-monospace text-200 leading-300 font-medium text-primary">
          {String(index).padStart(2, '0')}
        </span>
        <div className="flex flex-col gap-100">
          <h2
            id={`section-${id}-title`}
            className="flex items-center gap-200 font-heading text-500 leading-500 font-semibold text-card-foreground"
          >
            {title}
            {optional ? (
              <span className="rounded-full bg-secondary px-200 py-100-nudge font-base text-200 leading-200 font-medium text-muted-foreground">
                Optional
              </span>
            ) : null}
          </h2>
          <p className="text-300 leading-300 text-muted-foreground">{description}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

function ReadinessRail({
  sections,
  ready,
}: {
  sections: typeof SECTIONS;
  ready: (id: SectionId) => boolean;
}) {
  return (
    <nav aria-label="Form progress" className="hidden lg:block">
      <ol className="sticky top-600 flex flex-col">
        {sections.map((section, i) => {
          const done = ready(section.id);
          return (
            <li key={section.id} className="relative flex gap-300 pb-500 last:pb-0">
              {i < sections.length - 1 ? (
                <span
                  aria-hidden
                  className={cn(
                    'absolute left-[calc(var(--icon-size-300)/2)] top-500 h-[calc(100%-var(--spacing-500))] w-px',
                    done ? 'bg-primary/60' : 'bg-border'
                  )}
                />
              ) : null}
              <span
                aria-hidden
                className={cn(
                  'relative flex icon-size-300 shrink-0 items-center justify-center rounded-full border transition-colors',
                  done
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-card'
                )}
              >
                {done ? <Check className="icon-size-100" strokeWidth={3} /> : null}
              </span>
              <a
                href={`#section-${section.id}`}
                className="-mt-100-nudge flex flex-col rounded-md text-300 leading-300 text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
              >
                <span className={done ? 'font-medium' : undefined}>{section.title}</span>
                <span className="text-200 leading-200 text-muted-foreground">
                  {done ? (section.optional ? 'Looks good' : 'Ready') : section.optional ? 'Optional' : 'Needs details'}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function SavedTenant({
  tenant,
  consent,
  onAnother,
}: {
  tenant: SavedTenantInfo;
  consent: ConsentOutcome;
  onAnother: () => void;
}) {
  return (
    <section
      aria-labelledby="saved-title"
      className="mx-auto flex max-w-xl flex-col items-center gap-500 rounded-2xl border border-border bg-card p-800 text-center shadow-[var(--shadow-card)]"
    >
      <span className="flex icon-size-700 items-center justify-center rounded-full bg-accent text-primary">
        <CircleCheck aria-hidden className="icon-size-500" />
      </span>
      <div className="flex flex-col gap-200">
        <h2 id="saved-title" className="font-heading text-hero-700 leading-hero-700 font-semibold">
          Tenant onboarded
        </h2>
        <p className="text-300 leading-300 text-muted-foreground">
          {tenant.tenant_name} is saved and marked active. Its workspaces will appear once discovery runs.
        </p>
      </div>
      <dl className="grid w-full gap-300 rounded-xl bg-secondary p-400 text-left text-300 leading-300">
        <div className="flex items-center justify-between gap-400">
          <dt className="text-muted-foreground">Tenant ID</dt>
          <dd className="truncate font-monospace text-200">{tenant.id}</dd>
        </div>
        {tenant.submitted_by_email ? (
          <div className="flex items-center justify-between gap-400">
            <dt className="text-muted-foreground">Onboarded by</dt>
            <dd className="truncate font-medium">{tenant.submitted_by_email}</dd>
          </div>
        ) : null}
      </dl>
      <ConsentNotice consent={consent} />
      <Button onClick={onAnother}>Onboard another tenant</Button>
    </section>
  );
}

function ConsentNotice({ consent }: { consent: ConsentOutcome }) {
  if (consent.kind === 'sent') {
    return (
      <p role="status" className="flex w-full items-start gap-300 rounded-xl border border-border p-400 text-left text-300 leading-300">
        <Mail aria-hidden className="mt-100-nudge icon-size-300 shrink-0 text-primary" />
        <span>
          Consent email sent to <span className="font-medium">{consent.email}</span>.
        </span>
      </p>
    );
  }
  if (consent.kind === 'skipped') {
    return (
      <p className="w-full text-left text-300 leading-300 text-muted-foreground">
        No admin email was given, so no consent email was sent.
      </p>
    );
  }
  return (
    <div
      role="alert"
      className="flex w-full items-start gap-300 rounded-xl border border-destructive/30 bg-destructive/5 p-400 text-left text-300 leading-300"
    >
      <CircleAlert aria-hidden className="mt-100-nudge icon-size-300 shrink-0 text-destructive" />
      <div className="flex flex-col gap-100">
        <p className="font-semibold">Consent email not sent</p>
        <p className="text-muted-foreground">{consent.message}</p>
      </div>
    </div>
  );
}
