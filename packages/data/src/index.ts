//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { BirthdayPlaylist } from './BirthdayPlaylist.js';
import { PlaylistSong } from './PlaylistSong.js';
import type { UniversalAppSchema } from '@rayfin-app/shared';

/**
 * The app's Rayfin data schema. Keep this registration aligned with
 * UniversalAppSchema so both entities remain type-safe in the browser.
 */
export type { UniversalAppSchema };
export { BirthdayPlaylist, PlaylistSong };

export const schema = [BirthdayPlaylist, PlaylistSong];
