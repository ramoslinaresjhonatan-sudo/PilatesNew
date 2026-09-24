'use client';
import { HomeBlockEditor } from './home-block-editor';
type Content = { titulo: string; subtitulo: string; descripcion: string };
export function LandingTextEditor({ sectionKey, heading, defaults, className = '' }: { sectionKey: string; storageTitle: string; heading: string; defaults: Content; className?: string }) { return <HomeBlockEditor sectionKey={sectionKey} heading={heading} defaults={defaults} className={`web-content-cloud ${className}`} />; }
