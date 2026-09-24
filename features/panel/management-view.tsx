"use client";

import Link from "next/link";
import { useState } from "react";
import { usePanelProfile } from "@/components/panel-profile-context";
import { StatusState } from "@/components/status-state";
import { useAuthSession } from "@/hooks/use-auth-session";
import { useApiResource } from "@/hooks/use-api-resource";
import { canAccessManagementModule, MANAGEMENT_MODULES } from "@/lib/catalog";
import type {
  Activity,
  AdminMembership,
  AdminPayment,
  ImageAsset,
  LandingSection,
  MembershipOrder,
  MembershipPlan,
  PaginatedClients,
  PaymentReconciliationQueue,
  ScheduleEnrollment,
  StaffMember,
  StaffRole,
  WeeklyScheduleItem,
} from "@/lib/types";
import { ActivityManager } from "./activity-manager";
import { EventManager } from "./event-manager";
import { ClientManager, type ClientListStatus, type ClientLegacyStatus } from "./client-manager";
import { EnrollmentManager } from "./enrollment-manager";
import { GalleryManager } from "./gallery-manager";
import { MembershipModule } from "./membership-module";
import { PaymentManager } from "./payment-manager";
import { RoleAccessManager } from "./role-access-manager";
import { ScheduleManager } from "./schedule-manager";
import { ScheduleOverview } from "./schedule-overview";
import { StaffManager } from "./staff-manager";

function ResourceError({
  title,
  error,
  retry,
}: {
  title: string;
  error: string;
  retry: () => void;
}) {
  return (
    <StatusState
      kind="error"
      title={title}
      description={error}
      actionLabel="Reintentar"
      onAction={retry}
    />
  );
}

export function ManagementModule({ moduleSlug }: { moduleSlug: string }) {
  const managementModule = MANAGEMENT_MODULES.find(
    (item) => item.slug === moduleSlug,
  );
  const profile = usePanelProfile();
  const session = useAuthSession();
  const roles = profile.data?.roles || session?.user.roles || [];
  const permissions = profile.data?.permisos || session?.user.permisos || [];
  const canManageSchedule = roles.includes("ADMINISTRADOR") || permissions.includes("schedule.manage");
  const canManageMemberships = roles.includes("ADMINISTRADOR") || permissions.includes("memberships.manage");
  const accessResolved = Boolean(profile.data || session?.user.permisos);
  const allowed = Boolean(
    accessResolved &&
    managementModule &&
    canAccessManagementModule(managementModule, roles, permissions),
  );
  const enabled = (slug: string) => allowed && moduleSlug === slug;
  const [clientSearch, setClientSearch] = useState("");
  const [clientStatus, setClientStatus] = useState<ClientListStatus>("ACTIVOS");
  const clientEndpoint = `/cliente?pagina=1&limite=50&estado=${clientStatus}${clientSearch.trim() ? `&busqueda=${encodeURIComponent(clientSearch.trim())}` : ""}`;

  const clients = useApiResource<PaginatedClients>(
    enabled("clientes") ? clientEndpoint : null,
    true,
  );

  const [legacyStatus, setLegacyStatus] = useState<ClientLegacyStatus>("PENDIENTE");
  const [legacyFrom, setLegacyFrom] = useState("");
  const [legacyTo, setLegacyTo] = useState("");
  const clientMigrationEndpoint = `/cliente?pagina=1&limite=100&estado=TODOS&estado_migracion=${legacyStatus}${legacyFrom ? `&confirmado_desde=${legacyFrom}` : ""}${legacyTo ? `&confirmado_hasta=${legacyTo}` : ""}`;
  const clientMigration = useApiResource<PaginatedClients>(
    enabled("clientes") ? clientMigrationEndpoint : null,
    true,
  );
  const staff = useApiResource<StaffMember[]>(
    enabled("personal") || (enabled("agenda") && canManageSchedule)
      ? "/personal?incluir_anulados=true"
      : null,
    true,
  );
  const staffActivities = useApiResource<Activity[]>(
    enabled("personal") ? "/admin/actividad" : null,
    true,
  );
  const staffRoles = useApiResource<StaffRole[]>(
    enabled("personal") ? "/personal/rol" : null,
    true,
  );
  const membershipPlans = useApiResource<MembershipPlan[]>(
    enabled("membresias") ? "/admin/plan-membresia" : null,
    true,
  );
  const memberships = useApiResource<AdminMembership[]>(
    enabled("membresias") ? "/membresia" : null,
    true,
  );
  const membershipActivities = useApiResource<Activity[]>(
    enabled("membresias") && canManageMemberships ? "/admin/actividad" : null,
    true,
  );
  const activities = useApiResource<Activity[]>(
    enabled("disciplinas") || (enabled("agenda") && canManageSchedule) ? "/admin/actividad" : null,
    true,
  );
  const schedule = useApiResource<WeeklyScheduleItem[]>(
    enabled("agenda") && canManageSchedule ? "/agenda/semanal" : null,
    true,
  );
  const payments = useApiResource<AdminPayment[]>(
    enabled("pagos") ? "/pago" : null,
    true,
  );
  const orders = useApiResource<MembershipOrder[]>(
    enabled("pagos") ? "/orden-membresia" : null,
    true,
  );
  const reconciliation = useApiResource<PaymentReconciliationQueue>(
    enabled("pagos") ? "/pago/conciliacion" : null,
    true,
  );
  const enrollments = useApiResource<ScheduleEnrollment[]>(
    enabled("inscripciones") ? "/inscripcion" : null,
    true,
  );
  const landingSections = useApiResource<LandingSection[]>(
    enabled("galeria") ? "/landing/seccion" : null,
    true,
  );
  const images = useApiResource<ImageAsset[]>(
    enabled("galeria") ? "/imagen" : null,
    true,
  );

  const isAdmin = roles.includes("ADMINISTRADOR");
  const canManageRoles = isAdmin || permissions.includes("roles.manage");

  if (!managementModule)
    return (
      <main className="panel-page">
        <StatusState
          kind="error"
          title="Módulo no encontrado"
          description="La sección solicitada no forma parte del panel disponible."
        />
        <Link className="text-link" href="/panel#modulos">
          Volver a módulos
        </Link>
      </main>
    );

  const personalLoading =
    staff.loading || staffActivities.loading || staffRoles.loading;
  const membershipLoading =
    membershipPlans.loading || membershipActivities.loading;
  const agendaLoading = activities.loading || staff.loading || schedule.loading;
  const paymentsLoading = payments.loading || orders.loading;
  // Todos los módulos comparten el lienzo abierto de Agenda: más espacio útil
  // y una sola jerarquía visual, sin una tarjeta envolvente adicional.
  const usesOpenLayout = Boolean(managementModule);
  const usesOperationsStyle = Boolean(managementModule);

  return (
    <main
      className={`panel-page panel-module panel-module--${moduleSlug}${usesOpenLayout ? " panel-module--open" : ""}${usesOperationsStyle ? " panel-module--operations" : ""}`}
    >
      <Link className="back-link" href="/panel#modulos">
        ← Todos los módulos
      </Link>
      {!usesOpenLayout && (
        <header className="panel-page-heading">
          <div>
            <p className="section-eyebrow">{managementModule.eyebrow}</p>
            <h1>{managementModule.title}</h1>
            {managementModule.description && (
              <p>{managementModule.description}</p>
            )}
          </div>
        </header>
      )}
      {usesOpenLayout && ["disciplinas", "membresias", "pagos", "inscripciones", "galeria", "certificaciones"].includes(moduleSlug) && (
        <header className="module-view-heading">
          <h1>{managementModule.title}</h1>
          {managementModule.description && <p>{managementModule.description}</p>}
        </header>
      )}
      {profile.loading && (
        <StatusState
          kind="loading"
          title="Verificando acceso"
          description="Estamos consultando los permisos asignados a tu rol."
        />
      )}
      {profile.error && (
        <StatusState
          kind="error"
          title="No pudimos verificar tu acceso"
          description={profile.error}
          actionLabel="Reintentar"
          onAction={profile.retry}
        />
      )}
      {profile.data && !allowed && (
        <StatusState
          kind="error"
          title="Módulo no asignado"
          description="Tu sesión es válida, pero tu rol no tiene un permiso asociado a este módulo."
        />
      )}

      {profile.data && allowed && moduleSlug === "roles" && (
        <RoleAccessManager canManage={canManageRoles} />
      )}
      {profile.data && allowed && moduleSlug === "eventos" && <EventManager canManage={isAdmin || permissions.includes('events.manage')} />}
      {profile.data && allowed && moduleSlug === "clientes" && (
        <ClientManager
          resource={clients}
          search={clientSearch}
          onSearch={setClientSearch}
          status={clientStatus}
          onStatus={setClientStatus}
          migrationResource={clientMigration}
          legacyStatus={legacyStatus}
          onLegacyStatus={setLegacyStatus}
          legacyFrom={legacyFrom}
          onLegacyFrom={setLegacyFrom}
          legacyTo={legacyTo}
          onLegacyTo={setLegacyTo}
        />
      )}

      {profile.data &&
        allowed &&
        moduleSlug === "personal" &&
        personalLoading && (
          <StatusState
            kind="loading"
            title="Cargando personal"
            description="Consultando integrantes y especialidades."
          />
        )}
      {profile.data && allowed && moduleSlug === "personal" && staff.error && (
        <ResourceError
          title="No pudimos cargar el personal"
          error={staff.error}
          retry={staff.retry}
        />
      )}
      {profile.data &&
        allowed &&
        moduleSlug === "personal" &&
        staffActivities.error && (
          <ResourceError
            title="No pudimos cargar las especialidades"
            error={staffActivities.error}
            retry={staffActivities.retry}
          />
        )}
      {profile.data &&
        allowed &&
        moduleSlug === "personal" &&
        staffRoles.error && (
          <ResourceError
            title="No pudimos cargar los roles asignables"
            error={staffRoles.error}
            retry={staffRoles.retry}
          />
        )}
      {profile.data &&
        allowed &&
        moduleSlug === "personal" &&
        !personalLoading &&
        !staff.error &&
        !staffActivities.error &&
        !staffRoles.error && (
          <StaffManager
            staff={staff.data || []}
            activities={staffActivities.data || []}
            roles={staffRoles.data || []}
            rolesLoading={staffRoles.loading}
            reload={staff.retry}
          />
        )}

      {profile.data &&
        allowed &&
        moduleSlug === "membresias" &&
        membershipLoading && (
          <StatusState
            kind="loading"
            title="Cargando planes"
            description="Consultando planes y actividades disponibles."
          />
        )}
      {profile.data &&
        allowed &&
        moduleSlug === "membresias" &&
        membershipPlans.error && (
          <ResourceError
            title="No pudimos cargar los planes"
            error={membershipPlans.error}
            retry={membershipPlans.retry}
          />
        )}
      {profile.data &&
        allowed &&
        moduleSlug === "membresias" &&
        membershipActivities.error && (
          <ResourceError
            title="No pudimos cargar las actividades"
            error={membershipActivities.error}
            retry={membershipActivities.retry}
          />
        )}
      {profile.data &&
        allowed &&
        moduleSlug === "membresias" &&
        !membershipLoading &&
        !membershipPlans.error &&
        !membershipActivities.error && (
          <MembershipModule
            canManage={canManageMemberships}
            plans={membershipPlans.data || []}
            activities={membershipActivities.data || []}
            memberships={memberships.data || []}
            membershipsLoading={memberships.loading}
            membershipsError={memberships.error}
            retryMemberships={memberships.retry}
            reloadPlans={membershipPlans.retry}
          />
        )}

      {profile.data &&
        allowed &&
        moduleSlug === "disciplinas" &&
        activities.loading && (
          <StatusState
            kind="loading"
            title="Cargando disciplinas"
            description="Consultando las disciplinas."
          />
        )}
      {profile.data &&
        allowed &&
        moduleSlug === "disciplinas" &&
        activities.error && (
          <ResourceError
            title="No pudimos cargar las disciplinas"
            error={activities.error}
            retry={activities.retry}
          />
        )}
      {profile.data &&
        allowed &&
        moduleSlug === "disciplinas" &&
        !activities.loading &&
        !activities.error && (
          <ActivityManager
            activities={activities.data || []}
            reload={activities.retry}
          />
        )}

      {profile.data && allowed && moduleSlug === "agenda" && agendaLoading && (
        <StatusState
          kind="loading"
          title="Cargando agenda"
          description="Consultando horarios, clases, coaches y salas."
        />
      )}
      {profile.data && allowed && moduleSlug === "agenda" && schedule.error && (
        <ResourceError
          title="No pudimos cargar la agenda"
          error={schedule.error}
          retry={schedule.retry}
        />
      )}
      {profile.data &&
        allowed &&
        moduleSlug === "agenda" &&
        activities.error && (
          <ResourceError
            title="No pudimos cargar las disciplinas"
            error={activities.error}
            retry={activities.retry}
          />
        )}
      {profile.data && allowed && moduleSlug === "agenda" && staff.error && (
        <ResourceError
          title="No pudimos cargar los coaches"
          error={staff.error}
          retry={staff.retry}
        />
      )}
      {profile.data &&
        allowed &&
        moduleSlug === "agenda" &&
        !agendaLoading &&
        !schedule.error &&
        !activities.error &&
        !staff.error && (
          canManageSchedule ? <ScheduleManager
            items={schedule.data || []}
            classes={activities.data || []}
            staff={staff.data || []}
            reload={schedule.retry}
          /> : <ScheduleOverview />
        )}

      {profile.data && allowed && moduleSlug === "pagos" && paymentsLoading && (
        <StatusState
          kind="loading"
          title="Cargando pagos"
          description="Consultando pagos y órdenes de membresía."
        />
      )}
      {profile.data && allowed && moduleSlug === "pagos" && payments.error && (
        <ResourceError
          title="No pudimos cargar los pagos"
          error={payments.error}
          retry={payments.retry}
        />
      )}
      {profile.data && allowed && moduleSlug === "pagos" && orders.error && (
        <ResourceError
          title="No pudimos cargar las órdenes"
          error={orders.error}
          retry={orders.retry}
        />
      )}
      {profile.data &&
        allowed &&
        moduleSlug === "pagos" &&
        !paymentsLoading &&
        !payments.error &&
        !orders.error && (
          <PaymentManager
            payments={payments.data || []}
            orders={orders.data || []}
            reconciliation={reconciliation.data}
            reconciliationLoading={reconciliation.loading}
            reconciliationError={reconciliation.error}
            retryReconciliation={reconciliation.retry}
          />
        )}

      {profile.data &&
        allowed &&
        moduleSlug === "inscripciones" &&
        enrollments.loading && (
          <StatusState
            kind="loading"
            title="Cargando inscripciones"
            description="Consultando reservas y consumos registrados."
          />
        )}
      {profile.data &&
        allowed &&
        moduleSlug === "inscripciones" &&
        enrollments.error && (
          <ResourceError
            title="No pudimos cargar las inscripciones"
            error={enrollments.error}
            retry={enrollments.retry}
          />
        )}
      {profile.data &&
        allowed &&
        moduleSlug === "inscripciones" &&
        !enrollments.loading &&
        !enrollments.error && (
          <EnrollmentManager enrollments={enrollments.data || []} />
        )}

      {profile.data &&
        allowed &&
        moduleSlug === "galeria" &&
        landingSections.loading && (
          <StatusState
            kind="loading"
            title="Cargando contenido visual"
            description="Consultando secciones e imágenes de la landing."
          />
        )}
      {profile.data &&
        allowed &&
        moduleSlug === "galeria" &&
        landingSections.error && (
          <ResourceError
            title="No pudimos cargar las secciones"
            error={landingSections.error}
            retry={landingSections.retry}
          />
        )}
      {profile.data &&
        allowed &&
        moduleSlug === "galeria" &&
        !landingSections.loading &&
        !landingSections.error && (
          <GalleryManager
            sections={landingSections.data || []}
            images={images.data || []}
            imagesLoading={images.loading}
            imagesError={images.error}
            retryImages={images.retry}
            reloadSections={landingSections.retry}
          />
        )}

      {profile.data && allowed && moduleSlug === "certificaciones" && (
        <StatusState
          kind="info"
          title="Módulo en preparación"
          description="Este módulo todavía no está disponible. Lo vamos a habilitar más adelante."
        />
      )}
    </main>
  );
}
