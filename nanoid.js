/**
 * Replaces nanoid with base62-encoded uuidv4.
 */
import short from "short-uuid";
const base62 = short("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz");
const nanoid = () => base62.new();
export default nanoid;
export { nanoid };