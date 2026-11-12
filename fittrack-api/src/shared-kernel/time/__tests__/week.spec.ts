import type { LocalDate } from '../../types/index.js';
import {
  addDays,
  dayBounds,
  InvalidLocalDateError,
  InvalidTimezoneError,
  isValidTimezone,
  localDateOf,
  parseLocalDate,
  remainingDaysInWeek,
  weekBoundsFromStart,
  weekDates,
  weekdayOf,
  weekOf,
  weekStartOf,
} from '../week.js';

const SP = 'America/Sao_Paulo';
const NY = 'America/New_York';
const d = (s: string) => s as LocalDate;
const at = (iso: string) => new Date(iso);
const HOUR = 60 * 60 * 1000;

describe('localDateOf', () => {
  it('usa o fuso do aluno, não o UTC', () => {
    // 02:00 UTC de quinta = 23:00 de quarta em São Paulo (UTC-3).
    expect(localDateOf(at('2026-11-12T02:00:00Z'), SP)).toBe('2026-11-11');
    expect(localDateOf(at('2026-11-12T03:00:00Z'), SP)).toBe('2026-11-12');
  });

  it('o mesmo instante cai em dias diferentes conforme o fuso', () => {
    const instant = at('2026-11-15T20:00:00Z'); // domingo 17:00 em SP, segunda 05:00 em Tóquio
    expect(localDateOf(instant, SP)).toBe('2026-11-15');
    expect(localDateOf(instant, 'Asia/Tokyo')).toBe('2026-11-16');
  });
});

describe('weekOf', () => {
  it('vai de segunda a domingo', () => {
    const week = weekOf(at('2026-11-12T15:00:00Z'), SP); // quinta
    expect(week.weekStart).toBe('2026-11-09');
    expect(week.weekEnd).toBe('2026-11-15');
    expect(week.startsAt.toISOString()).toBe('2026-11-09T03:00:00.000Z');
    expect(week.endsAt.toISOString()).toBe('2026-11-16T03:00:00.000Z');
  });

  it('domingo 23:59 local ainda pertence à semana', () => {
    // Domingo 2026-11-15 23:59:59 em SP = segunda 02:59:59 UTC.
    expect(weekOf(at('2026-11-16T02:59:59Z'), SP).weekStart).toBe('2026-11-09');
  });

  it('segunda 00:00 local abre a semana seguinte', () => {
    expect(weekOf(at('2026-11-16T03:00:00Z'), SP).weekStart).toBe('2026-11-16');
  });

  it('o fim é exclusivo: endsAt de uma semana é o startsAt da próxima', () => {
    const week = weekOf(at('2026-11-12T15:00:00Z'), SP);
    expect(weekOf(week.endsAt, SP).weekStart).toBe('2026-11-16');
    expect(weekOf(new Date(week.endsAt.getTime() - 1), SP).weekStart).toBe('2026-11-09');
  });

  it('mudança de fuso do aluno muda a semana do mesmo instante', () => {
    const instant = at('2026-11-15T20:00:00Z');
    expect(weekOf(instant, SP).weekStart).toBe('2026-11-09');
    expect(weekOf(instant, 'Asia/Tokyo').weekStart).toBe('2026-11-16');
  });

  it('semana com início do horário de verão tem 167 horas', () => {
    // EUA: DST começa domingo 2026-03-08 02:00 local.
    const week = weekOf(at('2026-03-05T12:00:00Z'), NY);
    expect(week.weekStart).toBe('2026-03-02');
    expect(week.endsAt.getTime() - week.startsAt.getTime()).toBe(167 * HOUR);
  });

  it('semana com fim do horário de verão tem 169 horas', () => {
    // EUA: DST termina domingo 2026-11-01 02:00 local.
    const week = weekOf(at('2026-10-28T12:00:00Z'), NY);
    expect(week.weekStart).toBe('2026-10-26');
    expect(week.endsAt.getTime() - week.startsAt.getTime()).toBe(169 * HOUR);
  });

  it('virada de ano: semana que cruza dezembro e janeiro', () => {
    expect(weekOf(at('2027-01-01T15:00:00Z'), SP)).toMatchObject({
      weekStart: '2026-12-28',
      weekEnd: '2027-01-03',
    });
  });
});

describe('dayBounds', () => {
  it('dia comum tem 24 horas', () => {
    const day = dayBounds(d('2026-11-12'), SP);
    expect(day.startsAt.toISOString()).toBe('2026-11-12T03:00:00.000Z');
    expect(day.endsAt.toISOString()).toBe('2026-11-13T03:00:00.000Z');
  });

  it('meia-noite inexistente (horário de verão no Brasil, 2018) começa no primeiro instante válido', () => {
    // Em 2018-11-04 os relógios de SP pularam de 00:00 para 01:00 (UTC-2).
    const day = dayBounds(d('2018-11-04'), SP);
    expect(day.startsAt.toISOString()).toBe('2018-11-04T03:00:00.000Z');
    expect(day.endsAt.getTime() - day.startsAt.getTime()).toBe(23 * HOUR);
  });
});

describe('utilitários de data local', () => {
  it('weekStartOf devolve a segunda, inclusive quando já é segunda ou é domingo', () => {
    expect(weekStartOf(d('2026-11-09'))).toBe('2026-11-09');
    expect(weekStartOf(d('2026-11-15'))).toBe('2026-11-09');
  });

  it('weekDates lista segunda a domingo', () => {
    const dates = weekDates(d('2026-11-09'));
    expect(dates).toHaveLength(7);
    expect(dates[0]).toBe('2026-11-09');
    expect(dates[6]).toBe('2026-11-15');
    expect(dates.map(weekdayOf)).toEqual(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']);
  });

  it('addDays atravessa mês e ano bissexto', () => {
    expect(addDays(d('2028-02-28'), 1)).toBe('2028-02-29');
    expect(addDays(d('2026-12-31'), 1)).toBe('2027-01-01');
    expect(addDays(d('2026-11-09'), -1)).toBe('2026-11-08');
  });

  it('remainingDaysInWeek conta hoje', () => {
    expect(remainingDaysInWeek(d('2026-11-09'))).toBe(7); // segunda
    expect(remainingDaysInWeek(d('2026-11-12'))).toBe(4); // quinta
    expect(remainingDaysInWeek(d('2026-11-15'))).toBe(1); // domingo
  });
});

describe('validação', () => {
  it('recusa fuso inválido', () => {
    expect(isValidTimezone(SP)).toBe(true);
    expect(isValidTimezone('Brasil/Recife')).toBe(false);
    expect(() => weekOf(at('2026-11-12T00:00:00Z'), 'Lua/Base')).toThrow(InvalidTimezoneError);
  });

  it('recusa data local malformada ou inexistente', () => {
    expect(parseLocalDate('2026-11-12')).toBe('2026-11-12');
    expect(() => parseLocalDate('12/11/2026')).toThrow(InvalidLocalDateError);
    expect(() => parseLocalDate('2026-02-30')).toThrow(InvalidLocalDateError);
    expect(() => weekBoundsFromStart(d('2026-13-01'), SP)).toThrow(InvalidLocalDateError);
  });
});
