// ---------------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//     Copyright (c) Microsoft Corporation. All rights reserved.
//     Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
// ---------------------------------------------------------------------------

import { authenticated, entity, uuid, text, date, set, int, boolean, one } from '@microsoft/rayfin-core';
import { TenantConfiguration } from './Tenantconfiguration.js';
import { Workspace }   from './Workspace.js';
import { Item }        from './Item.js';
import { JobInstance } from './Jobinstance.js';

/**
 * ActivityRun (activity-level detail) — Layer 2 SQL table. Feeds the failure drill-down view.
 *
 * ⚡ id = activity_run_id UUID (supplied from raw zone, NOT auto-generated).
 */
@entity()
@authenticated('*')
export class ActivityRun {
  /** Supplied = platform activityRunId GUID from raw zone. */
  @uuid() id!: string;

  // ── FK → TenantConfiguration ──────────────────────────────────────────────────
  /** FK → TenantConfiguration.id (AAD tenant GUID). SQL: @uuid, insert-only. */
  @uuid() tenant_id!: string;
  @one(() => TenantConfiguration) tenant?: TenantConfiguration;

  // ── FK → Workspace ────────────────────────────────────────────────────────────
  /** FK → Workspace.id. Denormalized for workspace-level filtering. SQL: @uuid, insert-only. */
  @uuid() workspace_id!: string;
  @one(() => Workspace) workspace?: Workspace;

  // ── FK → Item ─────────────────────────────────────────────────────────────────
  /** FK → Item.id. Denormalized for drill-down context. SQL: @uuid, insert-only. */
  @uuid() item_id!: string;
  @one(() => Item) item?: Item;

  // ── FK → JobInstance ──────────────────────────────────────────────────────────
  /** FK → JobInstance.id (pipeline run GUID). SQL: @uuid, insert-only. */
  @uuid() job_instance_id!: string;
  @one(() => JobInstance) jobInstance?: JobInstance;

  // ── Fields ────────────────────────────────────────────────────────────────────
  @set('AzureDataFactory', 'AzureSynapse', 'Fabric')
  platform!: 'AzureDataFactory' | 'AzureSynapse' | 'Fabric';

  @text({ max: 200 })                 pipeline_name!: string;
  @text({ max: 64 })                  pipeline_run_id!: string;
  @text({ max: 200 })                 activity_name!: string;
  @text({ max: 100 })                 activity_type!: string;
  @text({ max: 200, optional: true }) linked_service_name?: string;

  // ── Status & timing ───────────────────────────────────────────────────────────
  @text({ max: 50 })        status!: string;
  @date()                   activity_run_start!: Date;
  @date({ optional: true }) activity_run_end?: Date;

  // ── Derived columns (computed by PySpark transform) ───────────────────────────
  @int({ optional: true }) duration_in_ms?: number;    // BIGINT → @int() (safe for monitoring durations)
  @int({ optional: true }) duration_in_sec?: number;   // duration_in_ms / 1000
  @boolean()               is_failed!: boolean;        // status == 'Failed'

  // ── Error detail ──────────────────────────────────────────────────────────────
  @text({ max: 100, optional: true }) error_code?: string;
  @text({ optional: true })           error_message?: string;
  @text({ max: 100, optional: true }) failure_type?: string;
  @text({ max: 200, optional: true }) error_target?: string;
  @text({ max: 50, optional: true })  recovery_status?: string;
  @int({ optional: true })            retry_attempt?: number;

  // ── I/O payload (open decision — confirm before final build) ──────────────────
  @text({ optional: true }) input_json?: string;
  @text({ optional: true }) output_json?: string;

  // ── Audit ─────────────────────────────────────────────────────────────────────
  @date() created_at!: Date;
  @date() updated_at!: Date;
}