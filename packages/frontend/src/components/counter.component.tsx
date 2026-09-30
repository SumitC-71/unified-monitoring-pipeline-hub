//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { useState } from 'react';

import { getRayfinClient } from '../lib/rayfin-client';

/**
 * Demo counter pinned to the left edge of the app. Incrementing it also
 * invokes the `logMessage` Rayfin function, which logs server-side — the
 * message shows up in the Functions host output, not the browser console.
 */
export function Counter() {
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    setCount((value) => value + 1);
    setError(null);
    void (async () => {
      try {
        const client = await getRayfinClient();
        await client.functions.logMessage.invoke();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to call logMessage.'
        );
      }
    })();
  };

  return (
    <div className="fixed top-1/2 left-4 z-50 flex -translate-y-1/2 flex-col items-start gap-200 rounded-lg border border-border bg-card p-400 shadow-lg">
      <span className="text-300 font-medium text-foreground">
        Count: {count}
      </span>
      <button
        type="button"
        onClick={handleClick}
        className="rounded-md bg-primary px-400 py-200 text-300 font-medium text-primary-foreground"
      >
        Increment
      </button>
      {error && <span className="text-200 text-destructive">{error}</span>}
    </div>
  );
}
