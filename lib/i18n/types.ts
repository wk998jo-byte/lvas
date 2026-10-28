/**
 * Shape a translation must follow: same keys as the English source, strings
 * stay strings, and formatter functions keep their parameters.
 */
export type Translation<T> = {
  [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends (...args: infer A) => string
      ? (...args: A) => string
      : Translation<T[K]>;
};
