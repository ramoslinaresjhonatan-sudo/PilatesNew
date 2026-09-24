import type { Metadata } from 'next';
import { ScheduleView } from '@/features/schedule/schedule-view';
export const metadata: Metadata = { title: 'Calendario' };
export default function PanelCalendarPage() { return <main className="panel-page"><header className="panel-page-heading"><div><p className="section-eyebrow">Mi agenda</p><h1>Calendario de clases</h1><p>Consulta los horarios y cupos disponibles.</p></div></header><ScheduleView panel /></main>; }
