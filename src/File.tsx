import { useCallback } from "react";
import {
  Tldraw,
  createSessionStateSnapshotSignal,
  loadSessionStateSnapshotIntoStore,
  react,
  useLocalStorageState,
} from "@tldraw/tldraw";
import "@tldraw/tldraw/tldraw.css";
import { useParams } from "react-router-dom";
import { useReflectStore } from "./useReflectStore";
import { getUUIDFromShortId } from "./uuid";
import { UrlState } from "./UrlState";
const { VITE_REFLECT_SERVER: server = "http://localhost:8080" } = import.meta.env;

function File() {
  const params = useParams();

  // Retrieve userInfo from localStorage. Replace with auth API in production.
  const [{ userId, name }] = useLocalStorageState("user", JSON.parse(localStorage.getItem("user")!));

  const store = useReflectStore({
    userId: userId as string,
    roomId: getUUIDFromShortId(params.fileId!),
    server,
  });

  const onMount = useCallback(function onMount(editor) {
    editor.user.updateUserPreferences({
      name,
    });

    const store = editor.store;
    const disposables = new Set<() => void>();

    /**
     * Persist session state in localStorage.
     */
    const sessionStateInit = JSON.parse(localStorage.getItem("TLDRAW_INSTANCE_STATE"));
    if (sessionStateInit) loadSessionStateSnapshotIntoStore(store, sessionStateInit);
    const sessionStateSnapshot = createSessionStateSnapshotSignal(store);
    disposables.add(
      react("when session state changes", function syncSessionStateToLocalStorage() {
        const session = sessionStateSnapshot.value;
        requestAnimationFrame(() => {
          if (session) localStorage.setItem("TLDRAW_INSTANCE_STATE", JSON.stringify(session));
        });
      })
    );

    return () => {
      disposables.forEach(dispose => dispose());
      disposables.clear();
    };
  }, []);

  return (
    <Tldraw store={store} onMount={onMount} inferDarkMode={true}>
      <UrlState />
    </Tldraw>
  );
}

export default File;
