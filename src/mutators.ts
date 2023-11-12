import type { WriteTransaction } from "@rocicorp/reflect";
import jsonpatch, {Operation} from "fast-json-patch";

// It has other stuff, but this is all we really need. We treat the rest generically.
type TLRecord = {
  id: string;
}

export async function createRecord(tx: WriteTransaction, record: TLRecord) {
  // Defensive clone. Reflect requires the object you pass in is immutable.
  return tx.set(record.id, { ...record });
}

export async function deleteRecord(tx: WriteTransaction, id: string) {
  return tx.del(id);
}

/**
 * Updates a shape's position, size, and rotation using one get and set.
 */
export async function updateRecord(tx: WriteTransaction, id:string, update: Operation[]) {
  const prev = await tx.get<TLRecord>(id);
  if (!prev) return;
  const next = jsonpatch.applyPatch(prev, update, undefined, false).newDocument;
  return tx.set(id, next);
}

export type BatchUpdate = {
  added: Record<string, TLRecord>;
  removed: string[];
  updated: Record<string, Operation[]>;
};

/**
 * Batch update from a diff of records.
 */
export async function updateRecords(
  tx: WriteTransaction,
  {added, removed, updated}: BatchUpdate,
) {
  for (const record of Object.values(added)) {
    await createRecord(tx, record);
  }
  for (const id of removed) {
    await deleteRecord(tx, id);
  }
  for (const [id, patch] of Object.entries(updated)) {
    await updateRecord(tx, id, patch);
  }
}

export const mutators = {
  createRecord,
  deleteRecord,
  updateRecords,
};

export type M = typeof mutators;
