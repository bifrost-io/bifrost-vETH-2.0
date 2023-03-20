import { task } from 'hardhat/config'

task('batch-deposit', 'Batch deposit ETH')
  .addParam('skip', 'Skip items')
  .addParam('take', 'Take items')
  .setAction(async function (params: { skip: number; take: number }, { ethers, network, deployments }) {
    const slpDeposit = await ethers.getContractAt('SLPDeposit', (await deployments.get('SLPDeposit')).address)

    try {
      console.log(await slpDeposit.withdrawalCredentials())

      const validators = {
        pubkey: 'b0a8765d60745a052b68d2e3be7ac03feea09a43de4b25ba07fae9417bde05c0642b3f4a394f6520a24490f4c810586d',
        withdrawal_credentials: '0100000000000000000000004b014ea4b2a60bf03ed6743f821ee8d66bd3cf09',
        amount: 32000000000,
        signature:
          'a6cdb0a39a73886da7bf554feab002258059878fb82a1c7d98a0ea688db0b9279798cc4c782dfacd23f4aa97c82b520716fa0c648453be2fa19a5882efd063c2ac5f140bd7ef1e6e1353cfe87d37c61beabb9aa42e5a5149af4156169d3051be',
        deposit_message_root: 'd903ad7cb69fe95dcd356469ceceece2338aa94cf8e62b1bdd1e9da31506a612',
        deposit_data_root: 'c6606f32a691947d98485e1ac161da887d30441c5904c54eecf860cfef4df170',
        fork_version: '00000069',
        network_name: 'zhejiang',
        deposit_cli_version: '2.5.0',
      }
      console.log(await slpDeposit.getValidatorData(`0x${validators.pubkey}`, `0x${validators.signature}`))

      console.log(
        await slpDeposit.checkDepositDataRoot([
          `0x${validators.pubkey}`,
          `0x${validators.withdrawal_credentials}`,
          `0x${validators.signature}`,
          `0x${validators.deposit_data_root}`,
        ])
      )

      await slpDeposit.batchDeposit([
        [
          `0x${validators.pubkey}`,
          `0x${validators.withdrawal_credentials}`,
          `0x${validators.signature}`,
          `0x${validators.deposit_data_root}`,
        ],
      ])
    } catch (e) {
      console.log(e)
    }

    console.log('Batch deposited!')
  })
