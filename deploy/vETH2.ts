import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { ethers } from 'hardhat'

const deployFunction: DeployFunction = async function ({ deployments, getNamedAccounts }: HardhatRuntimeEnvironment) {
  console.log('Running vETH2 deploy script')

  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()
  const { address } = await deploy('vETH2', { from: deployer })

  const vETH2Contract = await ethers.getContractAt('vETH2', (await deployments.get('vETH2')).address)
  const tx = await vETH2Contract.setSLPCore(deployer)
  console.log(`Call vETH2.setSLPCore: ${tx.hash}`)

  console.log('vETH2 deployed at', address)
}

export default deployFunction

deployFunction.dependencies = []

deployFunction.tags = ['vETH2']
