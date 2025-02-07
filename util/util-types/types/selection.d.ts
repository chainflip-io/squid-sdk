import type {Simplify, ConditionalKeys} from './misc'

export type Selector<Props extends string = string> = {
    [P in Props]?: boolean
}

export type Selection = {
    [P in string]?: boolean | Selection
}

export type Select<T, S> = T extends any
    ? {
          [K in keyof T as S[K] extends true ? K : never]: T[K]
      }
    : never

type MergeSelection_<T, U> = T extends true
    ? true
    : U extends true
    ? true
    : T extends Selection
    ? U extends Selection
        ? MergeSelection<T, U>
        : never
    : never

export type MergeSelection<T extends Selection, U extends Selection> = Simplify<
    {[K in Exclude<ConditionalKeys<T, true | Selection>, keyof U>]: T[K]} & {
        [K in Exclude<ConditionalKeys<U, true | Selection>, keyof T>]: U[K]
    } & {
        [K in Extract<ConditionalKeys<T, true | Selection>, ConditionalKeys<U, true | Selection>>]: MergeSelection_<
            T[K],
            U[K]
        >
    }
>

export type MergeSelectionAll<T> = T extends readonly [infer F, ...infer R]
    ? F extends EvmQueryOptions
        ? R extends [Selection, ...Selection[]]
            ? MergeSelection<F, MergeSelectionAll<R>>
            : F
        : never
    : never

type Trues<T extends Selection> = Simplify<{[K in keyof T]-?: Selection extends T[K] ? Trues<T[K]> : true}>
