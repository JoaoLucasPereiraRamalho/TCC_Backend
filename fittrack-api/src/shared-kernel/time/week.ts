import { DateTime, IANAZone } from 'luxon';
import type { LocalDate, Weekday } from '../types/index.js';

/**
 * Funções puras de dia e semana no fuso do aluno (RN06 a RN08, RN11).
 * A semana vai de segunda 00:00 a domingo 23:59:59.999 no fuso informado.
 * Nenhuma função lê o relógio: o instante sempre vem de fora (porta Clock).
 */

const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const WEEKDAYS: readonly Weekday[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

export interface DayBounds {
  localDate: LocalDate;
  /** Primeiro instante do dia (inclusivo), em UTC. */
  startsAt: Date;
  /** Primeiro instante do dia seguinte (exclusivo), em UTC. */
  endsAt: Date;
}

export interface WeekBounds {
  /** Segunda-feira. */
  weekStart: LocalDate;
  /** Domingo. */
  weekEnd: LocalDate;
  /** Segunda 00:00 no fuso (inclusivo), em UTC. */
  startsAt: Date;
  /** Segunda seguinte 00:00 no fuso (exclusivo), em UTC. */
  endsAt: Date;
}

export class InvalidTimezoneError extends Error {
  constructor(timezone: string) {
    super(`Fuso horário inválido: ${timezone}`);
    this.name = 'InvalidTimezoneError';
  }
}

export class InvalidLocalDateError extends Error {
  constructor(value: string) {
    super(`Data local inválida (esperado YYYY-MM-DD): ${value}`);
    this.name = 'InvalidLocalDateError';
  }
}

export function isValidTimezone(timezone: string): boolean {
  return IANAZone.isValidZone(timezone);
}

function zone(timezone: string): IANAZone {
  if (!isValidTimezone(timezone)) throw new InvalidTimezoneError(timezone);
  return IANAZone.create(timezone);
}

/** Interpreta YYYY-MM-DD como data de calendário (sem fuso). */
function calendarDate(localDate: string): DateTime {
  const parsed = LOCAL_DATE.test(localDate)
    ? DateTime.fromISO(localDate, { zone: 'utc' })
    : DateTime.invalid('formato');
  if (!parsed.isValid) throw new InvalidLocalDateError(localDate);
  return parsed;
}

function toLocalDate(dateTime: DateTime): LocalDate {
  return dateTime.toISODate() as LocalDate;
}

/** Valida e tipa uma string YYYY-MM-DD. */
export function parseLocalDate(value: string): LocalDate {
  return toLocalDate(calendarDate(value));
}

/** Dia local de um instante no fuso. Uma sessão que cruza a meia-noite conta no dia em que começou (ERS 5.5). */
export function localDateOf(instant: Date, timezone: string): LocalDate {
  return toLocalDate(DateTime.fromJSDate(instant, { zone: zone(timezone) }));
}

export function addDays(localDate: LocalDate, days: number): LocalDate {
  return toLocalDate(calendarDate(localDate).plus({ days }));
}

export function weekdayOf(localDate: LocalDate): Weekday {
  return WEEKDAYS[calendarDate(localDate).weekday - 1]!;
}

/** Segunda-feira da semana que contém a data. */
export function weekStartOf(localDate: LocalDate): LocalDate {
  return toLocalDate(calendarDate(localDate).startOf('week'));
}

/** Os 7 dias (segunda a domingo) da semana que começa em `weekStart`. */
export function weekDates(weekStart: LocalDate): LocalDate[] {
  const monday = calendarDate(weekStartOf(weekStart));
  return Array.from({ length: 7 }, (_, i) => toLocalDate(monday.plus({ days: i })));
}

/** Instante UTC em que o dia local começa. Se a meia-noite não existe (horário de verão), usa o primeiro instante válido. */
function startOfLocalDay(localDate: LocalDate, timezone: string): DateTime {
  const { year, month, day } = calendarDate(localDate);
  return DateTime.fromObject({ year, month, day }, { zone: zone(timezone) }).startOf('day');
}

export function dayBounds(localDate: LocalDate, timezone: string): DayBounds {
  return {
    localDate,
    startsAt: startOfLocalDay(localDate, timezone).toJSDate(),
    endsAt: startOfLocalDay(addDays(localDate, 1), timezone).toJSDate(),
  };
}

/** Semana (segunda a domingo, no fuso do aluno) que contém o instante. */
export function weekOf(instant: Date, timezone: string): WeekBounds {
  return weekBoundsFromStart(weekStartOf(localDateOf(instant, timezone)), timezone);
}

export function weekBoundsFromStart(weekStart: LocalDate, timezone: string): WeekBounds {
  const monday = weekStartOf(weekStart);
  const nextMonday = addDays(monday, 7);
  return {
    weekStart: monday,
    weekEnd: addDays(monday, 6),
    startsAt: startOfLocalDay(monday, timezone).toJSDate(),
    endsAt: startOfLocalDay(nextMonday, timezone).toJSDate(),
  };
}

/** Dias que faltam na semana contando hoje (usado em streakAtRisk). Domingo = 1. */
export function remainingDaysInWeek(today: LocalDate): number {
  return 8 - calendarDate(today).weekday;
}
