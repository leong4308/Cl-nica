import type { LucideIcon } from 'lucide-react'
export type Row = string[]
export type ModuleConfig = { icon: LucideIcon; eyebrow: string; title: string; description: string; action: string; columns: string[]; rows: Row[] }
export type ClinicActions = { notify: (message: string) => void; openModal: (title: string) => void; navigate: (label: string) => void; addAppointment: (appointment: Row) => void }
