import { task } from 'hardhat/config'
import axios from 'axios'

task('user-claim', 'Claim vETH1 reward')
  .addParam('id', 'User id')
  .setAction(async function (params: { id: number }, { ethers }) {
    const vETH2 = await ethers.deployContract('vETH2')
    const vETH2Claim = await ethers.deployContract('vETH2Claim')

    const merkleRoot = '0xe742cf52415caaa1342a1dc1bc2dd744bf71f249886f62ae8dea47803e0a7608'
    await vETH2Claim.initialize(vETH2.address, merkleRoot)
    await vETH2.mint(vETH2Claim.address, ethers.utils.parseEther('1000'))

    try {
      const { address, amount } = await queryReward(params.id)
      // @ts-ignore
      const { proof } = await queryProof(address)

      await vETH2Claim.claim(address, amount, proof)
      console.log(await vETH2.balanceOf(address))
    } catch (e) {
      console.log(e)
    }

    console.log('Reward Claimed!')
  })

async function queryProof(address: string) {
  try {
    const url = `http://localhost:3000/api/v1/rewards/proof/${address}`
    const response = await axios.get(url)
    const { leaf, root, proof } = response.data

    return {
      leaf,
      root,
      proof,
    }
  } catch (e) {
    console.log(e)
  }
}

async function queryReward(id: number) {
  try {
    const url = `http://localhost:3000/api/v1/rewards/${id}`
    const response = await axios.get(url)
    const data = response.data

    return data
  } catch (e) {
    console.log(e)
  }
}
