/** Tipo nominal: impede passar um StudentId onde se espera um TrainerId, sem custo em runtime. */
export type Brand<T, B extends string> = T & { readonly __brand: B };
