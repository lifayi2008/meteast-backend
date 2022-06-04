import { DefaultDIDAdapter } from '@elastosfoundation/did-js-sdk';

export class MyDIDAdapter extends DefaultDIDAdapter {
  constructor() {
    const resolverUrl = 'https://api.trinity-tech.io/eid';
    console.log('Using Trinity-Tech DID adapter with resolver url:', resolverUrl);
    super(resolverUrl);
  }
}
