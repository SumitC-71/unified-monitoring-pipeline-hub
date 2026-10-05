//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { Activity, Moon, Sun } from 'lucide-react';

import { TenantOnboarding } from './features/onboarding/TenantOnboarding';
import { useTheme } from './hooks/theme.context';

function App() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-600">
          <div className="flex items-center gap-300">
            <span className="flex icon-size-600 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Activity aria-hidden className="icon-size-200" />
            </span>
            <span className="font-heading text-400 leading-400 font-semibold tracking-wide">
              Pipeline Monitor
            </span>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            className="flex icon-size-600 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            {isDark ? (
              <Sun aria-hidden className="icon-size-200" />
            ) : (
              <Moon aria-hidden className="icon-size-200" />
            )}
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-700 px-600 pt-800 pb-600">
        <div className="flex max-w-2xl flex-col gap-200">
          <p className="font-monospace text-200 leading-200 font-medium uppercase tracking-widest text-primary">
            Tenant configuration
          </p>
          <h1 className="font-heading text-hero-800 leading-hero-800 font-semibold">
            Onboard a tenant
          </h1>
          <p className="text-400 leading-400 text-muted-foreground">
            Register a tenant and its admin contact. Its workspaces across Data
            Factory, Synapse, and Fabric are discovered automatically.
          </p>
        </div>
        <TenantOnboarding />
      </main>
    </div>
  );
}

export default App;
