import type {ReflectServerOptions} from '@rocicorp/reflect/server';
import {M, mutators} from './mutators.js';

// worker fails to deploy if this is imported
// import { InstancePresenceRecordType } from '@tldraw/tldraw';

function makeOptions(): ReflectServerOptions<M> {
  return {
    mutators,
    logLevel: 'error',
    disconnectHandler: async (tx) => {
      await tx.del(`instance_presence:${tx.clientID}`)
    }
  };
}

export {makeOptions as default};
