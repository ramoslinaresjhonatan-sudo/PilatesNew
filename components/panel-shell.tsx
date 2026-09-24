"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useApiResource } from "@/hooks/use-api-resource";
import { useAuthSession } from "@/hooks/use-auth-session";
import { apiRequest } from "@/lib/api";
import { clearSession } from "@/lib/auth";
import type { ProfileResponse } from "@/lib/types";
import { AppIcon } from "./app-icon";
import { AuthGuard } from "./auth-guard";
import { Brand } from "./brand";
import { PanelProfileProvider } from "./panel-profile-context";
import { ProfileEditorModal } from "./profile-editor-modal";

export function PanelShell({
  children,
  clientArea = false,
}: {
  children: React.ReactNode;
  clientArea?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useAuthSession();
  const profile = useApiResource<ProfileResponse>("/perfil", true);
  const [profileOpen, setProfileOpen] = useState(false);
  const roles = profile.data?.roles || session?.user.roles || [];
  /* Recepción usa el mismo lienzo cálido que Cliente para mantener un solo estilo entre las 3 vistas. */
  const isReception =
    !clientArea &&
    roles.some((role) => ["RECEPCION", "RECEPCIONISTA"].includes(role)) &&
    !roles.includes("ADMINISTRADOR");
  const useWarmHeader = clientArea || isReception;
  /* El área de cliente también usa el lienzo abierto de Agenda, sin menú de módulos. */
  const homePath = clientArea ? "/mi-panel" : "/panel";
  const usesOpenModuleLayout =
    clientArea ||
    pathname === "/panel" ||
    pathname.startsWith("/panel/modulos/");

  useEffect(() => {
    if (pathname !== homePath) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("perfil") !== "editar") return;
    const frame = window.requestAnimationFrame(() => setProfileOpen(true));
    url.searchParams.delete("perfil");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
    return () => window.cancelAnimationFrame(frame);
  }, [homePath, pathname]);

  async function logout() {
    try {
      await apiRequest("/auth/logout", { method: "POST", authenticated: true });
    } catch {
      // El cierre local no depende de que el servidor siga disponible.
    }
    clearSession();
    router.replace("/");
  }

  return (
    <AuthGuard
      backofficeOnly={!clientArea}
      clientOnly={clientArea}
      unauthorizedPath="/"
    >
      <PanelProfileProvider value={profile}>
        <div
          className={`main-layout${usesOpenModuleLayout ? " main-layout--open-module" : ""}${clientArea ? " client-house" : ""}${isReception ? " client-house reception-house" : ""}`}
        >
          <header className="app-header">
            <Link
              className="app-header__brand"
              href={homePath}
              aria-label="Ir al inicio de mi panel"
            >
              <Brand light />
            </Link>
            <div className="app-header__actions">
              {!useWarmHeader && <span className="app-header__user">{roles.join(" \u00b7 ") || "USUARIO"}</span>}
              {useWarmHeader ? <details className="client-profile-menu">
                <summary aria-label="Abrir menú de perfil"><AppIcon name="profile" /></summary>
                <div className="client-profile-menu__content">
                  <button type="button" onClick={(event) => {
                    event.currentTarget.closest('details')?.removeAttribute('open');
                    setProfileOpen(true);
                  }}>Mi perfil</button>
                  <button type="button" onClick={logout}>Cerrar sesión</button>
                </div>
              </details> : <>
              <details className="app-header__notifications">
                <summary aria-label="Abrir notificaciones">
                  <AppIcon name="bell" />
                </summary>
                <div className="app-header__notifications-panel">
                  <strong>Notificaciones</strong>
                  <span aria-hidden="true">
                    <AppIcon name="bell" />
                  </span>
                  <p>No tienes notificaciones nuevas.</p>
                </div>
              </details>
              <button
                className="app-header__profile"
                type="button"
                aria-label="Editar mi perfil"
                onClick={() => setProfileOpen(true)}
              >
                <AppIcon name="profile" />
              </button>
              <button
                className="app-header__logout"
                type="button"
                onClick={logout}
              >
                Salir
              </button>
              </>}
            </div>
          </header>

          <main className="main-layout__content">{children}</main>

          {session && (
            <ProfileEditorModal
              session={session}
              profile={profile.data}
              open={profileOpen}
              onClose={() => setProfileOpen(false)}
              onUpdated={profile.retry}
            />
          )}
        </div>
      </PanelProfileProvider>
    </AuthGuard>
  );
}
