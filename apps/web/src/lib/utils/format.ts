import { format, formatDistanceToNow, parseISO } from 'date-fns'
import { uk } from 'date-fns/locale'
import type {
  ObjectStatus,
  ObjectCategory,
  NoteStatus,
  CompanyRole,
} from '@/types'

export function formatDate(date: string | Date | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'dd.MM.yyyy', { locale: uk })
}

export function formatDateTime(date: string | Date | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'dd.MM.yyyy HH:mm', { locale: uk })
}

export function formatRelative(date: string | Date | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? parseISO(date) : date
  return formatDistanceToNow(d, { addSuffix: true, locale: uk })
}

export function formatArea(area: number | undefined): string {
  if (!area) return '—'
  return `${area.toLocaleString('uk-UA')} м²`
}

export function formatCurrency(amount: number | undefined, currency = 'UAH'): string {
  if (!amount) return '—'
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatNumber(n: number | undefined): string {
  if (n === undefined || n === null) return '—'
  return n.toLocaleString('uk-UA')
}

export function formatScore(score: number | undefined): string {
  if (score === undefined || score === null) return '—'
  return `${Math.round(score * 100)}%`
}

// ─── Label Maps ────────────────────────────────────────────────────────────────

export const STATUS_LABELS: Record<ObjectStatus, string> = {
  planned: 'Планується',
  approved: 'Дозволено',
  under_construction: 'Будується',
  completed: 'Завершено',
  suspended: 'Призупинено',
  cancelled: 'Скасовано',
}

export const STATUS_COLORS: Record<ObjectStatus, string> = {
  planned: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  approved: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  under_construction: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  completed: 'bg-green-500/10 text-green-400 border-green-500/20',
  suspended: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
}

export const CATEGORY_LABELS: Record<ObjectCategory, string> = {
  residential: 'Житловий',
  commercial: 'Комерційний',
  industrial: 'Промисловий',
  infrastructure: 'Інфраструктура',
  social: 'Соціальний',
  mixed: 'Змішаний',
}

export const NOTE_STATUS_LABELS: Record<NoteStatus, string> = {
  interesting: 'Цікавий',
  contact_later: 'Зв\'язатись пізніше',
  active_lead: 'Активний лід',
  in_progress: 'В роботі',
  not_relevant: 'Не актуально',
}

export const NOTE_STATUS_COLORS: Record<NoteStatus, string> = {
  interesting: 'bg-blue-500/10 text-blue-400',
  contact_later: 'bg-yellow-500/10 text-yellow-400',
  active_lead: 'bg-green-500/10 text-green-400',
  in_progress: 'bg-purple-500/10 text-purple-400',
  not_relevant: 'bg-zinc-500/10 text-zinc-400',
}

export const COMPANY_ROLE_LABELS: Record<CompanyRole, string> = {
  developer: 'Забудовник',
  general_contractor: 'Генпідрядник',
  subcontractor: 'Субпідрядник',
  designer: 'Проектувальник',
  engineering: 'Інженерна компанія',
  technical_supervision: 'Технічний нагляд',
  architect: 'Архітектор',
  investor: 'Інвестор',
}

export const OBLAST_LABELS: Record<string, string> = {
  vinnytsia: 'Вінницька',
  volyn: 'Волинська',
  dnipropetrovsk: 'Дніпропетровська',
  donetsk: 'Донецька',
  zhytomyr: 'Житомирська',
  zakarpattia: 'Закарпатська',
  zaporizhzhia: 'Запорізька',
  ivano_frankivsk: 'Івано-Франківська',
  kyiv_oblast: 'Київська',
  kyiv_city: 'м. Київ',
  kirovohrad: 'Кіровоградська',
  luhansk: 'Луганська',
  lviv: 'Львівська',
  mykolaiv: 'Миколаївська',
  odesa: 'Одеська',
  poltava: 'Полтавська',
  rivne: 'Рівненська',
  sumy: 'Сумська',
  ternopil: 'Тернопільська',
  kharkiv: 'Харківська',
  kherson: 'Херсонська',
  khmelnytskyi: 'Хмельницька',
  cherkasy: 'Черкаська',
  chernivtsi: 'Чернівецька',
  chernihiv: 'Чернігівська',
}
