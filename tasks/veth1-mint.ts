import { task } from 'hardhat/config'
import { CHAIN_ID, VETH1_ADDRESS } from '../constants/constants'

task('veth1-mint', 'Mint vETH1').setAction(async function (params, { ethers, network }) {
  const chainId = network.config.chainId as CHAIN_ID

  const vETH1 = await ethers.getContractAt('vETH1', VETH1_ADDRESS[chainId])
  const tx = await vETH1.mint('0x976Cf43c894BA43cf096DA8C1427f6a51b724BB9', ethers.utils.parseEther('100'))

  console.log(`vETH1 mint: ${tx.hash}`)
})
