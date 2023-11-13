import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider, redirect } from "react-router-dom";
import "./index.css";
import "./index.css";

import File from "./File";

import { getRandomUser } from "./getRandomUser";
import { getShortUUID, isUUID, getUUIDFromShortId } from "./uuid";

function fileWithValidUserAndId({ params }) {
  // Check that the userInfo exists.
  const user = localStorage.getItem("user");
  if (!user) localStorage.setItem("user", JSON.stringify(getRandomUser()));
  // Check that the fileId is a valid UUID.
  if (!params.fileId || !isUUID(getUUIDFromShortId(params.fileId as string)))
    return redirect(`/file/${getShortUUID()}`);
  return null;
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <div></div>,
    loader: () => redirect(`/f/${getShortUUID()}`),
  },
  {
    path: "/file/:fileId",
    element: <File />,
    loader: fileWithValidUserAndId,
  },
  {
    path: "/f/:fileId",
    element: <File />,
    loader: fileWithValidUserAndId,
  },
  {
    path: "*",
    element: <div></div>,
    loader: () => redirect(`/f/${getShortUUID()}`),
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
