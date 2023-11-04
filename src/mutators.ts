import type { WriteTransaction } from "@rocicorp/reflect";
import { RecordsDiff, TLRecord, TLShape } from "@tldraw/tldraw";

export async function createRecord(
  tx: WriteTransaction,
  props: TLRecord,
) {
  return tx.set(props.id, props)
}

export async function deleteRecord(
  tx: WriteTransaction,
  id: string,
) {
  return tx.del(id)
}

export async function moveShape(
  tx: WriteTransaction,
  { id, dx, dy }: { id: string; dx: number; dy: number }
): Promise<void> {
  const shape = await tx.get(id)
  if (!shape) return
  return tx.set(id, {
    ...shape,
    x: shape.x + dx,
    y: shape.y + dy,
  });
}

export async function resizeShape(
  tx: WriteTransaction,
  { id, dw, dh }: { id: string; dw: number; dh: number }
): Promise<void> {
  const shape = await tx.get(id) as any;
  if (!shape) return
  return tx.set(id, {
    ...shape,
    props: {
      ...shape.props,
      w: Math.max(Number.MIN_VALUE, shape.props.w + dw),
      h: Math.max(Number.MIN_VALUE, shape.props.h + dh),
    }
  });
}

export async function rotateShape(
  tx: WriteTransaction,
  { id, dr }: { id: string; dr: number }
): Promise<void> {
  const shape = await tx.get(id) as any;
  if (!shape) return
  return tx.set(id, {
    ...shape,
    rotation: shape.rotation + dr,
  });
}

function excludeProps<T extends object, K extends keyof T | string>(
  obj: T,
  keysToExclude: K[]
): Omit<T, K> {
  const newObj: Partial<T> = { ...obj };
  // Iterate over all keys to exclude and delete them from the new object
  keysToExclude.forEach((key) => {
    if (key in newObj) {
      delete newObj[key as keyof T];
    }
  });
  return newObj as Omit<T, K>;
}

/**
 * Utility function to get the update shape props from a previous and next shape.
 */
function getUpdateShapeProps(prev: TLShape, next: TLShape) {
  const update = { 
    ...excludeProps(next, ["x", "y", "rotation", "props"]), 
    props: excludeProps(next.props, ["w", "h"]) 
  }
  const move = prev.x !== next.x || prev.y !== next.y;
  if (move) {
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    update.dx = dx
    update.dy = dy
  }
  const resize = prev.props.w !== next.props.w || prev.props.h !== next.props.h;
  if (resize) {
    const dw = next.props.w - prev.props.w;
    const dh = next.props.h - prev.props.h;
    update.dw = dw
    update.dh = dh
  }
  const rotate = prev.rotation !== next.rotation;
  if (rotate) {
    const dr = next.rotation - prev.rotation;
    update.dr = dr
  }
  const opacity = prev.opacity !== next.opacity;
  if (opacity) {
    update.dp = next.opacity - prev.opacity;
  }
  return update;
}

type TLShapeUpdate = {
  dx: number;
  dy: number;
  dw: number;
  dh: number;
  dr: number;
  dp: number;
};

/**
 * Updates a shape's position, size, and rotation using one get and set.
 */
export async function updateShape(
  tx: WriteTransaction,
  { id, dx = 0, dy = 0, dw = 0, dh = 0, dr = 0, dp = 0, ...props }: TLShape & Partial<TLShapeUpdate> 
) {
  const prevShape = await tx.get(id) as TLShape;
  if (!prevShape) return
  const { props: shapeProps, ...outerProps } = props;
  const shape = { ...prevShape, ...outerProps } as TLShape;
  shape.x += dx
  shape.y += dy
  shape.props = { ...shape.props, ...shapeProps }
  if (shape.props.w !== undefined) {
    shape.props.w = Math.max(Number.MIN_VALUE, shape.props.w + dw)
  }
  if (shape.props.h !== undefined) {
    shape.props.h = Math.max(Number.MIN_VALUE, shape.props.h + dh)
  }
  shape.rotation += dr
  shape.opacity = Math.max(0, Math.min(1, shape.opacity + dp))
  return tx.set(id, shape);
}

/**
 * Batch update from a diff of records.
 */
export async function updateFromStore(
  tx: WriteTransaction,
  { added: created, removed: deleted, updated }: RecordsDiff<TLRecord>
) {
  const mutations = [];
  for (const record of Object.values(created)) {
    mutations.push(createRecord(tx, record));
  }
  for (const record of Object.values(deleted)) {
    mutations.push(deleteRecord(tx, record.id));
  }
  for (const [prev, next] of Object.values(updated)) {
    if (prev.typeName === "shape" && next.typeName === "shape") {
      mutations.push(updateShape(tx, getUpdateShapeProps(prev, next)));
    } else {
      mutations.push(createRecord(tx, next));
    }
  }
  return Promise.allSettled(mutations);
}

export const mutators = {
  createRecord,
  deleteRecord,

  updateFromStore,

  moveShape,
  resizeShape,
  rotateShape,
  updateShape,
}

export type M = typeof mutators;
