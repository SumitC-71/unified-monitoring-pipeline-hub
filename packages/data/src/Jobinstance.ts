// ---------------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//     Copyright (c) Microsoft Corporation. All rights reserved.
//     Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
// ---------------------------------------------------------------------------

import { authenticated, entity, uuid, text, date, set, int, boolean, one, many } from '@microsoft/rayfin-core';
import { TenantConfiguration } from './Tenantconfiguration.js';
import { Workspace }   from './Workspace.js';
import { Item }        from './Item.js';
import { ActivityRun } from './Activityrun.js';

/**
 * JobInstance (pipeline runs) — Layer 2 SQL table. Feeds the main dashboard grid.
 *
 * ⚡ id = job_instance_id UUID (supplied from raw zone, NOT auto-generated).
 *    Fabric → ItemJobInstance GUID | ADF/Synapse → runId GUID.
 *    Child table (ActivityRun) references this via job_instance_id FK (@uuid).
 */
@entity()
@authenticated('*')
export class JobInstance {
  /** Supplied = platform pipeline run GUID from raw zone. */
  @uuid() id!: string;

  // ── FK → TenantConfiguration ──────────────────────────────────────────────────
  /** FK → TenantConfiguration.id (AAD tenant GUID). SQL: @uuid, insert-only. */
  @uuid() tenant_id!: string;
  @one(() => TenantConfiguration) tenant?: TenantConfiguration;

  // ── FK → Workspace ────────────────────────────────────────────────────────────
  /** FK → Workspace.id (platform workspace GUID). SQL: @uuid, insert-only. */
  @uuid() workspace_id!: string;
  @one(() => Workspace) workspace?: Workspace;

  // ── FK → Item ─────────────────────────────────────────────────────────────────
  /** FK → Item.id (platform item/pipeline GUID). SQL: @uuid, insert-only. */
  @uuid() item_id!: string;
  @one(() => Item) item?: Item;

  // ── Fields ────────────────────────────────────────────────────────────────────
  @set('AzureDataFactory', 'AzureSynapse', 'Fabric')
  platform!: 'AzureDataFactory' | 'AzureSynapse' | 'Fabric';

  @text({ max: 50 })                 job_type!: string;
  @text({ max: 50 })                 invoke_type!: string;          // Manual | Scheduled
  @text({ max: 50 })                 status!: string;               // NotStarted|InProgress|Completed|Failed|Cancelled
  @text({ max: 64, optional: true }) root_activity_id?: string;     // Fabric only

  // ── Timing ────────────────────────────────────────────────────────────────────
  @date()                  start_time_utc!: Date;
  @date({ optional: true }) end_time_utc?: Date;

  // ── Derived columns (computed by PySpark transform) ───────────────────────────
  @int({ optional: true }) duration_in_sec?: number;   // DATEDIFF(SECOND, start, end)
  @boolean()               is_failed!: boolean;        // status == 'Failed'
  @int({ optional: true }) retry_count?: number;       // aggregated from activity_runs

  // ── Failure detail ────────────────────────────────────────────────────────────
  @text({ max: 100, optional: true }) failure_error_code?: string;
  @text({ optional: true })           failure_message?: string;

  // ── Relationships (parent side) ───────────────────────────────────────────────
  @many(() => ActivityRun) activityRuns?: ActivityRun[];

  // ── Audit ─────────────────────────────────────────────────────────────────────
  @date() created_at!: Date;
  @date() updated_at!: Date;
}