import { task } from 'hardhat/config'
import axios from 'axios'
import { CHAIN_ID, SLP_DEPOSIT_MERKLE_ROOT } from '../constants/constants'

task('batch-deposit-proof', 'Batch deposit ETH with proof')
  .addParam('skip', 'Skip items')
  .addParam('take', 'Take items')
  .setAction(async function (params: { skip: number; take: number }, { ethers, network }) {
    const slpDeposit = await ethers.deployContract('SLPDeposit')
    const depositContract = await ethers.deployContract('DepositContract')
    await slpDeposit.initialize(depositContract.address)

    const batchId = 0
    const chainId = network.config.chainId as CHAIN_ID
    const merkleRoot = SLP_DEPOSIT_MERKLE_ROOT[chainId]
    await slpDeposit.setMerkleRoot(batchId, merkleRoot)
    console.log('\x1b[32m%s\x1b[0m', `Merkle root at batchId 0 is ${await slpDeposit.merkleRoots(batchId)}`)

    try {
      // @ts-ignore
      const { proof, proofFlags } = await queryProof(params.skip, params.take)
      const leaves = await queryValidators(params.skip, params.take)

      const depositAmount = ethers.utils.parseEther('32').mul(leaves.length)
      await slpDeposit.depositETH({ value: depositAmount })

      await slpDeposit.batchDepositWithProof(batchId, proof, proofFlags, leaves)
    } catch (e) {
      console.log(e)
    }

    console.log('Batch deposited with proof!')
  })

async function queryProof(skip: number, take: number) {
  try {
    const url = `http://localhost:3000/api/v1/origins/multi_proof?skip=${skip}&take=${take}`
    const response = await axios.get(url)
    const { proof, proofFlags } = response.data

    return {
      proof,
      proofFlags,
    }
  } catch (e) {
    console.log(e)
  }
}

async function queryValidators(skip: number, take: number) {
  try {
    const url = `http://localhost:3000/api/v1/origins?skip=${skip}&take=${take}`
    const response = await axios.get(url)
    const data = response.data

    return data.map((item: any) => {
      return {
        pubkey: `0x${item.pubkey}`,
        withdrawal_credentials: `0x${item.withdrawal_credentials}`,
        signature: `0x${item.signature}`,
        deposit_data_root: `0x${item.deposit_data_root}`,
      }
    })
  } catch (e) {
    console.log(e)
  }
}
