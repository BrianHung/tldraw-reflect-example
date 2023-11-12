import { clamp, useEditor } from "@tldraw/tldraw";
import { Box2dModel, TLPageId } from "@tldraw/tldraw";
import { debounce } from "@tldraw/tldraw";
import { useEffect } from "react";
import { react } from "@tldraw/tldraw";

/**
 * Source code
 * https://github.com/tldraw/tldraw/pull/1402/files
 */

// https://github.com/tldraw/tldraw/blob/main/packages/editor/src/lib/constants.ts
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;

const PARAMS = {
  viewport: "viewport",
  page: "page",
} as const;
type Params = Record<keyof typeof PARAMS, string>;

const viewportFromString = (str: string) => {
  const [x, y, w, h] = str.split(",").map(n => parseInt(n, 10));
  return { x, y, w, h };
};

const viewportToString = ({ x, y, w, h }: { x: number; y: number; w: number; h: number }, precision = 0) => {
  return `${x.toFixed(precision)},${y.toFixed(precision)},${w.toFixed(precision)},${h.toFixed(precision)}`;
};

export function useUrlState(changeUrl: (params: Params) => void) {
  const editor = useEditor();
  const onChangeUrl = useEvent(changeUrl);

  useEffect(() => {
    if (!editor) return;

    const url = new URL(location.href);
    if (url.searchParams.has(PARAMS.viewport)) {
      editor.updateViewportScreenBounds();
      const newViewportRaw = url.searchParams.get(PARAMS.viewport);
      if (newViewportRaw) {
        try {
          const viewport = viewportFromString(newViewportRaw);
          const { x, y, w, h } = viewport;
          const { w: sw, h: sh } = editor.viewportScreenBounds;

          const zoom = clamp(Math.min(sw / w, sh / h), MIN_ZOOM, MAX_ZOOM);
          editor.setCamera({
            x: -x + (sw - w * zoom) / 2 / zoom,
            y: -y + (sh - h * zoom) / 2 / zoom,
            z: zoom,
          });
        } catch (err) {
          console.error(err);
        }
      }
    }
    if (url.searchParams.has(PARAMS.page)) {
      const newPageId = url.searchParams.get(PARAMS.page);
      if (newPageId) {
        if (editor.store.has(newPageId as TLPageId)) {
          editor.setCurrentPage(newPageId as TLPageId);
        }
      }
    }

    const handleChange = debounce((viewport: Box2dModel, pageId: TLPageId) => {
      if (!viewport) return;
      if (!pageId) return;
      onChangeUrl({ [PARAMS.viewport]: viewportToString(viewport), [PARAMS.page]: pageId });
    }, 100);

    const unsubscribe = react("urlState", () => {
      handleChange(editor.viewportPageBounds, editor.currentPageId);
    });

    return () => {
      handleChange.cancel();
      unsubscribe();
    };
  }, [editor, onChangeUrl]);
}

import { useCallback, useDebugValue, useLayoutEffect, useRef } from "react";

/**
 * Allows you to define event handlers that can read the latest props/state but has a stable
 * function identity.
 *
 * These event callbacks may not be called in React render functions! An error won't be thrown, but
 * in the real implementation it would be!
 *
 * Uses a modified version of the user-land implementation included in the [`useEvent()` RFC][1].
 * Our version until such a hook is available natively.
 *
 * The RFC was closed on 27 September 2022, the React team plans to come up with a new RFC to
 * provide similar functionality in the future. We will migrate to this functionality when
 * available.
 *
 * IMPORTANT CAVEAT: You should not call event callbacks in layout effects of React component
 * children! Internally this hook uses a layout effect and parent component layout effects run after
 * child component layout effects. Use this hook responsibly.
 *
 * [1]: https://github.com/reactjs/rfcs/pull/220
 *
 * @internal
 */
export function useEvent<Args extends Array<unknown>, Result>(
  handler: (...args: Args) => Result
): (...args: Args) => Result {
  const handlerRef = useRef<(...args: Args) => Result>();

  // In a real implementation, this would run before layout effects
  useLayoutEffect(() => {
    handlerRef.current = handler;
  });

  useDebugValue(handler);

  return useCallback((...args: Args) => {
    // In a real implementation, this would throw if called during render
    const fn = handlerRef.current;
    if (fn === undefined) throw Error("fn does not exist");
    return fn(...args);
  }, []);
}
