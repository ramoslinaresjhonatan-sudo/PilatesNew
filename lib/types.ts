export type ImageOrigin = 'GALERIA' | 'PERSONAL' | 'CLASES' | 'MEMBRESIAS' | 'BIBLIOTECA' | (string & {});

export type HouseEvent = {
  id: string; actividad_id: string; nombre: string; descripcion: string;
  fecha_inicio: string; fecha_fin: string; cupos: number; cupos_disponibles: number;
  estado: string; tiene_acceso: boolean; puede_reservar: boolean;
  inscripcion: { id: string; estado: string } | null;
};
export type EventAttendee = { id: string; cliente: string; correo: string; plan: string; estado: string };

export type ImageAsset = {
  id: string;
  url: string;
  tipo?: string;
  texto_alt?: string | null;
  descripcion?: string | null;
  mime_type?: string | null;
  ancho_px?: number | null;
  alto_px?: number | null;
  estado?: string;
  usos?: { secciones: number; personal: number; clases: number; membresias: number };
  usos_total?: number;
  /** Modulo dueno de la imagen; BIBLIOTECA cuando no la usa nadie. */
  origen?: ImageOrigin;
  /** false cuando pertenece a Personal, Disciplinas o Membresias. */
  administrable?: boolean;
};

export type KnownActivityCategory = 'CLASE' | 'SESION' | 'EXPERIENCIA' | 'EVENTO';
export type ActivityCategory = KnownActivityCategory | (string & {});

export type ActivityCategoryRecord = {
  id: string;
  codigo: ActivityCategory;
  nombre: string;
  titulo_landing?: string | null;
  subtitulo_landing?: string | null;
  descripcion?: string | null;
  orden?: number;
  visible_landing?: boolean;
  estado?: string;
};

export type Activity = {
  id: string;
  categoria: ActivityCategory;
  nombre: string;
  slug: string;
  subtitulo?: string | null;
  descripcion_corta?: string | null;
  descripcion_larga?: string | null;
  duracion_minutos?: number | null;
  nivel_intensidad?: 'INICIAL' | 'INTERMEDIO' | 'AVANZADO' | null;
  cupos_predeterminados?: number | null;
  requiere_reserva?: boolean;
  visible_landing?: boolean;
  orden?: number;
  estado?: string;
  fecha_creacion?: string;
  fecha_actualizacion?: string;
  imagenes?: ImageAsset[];
};

export type Benefit = {
  id: string;
  plan_membresia_id?: string;
  nombre: string;
  cantidad_incluida?: number | null;
  sesiones_ilimitadas?: boolean;
  periodicidad?: string;
  orden?: number;
  actividades?: Activity[];
};

export type MembershipPlan = {
  acceso_eventos?: boolean;
  id: string;
  nombre: string;
  slug: string;
  subtitulo?: string | null;
  descripcion?: string | null;
  limite_clases?: number | null;
  limite_clases_semana?: number | null;
  clases_ilimitadas: boolean;
  duracion_dias: number;
  precio: number | string;
  moneda: string;
  destacado?: boolean;
  visible_landing?: boolean;
  orden?: number;
  estado?: string;
  vigente_desde?: string | null;
  vigente_hasta?: string | null;
  fecha_creacion?: string;
  fecha_actualizacion?: string;
  beneficios?: Benefit[];
  imagenes?: ImageAsset[];
};

export type ActiveSessionBenefit = {
  id: string;
  nombre: string;
  sesiones_ilimitadas?: boolean;
  cantidad_incluida?: number | null;
  sesiones_usadas?: number;
  sesiones_reservadas?: number;
  sesiones_disponibles?: number | null;
  periodicidad?: 'VIGENCIA' | 'SEMANA' | 'MES' | string;
  actividades?: Activity[];
};

export type ActiveMembership = {
  acceso_eventos?: boolean;
  id: string;
  estado: 'ACTIVA' | 'PAUSADA' | 'VENCIDA' | 'CANCELADA' | string;
  fecha_inicio: string;
  fecha_fin: string;
  nombre_plan_snapshot?: string;
  limite_clases_snapshot?: number | null;
  limite_clases_semana_snapshot?: number | null;
  clases_adicionales?: number;
  clases_ilimitadas_snapshot?: boolean;
  clases_usadas?: number;
  clases_reservadas?: number;
  clases_disponibles?: number | null;
  precio_pagado?: number | string;
  moneda?: string;
  plan?: MembershipPlan;
  beneficios?: ActiveSessionBenefit[];
};

export type UserSummary = {
  id: string;
  nombre: string;
  apellido_paterno?: string | null;
  apellido_materno?: string | null;
  correo?: string | null;
  telefono?: string | null;
  estado?: string;
  roles?: Array<{ id: string; nombre: string }>;
};

export type ClientSummary = {
  id?: string;
  documento?: string | null;
  fecha_nacimiento?: string | null;
  contacto_emergencia?: string | null;
  telefono_emergencia?: string | null;
  observaciones?: string | null;
  estado?: string;
  membresia_activa?: ActiveMembership | null;
};

export type Coach = {
  id: string;
  usuario_id?: string;
  presentacion?: string | null;
  biografia?: string | null;
  experiencia_anios?: number | null;
  visible_landing?: boolean;
  orden?: number;
  estado?: string;
  fecha_creacion?: string;
  fecha_actualizacion?: string;
  usuario: UserSummary;
  imagenes?: ImageAsset[];
  actividades?: Activity[];
};

export type LandingSection = {
  id: string;
  clave: string;
  titulo: string;
  subtitulo?: string | null;
  descripcion?: string | null;
  llamada_accion?: string | null;
  url_accion?: string | null;
  orden: number;
  estado: string;
  fecha_creacion?: string;
  fecha_actualizacion?: string;
  imagenes?: (ImageAsset & { orden?: number })[];
};

/** Una reserva del propio cliente, para marcar su agenda. */
export type MyEnrollment = {
  coach_imagen?: ImageAsset | null;
  id: string;
  agenda_actividad_id: string;
  agenda_semanal_id?: string | null;
  actividad: string;
  categoria: ActivityCategory;
  fecha_inicio: string;
  fecha_fin: string;
  coach?: string | null;
  estado: string;
  fecha_inscripcion: string;
};

export type ScheduleItem = {
  agenda_actividad_id: string;
  actividad_id: string;
  actividad: string;
  categoria: ActivityCategory;
  imagenes?: ImageAsset[];
  coach_id?: string | null;
  coach?: string | null;
  coach_imagen?: ImageAsset | null;
  fecha_inicio: string;
  fecha_fin: string;
  cupos: number;
  cupos_ocupados: number;
  cupos_disponibles: number;
  estado: string;
  estado_clase: string;
  descripcion_estado?: string | null;
};

/** Regla permanente del itinerario administrativo, sin una fecha concreta. */
export type WeeklyScheduleItem = {
  agenda_semanal_id: string;
  actividad_id: string;
  actividad: string;
  categoria: ActivityCategory;
  imagenes?: ImageAsset[];
  coach_id?: string | null;
  coach?: string | null;
  sala?: string | null;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  cupos: number;
  estado: string;
  observaciones?: string | null;
  alumnas_activas: number;
};

/** Reserva vigente de una alumna en un horario semanal fijo, sin importar la fecha puntual de la clase. */
export type WeeklyScheduleEnrollment = {
  id: string;
  cliente_id: string;
  cliente: string;
  correo: string;
  plan: string;
  estado: string;
  fecha_clase: string;
};

export type AuthUser = {
  id: string;
  nombre: string;
  correo: string;
  roles: string[];
  permisos?: string[];
};

export type StaffRole = {
  id: string;
  nombre: string;
  descripcion?: string | null;
};

export type StaffMember = {
  id: string;
  usuario_id: string;
  /** Id del perfil Coach; es null cuando el integrante no tiene uno. */
  coach_id: string | null;
  /** Rol de acceso principal del integrante. */
  tipo: 'COACH' | 'PERSONAL';
  rol?: string | null;
  roles?: Array<{ id: string; nombre: string }>;
  estado: 'ACTIVO' | 'ANULADO' | string;
  fecha_nacimiento?: string | null;
  presentacion?: string | null;
  biografia?: string | null;
  visible_landing?: boolean;
  usuario: UserSummary;
  imagenes: ImageAsset[];
  actividades: Activity[];
};

export type ClientDirectoryEntry = {
  membresia_actual?: {
    id: string;
    nombre_plan: string;
    estado: string;
    fecha_inicio: string;
    fecha_fin: string;
    clases_ilimitadas: boolean;
    permite_agregar_clases: boolean;
  } | null;
  id: string;
  usuario_id: string;
  nombre: string;
  apellido_paterno?: string | null;
  apellido_materno?: string | null;
  correo: string;
  telefono?: string | null;
  fecha_nacimiento?: string | null;
  edad?: number | null;
  foto_url?: string | null;
  estado: string;
  fecha_registro: string;
  estado_sistema_antiguo: 'PENDIENTE' | 'CARGADO';
  confirmacion_sistema_antiguo?: {
    fecha: string;
    usuario: { id: string; nombre: string } | null;
  } | null;
};

export type AuthSession = {
  token: string;
  expiresAt: string;
  user: AuthUser;
};

export type ProfileResponse = {
  usuario: UserSummary & { cliente?: ClientSummary | null; coach?: Record<string, unknown> | null };
  roles: string[];
  permisos: string[];
  membresia_activa?: ActiveMembership | null;
};

export type PermissionRecord = {
  id: string;
  codigo: string;
  modulo: string;
  accion: string;
  descripcion?: string | null;
  estado?: string;
};

export type RoleWithPermissions = {
  id: string;
  nombre: string;
  descripcion?: string | null;
  estado?: string;
  fecha_creacion?: string;
  fecha_anulacion?: string | null;
  permisos: PermissionRecord[];
};

export type PaginatedUsers = {
  datos: UserSummary[];
  paginacion: { total: number; pagina: number; limite: number; paginas: number };
};

export type PaginatedClients = {
  datos: ClientDirectoryEntry[];
  paginacion: { total: number; pagina: number; limite: number; paginas: number };
  resumen_migracion: { pendientes: number; cargados: number };
};

export type UpcomingBirthdays = { mes: string; cantidad: number };
export type UpcomingBirthdayPerson = { id: string; nombre: string; fecha: string };

export type PanelSummary = {
  clases_activas: number;
  equipo: number;
  clientes: number | null;
  cumpleanos: UpcomingBirthdays | null;
};

export type MembershipMovement = {
  id: string;
  tipo: string;
  dias_ajuste?: number | null;
  clases_ajuste?: number | null;
  clases_adicionales_anteriores?: number | null;
  clases_adicionales_nuevas?: number | null;
  realizado_por_usuario_id?: string;
  estado_anterior?: string | null;
  estado_nuevo?: string | null;
  motivo: string;
  fecha_movimiento: string;
};

export type AdminMembership = ActiveMembership & {
  cliente_id: string;
  cliente: UserSummary;
  plan_membresia_id: string;
  duracion_dias_snapshot: number;
  precio_pagado: number | string;
  moneda: string;
  observaciones?: string | null;
  movimientos?: MembershipMovement[];
};

export type MembershipOrder = {
  id: string;
  codigo: string;
  cliente: string;
  correo: string;
  plan: string;
  monto_total: number | string;
  moneda: string;
  estado: string;
  membresia_id?: string | null;
  expira_en?: string | null;
  fecha_pago?: string | null;
  fecha_creacion: string;
  pagos: number;
};

export type PaymentWebhook = {
  id: string;
  resultado: string;
  detalle_error?: string | null;
  fecha_recepcion: string;
};

export type AdminPayment = {
  id: string;
  orden_membresia_id: string;
  orden_codigo: string;
  cliente: string;
  numero_intento: number;
  proveedor: string;
  vendis_qr_id?: string | null;
  business_code?: string | null;
  monto_solicitado: number | string;
  monto_pagado?: number | string | null;
  moneda: string;
  estado_vendis?: string | null;
  estado: string;
  nombre_pagador?: string | null;
  banco_pagador?: string | null;
  fecha_pago?: string | null;
  fecha_creacion: string;
  webhooks?: PaymentWebhook[];
};

export type PaymentReconciliationQueue = {
  total: number;
  pagos: Array<{
    id: string;
    status: string;
    requestedAmount: number | string;
    paidAmount?: number | string | null;
    currency: string;
    vendisQrId?: string | null;
    createdAt?: string;
    updatedAt?: string;
    membershipOrder?: { code?: string; planNameSnapshot?: string };
    webhookEvents?: Array<{ id: string; errorDetail?: string | null; receivedAt?: string }>;
  }>;
};

export type ScheduleEnrollment = {
  id: string;
  agenda_actividad_id: string;
  actividad: string;
  fecha_inicio: string;
  cliente_id: string;
  cliente: string;
  correo: string;
  membresia_id: string;
  plan: string;
  estado: string;
  fecha_inscripcion: string;
  fecha_confirmacion?: string | null;
  fecha_cancelacion?: string | null;
  observacion?: string | null;
  uso?: { id: string; tipo_acceso: string; estado: string } | null;
};

export type Room = {
  id: string;
  nombre: string;
  descripcion?: string | null;
  capacidad: number;
  estado: string;
};
