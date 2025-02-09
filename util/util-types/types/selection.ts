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

type MergeSelectionUnique<T, U, S extends Selection> = {
    [K in Exclude<keyof T, keyof U> & keyof S as T[K] extends S[K] ? K : never]: T[K]
}

type MergeSelectionCommon<T extends S, U extends S, S extends Selection> = {
    [K in Extract<keyof T, keyof U> & keyof S as T[K] extends S[K]
        ? K
        : U[K] extends S[K]
        ? K
        : never]: S[K] extends Selection
        ? T[K] extends Selection
            ? U[K] extends Selection
                ? MergeSelection<T[K], U[K], S[K]>
                : never
            : never
        : S[K] extends true
        ? true
        : never
}

export type MergeSelection<T extends S, U extends S, S extends Selection = Selection> = Simplify<
    MergeSelectionUnique<T, U, S> & MergeSelectionUnique<U, T, S> & MergeSelectionCommon<T, U, S>
>

export type MergeSelectionAll<T extends readonly Selection[]> = T extends readonly [infer F, ...infer R]
    ? F extends Selection
        ? R extends [Selection, ...Selection[]]
            ? MergeSelection<F, MergeSelectionAll<R>>
            : F
        : never
    : never

export type Trues<T extends Selection> = Simplify<{[K in keyof T]-?: T[K] extends Selection ? Trues<T[K]> : true}>
