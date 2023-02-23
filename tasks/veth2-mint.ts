import { task } from 'hardhat/config'

task('veth2-mint', 'Mint vETH2').setAction(async function (params: { id: number }, { ethers, network, deployments }) {
  const vETH2 = await ethers.getContractAt('vETH2', (await deployments.get('vETH2')).address)
  const vETH2Claim = await ethers.getContractAt('vETH2Claim', (await deployments.get('vETH2Claim')).address)
  const tx = await vETH2.mint(vETH2Claim.address, ethers.utils.parseEther('1'))

  console.log(`vETH2 mint: ${tx.hash}`)
})
