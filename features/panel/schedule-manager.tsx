"use client";

import { CSSProperties, FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useConfirm } from "@/components/confirm-dialog";
import { ResilientImage } from "@/components/resilient-image";
import { StatusState } from "@/components/status-state";
import { apiRequest, getErrorMessage, safeAssetUrl } from "@/lib/api";
import type { Activity, StaffMember, WeeklyScheduleEnrollment, WeeklyScheduleItem } from "@/lib/types";

type DayPeriod = "MANANA" | "TARDE" | "NOCHE";

type Form = {
  actividad_id: string;
  coach_id: string;
  periodo: DayPeriod;
  hora_inicio: string;
  duracion_minutos: string;
  dias_semana: number[];
  cupos: string;
  observaciones: string;
};

const WEEK = [
  { day: 1, label: "Lun", full: "Lunes" },
  { day: 2, label: "Mar", full: "Martes" },
  { day: 3, label: "Mié", full: "Miércoles" },
  { day: 4, label: "Jue", full: "Jueves" },
  { day: 5, label: "Vie", full: "Viernes" },
  { day: 6, label: "Sáb", full: "Sábado" },
];

const START_TIMES = Array.from({ length: 29 }, (_, index) => 6 * 60 + index * 30);
const DURATION_MINUTES = [60, 90, 120, 150, 180, 210];
const DAY_PERIODS: Array<{ value: DayPeriod; label: string; startsAt: number; endsAt: number }> = [
  { value: "MANANA", label: "Mañana", startsAt: 6 * 60, endsAt: 12 * 60 },
  { value: "TARDE", label: "Tarde", startsAt: 12 * 60, endsAt: 18 * 60 },
  { value: "NOCHE", label: "Noche", startsAt: 18 * 60, endsAt: 20 * 60 + 30 },
];

const blank = (): Form => ({
  actividad_id: "",
  coach_id: "",
  periodo: "NOCHE",
  hora_inicio: "18:00",
  duracion_minutos: "60",
  dias_semana: [],
  cupos: "12",
  observaciones: "",
});

const time = (value: string) => value.slice(0, 5);
const minutes = (value: string) => {
  const [hours, minutes] = time(value).split(":").map(Number);
  return hours * 60 + minutes;
};
const timelineHour = (value: number) => `${String(Math.floor(value / 60)).padStart(2, "0")}:00`;
const clockValue = (value: number) => {
  const normalized = ((value % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
};
const clockMinutes = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};
const durationLabel = (value: number) => `${Math.floor(value / 60)} h${value % 60 ? " 30 min" : ""}`;
const scheduleDuration = (startsAt: string, endsAt: string) => {
  const difference = minutes(endsAt) - minutes(startsAt);
  return difference > 0 ? difference : difference + 24 * 60;
};
const periodForTime = (value: string): DayPeriod => {
  const timeInMinutes = clockMinutes(value);
  return DAY_PERIODS.find(({ startsAt, endsAt }) => timeInMinutes >= startsAt && timeInMinutes < endsAt)?.value || "NOCHE";
};
const startTimesForPeriod = (period: DayPeriod) => {
  const range = DAY_PERIODS.find(({ value }) => value === period)!;
  return START_TIMES.filter((startTime) => startTime >= range.startsAt && startTime < range.endsAt);
};

function scheduleTone(item: WeeklyScheduleItem) {
  return [...item.actividad_id].reduce((total, character) => total + character.charCodeAt(0), 0) % 4;
}

type TimelineEvent = {
  item: WeeklyScheduleItem;
  day: number;
  start: number;
  end: number;
  startRow: number;
  duration: number;
  lane: number;
  laneCount: number;
};

/** Coloca a la par los eventos que ocupan la misma franja, sin ocultar ninguno. */
function placeOverlaps(events: TimelineEvent[]) {
  const sorted = [...events].sort(
    (left, right) => left.start - right.start || right.end - left.end || left.item.agenda_semanal_id.localeCompare(right.item.agenda_semanal_id),
  );
  const positioned: TimelineEvent[] = [];
  let cluster: TimelineEvent[] = [];
  let clusterEnd = -Infinity;

  const flushCluster = () => {
    if (!cluster.length) return;
    const laneEnds: number[] = [];
    for (const event of cluster) {
      let lane = laneEnds.findIndex((end) => end <= event.start);
      if (lane < 0) lane = laneEnds.length;
      laneEnds[lane] = event.end;
      event.lane = lane;
    }
    const laneCount = laneEnds.length;
    positioned.push(...cluster.map((event) => ({ ...event, laneCount })));
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const event of sorted) {
    if (cluster.length && event.start >= clusterEnd) flushCluster();
    cluster.push(event);
    clusterEnd = Math.max(clusterEnd, event.end);
  }
  flushCluster();
  return positioned;
}

function layoutTimelineEvents(events: TimelineEvent[]) {
  return WEEK.flatMap(({ day }) => placeOverlaps(events.filter((event) => event.day === day)));
}

export function ScheduleManager({
  items,
  classes,
  staff,
  reload,
}: {
  items: WeeklyScheduleItem[];
  classes: Activity[];
  staff: StaffMember[];
  reload: () => void;
}) {
  const [editing, setEditing] = useState<WeeklyScheduleItem | null | undefined>();
  const [form, setForm] = useState<Form>(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<WeeklyScheduleItem | null>(null);
  const [students, setStudents] = useState<WeeklyScheduleEnrollment[] | null>(null);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState("");
  const { confirm, confirmDialog } = useConfirm();
  // Agenda solo admite perfiles Coach activos. Un rol COACH heredado sin perfil
  // real no puede aparecer como opción ni llegar al backend al guardar.
  const coaches = staff.filter((item) => (
    item.estado === "ACTIVO"
    && Boolean(item.coach_id)
    && (item.roles?.some((role) => role.nombre === "COACH") || item.rol === "COACH")
  ));
  const coachesById = useMemo(() => new Map(coaches.map((coach) => [coach.coach_id!, coach])), [coaches]);
  const activeClasses = classes.filter((item) => item.categoria === "CLASE" && item.estado === "ACTIVO");

  const timetable = useMemo(() => {
    const firstMinute = items.length
      ? Math.floor(Math.min(...items.map((item) => minutes(item.hora_inicio))) / 60) * 60
      : 8 * 60;
    const lastMinute = items.length
      ? Math.ceil(Math.max(...items.map((item) => minutes(item.hora_fin))) / 60) * 60
      : 20 * 60;
    const slotCount = Math.max(4, (lastMinute - firstMinute) / 15);

    const events = items
      .map((item) => {
        const start = minutes(item.hora_inicio);
        const rawEnd = minutes(item.hora_fin);
        const end = rawEnd > start ? rawEnd : rawEnd + 24 * 60;

        return {
          item,
          day: item.dia_semana,
          start,
          end,
          startRow: 2 + Math.max(0, Math.floor((start - firstMinute) / 15)),
          duration: Math.max(2, Math.ceil((end - start) / 15)),
          lane: 0,
          laneCount: 1,
        };
      })
      .filter(({ day }) => day >= 1 && day <= 6);

    return {
      firstMinute,
      slotCount,
      hours: Array.from({ length: Math.ceil(slotCount / 4) }, (_, index) => firstMinute + index * 60),
      events: layoutTimelineEvents(events),
    };
  }, [items]);

  const endsAt = clockValue(clockMinutes(form.hora_inicio) + Number(form.duracion_minutos));
  const availableStartTimes = startTimesForPeriod(form.periodo);
  const displayedStartTimes = editing && !availableStartTimes.includes(clockMinutes(form.hora_inicio))
    ? [...availableStartTimes, clockMinutes(form.hora_inicio)].sort((left, right) => left - right)
    : availableStartTimes;

  useEffect(() => {
    if (editing === undefined && !openActionsId && !viewing) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (openActionsId) setOpenActionsId(null);
      else if (viewing) setViewing(null);
      else if (!busy) setEditing(undefined);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [busy, editing, openActionsId, viewing]);

  function open(item?: WeeklyScheduleItem) {
    setOpenActionsId(null);
    setEditing(item ?? null);
    setError("");
    setNotice("");
    setForm(
      item
        ? {
            actividad_id: item.actividad_id,
            coach_id: item.coach_id || "",
            periodo: periodForTime(item.hora_inicio),
            hora_inicio: time(item.hora_inicio),
            duracion_minutos: String(
              DURATION_MINUTES.includes(scheduleDuration(item.hora_inicio, item.hora_fin))
                ? scheduleDuration(item.hora_inicio, item.hora_fin)
                : 60,
            ),
            dias_semana: [item.dia_semana],
            cupos: String(item.cupos),
            observaciones: item.observaciones || "",
          }
        : blank(),
    );
  }
  function change<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  function changePeriod(period: DayPeriod) {
    const firstAvailableTime = clockValue(startTimesForPeriod(period)[0]);
    setForm((current) => ({
      ...current,
      periodo: period,
      hora_inicio: startTimesForPeriod(period).includes(clockMinutes(current.hora_inicio))
        ? current.hora_inicio
        : firstAvailableTime,
    }));
  }
  function toggleDay(day: number) {
    if (editing) return change("dias_semana", [day]);
    change(
      "dias_semana",
      form.dias_semana.includes(day)
        ? form.dias_semana.filter((value) => value !== day)
        : [...form.dias_semana, day].sort(),
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.dias_semana.length)
      return setError("Seleccioná al menos un día de lunes a sábado.");
    const capacity = Number(form.cupos);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 999)
      return setError("Los cupos deben ser un número entero entre 1 y 999.");
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (editing)
        await apiRequest(`/agenda/semanal/${editing.agenda_semanal_id}`, {
          method: "PATCH",
          authenticated: true,
          body: {
            actividad_id: form.actividad_id,
            coach_id: form.coach_id || null,
            dia_semana: form.dias_semana[0],
            cupos: capacity,
            hora_inicio: form.hora_inicio,
            hora_fin: endsAt,
            estado: editing.estado === "BORRADOR" ? "BORRADOR" : "PUBLICADA",
            observaciones: form.observaciones || null,
          },
        });
      else
        await apiRequest("/agenda/semanal", {
          method: "POST",
          authenticated: true,
          body: {
            actividad_id: form.actividad_id,
            coach_id: form.coach_id || null,
            hora_inicio: form.hora_inicio,
            hora_fin: endsAt,
            dias_semana: form.dias_semana,
            cupos: capacity,
            estado: "PUBLICADA",
            observaciones: form.observaciones || null,
          },
        });
      setNotice(editing ? "Horario semanal actualizado correctamente." : "Horarios semanales creados correctamente.");
      setEditing(undefined);
      reload();
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function cancel(item: WeeklyScheduleItem) {
    setOpenActionsId(null);
    const accepted = await confirm({
      title: "Anular horario",
      description: `${item.actividad} · ${time(item.hora_inicio)}–${time(item.hora_fin)}. Se desactivará el horario semanal; las reservas ya existentes se conservan.`,
      confirmLabel: "Anular",
      cancelLabel: "Volver",
      tone: "danger",
    });
    if (!accepted) return;
    setError("");
    setNotice("");
    try {
      await apiRequest(`/agenda/semanal/${item.agenda_semanal_id}`, {
        method: "DELETE",
        authenticated: true,
      });
      setNotice("Horario semanal anulado correctamente.");
      reload();
    } catch (reason) {
      setError(getErrorMessage(reason));
    }
  }

  async function viewStudents(item: WeeklyScheduleItem) {
    setOpenActionsId(null);
    setViewing(item);
    setStudents(null);
    setStudentsError("");
    setStudentsLoading(true);
    try {
      const data = await apiRequest<WeeklyScheduleEnrollment[]>(
        `/agenda/semanal/${item.agenda_semanal_id}/inscripciones`,
        { authenticated: true },
      );
      setStudents(data);
    } catch (reason) {
      setStudentsError(getErrorMessage(reason));
    } finally {
      setStudentsLoading(false);
    }
  }
  function closeStudents() {
    setViewing(null);
    setStudents(null);
    setStudentsError("");
  }

  return (
    <section className="schedule-manager">
      <header className="staff-manager__header">
        <div>
          <h2>Agenda semanal</h2>
          <p>Itinerario fijo de lunes a sábado y coach responsable.</p>
        </div>
        <button
          className="button button-dark"
          type="button"
          disabled={!activeClasses.length}
          title={!activeClasses.length ? "Primero necesitás crear una clase activa" : undefined}
          onClick={() => open()}
        >
          + Armar horarios
        </button>
      </header>
      {!activeClasses.length && <p className="schedule-guidance" role="status">Creá al menos una clase activa antes de armar horarios.</p>}
      {notice && <p className="schedule-notice" role="status">{notice}</p>}
      {editing === undefined && error && <p className="staff-error" role="alert">{error}</p>}
      {!items.length && <p className="schedule-empty" role="status">El itinerario semanal todavía no tiene horarios. Usá “Armar horarios” para agregar el primero.</p>}
      <p className="weekly-agenda-hint">Deslizá horizontalmente para consultar todos los días.</p>
      <div className="weekly-agenda-scroll" tabIndex={0} aria-label="Desliza horizontalmente para ver los días de la agenda">
        <div
          className="weekly-agenda weekly-agenda--timeline"
          role="grid"
          aria-label="Horarios fijos semanales"
          style={{ gridTemplateRows: `3.25rem repeat(${timetable.slotCount}, var(--agenda-slot-height))` } as CSSProperties}
        >
          <div className="weekly-agenda__corner" role="columnheader">Hora</div>
        {WEEK.map(({ day, label, full }) => (
          <div className="weekly-agenda__day" key={day} role="columnheader" style={{ gridColumn: day + 1 }}>
            <span className="weekly-agenda__day-short">{label}</span>
            <span className="weekly-agenda__day-full">{full}</span>
          </div>
        ))}
        {WEEK.map(({ day }) => (
          <div className="weekly-agenda__day-surface" key={day} aria-hidden="true" style={{ gridColumn: day + 1, gridRow: `2 / ${timetable.slotCount + 2}` }} />
        ))}
        {timetable.hours.map((minute) => (
          <time className="weekly-agenda__hour" dateTime={timelineHour(minute)} key={minute} role="rowheader" style={{ gridRow: 2 + (minute - timetable.firstMinute) / 15 }}>
            {timelineHour(minute)}
          </time>
        ))}
          {timetable.events.map(({ item, day, startRow, duration, lane, laneCount }) => (
            (() => {
              const coach = item.coach_id ? coachesById.get(item.coach_id) : undefined;
              const coachImage = safeAssetUrl(coach?.imagenes[0]?.url, "", coach?.imagenes[0]?.id);
              const coachName = item.coach || "Sin instructor asignado";

              return (
                <article
                  className={`weekly-agenda__event weekly-agenda__event--tone-${scheduleTone(item)}`}
                  key={item.agenda_semanal_id}
                  role="gridcell"
                  aria-label={`${item.actividad}, de ${time(item.hora_inicio)} a ${time(item.hora_fin)}, ${coachName}`}
                  title={`${item.actividad} · ${time(item.hora_inicio)}–${time(item.hora_fin)} · ${coachName}`}
                  data-overlap={laneCount > 1 ? "true" : undefined}
                  style={{
                    gridColumn: day + 1,
                    gridRow: `${startRow} / span ${duration}`,
                    justifySelf: "start",
                    width: `calc(${100 / laneCount}% - 0.08rem)`,
                    marginInline: "0.04rem",
                    transform: lane ? `translateX(${lane * 100}%)` : undefined,
                  } as CSSProperties}
                >
                  <span className="weekly-agenda__coach">
                    {coachImage ? (
                      <ResilientImage src={coachImage} alt={`Foto de ${coachName}`} />
                    ) : (
                      <span className="weekly-agenda__coach-initial" aria-hidden="true">{coachName[0]}</span>
                    )}
                    <span className="weekly-agenda__event-details">
                      <strong>{item.actividad}</strong>
                      <time dateTime={item.hora_inicio}>{time(item.hora_inicio)} – {time(item.hora_fin)}</time>
                      <small>{coachName}</small>
                    </span>
                  </span>
                  <span
                    className="weekly-agenda__floating-actions"
                    onBlur={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget)) setOpenActionsId(null);
                    }}
                  >
                    <button
                      className="weekly-agenda__action-trigger"
                      type="button"
                      aria-label={`Acciones para ${item.actividad}`}
                      aria-haspopup="menu"
                      aria-expanded={openActionsId === item.agenda_semanal_id}
                      onClick={() => setOpenActionsId((current) => current === item.agenda_semanal_id ? null : item.agenda_semanal_id)}
                    >⋮</button>
                    {openActionsId === item.agenda_semanal_id && (
                      <span className="weekly-agenda__action-menu" role="menu" aria-label={`Acciones para ${item.actividad}`}>
                        <button type="button" role="menuitem" onClick={() => void viewStudents(item)}>
                          Ver alumnas{item.alumnas_activas > 0 ? ` (${item.alumnas_activas})` : ""}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          disabled={item.alumnas_activas > 0}
                          title={item.alumnas_activas > 0 ? "No se puede editar: ya tiene alumnas inscritas" : undefined}
                          onClick={() => open(item)}
                        >
                          Editar
                        </button>
                        {item.estado !== "ANULADA" && (
                          <button
                            type="button"
                            role="menuitem"
                            className="weekly-agenda__cancel"
                            disabled={item.alumnas_activas > 0}
                            title={item.alumnas_activas > 0 ? "No se puede anular: ya tiene alumnas inscritas" : undefined}
                            onClick={() => void cancel(item)}
                          >
                            Anular
                          </button>
                        )}
                      </span>
                    )}
                  </span>
                </article>
              );
            })()
          ))}
        </div>
      </div>
      {editing !== undefined &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="staff-modal-layer"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !busy)
                setEditing(undefined);
            }}
          >
            <form
              className="membership-modal panel-editor-modal schedule-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="schedule-dialog-title"
              aria-busy={busy}
              onSubmit={submit}
            >
              <header>
                <div>
                  <span>{editing ? "EDITAR HORARIO" : "AGENDA SEMANAL"}</span>
                  <h2 id="schedule-dialog-title">{editing ? editing.actividad : "Configurar horarios"}</h2>
                </div>
                <button type="button" aria-label="Cerrar formulario de horario" disabled={busy} onClick={() => setEditing(undefined)}>
                  ×
                </button>
              </header>
              <div className="membership-modal__body">
                <div className="membership-form-grid">
                  <label>
                    Clase
                    <select
                      autoFocus
                      required
                      value={form.actividad_id}
                      onChange={(event) =>
                        change("actividad_id", event.target.value)
                      }
                    >
                      <option value="">Seleccioná una clase</option>
                      {activeClasses.map((item) => (
                          <option value={item.id} key={item.id}>
                            {item.nombre}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Coach
                    <select
                      value={form.coach_id}
                      onChange={(event) =>
                        change("coach_id", event.target.value)
                      }
                    >
                      <option value="">Sin asignar</option>
                      {coaches.map((item) => (
                        <option value={item.coach_id!} key={item.coach_id}>
                          {item.usuario.nombre}{" "}
                          {item.usuario.apellido_paterno || ""}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <section className="schedule-days" role="group" aria-label="Días de la semana">
                  <div>
                    {WEEK.map(({ day, label, full }) => (
                      <button
                        className={form.dias_semana.includes(day) ? "is-selected" : ""}
                        type="button"
                        key={day}
                        aria-pressed={form.dias_semana.includes(day)}
                        aria-label={full}
                        onClick={() => toggleDay(day)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {editing && <small>Al editar, elegí el único día fijo de este horario.</small>}
                </section>
                <div className="membership-form-grid">
                  <label>
                    Turno
                    <select
                      value={form.periodo}
                      onChange={(event) => changePeriod(event.target.value as DayPeriod)}
                    >
                      {DAY_PERIODS.map((period) => (
                        <option value={period.value} key={period.value}>{period.label}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Hora de inicio
                    <select
                      required
                      value={form.hora_inicio}
                      onChange={(event) => change("hora_inicio", event.target.value)}
                    >
                      {displayedStartTimes.map((startTime) => (
                        <option value={clockValue(startTime)} key={startTime}>
                          {clockValue(startTime)}{startTime % 30 !== 0 ? " (horario actual)" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Duración
                    <select
                      required
                      value={form.duracion_minutos}
                      onChange={(event) => change("duracion_minutos", event.target.value)}
                    >
                      {DURATION_MINUTES.map((duration) => (
                        <option value={duration} key={duration}>{durationLabel(duration)}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Cupos
                    <input
                      required
                      placeholder="Ej.: 12"
                      min="1"
                      max="999"
                      step="1"
                      inputMode="numeric"
                      type="number"
                      value={form.cupos}
                      onChange={(event) => change("cupos", event.target.value)}
                    />
                  </label>
                </div>
                <p className="schedule-duration-preview">Finaliza a las <strong>{endsAt}</strong></p>
                <label>
                  Notas internas
                  <textarea
                    maxLength={500}
                    value={form.observaciones}
                    onChange={(event) => change("observaciones", event.target.value)}
                    placeholder="Ej.: llevar toalla y agua"
                  />
                </label>
                <p className="schedule-duration-preview">Este horario se repetirá cada semana hasta que lo edites o anules.</p>
                {error && <p className="staff-error" role="alert">{error}</p>}
              </div>
              <footer>
                <button
                  type="button"
                  className="text-link"
                  disabled={busy}
                  onClick={() => setEditing(undefined)}
                >
                  Cancelar
                </button>
                <button className="button button-dark" disabled={busy}>
                  {busy
                    ? "Guardando…"
                    : editing
                      ? "Actualizar horario"
                      : "Crear horarios"}
                </button>
              </footer>
            </form>
          </div>,
          document.body,
        )}
      {viewing &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="staff-modal-layer"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeStudents();
            }}
          >
            <div
              className="membership-modal panel-editor-modal schedule-students-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="schedule-students-title"
            >
              <header>
                <div>
                  <span>ALUMNAS INSCRITAS</span>
                  <h2 id="schedule-students-title">{viewing.actividad}</h2>
                  <p>
                    {WEEK.find(({ day }) => day === viewing.dia_semana)?.full} · {time(viewing.hora_inicio)}–{time(viewing.hora_fin)} · {viewing.coach || "Sin instructor asignado"}
                  </p>
                </div>
                <button type="button" aria-label="Cerrar" onClick={closeStudents}>
                  ×
                </button>
              </header>
              <div className="membership-modal__body schedule-students-modal__body">
                {studentsLoading && (
                  <StatusState kind="loading" title="Cargando alumnas" description="Consultando las reservas de este horario." />
                )}
                {!studentsLoading && studentsError && (
                  <StatusState
                    kind="error"
                    title="No pudimos cargar las alumnas"
                    description={studentsError}
                    actionLabel="Reintentar"
                    onAction={() => void viewStudents(viewing)}
                  />
                )}
                {!studentsLoading && !studentsError && students && students.length === 0 && (
                  <StatusState kind="info" title="Todavía sin alumnas" description="Nadie tiene una reserva activa en este horario por ahora." />
                )}
                {!studentsLoading && !studentsError && students && students.length > 0 && (
                  <>
                    <p className="schedule-students-modal__count">
                      {students.length} {students.length === 1 ? "alumna" : "alumnas"} con reserva activa
                    </p>
                    <ul className="schedule-students-modal__list">
                      {students.map((student) => (
                        <li className="schedule-students-modal__item" key={student.id}>
                          <span className="schedule-students-modal__avatar" aria-hidden="true">
                            {student.cliente.trim().charAt(0).toUpperCase() || "?"}
                          </span>
                          <span className="schedule-students-modal__info">
                            <strong>{student.cliente}</strong>
                            <small>{student.correo}</small>
                          </span>
                          <span className="schedule-students-modal__meta">
                            <span className="schedule-students-modal__plan">{student.plan}</span>
                            <span className={`state-pill ${student.estado === "CONFIRMADA" ? "is-success" : "is-pending"}`}>
                              {student.estado}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
              <footer>
                <button type="button" className="button button-outline" onClick={closeStudents}>
                  Cerrar
                </button>
              </footer>
            </div>
          </div>,
          document.body,
        )}
      {confirmDialog}
    </section>
  );
}
