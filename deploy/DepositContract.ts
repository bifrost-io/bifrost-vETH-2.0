import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

const deployFunction: DeployFunction = async function ({ deployments, getNamedAccounts }: HardhatRuntimeEnvironment) {
  console.log('Running DepositContract deploy script')

  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()
  const { address } = await deploy('DepositContract', { from: deployer })

  console.log('DepositContract deployed at', address)
}

export default deployFunction

deployFunction.dependencies = []

deployFunction.tags = ['DepositContract']
