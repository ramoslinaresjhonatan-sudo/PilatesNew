'use client';

import { useMemo, useState } from 'react';
import { formatDateTime } from '@/lib/format';
import type { ScheduleEnrollment } from '@/lib/types';

export function EnrollmentManager({ enrollments }: { enrollments: ScheduleEnrollment[] }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('TODAS');
  const statuses = useMemo(() => [...new Set(enrollments.map((item) => item.estado))], [enrollments]);
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es');
    return enrollments.filter((item) => (status === 'TODAS' || item.estado === status) && (!term || `${item.cliente} ${item.correo} ${item.actividad} ${item.plan}`.toLocaleLowerCase('es').includes(term)));
  }, [enrollments, search, status]);

  return <section className="connected-manager enrollment-manager">
    <div className="connected-toolbar">
      <label><span>Buscar inscripción</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cliente, correo, clase o plan" /></label>
      <label><span>Estado</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="TODAS">Todas</option>{statuses.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <small>{filtered.length} de {enrollments.length} inscripciones</small>
    </div>
    <div className="connected-list">{filtered.length ? filtered.map((item) => <article key={item.id}>
      <div className="connected-list__main"><span className="state-pill is-pending">{item.estado}</span><h3>{item.cliente}</h3><p>{item.actividad} · {item.plan}</p><small>{item.correo} · inscrita {formatDateTime(item.fecha_inscripcion)}</small></div>
      <div className="connected-list__numbers"><strong>{formatDateTime(item.fecha_inicio, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</strong><small>{item.uso ? `${item.uso.tipo_acceso} · ${item.uso.estado}` : 'Acceso sin consumir'}</small></div>
    </article>) : <p className="staff-empty">No hay inscripciones que coincidan con los filtros.</p>}</div>
  </section>;
}
