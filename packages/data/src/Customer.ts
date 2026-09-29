//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { authenticated, entity, int, text, uuid } from '@microsoft/rayfin-core';

@entity()
@authenticated('*')
export class Customer {
  @uuid() id!: string;
  @text({ max: 200 }) name!: string;
  @int() budget!: number;
}
