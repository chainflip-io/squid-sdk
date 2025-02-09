import type {Simplify, ConditionalKeys} from './misc'

export type Selector<Props extends string | number | symbol = string> = {
    [P in Props]?: boolean
}

export type Selection = {
    [P in string]?: boolean | Selection
}

export type Select<T, S> = T extends any
    ? Simplify<{
          [K in Extract<keyof T, keyof S> as S[K] extends true ? K : never]: T[K]
      }>
    : never

type MergeSelectionUnique<T, U> = {
    [K in Exclude<keyof T, keyof U> as T[K] extends true | Selection ? K : never]: T[K]
}

type MergeSelectionCommon<T, U> = {
    [K in Extract<keyof T, keyof U> as T[K] extends true | Selection
        ? K
        : U[K] extends true | Selection
        ? K
        : never]: T[K] extends true
        ? true
        : U[K] extends true
        ? true
        : T[K] extends Selection
        ? U[K] extends Selection
            ? MergeSelection<T[K], U[K]>
            : never
        : never
}

export type MergeSelection<T, U> = Simplify<
    MergeSelectionUnique<T, U> & MergeSelectionUnique<U, T> & MergeSelectionCommon<T, U>
>

export type MergeSelectionAll<T extends readonly Selection[]> = T extends readonly [infer F, ...infer R]
    ? F extends Selection
        ? R extends [Selection, ...Selection[]]
            ? MergeSelection<F, MergeSelectionAll<R>>
            : F
        : never
    : never

export type Trues<T extends Selection> = Simplify<{[K in keyof T]-?: T[K] extends Selection ? Trues<T[K]> : true}>
