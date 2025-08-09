import {BlockRef, createQuery, isForkException, PortalClient} from './client'

const portalUrls = {
    evm: 'https://portal.sqd.dev/datasets/ethereum-mainnet',
    solana: 'https://portal.sqd.dev/datasets/solana-mainnet',
}

const queries = {
    evm: createQuery({
        type: 'evm',
        fromBlock: 23_100_000,
        fields: {
            block: {
                number: true,
                hash: true,
                timestamp: true,
            },
            transaction: {
                from: true,
                to: true,
                hash: true,
            },
            log: {
                address: true,
                topics: true,
                data: true,
                transactionHash: true,
                logIndex: true,
                transactionIndex: true,
            },
            stateDiff: {
                kind: true,
                next: true,
                prev: true,
            },
        },
        logs: [
            {
                address: ['0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'],
                topic0: ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'],
            },
        ],
    }),
    solana: createQuery({
        type: 'solana',
        fromBlock: 358_600_000,
        fields: {
            block: {number: true, timestamp: true, hash: true, parentHash: true},
            transaction: {signatures: true, err: true, transactionIndex: true},
            instruction: {
                programId: true,
                accounts: true,
                data: true,
                isCommitted: true,
                transactionIndex: true,
                instructionAddress: true,
            },
        },
        instructions: [
            {
                programId: ['whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc'],
                d8: ['0xf8c69e91e17587c8'],
                isCommitted: true,
                innerInstructions: true,
            },
        ],
    }),
}

async function main() {
    const queryType = 'evm'
    const query = queries[queryType]

    let portal = new PortalClient({
        url: portalUrls[queryType],
        http: {
            retryAttempts: Infinity,
        },
        minBytes: 50 * 1024 * 1024,
    })

    let coldHead: BlockRef | undefined = undefined
    let hotHeads: BlockRef[] = []
    while (true) {
        const currentQuery = {...query}

        let head = hotHeads[hotHeads.length - 1] ?? coldHead
        if (head != null && head.number > currentQuery.fromBlock) {
            currentQuery.fromBlock = head.number + 1
            currentQuery.parentBlockHash = head.hash
        }

        try {
            for await (let {blocks, finalizedHead} of portal.getStream(currentQuery)) {
                if (head && blocks.length > 0 && head.number >= blocks[0].header.number) {
                    throw new Error('Data is not continuous')
                }

                if (finalizedHead) {
                    // if we do have finality information from the portal,
                    // then we first mark all new blocks as not final
                    hotHeads.push(...blocks.map(b => ({number: b.header.number, hash: b.header.hash})))
                    // before cutting off any known final ones
                    if (hotHeads.length !== 0) {
                        const lowestNonFinalBlockIndex = hotHeads.findIndex((h) => h.number > finalizedHead.number)
                        const highestFinalBlockIndex = lowestNonFinalBlockIndex === -1 ? hotHeads.length-1 : lowestNonFinalBlockIndex-1

                        coldHead = hotHeads[highestFinalBlockIndex] ?? coldHead
                        hotHeads = hotHeads.slice(highestFinalBlockIndex+1)
                    }
                } else {
                    // if the chunk came in without any finality information from the portal
                    // then we just save all block references
                    for (let i = 0; i < blocks.length; i++) {
                        hotHeads.push({number: blocks[i].header.number, hash: blocks[i].header.hash})
                    }
                }

                head = hotHeads[hotHeads.length - 1] ?? coldHead
                let portalHead = Math.max(head.number, finalizedHead?.number ?? -1)
                console.log(`progress: ${head.number} / ${portalHead}` + `, blocks: ${blocks.length}`)
                console.log(`  \u001b[2mcold head: ${coldHead ? formatRef(coldHead) : 'N/A'}\u001b[0m`)
                console.log(`  \u001b[2mhot heads: ${hotHeads.map((h) => formatRef(h)).join(', ') || 'N/A'}\u001b[0m`)
            }
            break
        } catch (e) {
            if (!isForkException(e)) throw e

            let chain = coldHead ? [coldHead, ...hotHeads] : hotHeads
            let rollbackIndex = findRollbackIndex(chain, e.lastBlocks)
            if (rollbackIndex === -1) throw new Error('Unable to process fork')

            const rollbackHead = chain[rollbackIndex]
            console.warn(`detected fork at block ${rollbackHead.number} (${e.head.number - rollbackHead.number} depth)`)

            hotHeads = chain.slice(1, rollbackIndex + 1)
            head = hotHeads[hotHeads.length - 1] ?? coldHead
        }
    }
}

function findRollbackIndex(chainA: BlockRef[], chainB: BlockRef[]) {
    let i = 0
    let j = 0
    for (; i < chainA.length; i++) {
        const blockA = chainA[i]
        for (; j < chainB.length; j++) {
            let blockB = chainB[j]
            if (blockB.number > blockA.number) break
            if (blockB.number === blockA.number && blockB.hash !== blockA.hash) return i - 1
        }
    }
    return i - 1
}

function formatRef(ref: BlockRef) {
    return `${ref.number}#${ref.hash.slice(2, 8)}`
}

main()
