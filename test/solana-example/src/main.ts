import {DataSource} from '@subsquid/data-source'
import {HttpClient} from '@subsquid/http-client'
import {PortalClient} from '@subsquid/portal-client'
import {getInstructionDescriptor, mergeQueries, SolanaPortalDataSource} from '@subsquid/solana-stream'
import assert from 'assert'
import * as tokenProgram from './abi/tokenProgram'
import * as whirlpool from './abi/whirlpool'
import {Swap, whirlpoolQuery} from './whirlpool'

async function main() {
    let portal = new PortalClient({
        url: 'https://portal.sqd.dev/datasets/solana-mainnet',
        http: new HttpClient({
            retryAttempts: Infinity,
            keepalive: true,
        }),
        minBytes: 50 * 1024 * 1024,
    })

    let dataSource = new SolanaPortalDataSource({
        portal,
        query: mergeQueries(
            whirlpoolQuery({
                fields: {
                    swap: {
                        inputAmount: true,
                        inputMint: true,
                        outputAmount: true,
                        outputMint: true,
                    },
                },
                requests: [
                    {
                        range: {from: 0},
                        request: {
                            swaps: [{}],
                        },
                    },
                ],
            })
        ),
    })

    let from = await dataSource.getFinalizedHeight().then((h) => h - 1_000_000)

    for await (let blocks of dataSource.getBlockStream({from}, true)) {
        let swaps: Swap[] = []

        for (let block of blocks) {
            for (let ins of block.instructions) {
                if (ins.programId === whirlpool.programId && ins.d8 == whirlpool.instructions.swap.d8) {
                    let swap = whirlpool.instructions.swap.decode(ins)

                    let srcTransfer = tokenProgram.instructions.transfer.decode(ins.inner[0])
                    let destTransfer = tokenProgram.instructions.transfer.decode(ins.inner[1])

                    let inputMint = ins.transaction?.tokenBalances.find(
                        (tb) => tb.account === srcTransfer.accounts.destination
                    )?.preMint
                    assert(inputMint != null)
                    let inputAmount = srcTransfer.data.amount

                    let outputMint = ins.transaction?.tokenBalances.find(
                        (tb) => tb.account === destTransfer.accounts.source
                    )?.preMint
                    assert(outputMint != null)
                    let outputAmount = destTransfer.data.amount

                    let [inputVault, outputVault] = swap.data.aToB
                        ? [swap.accounts.tokenVaultA, swap.accounts.tokenVaultB]
                        : [swap.accounts.tokenVaultB, swap.accounts.tokenVaultA]

                    swaps.push({
                        inputAmount,
                        inputMint,
                        inputVault,
                        outputAmount: outputAmount,
                        outputMint,
                        outputVault,
                        transactionIndex: ins.transactionIndex,
                        instructionAddress: ins.instructionAddress,
                    })
                }
            }
        }

        for (let swap of swaps) {
            console.log(`${swap.inputMint} (${swap.inputAmount}) -> ${swap.outputMint} (${swap.outputAmount})`)
        }

        console.warn(
            `[${new Date().toISOString()}] progress: ${blocks[blocks.length - 1].header.number} / ${
                blocks[DataSource.finalizedHead]?.number ?? -1
            }` + `, blocks: ${blocks.length}, swaps: ${swaps.length}`
        )
    }
    console.log(`end`)
}

main()
