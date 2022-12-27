import { task } from 'hardhat/config'
import axios from 'axios'

task('batch-deposit', 'Batch deposit ETH')
  .addParam('skip', 'Skip items')
  .addParam('take', 'Take items')
  .setAction(async function (params: { skip: number; take: number }, { ethers }) {
    const slpDeposit = await ethers.deployContract('SLPDeposit')
    const depositContract = await ethers.deployContract('DepositContract')
    await slpDeposit.initialize(depositContract.address)

    const index = 0
    const merkleRoot = '0xd68ce67b1e69f61353fd887b267493c2f1401f9711c0c2b1744bbe8cbf27938f'
    await slpDeposit.setMerkleRoot(index, merkleRoot)
    console.log('\x1b[32m%s\x1b[0m', `Merkle root at index 0 is ${await slpDeposit.merkleRoots(index)}`)

    try {
      // @ts-ignore
      const { proof, proofFlags } = await queryProof(params.skip, params.take)
      const leaves = await queryValidators(params.skip, params.take)

      const depositAmount = ethers.utils.parseEther('32').mul(leaves.length)
      await slpDeposit.depositETH({ value: depositAmount })

      await slpDeposit.batchDeposit(index, proof, proofFlags, leaves)
    } catch (e) {
      console.log(e)
    }

    console.log('Batch deposited!')
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
