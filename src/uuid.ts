import short from "short-uuid";
import { validate as isUUID } from "uuid";
const base62 = short("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz");
export const getShortUUID = (uuid?: string) => uuid ? base62.fromUUID(uuid) : base62.new();
export const getUUIDFromShortId = (shortId: string) => isUUID(shortId)? shortId : base62.toUUID(shortId);
export { isUUID }