import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

const deployFunction: DeployFunction = async function ({ deployments, getNamedAccounts }: HardhatRuntimeEnvironment) {
  console.log('Running vETH2 deploy script')

  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()
  const { address } = await deploy('vETH2', { from: deployer })

  console.log('vETH2 deployed at', address)
}

export default deployFunction

deployFunction.dependencies = ['']

deployFunction.tags = ['vETH2']
