import React, { useMemo } from "react";
import { SiteWorkspace } from "./LiveApp.jsx";
import { createWireframeDemo } from "./wireframe-demo.mjs";
export default function WireframeDemo() {
  const { api, site, user } = useMemo(createWireframeDemo, []);
  return (
    <>
      <div className="demo-mode-banner">
        모의 화면 · 예시 데이터이며 서버에 저장되지 않아요.{" "}
        <a href={location.pathname}>서버 화면으로 이동</a>
      </div>
      <SiteWorkspace
        api={api}
        site={site}
        user={user}
        sites={[site]}
        changeSite={() => {}}
        createSite={() => {
          location.href = location.pathname;
        }}
        reloadSites={() => {}}
        logout={() => {
          location.href = location.pathname;
        }}
      />
    </>
  );
}
