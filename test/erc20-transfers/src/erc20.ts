import type {
    FieldSelection as EvmFieldSelection,
    RequestOptions,
    DataRequest as EvmDataRequest,
    Log,
    LogRequest,
    EvmQueryOptions,
} from '@subsquid/evm-stream'
import {EvmPortalDataSource} from '@subsquid/evm-stream'
import {PortalClient} from '@subsquid/portal-client'
import type {Bytes20, Select, Selector, Simplify, Trues} from '@subsquid/util-types'
import type {RangeRequest, Range} from '@subsquid/util-internal-range'
import {getRequestAt} from '@subsquid/util-internal-range'
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

export type ConvertErc20Qeury<
    T extends Erc20QueryOptions,
    F extends Erc20FieldSelection = T['fields'],
    transfer extends TransferFieldSelection = F['transfer'] & {}
> = EvmQueryOptions<{
    log: {
        topics: Extract<transfer['from'] | transfer['to'] | transfer['value'], true>
        data: Extract<transfer['from'] | transfer['to'] | transfer['value'], true>
        logIndex: Extract<transfer['logIndex'], true>
        transactionIndex: Extract<transfer['transactionIndex'], true>
        transactionHash: Extract<transfer['transactionHash'], true>
        address: Extract<transfer['address'], true>
    }
}> extends infer R ? R : never

export function erc20Query<T extends Erc20QueryOptions>(options: T): ConvertErc20Qeury<T> {
    let {fields, requests} = options

    return {
        fields: {
            log: {
                logIndex: fields.transfer?.logIndex as any,
                transactionHash: fields.transfer?.transactionHash as any,
                transactionIndex: fields.transfer?.transactionIndex as any,
                address: fields.transfer?.address as any,
                data: (fields.transfer?.value || fields.transfer?.from || fields.transfer?.to) as any,
                topics: (fields.transfer?.value || fields.transfer?.from || fields.transfer?.to) as any,
            },
        },
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

function addressToTopic(a: string) {
    return '0x' + a.toLowerCase().slice(2).padStart(64, '0')
}
