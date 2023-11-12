import {
  InstancePresenceRecordType,
  TLAnyShapeUtilConstructor,
  TLRecord,
  TLStore,
  TLStoreEventInfo,
  TLStoreWithStatus,
  computed,
  createPresenceStateDerivation,
  createTLStore,
  defaultShapeUtils,
  defaultUserPreferences,
  getUserPreferences,
  react,
  setUserPreferences,
  transact,
} from "@tldraw/tldraw";
import { useEffect, useMemo, useState } from "react";
import { ReadTransaction } from "@rocicorp/reflect";
import { Reflect } from "@rocicorp/reflect/client";
import groupBy from "lodash/groupBy";
import { mutators, M } from "./mutators";

export function useReflectStore({
  userId,
  roomId,
  server,
}: {
  userId: string;
  roomId: string;
  shapeUtils: TLAnyShapeUtilConstructor[];
  server: string;
}) {
  const [storeWithStatus, setStoreWithStatus] = useState<TLStoreWithStatus>({
    status: "loading",
  });

  const reflect = useMemo(
    () =>
      new Reflect<M>({
        server,
        userID: userId,
        roomID: roomId,
        mutators,
        kvStore: "idb", // client-side persistence
        onOnlineChange(online) {
          setStoreWithStatus(({ store }) =>
            store
              ? {
                  store,
                  status: online ? "synced-remote" : "synced-local",
                  connectionStatus: online ? "online" : "offline",
                }
              : { status: "loading" }
          );
        },
      }),
    [server, userId, roomId]
  );

  useEffect(
    function createReflectStore() {
      (window as any).reflect = reflect;
      setStoreWithStatus({ status: "loading" });

      const store = createTLStore({
        shapeUtils: defaultShapeUtils,
        defaultName: `tldraw:${userId}:${roomId}`,
      });

      /**
       * Set of disposables which will be cleaned up on unmount.
       */
      const disposables = new Set<() => void>();

      /**
       * Initialize the store with values from reflect
       * and set store status to be synced.
       */
      const getAllRecords = (tx: ReadTransaction) => tx.scan().values().toArray() as unknown as Promise<TLRecord[]>;

      reflect.query(getAllRecords).then(initialRecords => {
        store.mergeRemoteChanges(() => store.put(initialRecords));
        setStoreWithStatus({
          store,
          status: "synced-local",
        });
      });

      const clientId = reflect.clientID;
      const presenceId = InstancePresenceRecordType.createId(clientId);

      disposables.add(
        reflect.experimentalWatch(function applyDiffsToStore(diffs) {
          // Filter out presenceId as self presence is locally derived.
          diffs = diffs.filter(diff => diff.key !== presenceId);
          const { add = [], change = [], del = [] } = groupBy(diffs, diff => diff.op);

          const valuesToPut = add.concat(change).map(diff => diff.newValue);
          const keysToRemove = del.map(diff => diff.key);

          try {
            store.mergeRemoteChanges(() => {
              store.put(valuesToPut);
              store.remove(keysToRemove);
            });
          } catch (error) {
            setStoreWithStatus({ status: "error", error: error as Error });
          }
        })
      );

      disposables.add(
        store.listen(
          function applyChangesToReflect({ changes }: TLStoreEventInfo) {
            // Sync document changes to reflect using one transaction / mutation.
            reflect.mutate.updateFromStore(changes);
          },
          {
            source: "user",
            scope: "document",
          }
        )
      );

      disposables.add(
        reflect.subscribeToPresence(async function syncClients(clientIds) {
          // The local user's instance_presence record should not be stored in their local store.
          clientIds = clientIds.filter(id => id !== clientId);
          const instanceIds = clientIds.map(id => InstancePresenceRecordType.createId(id));

          const prevInstanceIds = new Set(store.query.records("instance_presence").value.map(instance => instance.id));
          const nextInstanceIds = new Set(instanceIds);

          const created = Array.from(nextInstanceIds).filter(id => !prevInstanceIds.has(id));
          const deleted = Array.from(prevInstanceIds).filter(id => !nextInstanceIds.has(id));

          const instances = await Promise.all(created.map(id => reflect.query(tx => tx.get(id))));
          const nextInstances = instances.filter(Boolean).map(instance => InstancePresenceRecordType.create(instance));

          // Don't use mergeRemoteChanges as instance changes need to persist back to reflect.
          transact(() => {
            store.put(nextInstances);
            store.remove(deleted);
          });
        })
      );

      setUserPreferences({ id: clientId });

      const userPreferences = computed<{
        id: string;
        color: string;
        name: string;
      }>("userPreferences", () => {
        const user = getUserPreferences();
        return {
          id: user.id,
          color: user.color ?? defaultUserPreferences.color,
          name: user.name ?? defaultUserPreferences.name,
        };
      });

      // Create the instance presence derivation and set initial value.
      const presenceDerivation = createPresenceStateDerivation(userPreferences, presenceId)(store);
      const presenceInit = presenceDerivation.value;
      if (presenceInit) reflect.mutate.createRecord(presenceDerivation.value);

      // When the derivation change, sync presence to reflect.
      disposables.add(
        react("when presence changes", function syncPresenceToReflect() {
          const presence = presenceDerivation.value;
          requestAnimationFrame(() => {
            if (presence) reflect.mutate.createRecord(presence);
          });
        })
      );

      return () => {
        disposables.forEach(dispose => dispose());
        disposables.clear();
      };
    },
    [reflect, userId, roomId]
  );

  return storeWithStatus;
}
