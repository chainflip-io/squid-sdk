import type {RequestOptions, LogRequest, EvmQueryOptions, FieldSelection} from '@subsquid/evm-stream'
import type {Bytes20, ConditionalPick, Select, Selector, Simplify, Trues} from '@subsquid/util-internal'
import type {RangeRequest} from '@subsquid/util-internal-range'
import * as erc20 from './abi/erc20'

export type TransferFields = {
    logIndex: number
    transactionIndex: number
    transactionHash: string
    address: Bytes20
    from: Bytes20
    to: Bytes20
    value: bigint
}
export type TransferFieldSelection = Selector<keyof TransferFields>
export type Transfer<F extends TransferFieldSelection = Trues<TransferFieldSelection>> = Select<TransferFields, F>

export type Erc20FieldSelection = {
    transfer?: TransferFieldSelection
}

export type TransferRequest = Simplify<
    {
        from?: Bytes20[]
        to?: Bytes20[]
        log?: boolean
    } & Pick<LogRequest, 'address' | 'transaction' | 'transactionLogs' | 'transactionStateDiffs' | 'transactionTraces'>
>

export type TransferRequestOptions = RequestOptions<TransferRequest>

export type Erc20DataRequest = {
    transfers?: TransferRequest[]
}

export type Erc20QueryOptions<F extends Erc20FieldSelection = Erc20FieldSelection> = {
    fields: F
    requests: RangeRequest<Erc20DataRequest>[]
}

export type ConvertFieldSelection<
    F extends Erc20FieldSelection,
    T extends TransferFieldSelection = F['transfer'] & {}
> = {
    log: ConditionalPick<
        {
            topics: Extract<T['from'] | T['to'] | T['value'], true>
            data: Extract<T['from'] | T['to'] | T['value'], true>
            logIndex: T['logIndex']
            transactionIndex: T['transactionIndex']
            transactionHash: T['transactionHash']
            address: T['address']
        },
        true
    >
}

export type ConvertErc20Qeury<T extends Erc20QueryOptions> = EvmQueryOptions<ConvertFieldSelection<T['fields']>>

export function erc20Query<T extends Erc20QueryOptions>(options: T): ConvertErc20Qeury<T> {
    let {fields, requests} = options

    return {
        fields: convertFieldSelection(fields),
        requests: requests.map(({range, request}) => ({
            range,
            request: {
                logs: request.transfers?.map((t) => ({
                    address: t.address,
                    topic0: [erc20.events.Transfer.topic],
                    topic1: t.from?.map(addressToTopic),
                    topic2: t.to?.map(addressToTopic),
                    transaction: t.transaction,
                    transactionTraces: t.transactionTraces,
                    transactionLogs: t.transactionLogs,
                    transactionStateDiffs: t.transactionStateDiffs,
                })),
            },
        })),
    }
}

function convertFieldSelection<F extends Erc20FieldSelection>(fields: F): ConvertFieldSelection<F> {
    let {transfer} = fields

    return {
        log: transfer
            ? {
                  logIndex: transfer.logIndex,
                  transactionHash: transfer.transactionHash,
                  transactionIndex: transfer.transactionIndex,
                  address: transfer.address,
                  data: transfer.value || transfer.from || transfer.to,
                  topics: transfer.value || transfer.from || transfer.to,
              }
            : undefined,
    } satisfies FieldSelection as any
}

function addressToTopic(a: string) {
    return '0x' + a.toLowerCase().slice(2).padStart(64, '0')
}
