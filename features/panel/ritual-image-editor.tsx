'use client';
import { HomeBlockEditor } from './home-block-editor';
const keys = ['COMMUNITY', 'MOVEMENT', 'HEAT', 'RECOVERY'];
export function RitualImageEditor({ index, label, chapter, description }: { index: number; label: string; chapter: string; description: string }) { return <HomeBlockEditor sectionKey={`RITUAL_${keys[index]}`} heading={label} imageSlot={index} defaults={{ titulo: label, subtitulo: `THE HOUSE RITUAL · ${chapter}`, descripcion: description }} />; }
