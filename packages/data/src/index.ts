// ---------------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//     Copyright (c) Microsoft Corporation. All rights reserved.
//     Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
// ---------------------------------------------------------------------------

/**
 * Rayfin data schema registration — ETL Pipeline Monitoring Hub.
 *
 * Each entity maps to one table in the Fabric SQL Database (Layer 2).
 * Import order follows the FK dependency chain so Node.js resolves
 * circular module references correctly at startup:
 *
 *   TenantConfiguration  (no FKs — standalone control table)
 *       ↑
 *   Workspace            (no FKs — top of hierarchy)
 *       ↑
 *   Item                 (FK → Workspace)
 *       ↑
 *   JobInstance          (FK → Workspace, Item)
 *       ↑
 *   ActivityRun          (FK → JobInstance, Workspace, Item)
 *
 * After adding or modifying an entity, apply schema changes with:
 *   npx rayfin up db apply
 */

import { TenantConfiguration } from './Tenantconfiguration.js';
import { Workspace }           from './Workspace.js';
import { Item }                from './Item.js';
import { JobInstance }         from './Jobinstance.js';
import { ActivityRun }         from './Activityrun.js';

export type { UniversalAppSchema } from '@rayfin-app/shared';

export { TenantConfiguration, Workspace, Item, JobInstance, ActivityRun };

export const schema = [
  TenantConfiguration,
  Workspace,
  Item,
  JobInstance,
  ActivityRun,
];