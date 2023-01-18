import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { ethers } from 'hardhat'

const deployFunction: DeployFunction = async function ({ deployments, getNamedAccounts }: HardhatRuntimeEnvironment) {
  console.log('Running SLPCore deploy script')

  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const vETH1 = '0xc3d088842dcf02c13699f936bb83dfbbc6f721ab'
  const vETH2 = (await deployments.get('vETH2')).address
  const SLPDeposit = (await deployments.get('SLPDeposit')).address
  const operator = ethers.constants.AddressZero
  const initTokenPool = ethers.utils.parseEther('1')

  const { address } = await deploy('SLPCore', {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    proxy: {
      proxyContract: 'OpenZeppelinTransparentProxy',
      execute: {
        init: {
          methodName: 'initialize',
          args: [vETH1, vETH2, SLPDeposit, operator, initTokenPool],
        },
      },
    },
  })

  console.log('SLPCore deployed at', address)
}

export default deployFunction

deployFunction.dependencies = ['vETH2', 'SLPDeposit']

deployFunction.tags = ['SLPCore']
