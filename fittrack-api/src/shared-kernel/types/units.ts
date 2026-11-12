import type { Brand } from './brand.js';

/** Carga sempre em kg na API (até 2 casas). A conversão para lbs é feita no cliente. */
export type Kg = Brand<number, 'Kg'>;

/** Data local no fuso do aluno, formato YYYY-MM-DD. Nunca substitui um instante. */
export type LocalDate = Brand<string, 'LocalDate'>;

export type Weekday = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';
