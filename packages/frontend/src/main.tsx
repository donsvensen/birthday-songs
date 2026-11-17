//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { createRoot } from 'react-dom/client';

import { Root } from './Root';
import { bootstrapAuth } from './services/rayfin-auth.service';

import './global.css';

const callbackUrl = new URL(window.location.href);
const isSpotifyLoopbackCallback =
  callbackUrl.hostname === '127.0.0.1' &&
  (callbackUrl.searchParams.has('code') ||
    callbackUrl.searchParams.has('error'));

if (isSpotifyLoopbackCallback) {
  callbackUrl.hostname = 'localhost';
  window.location.replace(callbackUrl.toString());
} else {
  const rayfinAuthService = await bootstrapAuth();

  createRoot(document.getElementById('root')!).render(
    <Root rayfinAuthService={rayfinAuthService} />
  );
}
