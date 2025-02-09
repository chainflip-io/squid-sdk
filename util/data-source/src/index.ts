import {Range} from '@subsquid/util-internal-range'

export interface BlockRef {
    number: number
    hash: string
}

export type DataSourceStreamItem<B> = B & {[DataSource.blockRef]: BlockRef}

export type DataSourceStreamData<B> = DataSourceStreamItem<B>[] & {
    [DataSource.finalizedHead]?: BlockRef
}

export type DataSourceStream<B> = ReadableStream<DataSourceStreamData<B>>

export namespace DataSource {
    export const blockRef = Symbol('DataSource.blockRef')
    export const finalizedHead = Symbol('DataSource.finalizedHead')
}

export interface DataSource<B> {
    getHeight(): Promise<number>
    getFinalizedHeight(): Promise<number>
    getBlockStream(range?: Range, stopOnHead?: boolean): DataSourceStream<B>
}

export type GetDataSourceBlock<T> = T extends DataSource<infer B> ? B : never
