import { task } from 'hardhat/config'

task('veth2-set-operator', 'Set operator').setAction(async function (
  params: { id: number },
  { ethers, network, deployments }
) {
  const vETH2 = await ethers.getContractAt('vETH2', (await deployments.get('vETH2')).address)
  const SLPCore = await ethers.getContractAt('SLPCore', (await deployments.get('vETH2')).address)
  const tx = await vETH2.setOperator(SLPCore.address)

  console.log(`vETH2 operator set: ${tx.hash}`)
})
